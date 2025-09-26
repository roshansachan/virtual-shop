'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Scene } from '@/types';
import { DBScene } from '@/types/database';

interface SceneManagementHeaderProps {
  currentSceneId: string;
  onSceneChange: (sceneId: string) => void;
  onSceneDelete: (sceneId: string) => void;
  onShowCreateScene: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onScenesLoaded: (scenes: Scene[]) => void; // New callback to pass scenes to parent
  onRefreshAvailable?: (refreshFn: () => Promise<void>) => void; // Callback to expose refresh function
}

export default function SceneManagementHeader({
  currentSceneId,
  onSceneChange,
  onSceneDelete,
  onShowCreateScene,
  sidebarCollapsed,
  onToggleSidebar,
  onScenesLoaded,
  onRefreshAvailable
}: SceneManagementHeaderProps) {
  const [dbScenes, setDbScenes] = useState<DBScene[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loadingScenes, setLoadingScenes] = useState(false);
  
  // Use ref to store the latest callback to avoid dependency issues
  const onScenesLoadedRef = useRef(onScenesLoaded);
  const onRefreshAvailableRef = useRef(onRefreshAvailable);
  
  // Update refs when callbacks change
  useEffect(() => {
    onScenesLoadedRef.current = onScenesLoaded;
  }, [onScenesLoaded]);
  
  useEffect(() => {
    onRefreshAvailableRef.current = onRefreshAvailable;
  }, [onRefreshAvailable]);
  
  // Load scenes from database
  const loadScenesFromDatabase = useCallback(async () => {
    setLoadingScenes(true);
    try {
      const response = await fetch('/api/scenes');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDbScenes(result.data || []);
          
          // Convert DBScene to Scene format
          const convertedScenes: Scene[] = (result.data || []).map((dbScene: DBScene) => ({
            id: dbScene.id.toString(),
            name: dbScene.name,
            type: dbScene.type || undefined,
            backgroundImage: dbScene.image || '',
            backgroundImageSize: { width: 1920, height: 1080 }, // Default size, should be stored in DB
            spaces: [], // Empty for now, will be loaded separately if needed
            backgroundImageS3Key: dbScene.image || undefined,
            theme_id: dbScene.theme_id,
            dbId: dbScene.id.toString()
          }));
          
          setScenes(convertedScenes);
          onScenesLoadedRef.current(convertedScenes); // Use ref to avoid dependency
        } else {
          console.error('Failed to load scenes from database:', result.error);
        }
      } else {
        console.error('Failed to load scenes from database: HTTP', response.status);
      }
    } catch (error) {
      console.error('Error loading scenes from database:', error);
    } finally {
      setLoadingScenes(false);
    }
  }, []); // Remove dependency to prevent infinite loop

  // Load database scenes on component mount
  useEffect(() => {
    loadScenesFromDatabase();
  }, []); // Empty dependency since loadScenesFromDatabase is stable

  // Expose refresh function to parent
  useEffect(() => {
    if (onRefreshAvailableRef.current) {
      onRefreshAvailableRef.current(loadScenesFromDatabase);
    }
  }, []); // Empty dependency since loadScenesFromDatabase is stable

  // Find current scene (prioritize filesystem scenes, then database scenes)
  const currentScene = scenes.find(scene => scene.id === currentSceneId);
  const currentDbScene = dbScenes.find(scene => scene.id.toString() === currentSceneId);
  
  // Handle scene deletion with database integration
  const handleSceneDelete = useCallback(async (sceneId: string) => {
    if (!confirm('Delete this scene? This action cannot be undone.')) {
      return;
    }

    try {
      // Check if this scene exists in database
      const dbScene = dbScenes.find(scene => scene.id.toString() === sceneId);
      
      if (dbScene) {
        // Delete from database
        const response = await fetch(`/api/scenes/${dbScene.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Refresh database scenes
            await loadScenesFromDatabase();
          } else {
            alert(`Failed to delete scene from database: ${result.error}`);
            return;
          }
        } else {
          alert('Failed to delete scene from database');
          return;
        }
      }

      // Call parent handler to update local state
      onSceneDelete(sceneId);
    } catch (error) {
      console.error('Error deleting scene:', error);
      alert('Failed to delete scene. Please try again.');
    }
  }, [dbScenes, onSceneDelete]); // Removed loadScenesFromDatabase since it's stable

  // Combined scenes list (filesystem + database)
  const allScenes = [
    ...scenes,
    // Add database scenes that aren't in filesystem scenes
    ...dbScenes
      .filter(dbScene => !scenes.find(scene => scene.dbId === dbScene.id.toString()))
      .map(dbScene => ({
        id: dbScene.id.toString(),
        name: dbScene.name,
        type: dbScene.type,
        backgroundImage: dbScene.image || '',
        backgroundImageSize: { width: 1920, height: 1080 },
        spaces: [],
        theme_id: dbScene.theme_id,
        dbId: dbScene.id.toString()
      } as Scene))
  ];

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
      <div className="flex items-center space-x-3 flex-1">
        {!sidebarCollapsed && (
          <>                
            <div className="flex-1 min-w-0">
              {allScenes.length > 0 ? (
                <div className="flex items-center space-x-2">
                  <select 
                    value={currentSceneId}
                    onChange={(e) => onSceneChange(e.target.value)}
                    className="flex-1 p-2 text-sm border border-gray-200 rounded-md bg-white min-w-0"
                    disabled={loadingScenes}
                  >
                    <option value="" disabled>
                      {loadingScenes ? 'Loading scenes...' : 'Select a scene'}
                    </option>
                    {scenes.map(scene => (
                          <option key={scene.id} value={scene.id}>
                            {scene.name}
                          </option>
                    ))}
                    
                    
                    {/* Database-only scenes */}
                    
                  </select>
                  <button
                    onClick={() => handleSceneDelete(currentSceneId)}
                    disabled={!currentSceneId || loadingScenes}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete scene"
                  >
                    🗑
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-500">
                  {loadingScenes ? 'Loading scenes...' : 'No scenes available'}
                </span>
              )}
            </div>
            <button
              onClick={onShowCreateScene}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 whitespace-nowrap"
              title="Create new scene"
            >
              + Scene
            </button>
          </>
        )}
      </div>
      <button
        onClick={onToggleSidebar}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 ml-2"
      >
        {sidebarCollapsed ? '→' : '←'}
      </button>
    </div>
  );
}