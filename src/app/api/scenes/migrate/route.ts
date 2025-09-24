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

interface LocalStorageScene {
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
    }>;
  }>;
}

interface PlacedImage {
  id: string;
  imageId: string;
  folderName: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  sceneId: string;
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

// POST - Migrate localStorage data to filesystem
export async function POST(request: NextRequest) {
  try {
    const { scenes, placedImages }: { 
      scenes: LocalStorageScene[], 
      placedImages: PlacedImage[] 
    } = await request.json();
    
    // Ensure directories exist
    try {
      await fs.access(SCENES_DIR);
    } catch {
      await fs.mkdir(SCENES_DIR, { recursive: true });
    }
    
    const config: SceneConfig = { scenes: [] };
    
    // Process each scene
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      const sceneFileName = `scene-${index}.json`;
      const sceneFilePath = path.join(SCENES_DIR, sceneFileName);
      
      // Consolidate image coordinates into scene data
      const consolidatedScene: SceneFile = {
        id: scene.id,
        name: scene.name,
        backgroundImage: scene.backgroundImage,
        backgroundImageSize: scene.backgroundImageSize,
        backgroundImageS3Key: scene.backgroundImageS3Key,
        folders: scene.folders.map(folder => ({
          ...folder,
          images: folder.images.map(image => {
            // Find placed image coordinates for this image
            const placedImage = placedImages.find(
              pi => pi.imageId === image.id && pi.sceneId === scene.id
            );
            
            return {
              ...image,
              x: placedImage?.x ?? 0,
              y: placedImage?.y ?? 0
            };
          })
        }))
      };
      
      // Write scene file
      await fs.writeFile(sceneFilePath, JSON.stringify(consolidatedScene, null, 2));
      
      // Add to config
      config.scenes.push({
        index,
        id: scene.id,
        name: scene.name,
        file: sceneFileName
      });
    }
    
    // Write config file
    await fs.writeFile(SCENE_CONFIG_PATH, JSON.stringify(config, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        migratedScenes: scenes.length,
        migratedImages: placedImages.length
      }
    });
  } catch (error) {
    console.error('Failed to migrate data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to migrate data' },
      { status: 500 }
    );
  }
}
