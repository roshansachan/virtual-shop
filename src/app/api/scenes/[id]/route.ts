import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SCENES_DIR = path.join(process.cwd(), 'public', 'scenes');
const SCENE_CONFIG_PATH = path.join(process.cwd(), 'public', 'sceneConfig.json');

interface SceneConfig {
  scenes: Array<{
    index: number;
    id: string;
    name: string;
    file: string;
  }>;
}

interface SceneFile {
  id: string;
  name: string;
  backgroundImage: string;
  backgroundImageSize: { width: number; height: number };
  backgroundImageS3Key?: string;
  folders: Array<{
    id: string;
    name: string;
    expanded: boolean;
    visible: boolean;
    images: Array<{
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
}

// PUT - Update existing scene
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sceneId = params.id;
    const sceneData: SceneFile = await request.json();
    
    // Read current config to find the scene file
    const configData = await fs.readFile(SCENE_CONFIG_PATH, 'utf-8');
    const config: SceneConfig = JSON.parse(configData);
    
    const sceneInfo = config.scenes.find(s => s.id === sceneId);
    if (!sceneInfo) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }
    
    const sceneFilePath = path.join(SCENES_DIR, sceneInfo.file);
    
    // Update scene file
    await fs.writeFile(sceneFilePath, JSON.stringify(sceneData, null, 2));
    
    // Update config if scene name changed
    if (sceneData.name !== sceneInfo.name) {
      const updatedConfig = {
        ...config,
        scenes: config.scenes.map(s =>
          s.id === sceneId ? { ...s, name: sceneData.name } : s
        )
      };
      await fs.writeFile(SCENE_CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));
    }
    
    return NextResponse.json({ success: true, data: sceneData });
  } catch (error) {
    console.error('Failed to update scene:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update scene' },
      { status: 500 }
    );
  }
}

// DELETE - Delete scene
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sceneId = params.id;
    
    // Read current config
    const configData = await fs.readFile(SCENE_CONFIG_PATH, 'utf-8');
    const config: SceneConfig = JSON.parse(configData);
    
    const sceneInfo = config.scenes.find(s => s.id === sceneId);
    if (!sceneInfo) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }
    
    // Delete scene file
    const sceneFilePath = path.join(SCENES_DIR, sceneInfo.file);
    try {
      await fs.unlink(sceneFilePath);
    } catch (error) {
      console.warn(`Failed to delete scene file ${sceneInfo.file}:`, error);
    }
    
    // Update config to remove scene
    const updatedConfig = {
      ...config,
      scenes: config.scenes.filter(s => s.id !== sceneId)
    };
    
    await fs.writeFile(SCENE_CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scene:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete scene' },
      { status: 500 }
    );
  }
}

// GET - Get specific scene
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sceneId = params.id;
    
    // Read current config
    const configData = await fs.readFile(SCENE_CONFIG_PATH, 'utf-8');
    const config: SceneConfig = JSON.parse(configData);
    
    const sceneInfo = config.scenes.find(s => s.id === sceneId);
    if (!sceneInfo) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }
    
    // Read scene file
    const sceneFilePath = path.join(SCENES_DIR, sceneInfo.file);
    const sceneData = await fs.readFile(sceneFilePath, 'utf-8');
    const scene: SceneFile = JSON.parse(sceneData);
    
    return NextResponse.json({ success: true, data: scene });
  } catch (error) {
    console.error('Failed to get scene:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get scene' },
      { status: 500 }
    );
  }
}
