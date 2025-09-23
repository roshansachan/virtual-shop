'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';

// Custom hook for loading images with better CORS handling
const useImageLoader = (src: string | null): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'failed'] => {
  const [image, setImage] = useState<HTMLImageElement | undefined>();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  
  useEffect(() => {
    if (!src) {
      setImage(undefined);
      setStatus('failed');
      return;
    }
    
    setStatus('loading');
    const img = new Image();
    
    // For S3 URLs, try with CORS first, then fallback without CORS
    const isS3Url = src.includes('s3.') && src.includes('amazonaws.com');
    
    const loadWithCors = () => {
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImage(img);
        setStatus('loaded');
      };
      img.onerror = () => {
        if (isS3Url) {
          // Fallback: try without CORS for S3 images
          loadWithoutCors();
        } else {
          console.error('Failed to load image:', src);
          setStatus('failed');
        }
      };
      img.src = src;
    };
    
    const loadWithoutCors = () => {
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        setImage(fallbackImg);
        setStatus('loaded');
      };
      fallbackImg.onerror = () => {
        console.error('Failed to load image even without CORS:', src);
        setStatus('failed');
      };
      fallbackImg.src = src;
    };
    
    if (isS3Url) {
      loadWithCors();
    } else {
      loadWithoutCors();
    }
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);
  
  return [image, status];
};

