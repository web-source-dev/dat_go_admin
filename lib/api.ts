import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7017';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
    (response: any) => response,
  (error: any) => {
    if (error.response?.status === 401) {
      // Redirect to login or handle unauthorized
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  checkSession: async () => {
    const response = await api.post('/auth/check-session');
    return response.data;
  },
};

// Users API
export const usersApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; status?: string; dateFrom?: string; dateTo?: string; label?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search.toString());
    if (params?.status) queryParams.append('status', params.status.toString());
    if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom.toString());
    if (params?.dateTo) queryParams.append('dateTo', params.dateTo.toString());
    if (params?.label) queryParams.append('label', params.label.toString());

    const response = await api.get(`/user?${queryParams.toString()}`);
    return response.data;
  },

  getAvailableLabels: async () => {
    const response = await api.get('/user/labels/available');
    return response.data;
  },

  create: async (userData: any) => {
    const response = await api.post('/user', userData);
    return response.data;
  },

  update: async (id: string, userData: any) => {
    const response = await api.put(`/user/${id}`, userData);
    return response.data;
  },

};

// Sessions API
export const sessionsApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; status?: string; userCount?: string; dateFrom?: string; dateTo?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search.toString());
    if (params?.status) queryParams.append('status', params.status.toString());
    if (params?.userCount) queryParams.append('userCount', params.userCount.toString());
    if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom.toString());
    if (params?.dateTo) queryParams.append('dateTo', params.dateTo.toString());

    const response = await api.get(`/session?${queryParams.toString()}`);
    return response.data;
  },

  create: async (sessionData: any) => {
    const response = await api.post('/session', sessionData);
    return response.data;
  },

  update: async (id: string, sessionData: any) => {
    const response = await api.put(`/session/${id}`, sessionData);
    return response.data;
  },

  updateLoginStatus: async (id: string, isLoggedIn: boolean) => {
    const response = await api.patch(`/session/${id}/isLoggedIn`, { isLoggedIn });
    return response.data;
  },

};

