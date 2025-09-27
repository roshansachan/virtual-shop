'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { generateS3Url } from '@/lib/s3-utils';

interface Product {
  id: string;
  name: string;
  image: string | null;
  original_price: string | null;
  discount_percentage: string | null;
  created_at: string;
  updated_at: string;
}

interface AddProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductImageCreated: (productImage: { id: number; name: string; image: string }) => void;
  placementId: string;
  sceneId: string;
  // Edit mode props
  editMode?: boolean;
  existingPlacementImage?: {
    id: number;
    name: string;
    image: string;
    product_id?: string | number | null;
  } | null;
}

export default function AddProductImageModal({ 
  isOpen, 
  onClose, 
  onProductImageCreated, 
  placementId, 
  sceneId,
  editMode = false,
  existingPlacementImage = null
}: AddProductImageModalProps) {
  // Product image creation state
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState('');
  const [productImageS3Key, setProductImageS3Key] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  // Product assignment state
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch products when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  // Populate form when in edit mode
  useEffect(() => {
    if (editMode && existingPlacementImage && products.length > 0) {
      setProductName(existingPlacementImage.name);
      // For edit mode, we already have the image - set it directly
      setProductImage(existingPlacementImage.image.includes('http') 
        ? existingPlacementImage.image 
        : generateS3Url(existingPlacementImage.image)
      );
      setProductImageS3Key(existingPlacementImage.image);
      
      // Find and set the selected product if product_id exists
      if (existingPlacementImage.product_id) {
        const product = products.find(p => p.id === String(existingPlacementImage.product_id));
        if (product) {
          setSelectedProduct(product);
        }
      }
    } else if (!editMode) {
      // Reset form for create mode
      setProductName('');
      setProductImage('');
      setProductImageS3Key('');
      setSelectedProduct(null);
    }
  }, [editMode, existingPlacementImage, products]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };

    if (showProductDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductDropdown]);

  // Format price display like in product management
  const formatPrice = (originalPrice: string | number | null, discountPercentage: string | number | null) => {
    if (!originalPrice) return 'N/A';
    
    const price = typeof originalPrice === 'string' ? parseFloat(originalPrice) : originalPrice;
    const discount = discountPercentage 
      ? (typeof discountPercentage === 'string' ? parseFloat(discountPercentage) : discountPercentage)
      : 0;
    
    if (discount > 0) {
      const discountedPrice = price * (1 - discount / 100);
      return `$${discountedPrice.toFixed(2)} (was $${price.toFixed(2)})`;
    }
    
    return `$${price.toFixed(2)}`;
  };

  // Fetch available products
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setProducts(result.data);
        } else {
          console.error('Failed to fetch products:', result.error);
        }
      } else {
        console.error('Failed to fetch products: HTTP', response.status);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

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

  // Create or update placement image
  const createOrUpdatePlacementImage = useCallback(async () => {
    if (!productName.trim() || !productImageS3Key) return;
    
    setIsCreating(true);
    try {
      let response;
      
      if (editMode && existingPlacementImage) {
        // Update existing placement image
        response = await fetch(`/api/placement-images/${existingPlacementImage.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: productName.trim(),
            image: productImageS3Key,
            product_id: selectedProduct ? parseInt(selectedProduct.id) : null,
          }),
        });
      } else {
        // Create new placement image
        response = await fetch('/api/placement-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            placement_id: parseInt(placementId),
            name: productName.trim(),
            image: productImageS3Key,
            product_id: selectedProduct ? parseInt(selectedProduct.id) : null,
          }),
        });
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Notify parent component
          onProductImageCreated({
            id: result.data.id,
            name: result.data.name,
            image: result.data.image,
          });
          
          // Reset modal state and close
          resetModal();
        } else {
          throw new Error(result.error || `Failed to ${editMode ? 'update' : 'create'} product image`);
        }
      } else {
        const errorResult = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorResult.error || `Failed to ${editMode ? 'update' : 'create'} product image`);
      }
    } catch (error) {
      console.error(`Error ${editMode ? 'updating' : 'creating'} product image:`, error);
      alert(`Failed to ${editMode ? 'update' : 'create'} product image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  }, [productName, productImageS3Key, placementId, selectedProduct, editMode, existingPlacementImage, onProductImageCreated]);

  // Reset all form fields
  const resetModal = useCallback(() => {
    setProductName('');
    setProductImage('');
    setProductImageS3Key('');
    setImageUploadProgress(0);
    setSelectedProduct(null);
    setShowProductDropdown(false);
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
          <h2 className="text-xl font-bold mb-4">
            {editMode ? 'Edit Product Image' : 'Add Product Image'}
          </h2>
          
          <div className="space-y-4">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign to Product (Optional)
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowProductDropdown(!showProductDropdown)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingProducts}
                >
                  {selectedProduct ? (
                    <div className="flex items-center gap-2">
                      {selectedProduct.image && (
                        <img
                          src={selectedProduct.image}
                          alt={selectedProduct.name}
                          className="w-6 h-6 object-cover rounded"
                        />
                      )}
                      <span className="truncate">{selectedProduct.name}</span>
                      <span className="text-sm text-gray-500">
                        {formatPrice(selectedProduct.original_price, selectedProduct.discount_percentage)}
                      </span>
                    </div>
                  ) : loadingProducts ? (
                    <span className="text-gray-500">Loading products...</span>
                  ) : (
                    <span className="text-gray-500">Select a product (optional)</span>
                  )}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Product Dropdown */}
                {showProductDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {/* Clear selection option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setShowProductDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-500 border-b border-gray-200"
                    >
                      No product assignment
                    </button>
                    
                    {products.length === 0 && !loadingProducts ? (
                      <div className="px-3 py-2 text-gray-500 text-sm">
                        No products available. Create products in Product Management first.
                      </div>
                    ) : (
                      products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowProductDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                        >
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-10 h-10 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-400 text-xs">No img</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-sm text-gray-600">
                              {formatPrice(product.original_price, product.discount_percentage)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedProduct && (
                <p className="text-xs text-gray-500 mt-1">
                  This placement image will be linked to {selectedProduct.name}
                </p>
              )}
            </div>

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
                  {uploadingImage ? 'Uploading...' : editMode ? 'Change Image' : 'Choose Image'}
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
                  {editMode && (
                    <p className="text-xs text-gray-500 mt-1">
                      Current image. Click ${`"Change Image"`} to upload a new one.
                    </p>
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
              onClick={createOrUpdatePlacementImage}
              disabled={!productName.trim() || !productImageS3Key || uploadingImage || isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? `${editMode ? 'Updating' : 'Adding'}...` : `${editMode ? 'Update' : 'Add'} Product`}
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