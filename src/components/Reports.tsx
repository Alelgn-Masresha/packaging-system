import React, { useState, useEffect } from 'react';
import { Calendar, FileText, Download, Printer, Loader2, BarChart3, List } from 'lucide-react';
import { useI18n } from '../i18n';
import { ordersAPI, productsAPI, paymentsAPI } from '../services/api';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

interface ReportData {
  date: string;
  productType: string;
  orders: number;
  quantity: number;
  sales: number;
  paid: number;
}

interface SalesSummary {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalQuantity: number;
  totalSales: number;
  totalPaid: number;
  outstanding: number;
}

interface OrderProduct {
  product_id: number;
  product_name: string;
  standard_size: string;
  base_price: number;
  order_unit_price: number;
  quantity: number;
  is_custom_size: boolean;
  length?: number;
  width?: number;
  height?: number;
  amount_per_unit?: number;
}

interface Order {
  order_id: number;
  customer_id: number;
  customer_name: string;
  products: OrderProduct[];
  status: string;
  order_date: string;
  delivery_date: string;
  // Legacy fields (first product) for backward compatibility
  product_id?: number;
  product_name?: string;
  quantity?: number;
  base_price?: string | number;
  order_unit_price?: string | number;
}

interface Product {
  product_id: number;
  name: string;
  standard_size: string;
  base_price: string | number;
}

const Reports: React.FC = () => {
  // Set default date range to current month
  const currentDate = new Date();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const [dateFrom, setDateFrom] = useState(firstDay.toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(lastDay.toISOString().split('T')[0]);
  const [productType, setProductType] = useState('All');
  const [quickFilter, setQuickFilter] = useState('Monthly');
  
  // Section tabs
  const [activeSection, setActiveSection] = useState<'summary' | 'individual'>('summary');
  
  // Report breakdown view toggle
  const [breakdownView, setBreakdownView] = useState<'daily' | 'product'>('daily');
  
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary>({
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalQuantity: 0,
    totalSales: 0,
    totalPaid: 0,
    outstanding: 0,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chart data states
  const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
  const [orderVolumeData, setOrderVolumeData] = useState<any[]>([]);
  // const [productSalesData, setProductSalesData] = useState<any[]>([]);
  const [topProductSeriesData, setTopProductSeriesData] = useState<any[]>([]);
  const [topProductKeys, setTopProductKeys] = useState<string[]>([]);
  const [statusDistributionData, setStatusDistributionData] = useState<any[]>([]);

  const { t } = useI18n();

  useEffect(() => {
    loadProducts();
    loadReportData();
  }, []);

  // Auto-apply filters when filter values change
  useEffect(() => {
    loadReportData();
  }, [dateFrom, dateTo, productType, breakdownView]);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all orders
      const ordersResponse = await ordersAPI.getAll();
      const orders: Order[] = ordersResponse.data;

      // Filter orders by date range (inclusive, end-of-day)
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.order_date);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        return orderDate.getTime() >= fromDate.getTime() && orderDate.getTime() <= toDate.getTime();
      });

      // Filter by product type if not "All"
      const productFilteredOrders = productType === 'All' 
        ? filteredOrders 
        : filteredOrders.filter(order => 
            (order.products || []).some(product => product.product_name === productType)
          );

      // Store filtered orders for individual order display
      setFilteredOrders(productFilteredOrders);

      // Calculate sales summary
      const summary: SalesSummary = {
        totalOrders: productFilteredOrders.length,
        completedOrders: productFilteredOrders.filter(order => 
          ['Completed', 'Delivered'].includes(order.status)
        ).length,
        pendingOrders: productFilteredOrders.filter(order => 
          ['Pending', 'In Progress'].includes(order.status)
        ).length,
        totalQuantity: productFilteredOrders.reduce((sum, order) => 
          sum + (order.products || []).reduce((productSum, product) => productSum + product.quantity, 0), 0
        ),
        totalSales: 0,
        totalPaid: 0,
        outstanding: 0,
      };

      // Calculate payment information for each order (exclude cancelled orders)
      let totalSales = 0;
      let totalPaid = 0;
      
      for (const order of productFilteredOrders) {
        // Calculate order total from all products
        const orderTotal = (order.products || []).reduce((sum, product) => 
          sum + (product.order_unit_price * product.quantity), 0
        );
        totalSales += orderTotal;
        
        // Skip payment calculation for cancelled orders
        if (order.status === 'Cancelled') {
          continue;
        }
        
        try {
          const paymentSummary = await paymentsAPI.getOrderSummary(order.order_id);
          totalPaid += parseFloat(paymentSummary.data.payment_summary.total_paid);
        } catch (err) {
          // Order has no payments
        }
      }
      
      summary.totalSales = totalSales;
      summary.totalPaid = totalPaid;
      summary.outstanding = totalSales - totalPaid;
      setSalesSummary(summary);

      // Process data for charts
      processChartData(productFilteredOrders);

      // Generate report data based on selected view
      const reportMap = new Map<string, ReportData>();
      
      for (const order of productFilteredOrders) {
        const date = order.order_date;
        
        // Process each product in the order
        for (const product of (order.products || [])) {
          // Choose grouping key based on breakdown view
          const key = breakdownView === 'daily' 
            ? `${date}_${product.product_name}`  // Group by date and product
            : product.product_name;              // Group by product only
          
          if (reportMap.has(key)) {
            const existing = reportMap.get(key)!;
            existing.orders += 1;
            existing.quantity += product.quantity;
            existing.sales += product.order_unit_price * product.quantity;
            
            // Add payment amount (skip cancelled orders)
            if (order.status !== 'Cancelled') {
              try {
                const paymentSummary = await paymentsAPI.getOrderSummary(order.order_id);
                existing.paid += parseFloat(paymentSummary.data.payment_summary.total_paid);
              } catch (err) {
                // No payments for this order
              }
            }
          } else {
            let paidAmount = 0;
            // Skip payment calculation for cancelled orders
            if (order.status !== 'Cancelled') {
              try {
                const paymentSummary = await paymentsAPI.getOrderSummary(order.order_id);
                paidAmount = parseFloat(paymentSummary.data.payment_summary.total_paid);
              } catch (err) {
                // No payments for this order
              }
            }
            
            reportMap.set(key, {
              date: breakdownView === 'daily' ? date : 'All Dates',
              productType: product.product_name,
              orders: 1,
              quantity: product.quantity,
              sales: product.order_unit_price * product.quantity,
              paid: paidAmount,
            });
          }
        }
      }
      
      const sortedReportData = Array.from(reportMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setReportData(sortedReportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('ETB', 'Birr');
  };

  // Process data for charts
  const processChartData = (orders: Order[]) => {
    // Sales trend data (daily sales)
    const salesTrendMap = new Map<string, { date: string; sales: number; orders: number }>();
    
    orders.forEach(order => {
      const date = order.order_date;
      // Calculate total sales for this order from all products
      const orderSales = (order.products || []).reduce((sum, product) => 
        sum + (product.order_unit_price * product.quantity), 0
      );
      
      if (salesTrendMap.has(date)) {
        const existing = salesTrendMap.get(date)!;
        existing.sales += orderSales;
        existing.orders += 1;
      } else {
        salesTrendMap.set(date, { date, sales: orderSales, orders: 1 });
      }
    });
    
    const salesTrend = Array.from(salesTrendMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));
    
    setSalesTrendData(salesTrend);
    
    // Order volume data (daily order counts)
    const orderVolume = salesTrend.map(item => ({
      date: item.date,
      orders: item.orders
    }));
    setOrderVolumeData(orderVolume);
    
    // Product sales data (totals) and per-date series for top products
    const productSalesMap = new Map<string, { product: string; sales: number; orders: number }>();
    const perDateProductSales = new Map<string, Map<string, number>>(); // date -> (product -> sales)
    
    orders.forEach(order => {
      const dateKey = order.order_date;
      
      // Process each product in the order
      (order.products || []).forEach(product => {
        const productName = product.product_name;
        const sales = product.order_unit_price * product.quantity;
        
        if (productSalesMap.has(productName)) {
          const existing = productSalesMap.get(productName)!;
          existing.sales += sales;
          existing.orders += 1;
        } else {
          productSalesMap.set(productName, { product: productName, sales, orders: 1 });
        }

        // accumulate per-date for series
        if (!perDateProductSales.has(dateKey)) {
          perDateProductSales.set(dateKey, new Map<string, number>());
        }
        const mapForDate = perDateProductSales.get(dateKey)!;
        mapForDate.set(productName, (mapForDate.get(productName) || 0) + sales);
      });
    });
    
    const productSales = Array.from(productSalesMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5); // Top 5 products
    // setProductSalesData(productSales);

    // Build series data for top products over time (vertical grouped bars)
    const topKeys = productSales.map(p => p.product);
    setTopProductKeys(topKeys);
    const series = Array.from(perDateProductSales.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, prodMap]) => {
        const prettyDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const row: any = { date: prettyDate };
        topKeys.forEach(k => {
          row[k] = prodMap.get(k) || 0;
        });
        return row;
      });
    setTopProductSeriesData(series);
    
    // Status distribution data
    const statusMap = new Map<string, number>();
    orders.forEach(order => {
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
    });
    
    const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / orders.length) * 100)
    }));
    setStatusDistributionData(statusDistribution);
  };

  const handleExportPDF = () => {
    console.log('Exporting to PDF...');
    // Implementation for PDF export
  };

  const handleExportExcel = () => {
    console.log('Exporting to Excel...');
    // Implementation for Excel export
  };

  const handlePrint = () => {
    window.print();
  };


  const handleQuickFilter = (filter: string) => {
    const today = new Date();
    let fromDate: Date;
    let toDate: Date = new Date(today);

    switch (filter) {
      case 'Daily':
        fromDate = new Date(today);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        break;
      case 'Weekly':
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 6);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        break;
      case 'Monthly':
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        toDate.setHours(23, 59, 59, 999);
        break;
      default:
        fromDate = new Date(today);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
    }

    setDateFrom(fromDate.toISOString().split('T')[0]);
    setDateTo(toDate.toISOString().split('T')[0]);
    setQuickFilter(filter);
  };

  const handleClearFilters = () => {
    // Reset to current month
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    setDateFrom(firstDay.toISOString().split('T')[0]);
    setDateTo(lastDay.toISOString().split('T')[0]);
    setProductType('All');
    setQuickFilter('Monthly');
  };


  return (
    <div className="flex h-full bg-white">
      {/* Main Reports Panel */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="bg-blue-600 rounded-lg p-6 mb-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-white">{t('reports')}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Calendar className="w-4 h-4 text-blue-100" />
                  <span className="text-blue-100 text-sm">
                    {t('sales_trend')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <BarChart3 className="w-6 h-6 text-blue-100" />
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveSection('summary')}
              className={`pb-2 text-sm font-medium flex items-center space-x-2 ${
                activeSection === 'summary'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{t('sales_summary')}</span>
            </button>
            <button
              onClick={() => setActiveSection('individual')}
              className={`pb-2 text-sm font-medium flex items-center space-x-2 ${
                activeSection === 'individual'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
              <span>{t('report_breakdown')}</span>
            </button>
          </nav>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{t('filters')}</h2>
            {loading && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading data...</span>
              </div>
            )}
          </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{t('date_range')}:</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2">
              <div className="relative w-full sm:w-auto">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <span className="text-gray-500 text-center sm:text-left">to</span>
              <div className="relative w-full sm:w-auto">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{t('product_type')}:</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="All">All Products</option>
              {products.map((product) => (
                <option key={product.product_id} value={product.name}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{t('quick_filters')}:</label>
            <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="quickFilter"
                  value="Daily"
                  checked={quickFilter === 'Daily'}
                  onChange={(e) => handleQuickFilter(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">{t('today')}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="quickFilter"
                  value="Weekly"
                  checked={quickFilter === 'Weekly'}
                  onChange={(e) => handleQuickFilter(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">{t('this_week')}</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="quickFilter"
                  value="Monthly"
                  checked={quickFilter === 'Monthly'}
                  onChange={(e) => handleQuickFilter(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">{t('this_month')}</span>
              </label>
            </div>
          </div>

          <div className="flex space-x-2 w-full sm:w-auto">
            <button
              onClick={handleClearFilters}
              disabled={loading}
              className="w-full sm:w-auto bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <span>{t('clear_filters')}</span>
            </button>
          </div>
        </div>
        </div>

        {activeSection === 'summary' && (
          <>
            {/* Sales Summary Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('sales_summary')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-900">{salesSummary.totalOrders}</div>
                  <div className="text-sm text-green-600">{t('total_orders')}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-900">{salesSummary.completedOrders}</div>
                  <div className="text-sm text-blue-600">{t('completed_orders')}</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-900">{salesSummary.pendingOrders}</div>
                  <div className="text-sm text-yellow-600">{t('pending_orders')}</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-900">{salesSummary.totalQuantity.toLocaleString()}</div>
                  <div className="text-sm text-purple-600">{t('total_quantity')}</div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-900">{formatCurrency(salesSummary.totalSales)}</div>
                  <div className="text-sm text-indigo-600">{t('total_sales')}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-900">{formatCurrency(salesSummary.totalPaid)}</div>
                  <div className="text-sm text-green-600">{t('total_paid_label')}</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-900">{formatCurrency(salesSummary.outstanding)}</div>
                  <div className="text-sm text-red-600">{t('outstanding_label')}</div>
                </div>
              </div>
            </div>

            {/* Sales Trend Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('sales_trend')}</h2>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        name === 'sales' ? formatCurrency(value) : value,
                        name === 'sales' ? 'Sales' : 'Orders'
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#3B82F6" 
                      fill="#3B82F6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Product Sales Chart (Top 5 over time as grouped bars) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('top_products_time')}</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value: any, name: string) => [formatCurrency(value as number), name]} />
                      <Legend />
                      {topProductKeys.map((key, idx) => (
                        <Bar key={key} dataKey={key} fill={["#3B82F6", "#F59E0B", "#8B5CF6", "#10B981", "#EF4444"][idx % 5]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('order_status_distribution')}</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ status, percentage }) => `${status === 'Completed' ? t('status_completed') : status === 'Delivered' ? t('status_delivered') : status === 'In Progress' ? t('status_in_progress') : status === 'Pending' ? t('status_pending') : status === 'Cancelled' ? t('status_cancelled') : status} (${percentage}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {statusDistributionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Report Breakdown Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 sm:p-6 border-b border-gray-200 gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <h2 className="text-lg font-semibold text-gray-900">{t('report_breakdown')}</h2>
                  
                  {/* Breakdown View Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="text-sm font-medium text-gray-700">View:</span>
                    <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                      <button
                        onClick={() => setBreakdownView('daily')}
                        className={`flex-1 sm:flex-none px-3 py-1 text-sm rounded-md transition-colors ${
                          breakdownView === 'daily'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Daily Breakdown
                      </button>
                      <button
                        onClick={() => setBreakdownView('product')}
                        className={`flex-1 sm:flex-none px-3 py-1 text-sm rounded-md transition-colors ${
                          breakdownView === 'product'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Product Summary
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
                  <button
                    onClick={handleExportPDF}
                    className="w-full sm:w-auto bg-gray-100 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{t('export_pdf')}</span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="w-full sm:w-auto bg-gray-100 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t('export_excel')}</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="w-full sm:w-auto bg-gray-100 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{t('print')}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {breakdownView === 'daily' ? t('date') : 'Period'}
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('product_type_col')}</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('orders_col')}</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('quantity_col')}</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('sales_col')}</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('paid_col')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                            <span className="text-gray-600">Loading report data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : reportData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">{t('no_data_found')}</td>
                      </tr>
                    ) : (
                      reportData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-900">
                            {breakdownView === 'daily' 
                              ? new Date(row.date).toLocaleDateString()
                              : row.date
                            }
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                            {row.productType}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                            {row.orders}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                            {row.quantity.toLocaleString()}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                            {formatCurrency(row.sales)}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                            {formatCurrency(row.paid)}
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

        {activeSection === 'individual' && (
          <>
            {/* Order Volume Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Volume Trend</h2>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={orderVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [value, 'Orders']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="orders" 
                      stroke="#10B981" 
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Individual Orders Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Individual Orders</h2>
                <p className="text-sm text-gray-600 mt-1">Detailed view of all orders with pricing information</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[800px] divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Products
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Total
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No orders found for the selected filters
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const orderTotal = (order.products || []).reduce((sum, product) => 
                          sum + (product.order_unit_price * product.quantity), 0
                        );
                        
                        return (
                          <tr key={order.order_id} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900">
                              #{order.order_id}
                            </td>
                            <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                              {order.customer_name}
                            </td>
                            <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                              {order.products && order.products.length > 0 ? (
                                <div className="space-y-1">
                                  {order.products.map((product, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                      <span className="font-medium">{product.product_name}</span>
                                      <span className="text-gray-500">×{product.quantity}</span>
                                      {product.is_custom_size && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded w-fit">
                                          {product.length}×{product.width}×{product.height}
                                        </span>
                                      )}
                                      {(product.order_unit_price < product.base_price - 0.01) && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 w-fit">
                                          Disc
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">No products</span>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900">
                              {formatCurrency(orderTotal)}
                            </td>
                            <td className="px-3 sm:px-6 py-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                order.status === 'Completed' || order.status === 'Delivered' 
                                  ? 'bg-green-100 text-green-800'
                                  : order.status === 'In Progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : order.status === 'Pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-4 text-sm text-gray-600">
                              {new Date(order.order_date).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
