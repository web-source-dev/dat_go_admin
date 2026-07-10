'use client';

import React from 'react';
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from 'react';
import { useState } from 'react';
import { Search, Plus, MoreVertical, Shield, Ban, Edit, AlertCircle, ChevronDown, ChevronRight, X, Coins, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Loading from './loading';
import { usersApi } from '@/lib/api';
import { AddUserDialog } from '@/components/admin/add-user-dialog';
import { EditUserDialog } from '@/components/admin/edit-user-dialog';
import { BanUserDialog } from '@/components/admin/ban-user-dialog';
import { UserPermissionsEditor } from '@/components/admin/user-permissions-editor';
import { UserPaymentsEditor } from '@/components/admin/user-payments-editor';
import { DataPagination } from '@/components/admin/data-pagination';
import { useDebounce } from '@/hooks/use-debounce';
import { User, Payment } from '@/lib/types';
import { paymentsApi } from '@/lib/api';

const SWIFT_SOLUTIONS_LABEL = 'swiftSolutions';

interface UserPaymentInfo {
  currentMonth?: Payment;
  previousMonth?: Payment;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [userPayments, setUserPayments] = useState<Map<string, UserPaymentInfo>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedView, setExpandedView] = useState<'permissions' | 'payments'>('permissions');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pendingPaymentsInfo, setPendingPaymentsInfo] = useState<{ count: number; amount: number } | null>(null);
  const [proxyToggleLoading, setProxyToggleLoading] = useState<Set<string>>(new Set());
  const [signalToggleLoading, setSignalToggleLoading] = useState<Set<string>>(new Set());
  const [sessionModeLoading, setSessionModeLoading] = useState<Set<string>>(new Set());
  const [signalSyncLoading, setSignalSyncLoading] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const itemsPerPage = 10;
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    fetchAvailableLabels();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, debouncedSearchTerm, statusFilter, labelFilter, dateFrom, dateTo]);

  const fetchAvailableLabels = async () => {
    try {
      const data = await usersApi.getAvailableLabels();
      setAvailableLabels(data.labels || []);
    } catch (error) {
      console.error('Failed to fetch available labels:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await usersApi.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        label: labelFilter === 'all' ? undefined : labelFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      const fetchedUsers = data.users || [];
      setUsers(fetchedUsers);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalUsers(data.pagination?.totalUsers || 0);
      
      // Set pending payments info if available
      if (data.pendingPayments) {
        setPendingPaymentsInfo(data.pendingPayments);
      } else {
        setPendingPaymentsInfo(null);
      }
      
      // Fetch payment data for current and previous month for each user
      await fetchUserPayments(fetchedUsers);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPayments = async (usersList: User[]) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }

    const paymentsMap = new Map<string, UserPaymentInfo>();

    // Fetch payments for all users in parallel
    await Promise.all(
      usersList.map(async (user) => {
        try {
          const response = await paymentsApi.getUserPayments(user._id, { limit: 12 });
          const payments = response.payments || [];
          
          const currentMonthPayment = payments.find(
            (p: Payment) => p.month === currentMonth && p.year === currentYear
          );
          const previousMonthPayment = payments.find(
            (p: Payment) => p.month === prevMonth && p.year === prevYear
          );

          paymentsMap.set(user._id, {
            currentMonth: currentMonthPayment,
            previousMonth: previousMonthPayment
          });
        } catch (error) {
          // Silently fail for individual users
          console.error(`Failed to fetch payments for user ${user._id}:`, error);
        }
      })
    );

    setUserPayments(paymentsMap);
  };

  // Note: Filtering is now done server-side with pagination

  const handleAddUser = () => {
    setAddDialogOpen(true);
  };

  const handleSyncAllSignalUsers = async () => {
    if (signalSyncLoading) return;
    const confirmed = confirm(
      'Sync all DAT GO users to the Signal extension backend?\n\nThis creates or updates Signal user records (email, access flags, and password hash).'
    );
    if (!confirmed) return;

    setSignalSyncLoading(true);
    try {
      const result = await usersApi.syncAllSignalUsers();
      toast({
        title: 'Signal sync completed',
        description: `Attempted ${result.attempted}. Updated ${result.synced}. Failed ${result.failed}.`,
      });
      await fetchUsers();
    } catch (err: any) {
      toast({
        title: 'Signal sync failed',
        description: err.response?.data?.message || err.message || 'Failed to sync users',
        variant: 'destructive',
      });
    } finally {
      setSignalSyncLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };


  const handleBanUser = (user: User) => {
    setSelectedUser(user);
    setBanDialogOpen(true);
  };

  const handleUserSuccess = () => {
    fetchUsers(); // Refresh the data
  };

  const handleUserAdded = (newUser: User) => {
    setUsers(prev => [newUser, ...prev]);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(prev => prev.map(user => user._id === updatedUser._id ? updatedUser : user));
  };

  const handleExtensionProxyToggle = async (user: User, enabled: boolean) => {
    setProxyToggleLoading((prev) => new Set(prev).add(user._id));
    try {
      const response = await usersApi.update(user._id, {
        permissions: { extensionProxy: enabled },
      });
      const updatedUser: User = {
        ...user,
        permissions: response.permissions || {
          ...user.permissions,
          extensionProxy: enabled,
        },
      };
      handleUserUpdated(updatedUser);
      toast({
        title: enabled ? 'Extension proxy enabled' : 'Extension proxy disabled',
        description: `${user.name} will ${enabled ? 'use' : 'not use'} the server proxy.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update extension proxy',
        variant: 'destructive',
      });
    } finally {
      setProxyToggleLoading((prev) => {
        const next = new Set(prev);
        next.delete(user._id);
        return next;
      });
    }
  };


  const handleSignalToggle = async (user: User, enabled: boolean) => {
    setSignalToggleLoading((prev) => new Set(prev).add(user._id));
    try {
      const response = await usersApi.update(user._id, { signalEnabled: enabled });
      handleUserUpdated({ ...user, ...response, signalEnabled: enabled });
      toast({
        title: enabled ? 'Signal enabled' : 'Signal disabled',
        description: `${user.name} ${enabled ? 'can' : 'cannot'} sign in to the Signal extension.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update Signal access',
        variant: 'destructive',
      });
    } finally {
      setSignalToggleLoading((prev) => {
        const next = new Set(prev);
        next.delete(user._id);
        return next;
      });
    }
  };

  const handleSessionOpenModeChange = async (user: User, mode: 'zip' | 'cookie') => {
    const current = user.sessionOpenMode === 'cookie' ? 'cookie' : 'zip';
    if (current === mode || sessionModeLoading.has(user._id)) return;

    setSessionModeLoading((prev) => new Set(prev).add(user._id));
    try {
      const response = await usersApi.update(user._id, { sessionOpenMode: mode });
      handleUserUpdated({
        ...user,
        ...response,
        sessionOpenMode: mode,
      });
      toast({
        title: mode === 'cookie' ? 'Cookie mode enabled' : 'ZIP mode enabled',
        description: `${user.name} will open DAT using ${mode === 'cookie' ? 'cookie file' : 'session ZIP'}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update session open mode',
        variant: 'destructive',
      });
    } finally {
      setSessionModeLoading((prev) => {
        const next = new Set(prev);
        next.delete(user._id);
        return next;
      });
    }
  };


  const handleUserBanned = (userId: string, isBanned: boolean) => {
    setUsers(prev => prev.map(user =>
      user._id === userId ? { ...user, isBanned } : user
    ));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setLabelFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || labelFilter !== 'all' || dateFrom || dateTo;

  const toggleRowExpansion = (userId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
      setExpandedView('permissions'); // Reset to permissions view when expanding
    }
    setExpandedRows(newExpanded);
  };
  const getStatusColor = (isBanned: boolean) => {
    return isBanned
      ? 'bg-red-500 text-white'
      : 'bg-green-500 text-white';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatMonthYear = (month: number, year: number) => {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatShortDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border/50 bg-gradient-to-r from-card to-card/95 px-8 py-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">User Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage users, roles, and access permissions
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                onClick={handleSyncAllSignalUsers}
                disabled={signalSyncLoading}
              >
                <RefreshCw size={18} className={`mr-2 ${signalSyncLoading ? 'animate-spin' : ''}`} />
                {signalSyncLoading ? 'Syncing...' : 'Sync Signal Users'}
              </Button>
              <Button
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-md transition-all duration-200"
                onClick={handleAddUser}
              >
                <Plus size={18} className="mr-2" />
                Add User
              </Button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-8 py-4 bg-destructive/10 border-b border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="ml-auto text-destructive hover:text-destructive"
              >
                ✕
              </Button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="px-8 py-4 bg-background border-b border-border">
          <div className="grid grid-cols-6 gap-4 items-end">
            {/* Search */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
                <Input
                  type="text"
                  placeholder="Name or email..."
                  className="pl-10 bg-card border-border text-foreground"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Status</label>
              <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'banned') => setStatusFilter(value)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Label Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Label</label>
              <Select
                value={labelFilter}
                onValueChange={(value: string) => {
                  setLabelFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (excl. Swift Solutions)</SelectItem>
                  <SelectItem value={SWIFT_SOLUTIONS_LABEL}>Swift Solutions</SelectItem>
                  {availableLabels
                    .filter((label) => label !== SWIFT_SOLUTIONS_LABEL)
                    .map((label) => (
                      <SelectItem key={label} value={label}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-card border-border"
              />
            </div>

            {/* To Date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-card border-border"
              />
            </div>

            {/* Clear Button */}
            <div className="flex flex-col">
              <div className="h-5"></div> {/* Spacer to align with labels */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="justify-start">
                  <X size={16} className="mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Pending Payments Info */}
          {pendingPaymentsInfo && pendingPaymentsInfo.count > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle size={18} />
                <span className="text-sm font-medium">
                  Pending Payments: {pendingPaymentsInfo.count} payment{pendingPaymentsInfo.count !== 1 ? 's' : ''} 
                  {' '}totaling RS {pendingPaymentsInfo.amount.toLocaleString('en-PK')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="flex-1 overflow-auto">
          <div className="px-8 py-6">
            <div className="bg-card rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground" title="Per-user extension proxy (server VPN)">
                      Ext. Proxy
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground" title="Signal browser extension access">
                      Signal
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground" title="How desktop opens DAT">
                      Open Mode
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Monthly Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Current Month
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Previous Month
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Referral
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Label
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      AnyDesk ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <React.Fragment key={user._id}>
                      <tr
                        className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => toggleRowExpansion(user._id)}
                      >
                        <td className="px-6 py-4 text-sm text-foreground font-medium">
                          <div className="flex items-center gap-2">
                            {expandedRows.has(user._id) ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            {user.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {user.email}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              user.isBanned
                            )}`}
                          >
                            <span className="w-2 h-2 rounded-full bg-current" />
                            {user.isBanned ? 'Banned' : 'Active'}
                          </span>
                            {user.isTrial && user.trialEndDate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                Trial
                                {new Date(user.trialEndDate) > new Date() ? (
                                  <span className="text-[10px]">
                                    (Expires: {new Date(user.trialEndDate).toLocaleDateString()})
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-red-600">(Expired)</span>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.permissions?.extensionProxy !== false}
                              disabled={proxyToggleLoading.has(user._id)}
                              onCheckedChange={(checked) => handleExtensionProxyToggle(user, checked)}
                              aria-label={`Extension proxy for ${user.name}`}
                            />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {user.permissions?.extensionProxy === false ? 'Off' : 'On'}
                            </span>
                          </div>
                        </td>
                        <td
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.signalEnabled === true}
                              disabled={signalToggleLoading.has(user._id)}
                              onCheckedChange={(checked) => handleSignalToggle(user, checked)}
                              aria-label={`Signal access for ${user.name}`}
                            />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {user.signalEnabled ? 'On' : 'Off'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                            {user.plan || 'single'}
                          </span>
                        </td>
                        <td
                          className="px-6 py-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Select
                            value={user.sessionOpenMode === 'cookie' ? 'cookie' : 'zip'}
                            onValueChange={(value: 'zip' | 'cookie') => handleSessionOpenModeChange(user, value)}
                            disabled={sessionModeLoading.has(user._id)}
                          >
                            <SelectTrigger className="h-8 w-[110px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="zip">ZIP</SelectItem>
                              <SelectItem value="cookie">Cookie</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4">
                          {user.monthlyPaymentAmount && user.monthlyPaymentAmount > 0 ? (
                            <div className="flex items-center gap-1">
                              <Coins size={14} className="text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                RS {user.monthlyPaymentAmount.toLocaleString('en-PK')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No payment</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const paymentInfo = userPayments.get(user._id);
                            const currentPayment = paymentInfo?.currentMonth;
                            if (!currentPayment) {
                              return <span className="text-xs text-muted-foreground">No payment</span>;
                            }
                            const isPaid = currentPayment.status === 'paid';
                            const isRefunded = currentPayment.isRefunded;
                            return (
                              <div className="text-xs">
                                <div className="font-medium text-foreground mb-0.5">
                                  {formatMonthYear(currentPayment.month, currentPayment.year)}
                                </div>
                                <div className={`font-medium ${isPaid && !isRefunded ? 'text-green-600' : isRefunded ? 'text-orange-600' : 'text-red-600'}`}>
                                  RS {currentPayment.amount.toLocaleString('en-PK')}
                                </div>
                                <div className={`text-[10px] mt-0.5 ${
                                  isPaid && !isRefunded ? 'text-green-600' : 
                                  isRefunded ? 'text-orange-600' : 
                                  'text-red-600'
                                }`}>
                                  {isRefunded ? 'Refunded' : isPaid ? 'Paid' : 'Pending'}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Due {formatShortDate(currentPayment.dueDate)}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const paymentInfo = userPayments.get(user._id);
                            const previousPayment = paymentInfo?.previousMonth;
                            if (!previousPayment) {
                              return <span className="text-xs text-muted-foreground">No payment</span>;
                            }
                            const isPaid = previousPayment.status === 'paid';
                            const isRefunded = previousPayment.isRefunded;
                            return (
                              <div className="text-xs">
                                <div className="font-medium text-foreground mb-0.5">
                                  {formatMonthYear(previousPayment.month, previousPayment.year)}
                                </div>
                                <div className={`font-medium ${isPaid && !isRefunded ? 'text-green-600' : isRefunded ? 'text-orange-600' : 'text-red-600'}`}>
                                  RS {previousPayment.amount.toLocaleString('en-PK')}
                                </div>
                                <div className={`text-[10px] mt-0.5 ${
                                  isPaid && !isRefunded ? 'text-green-600' : 
                                  isRefunded ? 'text-orange-600' : 
                                  'text-red-600'
                                }`}>
                                  {isRefunded ? 'Refunded' : isPaid ? 'Paid' : 'Pending'}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Due {formatShortDate(previousPayment.dueDate)}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {user.referralCode && (
                            <div className="text-xs">
                              <div className="font-medium text-blue-600">{user.referralCode}</div>
                              {user.referredBy && (
                                <div className="text-muted-foreground">Used referral</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.label ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-500/10 text-purple-600">
                              {user.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.anydeskid ? (
                            <span className="text-xs font-mono text-foreground">{user.anydeskid}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                                  <MoreVertical size={18} className="text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                                <DropdownMenuItem
                                onClick={() => handleEditUser(user)}
                                className="cursor-pointer text-foreground hover:bg-muted"
                              >
                                <Edit size={16} className="mr-2" />
                                Edit User
                              </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleBanUser(user)}
                              className="cursor-pointer text-foreground hover:bg-muted"
                            >
                              <Ban size={16} className="mr-2" />
                              {user.isBanned ? 'Unban' : 'Ban'} User
                            </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                      {expandedRows.has(user._id) && (
                        <tr>
                          <td colSpan={14} className="px-6 py-4">
                            <div className="space-y-4">
                              {/* Tab Buttons */}
                              <div className="flex gap-2">
                                <Button
                                  variant={expandedView === 'permissions' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setExpandedView('permissions')}
                                >
                                  Permissions
                                </Button>
                                <Button
                                  variant={expandedView === 'payments' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setExpandedView('payments')}
                                >
                                  Payments
                                </Button>
                              </div>

                              {/* Content */}
                              {expandedView === 'permissions' ? (
                                <UserPermissionsEditor
                                  user={user}
                                  onSave={(updatedUser: any) => {
                                    toggleRowExpansion(user._id);
                                    handleUserUpdated(updatedUser);
                                  }}
                                  onCancel={() => toggleRowExpansion(user._id)}
                                />
                              ) : (
                                <UserPaymentsEditor
                                  user={user}
                                  onClose={() => toggleRowExpansion(user._id)}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-muted-foreground">No users found matching your search</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination */}
        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={totalUsers}
          itemsPerPage={itemsPerPage}
        />
      </div>

      {/* Dialogs */}
        <AddUserDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSuccess={handleUserAdded}
          onRefresh={handleUserSuccess}
        />

        <EditUserDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={(updatedUser: any) => handleUserUpdated(updatedUser as User)}
          onRefresh={handleUserSuccess}
          user={selectedUser}
        />


        <BanUserDialog
          open={banDialogOpen}
          onClose={() => setBanDialogOpen(false)}
          onSuccess={handleUserBanned}
          user={selectedUser}
        />
    </Suspense>
  );
}
