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

interface Product {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
  visible: boolean;
  s3Key?: string; // For S3 deletion
  x?: number; // X coordinate for placement
  y?: number; // Y coordinate for placement
}

interface Placement {
  id: string;
  name: string;
  expanded: boolean;
  visible: boolean;
  products: Product[];
}

interface Space {
  id: string;
  name: string;
  expanded: boolean;
  visible: boolean;
  placements: Placement[];
}

interface PlacedProduct {
  id: string;
  productId: string;
  placementName: string;
  spaceName: string;
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
  spaces: Space[];
  backgroundImageS3Key?: string; // For S3 deletion
}

interface SpaceData {
  spaces: Space[];
}

function DesignStudioContent() {
  const searchParams = useSearchParams();
  const sceneIdParam = searchParams.get('sceneId');
  
  const [placedProducts, setPlacedProducts] = useState<PlacedProduct[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>('');
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [backgroundImageSize, setBackgroundImageSize] = useState({ width: 1920, height: 1080 });
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingPlacementId, setEditingPlacementId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newPlacementName, setNewPlacementName] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showCreatePlacement, setShowCreatePlacement] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSceneMenu, setShowSceneMenu] = useState(false);
  const [showCreateScene, setShowCreateScene] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [newSceneImage, setNewSceneImage] = useState('');
  const [newSceneImageS3Key, setNewSceneImageS3Key] = useState('');
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [uploadingSceneImage, setUploadingSceneImage] = useState(false);
  const [sceneImageUploadProgress, setSceneImageUploadProgress] = useState(0);
  // const [showAssetManager, setShowAssetManager] = useState(false);
  // const [showSceneAssetManager, setShowSceneAssetManager] = useState(false);
  
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

  // Get current scene
  const getCurrentScene = useCallback(() => {
    return scenes.find(scene => scene.id === currentSceneId) || scenes[0];
  }, [scenes, currentSceneId]);

  // Get current scene products that are placed on canvas
  const getCurrentPlacedProducts = useCallback(() => {
    return placedProducts.filter(product => product.sceneId === currentSceneId);
  }, [placedProducts, currentSceneId]);

  // Get spaces for current scene
  const getCurrentSceneSpaces = useCallback(() => {
    const currentScene = getCurrentScene();
    return currentScene?.spaces || [];
  }, [getCurrentScene]);

  // Get currently selected space
  const getSelectedSpace = useCallback(() => {
    const spaces = getCurrentSceneSpaces();
    return spaces.find(space => space.id === selectedSpaceId);
  }, [getCurrentSceneSpaces, selectedSpaceId]);

  // Get placements for selected space
  const getSelectedSpacePlacements = useCallback(() => {
    const selectedSpace = getSelectedSpace();
    return selectedSpace?.placements || [];
  }, [getSelectedSpace]);

  // Get currently selected placement
  const getSelectedPlacement = useCallback(() => {
    const placements = getSelectedSpacePlacements();
    return placements.find(placement => placement.id === selectedPlacementId);
  }, [getSelectedSpacePlacements, selectedPlacementId]);

  // Load background image dimensions
  useEffect(() => {
    // Set a default size for when no background is loaded
    setBackgroundImageSize({
      width: 1920,
      height: 1080
    });
  }, []);

  // Initialize scenes from filesystem
  useEffect(() => {
    const initializeScenes = async () => {
      try {
        // Load scenes from filesystem
        const response = await fetch('/api/scenes');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const loadedScenes = result.data;
            setScenes(loadedScenes);
            
            // Extract placed products from scene data (they're now consolidated)
            const allPlacedProducts: PlacedProduct[] = [];
            loadedScenes.forEach((scene: Scene) => {
              scene.spaces?.forEach(space => {
                space.placements?.forEach(placement => {
                  placement.products.forEach(product => {
                    if (product.x !== undefined && product.y !== undefined) {
                      allPlacedProducts.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        productId: product.id,
                        placementName: placement.name,
                        spaceName: space.name,
                        src: product.src,
                        x: product.x,
                        y: product.y,
                        width: product.width,
                        height: product.height,
                        name: product.name,
                        sceneId: scene.id,
                      });
                    }
                  });
                });
              });
            });
            setPlacedProducts(allPlacedProducts);
            
            // Set the current scene ID based on URL parameter or default to first scene
            if (sceneIdParam && loadedScenes.find((scene: Scene) => scene.id === sceneIdParam)) {
              setCurrentSceneId(sceneIdParam);
            } else {
              setCurrentSceneId(loadedScenes[0]?.id || '');
            }
          }
        } else {
          console.error('Failed to load scenes from filesystem');
          setScenes([]);
          setCurrentSceneId('');
        }
      } catch (error) {
        console.error('Error initializing scenes:', error);
        setScenes([]);
        setCurrentSceneId('');
      }
    };

    initializeScenes();
  }, [sceneIdParam]);

  // Manual save scene function
  const saveScene = useCallback(async () => {
    if (!currentSceneId || scenes.length === 0) return false;
    
    const currentScene = scenes.find(scene => scene.id === currentSceneId);
    if (!currentScene) return false;
    
    try {
      // Update scene with current placed product coordinates
      const updatedScene = {
        ...currentScene,
        spaces: currentScene.spaces?.map(space => ({
          ...space,
          placements: space.placements.map(placement => ({
            ...placement,
            products: placement.products.map(product => {
              // Find placed product coordinates for this product
              const placedProduct = placedProducts.find(
                pp => pp.productId === product.id && pp.sceneId === currentSceneId
              );
              
              return {
                ...product,
                x: placedProduct?.x ?? product.x ?? 0,
                y: placedProduct?.y ?? product.y ?? 0
              };
            })
          }))
        }))
      };
      
      const response = await fetch(`/api/scenes/${currentSceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedScene)
      });
      
      return response.ok;
    } catch (error) {
      console.error('Failed to save scene:', error);
      return false;
    }
  }, [currentSceneId, scenes, placedProducts]);

  // Create new space
  const createSpace = useCallback(() => {
    if (newSpaceName.trim()) {
      const newSpace: Space = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: newSpaceName.trim(),
        expanded: false,
        visible: true,
        placements: []
      };
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? { ...scene, spaces: [...(scene.spaces || []), newSpace] }
          : scene
      ));
      setNewSpaceName('');
      setShowCreateSpace(false);
    }
  }, [newSpaceName, currentSceneId]);

  // Toggle space expanded/collapsed
  const toggleSpace = useCallback((spaceId: string) => {
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            spaces: (scene.spaces || []).map(space =>
              space.id === spaceId
                ? { ...space, expanded: !space.expanded }
                : space
            )
          }
        : scene
    ));
  }, [currentSceneId]);

  // Rename space
  const renameSpace = useCallback((spaceId: string, newName: string) => {
    if (newName.trim()) {
      const currentScene = getCurrentScene();
      const space = currentScene?.spaces?.find(s => s.id === spaceId);
      if (space) {
        setScenes(prev => prev.map(scene =>
          scene.id === currentSceneId
            ? {
                ...scene,
                spaces: (scene.spaces || []).map(space =>
                  space.id === spaceId
                    ? { ...space, name: newName.trim() }
                    : space
                )
              }
            : scene
        ));
        
        // Update placedProducts with new space name
        setPlacedProducts(prev =>
          prev.map(product =>
            product.sceneId === currentSceneId && product.spaceName === space.name
              ? { ...product, spaceName: newName.trim() }
              : product
          )
        );
      }
    }
    setEditingSpaceId(null);
  }, [currentSceneId, getCurrentScene]);

  // Create new placement within selected space
  const createPlacement = useCallback(() => {
    if (newPlacementName.trim() && selectedSpaceId) {
      const newPlacement: Placement = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: newPlacementName.trim(),
        expanded: false,
        visible: true,
        products: []
      };
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? {
              ...scene,
              spaces: (scene.spaces || []).map(space =>
                space.id === selectedSpaceId
                  ? { ...space, placements: [...space.placements, newPlacement] }
                  : space
              )
            }
          : scene
      ));
      setNewPlacementName('');
      setShowCreatePlacement(false);
    }
  }, [newPlacementName, currentSceneId, selectedSpaceId]);

  // Toggle placement expansion within a space
  const togglePlacement = useCallback((placementId: string) => {
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            spaces: (scene.spaces || []).map(space =>
              space.id === selectedSpaceId
                ? {
                    ...space,
                    placements: space.placements.map(placement =>
                      placement.id === placementId
                        ? { ...placement, expanded: !placement.expanded }
                        : placement
                    )
                  }
                : space
            )
          }
        : scene
    ));
  }, [currentSceneId, selectedSpaceId]);

  // Rename placement
  const renamePlacement = useCallback((placementId: string, newName: string) => {
    if (newName.trim()) {
      const currentScene = getCurrentScene();
      const placement = currentScene?.placements?.find(f => f.id === placementId);
      const oldName = placement?.name;
      
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? {
              ...scene,
              placements: (scene.placements || []).map(placement =>
                placement.id === placementId
                  ? { ...placement, name: newName.trim() }
                  : placement
              )
            }
          : scene
      ));
      
      // Update placement name in placed images
      if (oldName) {
        setPlacedImages(prev =>
          prev.map(img => 
            img.placementName === oldName && img.sceneId === currentSceneId
              ? { ...img, placementName: newName.trim() }
              : img
          )
        );
      }
    }
    setEditingPlacementId(null);
  }, [getCurrentScene, currentSceneId]);

  // Rename image
  const renameImage = useCallback((placementId: string, imageId: string, newName: string) => {
    if (newName.trim()) {
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? {
              ...scene,
              placements: (scene.placements || []).map(placement =>
                placement.id === placementId
                  ? {
                      ...placement,
                      images: placement.images.map(img =>
                        img.id === imageId
                          ? { ...img, name: newName.trim() }
                          : img
                      )
                    }
                  : placement
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

  // Handle image dimensions loading for placed images
  const handlePlacedImageLoad = useCallback((imageId: string, dimensions: { width: number; height: number }) => {
    // Update the image dimensions in the scene's placement data only if they've changed
    setScenes(prev => {
      const currentScene = prev.find(scene => scene.id === currentSceneId);
      const needsUpdate = currentScene?.placements?.some(placement => 
        placement.images.some(image => 
          image.id === imageId && (image.width !== dimensions.width || image.height !== dimensions.height)
        )
      );

      if (!needsUpdate) return prev; // Return the same reference to prevent unnecessary re-renders

      return prev.map(scene => 
        scene.id === currentSceneId 
          ? {
              ...scene,
              placements: scene.placements.map(placement => ({
                ...placement,
                images: placement.images.map(image => 
                  image.id === imageId 
                    ? { ...image, width: dimensions.width, height: dimensions.height }
                    : image
                )
              }))
            }
          : scene
      );
    });

    // Also update the placed images with correct dimensions
    setPlacedImages(prev => {
      const needsUpdate = prev.some(img => 
        img.imageId === imageId && 
        img.sceneId === currentSceneId && 
        (img.width !== dimensions.width || img.height !== dimensions.height)
      );

      if (!needsUpdate) return prev; // Return the same reference to prevent unnecessary re-renders

      return prev.map(img => 
        img.imageId === imageId && img.sceneId === currentSceneId
          ? { ...img, width: dimensions.width, height: dimensions.height }
          : img
      );
    });
  }, [currentSceneId]);

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

  // Get position of existing placed image from same placement
  const getExistingImagePosition = useCallback((placementName: string, currentPlacedImages: PlacedImage[]) => {
    const existingImage = currentPlacedImages.find(img => img.placementName === placementName);
    return existingImage ? { x: existingImage.x, y: existingImage.y } : null;
  }, []);

  // Auto-place visible images that aren't placed yet
  useEffect(() => {
    const currentPlacements = getCurrentScenePlacements();
    
    currentPlacements.forEach(placement => {
      if (placement.visible) {
        placement.images.forEach(image => {
          if (image.visible) {
            // Use functional setState to get current placedImages value
            setPlacedImages(currentPlacedImages => {
              const alreadyPlaced = currentPlacedImages.some(img => img.imageId === image.id && img.sceneId === currentSceneId);
              if (!alreadyPlaced) {
                // Get position - either from existing placement image or viewport center
                const existingPosition = getExistingImagePosition(placement.name, currentPlacedImages);
                const position = existingPosition || getViewportCenter();
                
                const newPlacedImage: PlacedImage = {
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  imageId: image.id,
                  placementName: placement.name,
                  src: image.src,
                  x: position.x,
                  y: position.y,
                  width: image.width,
                  height: image.height,
                  name: image.name,
                  sceneId: currentSceneId,
                };
                return [...currentPlacedImages, newPlacedImage];
              }
              return currentPlacedImages;
            });
          }
        });
      }
    });
  }, [getCurrentScenePlacements, getExistingImagePosition, getViewportCenter, currentSceneId]);

  // Handle file upload to selected placement
  const handleFiles = useCallback(async (files: FileList) => {
    if (!selectedPlacement) {
      alert('Please select a placement first');
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
        formData.append('placementId', selectedPlacement);

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
          const currentPlacements = getCurrentScenePlacements();
          const placement = currentPlacements.find(f => f.id === selectedPlacement);
          const isFirstImage = placement ? placement.images.length === 0 : false;
          
          const newImage: PlacementProductImage = {
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
                  placements: (scene.placements || []).map(placement =>
                    placement.id === selectedPlacement
                      ? { ...placement, images: [...placement.images, newImage] }
                      : placement
                  )
                }
              : scene
          ));
          
          console.log('Image uploaded to S3:', newImage.name, 'URL:', newImage.src);
          
          // Remove from uploading state
          setUploadingImages(prev => prev.filter(id => id !== uploadId));
          setUploadProgress(prev => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uploadId]: removed, ...rest } = prev;
            return rest;
          });
        };
        
        img.onerror = () => {
          console.error('Failed to load uploaded image');
          setUploadingImages(prev => prev.filter(id => id !== uploadId));
          setUploadProgress(prev => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uploadId]: removed, ...rest } = prev;
          return rest;
        });
      }
    }
  }, [selectedPlacement, currentSceneId, getCurrentScenePlacements]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  // Toggle placement visibility
  const togglePlacementVisibility = useCallback((placementId: string) => {
    const currentPlacements = getCurrentScenePlacements();
    const placement = currentPlacements.find(f => f.id === placementId);
    const wasVisible = placement?.visible;
    
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            placements: scene.placements.map(placement =>
              placement.id === placementId
                ? { ...placement, visible: !placement.visible }
                : placement
            )
          }
        : scene
    ));

    // Remove all placed images from this placement when hiding
    if (placement && wasVisible) {
      setPlacedImages(prev => prev.filter(img => img.placementName !== placement.name || img.sceneId !== currentSceneId));
    }
  }, [getCurrentScenePlacements, currentSceneId]);

  // Toggle image visibility (ensure only one image per placement is visible)
  const toggleImageVisibility = useCallback((placementId: string, imageId: string) => {
    const currentPlacements = getCurrentScenePlacements();
    const placement = currentPlacements.find(f => f.id === placementId);
    const image = placement?.images.find(img => img.id === imageId);
    
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            placements: scene.placements.map(placement =>
              placement.id === placementId
                ? {
                    ...placement,
                    images: placement.images.map(img => ({
                      ...img,
                      visible: img.id === imageId ? !img.visible : false // Only one image visible at a time
                    }))
                  }
                : placement
            )
          }
        : scene
    ));

    // Remove placed images from this placement when hiding current image
    if (image && image.visible) {
      setPlacedImages(prev => prev.filter(img => img.placementName !== placement?.name || img.sceneId !== currentSceneId));
    }
  }, [getCurrentScenePlacements, currentSceneId]);

  // Delete placement
  const deletePlacement = useCallback((placementId: string) => {
    const currentPlacements = getCurrentScenePlacements();
    const placement = currentPlacements.find(f => f.id === placementId);
    if (placement && window.confirm(`Delete placement "${placement.name}" and all its images?`)) {
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? {
              ...scene,
              placements: scene.placements.filter(f => f.id !== placementId)
            }
          : scene
      ));
      
      // Remove placed images from this placement
      setPlacedImages(prev => prev.filter(img => img.placementName !== placement.name || img.sceneId !== currentSceneId));
    }
  }, [getCurrentScenePlacements, currentSceneId]);

  // Delete image from placement
  const deleteImageFromPlacement = useCallback(async (placementId: string, imageId: string) => {
    // Find the image to get its S3 key
    const currentPlacements = getCurrentScenePlacements();
    const placement = currentPlacements.find(f => f.id === placementId);
    const image = placement?.images.find(img => img.id === imageId);
    
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
            placements: (scene.placements || []).map(placement =>
              placement.id === placementId
                ? { ...placement, images: placement.images.filter(img => img.id !== imageId) }
                : placement
            )
          }
        : scene
    ));
    
    // Remove from canvas if placed
    setPlacedImages(prev => prev.filter(img => img.imageId !== imageId || img.sceneId !== currentSceneId));
  }, [currentSceneId, getCurrentScenePlacements]);

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

  // Handle asset selection from Asset Manager for scene background
  const handleSceneAssetSelect = useCallback((asset: { url: string; filename: string; key: string }) => {
    // Set the selected asset as the new scene background
    setNewSceneImage(asset.url);
    // Store the S3 key for potential deletion later
    setNewSceneImageS3Key(asset.key);
    // Close the scene asset manager
    // setShowSceneAssetManager(false);
  }, []);

  // Handle asset selection from Asset Manager for placement images
  const handleAssetSelect = useCallback((asset: { url: string; filename: string; key: string }) => {
    const currentPlacements = getCurrentScenePlacements();
    
    // If no placement is selected, show an alert
    if (!selectedPlacement) {
      alert('Please select a placement first before adding assets.');
      return;
    }
    
    // Find the selected placement
    const targetPlacement = currentPlacements.find(f => f.id === selectedPlacement);
    if (!targetPlacement) {
      alert('Selected placement not found. Please select a valid placement.');
      return;
    }
    
    // Add the asset as an image to the selected placement
    const imageId = `img-${Date.now()}`;
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            placements: (scene.placements || []).map(placement =>
              placement.id === selectedPlacement
                ? {
                    ...placement,
                    images: [
                      ...placement.images.map(image => ({ ...image, visible: false })), // Hide other images
                      {
                        id: imageId,
                        name: asset.filename,
                        src: asset.url,
                        s3Key: asset.key,
                        visible: true,
                        width: 100, // Default dimensions - will be updated when image loads
                        height: 100
                      }
                    ]
                  }
                : placement
            )
          }
        : scene
    ));
    
    // Close the asset manager
    // setShowAssetManager(false);
  }, [currentSceneId, getCurrentScenePlacements, selectedPlacement]);

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
    if (window.confirm('Clear all placements and placed images for this scene?')) {
      setScenes(prev => prev.map(scene =>
        scene.id === currentSceneId
          ? { ...scene, placements: [] }
          : scene
      ));
      setPlacedImages(prev => prev.filter(img => img.sceneId !== currentSceneId));
    }
  }, [currentSceneId]);

  // Create new scene
  const createScene = useCallback(async () => {
    if (newSceneName.trim() && newSceneImage) {
      try {
        // Use the existing asset S3 key if available, otherwise use the uploaded image S3 key
        const s3Key = newSceneImageS3Key || (window as any).tempSceneImageS3Key;
        
        const newScene: Scene = {
          id: Date.now().toString(),
          name: newSceneName.trim(),
          backgroundImage: newSceneImage,
          backgroundImageSize: { width: 1920, height: 1080 },
          placements: [],
          backgroundImageS3Key: s3Key
        };
        
        // Create scene via API
        const response = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newScene)
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setScenes(prev => [...prev, newScene]);
            setCurrentSceneId(newScene.id);
            setNewSceneName('');
            setNewSceneImage('');
            setNewSceneImageS3Key('');
            setShowCreateScene(false);
            setShowSceneMenu(false);
            
            // Clear the temporary S3 key
            delete (window as any).tempSceneImageS3Key;
          }
        } else {
          console.error('Failed to create scene');
          alert('Failed to create scene. Please try again.');
        }
      } catch (error) {
        console.error('Error creating scene:', error);
        alert('Error creating scene. Please try again.');
      }
    }
  }, [newSceneName, newSceneImage, newSceneImageS3Key]);

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
      try {
        // Delete scene via API (this will also handle S3 cleanup if needed)
        const response = await fetch(`/api/scenes/${sceneId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
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
        } else {
          console.error('Failed to delete scene');
          alert('Failed to delete scene. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting scene:', error);
        alert('Error deleting scene. Please try again.');
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
                      <div className="p-3 relative">
                        {/* Close Button */}
                        <button
                          onClick={() => setShowSceneMenu(false)}
                          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                          title="Close menu"
                        >
                          ✕
                        </button>
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
                          onClick={() => {
                            setShowCreateScene(true);
                            setShowSceneMenu(false);
                          }}
                          className="w-full text-left px-2 py-2 rounded text-sm hover:bg-green-50 text-green-600 font-medium flex items-center space-x-2"
                        >
                          <span>+</span>
                          <span>Create New Scene</span>
                        </button>

                        {/* Asset Manager Button */}
                        <button
                          onClick={() => {
                            // setShowAssetManager(true);
                            setShowSceneMenu(false);
                          }}
                          className="w-full text-left px-2 py-2 rounded text-sm hover:bg-blue-50 text-blue-600 font-medium flex items-center space-x-2"
                        >
                          <span>📁</span>
                          <span>Manage Assets</span>
                        </button>
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
          {/* Placements Section - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {!sidebarCollapsed ? (
              <>
                {/* Spaces Explorer */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Spaces</h3>
                    <button
                      onClick={() => setShowCreateSpace(true)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Create Space
                    </button>
                  </div>
                  
                  {/* Create Space Modal */}
                  {showCreateSpace && (
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newSpaceName}
                          onChange={(e) => setNewSpaceName(e.target.value)}
                          placeholder="Enter space name..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                          onKeyPress={(e) => e.key === 'Enter' && createSpace()}
                        />
                        <button
                          onClick={createSpace}
                          className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateSpace(false);
                            setNewSpaceName('');
                          }}
                          className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Spaces List */}
                  {getCurrentSceneSpaces().length === 0 ? (
                    <p className="text-gray-500 text-center py-8 text-sm">
                      No spaces created yet. Create a space to start organizing your catalogue.
                    </p>
                  ) : (
                    getCurrentSceneSpaces().map((space) => (
                      <div key={space.id} className={`border rounded-lg ${selectedSpaceId === space.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        {/* Space Header */}
                        <div 
                          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 ${
                            selectedSpaceId === space.id ? 'bg-blue-100' : ''
                          }`}
                          onClick={() => setSelectedSpaceId(selectedSpaceId === space.id ? '' : space.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              selectedSpaceId === space.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                            }`}>
                              SPACE
                            </span>
                            <span className="font-medium">{space.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-gray-400 hover:text-gray-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSpace(space.id);
                              }}
                            >
                              {space.expanded ? '▼' : '▶'}
                            </button>
                          </div>
                        </div>

                        {/* Selected Space: Show Placements Section */}
                        {selectedSpaceId === space.id && (
                          <div className="px-4 pb-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-gray-700">Placements</h4>
                              <button
                                onClick={() => setShowCreatePlacement(true)}
                                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                              >
                                Create Placement
                              </button>
                            </div>

                            {/* Create Placement Modal */}
                            {showCreatePlacement && (
                              <div className="border border-gray-300 rounded-lg p-3 bg-gray-50 mb-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={newPlacementName}
                                    onChange={(e) => setNewPlacementName(e.target.value)}
                                    placeholder="Enter placement name..."
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                    onKeyPress={(e) => e.key === 'Enter' && createPlacement()}
                                  />
                                  <button
                                    onClick={createPlacement}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  >
                                    Create
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowCreatePlacement(false);
                                      setNewPlacementName('');
                                    }}
                                    className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Placements List */}
                            {getSelectedSpacePlacements().length === 0 ? (
                              <p className="text-gray-400 text-center py-4 text-sm">
                                No placements in this space yet.
                              </p>
                            ) : (
                              getSelectedSpacePlacements().map((placement) => (
                                <div key={placement.id} className={`border rounded mb-2 ${selectedPlacementId === placement.id ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                  {/* Placement Header */}
                                  <div 
                                    className={`flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 ${
                                      selectedPlacementId === placement.id ? 'bg-green-100' : ''
                                    }`}
                                    onClick={() => setSelectedPlacementId(selectedPlacementId === placement.id ? '' : placement.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                                        selectedPlacementId === placement.id ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                                      }`}>
                                        PLACEMENT
                                      </span>
                                      <span className="text-sm font-medium">{placement.name}</span>
                                    </div>
                                  </div>

                                  {/* Selected Placement: Show Product Upload */}
                                  {selectedPlacementId === placement.id && (
                                    <div className="px-3 pb-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-sm font-medium text-gray-600">Products</h5>
                                        <button
                                          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                                          onClick={() => {
                                            // TODO: Implement product upload
                                            console.log('Upload product for placement:', placement.id);
                                          }}
                                        >
                                          Upload Product
                                        </button>
                                      </div>
                                      <p className="text-xs text-gray-500">
                                        {placement.products.length} products in this placement
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
                        >
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlacement(placement.id);
                              }}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              {placement.expanded ? '−' : '+'}
                            </button>
                            <span>📁</span>
                            {editingPlacementId === placement.id ? (
                              <input
                                type="text"
                                defaultValue={placement.name}
                                className="text-sm font-medium bg-white border border-gray-300 rounded px-2 py-1"
                                onBlur={(e) => renamePlacement(placement.id, e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    renamePlacement(placement.id, (e.target as HTMLInputElement).value);
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
                                  setEditingPlacementId(placement.id);
                                }}
                              >
                                {placement.name}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">({placement.images.length})</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlacementVisibility(placement.id);
                              }}
                              className={`px-2 py-1 text-xs rounded ${
                                placement.visible 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {placement.visible ? 'Hide' : 'Show'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePlacement(placement.id);
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Placement Contents */}
                        {placement.expanded && (
                          <div className="border-t border-gray-200 bg-gray-50">
                            {placement.images.length === 0 ? (
                              <p className="text-gray-500 text-center py-4 text-sm">
                                No images in this placement
                              </p>
                            ) : (
                              <div className="space-y-1 p-2">
                                {placement.images.map((image) => (
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
                                          onBlur={(e) => renameImage(placement.id, image.id, e.target.value)}
                                          onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                              renameImage(placement.id, image.id, (e.target as HTMLInputElement).value);
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
                                        onClick={() => toggleImageVisibility(placement.id, image.id)}
                                        className={`px-2 py-1 text-xs rounded ${
                                          image.visible 
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                      >
                                        {image.visible ? 'Hide' : 'Show'}
                                      </button>
                                      <button
                                        onClick={() => deleteImageFromPlacement(placement.id, image.id)}
                                        className="text-red-600 hover:text-red-800 text-xs"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* Upload Progress Indicators */}
                                {uploadingImages.length > 0 && selectedPlacement === placement.id && (
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
                {getCurrentSceneSpaces().map((space) => (
                  <div
                    key={space.id}
                    className={`p-3 rounded-lg cursor-pointer ${
                      selectedSpaceId === space.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedSpaceId(selectedSpaceId === space.id ? '' : space.id)}
                    title={space.name}
                  >
                    🏢
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fixed Footer Section with Create and Upload */}
          <div className="border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {!sidebarCollapsed ? (
              <div className="p-4 space-y-3">
                {/* Create Placement Section */}
                {!showCreatePlacement ? (
                  <button
                    onClick={() => setShowCreatePlacement(true)}
                    disabled={!currentSceneId}
                    className={`w-full py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                      currentSceneId 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={currentSceneId ? "Create New Placement" : "Please select a scene first"}
                  >
                    <span>📁</span>
                    <span>Create New Placement</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newPlacementName}
                      onChange={(e) => setNewPlacementName(e.target.value)}
                      placeholder="Placement name"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && currentSceneId && newPlacementName.trim() && createPlacement()}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={createPlacement}
                        disabled={!currentSceneId || !newPlacementName.trim()}
                        className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                          currentSceneId && newPlacementName.trim()
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowCreatePlacement(false);
                          setNewPlacementName('');
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
                {selectedPlacement ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-700">
                      <strong>Selected:</strong> {getCurrentScenePlacements().find(f => f.id === selectedPlacement)?.name}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <span>📤</span>
                      <span>Upload Image</span>
                    </button>
                    {/*<button*/}
                    {/*  onClick={() => setShowAssetManager(true)}*/}
                    {/*  className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"*/}
                    {/*>*/}
                    {/*  <span>🖼️</span>*/}
                    {/*  <span>Manage Assets</span>*/}
                    {/*</button>*/}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 text-sm py-3">
                    Select a placement to upload images
                  </div>
                )}
              </div>
            ) : (
              /* Collapsed view footer */
              <div className="p-3 space-y-3">
                <button
                  onClick={() => setShowCreatePlacement(true)}
                  className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors"
                  title="Create New Placement"
                >
                  📁
                </button>
                {selectedPlacement ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition-colors"
                    title="Upload Product"
                  >
                    📤
                  </button>
                ) : (
                  <div className="text-center text-gray-400 p-3" title="Select a placement first">
                    📤
                  </div>
                )}
                {/*<button*/}
                {/*  onClick={() => setShowAssetManager(true)}*/}
                {/*  className="w-full bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 transition-colors"*/}
                {/*  title="Manage Assets"*/}
                {/*>*/}
                {/*  🖼️*/}
                {/*</button>*/}
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
                Drag to pan the view • Place images from placements onto the scene
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={async () => {
                  const success = await saveScene();
                  if (success) {
                    alert('Scene saved successfully!');
                  } else {
                    alert('Failed to save scene. Please try again.');
                  }
                }}
                disabled={!currentSceneId}
                className={`transition-colors px-4 py-2 rounded text-sm font-medium ${
                  currentSceneId
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={currentSceneId ? "Save current scene" : "No scene to save"}
              >
                💾 Save Scene
              </button>
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
                
                {/* Placed Placements - only show current scene items that are visible */}
                {getCurrentSceneImages()
                  .filter(img => {
                    const currentPlacements = getCurrentScenePlacements();
                    const placement = currentPlacements.find(f => f.name === img.placementName);
                    const image = placement?.images.find(i => i.id === img.imageId);
                    return placement?.visible && image?.visible;
                  })
                  .map((img) => (
                    <KonvaImageComponent
                      key={img.id}
                      src={img.src}
                      x={img.x}
                      y={img.y}
                      draggable={true}
                      onDragEnd={(x, y) => handleImageDragEnd(img.id, x, y)}
                      onImageLoad={(dimensions) => handlePlacedImageLoad(img.imageId, dimensions)}
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

          {/* Placed Placements List Overlay - only show when there are scenes and images */}
          {scenes.length > 0 && getCurrentSceneImages().length > 0 && (
            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Placed Items ({getCurrentSceneImages().filter(img => {
                  const currentPlacements = getCurrentScenePlacements();
                  const placement = currentPlacements.find(f => f.name === img.placementName);
                  const image = placement?.images.find(i => i.id === img.imageId);
                  return placement?.visible && image?.visible;
                }).length}/{getCurrentSceneImages().length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {getCurrentSceneImages().map((img) => {
                  const currentPlacements = getCurrentScenePlacements();
                  const placement = currentPlacements.find(f => f.name === img.placementName);
                  const image = placement?.images.find(i => i.id === img.imageId);
                  const isVisible = placement?.visible && image?.visible;
                  
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

      {/* Create Scene Modal */}
      {showCreateScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Create New Scene</h2>
                <button
                  onClick={() => {
                    setShowCreateScene(false);
                    setNewSceneName('');
                    setNewSceneImage('');
                    setNewSceneImageS3Key('');
                    setShowSceneMenu(false);
                  }}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  title="Close modal"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Scene Name</label>
                  <input
                    type="text"
                    value={newSceneName}
                    onChange={(e) => setNewSceneName(e.target.value)}
                    placeholder="Enter scene name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Background Image</label>
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => sceneImageInputRef.current?.click()}
                        disabled={uploadingSceneImage}
                        className={`flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center space-x-2 ${
                          uploadingSceneImage ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span>📤</span>
                        <span>{uploadingSceneImage ? 'Uploading...' : 'Upload New'}</span>
                      </button>
                      {/*<button*/}
                      {/*  onClick={() => setShowSceneAssetManager(true)}*/}
                      {/*  disabled={uploadingSceneImage}*/}
                      {/*  className={`flex-1 px-3 py-2 text-sm border border-purple-300 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 flex items-center justify-center space-x-2 ${*/}
                      {/*    uploadingSceneImage ? 'opacity-50 cursor-not-allowed' : ''*/}
                      {/*  }`}*/}
                      {/*>*/}
                      {/*  <span>🖼️</span>*/}
                      {/*  <span>Use Existing</span>*/}
                      {/*</button>*/}
                    </div>
                    
                    {uploadingSceneImage && (
                      <div className="space-y-2">
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
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 rounded border border-gray-300 overflow-hidden">
                          <img 
                            src={newSceneImage} 
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-sm text-green-600 font-medium">✓ Image selected</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={createScene}
                    disabled={!newSceneName.trim() || !newSceneImage || uploadingSceneImage}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {uploadingSceneImage ? 'Uploading...' : 'Create Scene'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateScene(false);
                      setNewSceneName('');
                      setNewSceneImage('');
                      setNewSceneImageS3Key('');
                      setShowSceneMenu(false);
                    }}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Manager Modal */}
      {/*{showAssetManager && (*/}
      {/*  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">*/}
      {/*    <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] mx-4">*/}
      {/*      <AssetManager*/}
      {/*        onAssetSelect={handleAssetSelect}*/}
      {/*        onClose={() => setShowAssetManager(false)}*/}
      {/*        currentSceneId={currentSceneId}*/}
      {/*        selectedPlacementName={selectedPlacement ? getCurrentScenePlacements().find(f => f.id === selectedPlacement)?.name : undefined}*/}
      {/*      />*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*)}*/}

      {/* Scene Background Asset Manager Modal */}
      {/*{showSceneAssetManager && (*/}
      {/*  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">*/}
      {/*    <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] mx-4">*/}
      {/*      <AssetManager*/}
      {/*        onAssetSelect={handleSceneAssetSelect}*/}
      {/*        onClose={() => setShowSceneAssetManager(false)}*/}
      {/*        currentSceneId={currentSceneId}*/}
      {/*        selectedPlacementName="Scene Background (any image can be used)"*/}
      {/*        mode="select-background"*/}
      {/*      />*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*)}*/}
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