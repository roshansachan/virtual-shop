import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { s3KeyToUrl } from '@/lib/s3-utils';
import { DBScene } from '@/types/database';

interface SceneFile {
  id: string;
  name: string;
  type?: string; // scene type
  theme_id?: number; // theme reference
  dbId?: string; // Database ID for future reference
  backgroundImage: string;
  backgroundImageSize: { width: number; height: number };
  backgroundImageS3Key?: string;
  spaces: Array<{
    id: string;
    name: string;
    image?: string;
    expanded: boolean;
    visible: boolean;
    placements: Array<{
      id: string;
      name: string;
      expanded: boolean;
      visible: boolean;
      products: Array<{
        id: string;
        name: string;
        src: string;
        s3Key: string;
        visible: boolean;
        width: number;
        height: number;
        x: number;
        y: number;
      }>;
    }>;
  }>;
}

// GET - List all scenes from database
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sceneType = searchParams.get('sceneType');

    // Build query with optional type filter
    let queryText = `SELECT s.id, s.name, s.type, s.image, s.theme_id, s.created_at, s.updated_at, sp.id as space_id, sp.name as space_name, sp.image as space_image
       FROM scenes s
       LEFT JOIN spaces sp ON sp.scene_id = s.id`;
    
    const queryParams: any[] = [];
    
    if (sceneType) {
      queryText += ` WHERE s.type = $1`;
      queryParams.push(sceneType);
    }
    
    queryText += ` ORDER BY s.created_at DESC, sp.id`;

    // Fetch scenes directly from database
    const result = await query(queryText, queryParams);
    
    const dbRows: any[] = result.rows;
    
    // Group scenes and their spaces
    const sceneMap = new Map();
    dbRows.forEach(row => {
      const sceneId = row.id;
      if (!sceneMap.has(sceneId)) {
        sceneMap.set(sceneId, {
          id: row.id,
          name: row.name,
          type: row.type,
          image: row.image,
          theme_id: row.theme_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          spaces: []
        });
      }
      if (row.space_id) {
        sceneMap.get(sceneId).spaces.push({
          id: row.space_id.toString(),
          name: row.space_name,
          image: row.space_image,
          expanded: true,
          visible: true
        });
      }
    });
    
    // Convert database scenes to frontend format with S3 URLs
    const scenes = Array.from(sceneMap.values()).map(dbScene => ({
      id: dbScene.id.toString(),
      name: dbScene.name,
      type: dbScene.type || undefined,
      backgroundImage: dbScene.image ? s3KeyToUrl(dbScene.image) : '',
      backgroundImageSize: { width: 1920, height: 1080 }, // Default size
      backgroundImageS3Key: dbScene.image || undefined,
      theme_id: dbScene.theme_id,
      dbId: dbScene.id.toString(),
      spaces: dbScene.spaces
    }));
    
    return NextResponse.json({ success: true, data: scenes });
  } catch (error) {
    console.error('Failed to load scenes from database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load scenes from database' },
      { status: 500 }
    );
  }
}

// POST - Create new scene in database only
export async function POST(request: NextRequest) {
  try {
    const sceneData: SceneFile = await request.json();
    
    // Save scene to database only
    const insertResult = await query(
      `INSERT INTO scenes (name, type, image, theme_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, type, image, theme_id, created_at, updated_at`,
      [
        sceneData.name,
        sceneData.type || null,
        sceneData.backgroundImageS3Key || null, // Store S3 key, not URL
        sceneData.theme_id || null
      ]
    );
    
    const dbScene: DBScene = insertResult.rows[0];
    
    // Return the created scene data
    const createdScene = {
      id: dbScene.id.toString(),
      name: dbScene.name,
      type: dbScene.type || undefined,
      backgroundImage: dbScene.image ? s3KeyToUrl(dbScene.image) : '',
      backgroundImageSize: { width: 1920, height: 1080 },
      backgroundImageS3Key: dbScene.image || undefined,
      theme_id: dbScene.theme_id,
      dbId: dbScene.id.toString(),
      spaces: []
    };
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        scene: createdScene,
        dbScene: dbScene 
      }
    });
  } catch (error) {
    console.error('Failed to create scene in database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create scene in database' },
      { status: 500 }
    );
  }
}

// PUT - Update existing scene in database
export async function PUT(request: NextRequest) {
  try {
    const sceneData = await request.json();
    const { id, name, type, backgroundImageS3Key, theme_id } = sceneData;
    
    // Validate required fields
    if (!id || typeof id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'id is required and must be a number' },
        { status: 400 }
      );
    }
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'name is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    // Update scene in database
    const updateResult = await query(
      `UPDATE scenes 
       SET name = $1, type = $2, image = $3, theme_id = $4, updated_at = NOW()
       WHERE id = $5 
       RETURNING id, name, type, image, theme_id, created_at, updated_at`,
      [
        name.trim(),
        type || null,
        backgroundImageS3Key || null,
        theme_id || null,
        id
      ]
    );
    
    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }
    
    const dbScene: DBScene = updateResult.rows[0];
    
    // Return the updated scene data
    const updatedScene = {
      id: dbScene.id.toString(),
      name: dbScene.name,
      type: dbScene.type || undefined,
      backgroundImage: dbScene.image ? s3KeyToUrl(dbScene.image) : '',
      backgroundImageSize: { width: 1920, height: 1080 },
      backgroundImageS3Key: dbScene.image || undefined,
      theme_id: dbScene.theme_id,
      dbId: dbScene.id.toString(),
      spaces: []
    };
    
    return NextResponse.json({ 
      success: true, 
      data: updatedScene
    });
  } catch (error) {
    console.error('Failed to update scene in database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update scene in database' },
      { status: 500 }
    );
  }
}
