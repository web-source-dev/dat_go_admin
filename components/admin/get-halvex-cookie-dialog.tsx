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
import { cookiesApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface GetHalvexCookieDialogProps {
  open: boolean;
  onClose: () => void;
}

function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function GetHalvexCookieDialog({ open, onClose }: GetHalvexCookieDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setEmail('');
    setPassword('');
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({
        title: 'Missing credentials',
        description: 'Enter the Halvex user email and password.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await cookiesApi.dumpFromHalvex({
        email: email.trim(),
        password,
      });
      downloadJson(result.fileName, result.container);
      toast({
        title: 'Cookie file downloaded',
        description: `${result.fileName} · ${result.cookieCount} cookie(s) for ${result.user?.email || result.user?.username || 'user'}`,
      });
      resetForm();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Download failed',
        description:
          error.response?.data?.message || error.message || 'Failed to get Halvex cookie file',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Get Halvex cookie file</DialogTitle>
          <DialogDescription>
            Enter the Halvex user email and password. The admin panel will load that user&apos;s
            DAT session and download an <code>fd-container-*.json</code> cookie file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="halvexEmail">User email</Label>
            <Input
              id="halvexEmail"
              type="email"
              autoComplete="off"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="halvexPassword">User password</Label>
            <Input
              id="halvexPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Halvex password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Fetching…' : 'Download cookie file'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
