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

interface UploadedImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

export default function DesktopPage() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [backgroundImageSize, setBackgroundImageSize] = useState({ width: 1920, height: 1080 });
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
    const savedImages = localStorage.getItem('virtualStoreImages');
    if (savedImages) {
      setUploadedImages(JSON.parse(savedImages));
    }
  }, []);

  // Save to localStorage whenever uploadedImages changes
  useEffect(() => {
    localStorage.setItem('virtualStoreImages', JSON.stringify(uploadedImages));
  }, [uploadedImages]);

  const handleFiles = useCallback((files: FileList) => {
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const src = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const newImage: UploadedImage = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              src,
              x: 50,
              y: 50,
              width: img.naturalWidth,
              height: img.naturalHeight,
              name: file.name,
            };
            setUploadedImages(prev => [...prev, newImage]);
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleImageDragEnd = useCallback((id: string, x: number, y: number) => {
    setUploadedImages(prev => 
      prev.map(img => 
        img.id === id ? { ...img, x, y } : img
      )
    );
  }, []);

  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
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

  const clearAll = useCallback(() => {
    setUploadedImages([]);
    localStorage.removeItem('virtualStoreImages');
  }, []);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Upload Area */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Virtual Store Designer
            </h1>
            <Link 
              href="/"
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              ← Mobile View
            </Link>
          </div>
          <p className="text-gray-600">
            Upload images and place them on the living room scene
          </p>
        </div>

        {/* Upload Area */}
        <div className="p-6 flex-1">
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="space-y-4">
              <div className="text-6xl">📁</div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Drop images here
                </p>
                <p className="text-gray-500">
                  or click to browse
                </p>
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

          {/* Controls */}
          <div className="mt-6 space-y-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Files
            </button>
            
            {uploadedImages.length > 0 && (
              <button
                onClick={clearAll}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Uploaded Images List */}
          {uploadedImages.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Uploaded Images ({uploadedImages.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadedImages.map((img) => (
                  <div
                    key={img.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={img.src}
                        alt={img.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {img.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {img.width} × {img.height}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                Drag to pan the view • Drop images to place them in the scene
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Image: {backgroundImageSize.width} × {backgroundImageSize.height}
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
                
                {/* Uploaded Images */}
                {uploadedImages.map((img) => (
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
        </div>
      </div>
    </div>
  );
}