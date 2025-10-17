'use client';

import React, { useState, useCallback } from 'react';
import { generateS3Url } from '@/lib/s3-utils';
import { Space } from '@/types';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpaceCreated: (space: Space) => void;
  currentSceneId: string;
  currentSceneDbId?: string; // Database ID of the current scene
  editingSpace?: {
    id: string;
    dbId: string;
    name: string;
    image?: string;
    imageS3Key?: string;
  } | null;
}

export default function CreateSpaceModal({ isOpen, onClose, onSpaceCreated, currentSceneId, currentSceneDbId, editingSpace }: CreateSpaceModalProps) {
  // Space creation/editing state
  const [newSpaceName, setNewSpaceName] = useState(editingSpace?.name || '');
  const [newSpaceImage, setNewSpaceImage] = useState(editingSpace?.image || '');
  const [newSpaceImageS3Key, setNewSpaceImageS3Key] = useState(editingSpace?.imageS3Key || '');
  const [uploadingSpaceImage, setUploadingSpaceImage] = useState(false);
  const [spaceImageUploadProgress, setSpaceImageUploadProgress] = useState(0);
  
  // Update state when editingSpace changes
  React.useEffect(() => {
    if (editingSpace) {
      setNewSpaceName(editingSpace.name);
      setNewSpaceImage(editingSpace.image || '');
      setNewSpaceImageS3Key(editingSpace.imageS3Key || '');
    } else {
      setNewSpaceName('');
      setNewSpaceImage('');
      setNewSpaceImageS3Key('');
    }
  }, [editingSpace]);

  // Handle space image upload
  const handleSpaceImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, WebP, or SVG)');
      return;
    }

    const maxSizeInMB = 10;
    if (file.size > maxSizeInMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeInMB}MB`);
      return;
    }

    setUploadingSpaceImage(true);
    setSpaceImageUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Generate a temporary space ID for the upload path
      const tempSpaceId = `temp-space-${Date.now()}`;
      formData.append('spaceId', tempSpaceId);

      // Upload to S3 (we'll need to create this endpoint)
      const response = await fetch('/api/upload-space-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const imageKey = data.data.key;
        setNewSpaceImage(generateS3Url(imageKey)); // Generate URL from key for display
        setNewSpaceImageS3Key(imageKey); // Store the key for API calls
        setSpaceImageUploadProgress(100);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Space image upload failed:', errorData);
        throw new Error(`Upload failed: ${errorData.error || 'Server error'}`);
      }
    } catch (error) {
      console.error('Space image upload failed:', error);
      alert(`Failed to upload space image: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setUploadingSpaceImage(false);
    }
  }, []);

  // Create or update space
  const createOrUpdateSpace = useCallback(async () => {
    if (!newSpaceName.trim()) return;
    
    try {
      if (editingSpace) {
        // Update existing space
        const response = await fetch('/api/spaces', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: parseInt(editingSpace.dbId),
            name: newSpaceName.trim(),
            image: newSpaceImageS3Key || null,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Create updated space object for frontend state
            const updatedSpace: Space = {
              id: editingSpace.id,
              name: newSpaceName.trim(),
              expanded: false,
              visible: true,
              placements: [], // Will be preserved by parent component
              image: newSpaceImage || undefined,
              imageS3Key: newSpaceImageS3Key || undefined,
              dbId: editingSpace.dbId,
            };
            
            // Notify parent component
            onSpaceCreated(updatedSpace);
            
            // Reset modal state and close
            resetModal();
          } else {
            throw new Error(result.error || 'Failed to update space');
          }
        } else {
          const errorResult = await response.json().catch(() => ({ error: 'Server error' }));
          throw new Error(errorResult.error || 'Failed to update space');
        }
      } else {
        // Create new space
        // Check if we have a scene database ID
        if (!currentSceneDbId) {
          throw new Error('Scene is not saved to database yet. Please save the scene first.');
        }

        const response = await fetch('/api/spaces', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scene_id: parseInt(currentSceneDbId),
            name: newSpaceName.trim(),
            image: newSpaceImageS3Key || null,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Create space object for frontend state management
            const newSpace: Space = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: newSpaceName.trim(),
              expanded: false,
              visible: true,
              placements: [],
              image: newSpaceImage || undefined,
              imageS3Key: newSpaceImageS3Key || undefined,
              dbId: result.data.id.toString(),
            };
            
            // Notify parent component
            onSpaceCreated(newSpace);
            
            // Reset modal state and close
            resetModal();
          } else {
            throw new Error(result.error || 'Failed to create space');
          }
        } else {
          const errorResult = await response.json().catch(() => ({ error: 'Server error' }));
          throw new Error(errorResult.error || 'Failed to create space');
        }
      }
    } catch (error) {
      console.error('Error saving space:', error);
      alert(`Failed to ${editingSpace ? 'update' : 'create'} space: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [newSpaceName, newSpaceImage, newSpaceImageS3Key, currentSceneDbId, editingSpace, onSpaceCreated]);

  // Reset all form fields
  const resetModal = useCallback(() => {
    setNewSpaceName('');
    setNewSpaceImage('');
    setNewSpaceImageS3Key('');
    setSpaceImageUploadProgress(0);
    onClose();
  }, [onClose]);

  // Handle modal close
  const handleClose = useCallback(() => {
    resetModal();
  }, [resetModal]);

  if (!isOpen) return null;

  return (
    <>
      {/* Create Space Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <h2 className="text-xl font-bold mb-4">{editingSpace ? 'Edit Space' : 'Create New Space'}</h2>
          
          <div className="space-y-4">
            {/* Space Name Input */}
            <div>
              <label htmlFor="spaceName" className="block text-sm font-medium text-gray-700 mb-1">
                Space Name
              </label>
              <input
                id="spaceName"
                type="text"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Enter space name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Space Image Upload */}
            <div>
              <label htmlFor="spaceImage" className="block text-sm font-medium text-gray-700 mb-1">
                Space Image (Optional)
              </label>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => document.getElementById('spaceImageUpload')?.click()}
                  disabled={uploadingSpaceImage}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 text-sm"
                >
                  {uploadingSpaceImage ? 'Uploading...' : 'Choose Image'}
                </button>
                {uploadingSpaceImage && (
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${spaceImageUploadProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 mt-1">{spaceImageUploadProgress}%</span>
                  </div>
                )}
              </div>
              
              {/* Space Image Preview */}
              {newSpaceImage && (
                <div className="mt-3">
                  <img
                    src={newSpaceImage}
                    alt="Space preview"
                    className="w-full h-32 object-cover rounded-md border border-gray-300"
                  />
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
              onClick={createOrUpdateSpace}
              disabled={!newSpaceName.trim() || uploadingSpaceImage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingSpace ? 'Update Space' : 'Create Space'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for space image upload */}
      <input
        id="spaceImageUpload"
        type="file"
        accept="image/*"
        onChange={handleSpaceImageUpload}
        className="hidden"
      />
    </>
  );
}