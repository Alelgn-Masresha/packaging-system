// API service for STEP Packaging & Printing System
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.1.120:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // PATCH request
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Health check
  async healthCheck() {
    return this.get('/health');
  }
}

// Create singleton instance
const apiService = new ApiService();

// Export API methods for different entities
export const customersAPI = {
  // Get all customers
  getAll: () => apiService.get('/customers'),

  // Get customer by ID
  getById: (id) => apiService.get(`/customers/${id}`),

  // Search customers
  search: (query) => apiService.get(`/customers/search/${encodeURIComponent(query)}`),

  // Create customer
  create: (customerData) => apiService.post('/customers', customerData),

  // Update customer
  update: (id, customerData) => apiService.put(`/customers/${id}`, customerData),

  // Delete customer
  delete: (id) => apiService.delete(`/customers/${id}`),
};

export const productsAPI = {
  // Get all products
  getAll: () => apiService.get('/products'),

  // Get product by ID
  getById: (id) => apiService.get(`/products/${id}`),

  // Search products
  search: (query) => apiService.get(`/products/search/${encodeURIComponent(query)}`),

  // Create product
  create: (productData) => apiService.post('/products', productData),

  // Update product
  update: (id, productData) => apiService.put(`/products/${id}`, productData),

  // Delete product
  delete: (id) => apiService.delete(`/products/${id}`),

  // Add stock to product
  addStock: (id, quantity) => apiService.post(`/products/${id}/stock`, { quantity }),
};

export const ordersAPI = {
  // Get all orders
  getAll: () => apiService.get('/orders'),

  // Get order by ID
  getById: (id) => apiService.get(`/orders/${id}`),

  // Get orders by customer
  getByCustomer: (customerId) => apiService.get(`/orders/customer/${customerId}`),

  // Get orders by status
  getByStatus: (status) => apiService.get(`/orders/status/${status}`),

  // Create order
  create: (orderData) => apiService.post('/orders', orderData),

  // Update order
  update: (id, orderData) => apiService.put(`/orders/${id}`, orderData),

  // Update order status
  updateStatus: (id, status) => apiService.put(`/orders/${id}/status`, { status }),

  // Delete order
  delete: (id) => apiService.delete(`/orders/${id}`),

  // Check raw material requirements
  checkMaterials: (productId, quantity) => apiService.post('/orders/check-materials', { product_id: productId, quantity }),
};

export const paymentsAPI = {
  // Get all payments
  getAll: () => apiService.get('/payments'),

  // Get payment by ID
  getById: (id) => apiService.get(`/payments/${id}`),

  // Get payments by order
  getByOrder: (orderId) => apiService.get(`/payments/order/${orderId}`),

  // Get payments by type
  getByType: (type) => apiService.get(`/payments/type/${type}`),

  // Get payment summary for order
  getOrderSummary: (orderId) => apiService.get(`/payments/order/${orderId}/summary`),

  // Create payment
  create: (paymentData) => apiService.post('/payments', paymentData),

  // Update payment
  update: (id, paymentData) => apiService.put(`/payments/${id}`, paymentData),

  // Delete payment
  delete: (id) => apiService.delete(`/payments/${id}`),
};

// Raw Materials API
export const rawMaterialsAPI = {
  // Get all raw materials
  getAll: () => apiService.get('/raw-materials'),

  // Get raw material by ID
  getById: (id) => apiService.get(`/raw-materials/${id}`),

  // Search raw materials by name or category
  search: (query) => apiService.get(`/raw-materials/search/${encodeURIComponent(query)}`),

  // Get by category
  getByCategory: (category) => apiService.get(`/raw-materials/category/${encodeURIComponent(category)}`),

  // Get low stock items
  getLowStock: () => apiService.get('/raw-materials/low-stock/all'),

  // Get distinct categories
  getCategories: () => apiService.get('/raw-materials/categories/all'),

  // Create raw material
  create: (materialData) => apiService.post('/raw-materials', materialData),

  // Update raw material
  update: (id, materialData) => apiService.put(`/raw-materials/${id}`, materialData),

  // Add stock to a material
  addStock: (id, quantity, reason = undefined, created_by = undefined) => apiService.patch(`/raw-materials/${id}/add-stock`, { quantity, reason, created_by }),

  // Delete raw material
  delete: (id) => apiService.delete(`/raw-materials/${id}`),

  // Get stock transaction history for a specific material
  getTransactions: (id, page = 1, limit = 50, type = null) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (type) params.append('type', type);
    return apiService.get(`/raw-materials/${id}/transactions?${params.toString()}`);
  },

  // Get all stock transactions
  getAllTransactions: (page = 1, limit = 50, type = null, materialId = null) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (type) params.append('type', type);
    if (materialId) params.append('material_id', materialId);
    return apiService.get(`/raw-materials/transactions/all?${params.toString()}`);
  },
};

export default apiService;
