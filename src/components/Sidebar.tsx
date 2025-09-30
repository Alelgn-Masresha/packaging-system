import React from 'react';
import { BarChart3, Users, Package, History, Tag, FileText, Warehouse } from 'lucide-react';
import { useI18n } from '../i18n';
import stepLogo from '../public/step_logo.png';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, onClose }) => {
  const { t } = useI18n();
  const menuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: BarChart3 },
    { id: 'customers', label: t('customers_orders'), icon: Users },
    { id: 'track', label: t('track_orders'), icon: Package },
    { id: 'history', label: t('customer_history'), icon: History },
    { id: 'products', label: t('products'), icon: Tag },
    { id: 'inventory', label: t('inventory_management'), icon: Warehouse },
    { id: 'reports', label: t('reports'), icon: FileText },
  ];

  return (
    <div className="w-64 bg-gray-100 shadow-sm border-r border-gray-300 md:h-screen md:fixed md:left-0 md:top-0 md:z-40">
      <div className="p-6 border-b border-gray-300 bg-gradient-to-r from-green-500 to-green-600">
        <div className="flex items-center space-x-2">
          <img src={stepLogo} alt="STEP Packaging" className="h-10" />
        <div>
            <h1 className="text-lg font-semibold text-white">Packaging</h1>
            <p className="text-sm text-green-100">Printing System</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                onViewChange(item.id);
                onClose && onClose();
              }}
              className={`w-full flex items-center px-6 py-3 text-left text-sm font-medium transition-colors ${
                activeView === item.id
                  ? 'bg-green-600 text-white border-r-4 border-green-500'
                  : 'text-gray-700 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;