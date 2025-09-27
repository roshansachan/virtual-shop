import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { s3KeyToUrl } from '@/lib/s3-utils';

// DELETE - Delete scene from database only
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const sceneId = params.id;
    
    // Parse scene ID - should be numeric for database
    const isNumeric = !isNaN(parseInt(sceneId));
    if (!isNumeric) {
      return NextResponse.json(
        { success: false, error: 'Invalid scene ID format' },
        { status: 400 }
      );
    }
    
    const numericSceneId = parseInt(sceneId);
    
    // Check if scene exists in database
    const sceneResult = await query(
      'SELECT id, name FROM scenes WHERE id = $1',
      [numericSceneId]
    );
    
    if (sceneResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Scene not found in database' },
        { status: 404 }
      );
    }
    
    const scene = sceneResult.rows[0];
    
    // Delete from database (CASCADE will handle related spaces, placements, etc.)
    await query('DELETE FROM scenes WHERE id = $1', [numericSceneId]);
    
    return NextResponse.json({ 
      success: true,
      message: `Scene "${scene.name}" deleted successfully from database`
    });
  } catch (error) {
    console.error('Failed to delete scene from database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete scene from database' },
      { status: 500 }
    );
  }
}

// GET - Get specific scene from database
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const sceneId = params.id;
    
    // Parse scene ID - should be numeric for database
    const isNumeric = !isNaN(parseInt(sceneId));
    if (!isNumeric) {
      return NextResponse.json(
        { success: false, error: 'Invalid scene ID format' },
        { status: 400 }
      );
    }
    
    const numericSceneId = parseInt(sceneId);
    
    // Get scene from database
    const result = await query(
      `SELECT id, name, type, image, theme_id, created_at, updated_at 
       FROM scenes 
       WHERE id = $1`,
      [numericSceneId]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Scene not found in database' },
        { status: 404 }
      );
    }
    
    const dbScene = result.rows[0];
    
    // Convert to frontend format
    const scene = {
      id: dbScene.id.toString(),
      name: dbScene.name,
      type: dbScene.type || undefined,
      backgroundImage: dbScene.image ? s3KeyToUrl(dbScene.image) : '',
      backgroundImageSize: { width: 1920, height: 1080 },
      backgroundImageS3Key: dbScene.image || undefined,
      theme_id: dbScene.theme_id,
      dbId: dbScene.id.toString(),
      spaces: [] // Empty for now
    };
    
    return NextResponse.json({ success: true, data: scene });
  } catch (error) {
    console.error('Failed to get scene from database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get scene from database' },
      { status: 500 }
    );
  }
}
