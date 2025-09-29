'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { generateS3Url } from '@/lib/s3-utils';

interface StoryItem {
  id: string;
  title: string;
  description: string;
  media?: {
    type: 'image' | 'video';
    s3Key: string;
  };
}

interface ArtStory {
  id: number;
  title: string;
  stories: StoryItem[];
}

export default function ManageArtStories() {
  const [stories, setStories] = useState<ArtStory[]>([]);
  const [selectedStory, setSelectedStory] = useState<ArtStory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingNew, setIsEditingNew] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [uploadingItems, setUploadingItems] = useState<Set<string>>(new Set());

  // Fetch stories from database
  const fetchStories = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/art-stories');
      const result = await response.json();
      
      if (result.success) {
        setStories(result.data);
      } else {
        console.error('Failed to fetch stories:', result.error);
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load stories on component mount
  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Show new story editor
  const handleShowNewStoryEditor = useCallback(() => {
    // Create a temporary new story object for editing
    const tempStory: ArtStory = {
      id: 0, // Temporary ID
      title: '',
      stories: []
    };
    setSelectedStory(tempStory);
    setIsEditingNew(true);
    setHasUnsavedChanges(false);
  }, []);

  // Select story for editing
  const handleSelectStory = useCallback((story: ArtStory) => {
    setSelectedStory(story);
    setIsEditingNew(false);
    setHasUnsavedChanges(false);
  }, []);

  // Save changes to existing story
  const handleSaveChanges = useCallback(async () => {
    if (!selectedStory || isEditingNew) return;
    
    try {
      setIsSaving(true);
      const response = await fetch('/api/art-stories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedStory.id,
          title: selectedStory.title,
          stories: selectedStory.stories
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const updatedStory = result.data;
        setStories(prev => prev.map(story => 
          story.id === selectedStory.id ? updatedStory : story
        ));
        setSelectedStory(updatedStory);
        setHasUnsavedChanges(false);
      } else {
        console.error('Failed to save changes:', result.error);
        alert('Failed to save changes. Please try again.');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Error saving changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [selectedStory, isEditingNew]);

  // Save new story to database
  const handleSaveNewStory = useCallback(async (title: string) => {
    if (!title.trim()) {
      alert('Please enter a story title before saving');
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch('/api/art-stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          stories: selectedStory?.stories || []
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const newStory = result.data;
        setStories(prev => [newStory, ...prev]);
        setSelectedStory(newStory);
        setIsEditingNew(false);
      } else {
        console.error('Failed to create story:', result.error);
        alert('Failed to create story. Please try again.');
      }
    } catch (error) {
      console.error('Error creating story:', error);
      alert('Error creating story. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [selectedStory]);

  // Update story title (local only)
  const handleUpdateStoryTitle = useCallback((title: string) => {
    if (!selectedStory) return;
    
    if (isEditingNew) {
      // For new stories, just update the temporary title
      setSelectedStory(prev => prev ? { ...prev, title } : null);
    } else {
      // For existing stories, update locally and mark as unsaved
      setSelectedStory(prev => prev ? { ...prev, title } : null);
      setHasUnsavedChanges(true);
    }
  }, [selectedStory, isEditingNew]);

  // Add item (local only)
  const handleAddItem = useCallback(() => {
    if (!selectedStory) return;
    
    const newItem: StoryItem = {
      id: Date.now().toString(),
      title: '',
      description: ''
    };
    
    const updatedStories = [...selectedStory.stories, newItem];
    setSelectedStory(prev => prev ? { ...prev, stories: updatedStories } : null);
    
    if (!isEditingNew) {
      setHasUnsavedChanges(true);
    }
  }, [selectedStory, isEditingNew]);

  // Update item (local only)
  const handleUpdateItem = useCallback((itemId: string, updates: Partial<StoryItem>) => {
    if (!selectedStory) return;
    
    const updatedStories = selectedStory.stories.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    );
    
    setSelectedStory(prev => prev ? { ...prev, stories: updatedStories } : null);
    
    if (!isEditingNew) {
      setHasUnsavedChanges(true);
    }
  }, [selectedStory, isEditingNew]);

  // Delete item (local only)
  const handleDeleteItem = useCallback((itemId: string) => {
    if (!selectedStory) return;
    
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }
    
    const updatedStories = selectedStory.stories.filter(item => item.id !== itemId);
    setSelectedStory(prev => prev ? { ...prev, stories: updatedStories } : null);
    
    if (!isEditingNew) {
      setHasUnsavedChanges(true);
    }
  }, [selectedStory, isEditingNew]);

  // Handle media upload to S3
  const handleMediaUpload = useCallback(async (itemId: string, file: File) => {
    if (!selectedStory) return;
    
    try {
      // Add item to uploading set
      setUploadingItems(prev => new Set(prev).add(itemId));
      
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storyId', selectedStory.id.toString());
      formData.append('itemId', itemId);
      
      // Upload to S3
      const response = await fetch('/api/art-stories/upload-media', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Update the item with only the S3 key
        handleUpdateItem(itemId, {
          media: {
            type: result.data.mediaType,
            s3Key: result.data.key
          }
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      alert(`Failed to upload media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Remove item from uploading set
      setUploadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }, [selectedStory, handleUpdateItem]);

  // Delete story
  const handleDeleteStory = useCallback(async (storyId: number) => {
    if (!confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/art-stories?id=${storyId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStories(prev => prev.filter(story => story.id !== storyId));
        if (selectedStory?.id === storyId) {
          setSelectedStory(null);
          setIsCreating(false);
        }
      } else {
        console.error('Failed to delete story:', result.error);
        alert('Failed to delete story. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      alert('Error deleting story. Please try again.');
    }
  }, [selectedStory]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Art Stories</h1>
              <p className="mt-1 text-gray-600">Create and manage immersive art stories with multiple media items</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleShowNewStoryEditor}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                + New Story
              </button>
              <Link
                href="/design-studio"
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Back to Studio
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stories List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Stories</h2>
              </div>
              <div className="p-4">
                {isLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading stories...</p>
                  </div>
                ) : stories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No stories created yet</p>
                    <button
                      onClick={handleShowNewStoryEditor}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Create Your First Story
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stories.map((story) => (
                      <div
                        key={story.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedStory?.id === story.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleSelectStory(story)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{story.title}</h3>
                            <p className="text-sm text-gray-500">{story.stories.length} items</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStory(story.id);
                            }}
                            className="ml-2 text-red-600 hover:text-red-800"
                            title="Delete story"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Story Editor */}
          <div className="lg:col-span-2">
            {selectedStory ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <input
                    type="text"
                    value={selectedStory.title}
                    onChange={(e) => {
                      handleUpdateStoryTitle(e.target.value);
                    }}
                    className="text-2xl font-bold text-gray-900 w-full border-none outline-none focus:ring-0 p-0"
                    placeholder={isEditingNew ? "Enter story title..." : "Story Title"}
                  />
                  <p className="text-gray-600 mt-2">
                    {isEditingNew ? "Enter a title and click 'Create Story' to save" : "Create a compelling story with multiple images and videos"}
                  </p>
                  
                  {/* Simple always-visible submit button */}
                  <div className="mt-4 flex items-center space-x-3">
                    {!isEditingNew && hasUnsavedChanges && (
                      <span className="text-sm text-amber-600 font-medium">● Unsaved changes</span>
                    )}
                    <button
                      onClick={isEditingNew ? () => handleSaveNewStory(selectedStory.title) : handleSaveChanges}
                      disabled={(isEditingNew && !selectedStory.title.trim()) || isSaving || isCreating}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isEditingNew ? (isCreating ? 'Creating...' : 'Submit Story') : (isSaving ? 'Saving...' : 'Submit Changes')}
                    </button>
                    {isEditingNew && (
                      <button
                        onClick={() => {
                          setSelectedStory(null);
                          setIsEditingNew(false);
                        }}
                        disabled={isCreating}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {/* Story Items */}
                  <div className="space-y-6">
                    {selectedStory.stories.map((item, index) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-medium text-gray-900">
                            Item {index + 1}
                          </h3>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete item"
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Media Upload */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Image/Video
                            </label>
                            {item.media ? (
                              <div className="relative">
                                {item.media.type === 'image' ? (
                                  <img
                                    src={generateS3Url(item.media.s3Key)}
                                    alt="Story item"
                                    className="w-full h-48 object-cover rounded-lg"
                                  />
                                ) : (
                                  <video
                                    src={generateS3Url(item.media.s3Key)}
                                    className="w-full h-48 object-cover rounded-lg"
                                    controls
                                  />
                                )}
                                <button
                                  onClick={() => handleUpdateItem(item.id, { media: undefined })}
                                  className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                                  title="Remove media"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : uploadingItems.has(item.id) ? (
                              <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
                                <div className="text-blue-600 mb-2 text-2xl">📤</div>
                                <p className="text-sm text-blue-600 font-medium">Uploading to S3...</p>
                                <div className="mt-2 w-full bg-blue-100 rounded-full h-2">
                                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                                </div>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleMediaUpload(item.id, file);
                                    }
                                  }}
                                  disabled={uploadingItems.has(item.id)}
                                  className="hidden"
                                  id={`media-${item.id}`}
                                />
                                <label
                                  htmlFor={`media-${item.id}`}
                                  className={`cursor-pointer ${uploadingItems.has(item.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <div className="text-gray-400 mb-2">📁</div>
                                  <div className="text-sm text-gray-600">
                                    Click to upload image or video
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>

                          {/* Text Content */}
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title
                              </label>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Item title"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                              </label>
                              <textarea
                                value={item.description}
                                onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Describe this item..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add Item Button */}
                    <button
                      onClick={handleAddItem}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
                    >
                      + Add New Item
                    </button>
                    
                    {/* Submit button at bottom for better UX */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center justify-center space-x-3">
                        {!isEditingNew && hasUnsavedChanges && (
                          <span className="text-sm text-amber-600 font-medium">● Unsaved changes</span>
                        )}
                        <button
                          onClick={isEditingNew ? () => handleSaveNewStory(selectedStory.title) : handleSaveChanges}
                          disabled={(isEditingNew && !selectedStory.title.trim()) || isSaving || isCreating}
                          className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {isEditingNew ? (isCreating ? 'Creating...' : 'Submit Story') : (isSaving ? 'Saving...' : 'Submit Changes')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-400 mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a Story to Edit
                </h3>
                <p className="text-gray-600 mb-6">
                  Choose a story from the list or create a new one to get started
                </p>
                <button
                  onClick={handleShowNewStoryEditor}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create New Story
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}