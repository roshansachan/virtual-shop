'use client';

import { useState, useCallback, useEffect } from 'react';

interface ArtStory {
  id: number;
  title: string;
  stories: any[];
}

interface PlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  spaceId: string;
  // Edit mode props
  editMode?: boolean;
  existingPlacement?: {
    id: string;
    dbId: string;
    name: string;
    art_story_id?: number | null;
  } | null;
}

export default function PlacementModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  spaceId,
  editMode = false,
  existingPlacement = null
}: PlacementModalProps) {
  const [placementName, setPlacementName] = useState('');
  const [selectedArtStoryId, setSelectedArtStoryId] = useState<number | null>(null);
  const [artStories, setArtStories] = useState<ArtStory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingArtStories, setLoadingArtStories] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editMode && existingPlacement) {
        setPlacementName(existingPlacement.name);
        // Handle case where art_story_id might be undefined or missing
        const artStoryId = existingPlacement.art_story_id ?? null;
        setSelectedArtStoryId(artStoryId);
      } else {
        setPlacementName('');
        setSelectedArtStoryId(null);
      }
      fetchArtStories();
    } else {
      setPlacementName('');
      setSelectedArtStoryId(null);
      setArtStories([]);
    }
  }, [isOpen, editMode, existingPlacement]);

  // Fetch art stories for dropdown
  const fetchArtStories = useCallback(async () => {
    setLoadingArtStories(true);
    try {
      const response = await fetch('/api/art-stories');
      const data = await response.json();
      
      if (data.success) {
        setArtStories(data.data || []);
      } else {
        console.error('Failed to fetch art stories:', data.error);
      }
    } catch (error) {
      console.error('Error fetching art stories:', error);
    } finally {
      setLoadingArtStories(false);
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!placementName.trim()) {
      alert('Please enter a placement name');
      return;
    }

    setIsLoading(true);
    try {
      let response;
      
      if (editMode && existingPlacement) {
        // Update existing placement
        response = await fetch(`/api/placements/${existingPlacement.dbId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: placementName.trim(),
            art_story_id: selectedArtStoryId
          }),
        });
      } else {
        // Create new placement
        response = await fetch('/api/placements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            space_id: parseInt(spaceId),
            name: placementName.trim(),
            art_story_id: selectedArtStoryId
          }),
        });
      }

      const data = await response.json();
      
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        alert(`Failed to ${editMode ? 'update' : 'create'} placement: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error ${editMode ? 'updating' : 'creating'} placement:`, error);
      alert(`Failed to ${editMode ? 'update' : 'create'} placement. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [placementName, selectedArtStoryId, spaceId, editMode, existingPlacement, onSuccess, onClose]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [handleSubmit, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold mb-4">
          {editMode ? 'Edit Placement' : 'Create New Placement'}
        </h2>

        <div className="space-y-4">
          {/* Placement Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Placement Name
            </label>
            <input
              type="text"
              value={placementName}
              onChange={(e) => setPlacementName(e.target.value)}
              placeholder="Enter placement name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={handleKeyPress}
              autoFocus
            />
          </div>

          {/* Art Story Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Art Story (Optional)
            </label>
            {loadingArtStories ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                Loading art stories...
              </div>
            ) : (
              <select
                value={selectedArtStoryId || ''}
                onChange={(e) => setSelectedArtStoryId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loadingArtStories}
              >
                <option value="">Select an art story...</option>
                {artStories.map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title || `Art Story ${story.id}`}
                  </option>
                ))}
              </select>
            )}
            {artStories.length === 0 && !loadingArtStories && (
              <p className="text-sm text-gray-500 mt-1">
                No art stories available. Create some art stories first.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !placementName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : (editMode ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}