'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, X, Package, Tag, DollarSign, Filter, Save } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';

export default function ProductSelectionModal({ isOpen, onClose, onAddItem, onEditItem, onDeleteItem }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    price: '',
    description: '',
    categoryId: null,
    active: true
  });

  const pageSize = 10;

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, currentPage, searchTerm]);

  async function loadProducts() {
    try {
      setLoading(true);
      const response = await invoiceService.getProducts({
        q: searchTerm,
        page: currentPage,
        size: pageSize,
        active: true
      });
      
      setProducts(response.content || []);
      setTotalPages(response.totalPages || 0);
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProduct() {
    if (!formData.name.trim() || !formData.price) {
      alert('Please fill in product name and price');
      return;
    }

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price)
      };

      if (editingProduct) {
        // Update existing product
        await invoiceService.updateProduct(editingProduct.id, productData);
      } else {
        // Create new product
        await invoiceService.createProduct(productData);
      }

      // Reset form and reload products
      setFormData({
        name: '',
        code: '',
        price: '',
        description: '',
        categoryId: null,
        active: true
      });
      setShowAddForm(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('Failed to save product. Please try again.');
    }
  }

  async function handleDeleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await invoiceService.deleteProduct(productId);
      loadProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product. Please try again.');
    }
  }

  function handleSelectProduct(product) {
    const itemData = {
      name: product.name,
      rate: product.price || 0,
      qty: 1,
      description: product.description || ''
    };
    
    // Calculate GST if enabled (18% total, 9% CGST, 9% SGST)
    const amount = itemData.rate * itemData.qty;
    const cgst = amount * 0.09;
    const sgst = amount * 0.09;
    const total = amount + cgst + sgst;
    
    // Add calculated values to the item
    itemData.amount = amount;
    itemData.cgst = cgst;
    itemData.sgst = sgst;
    itemData.total = total;
    
    onAddItem(itemData);
    onClose();
  }

  function handleEditProduct(product) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      code: product.code || '',
      price: product.price?.toString() || '',
      description: product.description || '',
      categoryId: product.categoryId,
      active: product.active !== false
    });
    setShowAddForm(true);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Background blur */}
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8" />
                <div>
                  <h2 className="text-2xl font-bold">Product Selection</h2>
                  <p className="text-indigo-100">Select or manage products for your invoice</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="p-6 border-b">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              {/* Add Product Button */}
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                Add Product
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-indigo-300 scrollbar-track-gray-100" style={{ maxHeight: 'calc(90vh - 280px)' }}>
            {showAddForm ? (
              /* Add/Edit Product Form */
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter product name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Code
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter product code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={formData.active}
                        onChange={(e) => setFormData({...formData, active: e.target.value === 'true'})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      rows={3}
                      placeholder="Enter product description"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      {editingProduct ? 'Update' : 'Save'} Product
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingProduct(null);
                        setFormData({
                          name: '',
                          code: '',
                          price: '',
                          description: '',
                          categoryId: null,
                          active: true
                        });
                      }}
                      className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Product List */
              <div className="space-y-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No products found</p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Add your first product
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                                {product.code && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-lg">
                                    {product.code}
                                  </span>
                                )}
                                {product.active === false && (
                                  <span className="px-2 py-1 bg-red-100 text-red-600 text-sm rounded-lg">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              {product.description && (
                                <p className="text-gray-600 text-sm mb-2">{product.description}</p>
                              )}
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1 text-green-600 font-semibold">
                                  <DollarSign className="h-4 w-4" />
                                  {product.price ? parseFloat(product.price).toFixed(2) : '0.00'}
                                </div>
                                {product.category && (
                                  <span className="text-sm text-gray-500">
                                    <Tag className="h-3 w-3 inline mr-1" />
                                    {product.category.name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSelectProduct(product)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                                Add to Invoice
                              </button>
                              <button
                                onClick={() => handleEditProduct(product)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex justify-center gap-2 mt-6">
                        <button
                          onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                          disabled={currentPage === 0}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="px-4 py-2 text-gray-600">
                          Page {currentPage + 1} of {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                          disabled={currentPage === totalPages - 1}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
