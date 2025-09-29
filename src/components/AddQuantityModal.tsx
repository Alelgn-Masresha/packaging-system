import React, { useState } from 'react';
import { X, Plus, AlertTriangle } from 'lucide-react';

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

interface AddQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuantity: (materialId: number, quantity: number) => Promise<void>;
  material: Material | null;
}

const AddQuantityModal: React.FC<AddQuantityModalProps> = ({
  isOpen,
  onClose,
  onAddQuantity,
  material
}) => {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }

    if (!material) {
      setError('No material selected');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await onAddQuantity(material.material_id, parseFloat(quantity), reason.trim() || 'Manual stock addition', 'USER');
      
      setQuantity('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add quantity');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity('');
    setReason('');
    setError(null);
    onClose();
  };

  if (!isOpen || !material) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Add Stock Quantity
          </h2>
          <button
            onClick={handleClose}
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

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900">{material.material_name}</h3>
          <p className="text-sm text-gray-600">{material.description || 'No description'}</p>
          <div className="mt-2 flex items-center space-x-4 text-sm">
            <span className="text-gray-600">
              Current Stock: <span className="font-medium">{material.current_stock.toLocaleString()} {material.unit}</span>
            </span>
            <span className="text-gray-600">
              Min Stock: <span className="font-medium">{material.min_stock} {material.unit}</span>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to Add
            </label>
            <div className="relative">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0.000001"
                step="0.000001"
                placeholder="Enter quantity"
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                {material.unit}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., New shipment received, Stock adjustment"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Plus className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                New total will be: <span className="font-medium">
                  {quantity ? (material.current_stock + parseFloat(quantity || '0')).toLocaleString() : material.current_stock.toLocaleString()} {material.unit}
                </span>
              </span>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
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
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Stock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddQuantityModal;
