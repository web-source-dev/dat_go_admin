'use client';

import { useSearchParams } from "next/navigation"
import Loading from './loading';
import { useEffect } from 'react';

import { useState } from 'react';
import { Search, Plus, MoreVertical, AlertCircle, CheckCircle, X } from 'lucide-react';
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
import { sessionsApi } from '@/lib/api';
import { DataPagination } from '@/components/admin/data-pagination';
import { useDebounce } from '@/hooks/use-debounce';
import { AddSessionDialog } from '@/components/admin/add-session-dialog';
import { EditSessionDialog } from '@/components/admin/edit-session-dialog';

interface Session {
  _id: string;
  name: string;
  proxy: string;
  isLoggedIn: boolean;
  userCounts: number;
  fileName: string;
  createdAt: string;
  label?: 'new' | 'single' | 'double' | 'multi';
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'disconnected'>('all');
  const [userCountFilter, setUserCountFilter] = useState<'all' | 'has-users' | 'no-users'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const searchParams = useSearchParams();
  const itemsPerPage = 10;
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    fetchSessions();
  }, [currentPage, debouncedSearchTerm, statusFilter, userCountFilter, dateFrom, dateTo]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sessionsApi.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        userCount: userCountFilter !== 'all' ? userCountFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      setSessions(data.sessions || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalSessions(data.pagination?.totalSessions || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  // Note: Filtering is now done server-side with pagination

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setUserCountFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || userCountFilter !== 'all' || dateFrom || dateTo;

  const handleAddSession = () => {
    setAddDialogOpen(true);
  };

  const handleEditSession = (session: Session) => {
    setSelectedSession(session);
    setEditDialogOpen(true);
  };


  const handleSessionSuccess = () => {
    fetchSessions(); // Refresh the data
  };

  const handleSessionAdded = (newSession: Session) => {
    setSessions(prev => [newSession, ...prev]);
  };

  const handleSessionUpdated = (updatedSession: Session) => {
    setSessions(prev => prev.map(session => session._id === updatedSession._id ? updatedSession : session));
  };


  const handleSessionStatusChanged = (sessionId: string, isLoggedIn: boolean) => {
    setSessions(prev => prev.map(session =>
      session._id === sessionId ? { ...session, isLoggedIn } : session
    ));
  };


  const toggleConnection = async (id: string, currentStatus: boolean) => {
    try {
      await sessionsApi.updateLoginStatus(id, !currentStatus);
      handleSessionStatusChanged(id, !currentStatus);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update session status');
    }
  };

  const getStatusColor = (isLoggedIn: boolean) => {
    return isLoggedIn
      ? 'bg-green-500 text-white'
      : 'bg-gray-500 text-white';
  };

  const getConnectionColor = (isLoggedIn: boolean) => {
    return isLoggedIn ? 'text-green-400' : 'text-gray-400';
  };

  const maskProxy = () => {
    // Proxy format: host:port:username:password
    return `***********************`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading sessions...</p>
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
              <h1 className="text-3xl font-bold text-foreground">Session Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor and manage DAT sessions and proxy connections
              </p>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleAddSession}
            >
              <Plus size={18} className="mr-2" />
              Add Session
            </Button>
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
                  placeholder="Name or proxy..."
                  className="pl-10 bg-card border-border text-foreground"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Status</label>
              <Select value={statusFilter} onValueChange={(value: 'all' | 'connected' | 'disconnected') => setStatusFilter(value)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="disconnected">Disconnected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Users Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Users</label>
              <Select value={userCountFilter} onValueChange={(value: 'all' | 'has-users' | 'no-users') => setUserCountFilter(value)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  <SelectItem value="has-users">Has Users</SelectItem>
                  <SelectItem value="no-users">No Users</SelectItem>
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
        </div>

        {/* Sessions Table */}
        <div className="flex-1">
          <div className="px-8 py-6">
            <div className="bg-card rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Session Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Proxy
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Label
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      File
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
                  {sessions.map((session) => (
                    <tr
                      key={session._id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-foreground font-medium">
                        {session.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono text-xs">
                        {maskProxy()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {session.isLoggedIn ? (
                            <CheckCircle size={16} className={getConnectionColor(true)} />
                          ) : (
                            <AlertCircle size={16} className={getConnectionColor(false)} />
                          )}
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              session.isLoggedIn
                            )}`}
                          >
                            {session.isLoggedIn ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${
                          (session as any).label === 'new' 
                            ? 'bg-yellow-500/10 text-yellow-600' 
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {(session as any).label || 'single'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          {session.userCounts} active
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono text-xs">
                        {session.fileName}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {session.createdAt}
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
                              onClick={() => handleEditSession(session)}
                              className="cursor-pointer text-foreground hover:bg-muted"
                            >
                              Edit Session
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleConnection(session._id, session.isLoggedIn)}
                              className="cursor-pointer text-foreground hover:bg-muted"
                            >
                              {session.isLoggedIn ? 'Disconnect' : 'Connect'}
                            </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {sessions.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-muted-foreground">No sessions found matching your search</p>
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
          totalItems={totalSessions}
          itemsPerPage={itemsPerPage}
        />

        {/* Dialogs */}
        <AddSessionDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSuccess={handleSessionAdded}
          onRefresh={handleSessionSuccess}
        />

        <EditSessionDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={handleSessionUpdated}
          onRefresh={handleSessionSuccess}
          session={selectedSession}
        />

      </div>
    </Suspense>
  );
}
