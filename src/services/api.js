// API service for STEP Packaging & Printing System
const API_BASE_URL = 'http://localhost:5000/api';

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

export default apiService;
