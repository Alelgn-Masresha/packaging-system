import React, { useState, useEffect } from 'react';
import { Bell, User, X, Clock, AlertTriangle, Info, Loader2, Menu } from 'lucide-react';
import { useI18n } from '../i18n';
import { ordersAPI, rawMaterialsAPI } from '../services/api';

interface Notification {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
  orderId?: number;
}

interface Order {
  order_id: number;
  customer_name: string;
  product_name: string;
  delivery_date: string;
  status: string;
}

interface RawMaterial {
  material_id: number;
  material_name: string;
  current_stock: number;
  min_stock: number;
  unit: string;
  status: 'Available' | 'Low Stock' | 'Out of Stock';
}

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
    // Refresh notifications every 5 minutes
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const [ordersRes, lowStockRes] = await Promise.all([
        ordersAPI.getAll(),
        rawMaterialsAPI.getLowStock().catch(() => ({ data: [] }))
      ]);
      const orders: Order[] = ordersRes.data;
      const lowStock: RawMaterial[] = lowStockRes.data || [];
      
      const today = new Date();
      const notificationsList: Notification[] = [];

      orders.forEach((order) => {
        const deliveryDate = new Date(order.delivery_date);
        const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Skip cancelled orders only
        if (['Cancelled', 'Delivered'].includes(order.status)) return;

        // Missed deliveries (past due date and not completed/delivered)
        if (deliveryDate < today && !['Completed', 'Delivered'].includes(order.status)) {
          notificationsList.push({
            id: `missed-${order.order_id}`,
            type: 'error',
            title: t('notif_missed_title'),
            message: tp('notif_missed_msg', { orderId: order.order_id, customer: order.customer_name, days: Math.abs(daysUntilDelivery) }),
            time: formatTimeAgo(deliveryDate),
            read: false,
            orderId: order.order_id,
          });
        }
        // Due today
        else if (daysUntilDelivery === 0) {
          notificationsList.push({
            id: `due-today-${order.order_id}`,
            type: 'warning',
            title: t('notif_due_today_title'),
            message: tp('notif_due_today_msg', { orderId: order.order_id, customer: order.customer_name }),
            time: 'Today',
            read: false,
            orderId: order.order_id,
          });
        }
        // 1 day left
        else if (daysUntilDelivery === 1) {
          notificationsList.push({
            id: `1-day-${order.order_id}`,
            type: 'warning',
            title: t('notif_1day_title'),
            message: tp('notif_1day_msg', { orderId: order.order_id, customer: order.customer_name }),
            time: '1 day left',
            read: false,
            orderId: order.order_id,
          });
        }
        // 2 days left
        else if (daysUntilDelivery === 2) {
          notificationsList.push({
            id: `2-day-${order.order_id}`,
            type: 'info',
            title: t('notif_2day_title'),
            message: tp('notif_2day_msg', { orderId: order.order_id, customer: order.customer_name }),
            time: '2 days left',
            read: false,
            orderId: order.order_id,
          });
        }
        // 3 days left
        else if (daysUntilDelivery === 3) {
          notificationsList.push({
            id: `3-day-${order.order_id}`,
            type: 'info',
            title: t('notif_3day_title'),
            message: tp('notif_3day_msg', { orderId: order.order_id, customer: order.customer_name }),
            time: '3 days left',
            read: false,
            orderId: order.order_id,
          });
        }
      });

      // Add low stock / out of stock notifications
      lowStock.forEach((rm) => {
        const isOut = rm.status === 'Out of Stock';
        notificationsList.push({
          id: `rm-${rm.material_id}`,
          type: isOut ? 'error' : 'warning',
          title: isOut ? t('notif_material_out_title') : t('notif_material_low_title'),
          message: tp('notif_material_msg', { name: rm.material_name, current: rm.current_stock, unit: rm.unit, min: rm.min_stock }),
          time: 'Now',
          read: false,
        });
      });

      // Sort notifications by priority: missed/out of stock > due today/low stock > info
      notificationsList.sort((a, b) => {
        const priorityOrder = { 'error': 0, 'warning': 1, 'info': 2 };
        return priorityOrder[a.type] - priorityOrder[b.type];
      });

      setNotifications(notificationsList);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <Clock className="w-4 h-4" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      case 'info':
        return <Info className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(notification => ({ ...notification, read: true })));
  };

  const { t, tp, lang, setLang } = useI18n();

  return (
    <header className="z-50 bg-white shadow-sm border-b border-gray-300 fixed md:left-0 md:right-0 md:top-0">
      <div className="flex justify-between items-center px-4 md:px-8 py-3 md:py-4">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{t('dashboard')}</h2>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 md:space-x-4">
          {/* Language Switcher */}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
            aria-label={t('language')}
          >
            <option value="en">English</option>
            <option value="am">አማርኛ</option>
          </select>
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">{t('notifications')}</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={loadNotifications}
                        disabled={loading}
                        className="text-sm text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                        title={t('refresh')}
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('refresh')}
                      </button>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {t('mark_all_read')}
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                        <span className="text-gray-600">Loading notifications...</span>
                      </div>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>{t('no_notifications')}</p>
                      <p className="text-xs text-gray-400 mt-1">{t('all_caught_up')}</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => markAsRead(notification.id)}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notification.read ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-full border ${getNotificationColor(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-2">{notification.time}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="p-3 border-t border-gray-200">
                    <button className="w-full text-center text-sm text-blue-600 hover:text-blue-800 transition-colors">
                      {t('view_all_notifications')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-600" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;