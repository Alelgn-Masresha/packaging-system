import React, { useState, useEffect } from 'react';
import { X, Filter, Loader2 } from 'lucide-react';
import { ordersAPI, paymentsAPI } from '../services/api';

interface Order {
  order_id: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  product_name: string;
  standard_size: string;
  base_price: number;
  order_unit_price: number;
  quantity: number;
  is_custom_size: boolean;
  length?: number;
  width?: number;
  height?: number;
  status: string;
  order_date: string;
  delivery_date: string;
  payments?: Payment[];
}

interface Payment {
  payment_id: number;
  amount: number;
  payment_date: string;
  reference_number?: string;
  type: 'Advance' | 'Final';
}

interface OrderWithPaymentStatus extends Order {
  payment_status: string;
  total_paid: number;
  outstanding: number;
}

const TrackOrders: React.FC = () => {
  const [orders, setOrders] = useState<OrderWithPaymentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithPaymentStatus | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('Advance');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('All');
  const [deliveryDateFilter, setDeliveryDateFilter] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<OrderWithPaymentStatus[]>([]);

  // Load orders on component mount
  useEffect(() => {
    loadOrders();
  }, []);

  // Initialize filtered orders when orders change
  useEffect(() => {
    setFilteredOrders(orders);
  }, [orders]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ordersAPI.getAll();
      
      // Calculate payment status for each order
      const ordersWithPaymentStatus = await Promise.all(
        response.data.map(async (order: Order) => {
          try {
            const paymentSummary = await paymentsAPI.getOrderSummary(order.order_id);
            const paymentData = paymentSummary.data.payment_summary;
            
            return {
              ...order,
              payment_status: paymentData.payment_status,
              total_paid: paymentData.total_paid,
              outstanding: paymentData.outstanding,
            } as OrderWithPaymentStatus;
          } catch (err) {
            // If no payments found, set default values
            return {
              ...order,
              payment_status: 'Unpaid',
              total_paid: 0,
              outstanding: order.order_unit_price * order.quantity,
            } as OrderWithPaymentStatus;
          }
        })
      );
      
      // Filter out delivered and cancelled orders
      const activeOrders = ordersWithPaymentStatus.filter(order => 
        !['Delivered', 'Cancelled'].includes(order.status)
      );
      
      setOrders(activeOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress':
        return 'text-blue-600 bg-blue-50';
      case 'Pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'Completed':
        return 'text-green-600 bg-green-50';
      case 'Delivered':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPaymentColor = (payment: string) => {
    switch (payment) {
      case 'Paid':
        return 'text-green-600 bg-green-50';
      case 'Partial':
        return 'text-yellow-600 bg-yellow-50';
      case 'Unpaid':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleUpdateStatus = (order: OrderWithPaymentStatus) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setShowStatusModal(true);
  };

  const handleRecordPayment = (order: OrderWithPaymentStatus) => {
    setSelectedOrder(order);
    setPaymentAmount('');
    // If order is partially paid, default to Final payment, otherwise Advance
    setPaymentType(order.payment_status === 'Partial' ? 'Final' : 'Advance');
    setReferenceNumber('');
    setShowPaymentModal(true);
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrder && newStatus) {
      try {
        setSubmitting(true);
        setError(null);
        
        await ordersAPI.updateStatus(selectedOrder.order_id, newStatus);
        
        // Reload orders to get updated data
        await loadOrders();
        
        setShowStatusModal(false);
        setSelectedOrder(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update order status');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handlePaymentRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrder && paymentAmount && referenceNumber) {
      try {
        setSubmitting(true);
        setError(null);
        
        await paymentsAPI.create({
          order_id: selectedOrder.order_id,
          amount: parseFloat(paymentAmount),
          reference_number: referenceNumber,
          type: paymentType as 'Advance' | 'Final',
        });
        
        // Reload orders to get updated payment status
        await loadOrders();
        
        setShowPaymentModal(false);
        setSelectedOrder(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record payment');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const applyFilters = (ordersToFilter: OrderWithPaymentStatus[], status: string, deliveryDate: string) => {
    let filtered = ordersToFilter;

    // Filter by status
    if (status !== 'All') {
      filtered = filtered.filter(order => order.status === status);
    }

    // Filter by delivery date
    if (deliveryDate) {
      filtered = filtered.filter(order => order.delivery_date === deliveryDate);
    }

    setFilteredOrders(filtered);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    applyFilters(orders, status, deliveryDateFilter);
  };

  const handleDeliveryDateFilterChange = (date: string) => {
    setDeliveryDateFilter(date);
    applyFilters(orders, statusFilter, date);
  };

  const clearFilters = () => {
    setStatusFilter('All');
    setDeliveryDateFilter('');
    setFilteredOrders(orders);
  };

  // Helper function to check if an order is discounted
  const isOrderDiscounted = (order: OrderWithPaymentStatus): boolean => {
    return order.order_unit_price < order.base_price;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Track & Manage Orders</h1>
        <p className="text-gray-600">Monitor order status and manage payments</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Delivery Date:</label>
            <input
              type="date"
              value={deliveryDateFilter}
              onChange={(e) => handleDeliveryDateFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={clearFilters}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
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
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                      <span className="text-gray-600">Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    No orders found
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
                      {order.is_custom_size 
                        ? `${order.length}×${order.width}×${order.height}` 
                        : order.standard_size
                      }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentColor(order.payment_status)}`}>
                        {order.payment_status}
                    </span>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(order.delivery_date).toLocaleDateString()}
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button 
                        onClick={() => handleUpdateStatus(order)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                      >
                      Update Status
                    </button>
                      <button 
                        onClick={() => handleRecordPayment(order)}
                        disabled={order.payment_status === 'Paid'}
                        className={`px-3 py-1 rounded text-xs transition-colors ${
                          order.payment_status === 'Paid' 
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                      Record Payment
                    </button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Update Order Status</h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleStatusUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order: #{selectedOrder?.order_id} - {selectedOrder?.customer_name}
                </label>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Update Status</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
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

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Record Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handlePaymentRecord} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order: #{selectedOrder?.order_id} - {selectedOrder?.customer_name}
                </label>
                <div className="text-sm text-gray-600">
                  <p>Total Order Value: ETB {(selectedOrder?.order_unit_price || 0) * (selectedOrder?.quantity || 0)}</p>
                  <p>Total Paid: ETB {selectedOrder?.total_paid || 0}</p>
                  <p>Outstanding: ETB {selectedOrder?.outstanding || 0}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Type
                </label>
                {selectedOrder?.payment_status === 'Partial' && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> This order already has an advance payment. Only final payments can be recorded now.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className={`flex items-center ${selectedOrder?.payment_status === 'Partial' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="paymentType"
                      value="Advance"
                      checked={paymentType === 'Advance'}
                      onChange={(e) => setPaymentType(e.target.value)}
                      disabled={selectedOrder?.payment_status === 'Partial'}
                      className="mr-3"
                    />
                    <span>Advance Payment</span>
                    {selectedOrder?.payment_status === 'Partial' && (
                      <span className="ml-2 text-xs text-gray-500">(Already received)</span>
                    )}
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentType"
                      value="Final"
                      checked={paymentType === 'Final'}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className="mr-3"
                    />
                    <span>Final Payment</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">ETB</span>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter reference number"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Record Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
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

export default TrackOrders;