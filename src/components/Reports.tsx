import React, { useState, useEffect } from 'react';
import { Calendar, FileText, Download, Printer, Loader2 } from 'lucide-react';
import { ordersAPI, productsAPI, paymentsAPI } from '../services/api';

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

interface Order {
  order_id: number;
  customer_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  base_price: string | number;
  order_unit_price: string | number;
  status: string;
  order_date: string;
  delivery_date: string;
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

  useEffect(() => {
    loadProducts();
    loadReportData();
  }, []);

  // Auto-apply filters when filter values change
  useEffect(() => {
    loadReportData();
  }, [dateFrom, dateTo, productType]);

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

      // Filter orders by date range
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.order_date);
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        return orderDate >= fromDate && orderDate <= toDate;
      });

      // Filter by product type if not "All"
      const productFilteredOrders = productType === 'All' 
        ? filteredOrders 
        : filteredOrders.filter(order => order.product_name === productType);

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
        totalQuantity: productFilteredOrders.reduce((sum, order) => sum + order.quantity, 0),
        totalSales: 0,
        totalPaid: 0,
        outstanding: 0,
      };

      // Calculate payment information for each order
      let totalSales = 0;
      let totalPaid = 0;
      
      for (const order of productFilteredOrders) {
        const orderTotal = parseFloat(order.order_unit_price) * order.quantity;
        totalSales += orderTotal;
        
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

      // Generate report data grouped by date and product
      const reportMap = new Map<string, ReportData>();
      
      for (const order of productFilteredOrders) {
        const date = order.order_date;
        const key = `${date}_${order.product_name}`;
        
        if (reportMap.has(key)) {
          const existing = reportMap.get(key)!;
          existing.orders += 1;
          existing.quantity += order.quantity;
          existing.sales += parseFloat(order.order_unit_price) * order.quantity;
          
          // Add payment amount
          try {
            const paymentSummary = await paymentsAPI.getOrderSummary(order.order_id);
            existing.paid += parseFloat(paymentSummary.data.payment_summary.total_paid);
          } catch (err) {
            // No payments for this order
          }
        } else {
          let paidAmount = 0;
          try {
            const paymentSummary = await paymentsAPI.getOrderSummary(order.order_id);
            paidAmount = parseFloat(paymentSummary.data.payment_summary.total_paid);
          } catch (err) {
            // No payments for this order
          }
          
          reportMap.set(key, {
            date: date,
            productType: order.product_name,
            orders: 1,
            quantity: order.quantity,
            sales: parseFloat(order.order_unit_price) * order.quantity,
            paid: paidAmount,
          });
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
    let toDate: Date = today;

    switch (filter) {
      case 'Daily':
        fromDate = new Date(today);
        break;
      case 'Weekly':
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 7);
        break;
      case 'Monthly':
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      default:
        fromDate = new Date(today);
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

  // Helper function to check if an order is discounted
  const isOrderDiscounted = (order: Order): boolean => {
    const orderUnitPrice = parseFloat(order.order_unit_price);
    const currentBasePrice = parseFloat(order.base_price);
    return orderUnitPrice < currentBasePrice;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Sales Analytics</h1>
        <p className="text-gray-600 mt-1">Real-time sales data and analytics from your database</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          {loading && (
            <div className="flex items-center space-x-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading data...</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Date Range:</label>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <span className="text-gray-500">to</span>
              <div className="relative">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Product Type:</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="All">All Products</option>
              {products.map((product) => (
                <option key={product.product_id} value={product.name}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Quick Filters:</label>
            <div className="flex space-x-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="quickFilter"
                  value="Daily"
                  checked={quickFilter === 'Daily'}
                  onChange={(e) => handleQuickFilter(e.target.value)}
                  className="mr-1"
                />
                <span className="text-sm">Today</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="quickFilter"
                  value="Weekly"
                  checked={quickFilter === 'Weekly'}
                  onChange={(e) => handleQuickFilter(e.target.value)}
                  className="mr-1"
                />
                <span className="text-sm">This Week</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="quickFilter"
                  value="Monthly"
                  checked={quickFilter === 'Monthly'}
                  onChange={(e) => handleQuickFilter(e.target.value)}
                  className="mr-1"
                />
                <span className="text-sm">This Month</span>
              </label>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleClearFilters}
              disabled={loading}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <span>Clear Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sales Summary Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Sales Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-900">{salesSummary.totalOrders}</div>
            <div className="text-sm text-green-600">Total Orders</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-900">{salesSummary.completedOrders}</div>
            <div className="text-sm text-blue-600">Completed Orders</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-900">{salesSummary.pendingOrders}</div>
            <div className="text-sm text-yellow-600">Pending Orders</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-900">{salesSummary.totalQuantity.toLocaleString()}</div>
            <div className="text-sm text-purple-600">Total Quantity</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-indigo-900">{formatCurrency(salesSummary.totalSales)}</div>
            <div className="text-sm text-indigo-600">Total Sales</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-900">{formatCurrency(salesSummary.totalPaid)}</div>
            <div className="text-sm text-green-600">Total Paid</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-900">{formatCurrency(salesSummary.outstanding)}</div>
            <div className="text-sm text-red-600">Outstanding</div>
          </div>
        </div>
      </div>

      {/* Report Breakdown Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Report Breakdown</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleExportPDF}
              className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sales
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                      <span className="text-gray-600">Loading report data...</span>
                    </div>
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No data found for the selected filters
                  </td>
                </tr>
              ) : (
                reportData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.productType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatCurrency(row.sales)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatCurrency(row.paid)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Orders Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Individual Orders</h2>
          <p className="text-sm text-gray-600 mt-1">Detailed view of all orders with pricing information</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    No orders found for the selected filters
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{order.order_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <span>{order.product_name}</span>
                        {isOrderDiscounted(order) && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Discounted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      ETB {parseFloat(order.order_unit_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      ETB {parseFloat(order.base_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ETB {(parseFloat(order.order_unit_price) * order.quantity).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(order.order_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
