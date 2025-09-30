import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter,
  Calendar, 
  Edit, 
  Trash2, 
  ChevronDown,
  Package,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useI18n } from '../i18n';
import { rawMaterialsAPI } from '../services/api';
import { FileText } from 'lucide-react';
import MaterialFormModal from './MaterialFormModal';
import AddQuantityModal from './AddQuantityModal';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

interface Material {
  material_id: number;
  material_name: string;
  description: string;
  category: string;
  current_stock: number;
  unit: string;
  min_stock: number;
  status: 'Available' | 'Low Stock' | 'Out of Stock';
  created_at: string;
  updated_at: string;
}

const InventoryManagement: React.FC = () => {
  const { t } = useI18n();
  // Deprecated settings states removed
  const [searchTerm, setSearchTerm] = useState('');
  // Settings removed
  
  // State for real data
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  // Modal states
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Section tabs
  const [activeSection, setActiveSection] = useState<'inventory' | 'transactions'>('inventory');

  // Transactions section state
  const [txDateFrom, setTxDateFrom] = useState<string>('');
  const [txDateTo, setTxDateTo] = useState<string>('');
  const [txType, setTxType] = useState<string>('All');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [txError, setTxError] = useState<string | null>(null);
  
  // Chart data states
  const [stockTrendData, setStockTrendData] = useState<any[]>([]);
  const [transactionVolumeData, setTransactionVolumeData] = useState<any[]>([]);
  // const [materialUsageData, setMaterialUsageData] = useState<any[]>([]);
  const [topMaterialSeriesData, setTopMaterialSeriesData] = useState<any[]>([]);
  const [topMaterialKeys, setTopMaterialKeys] = useState<string[]>([]);
  const [transactionTypeData, setTransactionTypeData] = useState<any[]>([]);

  // Load materials from API
  useEffect(() => {
    loadMaterials();
    loadCategories();
    // initialize transaction date range to this month and load
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setTxDateFrom(first.toISOString().split('T')[0]);
    setTxDateTo(last.toISOString().split('T')[0]);
    setTxType('All');
    // load after state update tick
    setTimeout(() => loadTransactions(), 0);
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await rawMaterialsAPI.getAll();
      setMaterials(response.data);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
      console.error('Error loading materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await rawMaterialsAPI.getCategories();
      setCategories(response.data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  // Load transactions (simple global list, keep it simple)
  const loadTransactions = async () => {
    try {
      setTxLoading(true);
      setTxError(null);
      const response = await rawMaterialsAPI.getAllTransactions(1, 100);
      let data = response.data as any[];

      // Basic client-side filters (simple)
      if (txType !== 'All') {
        data = data.filter(t => t.transaction_type === txType);
      }
      if (txDateFrom) {
        const from = new Date(txDateFrom);
        data = data.filter(t => new Date(t.created_at) >= from);
      }
      if (txDateTo) {
        const to = new Date(txDateTo);
        // include entire day
        to.setHours(23,59,59,999);
        data = data.filter(t => new Date(t.created_at) <= to);
      }
      setTransactions(data);
      
      // Process data for charts
      processTransactionChartData(data);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setTxLoading(false);
    }
  };

  // CRUD Operations
  const handleCreateMaterial = async (materialData: Partial<Material>) => {
    await rawMaterialsAPI.create(materialData);
    await loadMaterials();
    // Reload transactions to show the initial stock transaction
    await loadTransactions();
  };

  const handleUpdateMaterial = async (materialData: Partial<Material>) => {
    if (!selectedMaterial) return;
    await rawMaterialsAPI.update(selectedMaterial.material_id, materialData);
    await loadMaterials();
  };

  const handleAddQuantity = async (materialId: number, quantity: number, reason?: string, createdBy?: string) => {
    await rawMaterialsAPI.addStock(materialId, quantity, reason, createdBy);
    await loadMaterials();
  };

  const handleDeleteMaterial = async (materialId: number) => {
    if (window.confirm('Are you sure you want to delete this material? This action cannot be undone.')) {
      try {
        await rawMaterialsAPI.delete(materialId);
        await loadMaterials();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete material');
      }
    }
  };

  // Modal handlers
  const openMaterialModal = (material?: Material) => {
    setSelectedMaterial(material || null);
    setIsMaterialModalOpen(true);
  };

  const openQuantityModal = (material: Material) => {
    setSelectedMaterial(material);
    setIsQuantityModalOpen(true);
  };

  const closeModals = () => {
    setIsMaterialModalOpen(false);
    setIsQuantityModalOpen(false);
    setSelectedMaterial(null);
  };

  const filteredMaterials = materials.filter(material =>
    material.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (material.description && material.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    material.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Paper': 'bg-blue-100 text-blue-800',
      'Plastic': 'bg-purple-100 text-purple-800',
      'Adhesive': 'bg-green-100 text-green-800',
      'Protection': 'bg-yellow-100 text-yellow-800',
      'Ink': 'bg-red-100 text-red-800',
      'Fasteners': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Low Stock':
        return 'text-red-600';
      case 'Out of Stock':
        return 'text-red-800';
      default:
        return 'text-green-600';
    }
  };

  const getMaterialIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Paper': '📄',
      'Plastic': '📦',
      'Adhesive': '🔗',
      'Protection': '🛡️',
      'Ink': '🖨️',
      'Fasteners': '📎'
    };
    return icons[category] || '📦';
  };

  // Process data for charts
  const processTransactionChartData = (transactions: any[]) => {
    // Stock trend data (daily stock changes)
    const stockTrendMap = new Map<string, { date: string; add: number; subtract: number; net: number }>();
    
    transactions.forEach(transaction => {
      const date = transaction.created_at.split('T')[0];
      const quantity = parseFloat(transaction.quantity);
      
      if (stockTrendMap.has(date)) {
        const existing = stockTrendMap.get(date)!;
        if (transaction.transaction_type === 'ADD') {
          existing.add += quantity;
        } else if (transaction.transaction_type === 'SUBTRACT') {
          existing.subtract += quantity;
        }
        existing.net = existing.add - existing.subtract;
      } else {
        const add = transaction.transaction_type === 'ADD' ? quantity : 0;
        const subtract = transaction.transaction_type === 'SUBTRACT' ? quantity : 0;
        stockTrendMap.set(date, { 
          date, 
          add, 
          subtract, 
          net: add - subtract 
        });
      }
    });
    
    const stockTrend = Array.from(stockTrendMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));
    
    setStockTrendData(stockTrend);
    
    // Transaction volume data (daily transaction counts)
    const transactionVolumeMap = new Map<string, { date: string; count: number }>();
    
    transactions.forEach(transaction => {
      const date = transaction.created_at.split('T')[0];
      if (transactionVolumeMap.has(date)) {
        transactionVolumeMap.get(date)!.count += 1;
      } else {
        transactionVolumeMap.set(date, { date, count: 1 });
      }
    });
    
    const transactionVolume = Array.from(transactionVolumeMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));
    
    setTransactionVolumeData(transactionVolume);
    
    // Material usage data (top materials by transaction volume)
    const materialUsageMap = new Map<string, { material: string; add: number; subtract: number; net: number }>();
    const perDateMaterial = new Map<string, Map<string, number>>(); // date -> (material -> net)
    
    transactions.forEach(transaction => {
      const material = transaction.material_name;
      const quantity = parseFloat(transaction.quantity);
      const dateKey = transaction.created_at.split('T')[0];
      
      if (materialUsageMap.has(material)) {
        const existing = materialUsageMap.get(material)!;
        if (transaction.transaction_type === 'ADD') {
          existing.add += quantity;
        } else if (transaction.transaction_type === 'SUBTRACT') {
          existing.subtract += quantity;
        }
        existing.net = existing.add - existing.subtract;
      } else {
        const add = transaction.transaction_type === 'ADD' ? quantity : 0;
        const subtract = transaction.transaction_type === 'SUBTRACT' ? quantity : 0;
        materialUsageMap.set(material, { 
          material, 
          add, 
          subtract, 
          net: add - subtract 
        });
      }

      // accumulate per-date series by net movement
      if (!perDateMaterial.has(dateKey)) {
        perDateMaterial.set(dateKey, new Map<string, number>());
      }
      const m = perDateMaterial.get(dateKey)!;
      const delta = transaction.transaction_type === 'ADD' ? quantity : transaction.transaction_type === 'SUBTRACT' ? -quantity : 0;
      m.set(material, (m.get(material) || 0) + delta);
    });
    
    const materialUsage = Array.from(materialUsageMap.values())
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 5); // Top 5 materials
    
    // setMaterialUsageData(materialUsage);

    // Build grouped bar series for top materials over time using net change
    const topKeys = materialUsage.map(m => m.material);
    setTopMaterialKeys(topKeys);
    const series = Array.from(perDateMaterial.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, matMap]) => {
        const prettyDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const row: any = { date: prettyDate };
        topKeys.forEach(k => {
          row[k] = matMap.get(k) || 0;
        });
        return row;
      });
    setTopMaterialSeriesData(series);
    
    // Transaction type distribution
    const typeMap = new Map<string, number>();
    transactions.forEach(transaction => {
      typeMap.set(transaction.transaction_type, (typeMap.get(transaction.transaction_type) || 0) + 1);
    });
    
    const transactionType = Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / transactions.length) * 100)
    }));
    
    setTransactionTypeData(transactionType);
  };

  return (
    <>
    <div className="flex h-full bg-white">
      {/* Main Inventory Panel */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="bg-green-600 rounded-lg p-6 mb-6 relative">
          <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
              <div>
              <h1 className="text-2xl font-bold text-white">{t('raw_materials_inventory')}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Calendar className="w-4 h-4 text-green-100" />
                <span className="text-green-100 text-sm">{t('last_updated')}: {lastUpdated || 'Loading...'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => openMaterialModal()}
                className="bg-white text-green-600 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>{t('add_material')}</span>
              </button>
              <Package className="w-6 h-6 text-green-100" />
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveSection('inventory')}
              className={`pb-2 text-sm font-medium ${
                activeSection === 'inventory'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('inventory_tab')}
            </button>
            <button
              onClick={() => setActiveSection('transactions')}
              className={`pb-2 text-sm font-medium ${
                activeSection === 'transactions'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('transactions_tab')}
            </button>
          </nav>
        </div>

        {activeSection === 'inventory' && (
        <>
        {/* Search and Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('search_materials')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-64"
              />
            </div>
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              <span>{t('filter')}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-gray-600">
            {t('total_materials')}: {loading ? '-' : filteredMaterials.length}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
              <button 
                onClick={loadMaterials}
                className="text-red-600 hover:text-red-800 text-sm underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Inventory Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('material_name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('category')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('current_stock')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('unit')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('min_stock')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('add_quantity')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                        <span className="text-gray-600">Loading materials...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        {searchTerm ? 'No materials found matching your search.' : 'No materials available.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((material) => (
                    <tr key={material.material_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{getMaterialIcon(material.category)}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{material.material_name}</div>
                            <div className="text-sm text-gray-500">{material.description || 'No description'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(material.category)}`}>
                          {material.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {material.current_stock.toLocaleString()}
                          </div>
                          <div className={`text-sm ${getStatusColor(material.status)}`}>
                            {material.status === 'Low Stock' ? t('stock_low')
                              : material.status === 'Out of Stock' ? t('stock_out')
                              : t('stock_available')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {material.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {material.min_stock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => openQuantityModal(material)}
                          className="bg-green-600 text-white p-2 rounded hover:bg-green-700 transition-colors"
                          title="Add Stock"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => openMaterialModal(material)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit Material"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteMaterial(material.material_id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Material"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
        
        {activeSection === 'transactions' && (
        <>
        {/* Stock Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Stock Movement Trend</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stockTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    value,
                    name === 'add' ? 'Added' : name === 'subtract' ? 'Subtracted' : 'Net Change'
                  ]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="add" 
                  stackId="1"
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="subtract" 
                  stackId="1"
                  stroke="#EF4444" 
                  fill="#EF4444" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Transaction Volume</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transactionVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any) => [value, 'Transactions']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Transaction Types</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={transactionTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percentage }) => `${type} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {transactionTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#10B981', '#EF4444', '#F59E0B'][index % 3]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Material Usage Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Materials by Usage</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMaterialSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {topMaterialKeys.map((key, idx) => (
                  <Bar key={key} dataKey={key} fill={["#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EF4444"][idx % 5]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transactions Report Section */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Stock Transactions Report</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span>Detailed report</span>
            </div>
          </div>

          <div className="p-6">
            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Date Range:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={txDateFrom}
                      onChange={(e) => setTxDateFrom(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="date"
                      value={txDateTo}
                      onChange={(e) => setTxDateTo(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Type:</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option>All</option>
                    <option value="ADD">ADD</option>
                    <option value="SUBTRACT">SUBTRACT</option>
                    <option value="ADJUSTMENT">ADJUSTMENT</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadTransactions}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Filter className="w-4 h-4" />
                    <span>Apply</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {txLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                          <span className="text-gray-600">Loading transactions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : txError ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-red-600">{txError}</td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No transactions found</td>
                    </tr>
                  ) : (
                    transactions.map((t, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.material_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(t.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={t.transaction_type === 'ADD' ? 'text-green-700' : t.transaction_type === 'SUBTRACT' ? 'text-red-700' : 'text-gray-700'}>
                            {t.transaction_type === 'SUBTRACT' ? '-' : '+'}{parseFloat(t.quantity).toLocaleString()} {t.unit}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.reason || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
      {/* Removed Settings Sidebar */}

      {/* Modals */}
      <MaterialFormModal
        isOpen={isMaterialModalOpen}
        onClose={closeModals}
        onSave={selectedMaterial ? handleUpdateMaterial : handleCreateMaterial}
        material={selectedMaterial}
        categories={categories}
      />

      <AddQuantityModal
        isOpen={isQuantityModalOpen}
        onClose={closeModals}
        onAddQuantity={handleAddQuantity}
        material={selectedMaterial}
      />
    </div>
    </>
  );
};

export default InventoryManagement;
