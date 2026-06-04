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
import { messagesApi, sessionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Message, DATSession } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface EditMessageDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  message: Message | null;
}

export function EditMessageDialog({ open, onClose, onSuccess, message }: EditMessageDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<DATSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    platform: 'all' as 'all' | 'desktop' | 'mobile' | 'extension',
    sessionId: '',
    isActive: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && message) {
      fetchSessions();
      setFormData({
        title: message.title,
        message: message.message,
        platform: message.platform,
        sessionId: message.sessionId && typeof message.sessionId === 'object' ? message.sessionId._id : (message.sessionId || 'none'),
        isActive: message.isActive,
      });
    }
  }, [open, message]);

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      const response = await sessionsApi.getAll({ limit: 1000 });
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message || !formData.title || !formData.message) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await messagesApi.update(message._id, {
        title: formData.title,
        message: formData.message,
        platform: formData.platform,
        sessionId: formData.sessionId && formData.sessionId !== 'none' ? formData.sessionId : null,
        isActive: formData.isActive,
      });

      toast({
        title: 'Success',
        description: 'Message updated successfully',
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to update message',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!message) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Message</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update message details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter message title"
                className="bg-background border-border text-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-foreground">Message *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Enter message content"
                className="bg-background border-border text-foreground min-h-[100px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform" className="text-foreground">Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(value: 'all' | 'desktop' | 'mobile' | 'extension') =>
                  setFormData({ ...formData, platform: value })
                }
              >
                <SelectTrigger className="bg-background border-border">
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

            <div className="space-y-2">
              <Label htmlFor="sessionId" className="text-foreground">Session (Optional)</Label>
              <Select
                value={formData.sessionId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, sessionId: value })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select a session (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sessionsLoading ? (
                    <SelectItem value="loading" disabled>Loading sessions...</SelectItem>
                  ) : (
                    sessions.map((session) => (
                      <SelectItem key={session._id} value={session._id}>
                        {session.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="isActive" className="text-foreground">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? 'Updating...' : 'Update Message'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

