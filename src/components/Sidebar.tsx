import React from 'react';
import { BarChart3, Users, Package, History, Tag, FileText } from 'lucide-react';
import stepLogo from '../public/step_logo.png';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, onClose }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'customers', label: 'Customers & Orders', icon: Users },
    { id: 'track', label: 'Track Orders', icon: Package },
    { id: 'history', label: 'Customer History', icon: History },
    { id: 'products', label: 'Products', icon: Tag },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <div className="w-64 h-full bg-gray-100 shadow-sm border-r border-gray-300 md:h-auto">
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