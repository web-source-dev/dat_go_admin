import type { CookieLabel } from './cookieLabels';

export interface UserPermissions {
  dataSessionId?: string | { _id: string; name: string; proxy: string };
  dashboard: boolean;
  searchTrucks: boolean;
  privateLoads: boolean;
  myLoads: boolean;
  privateNetwork: boolean;
  myTrucks: boolean;
  liveSupport: boolean;
  tools: boolean;
  sendFeedback: boolean;
  notifications: boolean;
  profile: boolean;
  sidebarDat: boolean;
  searchLoadsLaneRate: boolean;
  searchLoadsViewRoute: boolean;
  searchLoadsRateview: boolean;
  searchLoadsViewDirectory: boolean;
  // DAT Multitab Permissions (Phase 1)
  datMultitab: boolean;
  datMultitabNumbers: number;
  // Web Multitab Permissions (Phase 2)
  webMultitab: boolean;
  webMultitabNumbers: number;
  domain: string;
  domains: string[];
  // Platform Access Permissions
  desktop: boolean;
  mobile: boolean;
  extension: boolean;
  extensionProxy?: boolean;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user'; // Admin users are never shown in UI or created via API
  isBanned: boolean;
  isOnline: string | null;
  createdAt: string;
  permissions?: UserPermissions;
  monthlyPaymentAmount?: number;
  billingDate?: number;
  referralCode?: string;
  referredBy?: string;
  referralUsedAt?: string;
  plan?: 'single' | 'double' | 'multi';
  /** Desktop DAT open mode: ZIP profile extract, or active cookie for user's plan channel */
  sessionOpenMode?: 'zip' | 'cookie';
  label?: string;
  anydeskid?: string;
  phone?: string;
  note?: string;
  // Trial account fields
  isTrial?: boolean;
  trialStartDate?: string;
  trialEndDate?: string;
  trialDurationHours?: number;
  signalEnabled?: boolean;
}

export interface DATSession {
  _id: string;
  name: string;
  proxy: string;
  isLoggedIn: boolean;
  userCounts: number;
  fileName: string | null;
  label?: CookieLabel;
}

export interface Session {
  _id: string;
  name: string;
  proxy: string;
  isLoggedIn: boolean;
  userCounts: number;
  fileName: string;
  createdAt: string;
  label?: CookieLabel;
}

export interface PaymentProofImage {
  id: string;
  originalName?: string | null;
  uploadedAt?: string | null;
  url: string;
}

export interface Payment {
  _id: string;
  userId: User | string;
  amount: number;
  month: number;
  year: number;
  status: 'pending' | 'approved' | 'paid';
  dueDate: string;
  paymentDate?: string;
  notes?: string;
  paymentProofImagePath?: string | null;
  paymentProofOriginalName?: string | null;
  paymentProofUploadedAt?: string | null;
  paymentProofImageUrl?: string | null;
  paymentProofImages?: PaymentProofImage[];
  createdAt: string;
  updatedAt: string;
  period?: string; // Virtual field for display
  referralDiscount?: number;
  referralDiscountReason?: string;
  referralSourceUserId?: string;
  isRefunded?: boolean;
  refundDate?: string;
  refundNotes?: string;
  referralStatuses?: Array<{
    name: string;
    status: 'active' | 'banned' | 'refunded' | 'inactive';
    reason?: string;
  }>;
  // Salesperson commission fields
  salespersonCommission?: number;
  salespersonId?: string;
  salespersonCommissionPaid?: boolean;
}

export interface PaymentSummary {
  totalPending: number;
  totalPaid: number;
  totalOverdue: number;
  nextDueDate?: string;
}

