'use client';

import { useState } from 'react';
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
import { sessionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { AssignableCookieLabel, COOKIE_LABEL_OPTIONS } from '@/lib/cookieLabels';

interface Session {
  _id: string;
  name: string;
  proxy: string;
  isLoggedIn: boolean;
  userCounts: number;
  fileName: string;
  createdAt: string;
}

interface AddSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (session: Session) => void;
  onRefresh: () => void;
}

export function AddSessionDialog({ open, onClose, onSuccess, onRefresh }: AddSessionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    proxy: '',
    label: 'single' as AssignableCookieLabel,
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.proxy) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await sessionsApi.create(formData);

      // Create session object for UI update
      const newSession: Session = {
        _id: response._id,
        name: response.name,
        proxy: response.proxy,
        isLoggedIn: response.isLoggedIn || false,
        userCounts: response.userCounts || 0,
        fileName: response.fileName || '',
        createdAt: response.createdAt
      };

      toast({
        title: 'Success',
        description: 'Session created successfully',
      });
      onSuccess(newSession);
      onClose();
      // Reset form
      setFormData({
        name: '',
        proxy: '',
        label: 'single',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create session',
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
        name: '',
        proxy: '',
        label: 'single',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Session</DialogTitle>
          <DialogDescription>
            Create a new DAT session with the specified details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Session Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter session name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxy">Proxy *</Label>
            <Input
              id="proxy"
              type="text"
              placeholder="host:port:username:password"
              value={formData.proxy}
              onChange={(e) => setFormData({ ...formData, proxy: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Format: host:port:username:password
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
              Session type label
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
