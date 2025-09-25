'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';

// New hierarchy interfaces
interface Product {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
  visible: boolean;
  s3Key?: string;
  x?: number;
  y?: number;
}

interface Placement {
  id: string;
  name: string;
  expanded: boolean;
  visible: boolean;
  products: Product[];
  activeProductId?: string; // Only one product can be active at a time
}

interface Space {
  id: string;
  name: string;
  expanded: boolean;
  visible: boolean;
  placements: Placement[];
}

interface Scene {
  id: string;
  name: string;
  backgroundImage: string;
  backgroundImageSize: { width: number; height: number };
  spaces: Space[];
  backgroundImageS3Key?: string;
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
  sceneId: string;
  visible: boolean;
}

// Konva Image Component for Products
interface ProductImageProps {
  product: PlacedProduct;
  onDragEnd: (product: PlacedProduct, x: number, y: number) => void;
}

const ProductImage: React.FC<ProductImageProps> = ({ product, onDragEnd }) => {
  const [image] = useImage(product.src);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd(product, e.target.x(), e.target.y());
  };

  if (!image) return null;

  return (
    <KonvaImage
      image={image}
      x={product.x}
      y={product.y}
      width={product.width}
      height={product.height}
      draggable
      onDragEnd={handleDragEnd}
      shadowColor="black"
      shadowBlur={10}
      shadowOpacity={0.6}
      shadowOffsetX={5}
      shadowOffsetY={5}
    />
  );
};

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

