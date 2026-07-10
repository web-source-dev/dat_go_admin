'use client';

import { useState, useEffect, useRef } from 'react';
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
import { AssignableCookieLabel, COOKIE_LABEL_OPTIONS, CookieLabel } from '@/lib/cookieLabels';

interface EditCookieDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (cookie: Cookie) => void;
  onRefresh: () => void;
  cookie: Cookie | null;
}

export function EditCookieDialog({ open, onClose, onSuccess, onRefresh, cookie }: EditCookieDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<DATSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [cookiePreview, setCookiePreview] = useState<{ count: number } | null>(null);
  const [parsedContent, setParsedContent] = useState<any>(null);
  const [formData, setFormData] = useState({
    label: 'new' as CookieLabel,
    sessionId: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      });
      setSelectedFileName('');
      setCookiePreview(null);
      setParsedContent(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFileName('');
      setCookiePreview(null);
      setParsedContent(null);
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      let count = 0;
      if (parsed?.['dat.com']?.cookies && Array.isArray(parsed['dat.com'].cookies)) {
        count = parsed['dat.com'].cookies.length;
      } else if (Array.isArray(parsed)) {
        count = parsed.length;
      } else if (Array.isArray(parsed?.cookies)) {
        count = parsed.cookies.length;
      }

      setParsedContent(parsed);
      setSelectedFileName(file.name);
      setCookiePreview({ count });
    } catch (error) {
      setParsedContent(null);
      setCookiePreview(null);
      setSelectedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({
        title: 'Error',
        description: 'Selected file is not valid JSON',
        variant: 'destructive',
      });
    }
  };

  const clearSelectedFile = () => {
    setParsedContent(null);
    setCookiePreview(null);
    setSelectedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cookie) return;

    setLoading(true);
    try {
      const updateData: any = {
        label: formData.label,
      };

      if (formData.sessionId !== cookie.sessionId) {
        updateData.sessionId = formData.sessionId || null;
      }

      if (parsedContent) {
        updateData.fileContent = parsedContent;
      }

      const response = await cookiesApi.update(cookie._id, updateData);

      toast({
        title: 'Success',
        description: parsedContent
          ? 'Cookie file updated and converted successfully'
          : 'Cookie file updated successfully',
      });
      onSuccess(response);
      onRefresh();
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
              Update label, session, or replace cookies by selecting a JSON file (auto-converted).
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
                File name cannot be changed · Current cookies: {cookie.cookieCount ?? 0}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Select
                value={formData.label}
                onValueChange={(value: AssignableCookieLabel) =>
                  setFormData({ ...formData, label: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COOKIE_LABEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  {formData.label === 'multi' && (
                    <SelectItem value="multi">Multi (legacy)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionId">Session</Label>
              <Select
                value={formData.sessionId || 'none'}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, sessionId: value === 'none' ? '' : value })
                }
                disabled={sessionsLoading}
              >
                <SelectTrigger className="bg-card border-border">
                  <SelectValue placeholder={sessionsLoading ? 'Loading sessions...' : 'Select session'} />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="replaceCookieFile">Replace Cookie JSON (Optional)</Label>
              <Input
                id="replaceCookieFile"
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
              />
              {selectedFileName ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedFileName}
                    {cookiePreview != null && ` · ~${cookiePreview.count} cookie(s)`}
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelectedFile}>
                    Clear
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Leave empty to keep current cookies. Upload a dat.com export or any supported
                  JSON to replace and auto-convert.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4 pb-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Cookie File'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
