'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cookiesApi, sessionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Cookie, DATSession } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';

interface EditCookieDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (cookie: Cookie) => void;
  onRefresh: () => void;
  cookie: Cookie | null;
}

export function EditCookieDialog({ open, onClose, onSuccess, onRefresh, cookie }: EditCookieDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [sessions, setSessions] = useState<DATSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [formData, setFormData] = useState({
    label: 'new' as 'new' | 'single' | 'double' | 'multi',
    sessionId: '',
    fileContent: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSessions();
    }
  }, [open]);

  useEffect(() => {
    if (cookie && open) {
      setFormData({
        label: cookie.label || 'new',
        sessionId: cookie.sessionId || '',
        fileContent: '',
      });
      // Load cookie content
      loadCookieContent();
    }
  }, [cookie, open]);

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      const response = await sessionsApi.getAll({ limit: 1000 });
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive',
      });
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadCookieContent = async () => {
    if (!cookie) return;

    setLoadingContent(true);
    try {
      const response = await cookiesApi.getById(cookie._id);
      setFormData(prev => ({
        ...prev,
        fileContent: JSON.stringify(response.content || {}, null, 2),
      }));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load cookie content',
        variant: 'destructive',
      });
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cookie) return;

    // Validate JSON if fileContent is provided
    if (formData.fileContent) {
      try {
        JSON.parse(formData.fileContent);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Invalid JSON content',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
      const updateData: any = {
        label: formData.label,
      };

      // Include sessionId if changed (allow clearing by setting to empty string)
      if (formData.sessionId !== cookie.sessionId) {
        updateData.sessionId = formData.sessionId || null;
      }

      if (formData.fileContent) {
        updateData.fileContent = JSON.parse(formData.fileContent);
      }

      const response = await cookiesApi.update(cookie._id, updateData);

      toast({
        title: 'Success',
        description: 'Cookie file updated successfully',
      });
      onSuccess(response);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update cookie file',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!cookie) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>Edit Cookie File</DialogTitle>
            <DialogDescription>
              Update cookie file label and content.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden px-6">
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="space-y-2">
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              type="text"
              value={cookie.fileName}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              File name cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label *</Label>
            <Select
              value={formData.label}
              onValueChange={(value: 'new' | 'single' | 'double' | 'multi') => setFormData({ ...formData, label: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="double">Double</SelectItem>
                <SelectItem value="multi">Multi</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cookie file label (new/single/double/multi)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionId">Session</Label>
            <Select
              value={formData.sessionId || 'none'}
              onValueChange={(value: string) => setFormData({ ...formData, sessionId: value === 'none' ? '' : value })}
              disabled={sessionsLoading}
            >
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder={sessionsLoading ? "Loading sessions..." : "Select session"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No session (unassigned)</SelectItem>
                {sessions.map((session) => (
                  <SelectItem key={session._id} value={session._id}>
                    {session.name} ({session.label || 'single'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assign this cookie file to a specific session
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fileContent">Cookie JSON Content</Label>
            {loadingContent ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Textarea
                id="fileContent"
                placeholder='{"dat.com": {"cookies": [], "localStorage": {}, "sessionStorage": {}}}'
                value={formData.fileContent}
                onChange={(e) => setFormData({ ...formData, fileContent: e.target.value })}
                className="font-mono text-xs resize-none overflow-x-auto break-words"
                rows={8}
                style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Update the JSON content for the cookie file (leave empty to keep current content)
            </p>
          </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4 pb-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || loadingContent}>
              {loading ? 'Updating...' : 'Update Cookie File'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

