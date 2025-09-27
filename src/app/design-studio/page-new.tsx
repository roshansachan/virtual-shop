'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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
}

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

  // Initialize with demo data
  useEffect(() => {
    const demoScene: Scene = {
      id: 'demo-scene-1',
      name: 'Living Room Demo',
      backgroundImage: '',
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
              products: []
            }
          ]
        }
      ]
    };
    
    setScenes([demoScene]);
    setCurrentSceneId(demoScene.id);
  }, []);

  const currentScene = getCurrentScene();

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Fixed Collapsible Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-lg z-10 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-96'
      }`}>
        {/* Compact Sidebar Header with Scene Name */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  Design Studio
                </h1>
                {currentScene && (
                  <p className="text-sm text-gray-600 truncate">
                    Scene: {currentScene.name}
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
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
                                          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                                          onClick={() => {
                                            alert('Product upload functionality will be implemented next!');
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

      {/* Main Content Area */}
      <div 
        className="flex-1 transition-all duration-300" 
        style={{ marginLeft: sidebarCollapsed ? '80px' : '384px' }}
      >
        <div className="p-8 bg-gray-50 h-full">
          <div className="bg-white rounded-lg shadow-lg p-6 h-full">
            <h2 className="text-2xl font-bold mb-4">Virtual Store Design Studio</h2>
            
            {/* Hierarchy Status */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Current Selection:</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Scene:</strong> {currentScene?.name || 'None'}</p>
                <p><strong>Space:</strong> {getSelectedSpace()?.name || 'None selected'}</p>
                <p><strong>Placement:</strong> {getSelectedPlacement()?.name || 'None selected'}</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">New Hierarchy Implementation</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>✅ <strong>Scenes</strong> → <strong>Spaces</strong> → <strong>Placements</strong> → <strong>Products</strong></p>
                <p>✅ Create Space button is shown</p>
                <p>✅ Space selection shows placements</p>
                <p>✅ Placement selection shows product upload button</p>
                <p>✅ Visual selection indicators implemented</p>
                <p>🔄 Product upload functionality ready for implementation</p>
              </div>
            </div>

            {/* Demo Canvas Area */}
            <div className="mt-6 bg-gray-100 rounded-lg flex items-center justify-center h-64">
              <p className="text-gray-500">Canvas area - ready for Konva integration</p>
            </div>
          </div>
        </div>
      </div>
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