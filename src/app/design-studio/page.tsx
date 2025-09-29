'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';
import { ThemeType, Theme, ThemeTypeValue, DBTheme, SceneType, Scene, Space, Placement, Product, Scene as BaseScene } from '@/types';
import SettingsDropdown from '@/components/SettingsDropdown';
import ThemeManagementModal from '@/components/ThemeManagementModal';
import CreateSceneModal from '@/components/CreateSceneModal';
import CreateSpaceModal from '@/components/CreateSpaceModal';
import AddProductImageModal from '@/components/AddProductImageModal';
import SceneManagementHeader from '@/components/SceneManagementHeader';
import { generateS3Url } from '@/lib/s3-utils';

// New hierarchy interfaces - using global types
// All Scene, Space, Placement, Product interfaces are now imported from types/index.ts

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
      shadowOpacity={0.6}
      shadowOffsetX={5}
      shadowOffsetY={5}
    />
  );
};

// Konva Image Component for Placement Images
interface PlacementImageComponentProps {
  placementImage: {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
    placementImageId: number;
    placementId: string;
    spaceId: string;
    name: string;
  };
  selectedPlacementId: string;
  onDragEnd: (placementImage: any, x: number, y: number) => void;
}

const PlacementImageComponent: React.FC<PlacementImageComponentProps> = ({ placementImage, selectedPlacementId, onDragEnd }) => {
  const [image] = useImage(placementImage.src);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd(placementImage, e.target.x(), e.target.y());
  };

  if (!image || !placementImage.visible) return null;

  // Only allow dragging if this placement image belongs to the currently selected placement
  const isDraggable = Boolean(selectedPlacementId && placementImage.placementId === selectedPlacementId);

  return (
    <KonvaImage
      image={image}
      x={placementImage.x}
      y={placementImage.y}
      width={placementImage.width}
      height={placementImage.height}
      draggable={isDraggable}
      onDragEnd={handleDragEnd}
      // opacity={isDraggable ? 1 : 0.7} // Make non-draggable images slightly transparent
      listening={isDraggable} // Only listen to events for draggable images
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
  const lastFetchedSceneRef = useRef<string>(''); // Track last scene that had spaces fetched
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const lastFetchedSpaceRef = useRef<string>(''); // Track last space that had placements fetched
  const lastFetchedPlacementRef = useRef<string>(''); // Track last placement that had images fetched
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>('');
  const [placedProducts, setPlacedProducts] = useState<PlacedProduct[]>([]);
  const [refreshScenes, setRefreshScenes] = useState<(() => Promise<void>) | null>(null);
  const [pendingSceneName, setPendingSceneName] = useState<string | null>(null); // Track newly created scene
  const [loadingSpaces, setLoadingSpaces] = useState<boolean>(false); // Loading state for spaces
  
  // UI state
  const [newPlacementName, setNewPlacementName] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showCreatePlacement, setShowCreatePlacement] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSceneMenu, setShowSceneMenu] = useState(false);
  const [showCreateScene, setShowCreateScene] = useState(false);
  const [showAddProductImage, setShowAddProductImage] = useState(false);
  const [showEditProductImage, setShowEditProductImage] = useState(false);
  const [editingPlacementImage, setEditingPlacementImage] = useState<{
    id: number;
    name: string;
    image: string;
    product_id?: number | null;
  } | null>(null);
  const [productImageForm, setProductImageForm] = useState({ name: '', image: '' });
  
  // Product upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [uploadingProducts, setUploadingProducts] = useState<string[]>([]);
  
  // Canvas state
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [backgroundImageSize, setBackgroundImageSize] = useState({ width: 1920, height: 1080 });
  
  // Settings and theme management state
  const [showThemeManagement, setShowThemeManagement] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);

  // Load themes from API
  const loadThemes = useCallback(async () => {
    try {
      const response = await fetch('/api/themes');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setThemes(result.data);
        } else {
          console.error('Failed to load themes:', result.error);
        }
      } else {
        console.error('Failed to load themes: HTTP', response.status);
      }
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  }, []);

  // Create theme via API
  const handleCreateTheme = useCallback(async (name: string, themeType: ThemeTypeValue | null, image?: string) => {
    try {
      const response = await fetch('/api/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          theme_type: themeType,
          image: image || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refresh themes list
          await loadThemes();
        } else {
          alert(`Failed to create theme: ${result.error}`);
        }
      } else {
        const result = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to create theme: ${result.error || 'Server error'}`);
      }
    } catch (error) {
      console.error('Error creating theme:', error);
      alert('Failed to create theme. Please try again.');
    }
  }, [loadThemes]);

  // Delete theme via API
  const handleDeleteTheme = useCallback(async (id: number) => {
    if (!confirm('Are you sure you want to delete this theme?')) {
      return;
    }

    try {
      const response = await fetch(`/api/themes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refresh themes list
          await loadThemes();
        } else {
          alert(`Failed to delete theme: ${result.error}`);
        }
      } else {
        const result = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to delete theme: ${result.error || 'Server error'}`);
      }
    } catch (error) {
      console.error('Error deleting theme:', error);
      alert('Failed to delete theme. Please try again.');
    }
  }, [loadThemes]);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Helper functions
  const getCurrentScene = useCallback(() => {
    return scenes.find(scene => scene.id === currentSceneId || scene.dbId === currentSceneId);
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

  // Fetch spaces for the current scene from database
  const fetchSpacesForScene = useCallback(async (sceneDbId: string) => {
    setLoadingSpaces(true);
    try {
      const response = await fetch(`/api/spaces?scene_id=${sceneDbId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Convert database spaces to frontend format
        const dbSpaces = data.data.map((dbSpace: any) => ({
          id: dbSpace.id.toString(),
          name: dbSpace.name,
          placements: [], // Placements will be loaded separately if needed
          expanded: false,
          visible: true,
          image: dbSpace.image,
          dbId: dbSpace.id.toString()
        }));
        
        // Update the current scene with the fetched spaces
        setScenes(prevScenes => prevScenes.map(scene => 
          scene.dbId === sceneDbId 
            ? { ...scene, spaces: dbSpaces }
            : scene
        ));
      }
    } catch (error) {
      console.error('Error fetching spaces for scene:', error);
    } finally {
      setLoadingSpaces(false);
    }
  }, []);

  // Fetch all space data (placements and placement images) using bulk API
  const fetchCompleteSpaceData = useCallback(async (spaceDbId: string) => {
    try {
      const response = await fetch(`/api/spaces/${spaceDbId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const spaceData = data.data;
        
        // Convert the space data format to match the design studio format
        const convertedPlacements = await Promise.all(
          spaceData.placements.map(async (placement: any) => {
            // Convert placement images with actual dimensions
            const placementImages = await Promise.all(
              placement.products.map(async (product: any) => {
                return new Promise<any>((resolve) => {
                  const img = new Image();
                  img.onload = () => {
                    resolve({
                      id: typeof product.id === 'string' ? parseInt(product.id) : product.id,
                      name: product.name,
                      image: product.src,
                      x: product.x || 0,
                      y: product.y || 0,
                      width: img.naturalWidth > 0 ? img.naturalWidth : 100,
                      height: img.naturalHeight > 0 ? img.naturalHeight : 100,
                      visible: true,
                      product_id: product.productInfo?.product_id || null,
                      productInfo: product.productInfo || null // Include the complete product info
                    });
                  };
                  img.onerror = () => {
                    resolve({
                      id: typeof product.id === 'string' ? parseInt(product.id) : product.id,
                      name: product.name,
                      image: product.src,
                      x: product.x || 0,
                      y: product.y || 0,
                      width: product.width || 100,
                      height: product.height || 100,
                      visible: true,
                      product_id: product.productInfo?.product_id || null,
                      productInfo: product.productInfo || null // Include the complete product info
                    });
                  };
                  img.src = product.src;
                });
              })
            );

            // Find the active image (visible one)
            const visibleProduct = placement.products.find((p: any) => p.visible) || placement.products[0];
            const activeProductImageId = visibleProduct 
              ? (typeof visibleProduct.id === 'string' ? parseInt(visibleProduct.id) : visibleProduct.id)
              : null;

            return {
              id: placement.id.toString(),
              name: placement.name,
              products: [], // Keep for compatibility
              placementImages,
              activeProductImageId,
              dbId: placement.id.toString()
            };
          })
        );
        
        // Update the current space with the complete fetched data
        setScenes(prevScenes => prevScenes.map(scene => ({
          ...scene,
          spaces: scene.spaces.map(space => 
            space.dbId === spaceDbId 
              ? { ...space, placements: convertedPlacements }
              : space
          )
        })));
      }
    } catch (error) {
      console.error('Error fetching complete space data:', error);
    }
  }, []);

  // Legacy function for backward compatibility (now uses bulk API)
  const fetchPlacementsForSpace = useCallback(async (spaceDbId: string) => {
    // Use the bulk API instead of individual calls
    await fetchCompleteSpaceData(spaceDbId);
  }, [fetchCompleteSpaceData]);

  // Legacy function for backward compatibility (now uses bulk API)
  const fetchPlacementImages = useCallback(async (placementDbId: string) => {
    // Find the space that contains this placement and refresh the entire space
    setScenes(prevScenes => {
      for (const scene of prevScenes) {
        for (const space of scene.spaces) {
          const placement = space.placements.find(p => p.dbId === placementDbId);
          if (placement && space.dbId) {
            // Refresh the entire space data
            fetchCompleteSpaceData(space.dbId);
            break;
          }
        }
      }
      return prevScenes;
    });
  }, [fetchCompleteSpaceData]);

  // Space management functions
  const handleSpaceCreated = useCallback((newSpace: Space) => {
    // Close the modal
    setShowCreateSpace(false);
    
    // Refresh spaces from database to get the newly created space
    const currentScene = getCurrentScene();
    if (currentScene && currentScene.dbId) {
      fetchSpacesForScene(currentScene.dbId);
    }
  }, [getCurrentScene, fetchSpacesForScene]);

  // Placement management functions
  const createPlacement = useCallback(async () => {
    if (newPlacementName.trim() && selectedSpaceId) {
      try {
        // Find the selected space to get its database ID
        const selectedSpace = getSelectedSpace();
        if (!selectedSpace || !selectedSpace.dbId) {
          alert('Please select a valid space first');
          return;
        }

        // Create placement in database
        const response = await fetch('/api/placements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            space_id: parseInt(selectedSpace.dbId),
            name: newPlacementName.trim()
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          // Clear the form
          setNewPlacementName('');
          setShowCreatePlacement(false);
          
          // Refresh placements from database
          fetchPlacementsForSpace(selectedSpace.dbId);
        } else {
          alert(`Failed to create placement: ${data.error}`);
        }
      } catch (error) {
        console.error('Error creating placement:', error);
        alert('Failed to create placement. Please try again.');
      }
    }
  }, [newPlacementName, selectedSpaceId, getSelectedSpace, fetchPlacementsForSpace]);

  // Update placement image position in database
  const updatePlacementImagePosition = useCallback(async (placementImageId: number, x: number, y: number) => {
    try {
      const response = await fetch(`/api/placement-images/${placementImageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          position: { x, y }
        }),
      });

      const result = await response.json();
      if (!result.success) {
        console.error('Failed to update placement image position:', result.error);
      }
    } catch (error) {
      console.error('Error updating placement image position:', error);
    }
  }, []);

  // Handle when a product image is created from the modal
  const handleProductImageCreated = useCallback((productImage: { id: number; name: string; image: string }) => {
    const selectedPlacement = getSelectedPlacement();
    const selectedSpace = getSelectedSpace();
    
    // Add the new product image to the current placement's placementImages array
    if (selectedPlacement) {
      // Calculate default position for the new image
      const position = calculateNewProductImagePosition(selectedPlacement, backgroundImageSize);
      
      // Load image to get actual dimensions
      const img = new Image();
      img.onload = () => {
        const newPlacementImage = {
          ...productImage,
          x: position.x,
          y: position.y,
          width: img.naturalWidth, // Use original width
          height: img.naturalHeight, // Use original height
          visible: true
        };
        
        const updatedPlacement = {
          ...selectedPlacement,
          placementImages: [...(selectedPlacement.placementImages || []), newPlacementImage],
          activeProductImageId: productImage.id // Set the new image as active
        };
        
        // Update the placement in the scene
        setScenes(prevScenes => prevScenes.map(scene => {
          if (scene.id === currentSceneId) {
            return {
              ...scene,
              spaces: scene.spaces.map(space => {
                if (space.id === selectedSpace?.id) {
                  return {
                    ...space,
                    placements: space.placements.map(placement => 
                      placement.dbId === selectedPlacement.dbId ? updatedPlacement : placement
                    )
                  };
                }
                return space;
              })
            };
          }
          return scene;
        }));

        // Save position to database
        updatePlacementImagePosition(productImage.id, position.x, position.y);
        
        // Set the new image as active in database
        if (selectedSpace && selectedPlacement) {
          setActivePlacementImage(selectedSpace.id, selectedPlacement.id, productImage.id);
        }
      };
      
      img.onerror = () => {
        // Fallback to default dimensions if image fails to load
        const newPlacementImage = {
          ...productImage,
          x: position.x,
          y: position.y,
          width: 100, // Default size
          height: 100, // Default size
          visible: true
        };
        
        const updatedPlacement = {
          ...selectedPlacement,
          placementImages: [...(selectedPlacement.placementImages || []), newPlacementImage],
          activeProductImageId: productImage.id // Set the new image as active
        };
        
        // Update the placement in the scene
        setScenes(prevScenes => prevScenes.map(scene => {
          if (scene.id === currentSceneId) {
            return {
              ...scene,
              spaces: scene.spaces.map(space => {
                if (space.id === selectedSpace?.id) {
                  return {
                    ...space,
                    placements: space.placements.map(placement => 
                      placement.dbId === selectedPlacement.dbId ? updatedPlacement : placement
                    )
                  };
                }
                return space;
              })
            };
          }
          return scene;
        }));

        // Save position to database
        updatePlacementImagePosition(productImage.id, position.x, position.y);
        
        // Set the new image as active in database
        if (selectedSpace && selectedPlacement) {
          setActivePlacementImage(selectedSpace.id, selectedPlacement.id, productImage.id);
        }
      };
      
      img.src = productImage.image.includes('http') ? productImage.image : generateS3Url(productImage.image);
    }
  }, [getSelectedPlacement, getSelectedSpace, currentSceneId, backgroundImageSize, updatePlacementImagePosition]);

  // Handle product image creation
  const handleProductImageSubmit = useCallback(async () => {
    if (!productImageForm.name.trim() || !productImageForm.image || !selectedPlacementId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Find the selected placement to get its database ID
      const selectedPlacement = getSelectedPlacement();
      if (!selectedPlacement || !selectedPlacement.dbId) {
        alert('Please select a valid placement first');
        return;
      }

      // Create placement image in database
      const response = await fetch('/api/placement-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placement_id: parseInt(selectedPlacement.dbId),
          name: productImageForm.name.trim(),
          image: productImageForm.image,
          anchor_position: {},
          position: {},
          product_id: null
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Clear the form and close modal
        setProductImageForm({ name: '', image: '' });
        setShowAddProductImage(false);
        
        // Refresh placement images from database
        fetchPlacementImages(selectedPlacement.dbId);
      } else {
        alert(`Failed to create product image: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating product image:', error);
      alert('Failed to create product image. Please try again.');
    }
  }, [productImageForm, selectedPlacementId, getSelectedPlacement]);

  // Handle edit placement image
  const handleEditPlacementImage = useCallback((placementImage: any) => {
    setEditingPlacementImage({
      id: placementImage.id,
      name: placementImage.name,
      image: placementImage.image,
      product_id: placementImage.product_id || null
    });
    setShowEditProductImage(true);
  }, []);

  // Handle edit completion (same handler as create since modal handles both)
  const handleProductImageUpdated = useCallback((updatedImage: { id: number; name: string; image: string }) => {
    // Close edit modal and refresh placement images
    setShowEditProductImage(false);
    setEditingPlacementImage(null);
    
    // Refresh placement images from database
    const selectedPlacement = getSelectedPlacement();
    if (selectedPlacement && selectedPlacement.dbId) {
      fetchPlacementImages(selectedPlacement.dbId);
    }
  }, [getSelectedPlacement, fetchPlacementImages]);

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

  // Calculate placement position for new placement images
  const calculateNewProductImagePosition = (placement: Placement, backgroundImageSize: { width: number; height: number }) => {
    const existingImages = placement.placementImages || [];
    
    if (existingImages.length === 0) {
      // No existing images - place at center
      return {
        x: backgroundImageSize.width / 2,
        y: backgroundImageSize.height / 2
      };
    }
    
    // Use the position of the last image, or center if no position
    const lastImage = existingImages[existingImages.length - 1];
    return {
      x: lastImage.x || backgroundImageSize.width / 2,
      y: lastImage.y || backgroundImageSize.height / 2
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

  // Handle placement image position updates from drag
  const handlePlacementImageDragEnd = useCallback((placementImage: any, x: number, y: number) => {
    // Update placement image in scenes state
    setScenes(prev => prev.map(scene =>
      scene.id === currentSceneId
        ? {
            ...scene,
            spaces: scene.spaces.map(space =>
              space.id === placementImage.spaceId
                ? {
                    ...space,
                    placements: space.placements.map(placement =>
                      placement.id === placementImage.placementId
                        ? {
                            ...placement,
                            placementImages: placement.placementImages?.map(img =>
                              img.id === placementImage.placementImageId
                                ? { ...img, x, y }
                                : img
                            ) || []
                          }
                        : placement
                    )
                  }
                : space
            )
          }
        : scene
    ));

    // Save position to database
    updatePlacementImagePosition(placementImage.placementImageId, x, y);
  }, [currentSceneId, updatePlacementImagePosition]);

  // Handle scene created from modal
  const handleSceneCreated = useCallback(async (baseScene: BaseScene) => {
    // Close the modal
    setShowCreateScene(false);
    
    // Store the scene name to track after refresh
    setPendingSceneName(baseScene.name);
    
    // Refresh scenes from database to get the newly created scene
    if (refreshScenes) {
      await refreshScenes();
      // The handleScenesLoaded callback will automatically set the current scene ID
      // to the database ID based on the pending scene name
    }
  }, [refreshScenes]);

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

  // Set active placement image for placement (only one active at a time)
  const setActivePlacementImage = useCallback(async (spaceId: string, placementId: string, placementImageId: number) => {
    // First update the local state
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
                        ? { ...placement, activeProductImageId: placementImageId }
                        : placement
                    )
                  }
                : space
            )
          }
        : scene
    ));

    // Find the placement to get its database ID
    const currentScene = scenes.find(scene => scene.id === currentSceneId);
    const currentSpace = currentScene?.spaces.find(space => space.id === spaceId);
    const currentPlacement = currentSpace?.placements.find(placement => placement.id === placementId);

    if (currentPlacement?.dbId) {
      try {
        const numericPlacementImageId = typeof placementImageId === 'string' ? parseInt(placementImageId) : placementImageId;
        
        // Update the database to mark this image as visible and others as not visible
        const response = await fetch('/api/placement-images/set-active', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            placement_id: parseInt(currentPlacement.dbId),
            active_placement_image_id: numericPlacementImageId
          }),
        });

        const result = await response.json();
        if (!result.success) {
          console.error('Failed to set active placement image in database:', result.error);
        }
      } catch (error) {
        console.error('Error setting active placement image in database:', error);
      }
    }
  }, [currentSceneId, scenes]);

  // Remove placement image
  const removePlacementImage = useCallback(async (spaceId: string, placementId: string, placementImageId: number) => {
    if (!confirm('Are you sure you want to remove this product image?')) {
      return;
    }

    try {
      // Delete from database
      const response = await fetch(`/api/placement-images/${placementImageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Remove from local state
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
                                  placementImages: placement.placementImages?.filter(img => img.id !== placementImageId) || [],
                                  activeProductImageId: placement.activeProductImageId === placementImageId ? 
                                    placement.placementImages?.find(img => img.id !== placementImageId)?.id : 
                                    placement.activeProductImageId
                                }
                              : placement
                          )
                        }
                      : space
                  )
                }
              : scene
          ));
        } else {
          alert(`Failed to remove product image: ${result.error}`);
        }
      } else {
        const errorResult = await response.json().catch(() => ({ error: 'Server error' }));
        alert(`Failed to remove product image: ${errorResult.error}`);
      }
    } catch (error) {
      console.error('Error removing placement image:', error);
      alert('Failed to remove product image. Please try again.');
    }
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

    // Only get products from the currently selected space
    const selectedSpace = currentScene.spaces?.find(space => space.id === selectedSpaceId);
    if (!selectedSpace) return [];

    const activeProducts: PlacedProduct[] = [];
    
    selectedSpace.placements?.forEach(placement => {
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

    return activeProducts;
  }, [placedProducts, currentSceneId, scenes, selectedSpaceId]);

  // Get current scene placed placement images for canvas
  const getCurrentPlacedPlacementImages = useCallback(() => {
    const currentScene = scenes.find(scene => scene.id === currentSceneId);
    if (!currentScene) return [];

    // Only get placement images from the currently selected space
    const selectedSpace = currentScene.spaces?.find(space => space.id === selectedSpaceId);
    if (!selectedSpace) return [];

    const activePlacementImages: any[] = [];
    
    selectedSpace.placements?.forEach(placement => {
      if (placement.activeProductImageId && placement.placementImages) {
        const activeImage = placement.placementImages.find(img => img.id === placement.activeProductImageId);
        if (activeImage && activeImage.x !== undefined && activeImage.y !== undefined) {
          activePlacementImages.push({
            id: `placement-image-${activeImage.id}`,
            src: activeImage.image.includes('http') ? activeImage.image : generateS3Url(activeImage.image),
            name: activeImage.name,
            x: activeImage.x,
            y: activeImage.y,
            width: activeImage.width || 100,
            height: activeImage.height || 100,
            visible: activeImage.visible !== false,
            placementImageId: activeImage.id,
            placementId: placement.id,
            spaceId: selectedSpace.id
          });
        }
      }
    });

    return activePlacementImages;
  }, [currentSceneId, scenes, selectedSpaceId]);

  // Stable callback for refresh function
  // Stable callback for scenes loaded
  const handleScenesLoaded = useCallback((loadedScenes: Scene[]) => {
    setScenes(loadedScenes);
    
    // If there's a pending scene name, find it by name and set as current (using dbId)
    if (pendingSceneName) {
      const newScene = loadedScenes.find(scene => scene.name === pendingSceneName);
      if (newScene && newScene.dbId) {
        setCurrentSceneId(newScene.dbId);
        setPendingSceneName(null);
        return;
      }
    }
    
    // Set the current scene ID based on URL parameter or default to first scene (using dbId)
    if (sceneIdParam && loadedScenes.find((scene: Scene) => scene.dbId === sceneIdParam)) {
      setCurrentSceneId(sceneIdParam);
    } else if (loadedScenes.length > 0 && !currentSceneId) {
      // Always use dbId for database scenes
      const firstSceneDbId = loadedScenes[0].dbId;
      if (firstSceneDbId) {
        setCurrentSceneId(firstSceneDbId);
      }
    }
  }, [sceneIdParam, currentSceneId, pendingSceneName]);

  // Load themes on component mount - scenes are loaded by SceneManagementHeader
  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  // Fetch spaces when current scene changes
  useEffect(() => {
    if (currentSceneId && currentSceneId !== lastFetchedSceneRef.current) {
      // Check if currentSceneId looks like a database ID (numeric string)
      if (/^\d+$/.test(currentSceneId)) {
        // currentSceneId is already a database ID
        lastFetchedSceneRef.current = currentSceneId;
        fetchSpacesForScene(currentSceneId);
      } else {
        // currentSceneId might be a frontend ID, need to find the scene
        // Use functional update to get current scenes without adding dependency
        setScenes(currentScenes => {
          const currentScene = currentScenes.find(scene => scene.id === currentSceneId);
          if (currentScene && currentScene.dbId && currentScene.dbId !== lastFetchedSceneRef.current) {
            lastFetchedSceneRef.current = currentScene.dbId;
            fetchSpacesForScene(currentScene.dbId);
          }
          return currentScenes; // Return unchanged to not trigger re-render
        });
      }
    }
  }, [currentSceneId, fetchSpacesForScene]);

  // Fetch complete space data (all placements and their images) when current space changes
  useEffect(() => {
    if (selectedSpaceId && selectedSpaceId !== lastFetchedSpaceRef.current) {
      // Check if selectedSpaceId looks like a database ID (numeric string)
      if (/^\d+$/.test(selectedSpaceId)) {
        // selectedSpaceId is already a database ID
        lastFetchedSpaceRef.current = selectedSpaceId;
        fetchCompleteSpaceData(selectedSpaceId);
      } else {
        // selectedSpaceId might be a frontend ID, need to find the space
        // Use functional update to get current spaces without adding dependency
        setScenes(currentScenes => {
          for (const scene of currentScenes) {
            const selectedSpace = scene.spaces.find(space => space.id === selectedSpaceId);
            if (selectedSpace && selectedSpace.dbId && selectedSpace.dbId !== lastFetchedSpaceRef.current) {
              lastFetchedSpaceRef.current = selectedSpace.dbId;
              fetchCompleteSpaceData(selectedSpace.dbId);
              break;
            }
          }
          return currentScenes; // Return unchanged to not trigger re-render
        });
      }
    }
  }, [selectedSpaceId, fetchCompleteSpaceData]);

  // Handle placement selection (no need to fetch images as they're already loaded with space data)
  useEffect(() => {
    if (selectedPlacementId) {
      // Find the selected placement to validate it exists
      const selectedPlacement = getSelectedPlacement();
      if (selectedPlacement && selectedPlacement.dbId) {
        // Update the last fetched placement ref for consistency
        lastFetchedPlacementRef.current = selectedPlacement.dbId;
        
        // If placement images aren't loaded yet, fetch complete space data
        if (!selectedPlacement.placementImages || selectedPlacement.placementImages.length === 0) {
          // Find the space that contains this placement
          setScenes(currentScenes => {
            for (const scene of currentScenes) {
              for (const space of scene.spaces) {
                const placement = space.placements.find(p => p.dbId === selectedPlacement.dbId);
                if (placement && space.dbId) {
                  fetchCompleteSpaceData(space.dbId);
                  break;
                }
              }
            }
            return currentScenes;
          });
        }
      }
    } else {
      // Reset when no placement is selected
      lastFetchedPlacementRef.current = '';
    }
  }, [selectedPlacementId, getSelectedPlacement, fetchCompleteSpaceData]);

  // Stable callback for handling refresh function from SceneManagementHeader
  const handleRefreshAvailable = useCallback((refreshFn: () => Promise<void>) => {
    setRefreshScenes(() => refreshFn);
  }, []);

  const currentScene = getCurrentScene();

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Fixed Collapsible Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-lg z-10 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-96'
      }`}>
        {/* Scene Management Header */}
        <SceneManagementHeader
          currentSceneId={currentSceneId}
          onSceneChange={setCurrentSceneId}
          onSceneDelete={(sceneId) => {
            if (confirm('Delete this scene?')) {
              const updatedScenes = scenes.filter(s => s.id !== sceneId);
              setScenes(updatedScenes);
              if (updatedScenes.length > 0) {
                setCurrentSceneId(updatedScenes[0].id);
              }
            }
          }}
          onShowCreateScene={() => setShowCreateScene(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onScenesLoaded={handleScenesLoaded}
          onRefreshAvailable={handleRefreshAvailable}
        />

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
                  
                  {/* Spaces List */}
                  {loadingSpaces ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <p className="text-gray-500 text-sm mt-2">Loading spaces...</p>
                    </div>
                  ) : getCurrentSceneSpaces().length === 0 ? (
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
                            <span className="font-medium">{space.name}</span>
                          </div>
                        </div>

                        {/* Selected Space: Show Placements Section */}
                        {selectedSpaceId === space.id && (
                          <div className="px-4 pb-4">
                            <div className="flex items-center justify-between mb-3 mt-2">
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
                                          onClick={() => setShowAddProductImage(true)}
                                        >
                                          Add Product Image
                                        </button>
                                      </div>
                                      
                                      {/* Show uploading progress */}
                                      {uploadingProducts.length > 0 && (
                                        <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                                          Uploading {uploadingProducts.length} product(s)...
                                        </div>
                                      )}                                                                            
                                      
                                      {/* Placement Images List */}
                                      {placement.placementImages && placement.placementImages.length > 0 ? (
                                        <div className="space-y-2 mb-3">
                                          <h6 className="text-xs font-medium text-gray-600">Product Images</h6>
                                          {placement.placementImages.map((placementImage) => {
                                            const isActive = placement.activeProductImageId === placementImage.id;
                                            return (
                                              <div 
                                                key={placementImage.id} 
                                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                                  isActive 
                                                    ? 'bg-blue-100 border-2 border-blue-500' 
                                                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                                }`}
                                                onClick={() => setActivePlacementImage(space.id, placement.id, placementImage.id)}
                                              >
                                                <img 
                                                  src={placementImage.image.includes('http') ? placementImage.image : generateS3Url(placementImage.image)} 
                                                  alt={placementImage.name}
                                                  className="w-8 h-8 object-cover rounded"
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-medium text-gray-700 truncate">{placementImage.name}</p>
                                                  <p className="text-xs text-gray-500">
                                                    {placementImage.width || 100}x{placementImage.height || 100} • {isActive ? 'Active' : 'Inactive'}
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
                                                      handleEditPlacementImage(placementImage);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 text-xs p-1 rounded hover:bg-blue-50"
                                                    title="Edit placement image"
                                                  >
                                                    ✏️
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      removePlacementImage(space.id, placement.id, placementImage.id);
                                                    }}
                                                    className="text-red-600 hover:text-red-800 text-xs p-1 rounded hover:bg-red-50"
                                                    title="Remove placement image"
                                                  >
                                                    ❌
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-gray-400 mb-3">No product images uploaded yet</p>
                                      )}                                                                          
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
                href={`/?spaceId=${selectedSpaceId}`}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                ← Mobile View
              </Link>
              <div className="text-sm text-gray-500">
                Placed: {getCurrentPlacedProducts().length + getCurrentPlacedPlacementImages().length} items
              </div>
            </div>
            <div className="flex items-center">
              <SettingsDropdown onThemeManagement={() => setShowThemeManagement(true)} />
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
                  {/* Space Background - only show selected space image */}
                  {getSelectedSpace()?.image && (
                    <KonvaImageComponent
                      src={getSelectedSpace()?.image || ''}
                      x={0}
                      y={0}
                      draggable={false}
                      onImageLoad={handleBackgroundImageLoad}
                    />
                  )}
                  
                  {/* Product Images */}
                  {getCurrentPlacedProducts().map((product) => (
                    <ProductImage
                      key={product.id}
                      product={product}
                      onDragEnd={handleProductDragEnd}
                    />
                  ))}
                  
                  {/* Placement Images */}
                  {getCurrentPlacedPlacementImages().map((placementImage) => (
                    <PlacementImageComponent
                      key={placementImage.id}
                      placementImage={placementImage}
                      selectedPlacementId={selectedPlacementId}
                      onDragEnd={handlePlacementImageDragEnd}
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
                <span>
                  Drag background to pan • {selectedPlacementId ? 'Selected placement images can be moved' : 'Select a placement to move items'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Theme Management Modal */}
      <ThemeManagementModal
        isOpen={showThemeManagement}
        onClose={() => setShowThemeManagement(false)}
        themes={themes}
        onCreateTheme={handleCreateTheme}
        onDeleteTheme={handleDeleteTheme}
      />

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
      <CreateSceneModal
        isOpen={showCreateScene}
        onClose={() => setShowCreateScene(false)}
        onSceneCreated={handleSceneCreated}
      />

      {/* Create Space Modal */}
      <CreateSpaceModal
        isOpen={showCreateSpace}
        onClose={() => setShowCreateSpace(false)}
        onSpaceCreated={handleSpaceCreated}
        currentSceneId={currentSceneId}
        currentSceneDbId={getCurrentScene()?.dbId}
      />
      
      {/* Add Product Image Modal */}
      <AddProductImageModal
        isOpen={showAddProductImage}
        onClose={() => setShowAddProductImage(false)}
        onProductImageCreated={handleProductImageCreated}
        placementId={getSelectedPlacement()?.dbId || ''}
        sceneId={currentSceneId}
      />

      {/* Edit Product Image Modal */}
      <AddProductImageModal
        isOpen={showEditProductImage}
        onClose={() => {
          setShowEditProductImage(false);
          setEditingPlacementImage(null);
        }}
        onProductImageCreated={handleProductImageUpdated}
        placementId={getSelectedPlacement()?.dbId || ''}
        sceneId={currentSceneId}
        editMode={true}
        existingPlacementImage={editingPlacementImage}
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