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
export async function GET() {
  try {
    // Fetch scenes directly from database
    const result = await query(
      `SELECT id, name, type, image, theme_id, created_at, updated_at 
       FROM scenes 
       ORDER BY created_at DESC`
    );
    
    const dbScenes: DBScene[] = result.rows;
    
    // Convert database scenes to frontend format with S3 URLs
    const scenes = dbScenes.map(dbScene => ({
      id: dbScene.id.toString(),
      name: dbScene.name,
      type: dbScene.type || undefined,
      backgroundImage: dbScene.image ? s3KeyToUrl(dbScene.image) : '',
      backgroundImageSize: { width: 1920, height: 1080 }, // Default size
      backgroundImageS3Key: dbScene.image || undefined,
      theme_id: dbScene.theme_id,
      dbId: dbScene.id.toString(),
      spaces: [] // Empty for now, will be populated when spaces are implemented
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