// Payments API
export const paymentsApi = {
  getAll: async (params?: { page?: number; limit?: number; userId?: string; status?: string; month?: number; year?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.userId) queryParams.append('userId', params.userId.toString());
    if (params?.status) queryParams.append('status', params.status.toString());
    if (params?.month) queryParams.append('month', params.month.toString());
    if (params?.year) queryParams.append('year', params.year.toString());

    const response = await api.get(`/payment?${queryParams.toString()}`);
    return response.data;
  },

  getUserPayments: async (userId: string, params?: { page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await api.get(`/payment/user/${userId}?${queryParams.toString()}`);
    return response.data;
  },

  updateStatus: async (paymentId: string, status: 'pending' | 'approved' | 'paid', notes?: string) => {
    const response = await api.put(`/payment/${paymentId}/status`, { status, notes });
    return response.data;
  },

  uploadProofImage: async (paymentId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post(`/payment/${paymentId}/proof-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  create: async (paymentData: { userId: string; amount: number; month: number; year: number; notes?: string }) => {
    const response = await api.post('/payment', paymentData);
    return response.data;
  },

  generateMonthly: async (month?: number, year?: number) => {
    const response = await api.post('/payment/generate-monthly', { month, year });
    return response.data;
  },

  refund: async (paymentId: string, refundNotes?: string) => {
    const response = await api.put(`/payment/${paymentId}/refund`, { refundNotes });
    return response.data;
  },

  cancelRefund: async (paymentId: string) => {
    const response = await api.put(`/payment/${paymentId}/cancel-refund`, {});
    return response.data;
  },

  markCommissionPaid: async (paymentId: string, commissionPaid: boolean = true) => {
    const response = await api.put(`/payment/${paymentId}/mark-commission-paid`, { commissionPaid });
    return response.data;
  },

};

// Cookies API
export const cookiesApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; label?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search.toString());
    if (params?.label) queryParams.append('label', params.label.toString());

    const response = await api.get(`/cookie?${queryParams.toString()}`);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/cookie/${id}`);
    return response.data;
  },

  create: async (cookieData: { fileName: string; label?: string; sessionId?: string; fileContent: any }) => {
    const response = await api.post('/cookie', cookieData);
    return response.data;
  },

  update: async (id: string, cookieData: { label?: string; sessionId?: string | null; fileContent?: any }) => {
    const response = await api.put(`/cookie/${id}`, cookieData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/cookie/${id}`);
    return response.data;
  },

  sync: async () => {
    const response = await api.post('/cookie/sync');
    return response.data;
  },

  activate: async (
    id: string,
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub' = 'single'
  ) => {
    const response = await api.post(`/cookie/${id}/activate`, { channel });
    return response.data;
  },

  deactivate: async (
    id: string,
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub' = 'single'
  ) => {
    const response = await api.post(`/cookie/${id}/deactivate`, { channel });
    return response.data;
  },

  getPartnerSwiftDashboardConfig: async () => {
    const response = await api.get('/cookie/partner-swift/dashboard-config');
    return response.data;
  },

  updatePartnerSwiftDashboardConfig: async (payload: {
    manualSelectionEnabled?: boolean;
    selectedCookieIds?: string[];
  }) => {
    const response = await api.put('/cookie/partner-swift/dashboard-config', payload);
    return response.data;
  },

};

// Messages API
export const messagesApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; platform?: string; isActive?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search.toString());
    if (params?.platform) queryParams.append('platform', params.platform.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    const response = await api.get(`/message?${queryParams.toString()}`);
    return response.data;
  },

  getActive: async (platform?: string, sessionId?: string) => {
    const queryParams = new URLSearchParams();
    if (platform) queryParams.append('platform', platform);
    if (sessionId) queryParams.append('sessionId', sessionId);

    const response = await api.get(`/message/active?${queryParams.toString()}`);
    return response.data; // Returns { messages: Message[] }
  },

  getById: async (id: string) => {
    const response = await api.get(`/message/${id}`);
    return response.data;
  },

  create: async (messageData: { title: string; message: string; platform?: string; sessionId?: string; isActive?: boolean }) => {
    const response = await api.post('/message', messageData);
    return response.data;
  },

  update: async (id: string, messageData: { title?: string; message?: string; platform?: string; sessionId?: string | null; isActive?: boolean }) => {
    const response = await api.put(`/message/${id}`, messageData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/message/${id}`);
    return response.data;
  },

  activate: async (id: string) => {
    const response = await api.post(`/message/${id}/activate`);
    return response.data;
  },

  deactivate: async (id: string) => {
    const response = await api.post(`/message/${id}/deactivate`);
    return response.data;
  },
};

// Scheduler API
export const schedulerApi = {
  getStatus: async () => {
    const response = await api.get('/scheduler/status');
    return response.data;
  },

  triggerSync: async () => {
    const response = await api.post('/scheduler/trigger/sync');
    return response.data;
  },

  triggerDownload: async () => {
    const response = await api.post('/scheduler/trigger/download');
    return response.data;
  },

  triggerFull: async () => {
    const response = await api.post('/scheduler/trigger/full');
    return response.data;
  },

  triggerPaymentCheck: async () => {
    const response = await api.post('/scheduler/trigger/payments');
    return response.data;
  },

  triggerReferralUpdate: async () => {
    const response = await api.post('/scheduler/trigger/referrals');
    return response.data;
  },

  triggerBackup: async () => {
    const response = await api.post('/scheduler/trigger/backup');
    return response.data;
  },

  triggerFreightdesk: async () => {
    const response = await api.post('/scheduler/trigger/freightdesk');
    return response.data;
  },
};

// Salesperson Commission API
export const salespersonCommissionApi = {
  getAll: async (params?: { page?: number; limit?: number; salespersonId?: string; month?: number; year?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.salespersonId) queryParams.append('salespersonId', params.salespersonId.toString());
    if (params?.month) queryParams.append('month', params.month.toString());
    if (params?.year) queryParams.append('year', params.year.toString());

    const response = await api.get(`/salesperson-commission?${queryParams.toString()}`);
    return response.data;
  },

  getSalespeopleSummary: async () => {
    const response = await api.get('/salesperson-commission/salespeople-summary');
    return response.data;
  },

  getSummary: async (salespersonId: string) => {
    const response = await api.get(`/salesperson-commission/summary/${salespersonId}`);
    return response.data;
  },

  create: async (paymentData: any) => {
    const response = await api.post('/salesperson-commission', paymentData);
    return response.data;
  },

  update: async (paymentId: string, paymentData: any) => {
    const response = await api.put(`/salesperson-commission/${paymentId}`, paymentData);
    return response.data;
  },

  delete: async (paymentId: string) => {
    const response = await api.delete(`/salesperson-commission/${paymentId}`);
    return response.data;
  },
};

export const freightdeskApi = {
  getStatus: async () => {
    const response = await api.get('/freightdesk/status');
    return response.data;
  },

  getSessions: async () => {
    const response = await api.get('/freightdesk/sessions');
    return response.data;
  },

  importContainer: async (
    container: string,
    options?: { activate?: boolean; channel?: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub' }
  ) => {
    const response = await api.post(`/freightdesk/import/${encodeURIComponent(container)}`, options || {});
    return response.data;
  },

  importAll: async (
    options?: { activate?: boolean; channel?: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub' }
  ) => {
    const response = await api.post('/freightdesk/import-all', options || {});
    return response.data;
  },

  activate: async (
    container: string,
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub' = 'single'
  ) => {
    const response = await api.post(`/freightdesk/activate/${encodeURIComponent(container)}`, { channel });
    return response.data;
  },

  updateLabel: async (container: string, label: 'new' | 'single' | 'double' | 'multi') => {
    const response = await api.patch(`/freightdesk/label/${encodeURIComponent(container)}`, { label });
    return response.data;
  },
};

export default api;
