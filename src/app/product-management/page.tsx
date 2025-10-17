'use client';

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  image: string | null;
  original_price: string | null; // Database returns as string
  discount_percentage: string | null; // Database returns as string
  created_at: string;
  updated_at: string;
}

interface ProductListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
}

interface EditProductModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
}

const AddProductModal = ({ isOpen, onClose, onSave }: AddProductModalProps) => {
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !imageFile) return;

    setIsLoading(true);

    try {
      // Upload image to S3 using dedicated product image upload endpoint
      const formData = new FormData();
      formData.append('file', imageFile);

      const uploadResponse = await fetch('/api/upload-product-image', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error('Image upload failed');
      }

      // Save product
      onSave({
        name,
        image: uploadData.data.url,
        original_price: originalPrice?.toString() || null,
        discount_percentage: discountPercentage?.toString() || null,
      });

      // Reset form
      setName('');
      setImageFile(null);
      setOriginalPrice(null);
      setDiscountPercentage(null);
    } catch (error) {
      console.error('Error creating product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Add New Product</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Original Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={originalPrice || ''}
                onChange={(e) => setOriginalPrice(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discountPercentage || ''}
                onChange={(e) => setDiscountPercentage(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !imageFile || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isLoading ? 'Creating...' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditProductModal = ({ isOpen, product, onClose, onSave }: EditProductModalProps) => {
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setOriginalPrice(product.original_price ? parseFloat(product.original_price) : null);
      setDiscountPercentage(product.discount_percentage ? parseFloat(product.discount_percentage) : null);
    }
  }, [product]);

  const handleSave = async () => {
    if (!name || !product) return;

    setIsLoading(true);

    try {
      let imageData = {
        image: product.image,
      };

      // Upload new image if provided
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        const uploadResponse = await fetch('/api/upload-product-image', {
          method: 'POST',
          body: formData,
        });

        const uploadDataResponse = await uploadResponse.json();

        if (!uploadDataResponse.success) {
          throw new Error('Image upload failed');
        }

        imageData = {
          image: uploadDataResponse.data.url,
        };
      }

      // Save updated product
      onSave({
        name,
        ...imageData,
        original_price: originalPrice?.toString() || null,
        discount_percentage: discountPercentage?.toString() || null,
      });

      setImageFile(null);
    } catch (error) {
      console.error('Error updating product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Edit Product</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Image
            </label>
            {product.image && (
              <div className="mb-2">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-20 h-20 object-cover border rounded"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Leave empty to keep current image</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Original Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={originalPrice || ''}
                onChange={(e) => setOriginalPrice(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discountPercentage || ''}
                onChange={(e) => setDiscountPercentage(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isLoading ? 'Updating...' : 'Update Product'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductList = ({ products, onEdit, onDelete }: ProductListProps) => {
    const formatPrice = (originalPrice: string | number | null, discountPercentage: string | number | null) => {
    if (!originalPrice) return 'N/A';
    
    const price = typeof originalPrice === 'string' ? parseFloat(originalPrice) : originalPrice;
    const discount = discountPercentage 
      ? (typeof discountPercentage === 'string' ? parseFloat(discountPercentage) : discountPercentage)
      : 0;
    
    if (discount > 0) {
      const discountedPrice = price * (1 - discount / 100);
      return (
        <div className="flex flex-col">
          <span className="line-through text-gray-500 text-sm">
            ${price.toFixed(2)}
          </span>
          <span className="font-semibold">
            ${discountedPrice.toFixed(2)}
          </span>
        </div>
      );
    }
    
    return (
      <span className="font-semibold">
        ${price.toFixed(2)}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
            {product.image ? (
              <img                
                src={product.image}
                alt={product.name}                
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span>No Image</span>
              </div>
            )}
          </div>
          
          <h3 className="font-medium text-gray-900 mb-2">{product.name}</h3>
          
          <div className="mb-3">
            {formatPrice(product.original_price, product.discount_percentage)}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(product)}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(product.id)}
              className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function ProductManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      const data = await response.json();

      if (data.success) {
        setProducts([...products, data.data]);
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  const handleEditProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editingProduct) return;

    try {
      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      const data = await response.json();

      if (data.success) {
        setProducts(products.map(p => 
          p.id === editingProduct.id ? data.data : p
        ));
        setShowEditModal(false);
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setProducts(products.filter(p => p.id !== productId));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowEditModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <p className="text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
            <p className="text-gray-600 mt-2">Manage your product catalog</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Add New Product
          </button>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No products found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Your First Product
            </button>
          </div>
        ) : (
          <ProductList
            products={products}
            onEdit={handleEdit}
            onDelete={handleDeleteProduct}
          />
        )}

        <AddProductModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddProduct}
        />

        <EditProductModal
          isOpen={showEditModal}
          product={editingProduct}
          onClose={() => {
            setShowEditModal(false);
            setEditingProduct(null);
          }}
          onSave={handleEditProduct}
        />
      </div>
    </div>
  );
}