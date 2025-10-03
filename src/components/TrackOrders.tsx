import React, { useState, useEffect } from 'react';
import { X, Filter, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { ordersAPI, paymentsAPI } from '../services/api';

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
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: string;
  order_date: string;
  delivery_date: string;
  products: OrderProduct[];
  // Legacy fields (first product)
  product_name?: string;
  standard_size?: string;
  base_price?: number;
  order_unit_price?: number;
  quantity?: number;
  is_custom_size?: boolean;
  length?: number;
  width?: number;
  height?: number;
}


interface OrderWithPaymentStatus extends Order {
  payment_status: string;
  total_paid: number;
  outstanding: number;
  order_total: number;
}

const TrackOrders: React.FC = () => {
  const [orders, setOrders] = useState<OrderWithPaymentStatus[]>([]);
  const { t } = useI18n();
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

            // Calculate total from all products
            const orderTotal = (order.products || []).reduce((sum, p) => 
              sum + (p.order_unit_price * p.quantity), 0
            );
            const totalPaid = parseFloat(String(paymentData.total_paid || 0));
            const outstanding = Math.max(0, orderTotal - totalPaid);
            const paymentStatus = totalPaid <= 0
              ? 'Unpaid'
              : totalPaid >= orderTotal
              ? 'Paid'
              : 'Partial';

            return {
              ...order,
              payment_status: paymentStatus,
              total_paid: totalPaid,
              outstanding,
              order_total: orderTotal,
            } as OrderWithPaymentStatus;
          } catch (err) {
            // If no payments found, set default values
            const orderTotal = (order.products || []).reduce((sum, p) => 
              sum + (p.order_unit_price * p.quantity), 0
            );
            return {
              ...order,
              payment_status: 'Unpaid',
              total_paid: 0,
              outstanding: orderTotal,
              order_total: orderTotal,
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
      // Prevent changing to "Delivered" if payment status is "Partial"
      if (newStatus === 'Delivered' && selectedOrder.payment_status === 'Partial') {
        setError('Not fully paid');
        return;
      }
      
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
                  Products
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid / Outstanding
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
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.products && order.products.length > 0 ? (
                        <div className="space-y-1">
                          {order.products.map((prod, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <span className="font-medium">{prod.product_name}</span>
                              <span className="text-gray-500">×{prod.quantity}</span>
                              {prod.is_custom_size && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                  {prod.length}×{prod.width}×{prod.height}
                                </span>
                              )}
                              {(parseFloat(String(prod.order_unit_price)) < parseFloat(String(prod.base_price)) - 0.01) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ETB {order.order_total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status === 'Pending' ? t('status_pending')
                          : order.status === 'In Progress' ? t('status_in_progress')
                          : order.status === 'Completed' ? t('status_completed')
                          : order.status === 'Delivered' ? t('status_delivered')
                          : order.status === 'Cancelled' ? t('status_cancelled')
                          : order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentColor(order.payment_status)}`}>
                        {order.payment_status === 'Paid' ? t('payment_paid')
                          : order.payment_status === 'Partial' ? t('payment_partial')
                          : order.payment_status === 'Unpaid' ? t('payment_unpaid')
                          : order.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div>ETB {order.total_paid.toFixed(2)}</div>
                      <div className="text-xs text-red-600">ETB {order.outstanding.toFixed(2)}</div>
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
                
                {/* Payment Status Warning */}
                {selectedOrder?.payment_status === 'Partial' && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>Warning:</strong> This order is not fully paid. Cannot change status to "Delivered" until payment is complete.
                    </p>
                  </div>
                )}
                
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
                  <option 
                    value="Delivered" 
                    disabled={selectedOrder?.payment_status === 'Partial'}
                  >
                    Delivered{selectedOrder?.payment_status === 'Partial' ? ' (Not fully paid)' : ''}
                  </option>
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
                
                {/* Order Products Summary */}
                {selectedOrder?.products && selectedOrder.products.length > 0 && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs font-medium text-gray-700 mb-2">Order Items:</div>
                    <div className="space-y-1">
                      {selectedOrder.products.map((prod, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-gray-600">
                          <span>{prod.product_name} ×{prod.quantity}</span>
                          <span>ETB {(prod.order_unit_price * prod.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-gray-600 space-y-1 bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex justify-between">
                    <span className="font-medium">Total Order Value:</span>
                    <span className="font-bold">ETB {selectedOrder?.order_total.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Total Paid:</span>
                    <span>ETB {selectedOrder?.total_paid.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-red-700 font-medium">
                    <span>Outstanding:</span>
                    <span>ETB {selectedOrder?.outstanding.toFixed(2) || '0.00'}</span>
                  </div>
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