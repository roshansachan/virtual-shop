'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';

// Custom hook for loading images
const useImageLoader = (src: string | null) => {
  return useImage(src || '', 'anonymous');
};

// Component for the Konva Image
const KonvaImageComponent = ({ src, x, y, draggable = true, onDragEnd }: {
  src: string;
  x: number;
  y: number;
  draggable?: boolean;
  onDragEnd?: (x: number, y: number) => void;
}) => {
  const [image] = useImageLoader(src);
  
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
}

interface FolderData {
  folders: Folder[];
}

export default function DesignStudioPage() {
  const [folderData, setFolderData] = useState<FolderData>({ folders: [] });
  const [placedImages, setPlacedImages] = useState<PlacedImage[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [backgroundImageSize, setBackgroundImageSize] = useState({ width: 1920, height: 1080 });
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set stage size based on window dimensions
  useEffect(() => {
    const updateStageSize = () => {
      if (typeof window !== 'undefined') {
        setStageSize({
          width: window.innerWidth * 0.67,
          height: window.innerHeight - 80
        });
      }
    };

    updateStageSize();
    window.addEventListener('resize', updateStageSize);
    return () => window.removeEventListener('resize', updateStageSize);
  }, []);

  // Load background image dimensions
  useEffect(() => {
    const img = document.createElement('img');
    img.onload = () => {
      setBackgroundImageSize({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.src = '/living-room.jpg';
  }, []);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const savedFolderData = localStorage.getItem('virtualStoreFolders');
    if (savedFolderData) {
      setFolderData(JSON.parse(savedFolderData));
    }

    const savedPlacedImages = localStorage.getItem('virtualStoreImages');
    if (savedPlacedImages) {
      setPlacedImages(JSON.parse(savedPlacedImages));
    }
  }, []);

  // Save folder data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('virtualStoreFolders', JSON.stringify(folderData));
  }, [folderData]);

  // Save placed images to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('virtualStoreImages', JSON.stringify(placedImages));
  }, [placedImages]);

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
      setFolderData(prev => ({
        ...prev,
        folders: [...prev.folders, newFolder]
      }));
      setNewFolderName('');
      setShowCreateFolder(false);
    }
  }, [newFolderName]);

  // Toggle folder expansion
  const toggleFolder = useCallback((folderId: string) => {
    setFolderData(prev => ({
      ...prev,
      folders: prev.folders.map(folder =>
        folder.id === folderId
          ? { ...folder, expanded: !folder.expanded }
          : folder
      )
    }));
  }, []);

  // Rename folder
  const renameFolder = useCallback((folderId: string, newName: string) => {
    if (newName.trim()) {
      setFolderData(prev => ({
        ...prev,
        folders: prev.folders.map(folder =>
          folder.id === folderId
            ? { ...folder, name: newName.trim() }
            : folder
        )
      }));
      
      // Update folder name in placed images
      setPlacedImages(prev =>
        prev.map(img => {
          const folder = folderData.folders.find(f => f.id === folderId);
          return folder && img.folderName === folder.name
            ? { ...img, folderName: newName.trim() }
            : img;
        })
      );
    }
    setEditingFolderId(null);
  }, [folderData.folders]);

  // Rename image
  const renameImage = useCallback((folderId: string, imageId: string, newName: string) => {
    if (newName.trim()) {
      setFolderData(prev => ({
        ...prev,
        folders: prev.folders.map(folder =>
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
      }));

      // Update image name in placed images
      setPlacedImages(prev =>
        prev.map(img =>
          img.imageId === imageId
            ? { ...img, name: newName.trim() }
            : img
        )
      );
    }
    setEditingImageId(null);
  }, []);

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
    const folder = folderData.folders.find(f => f.id === folderId);
    const image = folder?.images.find(img => img.id === imageId);
    
    console.log('Found folder:', folder);
    console.log('Found image:', image);
    
    if (folder && image && image.visible && folder.visible) {
      // Check if this image is already placed
      const alreadyPlaced = placedImages.some(img => img.imageId === imageId);
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
  }, [folderData.folders, placedImages, getExistingFolderImagePosition, getViewportCenter]);

  // Auto-place visible images that aren't placed yet
  useEffect(() => {
    folderData.folders.forEach(folder => {
      if (folder.visible) {
        folder.images.forEach(image => {
          if (image.visible) {
            const alreadyPlaced = placedImages.some(img => img.imageId === image.id);
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
              };
              setPlacedImages(prev => [...prev, newPlacedImage]);
            }
          }
        });
      }
    });
  }, [folderData, placedImages, getExistingFolderImagePosition, getViewportCenter]);

  // Handle file upload to selected folder
  const handleFiles = useCallback((files: FileList) => {
    if (!selectedFolder) {
      alert('Please select a folder first');
      return;
    }

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const src = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const folder = folderData.folders.find(f => f.id === selectedFolder);
            const isFirstImage = folder ? folder.images.length === 0 : false;
            
            const newImage: FolderImage = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              src,
              name: file.name,
              width: img.naturalWidth,
              height: img.naturalHeight,
              visible: isFirstImage, // Only first image is visible by default
            };
            
            setFolderData(prev => ({
              ...prev,
              folders: prev.folders.map(folder =>
                folder.id === selectedFolder
                  ? { ...folder, images: [...folder.images, newImage] }
                  : folder
              )
            }));
            
            console.log('Image uploaded:', newImage.name, 'isFirstImage:', isFirstImage);
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      }
    });
  }, [selectedFolder, autoPlaceImage]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  // Toggle folder visibility
  const toggleFolderVisibility = useCallback((folderId: string) => {
    const folder = folderData.folders.find(f => f.id === folderId);
    const wasVisible = folder?.visible;
    
    setFolderData(prev => ({
      ...prev,
      folders: prev.folders.map(folder =>
        folder.id === folderId
          ? { ...folder, visible: !folder.visible }
          : folder
      )
    }));

    // Remove all placed images from this folder when hiding
    if (folder && wasVisible) {
      setPlacedImages(prev => prev.filter(img => img.folderName !== folder.name));
    }
  }, [folderData.folders]);

  // Toggle image visibility (ensure only one image per folder is visible)
  const toggleImageVisibility = useCallback((folderId: string, imageId: string) => {
    const folder = folderData.folders.find(f => f.id === folderId);
    const image = folder?.images.find(img => img.id === imageId);
    
    setFolderData(prev => ({
      ...prev,
      folders: prev.folders.map(folder =>
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
    }));

    // Remove placed images from this folder when hiding current image
    if (image && image.visible) {
      setPlacedImages(prev => prev.filter(img => img.folderName !== folder?.name));
    }
  }, [folderData.folders]);

  // Delete folder
  const deleteFolder = useCallback((folderId: string) => {
    const folder = folderData.folders.find(f => f.id === folderId);
    if (folder && window.confirm(`Delete folder "${folder.name}" and all its images?`)) {
      setFolderData(prev => ({
        ...prev,
        folders: prev.folders.filter(f => f.id !== folderId)
      }));
      
      // Remove placed images from this folder
      setPlacedImages(prev => prev.filter(img => img.folderName !== folder.name));
    }
  }, [folderData.folders]);

  // Delete image from folder
  const deleteImageFromFolder = useCallback((folderId: string, imageId: string) => {
    setFolderData(prev => ({
      ...prev,
      folders: prev.folders.map(folder =>
        folder.id === folderId
          ? { ...folder, images: folder.images.filter(img => img.id !== imageId) }
          : folder
      )
    }));
    
    // Remove from canvas if placed
    setPlacedImages(prev => prev.filter(img => img.imageId !== imageId));
  }, []);

  // Reset pan to center
  const resetPan = useCallback(() => {
    if (stageRef.current) {
      const centerX = (stageSize.width - backgroundImageSize.width) / 2;
      const centerY = (stageSize.height - backgroundImageSize.height) / 2;
      stageRef.current.x(centerX);
      stageRef.current.y(centerY);
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
    const newX = Math.min(0, Math.max(-(backgroundImageSize.width - stageSize.width), pos.x));
    const newY = Math.min(0, Math.max(-(backgroundImageSize.height - stageSize.height), pos.y));
    return { x: newX, y: newY };
  }, [backgroundImageSize, stageSize]);

  // Clear all
  const clearAll = useCallback(() => {
    if (window.confirm('Clear all folders and placed images?')) {
      setFolderData({ folders: [] });
      setPlacedImages([]);
      localStorage.removeItem('virtualStoreFolders');
      localStorage.removeItem('virtualStoreImages');
    }
  }, []);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Folder Management */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Design Studio
            </h1>
            <Link 
              href="/"
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              ← Mobile View
            </Link>
          </div>
          <p className="text-gray-600">
            Organize images in folders and place them on the living room scene
          </p>
        </div>

        {/* Folder Management */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Create Folder Section */}
          <div className="mb-6">
            {!showCreateFolder ? (
              <button
                onClick={() => setShowCreateFolder(true)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>📁</span>
                <span>Create New Folder</span>
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={createFolder}
                    className="flex-1 bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName('');
                    }}
                    className="flex-1 bg-gray-500 text-white py-1 px-3 rounded text-sm hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Section */}
          {selectedFolder && (
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  Selected folder: <strong>{folderData.folders.find(f => f.id === selectedFolder)?.name}</strong>
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upload Images to Folder
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />

          {/* Folders Explorer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Folders</h3>
              {folderData.folders.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {folderData.folders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No folders created yet. Create a folder to start organizing your images.
              </p>
            ) : (
              folderData.folders.map((folder) => (
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Konva Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Living Room Scene
              </h2>
              <p className="text-gray-600">
                Drag to pan the view • Place images from folders onto the scene
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Placed: {placedImages.length} items
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
          {/* Fixed container for the canvas */}
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
                {/* Living Room Background */}
                <KonvaImageComponent
                  src="/living-room.jpg"
                  x={0}
                  y={0}
                  draggable={false}
                />
                
                {/* Placed Images - only show if both folder and image are visible */}
                {placedImages
                  .filter(img => {
                    const folder = folderData.folders.find(f => f.name === img.folderName);
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

          {/* Pan instructions overlay */}
          <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
            <div className="flex items-center space-x-2">
              <span>🖱️</span>
              <span>Drag background to pan • Drag items to move</span>
            </div>
          </div>

          {/* Placed Images List Overlay */}
          {placedImages.length > 0 && (
            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Placed Items ({placedImages.filter(img => {
                  const folder = folderData.folders.find(f => f.name === img.folderName);
                  const image = folder?.images.find(i => i.id === img.imageId);
                  return folder?.visible && image?.visible;
                }).length}/{placedImages.length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {placedImages.map((img) => {
                  const folder = folderData.folders.find(f => f.name === img.folderName);
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