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
import { AssignableCookieLabel, COOKIE_LABEL_OPTIONS } from '@/lib/cookieLabels';
import { Textarea } from '@/components/ui/textarea';

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
  const [formData, setFormData] = useState({
    fileName: '',
    label: 'new' as AssignableCookieLabel,
    sessionId: '',
    fileContent: '',
  });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fileName || !formData.fileContent) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Ensure fileName ends with .json
    const fileName = formData.fileName.endsWith('.json') 
      ? formData.fileName 
      : `${formData.fileName}.json`;

    // Validate JSON
    let parsedContent;
    try {
      parsedContent = JSON.parse(formData.fileContent);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid JSON content',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await cookiesApi.create({
        fileName,
        label: formData.label,
        sessionId: formData.sessionId || undefined,
        fileContent: parsedContent,
      });

      toast({
        title: 'Success',
        description: 'Cookie file created successfully',
      });
      onSuccess(response);
      onClose();
      // Reset form
      setFormData({
        fileName: '',
        label: 'new',
        sessionId: '',
        fileContent: '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create cookie file',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setFormData({
        fileName: '',
        label: 'new',
        sessionId: '',
        fileContent: '',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>Add New Cookie File</DialogTitle>
            <DialogDescription>
              Upload a new cookie JSON file to the cookies directory.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden px-6">
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="space-y-2">
            <Label htmlFor="fileName">File Name *</Label>
            <Input
              id="fileName"
              type="text"
              placeholder="session-id.json"
              value={formData.fileName}
              onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              File name (will automatically add .json extension if not present)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label *</Label>
            <Select
              value={formData.label}
              onValueChange={(value: AssignableCookieLabel) => setFormData({ ...formData, label: value })}
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
            <p className="text-xs text-muted-foreground">
              Cookie file label
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionId">Session (Optional)</Label>
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
              Optionally assign this cookie file to a specific session
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fileContent">Cookie JSON Content *</Label>
            <Textarea
              id="fileContent"
              placeholder='{"dat.com": {"cookies": [], "localStorage": {}, "sessionStorage": {}}}'
              value={formData.fileContent}
              onChange={(e) => setFormData({ ...formData, fileContent: e.target.value })}
              className="font-mono text-xs resize-none overflow-x-auto break-words"
              rows={8}
              required
              style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
            />
            <p className="text-xs text-muted-foreground">
              Paste the JSON content for the cookie file
            </p>
          </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4 pb-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Cookie File'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

