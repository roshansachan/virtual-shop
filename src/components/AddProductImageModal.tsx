'use client';

import { useState, useCallback } from 'react';
import { generateS3Url } from '@/lib/s3-utils';

interface AddProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductImageCreated: (productImage: { id: number; name: string; image: string }) => void;
  placementId: string;
  sceneId: string;
}

export default function AddProductImageModal({ isOpen, onClose, onProductImageCreated, placementId, sceneId }: AddProductImageModalProps) {
  // Product image creation state
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState('');
  const [productImageS3Key, setProductImageS3Key] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  // Handle product image upload
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingImage(true);
    setImageUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Use both placement ID and scene ID for the upload path
      formData.append('placementId', placementId);
      formData.append('sceneId', sceneId);

      // Upload to S3
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const imageKey = data.data.key;
        setProductImage(generateS3Url(imageKey)); // Generate URL from key for display
        setProductImageS3Key(imageKey); // Store the key for API calls
        setImageUploadProgress(100);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Product image upload failed:', errorData);
        throw new Error(`Upload failed: ${errorData.error || 'Server error'}`);
      }
    } catch (error) {
      console.error('Product image upload failed:', error);
      alert(`Failed to upload product image: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setUploadingImage(false);
    }
  }, [placementId, sceneId]);

  // Create new product image
  const createProductImage = useCallback(async () => {
    if (!productName.trim() || !productImageS3Key) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/placement-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placement_id: parseInt(placementId),
          name: productName.trim(),
          image: productImageS3Key, // Store S3 key
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Notify parent component
          onProductImageCreated({
            id: result.data.id,
            name: result.data.name,
            image: result.data.image, // Pass the raw image field from database
          });
          
          // Reset modal state and close
          resetModal();
        } else {
          throw new Error(result.error || 'Failed to create product image');
        }
      } else {
        const errorResult = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorResult.error || 'Failed to create product image');
      }
    } catch (error) {
      console.error('Error creating product image:', error);
      alert(`Failed to create product image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  }, [productName, productImageS3Key, placementId, onProductImageCreated]);

  // Reset all form fields
  const resetModal = useCallback(() => {
    setProductName('');
    setProductImage('');
    setProductImageS3Key('');
    setImageUploadProgress(0);
    onClose();
  }, [onClose]);

  // Handle modal close
  const handleClose = useCallback(() => {
    resetModal();
  }, [resetModal]);

  if (!isOpen) return null;

  return (
    <>
      {/* Add Product Image Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <h2 className="text-xl font-bold mb-4">Add Product Image</h2>
          
          <div className="space-y-4">
            {/* Product Name Input */}
            <div>
              <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-1">
                Product Name
              </label>
              <input
                id="productName"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter product name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Product Image Upload */}
            <div>
              <label htmlFor="productImage" className="block text-sm font-medium text-gray-700 mb-1">
                Product Image
              </label>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => document.getElementById('productImageUpload')?.click()}
                  disabled={uploadingImage}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 text-sm"
                >
                  {uploadingImage ? 'Uploading...' : 'Choose Image'}
                </button>
                {uploadingImage && (
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${imageUploadProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 mt-1">{imageUploadProgress}%</span>
                  </div>
                )}
              </div>
              
              {/* Product Image Preview */}
              {productImage && (
                <div className="mt-3">
                  <img
                    src={productImage}
                    alt="Product preview"
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
              onClick={createProductImage}
              disabled={!productName.trim() || !productImageS3Key || uploadingImage || isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Adding...' : 'Add Product'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for product image upload */}
      <input
        id="productImageUpload"
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </>
  );
}