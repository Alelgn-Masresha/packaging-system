const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';



class ApiService {
  baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    } as RequestInit & { headers: Record<string, string> };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error((data && (data.error || data.message)) || 'API request failed');
    }

    return data;
  }

  async get(endpoint: string): Promise<any> {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data: any): Promise<any> {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  async put(endpoint: string, data: any): Promise<any> {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }

  async delete(endpoint: string): Promise<any> {
    return this.request(endpoint, { method: 'DELETE' });
  }

  async healthCheck(): Promise<any> {
    return this.get('/health');
  }
}

const apiService = new ApiService();

export const customersAPI: any = {
  getAll: () => apiService.get('/customers'),
  getById: (id: number) => apiService.get(`/customers/${id}`),
  search: (query: string) => apiService.get(`/customers/search/${encodeURIComponent(query)}`),
  create: (customerData: any) => apiService.post('/customers', customerData),
  update: (id: number, customerData: any) => apiService.put(`/customers/${id}`, customerData),
  delete: (id: number) => apiService.delete(`/customers/${id}`),
};

export const productsAPI: any = {
  getAll: () => apiService.get('/products'),
  getById: (id: number) => apiService.get(`/products/${id}`),
  search: (query: string) => apiService.get(`/products/search/${encodeURIComponent(query)}`),
  create: (productData: any) => apiService.post('/products', productData),
  update: (id: number, productData: any) => apiService.put(`/products/${id}`, productData),
  delete: (id: number) => apiService.delete(`/products/${id}`),
};

export const ordersAPI: any = {
  getAll: () => apiService.get('/orders'),
  getById: (id: number) => apiService.get(`/orders/${id}`),
  getByCustomer: (customerId: number) => apiService.get(`/orders/customer/${customerId}`),
  getByStatus: (status: string) => apiService.get(`/orders/status/${status}`),
  create: (orderData: any) => apiService.post('/orders', orderData),
  update: (id: number, orderData: any) => apiService.put(`/orders/${id}`, orderData),
  updateStatus: (id: number, status: string) => apiService.put(`/orders/${id}/status`, { status }),
  delete: (id: number) => apiService.delete(`/orders/${id}`),
};

export const paymentsAPI: any = {
  getAll: () => apiService.get('/payments'),
  getById: (id: number) => apiService.get(`/payments/${id}`),
  getByOrder: (orderId: number) => apiService.get(`/payments/order/${orderId}`),
  getByType: (type: string) => apiService.get(`/payments/type/${type}`),
  getOrderSummary: (orderId: number) => apiService.get(`/payments/order/${orderId}/summary`),
  create: (paymentData: any) => apiService.post('/payments', paymentData),
  update: (id: number, paymentData: any) => apiService.put(`/payments/${id}`, paymentData),
  delete: (id: number) => apiService.delete(`/payments/${id}`),
};

export default apiService;

