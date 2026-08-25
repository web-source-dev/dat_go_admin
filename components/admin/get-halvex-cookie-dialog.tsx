'use client';

import { useEffect, useState } from 'react';
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

const DEFAULT_IDENTIFIER = 'branrizwan';
const DEFAULT_PASSWORD = 'ashdat@123';
const CREDS_STORAGE_KEY = 'dathub-halvex-dump-creds';

function readStoredCreds() {
  try {
    const raw = localStorage.getItem(CREDS_STORAGE_KEY);
    if (!raw) return { identifier: DEFAULT_IDENTIFIER, password: DEFAULT_PASSWORD };
    const parsed = JSON.parse(raw);
    return {
      identifier: String(parsed?.identifier || DEFAULT_IDENTIFIER),
      password: String(parsed?.password || DEFAULT_PASSWORD),
    };
  } catch {
    return { identifier: DEFAULT_IDENTIFIER, password: DEFAULT_PASSWORD };
  }
}

function saveStoredCreds(identifier: string, password: string) {
  try {
    localStorage.setItem(
      CREDS_STORAGE_KEY,
      JSON.stringify({ identifier, password })
    );
  } catch {
    // ignore quota / private mode
  }
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
  const [identifier, setIdentifier] = useState(DEFAULT_IDENTIFIER);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const stored = readStoredCreds();
    setIdentifier(stored.identifier);
    setPassword(stored.password);
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast({
        title: 'Missing credentials',
        description: 'Enter the Halvex username or email, and password.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const nextIdentifier = identifier.trim();
      const result = await cookiesApi.dumpFromHalvex({
        identifier: nextIdentifier,
        password,
      });
      saveStoredCreds(nextIdentifier, password);
      downloadJson(result.fileName, result.container);
      toast({
        title: 'Cookie file downloaded',
        description: `${result.fileName} · ${result.cookieCount} cookie(s) for ${result.user?.email || result.user?.username || 'user'}`,
      });
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
            Username and password are prefilled and can be changed. The admin panel will load that
            user&apos;s DAT session and download an <code>fd-container-*.json</code> cookie file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="halvexIdentifier">Username or email</Label>
            <Input
              id="halvexIdentifier"
              type="text"
              autoComplete="off"
              placeholder="username or user@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
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