// Component for the Konva Image
const KonvaImageComponent = ({ src, x, y, draggable = true, onDragEnd, onImageLoad }: {
  src: string;
  x: number;
  y: number;
  draggable?: boolean;
  onDragEnd?: (x: number, y: number) => void;
  onImageLoad?: (dimensions: { width: number; height: number }) => void;
}) => {
  const [image, status] = useImageLoader(src);
  
  // Call onImageLoad when image is successfully loaded
  useEffect(() => {
    if (status === 'loaded' && image && onImageLoad) {
      onImageLoad({
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    }
  }, [image, status, onImageLoad]);
  
  // Only render if image is loaded successfully
  if (status !== 'loaded' || !image) {
    return null;
  }
  
  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      draggable={draggable}
      onDragEnd={(e) => {
        if (onDragEnd) {
          onDragEnd(e.target.x(), e.target.y());
        }
      }}
    />
  );
};

interface FolderImage {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
  visible: boolean;
  s3Key?: string; // For S3 deletion
}

interface Folder {
  id: string;
  name: string;
  expanded: boolean;
  visible: boolean;
  images: FolderImage[];
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
  sceneId: string; // Add scene reference
}

interface Scene {
  id: string;
  name: string;
  backgroundImage: string;
  backgroundImageSize: { width: number; height: number };
  folders: Folder[];
  backgroundImageS3Key?: string; // For S3 deletion
}

interface FolderData {
  folders: Folder[];
}

function DesignStudioContent() {
  const searchParams = useSearchParams();
  const sceneIdParam = searchParams.get('sceneId');
  
  const [placedImages, setPlacedImages] = useState<PlacedImage[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [backgroundImageSize, setBackgroundImageSize] = useState({ width: 1920, height: 1080 });
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSceneMenu, setShowSceneMenu] = useState(false);
  const [showCreateScene, setShowCreateScene] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [newSceneImage, setNewSceneImage] = useState('');
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [uploadingSceneImage, setUploadingSceneImage] = useState(false);
  const [sceneImageUploadProgress, setSceneImageUploadProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneImageInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set stage size based on window dimensions, sidebar state, and background image
  useEffect(() => {
    const updateStageSize = () => {
      if (typeof window !== 'undefined') {
        const sidebarWidth = sidebarCollapsed ? 80 : 400; // Collapsed vs expanded width
        const availableWidth = window.innerWidth - sidebarWidth;
        const availableHeight = window.innerHeight - 80;
        
        // Always set stage size to match available viewport
        // The background image will be positioned within this stage
        setStageSize({
          width: availableWidth,
          height: availableHeight
        });
      }
    };

    updateStageSize();
    window.addEventListener('resize', updateStageSize);
    return () => window.removeEventListener('resize', updateStageSize);
  }, [sidebarCollapsed]);

  // Close scene menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSceneMenu && !(event.target as Element).closest('.scene-menu-container')) {
        setShowSceneMenu(false);
        setShowCreateScene(false);
        setNewSceneName('');
        setNewSceneImage('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSceneMenu]);

  // Get current scene
  const getCurrentScene = useCallback(() => {
    return scenes.find(scene => scene.id === currentSceneId) || scenes[0];
  }, [scenes, currentSceneId]);

  // Get images for current scene
  const getCurrentSceneImages = useCallback(() => {
    return placedImages.filter(img => img.sceneId === currentSceneId);
  }, [placedImages, currentSceneId]);

  // Get folders for current scene
  const getCurrentSceneFolders = useCallback(() => {
    const currentScene = getCurrentScene();
    return currentScene?.folders || [];
  }, [getCurrentScene]);

  // Load background image dimensions
  useEffect(() => {
    // Set a default size for when no background is loaded
    setBackgroundImageSize({
      width: 1920,
      height: 1080
    });
  }, []);

  // Initialize default scene and load saved data
  useEffect(() => {
    const initializeScenes = () => {
      const savedScenes = localStorage.getItem('virtualStoreScenes');
      if (savedScenes) {
        const parsedScenes = JSON.parse(savedScenes);
        // Ensure all scenes have the folders property for backward compatibility
        const scenesWithFolders = parsedScenes.map((scene: any) => ({
          ...scene,
          folders: scene.folders || []
        }));
        setScenes(scenesWithFolders);
        
        // Set the current scene ID based on URL parameter or default to first scene
        if (sceneIdParam && scenesWithFolders.find((scene: Scene) => scene.id === sceneIdParam)) {
          setCurrentSceneId(sceneIdParam);
        } else {
          setCurrentSceneId(scenesWithFolders[0]?.id || '');
        }
      } else {
        // No saved scenes - start with empty state
        setScenes([]);
        setCurrentSceneId('');
      }
    };

    initializeScenes();

    const savedFolderData = localStorage.getItem('virtualStoreFolders');
    if (savedFolderData) {
      // Migration: If old folder data exists, move it to the default scene
      const parsedFolderData = JSON.parse(savedFolderData);
      if (parsedFolderData.folders && parsedFolderData.folders.length > 0) {
        setScenes(prev => prev.map(scene => 
          scene.id === 'default-scene' 
            ? { ...scene, folders: parsedFolderData.folders }
            : scene
        ));
        // Remove old folder data after migration
        localStorage.removeItem('virtualStoreFolders');
      }
    }

    const savedPlacedImages = localStorage.getItem('virtualStoreImages');
    if (savedPlacedImages) {
      setPlacedImages(JSON.parse(savedPlacedImages));
    }
  }, [sceneIdParam]);

  // Save placed images to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('virtualStoreImages', JSON.stringify(placedImages));
  }, [placedImages]);

  // Save scenes to localStorage whenever they change (includes folders now)
  useEffect(() => {
    localStorage.setItem('virtualStoreScenes', JSON.stringify(scenes));
  }, [scenes]);

  // Create new folder
  const createFolder = useCallback(() => {
    if (newFolderName.trim()) {
      const newFolder: Folder = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: newFolderName.trim(),
        expanded: false,
        visible: true,
        images: []
      };
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? { ...scene, folders: [...(scene.folders || []), newFolder] }
          : scene
      ));
      setNewFolderName('');
      setShowCreateFolder(false);
    }
  }, [newFolderName, currentSceneId]);

  // Toggle folder expansion
  const toggleFolder = useCallback((folderId: string) => {
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            folders: (scene.folders || []).map(folder =>
              folder.id === folderId
                ? { ...folder, expanded: !folder.expanded }
                : folder
            )
          }
        : scene
    ));
  }, [currentSceneId]);

  // Rename folder
  const renameFolder = useCallback((folderId: string, newName: string) => {
    if (newName.trim()) {
      const currentScene = getCurrentScene();
      const folder = currentScene?.folders?.find(f => f.id === folderId);
      const oldName = folder?.name;
      
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? {
              ...scene,
              folders: (scene.folders || []).map(folder =>
                folder.id === folderId
                  ? { ...folder, name: newName.trim() }
                  : folder
              )
            }
          : scene
      ));
      
      // Update folder name in placed images
      if (oldName) {
        setPlacedImages(prev =>
          prev.map(img => 
            img.folderName === oldName && img.sceneId === currentSceneId
              ? { ...img, folderName: newName.trim() }
              : img
          )
        );
      }
    }
    setEditingFolderId(null);
  }, [getCurrentScene, currentSceneId]);

  // Rename image
  const renameImage = useCallback((folderId: string, imageId: string, newName: string) => {
    if (newName.trim()) {
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? {
              ...scene,
              folders: (scene.folders || []).map(folder =>
                folder.id === folderId
                  ? {
                      ...folder,
                      images: folder.images.map(img =>
                        img.id === imageId
                          ? { ...img, name: newName.trim() }
                          : img
                      )
                    }
                  : folder
              )
            }
          : scene
      ));

      // Update image name in placed images
      setPlacedImages(prev =>
        prev.map(img =>
          img.imageId === imageId && img.sceneId === currentSceneId
            ? { ...img, name: newName.trim() }
            : img
        )
      );
    }
    setEditingImageId(null);
  }, [currentSceneId]);

  // Handle background image dimensions when loaded
  const handleBackgroundImageLoad = useCallback((dimensions: { width: number; height: number }) => {
    setBackgroundImageSize(dimensions);
    
    // Update the current scene's background image size
    setScenes(prev => prev.map(scene => 
      scene.id === currentSceneId 
        ? { ...scene, backgroundImageSize: dimensions }
        : scene
    ));
  }, [currentSceneId]);

  // Handle image drag end on canvas
  const handleImageDragEnd = useCallback((id: string, x: number, y: number) => {
    setPlacedImages(prev => 
      prev.map(img => 
        img.id === id ? { ...img, x, y } : img
      )
    );
  }, []);

  // Remove placed image from canvas
  const removePlacedImage = useCallback((id: string) => {
    setPlacedImages(prev => prev.filter(img => img.id !== id));
  }, []);

  // Get center position of visible viewport
  const getViewportCenter = useCallback(() => {
    if (stageRef.current) {
      const stage = stageRef.current;
      const centerX = Math.abs(stage.x()) + stageSize.width / 2;
      const centerY = Math.abs(stage.y()) + stageSize.height / 2;
      return { x: centerX, y: centerY };
    }
    return { x: stageSize.width / 2, y: stageSize.height / 2 };
  }, [stageSize]);

  // Get position of existing placed image from same folder
  const getExistingFolderImagePosition = useCallback((folderName: string) => {
    const existingImage = placedImages.find(img => img.folderName === folderName);
    return existingImage ? { x: existingImage.x, y: existingImage.y } : null;
  }, [placedImages]);

  // Auto-place image when it becomes visible
  const autoPlaceImage = useCallback((folderId: string, imageId: string) => {
    console.log('autoPlaceImage called:', { folderId, imageId });
    const currentFolders = getCurrentSceneFolders();
    const folder = currentFolders.find(f => f.id === folderId);
    const image = folder?.images.find(img => img.id === imageId);
    
    console.log('Found folder:', folder);
    console.log('Found image:', image);
    
    if (folder && image && image.visible && folder.visible) {
      // Check if this image is already placed
      const alreadyPlaced = placedImages.some(img => img.imageId === imageId && img.sceneId === currentSceneId);
      console.log('Already placed:', alreadyPlaced);
      if (alreadyPlaced) return;

      // Get position - either from existing folder image or viewport center
      const existingPosition = getExistingFolderImagePosition(folder.name);
      const position = existingPosition || getViewportCenter();
      console.log('Position:', position);
      
      const newPlacedImage: PlacedImage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        imageId: image.id,
        folderName: folder.name,
        src: image.src,
        x: position.x,
        y: position.y,
        width: image.width,
        height: image.height,
        name: image.name,
        sceneId: currentSceneId,
      };
      console.log('Creating placed image:', newPlacedImage);
      setPlacedImages(prev => [...prev, newPlacedImage]);
    } else {
      console.log('Conditions not met:', {
        hasFolder: !!folder,
        hasImage: !!image,
        imageVisible: image?.visible,
        folderVisible: folder?.visible
      });
    }
  }, [getCurrentSceneFolders, placedImages, getExistingFolderImagePosition, getViewportCenter, currentSceneId]);

  // Auto-place visible images that aren't placed yet
  useEffect(() => {
    const currentFolders = getCurrentSceneFolders();
    currentFolders.forEach(folder => {
      if (folder.visible) {
        folder.images.forEach(image => {
          if (image.visible) {
            const alreadyPlaced = placedImages.some(img => img.imageId === image.id && img.sceneId === currentSceneId);
            if (!alreadyPlaced) {
              // Get position - either from existing folder image or viewport center
              const existingPosition = getExistingFolderImagePosition(folder.name);
              const position = existingPosition || getViewportCenter();
              
              const newPlacedImage: PlacedImage = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                imageId: image.id,
                folderName: folder.name,
                src: image.src,
                x: position.x,
                y: position.y,
                width: image.width,
                height: image.height,
                name: image.name,
                sceneId: currentSceneId,
              };
              setPlacedImages(prev => [...prev, newPlacedImage]);
            }
          }
        });
      }
    });
  }, [getCurrentSceneFolders, placedImages, getExistingFolderImagePosition, getViewportCenter, currentSceneId]);

  // Handle file upload to selected folder
  const handleFiles = useCallback(async (files: FileList) => {
    if (!selectedFolder) {
      alert('Please select a folder first');
      return;
    }

    if (!currentSceneId) {
      alert('Please select a scene first');
      return;
    }

    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    for (const file of fileArray) {
      const uploadId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      try {
        // Add to uploading state
        setUploadingImages(prev => [...prev, uploadId]);
        setUploadProgress(prev => ({ ...prev, [uploadId]: 0 }));

        // Create FormData for upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sceneId', currentSceneId);
        formData.append('folderId', selectedFolder);

        // Simulate progress (since we can't track real progress with fetch)
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev[uploadId] || 0;
            if (current < 90) {
              return { ...prev, [uploadId]: current + 10 };
            }
            return prev;
          });
        }, 200);

        // Upload to S3 via our API
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const uploadResult = await response.json();
        
        // Update progress to 100%
        setUploadProgress(prev => ({ ...prev, [uploadId]: 100 }));

        // Create image element to get dimensions
        const img = new Image();
        img.onload = () => {
          const currentFolders = getCurrentSceneFolders();
          const folder = currentFolders.find(f => f.id === selectedFolder);
          const isFirstImage = folder ? folder.images.length === 0 : false;
          
          const newImage: FolderImage = {
            id: uploadId,
            src: uploadResult.data.url,
            name: uploadResult.data.filename,
            width: img.naturalWidth,
            height: img.naturalHeight,
            visible: isFirstImage, // Only first image is visible by default
            s3Key: uploadResult.data.key,
          };
          
          setScenes(prev => prev.map(scene =>
            scene.id === currentSceneId
              ? {
                  ...scene,
                  folders: (scene.folders || []).map(folder =>
                    folder.id === selectedFolder
                      ? { ...folder, images: [...folder.images, newImage] }
                      : folder
                  )
                }
              : scene
          ));
          
          console.log('Image uploaded to S3:', newImage.name, 'URL:', newImage.src);
          
          // Remove from uploading state
          setUploadingImages(prev => prev.filter(id => id !== uploadId));
          setUploadProgress(prev => {
            const { [uploadId]: removed, ...rest } = prev;
            return rest;
          });
        };
        
        img.onerror = () => {
          console.error('Failed to load uploaded image');
          setUploadingImages(prev => prev.filter(id => id !== uploadId));
          setUploadProgress(prev => {
            const { [uploadId]: removed, ...rest } = prev;
            return rest;
          });
        };
        
        img.src = uploadResult.data.url;

      } catch (error) {
        console.error('Upload error:', error);
        alert(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Remove from uploading state
        setUploadingImages(prev => prev.filter(id => id !== uploadId));
        setUploadProgress(prev => {
          const { [uploadId]: removed, ...rest } = prev;
          return rest;
        });
      }
    }
  }, [selectedFolder, currentSceneId, getCurrentSceneFolders]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  // Toggle folder visibility
  const toggleFolderVisibility = useCallback((folderId: string) => {
    const currentFolders = getCurrentSceneFolders();
    const folder = currentFolders.find(f => f.id === folderId);
    const wasVisible = folder?.visible;
    
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            folders: scene.folders.map(folder =>
              folder.id === folderId
                ? { ...folder, visible: !folder.visible }
                : folder
            )
          }
        : scene
    ));

    // Remove all placed images from this folder when hiding
    if (folder && wasVisible) {
      setPlacedImages(prev => prev.filter(img => img.folderName !== folder.name || img.sceneId !== currentSceneId));
    }
  }, [getCurrentSceneFolders, currentSceneId]);

  // Toggle image visibility (ensure only one image per folder is visible)
  const toggleImageVisibility = useCallback((folderId: string, imageId: string) => {
    const currentFolders = getCurrentSceneFolders();
    const folder = currentFolders.find(f => f.id === folderId);
    const image = folder?.images.find(img => img.id === imageId);
    
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            folders: scene.folders.map(folder =>
              folder.id === folderId
                ? {
                    ...folder,
                    images: folder.images.map(img => ({
                      ...img,
                      visible: img.id === imageId ? !img.visible : false // Only one image visible at a time
                    }))
                  }
                : folder
            )
          }
        : scene
    ));

    // Remove placed images from this folder when hiding current image
    if (image && image.visible) {
      setPlacedImages(prev => prev.filter(img => img.folderName !== folder?.name || img.sceneId !== currentSceneId));
    }
  }, [getCurrentSceneFolders, currentSceneId]);

  // Delete folder
  const deleteFolder = useCallback((folderId: string) => {
    const currentFolders = getCurrentSceneFolders();
    const folder = currentFolders.find(f => f.id === folderId);
    if (folder && window.confirm(`Delete folder "${folder.name}" and all its images?`)) {
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? {
              ...scene,
              folders: scene.folders.filter(f => f.id !== folderId)
            }
          : scene
      ));
      
      // Remove placed images from this folder
      setPlacedImages(prev => prev.filter(img => img.folderName !== folder.name || img.sceneId !== currentSceneId));
    }
  }, [getCurrentSceneFolders, currentSceneId]);

  // Delete image from folder
  const deleteImageFromFolder = useCallback(async (folderId: string, imageId: string) => {
    // Find the image to get its S3 key
    const currentFolders = getCurrentSceneFolders();
    const folder = currentFolders.find(f => f.id === folderId);
    const image = folder?.images.find(img => img.id === imageId);
    
    // Delete from S3 if it has an S3 key
    if (image?.s3Key) {
      try {
        const response = await fetch(`/api/delete-image?key=${encodeURIComponent(image.s3Key)}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('Failed to delete image from S3');
        }
      } catch (error) {
        console.error('Error deleting image from S3:', error);
      }
    }
    
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            folders: (scene.folders || []).map(folder =>
              folder.id === folderId
                ? { ...folder, images: folder.images.filter(img => img.id !== imageId) }
                : folder
            )
          }
        : scene
    ));
    
    // Remove from canvas if placed
    setPlacedImages(prev => prev.filter(img => img.imageId !== imageId || img.sceneId !== currentSceneId));
  }, [currentSceneId, getCurrentSceneFolders]);

  // Reset pan to center
  const resetPan = useCallback(() => {
    if (stageRef.current) {
      if (backgroundImageSize.width > 0 && backgroundImageSize.height > 0) {
        // Center the background image in the viewport
        let centerX, centerY;
        
        if (backgroundImageSize.width <= stageSize.width) {
          // Image fits horizontally - center it
          centerX = (stageSize.width - backgroundImageSize.width) / 2;
        } else {
          // Image is larger - position to show the left side
          centerX = 0;
        }
        
        if (backgroundImageSize.height <= stageSize.height) {
          // Image fits vertically - center it
          centerY = (stageSize.height - backgroundImageSize.height) / 2;
        } else {
          // Image is larger - position to show the top
          centerY = 0;
        }
        
        stageRef.current.x(centerX);
        stageRef.current.y(centerY);
      } else {
        // No background image - reset to origin
        stageRef.current.x(0);
        stageRef.current.y(0);
      }
      stageRef.current.batchDraw();
    }
  }, [stageSize, backgroundImageSize]);

  // Reset pan to origin (0,0)
  const resetToOrigin = useCallback(() => {
    if (stageRef.current) {
      stageRef.current.x(0);
      stageRef.current.y(0);
      stageRef.current.batchDraw();
    }
  }, []);

  // Handle stage drag bounds
  const handleStageDragBound = useCallback((pos: { x: number; y: number }) => {
    if (backgroundImageSize.width === 0 || backgroundImageSize.height === 0) {
      // No background image, don't allow panning
      return { x: 0, y: 0 };
    }
    
    // Calculate the bounds to keep the background image visible
    // Horizontal bounds
    let newX = pos.x;
    if (backgroundImageSize.width > stageSize.width) {
      // Image is wider than stage - allow panning
      const minX = -(backgroundImageSize.width - stageSize.width);
      newX = Math.max(minX, Math.min(0, pos.x));
    } else {
      // Image is narrower than stage - center it
      newX = (stageSize.width - backgroundImageSize.width) / 2;
    }
    
    // Vertical bounds  
    let newY = pos.y;
    if (backgroundImageSize.height > stageSize.height) {
      // Image is taller than stage - allow panning
      const minY = -(backgroundImageSize.height - stageSize.height);
      newY = Math.max(minY, Math.min(0, pos.y));
    } else {
      // Image is shorter than stage - center it
      newY = (stageSize.height - backgroundImageSize.height) / 2;
    }
    
    return { x: newX, y: newY };
  }, [backgroundImageSize, stageSize]);

  // Clear all
  const clearAll = useCallback(() => {
    if (window.confirm('Clear all folders and placed images for this scene?')) {
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? { ...scene, folders: [] }
          : scene
      ));
      setPlacedImages(prev => prev.filter(img => img.sceneId !== currentSceneId));
    }
  }, [currentSceneId]);

  // Create new scene
  const createScene = useCallback(() => {
    if (newSceneName.trim() && newSceneImage) {
      const s3Key = (window as any).tempSceneImageS3Key;
      const newScene: Scene = {
        id: Date.now().toString(),
        name: newSceneName.trim(),
        backgroundImage: newSceneImage,
        backgroundImageSize: { width: 1920, height: 1080 },
        folders: [],
        backgroundImageS3Key: s3Key
      };
      setScenes(prev => [...prev, newScene]);
      setCurrentSceneId(newScene.id);
      setNewSceneName('');
      setNewSceneImage('');
      setShowCreateScene(false);
      setShowSceneMenu(false);
      
      // Clear the temporary S3 key
      delete (window as any).tempSceneImageS3Key;
    }
  }, [newSceneName, newSceneImage]);

  // Handle scene background image upload
  const handleSceneImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    try {
      // Set uploading state
      setUploadingSceneImage(true);
      setSceneImageUploadProgress(0);

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sceneId', 'temp-scene-' + Date.now()); // Temporary scene ID for upload

      // Simulate progress
      const progressInterval = setInterval(() => {
        setSceneImageUploadProgress(prev => {
          if (prev < 90) {
            return prev + 10;
          }
          return prev;
        });
      }, 200);

      // Upload to S3 via our API
      const response = await fetch('/api/upload-scene-background', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const uploadResult = await response.json();
      
      // Update progress to 100%
      setSceneImageUploadProgress(100);

      // Create image element to get dimensions
      const img = new Image();
      img.onload = () => {
        // Set the new scene image URL and dimensions
        setNewSceneImage(uploadResult.data.url);
        
        // Store S3 key for later use when creating the scene
        (window as any).tempSceneImageS3Key = uploadResult.data.key;
        
        console.log('Scene background uploaded to S3:', uploadResult.data.url);
        
        // Reset upload state
        setUploadingSceneImage(false);
        setSceneImageUploadProgress(0);
      };
      
      img.onerror = () => {
        console.error('Failed to load uploaded scene image');
        setUploadingSceneImage(false);
        setSceneImageUploadProgress(0);
      };
      
      img.src = uploadResult.data.url;

    } catch (error) {
      console.error('Scene image upload error:', error);
      alert(`Failed to upload scene background: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Reset upload state
      setUploadingSceneImage(false);
      setSceneImageUploadProgress(0);
    }
  }, []);

  // Delete scene
  const deleteScene = useCallback(async (sceneId: string) => {
    if (scenes.length <= 1) {
      alert('Cannot delete the last scene');
      return;
    }
    
    const scene = scenes.find(s => s.id === sceneId);
    if (scene && window.confirm(`Delete scene "${scene.name}"?`)) {
      // Delete background image from S3 if it exists
      if (scene.backgroundImageS3Key) {
        try {
          await fetch(`/api/delete-image?key=${encodeURIComponent(scene.backgroundImageS3Key)}`, {
            method: 'DELETE',
          });
          console.log('Scene background image deleted from S3:', scene.backgroundImageS3Key);
        } catch (error) {
          console.error('Failed to delete scene background from S3:', error);
          // Continue with scene deletion even if S3 deletion fails
        }
      }
      
      setScenes(prev => prev.filter(s => s.id !== sceneId));
      
      // Remove all placed images from this scene
      setPlacedImages(prev => prev.filter(img => img.sceneId !== sceneId));
      
      // Switch to another scene if deleting current scene
      if (currentSceneId === sceneId) {
        const remainingScenes = scenes.filter(s => s.id !== sceneId);
        setCurrentSceneId(remainingScenes[0]?.id || '');
      }
    }
  }, [scenes, currentSceneId]);

  return (
    <div className="h-screen flex bg-gray-50 relative">
      {/* Fixed Collapsible Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-10 ${
        sidebarCollapsed ? 'w-20' : 'w-96'
      }`}>
        {/* Compact Sidebar Header with Scene Name */}
        <div className="p-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900">{getCurrentScene()?.name || 'Scene'}</h1>
                <div className="relative scene-menu-container">
                  <button
                    onClick={() => setShowSceneMenu(!showSceneMenu)}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Scene options"
                  >
                    ⚙️
                  </button>
                  {showSceneMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px]">
                      <div className="p-3">
                        {!showCreateScene ? (
                          <>
                            <div className="text-xs font-medium text-gray-500 mb-3">Scene Management</div>
                            
                            {/* Existing Scenes List */}
                            <div className="space-y-1 mb-3">
                              <div className="text-xs text-gray-500 mb-2">Switch Scene ({scenes.length})</div>
                              {scenes.map((scene) => (
                                <div key={scene.id} className="flex items-center justify-between group">
                                  <button
                                    onClick={() => {
                                      setCurrentSceneId(scene.id);
                                      setShowSceneMenu(false);
                                    }}
                                    className={`flex-1 text-left px-2 py-2 rounded text-sm flex items-center space-x-2 ${
                                      scene.id === currentSceneId
                                        ? 'bg-blue-100 text-blue-900'
                                        : 'hover:bg-gray-100'
                                    }`}
                                  >
                                    <div className="w-6 h-6 rounded border border-gray-300 overflow-hidden flex-shrink-0">
                                      <img 
                                        src={scene.backgroundImage} 
                                        alt={scene.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <span className="truncate">{scene.name}</span>
                                    {scene.id === currentSceneId && <span className="text-blue-500">✓</span>}
                                  </button>
                                  {scenes.length > 1 && (
                                    <button
                                      onClick={() => deleteScene(scene.id)}
                                      className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 p-1 ml-1"
                                      title="Delete scene"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            <hr className="my-3" />
                            
                            {/* Create New Scene Button */}
                            <button
                              onClick={() => setShowCreateScene(true)}
                              className="w-full text-left px-2 py-2 rounded text-sm hover:bg-green-50 text-green-600 font-medium flex items-center space-x-2"
                            >
                              <span>+</span>
                              <span>Create New Scene</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Create Scene Form */}
                            <div className="text-xs font-medium text-gray-500 mb-3">Create New Scene</div>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Scene Name</label>
                                <input
                                  type="text"
                                  value={newSceneName}
                                  onChange={(e) => setNewSceneName(e.target.value)}
                                  placeholder="Enter scene name"
                                  className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  autoFocus
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Background Image</label>
                                <div className="space-y-2">
                                  <button
                                    onClick={() => sceneImageInputRef.current?.click()}
                                    disabled={uploadingSceneImage}
                                    className={`w-full px-2 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center space-x-2 ${
                                      uploadingSceneImage ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    <span>📤</span>
                                    <span>{uploadingSceneImage ? 'Uploading...' : (newSceneImage ? 'Change Image' : 'Upload Image')}</span>
                                  </button>
                                  
                                  {uploadingSceneImage && (
                                    <div className="space-y-1">
                                      <div className="w-full bg-blue-200 rounded-full h-2">
                                        <div 
                                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                          style={{ width: `${sceneImageUploadProgress}%` }}
                                        ></div>
                                      </div>
                                      <div className="text-xs text-blue-600 text-center">
                                        Uploading scene background... {sceneImageUploadProgress}%
                                      </div>
                                    </div>
                                  )}
                                  
                                  {newSceneImage && !uploadingSceneImage && (
                                    <div className="flex items-center space-x-2">
                                      <div className="w-8 h-8 rounded border border-gray-300 overflow-hidden">
                                        <img 
                                          src={newSceneImage} 
                                          alt="Preview"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <span className="text-xs text-green-600">✓ Image selected</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex space-x-2 pt-2">
                                <button
                                  onClick={createScene}
                                  disabled={!newSceneName.trim() || !newSceneImage || uploadingSceneImage}
                                  className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                  {uploadingSceneImage ? 'Uploading...' : 'Create Scene'}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowCreateScene(false);
                                    setNewSceneName('');
                                    setNewSceneImage('');
                                  }}
                                  className="flex-1 bg-gray-500 text-white py-2 px-3 rounded text-sm hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>
        </div>

        {/* Sidebar Content with proper height calculation */}
        <div className="flex flex-col" style={{ height: 'calc(100% - 60px)' }}>
          {/* Folders Section - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {!sidebarCollapsed ? (
              <>
                {/* Folders Explorer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Products</h3>
                    {getCurrentSceneFolders().length > 0 && (
                      <button
                        onClick={clearAll}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  {getCurrentSceneFolders().length === 0 ? (
                    <p className="text-gray-500 text-center py-8 text-sm">
                      No products created yet. Create a product to start organizing your catalogue.
                    </p>
                  ) : (
                    getCurrentSceneFolders().map((folder) => (
                      <div key={folder.id} className="border border-gray-200 rounded-lg">
                        {/* Folder Header */}
                        <div 
                          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 ${
                            selectedFolder === folder.id ? 'bg-blue-50 border-blue-300' : ''
                          } ${!folder.visible ? 'opacity-50' : ''}`}
                          onClick={() => setSelectedFolder(folder.id)}
                        >
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolder(folder.id);
                              }}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              {folder.expanded ? '−' : '+'}
                            </button>
                            <span>📁</span>
                            {editingFolderId === folder.id ? (
                              <input
                                type="text"
                                defaultValue={folder.name}
                                className="text-sm font-medium bg-white border border-gray-300 rounded px-2 py-1"
                                onBlur={(e) => renameFolder(folder.id, e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    renameFolder(folder.id, (e.target as HTMLInputElement).value);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            ) : (
                              <span 
                                className="text-sm font-medium text-gray-900"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFolderId(folder.id);
                                }}
                              >
                                {folder.name}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">({folder.images.length})</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderVisibility(folder.id);
                              }}
                              className={`px-2 py-1 text-xs rounded ${
                                folder.visible 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {folder.visible ? 'Hide' : 'Show'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFolder(folder.id);
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Folder Contents */}
                        {folder.expanded && (
                          <div className="border-t border-gray-200 bg-gray-50">
                            {folder.images.length === 0 ? (
                              <p className="text-gray-500 text-center py-4 text-sm">
                                No images in this folder
                              </p>
                            ) : (
                              <div className="space-y-1 p-2">
                                {folder.images.map((image) => (
                                  <div
                                    key={image.id}
                                    className={`flex items-center justify-between p-2 bg-white rounded border hover:bg-gray-50 ${
                                      !image.visible ? 'opacity-50' : ''
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <img
                                        src={image.src}
                                        alt={image.name}
                                        className="w-8 h-8 object-cover rounded"
                                      />
                                      {editingImageId === image.id ? (
                                        <input
                                          type="text"
                                          defaultValue={image.name}
                                          className="text-xs bg-white border border-gray-300 rounded px-2 py-1"
                                          onBlur={(e) => renameImage(folder.id, image.id, e.target.value)}
                                          onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                              renameImage(folder.id, image.id, (e.target as HTMLInputElement).value);
                                            }
                                          }}
                                          autoFocus
                                        />
                                      ) : (
                                        <span 
                                          className="text-xs text-gray-700 cursor-pointer"
                                          onDoubleClick={() => setEditingImageId(image.id)}
                                        >
                                          {image.name}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <button
                                        onClick={() => toggleImageVisibility(folder.id, image.id)}
                                        className={`px-2 py-1 text-xs rounded ${
                                          image.visible 
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                      >
                                        {image.visible ? 'Hide' : 'Show'}
                                      </button>
                                      <button
                                        onClick={() => deleteImageFromFolder(folder.id, image.id)}
                                        className="text-red-600 hover:text-red-800 text-xs"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* Upload Progress Indicators */}
                                {uploadingImages.length > 0 && selectedFolder === folder.id && (
                                  <div className="space-y-1">
                                    {uploadingImages.map((uploadId) => (
                                      <div
                                        key={uploadId}
                                        className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200"
                                      >
                                        <div className="flex items-center space-x-2">
                                          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                            <span className="text-xs">📤</span>
                                          </div>
                                          <span className="text-xs text-blue-700">
                                            Uploading...
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <div className="w-20 bg-blue-200 rounded-full h-2">
                                            <div 
                                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                              style={{ width: `${uploadProgress[uploadId] || 0}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-xs text-blue-600">
                                            {uploadProgress[uploadId] || 0}%
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              /* Collapsed sidebar icons */
              <div className="space-y-4">
                {getCurrentSceneFolders().map((folder) => (
                  <div
                    key={folder.id}
                    className={`p-3 rounded-lg cursor-pointer ${
                      selectedFolder === folder.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                    } ${!folder.visible ? 'opacity-50' : ''}`}
                    onClick={() => setSelectedFolder(folder.id)}
                    title={folder.name}
                  >
                    📁
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fixed Footer Section with Create and Upload */}
          <div className="border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {!sidebarCollapsed ? (
              <div className="p-4 space-y-3">
                {/* Create Folder Section */}
                {!showCreateFolder ? (
                  <button
                    onClick={() => setShowCreateFolder(true)}
                    disabled={!currentSceneId}
                    className={`w-full py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                      currentSceneId 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={currentSceneId ? "Create New Product" : "Please select a scene first"}
                  >
                    <span>📁</span>
                    <span>Create New Product</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Product name"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && currentSceneId && newFolderName.trim() && createFolder()}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={createFolder}
                        disabled={!currentSceneId || !newFolderName.trim()}
                        className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                          currentSceneId && newFolderName.trim()
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateFolder(false);
                          setNewFolderName('');
                        }}
                        className="flex-1 bg-gray-500 text-white py-2 px-3 rounded text-sm hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-300"></div>

                {/* Upload Section */}
                {selectedFolder ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-700">
                      <strong>Selected:</strong> {getCurrentSceneFolders().find(f => f.id === selectedFolder)?.name}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <span>📤</span>
                      <span>Upload Images</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-sm py-3">
                    Select a folder to upload images
                  </div>
                )}
              </div>
            ) : (
              /* Collapsed view footer */
              <div className="p-3 space-y-3">
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors"
                  title="Create New Product"
                >
                  📁
                </button>
                {selectedFolder ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition-colors"
                    title="Upload Images"
                  >
                    📤
                  </button>
                ) : (
                  <div className="text-center text-gray-400 p-3" title="Select a folder first">
                    📤
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />

      <input
        ref={sceneImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleSceneImageUpload}
        className="hidden"
      />

      {/* Main Canvas Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'ml-20' : 'ml-96'
      }`}>
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Design Studio
              </h2>
              <p className="text-gray-600">
                Drag to pan the view • Place images from folders onto the scene
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href={`/?scene=${encodeURIComponent(getCurrentScene()?.name || '')}&sceneId=${currentSceneId}`}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                ← Mobile View
              </Link>
              <div className="text-sm text-gray-500">
                Placed: {getCurrentSceneImages().length} items
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={resetToOrigin}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={resetPan}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  Center
                </button>
              </div>
            </div>
          </div>
        </div>

        <div 
          className="flex-1 bg-gray-100 overflow-hidden relative" 
          ref={containerRef}
          style={{ cursor: 'grab' }}
        >
          {scenes.length === 0 ? (
            /* Empty state when no scenes exist */
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🏠</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Scenes Yet</h3>
                <p className="text-gray-500 mb-4">Create your first scene to get started</p>
                <button
                  onClick={() => setShowCreateScene(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Create First Scene
                </button>
              </div>
            </div>
          ) : (
            /* Container for the canvas */
            <div className="absolute inset-0">
            <Stage
              ref={stageRef}
              width={stageSize.width}
              height={stageSize.height}
              draggable={true}
              dragBoundFunc={handleStageDragBound}
              className="absolute top-0 left-0"
            >
              <Layer>
                {/* Scene Background - only render if backgroundImage exists */}
                {getCurrentScene()?.backgroundImage ? (
                  <KonvaImageComponent
                    src={getCurrentScene()!.backgroundImage}
                    x={0}
                    y={0}
                    draggable={false}
                    onImageLoad={handleBackgroundImageLoad}
                  />
                ) : (
                  /* Empty background placeholder */
                  <></>
                )}
                
                {/* Placed Images - only show current scene items that are visible */}
                {getCurrentSceneImages()
                  .filter(img => {
                    const currentFolders = getCurrentSceneFolders();
                    const folder = currentFolders.find(f => f.name === img.folderName);
                    const image = folder?.images.find(i => i.id === img.imageId);
                    return folder?.visible && image?.visible;
                  })
                  .map((img) => (
                    <KonvaImageComponent
                      key={img.id}
                      src={img.src}
                      x={img.x}
                      y={img.y}
                      draggable={true}
                      onDragEnd={(x, y) => handleImageDragEnd(img.id, x, y)}
                    />
                  ))}
              </Layer>
            </Stage>
          </div>
          )}

          {/* Pan instructions overlay - only show when there are scenes */}
          {scenes.length > 0 && (
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
              <div className="flex items-center space-x-2">
                <span>🖱️</span>
                <span>Drag background to pan • Drag items to move</span>
              </div>
            </div>
          )}

          {/* Placed Images List Overlay - only show when there are scenes and images */}
          {scenes.length > 0 && getCurrentSceneImages().length > 0 && (
            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Placed Items ({getCurrentSceneImages().filter(img => {
                  const currentFolders = getCurrentSceneFolders();
                  const folder = currentFolders.find(f => f.name === img.folderName);
                  const image = folder?.images.find(i => i.id === img.imageId);
                  return folder?.visible && image?.visible;
                }).length}/{getCurrentSceneImages().length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {getCurrentSceneImages().map((img) => {
                  const currentFolders = getCurrentSceneFolders();
                  const folder = currentFolders.find(f => f.name === img.folderName);
                  const image = folder?.images.find(i => i.id === img.imageId);
                  const isVisible = folder?.visible && image?.visible;
                  
                  return (
                    <div key={img.id} className={`flex items-center justify-between text-xs ${!isVisible ? 'opacity-50' : ''}`}>
                      <span className="text-gray-700 truncate">
                        {isVisible ? '👁️' : '🙈'} {img.name}
                      </span>
                      <button
                        onClick={() => removePlacedImage(img.id)}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DesignStudioPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading design studio...</p>
      </div>
    </div>}>
      <DesignStudioContent />
    </Suspense>
  );
}