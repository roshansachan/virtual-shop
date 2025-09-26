'use client';

import { useState, useRef } from 'react';
import { Theme, ThemeType, ThemeTypeValue } from '@/types';
import { generateS3Url } from '@/lib/s3-utils';

interface ThemeManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  themes: Theme[];
  onCreateTheme: (name: string, themeType: ThemeTypeValue | null, image?: string) => void;
  onDeleteTheme: (id: number) => void;
}

export default function ThemeManagementModal({
  isOpen,
  onClose,
  themes,
  onCreateTheme,
  onDeleteTheme
}: ThemeManagementModalProps) {
  const [showCreateTheme, setShowCreateTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [selectedThemeType, setSelectedThemeType] = useState<ThemeTypeValue | null>(ThemeType.CITY);
  const [themeImage, setThemeImage] = useState<string>(''); // For display purposes
  const [themeImageKey, setThemeImageKey] = useState<string>(''); // Store the S3 key
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get available theme type options from enum - only city now
  const themeTypeOptions = [
    { value: ThemeType.CITY, label: 'City' },
    { value: ThemeType.OCCASION, label: 'Occasion' }
  ];

  const handleCreateTheme = () => {
    if (newThemeName.trim()) {
      // Pass the S3 key instead of the full URL
      onCreateTheme(newThemeName.trim(), selectedThemeType, themeImageKey || undefined);
      setShowCreateTheme(false);
      setNewThemeName('');
      setSelectedThemeType(ThemeType.CITY);
      setThemeImage('');
      setThemeImageKey('');
      setUploadProgress(0);
    }
  };

  const cancelCreateTheme = () => {
    setShowCreateTheme(false);
    setNewThemeName('');
    setSelectedThemeType(ThemeType.CITY);
    setThemeImage('');
    setThemeImageKey('');
    setUploadProgress(0);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, WebP, or SVG)');
      return;
    }

    const maxSizeInMB = 5;
    if (file.size > maxSizeInMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeInMB}MB`);
      return;
    }

    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress for user feedback
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      const response = await fetch('/api/themes/upload-image', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const imageKey = result.data.key;
          setThemeImageKey(imageKey); // Store the S3 key
          setThemeImage(generateS3Url(imageKey)); // Generate URL from key for display
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      } else {
        const errorResult = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorResult.error || 'Server error');
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setThemeImage('');
      setUploadProgress(0);
    } finally {
      setUploadingImage(false);
    }
  };

  const formatThemeType = (themeType: ThemeTypeValue | null): string => {
    if (!themeType) return 'No Type';
    return themeTypeOptions.find(option => option.value === themeType)?.label || themeType;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Theme Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Themes Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Themes</h3>
              <button
                onClick={() => setShowCreateTheme(true)}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
              >
                Add Theme
              </button>
            </div>

            {/* Create Theme Form */}
            {showCreateTheme && (
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 mb-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        <div>
                            Theme type
                        </div>
                        
                        <div>
                            <select
                            value={selectedThemeType || ''}
                            onChange={(e) => setSelectedThemeType((e.target.value as ThemeTypeValue) || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >                    
                            {themeTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                            ))}
                            </select>
                        </div>
                    
                    </div>  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <div>Theme name</div>
                    <div>
                        <input
                        type="text"
                        value={newThemeName}
                        onChange={(e) => setNewThemeName(e.target.value)}
                        placeholder="Theme name (e.g., Mumbai, Delhi)..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    </div>
                  </div>

                  {/* Theme Image Upload */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <div>Theme image</div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 text-sm"
                        >
                          {uploadingImage ? 'Uploading...' : 'Choose Image'}
                        </button>
                        {uploadingImage && (
                          <div className="flex-1 max-w-xs">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 mt-1">{uploadProgress}%</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Image Preview */}
                      {themeImage && (
                        <div className="relative">
                          <img
                            src={themeImage}
                            alt="Theme preview"
                            className="w-full h-24 object-cover rounded-md border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => setThemeImage('')}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500">
                        Upload JPEG, PNG, GIF, WebP, or SVG (max 5MB)
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateTheme}
                      disabled={!newThemeName.trim()}
                      className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      Create
                    </button>
                    <button
                      onClick={cancelCreateTheme}
                      className="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Themes List */}
            <div className="space-y-2">
              {themes.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No themes created yet</p>
              ) : (
                themes.map((theme) => (
                  <div key={theme.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {/* Theme Image Thumbnail */}
                      {theme.image ? (
                        <img 
                          src={theme.image} 
                          alt={theme.name}
                          className="w-12 h-12 object-cover rounded border border-gray-300"                          
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No Image</span>
                        </div>
                      )}
                      
                      <div>
                        <div className="font-medium text-gray-900">{theme.name}</div>
                        <div className="text-sm text-gray-600">
                          Type: {formatThemeType(theme.theme_type)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onDeleteTheme(theme.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}