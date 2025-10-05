import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import CustomersOrders from './components/CustomersOrders';
import TrackOrders from './components/TrackOrders';
import CustomerHistory from './components/CustomerHistory';
import Products from './components/Products';
import Reports from './components/Reports';
import InventoryManagement from './components/InventoryManagement';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveView} />;
      case 'customers':
      case 'customers-orders':
        return <CustomersOrders />;
      case 'track':
      case 'track-orders':
        return <TrackOrders />;
      case 'history':
        return <CustomerHistory onBackToDashboard={() => setActiveView('dashboard')} />;
      case 'products':
        return <Products />;
      case 'inventory':
        return <InventoryManagement />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (drawer on mobile) */}
      <div
        className={`fixed h-full inset-y-0 left-0 bottom-0 z-50 transform transition-transform duration-200 ease-in-out md:translate-x-0 w-64 bg-gray-100 ${
          isSidebarOpen ? 'translate-x-0 top-20' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar
          activeView={activeView}
          onViewChange={(view) => {
            setActiveView(view);
            setIsSidebarOpen(false);
          }}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col mt-0 md:mt-20 md:ml-64">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto pt-32">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default App;