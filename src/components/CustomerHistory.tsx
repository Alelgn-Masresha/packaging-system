import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, User, Eye, X, Loader2 } from 'lucide-react';
import { customersAPI, ordersAPI, paymentsAPI } from '../services/api';

interface CustomerHistoryProps {
  onBackToDashboard: () => void;
}

interface Customer {
  customer_id: number;
  name: string;
  phone: string;
  address: string;
}

interface Order {
  order_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  product_name: string;
  standard_size: string;
  base_price: string | number;
  order_unit_price: string | number;
  quantity: number;
  is_custom_size: boolean;
  length?: number;
  width?: number;
  height?: number;
  status: string;
  order_date: string;
  delivery_date: string;
  payments?: Payment[];
  payment_status?: string;
  total_paid?: number;
  outstanding?: number;
}

interface Payment {
  payment_id: number;
  amount: number;
  payment_date: string;
  reference_number?: string;
  type: 'Advance' | 'Final';
}

const CustomerHistory: React.FC<CustomerHistoryProps> = ({ onBackToDashboard }) => {
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [customersWithOrderCounts, setCustomersWithOrderCounts] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  useEffect(() => {
    loadAllCustomers();
  }, []);

  const loadAllCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const response = await customersAPI.getAll();
      const customers = response.data;
      setAllCustomers(customers);

      // Get order counts for each customer
      const customersWithCounts = await Promise.all(
        customers.map(async (customer: Customer) => {
          try {
            const ordersResponse = await ordersAPI.getByCustomer(customer.customer_id);
            const orderCount = ordersResponse.data.length;
            return {
              ...customer,
              orderCount,
            };
          } catch (err) {
            return {
              ...customer,
              orderCount: 0,
            };
          }
        })
      );

      setCustomersWithOrderCounts(customersWithCounts);
    } catch (err) {
      setError('Failed to load customers list');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSearchInputChange = async (value: string) => {
    setSearchQuery(value);
    
    if (value.trim().length >= 2) {
      try {
        const response = await customersAPI.search(value);
        setSearchSuggestions(response.data);
        setShowSuggestions(true);
      } catch (err) {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
    
    // Reset customer selection when typing
    if (currentCustomer) {
      setCurrentCustomer(null);
      setActiveOrders([]);
      setPastOrders([]);
    }
  };

  const handleSuggestionSelect = async (customer: Customer) => {
    setCurrentCustomer(customer);
    setSearchQuery(`${customer.name} (${customer.phone})`);
    setShowSuggestions(false);
    await loadCustomerOrders(customer.customer_id);
  };

  const loadCustomerOrders = async (customerId: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ordersAPI.getByCustomer(customerId);
      const orders = response.data;
      
      // Calculate payment status for each order
      const ordersWithPaymentStatus = await Promise.all(
        orders.map(async (order: Order) => {
          try {
            const paymentSummary = await paymentsAPI.getOrderSummary(order.order_id);
            const paymentData = paymentSummary.data.payment_summary;
            
            return {
              ...order,
              payment_status: paymentData.payment_status,
              total_paid: paymentData.total_paid,
              outstanding: paymentData.outstanding,
            } as Order;
          } catch (err) {
            return {
              ...order,
              payment_status: 'Unpaid',
              total_paid: 0,
              outstanding: Number(order.order_unit_price) * order.quantity,
            } as Order;
          }
        })
      );
      
      // Separate active and past orders
      const active = ordersWithPaymentStatus.filter(order => 
        ['Pending', 'In Progress', 'Completed'].includes(order.status)
      );
      const past = ordersWithPaymentStatus.filter(order => 
        ['Delivered', 'Cancelled'].includes(order.status)
      );
      
      setActiveOrders(active);
      setPastOrders(past);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress':
        return 'text-blue-600 bg-blue-50';
      case 'Delivered':
        return 'text-green-600 bg-green-50';
      case 'Cancelled':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('ETB', 'ETB');
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const handleCustomerSelect = async (customer: Customer) => {
    setCurrentCustomer(customer);
    setSearchQuery(`${customer.name} (${customer.phone})`);
    setShowSuggestions(false);
    await loadCustomerOrders(customer.customer_id);
    
    // Scroll to top to show the selected customer's orders
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Customer Order History</h1>
        <button
          onClick={onBackToDashboard}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="flex items-center flex-wrap gap-3 sm:gap-4">
        <span className="text-sm font-medium text-gray-600">Search Customer:</span>
        <div className="flex-1 min-w-[260px] sm:max-w-md relative">
          <input
            type="text"
            placeholder="Phone / Name / ID"
            value={searchQuery}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          
          {/* Search Suggestions Dropdown */}
          {showSuggestions && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchSuggestions.length > 0 ? (
                searchSuggestions.map((customer) => (
                  <div
                    key={customer.customer_id}
                    onClick={() => handleSuggestionSelect(customer)}
                    className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-600">
                      Phone: {customer.phone} | ID: {customer.customer_id}
                    </div>
                    <div className="text-sm text-gray-500">{customer.address}</div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-gray-600">
                  No customers found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {currentCustomer ? (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-green-600" />
          </div>
          <div>
              <h2 className="text-xl font-semibold text-gray-900">{currentCustomer.name}</h2>
            <p className="text-gray-600 flex items-center space-x-4">
                <span>📞 {currentCustomer.phone}</span>
                <span>📍 {currentCustomer.address}</span>
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Active Orders</h3>
                {loading && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                )}
              </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Order ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Specifications</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Payment</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Quantity</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Total (ETB)</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Advance Payment</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                            <span className="text-gray-600">Loading orders...</span>
                          </div>
                        </td>
                      </tr>
                    ) : activeOrders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                          No active orders found
                        </td>
                      </tr>
                    ) : (
                      activeOrders.map((order) => (
                        <tr key={order.order_id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">#{order.order_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{order.product_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {order.is_custom_size 
                              ? `${order.length}×${order.width}×${order.height}` 
                              : order.standard_size
                            }
                          </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{order.payment_status || 'Unpaid'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{order.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(Number(order.order_unit_price) * order.quantity)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {order.total_paid && order.total_paid > 0 ? formatCurrency(order.total_paid) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleViewDetails(order)}
                              className="text-blue-600 hover:text-blue-800 transition-colors flex items-center space-x-1"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Details</span>
                            </button>
                          </td>
                    </tr>
                      ))
                    )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Past Orders</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Order ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Specifications</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Payment</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Quantity</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Total (ETB)</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                    {pastOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No past orders found
                        </td>
                      </tr>
                    ) : (
                      pastOrders.map((order) => (
                        <tr key={order.order_id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">#{order.order_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{order.product_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {order.is_custom_size 
                              ? `${order.length}×${order.width}×${order.height}` 
                              : order.standard_size
                            }
                          </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{order.payment_status || 'Unpaid'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{order.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(Number(order.order_unit_price) * order.quantity)}</td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleViewDetails(order)}
                              className="text-blue-600 hover:text-blue-800 transition-colors flex items-center space-x-1"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Details</span>
                            </button>
                          </td>
                    </tr>
                      ))
                    )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Search for a Customer</h3>
          <p className="text-gray-600">Enter a customer's name, phone number, or ID to view their order history</p>
        </div>
      )}

      {/* All Customers List Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">All Customers</h2>
            {loadingCustomers && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading customers...</span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">Click on any customer to view their order history</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Location</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Number of Orders</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingCustomers ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                      <span className="text-gray-600">Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : customersWithOrderCounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                customersWithOrderCounts.map((customer) => (
                  <tr 
                    key={customer.customer_id} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <User className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500">ID: {customer.customer_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">{customer.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          customer.orderCount > 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.orderCount} {customer.orderCount === 1 ? 'order' : 'orders'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCustomerSelect(customer);
                        }}
                        className="text-green-600 hover:text-green-800 transition-colors flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {customersWithOrderCounts.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {customersWithOrderCounts.length} customer{customersWithOrderCounts.length !== 1 ? 's' : ''} 
              {' '}with a total of {customersWithOrderCounts.reduce((sum, customer) => sum + customer.orderCount, 0)} orders
            </p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Order Details - #{selectedOrder.order_id}</h2>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="mt-1 text-sm text-gray-600">{selectedOrder.customer_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="mt-1 text-sm text-gray-600">{selectedOrder.customer_phone}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <p className="mt-1 text-sm text-gray-600">{selectedOrder.customer_address}</p>
                  </div>
                </div>
              </div>

              {/* Order Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Order ID</label>
                    <p className="mt-1 text-sm text-gray-600">#{selectedOrder.order_id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Product</label>
                    <p className="mt-1 text-sm text-gray-600">{selectedOrder.product_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Specifications</label>
                    <p className="mt-1 text-sm text-gray-600">
                      {selectedOrder.is_custom_size 
                        ? `${selectedOrder.length}×${selectedOrder.width}×${selectedOrder.height}` 
                        : selectedOrder.standard_size
                      }
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <p className="mt-1 text-sm text-gray-600">{selectedOrder.quantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Unit Price</label>
                    <p className="mt-1 text-sm text-gray-600">{formatCurrency(Number(selectedOrder.order_unit_price))}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                    <p className="mt-1 text-sm text-gray-600">{formatCurrency(Number(selectedOrder.order_unit_price) * selectedOrder.quantity)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Order Date</label>
                    <p className="mt-1 text-sm text-gray-600">{new Date(selectedOrder.order_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Delivery Date</label>
                    <p className="mt-1 text-sm text-gray-600">{new Date(selectedOrder.delivery_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Status</label>
                    <p className="mt-1 text-sm text-gray-600">{selectedOrder.payment_status || 'Unpaid'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Paid</label>
                    <p className="mt-1 text-sm text-gray-600">{formatCurrency(selectedOrder.total_paid || 0)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Outstanding</label>
                    <p className="mt-1 text-sm text-gray-600">{formatCurrency(selectedOrder.outstanding || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200">
      <button
                onClick={() => setShowOrderDetails(false)}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
      >
                Close
      </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerHistory;