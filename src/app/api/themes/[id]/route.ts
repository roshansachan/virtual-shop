import { NextRequest, NextResponse } from 'next/server';
import { query, testConnection } from '@/lib/database';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const resolvedParams = await params;
    const themeId = parseInt(resolvedParams.id);

    // Validate theme ID
    if (isNaN(themeId) || themeId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid theme ID' },
        { status: 400 }
      );
    }

    // Check if theme exists and get its details before deletion
    const checkResult = await query(
      'SELECT id, name FROM themes WHERE id = $1',
      [themeId]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Theme not found' },
        { status: 404 }
      );
    }

    const themeName = checkResult.rows[0].name;

    // Check if theme is being used by any scenes
    const scenesResult = await query(
      'SELECT COUNT(*) as scene_count FROM scenes WHERE theme_id = $1',
      [themeId]
    );

    const sceneCount = parseInt(scenesResult.rows[0].scene_count);
    if (sceneCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete theme "${themeName}". It is being used by ${sceneCount} scene(s).`,
          details: { usedByScenes: sceneCount }
        },
        { status: 409 }
      );
    }

    // Delete the theme
    const deleteResult = await query(
      'DELETE FROM themes WHERE id = $1 RETURNING id',
      [themeId]
    );

    if (deleteResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete theme' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Theme "${themeName}" deleted successfully`,
      data: { id: themeId, name: themeName }
    });

  } catch (error) {
    console.error('Error deleting theme:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete theme' },
      { status: 500 }
    );
  }
}

// Optional: Add GET endpoint for fetching a single theme by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const resolvedParams = await params;
    const themeId = parseInt(resolvedParams.id);

    // Validate theme ID
    if (isNaN(themeId) || themeId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid theme ID' },
        { status: 400 }
      );
    }

    // Query single theme
    const result = await query(`
      SELECT 
        id,
        theme_type,
        name,
        image,
        metadata,
        created_at,
        updated_at
      FROM themes 
      WHERE id = $1
    `, [themeId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Theme not found' },
        { status: 404 }
      );
    }

    const theme = {
      id: result.rows[0].id,
      theme_type: result.rows[0].theme_type,
      name: result.rows[0].name,
      image: result.rows[0].image,
      metadata: result.rows[0].metadata || {},
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };

    return NextResponse.json({
      success: true,
      data: theme
    });

  } catch (error) {
    console.error('Error fetching theme:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch theme' },
      { status: 500 }
    );
  }
}