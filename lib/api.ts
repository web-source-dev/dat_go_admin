import axios from 'axios';
import type { AssignableCookieLabel } from './cookieLabels';
import type { FreightdeskChangeStatus, CookieDiff } from './types';

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
  /** presence: online | dat | dat-visible | dat-tray | dashboard | offline */
  getAll: async (params?: { page?: number; limit?: number; search?: string; status?: string; dateFrom?: string; dateTo?: string; label?: string; presence?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search.toString());
    if (params?.status) queryParams.append('status', params.status.toString());
    if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom.toString());
    if (params?.dateTo) queryParams.append('dateTo', params.dateTo.toString());
    if (params?.label) queryParams.append('label', params.label.toString());
    if (params?.presence) queryParams.append('presence', params.presence.toString());

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
    planEnabled?: {
      single?: boolean;
      double?: boolean;
      multi?: boolean;
      swiftSolutions?: boolean;
      test?: boolean;
      horizon?: boolean;
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

/** Horizon desktop — admin-pushed proxy into Foxy Proxy extension */
export const horizonFoxyProxyApi = {
  getConfig: async () => {
    const response = await api.get('/proxy/foxy/admin');
    return response.data as {
      enabled: boolean;
      title: string;
      type: 'http' | 'https' | 'socks4' | 'socks5';
      host: string;
      port: number;
      username: string;
      password: string;
      updatedAt?: string;
      message?: string;
    };
  },

  updateConfig: async (payload: {
    enabled?: boolean;
    title?: string;
    type?: 'http' | 'https' | 'socks4' | 'socks5';
    host?: string;
    port?: number | string;
    username?: string;
    password?: string;
  }) => {
    const response = await api.put('/proxy/foxy/admin', payload);
    return response.data as {
      enabled: boolean;
      title: string;
      type: 'http' | 'https' | 'socks4' | 'socks5';
      host: string;
      port: number;
      username: string;
      password: string;
      updatedAt?: string;
      message?: string;
    };
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
  getAll: async (
    params?: { page?: number; limit?: number; search?: string; label?: string },
    baseURL?: string
  ) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search.toString());
    if (params?.label) queryParams.append('label', params.label.toString());

    const response = await api.get(`/cookie?${queryParams.toString()}`, at(baseURL));
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/cookie/${id}`);
    return response.data;
  },

  dumpFromHalvex: async (credentials: { identifier: string; password: string }) => {
    const response = await api.post('/cookie/from-halvex', credentials, { timeout: 60_000 });
    return response.data as {
      fileName: string;
      cookieCount: number;
      user: { id: number; username?: string | null; email?: string | null; fullName?: string | null };
      container: Record<string, { cookies: unknown[]; lastUpdated: string }>;
    };
  },

  create: async (
    cookieData: {
      fileName?: string;
      label?: string;
      sessionId?: string;
      fileContent: any;
    },
    baseURL?: string
  ) => {
    const response = await api.post('/cookie', cookieData, at(baseURL));
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

  delete: async (id: string, baseURL?: string) => {
    const response = await api.delete(`/cookie/${id}`, {
      ...at(baseURL),
      timeout: 60_000,
    });
    return response.data;
  },

  /**
   * Wipe every cookie on a backend.
   * 1) POST /cookie/delete-all (new)
   * 2) DELETE /cookie/all (alias)
   * 3) Legacy: sync disk→DB on that host, then DELETE each /cookie/:id
   *    (needed when Backup hasn't been redeployed yet but still has orphan files)
   */
  deleteAll: async (baseURL?: string) => {
    const reqTimeout = { ...at(baseURL), timeout: 180_000 };

    try {
      const response = await api.post('/cookie/delete-all', undefined, reqTimeout);
      return { ...response.data, method: 'delete-all' as const };
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
    }

    try {
      const response = await api.delete('/cookie/all', reqTimeout);
      return { ...response.data, method: 'delete-all-alias' as const };
    } catch (err: any) {
      if (err?.response?.status !== 404 && err?.response?.status !== 400) throw err;
    }

    // Legacy path for backends that only have per-id delete.
    // Sync first so orphan disk files (after another host wiped shared Mongo)
    // are re-registered, then remove each record+file on THIS host.
    await api.post('/cookie/sync-from-disk', undefined, reqTimeout);

    let deletedRecords = 0;
    let deletedFiles = 0;
    let guard = 0;

    while (guard < 500) {
      guard += 1;
      const page = await api.get('/cookie?page=1&limit=100', reqTimeout);
      const list: Array<{ _id: string }> = page.data?.cookies || [];
      if (!list.length) break;

      for (const cookie of list) {
        try {
          const result = await api.delete(`/cookie/${cookie._id}`, {
            ...at(baseURL),
            timeout: 60_000,
          });
          deletedRecords += 1;
          if (result.data?.deletedFile) deletedFiles += 1;
        } catch (delErr: any) {
          // Skip already-gone ids (shared DB race); keep wiping the rest
          if (delErr?.response?.status !== 404) throw delErr;
        }
      }
    }

    return {
      message: 'All cookie files deleted via legacy per-id fallback',
      deletedRecords,
      deletedFiles,
      method: 'legacy-per-id' as const,
    };
  },

  sync: async (baseURL?: string) => {
    const response = await api.post('/cookie/sync-from-disk', undefined, at(baseURL));
    return response.data;
  },

  activate: async (
    id: string,
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'test' | 'horizon' | 'dathub' = 'single'
  ) => {
    const response = await api.post(`/cookie/${id}/activate`, { channel });
    return response.data;
  },

  deactivate: async (
    id: string,
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'test' | 'horizon' | 'dathub' = 'single'
  ) => {
    const response = await api.post(`/cookie/${id}/deactivate`, { channel });
    return response.data;
  },

  /**
   * Queue a DAT session refresh: matching desktops replace their local DAT
   * profile with the current cookie the next time they open DAT.
   */
  pushSession: async (payload: PushSessionPayload) => {
    const response = await api.post('/cookie/push', payload);
    return response.data as { count: number; message: string };
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

// DAT GO runs on multiple backend deployments (main -> primary -> backup).
// Scheduler/file-download triggers still fan out (per-host disk).
// Cookie + FreightDesk writes go to shared Mongo — Primary alone is enough.
// Override URLs per environment via NEXT_PUBLIC_* .
export type SchedulerBackendKey = 'main' | 'primary' | 'backup';

export interface SchedulerBackend {
  key: SchedulerBackendKey;
  label: string;
  url: string;
}

export const SCHEDULER_BACKENDS: SchedulerBackend[] = [
  {
    key: 'main',
    label: 'Main',
    url: process.env.NEXT_PUBLIC_API_MAIN_URL || 'https://dat-go-b-kn6b.onrender.com',
  },
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
];

function normalizeBackendUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '').toLowerCase();
}

/** Fan-out targets — duplicate URLs in env (e.g. all pointing at backup) run only once. */
export function getUniqueSchedulerBackends(): SchedulerBackend[] {
  const seen = new Set<string>();
  const unique: SchedulerBackend[] = [];
  for (const backend of SCHEDULER_BACKENDS) {
    const key = normalizeBackendUrl(backend.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(backend);
  }
  return unique;
}

/**
 * Single backend for shared-DB cookie / FreightDesk operations.
 * Prefer Primary; fall back to API_BASE_URL / first unique scheduler URL.
 */
export function getSharedDbBackend(): SchedulerBackend {
  const primary = SCHEDULER_BACKENDS.find((b) => b.key === 'primary');
  if (primary?.url) return primary;

  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
  if (base) {
    return { key: 'primary', label: 'Primary', url: base.replace(/\/+$/, '') };
  }

  return getUniqueSchedulerBackends()[0] || SCHEDULER_BACKENDS[0];
}

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

// Managed Chromium extensions delivered to Horizon via session.loadExtension()
export interface ManagedExtension {
  _id: string;
  name: string;
  slug: string;
  version: string;
  description?: string;
  fileName: string;
  originalFileName?: string;
  fileSize?: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const extensionsApi = {
  list: async (): Promise<{ success: boolean; data: ManagedExtension[] }> => {
    const response = await api.get('/extension');
    return response.data;
  },

  upload: async (file: File, meta?: { name?: string; slug?: string; version?: string; description?: string; enabled?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.name) formData.append('name', meta.name);
    if (meta?.slug) formData.append('slug', meta.slug);
    if (meta?.version) formData.append('version', meta.version);
    if (meta?.description) formData.append('description', meta.description);
    if (meta?.enabled !== undefined) formData.append('enabled', String(meta.enabled));

    const response = await api.post('/extension/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { success: boolean; message?: string; data: ManagedExtension };
  },

  update: async (id: string, data: Partial<Pick<ManagedExtension, 'name' | 'slug' | 'version' | 'description' | 'enabled'>>) => {
    const response = await api.put(`/extension/${id}`, data);
    return response.data as { success: boolean; data: ManagedExtension };
  },

  delete: async (id: string) => {
    const response = await api.delete(`/extension/${id}`);
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

export type SessionAlert = {
  cookieId: string;
  fileName: string;
  deadUsers: number;
  since: string;
};

export type LiveStatus = {
  activeUsersByCookie: Record<string, number>;
  alerts: SessionAlert[];
  threshold: number;
  windowMs: number;
  at: string;
};

export type PresenceState = 'offline' | 'dashboard' | 'dat';

/** Computed live-presence view the backend serves on each user (presenceController.presenceView). */
export type UserPresence = {
  state: PresenceState;
  online: boolean;
  datOpen: boolean;
  datVisible: boolean;
  lastSeenAt?: string | null;
  datOpenedAt?: string | null;
  appVersion?: string;
  platform?: string;
};

export type DeviceCommand = {
  id: string;
  userId?: string | null;
  type: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'expired';
  cookieCount?: number;
  cookieId?: string | null;
  hasResult?: boolean;
  error?: string;
  requestedByEmail?: string;
  expiresAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PresenceCounts = {
  online: number;
  dat: number;
  datVisible: number;
  datTray: number;
  dashboard: number;
};

export type PresenceSnapshot = {
  /** Only online users are listed; anyone missing is offline. */
  users: Record<string, UserPresence>;
  counts: PresenceCounts;
  onlineWindowMs: number;
  at: string;
};

/**
 * Presence + remote device commands (cookie-mode desktop). Ported from the Dat Desk reference.
 * `live` is also polled by AlertsWatcher for session-death alerts.
 */
export const presenceApi = {
  /** Who is online right now and where. Cheap, safe to poll every few seconds. */
  snapshot: async () => {
    const { data } = await api.get('/presence/admin/presence');
    return data as PresenceSnapshot;
  },
  live: async (): Promise<LiveStatus> => {
    const { data } = await api.get('/presence/admin/live');
    return data as LiveStatus;
  },
  pullCookies: async (userId: string) => {
    const { data } = await api.post(`/presence/admin/users/${userId}/pull-cookies`);
    return data as { command: DeviceCommand; presence: UserPresence; reused: boolean };
  },
  /** Queue a remote app action (open-dat, close-dat, …); the app runs it on its next heartbeat. */
  remote: async (userId: string, type: string) => {
    const { data } = await api.post(`/presence/admin/users/${userId}/command`, { type });
    return data as { command: DeviceCommand; presence: UserPresence; reused: boolean };
  },
  getCommand: async (commandId: string) => {
    const { data } = await api.get(`/presence/admin/commands/${commandId}`);
    return data as { command: DeviceCommand };
  },
  downloadCookies: async (commandId: string) => {
    const res = await api.get(`/presence/admin/commands/${commandId}/download`, {
      responseType: 'blob',
    });
    return res.data as Blob;
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
      channel?: CookieChannel;
      /** 'all' (default) keeps a newer Dat Desk-synced copy; 'force' always overwrites. */
      mode?: FreightdeskImportMode;
    },
    baseURL?: string
  ) => {
    const response = await api.post(
      `/freightdesk/import/${encodeURIComponent(container)}`,
      { mode: 'all', ...options },
      at(baseURL)
    );
    return response.data as {
      success?: boolean;
      message?: string;
      container: string;
      imported: boolean;
      activated?: boolean;
      channel?: CookieChannel | null;
      status?: FreightdeskChangeStatus;
      reason?: string;
      diff?: CookieDiff;
    };
  },

  /**
   * Starts a background import-all job (202 + jobId) and polls
   * GET /freightdesk/import-all/:jobId until it is done or failed.
   * Resolves with the job's final result (containers / skippedContainers / errors).
   */
  importAll: async (
    options?: {
      activate?: boolean;
      channel?: CookieChannel;
      mode?: FreightdeskImportMode;
    },
    onProgress?: (info: FreightdeskImportProgressInfo) => void,
    baseURL?: string
  ): Promise<FreightdeskImportAllResult> => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const formatProgress = (job: any) => {
      if (job?.message) return String(job.message);
      const p = job?.progress || {};
      const total = p.total == null ? null : Number(p.total);
      const done = Number(p.imported || 0) + Number(p.skipped || 0) + Number(p.failed || 0);
      if (total != null) {
        return `Importing ${done}/${total}${p.current ? ` · ${p.current}` : ''}…`;
      }
      return 'Importing…';
    };

    const pollJob = async (jobId: string): Promise<FreightdeskImportAllResult> => {
      const deadline = Date.now() + 30 * 60 * 1000;
      while (Date.now() < deadline) {
        const { data: job } = await api.get(`/freightdesk/import-all/${encodeURIComponent(jobId)}`, {
          ...at(baseURL),
          timeout: 30000
        });

        onProgress?.({
          message: formatProgress(job),
          status: job?.status,
          progress: job?.progress
        });

        if (job?.status === 'done') {
          return {
            success: true,
            ...(job.result || {}),
            message: job.message || job.result?.message || 'Import complete'
          };
        }

        if (job?.status === 'error' || job?.status === 'failed') {
          const msg = job.error || job.message || 'Import failed';
          const err: any = new Error(msg);
          err.response = { data: { message: msg } };
          throw err;
        }

        await sleep(1500);
      }
      throw new Error('Import is still running on the server. Refresh in a minute.');
    };

    try {
      const start = await api.post(
        '/freightdesk/import-all',
        { mode: 'all', ...options },
        { ...at(baseURL), timeout: 60000 }
      );
      const startData = start.data as { jobId?: string; status?: string; message?: string };
      if (startData?.jobId) {
        onProgress?.({ message: startData.message || 'Import started…', status: startData.status || 'running' });
        return pollJob(startData.jobId);
      }
      // Legacy synchronous response
      return startData as FreightdeskImportAllResult;
    } catch (err: any) {
      const jobId = err?.response?.data?.jobId;
      if (err?.response?.status === 409 && jobId) {
        onProgress?.({ message: 'Import already running — joining…', status: 'running' });
        return pollJob(jobId);
      }
      throw err;
    }
  },

  activate: async (
    container: string,
    channel: 'single' | 'double' | 'multi' | 'swiftSolutions' | 'test' | 'horizon' | 'dathub' = 'single'
  ) => {
    const response = await api.post(`/freightdesk/activate/${encodeURIComponent(container)}`, { channel });
    return response.data;
  },

  updateLabel: async (container: string, label: AssignableCookieLabel) => {
    const response = await api.patch(`/freightdesk/label/${encodeURIComponent(container)}`, { label });
    return response.data;
  },

  importSeparate: async (container: string) => {
    const response = await api.post(`/freightdesk/import-separate/${encodeURIComponent(container)}`);
    return response.data;
  },

  setWorking: async (container: string, isWorking: boolean) => {
    const response = await api.patch(`/freightdesk/working/${encodeURIComponent(container)}`, {
      isWorking
    });
    return response.data;
  },

  getImportAllJob: async (jobId: string) => {
    const response = await api.get(`/freightdesk/import-all/${encodeURIComponent(jobId)}`);
    return response.data;
  },
};

export type {
  FreightdeskContainerSession,
  FreightdeskStatus,
  FreightdeskChangeStatus,
  CookieDiff
} from './types';

export type FreightdeskImportMode = 'changed' | 'all' | 'force';

export type FreightdeskImportOutcome = {
  container: string;
  status?: FreightdeskChangeStatus;
  reason?: string;
  diff?: CookieDiff;
  /** Set for containers that failed to import. */
  error?: string;
  cookieId?: string;
  fileName?: string;
};

export type FreightdeskImportProgressInfo = {
  message?: string;
  status?: string;
  progress?: {
    imported?: number;
    skipped?: number;
    failed?: number;
    total?: number | null;
    current?: string | null;
    phase?: string;
  };
};

export type FreightdeskImportAllResult = {
  success?: boolean;
  message?: string;
  mode?: FreightdeskImportMode;
  imported?: number;
  skipped?: number;
  failed?: number;
  total?: number;
  containers?: FreightdeskImportOutcome[];
  skippedContainers?: FreightdeskImportOutcome[];
  errors?: { container: string; error: string }[];
  activated?: boolean;
  channel?: CookieChannel | null;
};

export type PushSessionScope = 'user' | 'all' | 'label' | 'plan' | 'cookie';

export type PushSessionPayload = {
  scope: PushSessionScope;
  userId?: string;
  label?: string;
  plan?: 'single' | 'double' | 'multi';
  cookieId?: string;
};

export type CookieChannel = 'single' | 'double' | 'multi' | 'horizon' | 'swiftSolutions' | 'test' | 'dathub';

export { COOKIE_LABEL_OPTIONS } from './cookieLabels';
export type { AssignableCookieLabel } from './cookieLabels';

export default api;
