import React, { useState, useEffect } from 'react';
import { Search, X, Plus, Loader2 } from 'lucide-react';
import { customersAPI, productsAPI, ordersAPI, paymentsAPI } from '../services/api';

interface Customer {
  customer_id: number;
  name: string;
  phone: string;
  address: string;
}

interface Product {
  product_id: number;
  name: string;
  standard_size: string;
  base_price: string | number; // Can come as string from API or number
}

const CustomersOrders: React.FC = () => {
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [sizeType, setSizeType] = useState('standard');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [customerNotFound, setCustomerNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    address: '',
  });
  const [orderForm, setOrderForm] = useState({
    product: '',
    quantity: '',
    unitPrice: '',
    total: '',
    length: '',
    width: '',
    height: '',
    deliveryDate: '',
    paymentAmount: '',
    referenceNumber: '',
  });

  // Load products on component mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const response = await customersAPI.search(searchQuery);
      
      if (response.data.length > 0) {
        setCurrentCustomer(response.data[0]); // Take first result
        setCustomerNotFound(false);
      } else {
        setCurrentCustomer(null);
        setCustomerNotFound(true);
      }
      setShowSuggestions(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search customers');
      setCurrentCustomer(null);
      setCustomerNotFound(true);
    } finally {
      setLoading(false);
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
      setCustomerNotFound(false);
    }
  };

  const handleSuggestionSelect = (customer: Customer) => {
    setCurrentCustomer(customer);
    setCustomerNotFound(false);
    setSearchQuery(`${customer.name} (${customer.phone})`);
    setShowSuggestions(false);
  };

  const handleAddNewCustomerClick = () => {
    setShowAddCustomer(true);
    setShowSuggestions(false);
  };

  const handleAddCustomer = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const response = await customersAPI.create({
        name: newCustomer.name,
        phone: newCustomer.phone,
        address: newCustomer.address,
      });
      
      setCurrentCustomer(response.data);
      setCustomerNotFound(false);
      setShowAddCustomer(false);
      setNewCustomer({ name: '', phone: '', address: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOrderFormChange = (field: string, value: string) => {
    setOrderForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-fill unit price when product is selected
      if (field === 'product' && value) {
        const selectedProduct = products.find(p => p.product_id.toString() === value);
        if (selectedProduct) {
          const base = Number(selectedProduct.base_price);
          updated.unitPrice = Number.isNaN(base) ? '' : base.toString();
        }
      }
      
      // Calculate total if quantity and unit price are provided
      if (field === 'quantity' || field === 'unitPrice' || field === 'product') {
        const quantity = field === 'quantity' ? value : prev.quantity;
        let unitPrice = field === 'unitPrice' ? value : prev.unitPrice;
        
        // Auto-fill unit price if product changed
        if (field === 'product' && value) {
          const selectedProduct = products.find(p => p.product_id.toString() === value);
          if (selectedProduct) {
            const base = Number(selectedProduct.base_price);
            unitPrice = Number.isNaN(base) ? '' : base.toString();
          }
        }
        
        if (quantity && unitPrice) {
          updated.total = (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2);
        }
      }
      
      return updated;
    });
  };

  const handleSaveOrder = async () => {
    if (!currentCustomer || !orderForm.product || !orderForm.quantity || !orderForm.deliveryDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Create order
      const orderResponse = await ordersAPI.create({
        customer_id: currentCustomer.customer_id,
        product_id: parseInt(orderForm.product),
        delivery_date: orderForm.deliveryDate,
        quantity: parseInt(orderForm.quantity),
        order_unit_price: parseFloat(orderForm.unitPrice),
        is_custom_size: sizeType === 'custom',
        length: sizeType === 'custom' ? parseFloat(orderForm.length) : undefined,
        width: sizeType === 'custom' ? parseFloat(orderForm.width) : undefined,
        height: sizeType === 'custom' ? parseFloat(orderForm.height) : undefined,
      });

      // Create payment if payment amount is provided
      if (orderForm.paymentAmount && parseFloat(orderForm.paymentAmount) > 0) {
        await paymentsAPI.create({
          order_id: orderResponse.data.order_id,
          amount: parseFloat(orderForm.paymentAmount),
          reference_number: orderForm.referenceNumber,
          type: 'Advance', // Initial payment is always advance
        });
      }

      // Reset form
      setShowNewOrder(false);
      setOrderForm({
        product: '',
        quantity: '',
        unitPrice: '',
        total: '',
        length: '',
        width: '',
        height: '',
        deliveryDate: '',
        paymentAmount: '',
        referenceNumber: '',
      });
      setSizeType('standard');

      // Show success message or redirect
      alert('Order created successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Customers & Orders</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search Customer by Phone / Name / ID"
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    <div className="px-4 py-3">
                      <div className="text-gray-600 mb-2">No customers found</div>
                      <button
                        onClick={handleAddNewCustomerClick}
                        className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Customer</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              <span>Search</span>
            </button>
          </div>

          {customerNotFound ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">
                <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-lg font-medium">Customer not found</p>
                <p className="text-sm">No customer found with the provided search criteria</p>
              </div>
              <button
                onClick={() => setShowAddCustomer(true)}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                <span>Add New Customer</span>
              </button>
            </div>
          ) : currentCustomer ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-gray-900">Customer ID:</span>
                    <span className="ml-2 text-gray-600">{currentCustomer.customer_id}</span>
                  </div>
            <div>
              <span className="font-medium text-gray-900">Customer:</span>
                    <span className="ml-2 text-gray-600">{currentCustomer.name}</span>
            </div>
            <div>
              <span className="font-medium text-gray-900">Phone:</span>
                    <span className="ml-2 text-gray-600">{currentCustomer.phone}</span>
            </div>
            <div>
              <span className="font-medium text-gray-900">Address:</span>
                    <span className="ml-2 text-gray-600">{currentCustomer.address}</span>
                  </div>
            </div>
          </div>

          <button
            onClick={() => setShowNewOrder(!showNewOrder)}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Create New Order
          </button>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Search for a customer to view their information and create orders</p>
            </div>
          )}
        </div>
      </div>

      {showNewOrder && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">New Order</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product:</label>
              <select 
                value={orderForm.product}
                onChange={(e) => handleOrderFormChange('product', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select Product</option>
                {products.map((product) => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.name} - {product.standard_size} (ETB {Number(product.base_price).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">Size Type:</label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="sizeType"
                    value="standard"
                    checked={sizeType === 'standard'}
                    onChange={(e) => setSizeType(e.target.value)}
                    className="mr-3"
                  />
                  <span>Standard (Predefined Size & Price)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="sizeType"
                    value="custom"
                    checked={sizeType === 'custom'}
                    onChange={(e) => setSizeType(e.target.value)}
                    className="mr-3"
                  />
                  <span>Custom</span>
                </label>
              </div>
            </div>

            {sizeType === 'custom' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Length:</label>
                  <input
                    type="text"
                    value={orderForm.length}
                    onChange={(e) => handleOrderFormChange('length', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Width:</label>
                  <input
                    type="text"
                    value={orderForm.width}
                    onChange={(e) => handleOrderFormChange('width', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Height:</label>
                  <input
                    type="text"
                    value={orderForm.height}
                    onChange={(e) => handleOrderFormChange('height', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Quantity:</label>
                <input
                  type="number"
                  value={orderForm.quantity}
                  onChange={(e) => handleOrderFormChange('quantity', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Unit Price:</label>
                <input
                  type="number"
                  step="0.01"
                  value={orderForm.unitPrice}
                  onChange={(e) => handleOrderFormChange('unitPrice', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Total:</label>
                <input
                  type="text"
                  value={orderForm.total}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  readOnly
                />
              </div>
            </div>

            {/* Delivery Date Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Date
              </label>
              <input
                type="date"
                value={orderForm.deliveryDate}
                onChange={(e) => handleOrderFormChange('deliveryDate', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Payment Information Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount (Birr)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={orderForm.paymentAmount}
                    onChange={(e) => handleOrderFormChange('paymentAmount', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={orderForm.referenceNumber}
                    onChange={(e) => handleOrderFormChange('referenceNumber', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter reference number"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button 
                onClick={handleSaveOrder}
                disabled={submitting}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Save Order</span>
              </button>
              <button
                onClick={() => setShowNewOrder(false)}
                disabled={submitting}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Customer</h2>
              <button
                onClick={() => setShowAddCustomer(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleAddCustomer(); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0912345678"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
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
                  <span>Add Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(false)}
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

export default CustomersOrders;