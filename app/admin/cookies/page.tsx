'use client';

import { useSearchParams } from "next/navigation"
import Loading from './loading';
import { useEffect } from 'react';

import { useState } from 'react';
import { Search, Plus, MoreVertical, AlertCircle, Trash2, RefreshCw, X, FileText, Download, CheckCircle2, Circle } from 'lucide-react';
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
import { Suspense } from 'react';
import { cookiesApi } from '@/lib/api';
import { DataPagination } from '@/components/admin/data-pagination';
import { useDebounce } from '@/hooks/use-debounce';
import { AddCookieDialog } from '@/components/admin/add-cookie-dialog';
import { EditCookieDialog } from '@/components/admin/edit-cookie-dialog';
import { Cookie } from '@/lib/types';

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
  const [selectedCookie, setSelectedCookie] = useState<Cookie | null>(null);
  const [labelFilter, setLabelFilter] = useState<'all' | 'new' | 'single' | 'double' | 'multi'>('all');
  const [syncing, setSyncing] = useState(false);
  const searchParams = useSearchParams();
  const itemsPerPage = 10;
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

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

  type CookieChannel = 'single' | 'double' | 'multi' | 'swiftSolutions';

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

  const handleSyncCookies = async () => {
    setSyncing(true);
    try {
      const result = await cookiesApi.sync();
      await fetchCookies();
      alert(`Sync completed: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to sync cookies');
    } finally {
      setSyncing(false);
    }
  };

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

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'new':
        return 'bg-yellow-500/10 text-yellow-600';
      case 'single':
        return 'bg-blue-500/10 text-blue-600';
      case 'double':
        return 'bg-green-500/10 text-green-600';
      case 'multi':
        return 'bg-purple-500/10 text-purple-600';
      default:
        return 'bg-primary/10 text-primary';
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
                Manage cookie files — enable one active file per channel (DAT Go and Swift Solutions)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSyncCookies}
                disabled={syncing}
              >
                <RefreshCw size={18} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Files'}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleAddCookie}
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
              <Select value={labelFilter} onValueChange={(value: 'all' | 'new' | 'single' | 'double' | 'multi') => setLabelFilter(value)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Labels</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="multi">Multi</SelectItem>
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
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-muted-foreground" />
                          {cookie.fileName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {cookie.sessionName || cookie.sessionId || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${getLabelColor(cookie.label)}`}>
                          {cookie.label}
                        </span>
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
                      <td className="px-6 py-4">
                        {cookie.isActiveSingle ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/30">
                            <CheckCircle2 size={14} className="mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/30">
                            <Circle size={14} className="mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {cookie.isActiveDouble ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/30">
                            <CheckCircle2 size={14} className="mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/30">
                            <Circle size={14} className="mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {cookie.isActiveMulti ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/30">
                            <CheckCircle2 size={14} className="mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/30">
                            <Circle size={14} className="mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {cookie.isActiveSwiftSolutions ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                            <CheckCircle2 size={14} className="mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/30">
                            <Circle size={14} className="mr-1" />
                            Inactive
                          </span>
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

