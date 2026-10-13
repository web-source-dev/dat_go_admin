'use client';

import { useSearchParams } from "next/navigation"
import Loading from './loading';
import { useEffect, useRef, useState } from 'react';
import { Search, Plus, MoreVertical, AlertCircle, Trash2, RefreshCw, X, FileText, Download, CheckCircle2, Circle, Send } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { cookiesApi, usersApi, getSharedDbBackend, type PushSessionPayload } from '@/lib/api';
import { maskProxy, truncateText } from '@/lib/utils';
import { DataPagination } from '@/components/admin/data-pagination';
import { useDebounce } from '@/hooks/use-debounce';
import { AddCookieDialog } from '@/components/admin/add-cookie-dialog';
import { EditCookieDialog } from '@/components/admin/edit-cookie-dialog';
import { GetHalvexCookieDialog } from '@/components/admin/get-halvex-cookie-dialog';
import { Cookie, User } from '@/lib/types';
import { COOKIE_LABEL_OPTIONS, CookieLabel, isAssignableCookieLabel } from '@/lib/cookieLabels';

type LabelFilter = 'all' | CookieLabel;

/** A cookie is FreightDesk-sourced when it came from an FD container import (mirrors the backend helper). */
function isFreightdeskCookie(cookie: Cookie): boolean {
  const source = String(cookie.source || '');
  if (source.startsWith('freightdesk')) return true;
  if (String(cookie.fileName || '').startsWith('fd-container-')) return true;
  return false;
}