export interface Cookie {
  _id: string;
  fileName: string;
  filePath: string;
  sessionId?: string;
  sessionName?: string;
  label: CookieLabel;
  cookieCount: number;
  hasCookies: boolean;
  fileSize: number;
  lastUpdated?: string;
  extractionDate?: string;
  sourceZipFile?: string;
  /** Admin-uploaded; never auto-deleted by sync */
  isManualUpload?: boolean;
  isActive: boolean;
  isActiveSingle?: boolean;
  isActiveDouble?: boolean;
  isActiveMulti?: boolean;
  isActiveSwiftSolutions?: boolean;
  /** Active for users with label=test */
  isActiveTest?: boolean;
  /** Quick ops flag: known working cookie */
  isWorking?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FreightdeskContainerSession {
  container: string;
  cookieCount: number;
  remoteCookieCount?: number;
  localCookieCount?: number;
  lastUpdated?: string | null;
  imported: boolean;
  ready?: boolean;
  cookieId?: string | null;
  fileName: string;
  label?: CookieLabel | null;
  isActiveSingle?: boolean;
  isActiveDouble?: boolean;
  isActiveMulti?: boolean;
  isActiveSwiftSolutions?: boolean;
  isActiveTest?: boolean;
  isWorking?: boolean;
  isActive?: boolean;
}

export interface FreightdeskStatus {
  configured: boolean;
  apiUrl: string;
}

export interface PartnerSwiftCookieOption {
  _id: string;
  fileName: string;
  sessionName: string | null;
  sessionId: string | null;
  label: CookieLabel;
  hasCookies: boolean;
  ready: boolean;
  isActiveSwiftSolutions: boolean;
}

export interface PartnerSwiftPreviewAccount {
  slot: number;
  displayName: string;
  isActive: boolean;
  ready: boolean;
}

export interface PartnerSwiftStaleEntry {
  id: string;
  reason: 'deleted' | 'no_cookies';
  sessionName?: string | null;
  fileName?: string;
}

export interface PartnerSwiftDashboardConfig {
  manualSelectionEnabled: boolean;
  selectedCookieIds: string[];
  selectedAccounts: PartnerSwiftCookieOption[];
  validSelectedCount?: number;
  staleSelectedCount?: number;
  staleRemoved?: PartnerSwiftStaleEntry[];
  selectionPruned?: boolean;
  slotLimit: number;
  availableCookies: PartnerSwiftCookieOption[];
  previewAccountCount: number;
  previewAccounts: PartnerSwiftPreviewAccount[];
  message?: string;
}

export interface PlatformPermissions {
  desktop: boolean;
  mobile: boolean;
  extension: boolean;
}

export interface Message {
  _id: string;
  title: string;
  message: string;
  platform: 'all' | 'desktop' | 'mobile' | 'extension';
  sessionId?: string | { _id: string; name: string; proxy: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalespersonCommissionPayment {
  _id: string;
  salespersonId: User | string;
  amount: number;
  month: number;
  year: number;
  paymentDate: string;
  notes?: string;
  coveredCommissionIds?: string[];
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
  period?: string; // Virtual field for display
}

export interface SalespersonCommissionSummary {
  salesperson: {
    _id: string;
    name: string;
    email: string;
  };
  summary: {
    totalEarned: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  monthlySummary: Array<{
    year: number;
    month: number;
    totalEarned: number;
    paidAmount: number;
    unpaidAmount: number;
    manualPayments: Array<{
      _id: string;
      amount: number;
      paymentDate: string;
      notes?: string;
      createdBy: string;
      coveredCommissionIds?: string[];
    }>;
    netUnpaid: number;
    payments: Array<{
      paymentId: string;
      amount: number;
      commission: number;
      commissionPaid: boolean;
      paymentDate: string;
    }>;
  }>;
  recentPayments: SalespersonCommissionPayment[];
}

export interface SalespersonWithCommission {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  totalEarned: number;
  totalPaid: number;
  outstanding: number;
  userCount: number;
  lastPayment: string | null;
}

export interface ExtensionProxyPoolItem {
  _id: string;
  container: string;
  host: string;
  port: number;
  username: string;
  providerName: string;
  isActive: boolean;
  proxyPreview: string;
}

export type ExtensionProxySource = 'env' | 'session' | 'custom' | 'proxyPool';
export type ExtensionProxyProductKey = 'datGo' | 'swiftSolutions' | 'datHub';

export interface ExtensionProxyCustomConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  configured: boolean;
}

export interface ExtensionProxyProductConfig {
  enabled: boolean;
  source: ExtensionProxySource;
  sessionId: string | null;
  proxyIpId: string | null;
  session: {
    _id: string;
    name: string;
    proxyPreview: string;
  } | null;
  proxyIp: ExtensionProxyPoolItem | null;
  custom: ExtensionProxyCustomConfig;
  usesGlobal: boolean;
  active: {
    source: ExtensionProxySource;
    host: string;
    port: number;
    username: string;
    enabled: boolean;
    error: string | null;
    container?: string | null;
  };
}

export interface ExtensionProxyAdminConfig {
  enabled: boolean;
  source: ExtensionProxySource;
  sessionId: string | null;
  proxyIpId: string | null;
  session: {
    _id: string;
    name: string;
    proxyPreview: string;
  } | null;
  proxyIp: ExtensionProxyPoolItem | null;
  availableProxies: ExtensionProxyPoolItem[];
  productEnabled: {
    datGo: boolean;
    swiftSolutions: boolean;
    datHub: boolean;
  };
  productProxy: Record<ExtensionProxyProductKey, ExtensionProxyProductConfig>;
  custom: ExtensionProxyCustomConfig;
  env: {
    host: string;
    port: number;
    username: string;
    enabled: boolean;
    configured: boolean;
  };
  active: {
    source: ExtensionProxySource;
    host: string;
    port: number;
    username: string;
    enabled: boolean;
    error: string | null;
  };
  message?: string;
}

export interface SchedulerSyncOptions {
  autoAssignUserSessionsOnSync: boolean;
  autoUpdateSessionProxiesOnSync: boolean;
}
