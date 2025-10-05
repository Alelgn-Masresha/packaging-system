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
  stock_quantity?: number;
}

interface MaterialRequirement {
  material_id: number;
  material_name: string;
  current_stock: number;
  unit: string;
  amount_per_unit: number;
  total_required: number;
  sufficient: boolean;
}

const CustomersOrders: React.FC = () => {
  const [showNewOrder, setShowNewOrder] = useState(false);
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
    products: [{
    product: '',
    quantity: '',
    unitPrice: '',
    total: '',
      amountPerUnit: '',
      is_custom_size: false,
      order_from_stock: false,
    length: '',
    width: '',
    height: '',
    }],
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

  const handleProductFieldChange = (index: number, field: string, value: string) => {
    setOrderForm(prev => {
      const updatedProducts = [...prev.products];
      
      if (field === 'is_custom_size') {
        updatedProducts[index] = { ...updatedProducts[index], is_custom_size: value === 'true' };
      } else if (field === 'order_from_stock') {
        updatedProducts[index] = { ...updatedProducts[index], order_from_stock: value === 'true' };
      } else {
        updatedProducts[index] = { ...updatedProducts[index], [field]: value };
      }
      
      // Auto-fill unit price when product is selected
      if (field === 'product' && value) {
        const selectedProduct = products.find(p => p.product_id.toString() === value);
        if (selectedProduct) {
          const base = Number(selectedProduct.base_price);
          updatedProducts[index].unitPrice = Number.isNaN(base) ? '' : base.toString();
        }
      }
      
      // Calculate total if quantity and unit price are provided
      if (field === 'quantity' || field === 'unitPrice' || field === 'product') {
        const quantity = updatedProducts[index].quantity;
        let unitPrice = updatedProducts[index].unitPrice;
        
        // Auto-fill unit price if product changed
        if (field === 'product' && value) {
          const selectedProduct = products.find(p => p.product_id.toString() === value);
          if (selectedProduct) {
            const base = Number(selectedProduct.base_price);
            unitPrice = Number.isNaN(base) ? '' : base.toString();
            updatedProducts[index].unitPrice = unitPrice;
          }
        }
        
        if (quantity && unitPrice) {
          updatedProducts[index].total = (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2);
        }
      }
      
      return { ...prev, products: updatedProducts };
    });
  };

  const handleAddProduct = () => {
    setOrderForm(prev => ({
      ...prev,
      products: [...prev.products, { product: '', quantity: '', unitPrice: '', total: '', amountPerUnit: '', is_custom_size: false, order_from_stock: false, length: '', width: '', height: '' }]
    }));
  };

  const handleRemoveProduct = (index: number) => {
    setOrderForm(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const handleSaveOrder = async () => {
    // Validate products
    const validProducts = orderForm.products.filter(p => p.product && p.quantity && p.unitPrice);
    if (!currentCustomer || validProducts.length === 0 || !orderForm.deliveryDate) {
      setError('Please fill in customer, at least one product with quantity, and delivery date');
      return;
    }

    // Check product stock for products that ARE ordered from stock
    for (const prod of validProducts) {
      if (prod.order_from_stock) {
        const selectedProduct = products.find(p => p.product_id.toString() === prod.product);
        const requestedQuantity = parseInt(prod.quantity);
        const availableStock = selectedProduct?.stock_quantity || 0;
        
        if (requestedQuantity > availableStock) {
          setError(`Insufficient product stock for ${selectedProduct?.name}: Requested ${requestedQuantity}, but only have ${availableStock} in stock`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      // Check raw material requirements for products that are NOT ordered from stock
      for (const prod of validProducts) {
        if (!prod.order_from_stock) {
          const materialCheck = await ordersAPI.checkMaterials(
              parseInt(prod.product),
              parseInt(prod.quantity),
              prod.is_custom_size && prod.amountPerUnit ? prod.amountPerUnit : undefined
          );

          if (materialCheck.data.has_insufficient) {
            const warningMessages = materialCheck.data.insufficient_materials.map((req: MaterialRequirement) => 
              `Insufficient ${req.material_name}: Need ${req.total_required} ${req.unit}, but only have ${req.current_stock} ${req.unit}`
            );
            setError(`You don't have enough materials:\n${warningMessages.join('\n')}`);
            return;
          }
        }
      }

      // Create order with multiple products
      const orderResponse = await ordersAPI.create({
        customer_id: currentCustomer.customer_id,
        delivery_date: orderForm.deliveryDate,
        products: validProducts.map(p => ({
          product_id: parseInt(p.product),
          quantity: parseInt(p.quantity),
          order_unit_price: parseFloat(p.unitPrice),
          amount_per_unit: p.is_custom_size && p.amountPerUnit ? parseFloat(p.amountPerUnit) : undefined,
          is_custom_size: p.is_custom_size,
          order_from_stock: p.order_from_stock,
          length: p.is_custom_size && p.length ? parseFloat(p.length) : undefined,
          width: p.is_custom_size && p.width ? parseFloat(p.width) : undefined,
          height: p.is_custom_size && p.height ? parseFloat(p.height) : undefined,
        })),
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
        products: [{
        product: '',
        quantity: '',
        unitPrice: '',
        total: '',
          amountPerUnit: '',
          is_custom_size: false,
          order_from_stock: false,
        length: '',
        width: '',
        height: '',
        }],
        deliveryDate: '',
        paymentAmount: '',
        referenceNumber: '',
      });

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
              <p className="text-red-800 whitespace-pre-line">{error}</p>
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
            {/* Products Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">Products:</label>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="flex items-center space-x-1 text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>
              
              {orderForm.products.map((productItem, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Product #{index + 1}</h3>
                    {orderForm.products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">Product:</label>
              <select 
                        value={productItem.product}
                        onChange={(e) => handleProductFieldChange(index, 'product', e.target.value)}
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

                    <div className="mb-3">
                <label className="flex items-center">
                  <input
                          type="checkbox"
                          checked={productItem.is_custom_size}
                          onChange={(e) => handleProductFieldChange(index, 'is_custom_size', e.target.checked ? 'true' : 'false')}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Custom Size</span>
                </label>
            </div>

                    <div className="mb-3">
                <label className="flex items-center">
                  <input
                          type="checkbox"
                          checked={productItem.order_from_stock}
                          onChange={(e) => handleProductFieldChange(index, 'order_from_stock', e.target.checked ? 'true' : 'false')}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Order from Stock (subtract from product stock instead of raw materials)</span>
                </label>
            </div>

                    {productItem.is_custom_size && (
                      <div className="grid grid-cols-3 gap-3 mb-4 bg-white p-3 rounded border border-gray-300">
                  <div>
                          <label className="block text-xs text-gray-600 mb-1">Length:</label>
                    <input
                            type="number"
                            step="0.01"
                            value={productItem.length}
                            onChange={(e) => handleProductFieldChange(index, 'length', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="L"
                    />
                  </div>
                  <div>
                          <label className="block text-xs text-gray-600 mb-1">Width:</label>
                    <input
                            type="number"
                            step="0.01"
                            value={productItem.width}
                            onChange={(e) => handleProductFieldChange(index, 'width', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="W"
                    />
                  </div>
                  <div>
                          <label className="block text-xs text-gray-600 mb-1">Height:</label>
                    <input
                      type="number"
                      step="0.01"
                            value={productItem.height}
                            onChange={(e) => handleProductFieldChange(index, 'height', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="H"
                          />
                    </div>
                  </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Quantity:</label>
                <input
                  type="number"
                          value={productItem.quantity}
                          onChange={(e) => handleProductFieldChange(index, 'quantity', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {productItem.order_from_stock && productItem.product && productItem.quantity && (() => {
                  const selectedProduct = products.find(p => p.product_id.toString() === productItem.product);
                  const requestedQuantity = parseInt(productItem.quantity);
                  const availableStock = selectedProduct?.stock_quantity || 0;
                  const isInsufficient = requestedQuantity > availableStock;
                  
                  return isInsufficient ? (
                    <div className="mt-1 text-sm text-red-600 flex items-center">
                      <span className="mr-1">⚠️</span>
                      <span>Insufficient product stock. Available: {availableStock}</span>
                    </div>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Unit Price:</label>
                <input
                  type="number"
                  step="0.01"
                          value={productItem.unitPrice}
                          onChange={(e) => handleProductFieldChange(index, 'unitPrice', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Total:</label>
                <input
                  type="text"
                          value={productItem.total}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                  readOnly
                />
              </div>
            </div>
                    
                    {productItem.is_custom_size && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Amount per Unit (Raw Material):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={productItem.amountPerUnit}
                          onChange={(e) => handleProductFieldChange(index, 'amountPerUnit', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Raw material amount"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Order Grand Total */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Order Grand Total:</span>
                  <span className="text-lg font-bold text-blue-900">
                    ETB {orderForm.products.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0).toFixed(2)}
                  </span>
                </div>
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
                onChange={(e) => setOrderForm({ ...orderForm, deliveryDate: e.target.value })}
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
                    onChange={(e) => setOrderForm({ ...orderForm, paymentAmount: e.target.value })}
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
                    onChange={(e) => setOrderForm({ ...orderForm, referenceNumber: e.target.value })}
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