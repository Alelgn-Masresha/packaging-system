import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';

interface Material {
  material_id: number;
  material_name: string;
  description: string;
  category: string;
  current_stock: number;
  unit: string;
  min_stock: number;
  status: 'Available' | 'Low Stock' | 'Out of Stock';
}

interface MaterialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (materialData: Partial<Material>) => Promise<void>;
  material?: Material | null;
  categories: string[];
}

const MaterialFormModal: React.FC<MaterialFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  material,
  categories
}) => {
  const [formData, setFormData] = useState({
    material_name: '',
    description: '',
    category: '',
    current_stock: '',
    unit: '',
    min_stock: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (material) {
      setFormData({
        material_name: material.material_name,
        description: material.description || '',
        category: material.category,
        current_stock: material.current_stock.toString(),
        unit: material.unit,
        min_stock: material.min_stock.toString()
      });
    } else {
      setFormData({
        material_name: '',
        description: '',
        category: '',
        current_stock: '',
        unit: '',
        min_stock: ''
      });
    }
    setError(null);
  }, [material, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.material_name.trim() || !formData.category.trim() || !formData.unit.trim()) {
      setError('Material name, category, and unit are required');
      return;
    }

    const stock = parseFloat(formData.current_stock) || 0;
    const minStock = parseFloat(formData.min_stock) || 0;

    if (stock < 0 || minStock < 0) {
      setError('Stock values must be non-negative numbers');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await onSave({
        material_name: formData.material_name.trim(),
        description: formData.description.trim(),
        category: formData.category.trim(),
        current_stock: stock,
        unit: formData.unit.trim(),
        min_stock: minStock
      });
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save material');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {material ? 'Edit Material' : 'Add New Material'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Material Name *
            </label>
            <input
              type="text"
              name="material_name"
              value={formData.material_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Stock
              </label>
              <input
                type="number"
                name="current_stock"
                value={formData.current_stock}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Stock
              </label>
              <input
                type="number"
                name="min_stock"
                value={formData.min_stock}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit *
            </label>
            <input
              type="text"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              placeholder="e.g., Units, Kg, Rims"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{material ? 'Update' : 'Create'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialFormModal;
