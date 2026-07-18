import axios from 'axios';
import type { AssignableCookieLabel } from './cookieLabels';

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

  // Admin-only: push DAT GO users into the Signal extension backend.
  syncAllSignalUsers: async () => {
    const response = await api.post('/signal-sync/users/sync');
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

// Extension proxy API (Chrome / Swift extensions)
export const extensionProxyApi = {
  getConfig: async () => {
    const response = await api.get('/proxy/admin/config');
    return response.data as import('./types').ExtensionProxyAdminConfig;
  },

  updateConfig: async (payload: {
    enabled?: boolean;
    source?: 'env' | 'session' | 'custom' | 'proxyPool';
    sessionId?: string | null;
    proxyIpId?: string | null;
    productEnabled?: {
      datGo?: boolean;
      swiftSolutions?: boolean;
      datHub?: boolean;
    };
    productProxy?: Partial<
      Record<
        import('./types').ExtensionProxyProductKey,
        {
          source?: import('./types').ExtensionProxySource;
          sessionId?: string | null;
          proxyIpId?: string | null;
          customProxy?: {
            host?: string;
            port?: number | string;
            username?: string;
            password?: string;
          };
        }
      >
    >;
    customProxy?: {
      host?: string;
      port?: number | string;
      username?: string;
      password?: string;
    };
  }) => {
    const response = await api.put('/proxy/admin/config', payload);
    return response.data as import('./types').ExtensionProxyAdminConfig & { message?: string };
  },

  useSession: async (sessionId: string) => {
    const response = await api.post(`/proxy/admin/use-session/${sessionId}`);
    return response.data as import('./types').ExtensionProxyAdminConfig & { message?: string };
  },

  useProxyIp: async (proxyIpId: string) => {
    const response = await api.post(`/proxy/admin/use-proxy-ip/${proxyIpId}`);
    return response.data as import('./types').ExtensionProxyAdminConfig & { message?: string };
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
    return paymentsApi.uploadProofImages(paymentId, [file]);
  },

  uploadProofImages: async (paymentId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const response = await api.post(`/payment/${paymentId}/proof-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteProofImage: async (paymentId: string, imageId: string) => {
    const response = await api.delete(`/payment/${paymentId}/proof-image/${imageId}`);
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

  create: async (cookieData: {
    fileName?: string;
    label?: string;
    sessionId?: string;
    fileContent: any;
  }) => {
    const response = await api.post('/cookie', cookieData);
    return response.data;
  },

  update: async (id: string, cookieData: {
    label?: string;
    sessionId?: string | null;
    fileContent?: any;
    isWorking?: boolean;
  }) => {
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
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'test' | 'dathub' = 'single'
  ) => {
    const response = await api.post(`/cookie/${id}/activate`, { channel });
    return response.data;
  },

  deactivate: async (
    id: string,
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'test' | 'dathub' = 'single'
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

// Backend deployments the scheduler can target. It's the same service behind
// three domains (primary -> backup -> legacy fallback), and each deployment runs
// its own cron/scheduler. The admin can trigger a job on a specific backend or
// fan it out to all of them. Override the URLs per environment via NEXT_PUBLIC_* .
export type SchedulerBackendKey = 'primary' | 'backup' | 'fallback';

export interface SchedulerBackend {
  key: SchedulerBackendKey;
  label: string;
  url: string;
}

export const SCHEDULER_BACKENDS: SchedulerBackend[] = [
  {
    key: 'primary',
    label: 'Primary',
    url: process.env.NEXT_PUBLIC_API_PRIMARY_URL || 'https://datbackend.apexskillzone.com',
  },
  {
    key: 'backup',
    label: 'Backup',
    url: process.env.NEXT_PUBLIC_API_BACKUP_URL || 'https://datbackup.apexskillzone.com',
  },
  {
    key: 'fallback',
    label: 'Fallback',
    url: process.env.NEXT_PUBLIC_API_FALLBACK_URL || 'https://api.kmldigital.xyz',
  },
];

// Per-request config that points a call at a specific backend. When baseURL is
// omitted the default `api` baseURL (NEXT_PUBLIC_API_BASE_URL) is used.
const at = (baseURL?: string) => (baseURL ? { baseURL } : undefined);

// Scheduler API. Every method accepts an optional `baseURL` to target a specific
// backend (see SCHEDULER_BACKENDS); without it, the default backend is used.
export const schedulerApi = {
  getStatus: async (baseURL?: string) => {
    const response = await api.get('/scheduler/status', at(baseURL));
    return response.data;
  },

  triggerSync: async (baseURL?: string) => {
    const response = await api.post('/scheduler/trigger/sync', undefined, at(baseURL));
    return response.data;
  },

  triggerDownload: async (baseURL?: string) => {
    const response = await api.post('/scheduler/trigger/download', undefined, at(baseURL));
    return response.data;
  },

  triggerFull: async (baseURL?: string) => {
    const response = await api.post('/scheduler/trigger/full', undefined, at(baseURL));
    return response.data;
  },

  triggerPaymentCheck: async (baseURL?: string) => {
    const response = await api.post('/scheduler/trigger/payments', undefined, at(baseURL));
    return response.data;
  },

  triggerReferralUpdate: async (baseURL?: string) => {
    const response = await api.post('/scheduler/trigger/referrals', undefined, at(baseURL));
    return response.data;
  },

  triggerBackup: async (baseURL?: string) => {
    const response = await api.post('/scheduler/trigger/backup', undefined, at(baseURL));
    return response.data;
  },

  triggerFreightdesk: async (baseURL?: string) => {
    const response = await api.post('/scheduler/trigger/freightdesk', undefined, at(baseURL));
    return response.data;
  },

  getSyncOptions: async (baseURL?: string) => {
    const response = await api.get('/scheduler/sync-options', at(baseURL));
    return response.data as { success: boolean; data: import('./types').SchedulerSyncOptions };
  },

  updateSyncOptions: async (
    payload: Partial<import('./types').SchedulerSyncOptions>,
    baseURL?: string
  ) => {
    const response = await api.put('/scheduler/sync-options', payload, at(baseURL));
    return response.data as {
      success: boolean;
      message?: string;
      data: import('./types').SchedulerSyncOptions;
    };
  },
};

// App auto-update on/off (per app). Stored in the shared backend DB, so a single
// call affects every backend deployment. Optional baseURL targets a specific one.
export interface AppUpdateConfig {
  app: string;
  updatesEnabled: boolean;
}

export const updatesApi = {
  getConfig: async (baseURL?: string): Promise<{ success: boolean; data: AppUpdateConfig[] }> => {
    const response = await api.get('/update/config', at(baseURL));
    return response.data;
  },

  setConfig: async (app: string, updatesEnabled: boolean, baseURL?: string) => {
    const response = await api.put(`/update/config/${encodeURIComponent(app)}`, { updatesEnabled }, at(baseURL));
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
    options?: {
      activate?: boolean;
      channel?: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub';
      forceReimport?: boolean;
    }
  ) => {
    const response = await api.post(`/freightdesk/import/${encodeURIComponent(container)}`, {
      forceReimport: true,
      ...options,
    });
    return response.data;
  },

  importAll: async (
    options?: {
      activate?: boolean;
      channel?: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub';
      forceReimport?: boolean;
    }
  ) => {
    const response = await api.post('/freightdesk/import-all', {
      forceReimport: true,
      ...options,
    });
    return response.data;
  },

  activate: async (
    container: string,
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub' = 'single'
  ) => {
    const response = await api.post(`/freightdesk/activate/${encodeURIComponent(container)}`, { channel });
    return response.data;
  },

  updateLabel: async (container: string, label: AssignableCookieLabel) => {
    const response = await api.patch(`/freightdesk/label/${encodeURIComponent(container)}`, { label });
    return response.data;
  },
};

export default api;
