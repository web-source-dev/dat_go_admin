'use client';

import { useSearchParams } from "next/navigation"
import Loading from './loading';
import { useEffect } from 'react';

import { useState } from 'react';
import { Search, Plus, MoreVertical, AlertCircle, Trash2, CheckCircle2, Circle } from 'lucide-react';
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
import { messagesApi } from '@/lib/api';
import { DataPagination } from '@/components/admin/data-pagination';
import { useDebounce } from '@/hooks/use-debounce';
import { AddMessageDialog } from '@/components/admin/add-message-dialog';
import { EditMessageDialog } from '@/components/admin/edit-message-dialog';
import { Message } from '@/lib/types';

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'desktop' | 'mobile' | 'extension'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');
  const searchParams = useSearchParams();
  const itemsPerPage = 10;
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    fetchMessages();
  }, [currentPage, debouncedSearchTerm, platformFilter, activeFilter]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await messagesApi.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        platform: platformFilter !== 'all' ? platformFilter : undefined,
        isActive: activeFilter !== 'all' ? activeFilter : undefined
      });
      setMessages(data.messages || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalMessages(data.pagination?.totalItems || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setPlatformFilter('all');
    setActiveFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = platformFilter !== 'all' || activeFilter !== 'all';

  const handleAddMessage = () => {
    setAddDialogOpen(true);
  };

  const handleEditMessage = (message: Message) => {
    setSelectedMessage(message);
    setEditDialogOpen(true);
  };

  const handleMessageSuccess = () => {
    fetchMessages();
  };

  const handleActivateMessage = async (message: Message) => {
    try {
      await messagesApi.activate(message._id);
      await fetchMessages();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to activate message');
    }
  };

  const handleDeactivateMessage = async (message: Message) => {
    try {
      await messagesApi.deactivate(message._id);
      await fetchMessages();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to deactivate message');
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!confirm(`Are you sure you want to delete "${message.title}"?`)) {
      return;
    }

    try {
      await messagesApi.delete(message._id);
      setMessages(prev => prev.filter(m => m._id !== message._id));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete message');
    }
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

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'desktop':
        return 'bg-blue-500/10 text-blue-600';
      case 'mobile':
        return 'bg-green-500/10 text-green-600';
      case 'extension':
        return 'bg-purple-500/10 text-purple-600';
      case 'all':
        return 'bg-gray-500/10 text-gray-600';
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading messages...</p>
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
              <h1 className="text-3xl font-bold text-foreground">Message Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage announcements and messages for all platforms. Multiple messages can be active simultaneously.
              </p>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleAddMessage}
            >
              <Plus size={18} className="mr-2" />
              Add Message
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
          <div className="grid grid-cols-4 gap-4 items-end">
            {/* Search */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
                <Input
                  type="text"
                  placeholder="Title, message..."
                  className="pl-10 bg-card border-border text-foreground"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Platform Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Platform</label>
              <Select value={platformFilter} onValueChange={(value: 'all' | 'desktop' | 'mobile' | 'extension') => setPlatformFilter(value)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="extension">Extension</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Filter */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-foreground mb-1">Status</label>
              <Select value={activeFilter} onValueChange={(value: 'all' | 'true' | 'false') => setActiveFilter(value)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Button */}
            <div className="flex flex-col">
              <div className="h-5"></div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="justify-start">
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages Table */}
        <div className="flex-1">
          <div className="px-8 py-6">
            <div className="bg-card rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Platform
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Session
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-muted-foreground">
                      Status
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
                  {messages.map((message) => (
                    <tr
                      key={message._id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-foreground font-medium">
                        {message.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground max-w-md truncate">
                        {message.message}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${getPlatformColor(message.platform)}`}>
                          {message.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {typeof message.sessionId === 'object' && message.sessionId ? message.sessionId.name : message.sessionId || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {message.isActive ? (
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
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(message.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                                <MoreVertical size={18} className="text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                              {!message.isActive && (
                                <DropdownMenuItem
                                  onClick={() => handleActivateMessage(message)}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                              {message.isActive && (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivateMessage(message)}
                                  className="cursor-pointer text-foreground hover:bg-muted"
                                >
                                  <Circle size={16} className="mr-2" />
                                  Deactivate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleEditMessage(message)}
                                className="cursor-pointer text-foreground hover:bg-muted"
                              >
                                Edit Message
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteMessage(message)}
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

              {messages.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-muted-foreground">No messages found matching your search</p>
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
          totalItems={totalMessages}
          itemsPerPage={itemsPerPage}
        />

        {/* Dialogs */}
        <AddMessageDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSuccess={handleMessageSuccess}
        />

        <EditMessageDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={handleMessageSuccess}
          message={selectedMessage}
        />

      </div>
    </Suspense>
  );
}

