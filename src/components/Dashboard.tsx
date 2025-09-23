import React, { useState, useEffect } from 'react';
import { Plus, Package, Tag, Users, ShoppingCart, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { customersAPI, ordersAPI, productsAPI, paymentsAPI } from '../services/api';

interface DashboardProps {
  onNavigate?: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeOrders: 0,
    pendingPayments: 0,
    deliveredOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      const [customersRes, ordersRes, productsRes] = await Promise.all([
        customersAPI.getAll(),
        ordersAPI.getAll(),
        productsAPI.getAll(),
      ]);

      const customers = customersRes.data;
      const orders = ordersRes.data;
      const products = productsRes.data;

      // Calculate stats
      const totalCustomers = customers.length;
      const activeOrders = orders.filter(order => 
        ['Pending', 'In Progress'].includes(order.status)
      ).length;
      const deliveredOrders = orders.filter(order => 
        order.status === 'Delivered' || order.status === 'Completed'
      ).length;

      // Calculate pending payments (orders with Partial payment status)
      let pendingPayments = 0;
      for (const order of orders) {
        try {
          const paymentSummary = await paymentsAPI.getOrderSummary(order.order_id);
          if (paymentSummary.data.payment_summary.payment_status === 'Partial') {
            pendingPayments++;
          }
        } catch (err) {
          // If no payment summary, consider it unpaid
          if (order.status !== 'Cancelled') {
            pendingPayments++;
          }
        }
      }

      setStats({
        totalCustomers,
        activeOrders,
        pendingPayments,
        deliveredOrders,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (view: string) => {
    if (onNavigate) {
      onNavigate(view);
    }
  };

  const statsData = [
    { 
      label: 'Total Customers', 
      value: stats.totalCustomers.toString(), 
      icon: Users, 
      bgColor: 'bg-green-50', 
      iconColor: 'text-green-600' 
    },
    { 
      label: 'Active Orders', 
      value: stats.activeOrders.toString(), 
      icon: ShoppingCart, 
      bgColor: 'bg-green-100', 
      iconColor: 'text-green-700' 
    },
    { 
      label: 'Pending Payments', 
      value: stats.pendingPayments.toString(), 
      icon: Clock, 
      bgColor: 'bg-yellow-50', 
      iconColor: 'text-yellow-600' 
    },
    { 
      label: 'Delivered Orders', 
      value: stats.deliveredOrders.toString(), 
      icon: CheckCircle, 
      bgColor: 'bg-green-50', 
      iconColor: 'text-green-600' 
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to STEP Packaging & Printing System
        </h1>
        <p className="text-gray-600">Manage your packaging business efficiently</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
          >
            Retry
          </button>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions:</h2>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => handleNavigation('customers-orders')}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Order</span>
          </button>
          <button 
            onClick={() => handleNavigation('track-orders')}
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors flex items-center space-x-2"
          >
            <Package className="w-5 h-5" />
            <span>Track Orders</span>
          </button>
          <button 
            onClick={() => handleNavigation('products')}
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors flex items-center space-x-2"
          >
            <Tag className="w-5 h-5" />
            <span>Manage Products</span>
          </button>
          <button 
            onClick={() => handleNavigation('reports')}
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors flex items-center space-x-2"
          >
            <Package className="w-5 h-5" />
            <span>View Reports</span>
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Business Summary:</h2>
          {loading && (
            <div className="flex items-center space-x-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsData.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {loading ? '-' : stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    ) : (
                      <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;