import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, X, Loader2 } from 'lucide-react';
import { productsAPI, rawMaterialsAPI } from '../services/api';

interface Product {
  product_id: number;
  name: string;
  standard_size: string;
  base_price: string | number;
  raw_material_id?: number;
  amount_per_unit?: number;
  materials?: { raw_material_id: number; amount_per_unit: number }[];
}

interface RawMaterial {
  material_id: number;
  material_name: string;
  unit: string;
}

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    standard_size: '',
    base_price: '',
    // legacy single material fields retained for backward compatibility
    raw_material_id: '',
    amount_per_unit: '',
    // new multi-materials
    materials: [{ raw_material_id: '', amount_per_unit: '' } as { raw_material_id: string; amount_per_unit: string }],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load products on component mount
  useEffect(() => {
    loadProducts();
    loadRawMaterials();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await productsAPI.getAll();
      setProducts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadRawMaterials = async () => {
    try {
      const response = await rawMaterialsAPI.getAll();
      setRawMaterials(response.data);
    } catch (err) {
      console.error('Failed to load raw materials:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadProducts();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await productsAPI.search(searchQuery);
      setProducts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setFormData({ name: '', standard_size: '', base_price: '', raw_material_id: '', amount_per_unit: '', materials: [{ raw_material_id: '', amount_per_unit: '' }] });
    setShowModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      standard_size: product.standard_size,
      base_price: Number(product.base_price).toString(),
      raw_material_id: product.raw_material_id?.toString() || '',
      amount_per_unit: product.amount_per_unit?.toString() || '',
      materials: (product.materials && product.materials.length > 0)
        ? product.materials.map(m => ({ raw_material_id: String(m.raw_material_id), amount_per_unit: String(m.amount_per_unit) }))
        : [{ raw_material_id: product.raw_material_id ? String(product.raw_material_id) : '', amount_per_unit: product.amount_per_unit ? String(product.amount_per_unit) : '' }],
    });
    setShowModal(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await productsAPI.delete(id);
        setProducts(products.filter(product => product.product_id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete product');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: any = {
        name: formData.name,
        standard_size: formData.standard_size,
        base_price: parseFloat(formData.base_price),
      };

      // Include multi materials
      const cleanedMaterials = (formData.materials || [])
        .filter(m => m.raw_material_id && m.amount_per_unit)
        .map(m => ({ raw_material_id: parseInt(m.raw_material_id), amount_per_unit: parseFloat(m.amount_per_unit) }));
      if (cleanedMaterials.length > 0) {
        payload.materials = cleanedMaterials;
        // also fill legacy fields with first item for backward compatibility
        payload.raw_material_id = cleanedMaterials[0].raw_material_id;
        payload.amount_per_unit = cleanedMaterials[0].amount_per_unit;
      } else {
        payload.raw_material_id = formData.raw_material_id ? parseInt(formData.raw_material_id) : null;
        payload.amount_per_unit = formData.amount_per_unit ? parseFloat(formData.amount_per_unit) : null;
      }

      if (editingProduct) {
        // Update existing product
        const response = await productsAPI.update(editingProduct.product_id, payload);
        setProducts(products.map(product => 
          product.product_id === editingProduct.product_id ? response.data : product
        ));
      } else {
        // Add new product
        const response = await productsAPI.create(payload);
        setProducts([response.data, ...products]);
      }
      setShowModal(false);
      setFormData({ name: '', standard_size: '', base_price: '', raw_material_id: '', amount_per_unit: '', materials: [{ raw_material_id: '', amount_per_unit: '' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Manage Products</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full sm:w-auto pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button 
            onClick={handleAddProduct}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Standard Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Raw Materials</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                      <span className="text-gray-600">Loading products...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.product_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.product_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {product.standard_size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      ETB {Number(product.base_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {(product.materials && product.materials.length > 0)
                        ? product.materials.map((m, idx) => {
                            const rm = rawMaterials.find(r => r.material_id === m.raw_material_id);
                            return (
                              <div key={idx}>
                                {rm ? rm.material_name : `#${m.raw_material_id}`} - {m.amount_per_unit} {rm?.unit || ''}
                              </div>
                            );
                          })
                        : (product.raw_material_id
                            ? `${rawMaterials.find(rm => rm.material_id === product.raw_material_id)?.material_name || 'Unknown'} - ${product.amount_per_unit} ${rawMaterials.find(rm => rm.material_id === product.raw_material_id)?.unit || ''}`
                            : 'Not specified')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button 
                        onClick={() => handleEditProduct(product)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.product_id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Standard Size
                </label>
                <input
                  type="text"
                  value={formData.standard_size}
                  onChange={(e) => setFormData({ ...formData, standard_size: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">ETB</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                    className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Multi raw materials */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Raw Materials</label>
                <div className="space-y-3">
                  {formData.materials.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                      <div className="col-span-3">
                        <select
                          value={m.raw_material_id}
                          onChange={(e) => {
                            const materials = [...formData.materials];
                            materials[idx] = { ...materials[idx], raw_material_id: e.target.value };
                            setFormData({ ...formData, materials });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="">Select Raw Material</option>
                          {rawMaterials.map((material) => (
                            <option key={material.material_id} value={material.material_id}>
                              {material.material_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 relative">
                        <input
                          type="number"
                          step="0.000001"
                          min="0.000001"
                          value={m.amount_per_unit}
                          onChange={(e) => {
                            const materials = [...formData.materials];
                            materials[idx] = { ...materials[idx], amount_per_unit: e.target.value };
                            setFormData({ ...formData, materials });
                          }}
                          placeholder="Amount"
                          className="w-full pr-12 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          required={!!m.raw_material_id}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                          {m.raw_material_id ? (rawMaterials.find(rm => rm.material_id === parseInt(m.raw_material_id))?.unit || '') : ''}
                        </span>
                      </div>
                      <div className="col-span-5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, materials: [...formData.materials, { raw_material_id: '', amount_per_unit: '' }] })}
                          className="text-sm text-green-700 hover:underline"
                        >
                          + Add another material
                        </button>
                        {formData.materials.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, materials: formData.materials.filter((_, i) => i !== idx) })}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingProduct ? 'Update Product' : 'Add Product'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;