function DesignStudioContent() {
  const searchParams = useSearchParams();
  const sceneIdParam = searchParams.get('sceneId');
  
  // State for new hierarchy
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>('');
  const [placedProducts, setPlacedProducts] = useState<PlacedProduct[]>([]);
  
  // UI state
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
  const [uploadingSceneImage, setUploadingSceneImage] = useState(false);
  const [sceneImageUploadProgress, setSceneImageUploadProgress] = useState(0);
  
  // Product upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [uploadingProducts, setUploadingProducts] = useState<string[]>([]);
  
  // Canvas state
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [backgroundImageSize, setBackgroundImageSize] = useState({ width: 1920, height: 1080 });
  
  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Helper functions
  const getCurrentScene = useCallback(() => {
    return scenes.find(scene => scene.id === currentSceneId);
  }, [scenes, currentSceneId]);

  const getCurrentSceneSpaces = useCallback(() => {
    const currentScene = getCurrentScene();
    return currentScene?.spaces || [];
  }, [getCurrentScene]);

  const getSelectedSpace = useCallback(() => {
    const spaces = getCurrentSceneSpaces();
    return spaces.find(space => space.id === selectedSpaceId);
  }, [getCurrentSceneSpaces, selectedSpaceId]);

  const getSelectedSpacePlacements = useCallback(() => {
    const selectedSpace = getSelectedSpace();
    return selectedSpace?.placements || [];
  }, [getSelectedSpace]);

  const getSelectedPlacement = useCallback(() => {
    const placements = getSelectedSpacePlacements();
    return placements.find(placement => placement.id === selectedPlacementId);
  }, [getSelectedSpacePlacements, selectedPlacementId]);

  // Space management functions
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

  // Placement management functions
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

  // Calculate placement position for new products
  const calculateNewProductPosition = (placement: Placement, backgroundImageSize: { width: number; height: number }) => {
    const existingProducts = placement.products;
    
    if (existingProducts.length === 0) {
      // No existing products - place at center
      return {
        x: backgroundImageSize.width / 2,
        y: backgroundImageSize.height / 2
      };
    }
    
    // Use the position of the last product
    const lastProduct = existingProducts[existingProducts.length - 1];
    return {
      x: lastProduct.x || backgroundImageSize.width / 2,
      y: lastProduct.y || backgroundImageSize.height / 2
    };
  };

  // Product upload functions
  const handleFileInput = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!selectedSpaceId || !selectedPlacementId || !currentSceneId) {
      alert('Please select a space and placement first');
      return;
    }

    const selectedSpace = getSelectedSpace();
    const selectedPlacement = getSelectedPlacement();
    
    if (!selectedSpace || !selectedPlacement) {
      alert('Selected space or placement not found');
      return;
    }

    setIsUploading(true);
    const fileArray = Array.from(files);
    
    try {
      for (const file of fileArray) {
        const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        setUploadingProducts(prev => [...prev, fileId]);
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

        // Create FormData for upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sceneId', currentSceneId);
        formData.append('placementId', selectedPlacementId);

        // Upload to S3 via API
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Load image to get actual dimensions
            const img = new Image();
            img.onload = () => {
              // Get current scene for background size
              const currentScene = scenes.find(scene => scene.id === currentSceneId);
              const backgroundSize = currentScene?.backgroundImageSize || { width: 1000, height: 800 };
              
              // Calculate position for the new product
              const position = calculateNewProductPosition(selectedPlacement, backgroundSize);
              
              // Create new product with actual image dimensions
              const newProduct: Product = {
                id: fileId,
                src: result.data.url,
                name: file.name,
                width: img.naturalWidth,
                height: img.naturalHeight,
                visible: true,
                s3Key: result.data.key,
                x: position.x,
                y: position.y
              };

              // Add product to the selected placement
              setScenes(prev => prev.map(scene =>
                scene.id === currentSceneId
                  ? {
                      ...scene,
                      spaces: scene.spaces.map(space =>
                        space.id === selectedSpaceId
                          ? {
                              ...space,
                              placements: space.placements.map(placement =>
                                placement.id === selectedPlacementId
                                  ? { 
                                      ...placement, 
                                      products: [...placement.products, newProduct],
                                      activeProductId: placement.products.length === 0 ? newProduct.id : placement.activeProductId
                                    }
                                  : placement
                              )
                            }
                          : space
                      )
                    }
                  : scene
              ));

              // Create placed product for canvas rendering
              const placedProduct: PlacedProduct = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                productId: newProduct.id,
                placementName: selectedPlacement.name,
                spaceName: selectedSpace.name,
                src: newProduct.src,
                x: newProduct.x || 100,
                y: newProduct.y || 100,
                width: newProduct.width,
                height: newProduct.height,
                name: newProduct.name,
                sceneId: currentSceneId,
                visible: newProduct.visible
              };

              setPlacedProducts(prev => [...prev, placedProduct]);
              setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
            };
            img.onerror = () => {
              console.error('Failed to load image for dimensions');
              // Get current scene for background size
              const currentScene = scenes.find(scene => scene.id === currentSceneId);
              const backgroundSize = currentScene?.backgroundImageSize || { width: 1000, height: 800 };
              
              // Calculate position for the new product
              const position = calculateNewProductPosition(selectedPlacement, backgroundSize);
              
              // Fallback to default dimensions if image loading fails
              const newProduct: Product = {
                id: fileId,
                src: result.data.url,
                name: file.name,
                width: 100,
                height: 100,
                visible: true,
                s3Key: result.data.key,
                x: position.x,
                y: position.y
              };
              // ... rest of the fallback logic would be same as above
            };
            img.src = result.data.url;
          } else {
            console.error('Upload failed:', result.error);
            alert(`Upload failed for ${file.name}: ${result.error}`);
          }
        } else {
          console.error('Upload request failed');
          alert(`Upload failed for ${file.name}: Server error`);
        }

        setUploadingProducts(prev => prev.filter(id => id !== fileId));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress({});
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [selectedSpaceId, selectedPlacementId, currentSceneId, getSelectedSpace, getSelectedPlacement]);

  const triggerProductUpload = useCallback(() => {
    if (!selectedSpaceId || !selectedPlacementId) {
      alert('Please select a space and placement first');
      return;
    }
    fileInputRef.current?.click();
  }, [selectedSpaceId, selectedPlacementId]);

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

  // Handle product position updates from drag
  const handleProductDragEnd = useCallback((product: PlacedProduct, x: number, y: number) => {
    // Update placed products state
    setPlacedProducts(prev => 
      prev.map(p => 
        p.id === product.id 
          ? { ...p, x, y }
          : p
      )
    );

    // Update product in scenes state
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            spaces: scene.spaces.map(space => ({
              ...space,
              placements: space.placements.map(placement => ({
                ...placement,
                products: placement.products.map(p =>
                  p.id === product.productId
                    ? { ...p, x, y }
                    : p
                )
              }))
            }))
          }
        : scene
    ));
  }, [currentSceneId]);

  // Create new scene
  const createScene = useCallback(async () => {
    if (!newSceneName.trim()) return;
    
    try {
      const newScene: Scene = {
        id: Date.now().toString(),
        name: newSceneName.trim(),
        backgroundImage: newSceneImage,
        backgroundImageS3Key: newSceneImageS3Key,
        backgroundImageSize: { width: 1200, height: 800 }, // Default size, will be updated when image loads
        spaces: []
      };
      
      // Add scene to state
      const newScenes = [...scenes, newScene];
      setScenes(newScenes);
      setCurrentSceneId(newScene.id);
      
      // Save scene to file system
      await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newScene),
      });
      
      // Reset modal state
      setShowCreateScene(false);
      setNewSceneName('');
      setNewSceneImage('');
      setNewSceneImageS3Key('');
      setSceneImageUploadProgress(0);
    } catch (error) {
      console.error('Error creating scene:', error);
    }
  }, [newSceneName, newSceneImage, newSceneImageS3Key, scenes]);

  // Handle scene image upload
  const handleSceneImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    const maxSizeInMB = 10;
    if (file.size > maxSizeInMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeInMB}MB`);
      return;
    }

    setUploadingSceneImage(true);
    setSceneImageUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Generate a temporary scene ID for the upload path
      const tempSceneId = `temp-scene-${Date.now()}`;
      formData.append('sceneId', tempSceneId);

      // Upload to S3
      const response = await fetch('/api/upload-scene-background', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setNewSceneImage(data.data.url);
        setNewSceneImageS3Key(data.data.key);
        setSceneImageUploadProgress(100);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Scene image upload failed:', errorData);
        throw new Error(`Upload failed: ${errorData.error || 'Server error'}`);
      }
    } catch (error) {
      console.error('Scene image upload failed:', error);
      alert(`Failed to upload scene image: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setUploadingSceneImage(false);
    }
  }, []);

  // Set active product for placement (only one active at a time)
  const setActiveProduct = useCallback((spaceId: string, placementId: string, productId: string) => {
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            spaces: scene.spaces.map(space =>
              space.id === spaceId
                ? {
                    ...space,
                    placements: space.placements.map(placement =>
                      placement.id === placementId
                        ? { ...placement, activeProductId: productId }
                        : placement
                    )
                  }
                : space
            )
          }
        : scene
    ));
  }, [currentSceneId]);

  // Remove product
  const removeProduct = useCallback((spaceId: string, placementId: string, productId: string) => {
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            spaces: scene.spaces.map(space =>
              space.id === spaceId
                ? {
                    ...space,
                    placements: space.placements.map(placement =>
                      placement.id === placementId
                        ? {
                            ...placement,
                            products: placement.products.filter(product => product.id !== productId),
                            activeProductId: placement.activeProductId === productId ? 
                              placement.products.find(p => p.id !== productId)?.id : 
                              placement.activeProductId
                          }
                        : placement
                    )
                  }
                : space
            )
          }
        : scene
    ));

    // Remove from placed products
    setPlacedProducts(prev => prev.filter(placedProduct => 
      !(placedProduct.productId === productId && placedProduct.sceneId === currentSceneId)
    ));
  }, [currentSceneId]);

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

  // Get current scene placed products for canvas
  const getCurrentPlacedProducts = useCallback(() => {
    const currentScene = scenes.find(scene => scene.id === currentSceneId);
    if (!currentScene) return [];

    const activeProducts: PlacedProduct[] = [];
    
    currentScene.spaces?.forEach(space => {
      space.placements?.forEach(placement => {
        if (placement.activeProductId) {
          const activeProduct = placement.products.find(p => p.id === placement.activeProductId);
          if (activeProduct && activeProduct.x !== undefined && activeProduct.y !== undefined) {
            const placedProduct = placedProducts.find(pp => pp.productId === activeProduct.id);
            if (placedProduct) {
              activeProducts.push(placedProduct);
            }
          }
        }
      });
    });

    return activeProducts;
  }, [placedProducts, currentSceneId, scenes]);

  // Initialize with demo data
  useEffect(() => {
    const initializeScenes = async () => {
      try {
        // Load scenes from the new JSON structure
        const response = await fetch('/api/scenes');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.length > 0) {
            const loadedScenes = result.data;            
            setScenes(loadedScenes);
            
            // Extract placed products from scene data
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
                        visible: product.visible,
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
          } else {
            // Fallback to demo data if no scenes found
            createDemoData();
          }
        } else {
          // Fallback to demo data if API fails
          createDemoData();
        }
      } catch (error) {
        console.error('Failed to load scenes:', error);
        // Fallback to demo data on error
        createDemoData();
      }
    };

    const createDemoData = () => {
      const demoScene: Scene = {
        id: 'demo-scene-1',
        name: 'Living Room Demo',
        backgroundImage: '/living-room.jpg', // Use local image
        backgroundImageSize: { width: 1920, height: 1080 },
        spaces: [
          {
            id: 'space-1',
            name: 'Furniture Area',
            expanded: false,
            visible: true,
            placements: [
              {
                id: 'placement-1',
                name: 'Sofa Placement',
                expanded: false,
                visible: true,
                products: [],
                activeProductId: undefined
              }
            ]
          }
        ]
      };
      
      setScenes([demoScene]);
      setCurrentSceneId(demoScene.id);
    };

    initializeScenes();
  }, [sceneIdParam]);

  const currentScene = getCurrentScene();

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Fixed Collapsible Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-lg z-10 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-96'
      }`}>
        {/* Scene Management Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3 flex-1">
            {!sidebarCollapsed && (
              <>                
                <div className="flex-1 min-w-0">
                  {currentScene ? (
                    <div className="flex items-center space-x-2">
                      <select 
                        value={currentSceneId}
                        onChange={(e) => setCurrentSceneId(e.target.value)}
                        className="flex-1 p-2 text-sm border border-gray-200 rounded-md bg-white min-w-0"
                      >
                        {scenes.map(scene => (
                          <option key={scene.id} value={scene.id}>
                            {scene.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (confirm('Delete this scene?')) {
                            const updatedScenes = scenes.filter(s => s.id !== currentSceneId);
                            setScenes(updatedScenes);
                            if (updatedScenes.length > 0) {
                              setCurrentSceneId(updatedScenes[0].id);
                            }
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                        title="Delete scene"
                      >
                        🗑
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">No scenes</span>
                  )}
                </div>
                <button
                  onClick={() => setShowCreateScene(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 whitespace-nowrap"
                  title="Create new scene"
                >
                  + Scene
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 ml-2"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex flex-col" style={{ height: 'calc(100% - 80px)' }}>
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
                                          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:bg-gray-400"
                                          disabled={isUploading}
                                          onClick={triggerProductUpload}
                                        >
                                          {isUploading ? 'Uploading...' : 'Upload Product'}
                                        </button>
                                      </div>
                                      
                                      {/* Show uploading progress */}
                                      {uploadingProducts.length > 0 && (
                                        <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                                          Uploading {uploadingProducts.length} product(s)...
                                        </div>
                                      )}
                                      
                                      {/* Products list */}
                                      {placement.products.length > 0 ? (
                                        <div className="space-y-2 mb-3">
                                          {placement.products.map((product) => {
                                            const isActive = placement.activeProductId === product.id;
                                            return (
                                              <div 
                                                key={product.id} 
                                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                                  isActive 
                                                    ? 'bg-blue-100 border-2 border-blue-500' 
                                                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                                }`}
                                                onClick={() => setActiveProduct(space.id, placement.id, product.id)}
                                              >
                                                <img 
                                                  src={product.src} 
                                                  alt={product.name}
                                                  className="w-8 h-8 object-cover rounded"
                                                  onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/placeholder-image.png';
                                                  }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-medium text-gray-700 truncate">{product.name}</p>
                                                  <p className="text-xs text-gray-500">
                                                    {product.width}x{product.height} • {isActive ? 'Active' : 'Inactive'}
                                                  </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  {isActive && (
                                                    <span className="text-blue-600 text-xs px-2 py-1 bg-blue-200 rounded">
                                                      Active
                                                    </span>
                                                  )}
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      removeProduct(space.id, placement.id, product.id);
                                                    }}
                                                    className="text-red-600 hover:text-red-800 text-xs p-1 rounded hover:bg-red-50"
                                                    title="Remove product"
                                                  >
                                                    ❌
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-gray-400 mb-3">No products uploaded yet</p>
                                      )}
                                      
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
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'ml-20' : 'ml-96'
      }`}>
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">            
            <div className="flex items-center space-x-4">
              <Link 
                href={`/?scene=${encodeURIComponent(getCurrentScene()?.name || '')}&sceneId=${currentSceneId}`}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                ← Mobile View
              </Link>
              <div className="text-sm text-gray-500">
                Placed: {getCurrentPlacedProducts().length} items
              </div>
            </div>
          </div>
        </div>

        <div 
          className="flex-1 bg-gray-100 overflow-hidden relative" 
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
                  {currentScene?.backgroundImage ? (
                    <KonvaImageComponent
                      src={currentScene.backgroundImage}
                      x={0}
                      y={0}
                      draggable={false}
                      onImageLoad={handleBackgroundImageLoad}
                    />
                  ) : (
                    /* Empty background placeholder */
                    <></>
                  )}
                  
                  {/* Product Images */}
                  {getCurrentPlacedProducts().map((product) => (
                    <ProductImage
                      key={product.id}
                      product={product}
                      onDragEnd={handleProductDragEnd}
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
        </div>
      </div>

      {/* Hidden file input for product uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Create Scene Modal */}
      {showCreateScene && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Scene</h2>
            
            <div className="space-y-4">
              {/* Scene Name Input */}
              <div>
                <label htmlFor="sceneName" className="block text-sm font-medium text-gray-700 mb-1">
                  Scene Name
                </label>
                <input
                  id="sceneName"
                  type="text"
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  placeholder="Enter scene name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Scene Background Image Upload */}
              <div>
                <label htmlFor="sceneImage" className="block text-sm font-medium text-gray-700 mb-1">
                  Background Image
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => document.getElementById('sceneImageUpload')?.click()}
                    disabled={uploadingSceneImage}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 text-sm"
                  >
                    {uploadingSceneImage ? 'Uploading...' : 'Choose Image'}
                  </button>
                  {uploadingSceneImage && (
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${sceneImageUploadProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 mt-1">{sceneImageUploadProgress}%</span>
                    </div>
                  )}
                </div>
                
                {/* Scene Image Preview */}
                {newSceneImage && (
                  <div className="mt-3">
                    <img
                      src={newSceneImage}
                      alt="Scene preview"
                      className="w-full h-32 object-cover rounded-md border border-gray-300"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateScene(false);
                  setNewSceneName('');
                  setNewSceneImage('');
                  setNewSceneImageS3Key('');
                  setSceneImageUploadProgress(0);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={createScene}
                disabled={!newSceneName.trim() || uploadingSceneImage}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Scene
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for scene image upload */}
      <input
        id="sceneImageUpload"
        type="file"
        accept="image/*"
        onChange={handleSceneImageUpload}
        className="hidden"
      />
    </div>
  );
}

export default function DesignStudio() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DesignStudioContent />
    </Suspense>
  );
}