/** Source badge: FreightDesk / Device pull / Uploaded (for manual/legacy uploads). */
function CookieSourceBadge({ cookie }: { cookie: Cookie }) {
  if (isFreightdeskCookie(cookie)) {
    return (
      <span
        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30"
        title="Imported from a FreightDesk container — uses the container's bound proxy"
      >
        FreightDesk
      </span>
    );
  }
  if (String(cookie.source || '') === 'device-pull') {
    return (
      <span
        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30"
        title="Pulled live from a user's device"
      >
        Device pull
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30"
      title="Uploaded/manual cookie — opens DAT with the user's session proxy"
    >
      Uploaded
    </span>
  );
}
type PushScope = 'all' | 'plan' | 'label' | 'user';
type PushPlan = 'single' | 'double' | 'multi';

export default function CookiesPage() {
  const [cookies, setCookies] = useState<Cookie[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCookies, setTotalCookies] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [halvexDialogOpen, setHalvexDialogOpen] = useState(false);
  const [selectedCookie, setSelectedCookie] = useState<Cookie | null>(null);
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all');
  const [syncing, setSyncing] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const syncInFlightRef = useRef(false);
  const deleteAllInFlightRef = useRef(false);
  const searchParams = useSearchParams();
  const itemsPerPage = 10;
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Push session refresh (toolbar dialog + per-cookie action)
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [pushScope, setPushScope] = useState<PushScope>('plan');
  const [pushPlan, setPushPlan] = useState<PushPlan>('single');
  const [pushLabel, setPushLabel] = useState('');
  const [pushUserQuery, setPushUserQuery] = useState('');
  const [pushUserHits, setPushUserHits] = useState<User[]>([]);
  const [pushUserId, setPushUserId] = useState('');
  const [pushUserSearching, setPushUserSearching] = useState(false);
  const [userLabels, setUserLabels] = useState<string[]>([]);
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    fetchCookies();
  }, [currentPage, debouncedSearchTerm, labelFilter]);

  const fetchCookies = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cookiesApi.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        label: labelFilter !== 'all' ? labelFilter : undefined
      });
      setCookies(data.cookies || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCookies(data.pagination?.totalCookies || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch cookies');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setLabelFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = labelFilter !== 'all';

  const handleAddCookie = () => {
    setAddDialogOpen(true);
  };

  const handleEditCookie = (cookie: Cookie) => {
    setSelectedCookie(cookie);
    setEditDialogOpen(true);
  };

  const handleCookieSuccess = () => {
    fetchCookies(); // Refresh the data
  };

  const handleCookieAdded = (newCookie: Cookie) => {
    setCookies(prev => [newCookie, ...prev]);
  };

  const handleCookieUpdated = (updatedCookie: Cookie) => {
    setCookies(prev => prev.map(cookie => cookie._id === updatedCookie._id ? updatedCookie : cookie));
  };

  const handleQuickLabelChange = async (cookie: Cookie, label: string) => {
    if (!isAssignableCookieLabel(label)) return;
    try {
      const updated = await cookiesApi.update(cookie._id, { label });
      handleCookieUpdated(updated);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update label');
    }
  };

  const handleQuickWorkingChange = async (cookie: Cookie, isWorking: boolean) => {
    // Optimistic update for snappy UI
    handleCookieUpdated({ ...cookie, isWorking });
    try {
      const updated = await cookiesApi.update(cookie._id, { isWorking });
      handleCookieUpdated(updated);
      setError(null);
    } catch (err: any) {
      handleCookieUpdated({ ...cookie, isWorking: !isWorking });
      setError(err.response?.data?.message || err.message || 'Failed to update working status');
    }
  };

  type CookieChannel = 'single' | 'double' | 'multi' | 'swiftSolutions' | 'test' | 'horizon';

  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const isChannelActive = (cookie: Cookie, channel: CookieChannel) => {
    switch (channel) {
      case 'double':
        return Boolean(cookie.isActiveDouble);
      case 'multi':
        return Boolean(cookie.isActiveMulti);
      case 'swiftSolutions':
        return Boolean(cookie.isActiveSwiftSolutions);
      case 'test':
        return Boolean(cookie.isActiveTest);
      case 'horizon':
        return Boolean(cookie.isActiveHorizon);
      case 'single':
      default:
        return Boolean(cookie.isActiveSingle);
    }
  };

  const handleToggleChannel = async (cookie: Cookie, channel: CookieChannel) => {
    const key = `${cookie._id}:${channel}`;
    if (togglingKey) return;
    setTogglingKey(key);
    try {
      if (isChannelActive(cookie, channel)) {
        await cookiesApi.deactivate(cookie._id, channel);
      } else {
        await cookiesApi.activate(cookie._id, channel);
      }
      await fetchCookies();
      setError(null);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          `Failed to toggle ${channel} for this cookie`
      );
    } finally {
      setTogglingKey(null);
    }
  };

  const renderChannelToggle = (
    cookie: Cookie,
    channel: CookieChannel,
    activeClassName: string
  ) => {
    const active = isChannelActive(cookie, channel);
    const key = `${cookie._id}:${channel}`;
    const busy = togglingKey === key;

    return (
      <button
        type="button"
        disabled={!!togglingKey}
        onClick={() => handleToggleChannel(cookie, channel)}
        title={active ? `Click to disable ${channel}` : `Click to enable ${channel}`}
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait hover:opacity-90 ${
          active
            ? activeClassName
            : 'bg-gray-500/10 text-gray-600 border-gray-500/30 hover:bg-gray-500/20'
        }`}
      >
        {busy ? (
          <span className="inline-block w-3.5 h-3.5 mr-1 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : active ? (
          <CheckCircle2 size={14} className="mr-1" />
        ) : (
          <Circle size={14} className="mr-1" />
        )}
        {busy ? '…' : active ? 'Active' : 'Inactive'}
      </button>
    );
  };

  const handleActivateCookie = async (cookie: Cookie, channel: CookieChannel) => {
    try {
      await cookiesApi.activate(cookie._id, channel);
      await fetchCookies();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to activate cookie for ${channel}`);
    }
  };

  const handleDeactivateCookie = async (cookie: Cookie, channel: CookieChannel) => {
    try {
      await cookiesApi.deactivate(cookie._id, channel);
      await fetchCookies();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to deactivate cookie for ${channel}`);
    }
  };

  const handleDeleteCookie = async (cookie: Cookie) => {
    if (!confirm(`Are you sure you want to delete "${cookie.fileName}"?`)) {
      return;
    }

    try {
      await cookiesApi.delete(cookie._id);
      setCookies(prev => prev.filter(c => c._id !== cookie._id));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete cookie');
    }
  };

  const handleDeleteAllCookies = async () => {
    if (deleteAllInFlightRef.current) return;
    if (
      !confirm(
        'Delete ALL cookies from the shared database?\n\nThis removes every cookie record (served from Primary). This cannot be undone.'
      )
    ) {
      return;
    }

    deleteAllInFlightRef.current = true;
    setDeletingAll(true);
    try {
      // Shared Mongo — one delete on Primary is enough for all backends.
      const backend = getSharedDbBackend();
      const data = await cookiesApi.deleteAll(backend.url);
      const via =
        data.method === 'legacy-per-id'
          ? ' (legacy fallback)'
          : data.method === 'delete-all-alias'
            ? ' (alias)'
            : '';
      toast.success(`${backend.label}: deleted all cookies${via}`, {
        description: `${data.deletedRecords ?? 0} records, ${data.deletedFiles ?? 0} files removed`,
      });

      setCookies([]);
      setTotalCookies(0);
      setTotalPages(1);
      setCurrentPage(1);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete all cookies');
    } finally {
      deleteAllInFlightRef.current = false;
      setDeletingAll(false);
    }
  };

  const handleSyncCookies = async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      // Shared Mongo — sync once on Primary (legacy disk→DB backfill if needed).
      const backend = getSharedDbBackend();
      const data = await cookiesApi.sync(backend.url);
      const deduped = data.dedupedManual?.removedRecords;
      const dedupedNote =
        typeof deduped === 'number' && deduped > 0
          ? `, ${deduped} duplicate manual removed`
          : '';
      toast.success(`${backend.label}: sync ✓`, {
        description: `${data.created} created, ${data.updated} updated, ${data.deleted} deleted${dedupedNote}`,
      });
      await fetchCookies();
      setError(null);
    } catch (err: any) {
      const isBusy = err?.response?.status === 409;
      setError(
        isBusy
          ? 'Sync already running — wait and try again'
          : err.response?.data?.message || err.message || 'Failed to sync cookies'
      );
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  };

  const openPushDialog = async () => {
    setPushDialogOpen(true);
    if (!userLabels.length) {
      try {
        const data = await usersApi.getAvailableLabels();
        setUserLabels(data.labels || []);
      } catch {
        // label list is optional; the input still accepts free text
      }
    }
  };

  const searchPushUsers = async () => {
    const q = pushUserQuery.trim();
    if (!q) return;
    setPushUserSearching(true);
    try {
      const data = await usersApi.getAll({ search: q, limit: 20 });
      const hits: User[] = data.users || [];
      setPushUserHits(hits);
      setPushUserId(hits.length === 1 ? hits[0]._id : '');
      if (!hits.length) toast.info('No users matched that search.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'User search failed');
    } finally {
      setPushUserSearching(false);
    }
  };

  /** Describe a push target for the confirm prompt. */
  const describePush = (payload: PushSessionPayload) => {
    switch (payload.scope) {
      case 'all':
        return 'EVERY user account';
      case 'plan':
        return `all ${payload.plan} plan users`;
      case 'label':
        return payload.label === 'none' ? 'all users without a label' : `all users labelled "${payload.label}"`;
      case 'user': {
        const u = pushUserHits.find((x) => x._id === payload.userId);
        return u ? `${u.name} (${u.email})` : 'the selected user';
      }
      case 'cookie':
        return 'all users currently on this cookie';
      default:
        return 'the selected users';
    }
  };

  const sendPushSession = async (payload: PushSessionPayload, confirmText: string) => {
    if (pushing) return false;
    if (!confirm(confirmText)) return false;
    setPushing(true);
    try {
      const result = await cookiesApi.pushSession(payload);
      const count = Number(result?.count || 0);
      if (count > 0) {
        toast.success(`Session refresh queued for ${count} account${count === 1 ? '' : 's'}`, {
          description: result?.message,
        });
      } else {
        toast.info('No accounts matched', { description: result?.message });
      }
      return true;
    } catch (err: any) {
      toast.error('Push session refresh failed', {
        description: err.response?.data?.message || err.message,
      });
      return false;
    } finally {
      setPushing(false);
    }
  };

  const handlePushFromDialog = async () => {
    let payload: PushSessionPayload;
    if (pushScope === 'all') {
      payload = { scope: 'all' };
    } else if (pushScope === 'plan') {
      payload = { scope: 'plan', plan: pushPlan };
    } else if (pushScope === 'label') {
      const label = pushLabel.trim();
      if (!label) {
        toast.error('Choose a label first');
        return;
      }
      payload = { scope: 'label', label };
    } else {
      if (!pushUserId) {
        toast.error('Search for and select a user first');
        return;
      }
      payload = { scope: 'user', userId: pushUserId };
    }

    const confirmText =
      payload.scope === 'all'
        ? 'WARNING: push a session refresh to EVERY user account?\n\nEvery desktop will discard its local DAT profile and reload the current cookie the next time DAT opens. Anyone mid-session will be signed back in from the server copy.\n\nThis affects ALL users. Continue?'
        : `Push a session refresh to ${describePush(payload)}?\n\nTheir desktop will replace its local DAT profile with the current cookie the next time DAT opens.`;
    const sent = await sendPushSession(payload, confirmText);
    if (sent) setPushDialogOpen(false);
  };

  const handlePushForCookie = (cookie: Cookie) =>
    sendPushSession(
      { scope: 'cookie', cookieId: cookie._id },
      `Push a session refresh to all users on "${cookie.fileName}"?\n\nTheir desktop will replace its local DAT profile with this cookie the next time DAT opens.`
    );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading cookies...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border bg-card px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Cookie Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Click Active/Inactive tags to enable or disable a cookie for each channel
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setHalvexDialogOpen(true)}
                disabled={deletingAll}
              >
                <Download size={18} className="mr-2" />
                Get Halvex cookies
              </Button>
              <Button
                variant="outline"
                onClick={openPushDialog}
                disabled={pushing || deletingAll}
                title="Make desktops reload the current DAT session the next time they open DAT"
              >
                <Send size={18} className="mr-2" />
                Push session refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleSyncCookies}
                disabled={syncing || deletingAll}
              >
                <RefreshCw size={18} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Files'}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAllCookies}
                disabled={deletingAll || syncing}
              >
                <Trash2 size={18} className="mr-2" />
                {deletingAll ? 'Deleting...' : 'Delete All'}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleAddCookie}
                disabled={deletingAll}
              >
                <Plus size={18} className="mr-2" />
                Add Cookie
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
          <div className="grid grid-cols-4 gap-4 items-end">
            {/* Search */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
                <Input
                  type="text"
                  placeholder="File name, session..."
                  className="pl-10 bg-card border-border text-foreground"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Label Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Label</label>
              <Select value={labelFilter} onValueChange={(value: LabelFilter) => setLabelFilter(value)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Labels</SelectItem>
                  {COOKIE_LABEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="multi">Multi (legacy)</SelectItem>
                </SelectContent>
              </Select>
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
        </div>

        {/* Cookies Table */}
        <div className="flex-1">
          <div className="px-8 py-6">
            <div className="bg-card rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Session Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Label
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Cookies
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Last Updated
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground"
                      title="Bound proxy / user agent, DAT login expiry, last Dat Desk sync"
                    >
                      Browser / Login
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Working
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Single
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Double
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Multi
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Swift
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Test
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Horizon
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.map((cookie) => (
                    <tr
                      key={cookie._id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-foreground font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText size={16} className="text-muted-foreground shrink-0" />
                          <span className="break-all">{cookie.fileName}</span>
                          <CookieSourceBadge cookie={cookie} />
                          {cookie.isManualUpload && (
                            <span
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              title="Manual upload — kept on sync until you delete it"
                            >
                              Manual
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {cookie.sessionName || cookie.sessionId || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <Select
                          value={cookie.label}
                          onValueChange={(value) => handleQuickLabelChange(cookie, value)}
                        >
                          <SelectTrigger className="h-8 w-[190px] bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COOKIE_LABEL_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                            {cookie.label === 'multi' && (
                              <SelectItem value="multi">Multi (legacy)</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {cookie.hasCookies ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            {cookie.cookieCount} cookies
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No cookies</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatFileSize(cookie.fileSize)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {cookie.lastUpdated ? formatDate(cookie.lastUpdated) : '-'}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground align-top">
                        <div className="space-y-0.5 max-w-[240px]">
                          <div className="truncate" title={cookie.proxy ? maskProxy(cookie.proxy) : undefined}>
                            <span className="text-muted-foreground/70">Proxy:</span>{' '}
                            <span className="font-mono text-foreground">
                              {cookie.proxy
                                ? maskProxy(cookie.proxy)
                                : isFreightdeskCookie(cookie)
                                  ? 'container (by name)'
                                  : 'uses session proxy'}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground/70">
                            {isFreightdeskCookie(cookie)
                              ? 'FreightDesk → container proxy (authoritative)'
                              : 'Custom upload → per-user session proxy'}
                          </div>
                          <div className="truncate" title={cookie.userAgent || undefined}>
                            <span className="text-muted-foreground/70">UA:</span>{' '}
                            <span className="font-mono text-foreground">
                              {cookie.userAgent ? truncateText(cookie.userAgent, 32) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground/70">Login until:</span>{' '}
                            <span
                              className={
                                cookie.authExpiresAt && new Date(cookie.authExpiresAt).getTime() < Date.now()
                                  ? 'text-destructive font-medium'
                                  : 'text-foreground'
                              }
                            >
                              {cookie.authExpiresAt ? formatDate(cookie.authExpiresAt) : '—'}
                            </span>
                          </div>
                          <div className="truncate" title={cookie.syncedBy || undefined}>
                            <span className="text-muted-foreground/70">Synced:</span>{' '}
                            <span className="text-foreground">
                              {cookie.syncedAt ? formatDate(cookie.syncedAt) : '—'}
                            </span>
                            {cookie.syncedBy ? <span> · {cookie.syncedBy}</span> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(cookie.isWorking)}
                            onCheckedChange={(checked) => handleQuickWorkingChange(cookie, checked)}
                            aria-label={`Mark ${cookie.fileName} as working`}
                          />
                          <span
                            className={`text-xs font-medium ${
                              cookie.isWorking ? 'text-green-600' : 'text-muted-foreground'
                            }`}
                          >
                            {cookie.isWorking ? 'Working' : 'Not working'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {renderChannelToggle(
                          cookie,
                          'single',
                          'bg-green-500/10 text-green-600 border-green-500/30'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {renderChannelToggle(
                          cookie,
                          'double',
                          'bg-green-500/10 text-green-600 border-green-500/30'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {renderChannelToggle(
                          cookie,
                          'multi',
                          'bg-green-500/10 text-green-600 border-green-500/30'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {renderChannelToggle(
                          cookie,
                          'swiftSolutions',
                          'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {renderChannelToggle(
                          cookie,
                          'test',
                          'bg-violet-500/10 text-violet-600 border-violet-500/30'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {renderChannelToggle(
                          cookie,
                          'horizon',
                          'bg-sky-500/10 text-sky-600 border-sky-500/30'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                                <MoreVertical size={18} className="text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72 bg-card border-border">
                              {!cookie.isActiveSingle ? (
                                <DropdownMenuItem
                                  onClick={() => handleActivateCookie(cookie, 'single')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Enable for Single plan
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivateCookie(cookie, 'single')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <Circle size={16} className="mr-2" />
                                  Disable for Single plan
                                </DropdownMenuItem>
                              )}
                              {!cookie.isActiveDouble ? (
                                <DropdownMenuItem
                                  onClick={() => handleActivateCookie(cookie, 'double')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Enable for Double plan
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivateCookie(cookie, 'double')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <Circle size={16} className="mr-2" />
                                  Disable for Double plan
                                </DropdownMenuItem>
                              )}
                              {!cookie.isActiveMulti ? (
                                <DropdownMenuItem
                                  onClick={() => handleActivateCookie(cookie, 'multi')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Enable for Multi plan
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivateCookie(cookie, 'multi')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <Circle size={16} className="mr-2" />
                                  Disable for Multi plan
                                </DropdownMenuItem>
                              )}
                              {!cookie.isActiveSwiftSolutions ? (
                                <DropdownMenuItem
                                  onClick={() => handleActivateCookie(cookie, 'swiftSolutions')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Enable for Swift Solutions
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivateCookie(cookie, 'swiftSolutions')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <Circle size={16} className="mr-2" />
                                  Disable for Swift Solutions
                                </DropdownMenuItem>
                              )}
                              {!cookie.isActiveTest ? (
                                <DropdownMenuItem
                                  onClick={() => handleActivateCookie(cookie, 'test')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Enable for Test users
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivateCookie(cookie, 'test')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <Circle size={16} className="mr-2" />
                                  Disable for Test users
                                </DropdownMenuItem>
                              )}
                              {!cookie.isActiveHorizon ? (
                                <DropdownMenuItem
                                  onClick={() => handleActivateCookie(cookie, 'horizon')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Enable for Horizon users
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivateCookie(cookie, 'horizon')}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <Circle size={16} className="mr-2" />
                                  Disable for Horizon users
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  handleQuickWorkingChange(cookie, !Boolean(cookie.isWorking))
                                }
                                className="cursor-pointer text-foreground hover:bg-muted"
                              >
                                <CheckCircle2 size={16} className="mr-2" />
                                {cookie.isWorking ? 'Mark as Not working' : 'Mark as Working'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePushForCookie(cookie)}
                                disabled={pushing}
                                className="cursor-pointer text-foreground hover:bg-muted"
                              >
                                <Send size={16} className="mr-2" />
                                Push session refresh to its users
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditCookie(cookie)}
                                className="cursor-pointer text-foreground hover:bg-muted"
                              >
                                Edit Cookie
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteCookie(cookie)}
                                className="cursor-pointer text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 size={16} className="mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {cookies.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-muted-foreground">No cookie files found matching your search</p>
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
          totalItems={totalCookies}
          itemsPerPage={itemsPerPage}
        />

        {/* Dialogs */}
        <AddCookieDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSuccess={handleCookieAdded}
          onRefresh={handleCookieSuccess}
        />

        <GetHalvexCookieDialog
          open={halvexDialogOpen}
          onClose={() => setHalvexDialogOpen(false)}
        />

        <Dialog open={pushDialogOpen} onOpenChange={(open) => !pushing && setPushDialogOpen(open)}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Push session refresh</DialogTitle>
              <DialogDescription>
                Matching desktops replace their local DAT profile with the current cookie the next time they open DAT.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-foreground mb-1">Who</label>
                <Select value={pushScope} onValueChange={(value: PushScope) => setPushScope(value)}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plan">Users on a plan</SelectItem>
                    <SelectItem value="label">Users with a label</SelectItem>
                    <SelectItem value="user">A single user</SelectItem>
                    <SelectItem value="all">All users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pushScope === 'plan' && (
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-foreground mb-1">Plan</label>
                  <Select value={pushPlan} onValueChange={(value: PushPlan) => setPushPlan(value)}>
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="multi">Multi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {pushScope === 'label' && (
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-foreground mb-1">User label</label>
                  <Input
                    value={pushLabel}
                    onChange={(e) => setPushLabel(e.target.value)}
                    placeholder="e.g. test, horizon, swiftSolutions, none"
                    list="push-user-labels"
                  />
                  <datalist id="push-user-labels">
                    <option value="none" />
                    {userLabels.map((label) => (
                      <option key={label} value={label} />
                    ))}
                  </datalist>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use <code>none</code> for users without a label.
                  </p>
                </div>
              )}

              {pushScope === 'user' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground">User</label>
                  <div className="flex gap-2">
                    <Input
                      value={pushUserQuery}
                      onChange={(e) => setPushUserQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          searchPushUsers();
                        }
                      }}
                      placeholder="Search name or email"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={searchPushUsers}
                      disabled={pushUserSearching || !pushUserQuery.trim()}
                    >
                      {pushUserSearching ? 'Searching…' : 'Search'}
                    </Button>
                  </div>
                  {pushUserHits.length > 0 && (
                    <Select value={pushUserId} onValueChange={setPushUserId}>
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {pushUserHits.map((u) => (
                          <SelectItem key={u._id} value={u._id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {pushScope === 'all' && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  This refreshes the DAT session for every user account. You will be asked to confirm.
                </div>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setPushDialogOpen(false)} disabled={pushing}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={pushScope === 'all' ? 'destructive' : 'default'}
                onClick={handlePushFromDialog}
                disabled={pushing}
              >
                <Send size={16} className="mr-2" />
                {pushing ? 'Queuing…' : 'Push refresh'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <EditCookieDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={handleCookieUpdated}
          onRefresh={handleCookieSuccess}
          cookie={selectedCookie}
        />

      </div>
    </Suspense>
  );
}

