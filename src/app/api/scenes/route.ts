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

// Ensure scenes directory and sceneConfig.json exist
async function ensureConfigExists() {
  try {
    await fs.access(SCENES_DIR);
  } catch {
    await fs.mkdir(SCENES_DIR, { recursive: true });
  }

  try {
    await fs.access(SCENE_CONFIG_PATH);
  } catch {
    const defaultConfig: SceneConfig = { scenes: [] };
    await fs.writeFile(SCENE_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  }
}

// GET - List all scenes
export async function GET() {
  try {
    await ensureConfigExists();
    
    const configData = await fs.readFile(SCENE_CONFIG_PATH, 'utf-8');
    const config: SceneConfig = JSON.parse(configData);
    
    // Load all scene files
    const scenes = await Promise.all(
      config.scenes.map(async (sceneInfo) => {
        const sceneFilePath = path.join(SCENES_DIR, sceneInfo.file);
        try {
          const sceneData = await fs.readFile(sceneFilePath, 'utf-8');
          return JSON.parse(sceneData) as SceneFile;
        } catch (error) {
          console.error(`Failed to load scene file ${sceneInfo.file}:`, error);
          return null;
        }
      })
    );
    
    // Filter out failed loads
    const validScenes = scenes.filter((scene): scene is SceneFile => scene !== null);
    
    return NextResponse.json({ success: true, data: validScenes });
  } catch (error) {
    console.error('Failed to load scenes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load scenes' },
      { status: 500 }
    );
  }
}

// POST - Create new scene
export async function POST(request: NextRequest) {
  try {
    const sceneData: SceneFile = await request.json();
    
    await ensureConfigExists();
    
    // Read current config
    const configData = await fs.readFile(SCENE_CONFIG_PATH, 'utf-8');
    const config: SceneConfig = JSON.parse(configData);
    
    // Find next available index
    const nextIndex = config.scenes.length > 0 
      ? Math.max(...config.scenes.map(s => s.index)) + 1 
      : 0;
    
    const sceneFileName = `scene-${nextIndex}.json`;
    const sceneFilePath = path.join(SCENES_DIR, sceneFileName);
    
    // Write scene file
    await fs.writeFile(sceneFilePath, JSON.stringify(sceneData, null, 2));
    
    // Update config
    config.scenes.push({
      index: nextIndex,
      id: sceneData.id,
      name: sceneData.name,
      file: sceneFileName
    });
    
    await fs.writeFile(SCENE_CONFIG_PATH, JSON.stringify(config, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      data: { scene: sceneData, index: nextIndex }
    });
  } catch (error) {
    console.error('Failed to create scene:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create scene' },
      { status: 500 }
    );
  }
}
