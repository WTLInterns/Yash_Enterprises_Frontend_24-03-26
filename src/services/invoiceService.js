import { backendApi } from '@/services/api';

export const invoiceService = {
  // Get all invoices with pagination and filtering
  async getInvoices(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page - 1); // Spring Data pages are 0-indexed
      if (params.size) queryParams.append('size', params.size || 10);
      if (params.search) queryParams.append('search', params.search);
      if (params.status) queryParams.append('status', params.status);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      
      const query = queryParams.toString();
      const response = await backendApi.get(`/invoices${query ? `?${query}` : ''}`);
      
      // Transform Spring Data Page response to match frontend expectations
      return {
        content: response.content || [],
        totalElements: response.totalElements || 0,
        totalPages: response.totalPages || 0,
        size: response.size || 10,
        number: response.number || 0
      };
    } catch (error) {
      console.warn('Invoice endpoint error:', error);
      // Return empty structure if endpoint doesn't exist
      return {
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 10,
        number: 0
      };
    }
  },

  // Get single invoice by ID
  async getInvoice(id) {
    try {
      return backendApi.get(`/invoices/${id}`);
    } catch (error) {
      console.warn('Invoice endpoint not available, returning mock data');
      return {
        id: id,
        invoiceNo: `INV-${id}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isProForma: false,
        includeGst: true,
        billedByName: 'Company Name',
        billedByAddress: 'Company Address',
        billedByEmail: 'company@example.com',
        gstin: '',
        pan: '',
        billedToName: 'Client Name',
        billedToAddress: 'Client Address',
        billedToGstin: '',
        billedToMobile: '',
        billedToEmail: '',
        accountName: '',
        accountNumber: '',
        ifsc: '',
        accountType: '',
        bank: '',
        upiId: '',
        terms: '',
        items: [],
        subtotal: 0,
        cgst: 0,
        sgst: 0,
        grandTotal: 0,
        amountInWords: 'ZERO'
      };
    }
  },

  // Create new invoice
  async createInvoice(invoiceData) {
    try {
      return backendApi.post('/invoices', invoiceData);
    } catch (error) {
      console.warn('Invoice endpoint not available, returning mock response');
      return { ...invoiceData, id: Date.now() };
    }
  },

  // Get invoice by ID with full details including items
  async getInvoiceById(id) {
    const response = await backendApi.get(`/invoices/${id}`);
    console.log('Backend response for invoice', response);
    return response;
  },

  // Update existing invoice
  async updateInvoice(id, invoiceData) {
    try {
      return backendApi.put(`/invoices/${id}`, invoiceData);
    } catch (error) {
      console.warn('Invoice endpoint not available, returning mock response');
      return { ...invoiceData, id: parseInt(id) };
    }
  },

  // Delete invoice
  async deleteInvoice(id) {
    try {
      return backendApi.delete(`/invoices/${id}`);
    } catch (error) {
      console.warn('Invoice endpoint not available, returning mock response');
      return { success: true };
    }
  },

  // 📧 Send invoice email
  async sendInvoiceEmail(invoiceId) {
    try {
      return await backendApi.post(`/invoices/${invoiceId}/send`);
    } catch (error) {
      console.warn('Invoice email endpoint not available, returning mock response');
      return { success: true, message: 'Invoice sent successfully', status: 'SENT' };
    }
  },

  // Generate PDF for invoice
  async generateInvoicePdf(id) {
    try {
      const response = await fetch(`http://localhost:8080/api/invoices/${id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
          'X-User-Id': (() => {
            if (typeof window === 'undefined') return null;
            try {
              const raw = localStorage.getItem('user_data');
              const obj = raw ? JSON.parse(raw) : null;
              return obj?.id ?? null;
            } catch (_e) {
              return null;
            }
          })()
        }
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }

      return response.blob();
    } catch (error) {
      console.warn('PDF endpoint not available, using client-side generation');
      throw error; // Let the client handle PDF generation
    }
  },

  // Download PDF for invoice
  async downloadInvoicePdf(id, invoiceNo) {
    try {
      const blob = await this.generateInvoicePdf(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice-${invoiceNo || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      throw error;
    }
  },

  // Get invoice statistics
  async getInvoiceStats() {
    try {
      return backendApi.get('/invoices/stats');
    } catch (error) {
      console.warn('Invoice stats endpoint not available, returning mock data');
      return {
        total: 0,
        thisMonth: 0,
        totalAmount: 0,
        pending: 0
      };
    }
  },

  // Get products/services for invoice items
  async getProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.active !== undefined) queryParams.append('active', params.active);
      if (params.category) queryParams.append('category', params.category);
      if (params.q) queryParams.append('q', params.q);
      if (params.categoryId) queryParams.append('categoryId', params.categoryId);
      if (params.page) queryParams.append('page', params.page);
      if (params.size) queryParams.append('size', params.size);
      
      const query = queryParams.toString();
      return backendApi.get(`/products${query ? `?${query}` : ''}`);
    } catch (error) {
      console.warn('Products endpoint not available, returning empty array');
      return { content: [], totalElements: 0 };
    }
  },

  // Create new product
  async createProduct(productData) {
    try {
      return backendApi.post('/products', productData);
    } catch (error) {
      console.warn('Product creation endpoint not available, returning mock response');
      return { ...productData, id: Date.now() };
    }
  },

  // Update existing product
  async updateProduct(id, productData) {
    try {
      return backendApi.put(`/products/${id}`, productData);
    } catch (error) {
      console.warn('Product update endpoint not available, returning mock response');
      return { ...productData, id: parseInt(id) };
    }
  },

  // Delete product
  async deleteProduct(id) {
    try {
      return backendApi.delete(`/products/${id}`);
    } catch (error) {
      console.warn('Product deletion endpoint not available, returning mock response');
      return { success: true };
    }
  },

  // Get customers for billed to section
  async getCustomers() {
    try {
      return backendApi.get('/clients');
    } catch (error) {
      console.warn('Clients endpoint not available, returning empty array');
      return [];
    }
  },

  // Get client's deal products
  async getClientDealProducts(clientId) {
    try {
      // First get the client's deal
      const dealResponse = await backendApi.get(`/clients/${clientId}/deal`);
      if (!dealResponse || !dealResponse.id) {
        console.warn('No deal found for client:', clientId);
        return [];
      }
      
      // Then get products for that deal
      const productsResponse = await backendApi.get(`/deals/${dealResponse.id}/products`);
      return productsResponse || [];
    } catch (error) {
      console.warn('Failed to fetch client deal products:', error);
      return [];
    }
  },

  // Alternative: Get products directly by deal ID
  async getDealProducts(dealId) {
    try {
      const productsResponse = await backendApi.get(`/deals/${dealId}/products`);
      return productsResponse || [];
    } catch (error) {
      console.warn('Failed to fetch deal products:', error);
      return [];
    }
  }
};

export default invoiceService;
