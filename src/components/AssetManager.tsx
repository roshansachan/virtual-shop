'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

interface Asset {
  key: string;
  size: number;
  lastModified: string;
  url: string;
  filename: string;
  type: string;
  folder: string;
}

interface AssetManagerProps {
  onAssetSelect?: (asset: Asset) => void;
  onClose?: () => void;
  currentSceneId?: string;
  selectedFolderName?: string;
  mode?: 'manage' | 'select-background';
}

export default function AssetManager({ onAssetSelect, onClose, currentSceneId, selectedFolderName, mode = 'manage' }: AssetManagerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'current-scene' | 'backgrounds' | 'products'>(
    mode === 'select-background' ? 'backgrounds' : 'all'
  );
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/list-assets');
      const data = await response.json();
      
      if (data.success) {
        setAssets(data.data.assets);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleAssetSelect = (asset: Asset) => {
    if (onAssetSelect) {
      onAssetSelect(asset);
    }
  };

  // const handleBatchUse = () => {
  //   if (selectedAssets.size === 0 || !onAssetSelect) return;
    
  //   // Get the selected assets
  //   const filteredAssets = getFilteredAssets();
  //   const selectedAssetsList = filteredAssets.filter(asset => selectedAssets.has(asset.key));
    
  //   // Import each selected asset
  //   selectedAssetsList.forEach(asset => {
  //     onAssetSelect(asset);
  //   });
    
  //   // Clear selection after importing
  //   setSelectedAssets(new Set());
  // };

  const handleBatchDelete = async () => {
    if (selectedAssets.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedAssets.size} asset(s)?`)) {
      return;
    }

    try {
      const response = await fetch('/api/batch-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          keys: Array.from(selectedAssets),
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchAssets(); // Refresh the list
        setSelectedAssets(new Set());
      }
    } catch (error) {
      console.error('Failed to delete assets:', error);
    }
  };

  const handleBatchCopy = async (targetPrefix: string) => {
    if (selectedAssets.size === 0) return;

    try {
      const response = await fetch('/api/batch-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          keys: Array.from(selectedAssets),
          targetPrefix,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchAssets(); // Refresh the list
        setSelectedAssets(new Set());
      }
    } catch (error) {
      console.error('Failed to copy assets:', error);
    }
  };

  const toggleAssetSelection = (assetKey: string) => {
    const newSelection = new Set(selectedAssets);
    if (newSelection.has(assetKey)) {
      newSelection.delete(assetKey);
    } else {
      newSelection.add(assetKey);
    }
    setSelectedAssets(newSelection);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFilteredAssets = () => {
    let filtered = assets;

    // Apply folder filter
    if (filter === 'current-scene' && currentSceneId) {
      filtered = filtered.filter(asset => asset.key.includes(`scenes/${currentSceneId}/`));
    } else if (filter === 'backgrounds') {
      filtered = filtered.filter(asset => asset.key.includes('/backgrounds/'));
    } else if (filter === 'products') {
      filtered = filtered.filter(asset => asset.key.includes('/products/'));
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(asset => 
        asset.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.folder.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'size':
          return b.size - a.size;
        case 'date':
        default:
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      }
    });

    return filtered;
  };

  const renderAssetGrid = (assetsToRender: Asset[]) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {assetsToRender.map((asset) => (
        <div
          key={asset.key}
          className={`relative group bg-white rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
            selectedAssets.has(asset.key)
              ? 'border-blue-500 ring-2 ring-blue-200'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => {
            if (mode === 'select-background' && onAssetSelect) {
              onAssetSelect(asset);
              onClose?.();
            } else {
              toggleAssetSelection(asset.key);
            }
          }}
        >
          <div className="aspect-square relative">
            <Image
              src={asset.url}
              alt={asset.filename}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
              unoptimized
            />
            <div className="absolute top-2 right-2">
              <input
                type="checkbox"
                checked={selectedAssets.has(asset.key)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleAssetSelection(asset.key);
                }}
                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <div className="text-white text-xs font-medium truncate">
                {asset.filename}
              </div>
            </div>
            <div className="absolute bottom-2 right-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAssetSelect(asset);
                }}
                disabled={!selectedFolderName}
                className={`text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedFolderName
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Use
              </button>
            </div>
          </div>
          <div className="p-2 text-xs text-gray-500">
            <div>{formatFileSize(asset.size)}</div>
            <div>{formatDistanceToNow(new Date(asset.lastModified), { addSuffix: true })}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAssetList = (assetsToRender: Asset[]) => (
    <div className="space-y-1">
      {assetsToRender.map((asset) => (
        <div
          key={asset.key}
          className={`flex items-center space-x-3 p-2 rounded cursor-pointer transition-colors group ${
            selectedAssets.has(asset.key)
              ? 'bg-blue-50 border border-blue-200'
              : 'hover:bg-gray-50 border border-transparent'
          }`}
          onClick={() => {
            if (mode === 'select-background' && onAssetSelect) {
              onAssetSelect(asset);
              onClose?.();
            } else {
              toggleAssetSelection(asset.key);
            }
          }}
        >
          <input
            type="checkbox"
            checked={selectedAssets.has(asset.key)}
            onChange={(e) => {
              e.stopPropagation();
              toggleAssetSelection(asset.key);
            }}
            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
          />
          <div className="relative w-10 h-10 rounded overflow-hidden">
            <Image
              src={asset.url}
              alt={asset.filename}
              fill
              className="object-cover"
              sizes="40px"
              unoptimized
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">
              {asset.filename}
            </div>
            <div className="text-xs text-gray-500">
              {asset.folder} • {formatFileSize(asset.size)} • {formatDistanceToNow(new Date(asset.lastModified), { addSuffix: true })}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAssetSelect(asset);
            }}
            disabled={!selectedFolderName}
            className={`text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
              selectedFolderName
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            Use
          </button>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-sm text-gray-600">Loading assets...</div>
        </div>
      </div>
    );
  }

  const filteredAssets = getFilteredAssets();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === 'select-background' ? 'Select Background' : 'Asset Manager'}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              ✕
            </button>
          )}
        </div>
        {mode === 'manage' && (
          selectedFolderName ? (
            <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg flex items-center space-x-2">
              <span>📁</span>
              <span>Assets will be added to: <strong>{selectedFolderName}</strong></span>
            </div>
          ) : (
            <div className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg flex items-center space-x-2">
              <span>⚠️</span>
              <span>Please select a folder first to add assets</span>
            </div>
          )
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-b space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <div className="absolute left-2.5 top-2.5 text-gray-400">🔍</div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'manage' && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Assets</option>
              <option value="backgrounds">Backgrounds</option>
              <option value="products">Products</option>
              {currentSceneId && <option value="current-scene">Current Scene</option>}
            </select>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>

          <div className="flex rounded border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Batch Actions */}
        {selectedAssets.size > 0 && mode === 'manage' && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
            <span className="text-sm text-blue-700">
              {selectedAssets.size} selected
            </span>
            {/* <button
              onClick={handleBatchUse}
              disabled={!selectedFolderName}
              className={`px-3 py-1 text-sm rounded ${
                selectedFolderName
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
              }`}
            >
              Use Selected
            </button> */}
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Delete
            </button>
            {currentSceneId && (
              <button
                onClick={() => handleBatchCopy(`scenes/${currentSceneId}/products/reused`)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Copy to Current Scene
              </button>
            )}
          </div>
        )}
      </div>

      {/* Asset Display */}
      <div className="flex-1 overflow-auto p-4">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📁</div>
            <div className="text-gray-500">No assets found</div>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} found
            </div>
            {viewMode === 'grid'
              ? renderAssetGrid(filteredAssets)
              : renderAssetList(filteredAssets)
            }
          </>
        )}
      </div>
    </div>
  );
}
