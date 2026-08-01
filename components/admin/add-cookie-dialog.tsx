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
import { cookiesApi, sessionsApi, SCHEDULER_BACKENDS } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Cookie, DATSession } from '@/lib/types';
import { AssignableCookieLabel, COOKIE_LABEL_OPTIONS } from '@/lib/cookieLabels';

interface AddCookieDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (cookie: Cookie) => void;
  onRefresh: () => void;
}

export function AddCookieDialog({ open, onClose, onSuccess, onRefresh }: AddCookieDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<DATSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [cookiePreview, setCookiePreview] = useState<{ count: number } | null>(null);
  const [parsedContent, setParsedContent] = useState<any>(null);
  const [formData, setFormData] = useState({
    fileName: '',
    label: 'new' as AssignableCookieLabel,
    sessionId: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSessions();
    }
  }, [open]);

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

  const resetForm = () => {
    setFormData({
      fileName: '',
      label: 'new',
      sessionId: '',
    });
    setSelectedFileName('');
    setCookiePreview(null);
    setParsedContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

      // Quick client-side count for preview (backend does full conversion)
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

      // Auto-fill save name from upload if empty and no session selected
      if (!formData.fileName && !formData.sessionId) {
        const base = file.name.replace(/\.json$/i, '');
        setFormData((prev) => ({ ...prev, fileName: `${base}.json` }));
      }
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

  const handleSessionChange = (value: string) => {
    const sessionId = value === 'none' ? '' : value;
    const session = sessions.find((s) => s._id === sessionId);
    setFormData((prev) => ({
      ...prev,
      sessionId,
      label: (session?.label as AssignableCookieLabel) || prev.label,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parsedContent) {
      toast({
        title: 'Error',
        description: 'Please select a cookie JSON file',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fileName: formData.fileName || undefined,
        label: formData.label,
        sessionId: formData.sessionId || undefined,
        fileContent: parsedContent,
      };

      // Every backend (main/primary/backup/fallback) runs its own separate DB, so a
      // manual upload has to be pushed to each one individually or it's stale
      // on the others. Mirrors the fan-out pattern used on the Scheduler page.
      const results = await Promise.allSettled(
        SCHEDULER_BACKENDS.map((b) => cookiesApi.create(payload, b.url))
      );
      const okResults = results.filter(
        (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled'
      );
      const failedBackends = results
        .map((r, i) => ({ result: r, backend: SCHEDULER_BACKENDS[i] }))
        .filter((x) => x.result.status === 'rejected');

      if (okResults.length === 0) {
        const firstError: any = (results[0] as PromiseRejectedResult).reason;
        throw new Error(
          firstError?.response?.data?.message ||
            firstError?.message ||
            'Failed to create cookie file on any backend'
        );
      }

      const response = okResults[0].value;
      const convertedNote = response.converted
        ? ` (converted from ${response.formatDetected || 'export'} format)`
        : '';

      if (failedBackends.length > 0) {
        toast({
          title: 'Partially synced',
          description: `Added to ${okResults.length}/${SCHEDULER_BACKENDS.length} backends${convertedNote}. Failed: ${failedBackends
            .map((f) => f.backend.label)
            .join(', ')}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: `Cookie file created on all ${SCHEDULER_BACKENDS.length} backends${convertedNote}`,
        });
      }
      onSuccess(response);
      onRefresh();
      onClose();
      resetForm();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to create cookie file',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>Add New Cookie File</DialogTitle>
            <DialogDescription>
              Select a cookie JSON file (DAT Go, dat.com export, or cookie array). It will be
              converted to the backend format automatically.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden px-6">
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label htmlFor="cookieFile">Cookie JSON File *</Label>
              <Input
                id="cookieFile"
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                required
              />
              {selectedFileName && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedFileName}
                  {cookiePreview != null && ` · ~${cookiePreview.count} cookie(s) detected`}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Supports dat.com_cookies_*.json exports, DAT Go files, and plain cookie arrays.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionId">Session (Optional)</Label>
              <Select
                value={formData.sessionId || 'none'}
                onValueChange={handleSessionChange}
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
              <p className="text-xs text-muted-foreground">
                If selected, the file is named from the session and linked to it.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileName">Save As File Name (optional)</Label>
              <Input
                id="fileName"
                type="text"
                placeholder="Leave blank to auto-name as manual-..."
                value={formData.fileName}
                onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Manual uploads are always saved as <code>manual-*.json</code> so sync never
                overwrites them. Selecting a session only links the cookie — it does not use
                the session ZIP filename.
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
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4 pb-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !parsedContent}>
              {loading ? 'Uploading...' : 'Upload & Convert'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
