'use client';

import { useState, useCallback, useEffect } from 'react';
import { SceneType, DBTheme, Scene } from '@/types';
import { generateS3Url } from '@/lib/s3-utils';

interface CreateSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSceneCreated: (scene: Scene) => void;
  editingScene?: {
    id: string;
    dbId: string;
    name: string;
    type?: string;
    backgroundImage?: string;
    backgroundImageS3Key?: string;
    theme_id?: number;
  } | null;
}

export default function CreateSceneModal({ isOpen, onClose, onSceneCreated, editingScene }: CreateSceneModalProps) {
  // Scene creation/editing state
  const [newSceneName, setNewSceneName] = useState('');
  const [newSceneImage, setNewSceneImage] = useState('');
  const [newSceneImageS3Key, setNewSceneImageS3Key] = useState('');
  const [uploadingSceneImage, setUploadingSceneImage] = useState(false);
  const [sceneImageUploadProgress, setSceneImageUploadProgress] = useState(0);
  const [newSceneThemeId, setNewSceneThemeId] = useState<string>('');
  const [newSceneType, setNewSceneType] = useState<string>('');
  const [availableThemes, setAvailableThemes] = useState<DBTheme[]>([]);

  // Update state when editingScene changes
  useEffect(() => {
    if (editingScene) {
      setNewSceneName(editingScene.name);
      setNewSceneImage(editingScene.backgroundImage || '');
      setNewSceneImageS3Key(editingScene.backgroundImageS3Key || '');
      setNewSceneType(editingScene.type || '');
      setNewSceneThemeId(editingScene.theme_id?.toString() || '');
    } else {
      setNewSceneName('');
      setNewSceneImage('');
      setNewSceneImageS3Key('');
      setNewSceneType('');
      setNewSceneThemeId('');
    }
  }, [editingScene]);

  // Load themes for scene creation modal
  const loadAvailableThemes = useCallback(async () => {
    try {
      const response = await fetch('/api/themes');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAvailableThemes(result.data);
        } else {
          console.error('Failed to load themes for scene creation:', result.error);
        }
      } else {
        console.error('Failed to load themes for scene creation: HTTP', response.status);
      }
    } catch (error) {
      console.error('Error loading themes for scene creation:', error);
    }
  }, []);

  // Load themes when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAvailableThemes();
    }
  }, [isOpen, loadAvailableThemes]);

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
        const imageKey = data.data.key;
        setNewSceneImage(generateS3Url(imageKey)); // Generate URL from key for display
        setNewSceneImageS3Key(imageKey); // Store the key for API calls
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

  // Create or update scene
  const createOrUpdateScene = useCallback(async () => {
    if (!newSceneName.trim()) return;
    
    try {
      if (editingScene) {
        // Update existing scene
        const response = await fetch('/api/scenes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: parseInt(editingScene.dbId),
            name: newSceneName.trim(),
            type: newSceneType || null,
            backgroundImageS3Key: newSceneImageS3Key || null,
            theme_id: newSceneThemeId ? parseInt(newSceneThemeId) : null
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Notify parent component with updated scene
            onSceneCreated(result.data);
            
            // Reset modal state and close
            resetModal();
          } else {
            throw new Error(result.error || 'Failed to update scene');
          }
        } else {
          throw new Error('Failed to update scene');
        }
      } else {
        // Create new scene
        const newScene: Scene = {
          id: Date.now().toString(),
          name: newSceneName.trim(),
          type: newSceneType || undefined,
          theme_id: newSceneThemeId ? parseInt(newSceneThemeId) : undefined,
          backgroundImage: newSceneImage,
          backgroundImageS3Key: newSceneImageS3Key,
          backgroundImageSize: { width: 1200, height: 800 },
          spaces: []
        };
        
        // Save scene to database
        await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newScene),
        });
        
        // Notify parent component
        onSceneCreated(newScene);
        
        // Reset modal state and close
        resetModal();
      }
    } catch (error) {
      console.error('Error saving scene:', error);
      alert(`Failed to ${editingScene ? 'update' : 'create'} scene: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [newSceneName, newSceneType, newSceneThemeId, newSceneImage, newSceneImageS3Key, editingScene, onSceneCreated]);

  // Reset all form fields
  const resetModal = useCallback(() => {
    setNewSceneName('');
    setNewSceneImage('');
    setNewSceneImageS3Key('');
    setNewSceneThemeId('');
    setNewSceneType('');
    setSceneImageUploadProgress(0);
    onClose();
  }, [onClose]);

  // Handle modal close
  const handleClose = useCallback(() => {
    resetModal();
  }, [resetModal]);

  if (!isOpen) return null;

  return (
    <>
      {/* Create Scene Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <h2 className="text-xl font-bold mb-4">{editingScene ? 'Edit Scene' : 'Create New Scene'}</h2>
          
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

            {/* Theme Selection */}
            <div>
              <label htmlFor="sceneTheme" className="block text-sm font-medium text-gray-700 mb-1">
                Theme
              </label>
              <select
                id="sceneTheme"
                value={newSceneThemeId}
                onChange={(e) => setNewSceneThemeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a theme (optional)</option>
                {availableThemes.map((theme) => (
                  <option key={theme.id} value={theme.id.toString()}>
                    {theme.name} {theme.theme_type && `(${theme.theme_type})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Scene Type Selection */}
            <div>
              <label htmlFor="sceneType" className="block text-sm font-medium text-gray-700 mb-1">
                Scene Type
              </label>
              <select
                id="sceneType"
                value={newSceneType}
                onChange={(e) => setNewSceneType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select scene type (optional)</option>
                {Object.values(SceneType).map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
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
                  {uploadingSceneImage ? 'Uploading...' : (editingScene ? 'Change Image' : 'Choose Image')}
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
              {(newSceneImage || (editingScene && editingScene.backgroundImage)) && (
                <div className="mt-3">
                  <img
                    src={newSceneImage || editingScene?.backgroundImage || ''}
                    alt="Scene preview"
                    className="w-full h-32 object-cover rounded-md border border-gray-300"
                  />
                  {editingScene && !newSceneImage && (
                    <p className="text-xs text-gray-500 mt-1">Current background image</p>
                  )}
                  {newSceneImage && editingScene && (
                    <p className="text-xs text-green-600 mt-1">New background image (click Update Scene to save)</p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Modal Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={createOrUpdateScene}
              disabled={!newSceneName.trim() || uploadingSceneImage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingScene ? 'Update Scene' : 'Create Scene'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for scene image upload */}
      <input
        id="sceneImageUpload"
        type="file"
        accept="image/*"
        onChange={handleSceneImageUpload}
        className="hidden"
      />
    </>
  );
}