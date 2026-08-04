'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { horizonFoxyProxyApi } from '@/lib/api';

type FoxyProxyType = 'http' | 'https' | 'socks4' | 'socks5';

type FoxyProxyConfig = {
  enabled: boolean;
  title: string;
  type: FoxyProxyType;
  host: string;
  port: number;
  username: string;
  password: string;
  updatedAt?: string;
};

export default function HorizonFoxyProxyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('Admin Proxy');
  const [type, setType] = useState<FoxyProxyType>('http');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const applyConfig = (data: FoxyProxyConfig) => {
    setEnabled(Boolean(data.enabled));
    setTitle(data.title || 'Admin Proxy');
    setType((data.type as FoxyProxyType) || 'http');
    setHost(data.host || '');
    setPort(data.port ? String(data.port) : '');
    setUsername(data.username || '');
    setPassword(data.password || '');
    setUpdatedAt(data.updatedAt || null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await horizonFoxyProxyApi.getConfig();
      applyConfig(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load Foxy Proxy config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (enabled && (!host.trim() || !port.trim())) {
      toast.error('Host and port are required when enabled');
      return;
    }
    setSaving(true);
    try {
      const data = await horizonFoxyProxyApi.updateConfig({
        enabled,
        title: title.trim() || 'Admin Proxy',
        type,
        host: host.trim(),
        port: port.trim() ? Number(port) : 0,
        username,
        password,
      });
      applyConfig(data);
      toast.success(data.message || 'Foxy Proxy config saved');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Horizon Foxy Proxy
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Push one proxy into Horizon&apos;s Foxy Proxy extension. Users will see it in the
            Foxy UI and it will be selected automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading || saving}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Push to Horizon clients</p>
              <p className="text-sm text-muted-foreground">
                When on, this proxy is injected into Foxy Proxy and auto-selected.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-medium">Display name</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Admin Proxy"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as FoxyProxyType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                  <SelectItem value="socks5">SOCKS5</SelectItem>
                  <SelectItem value="socks4">SOCKS4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Port</label>
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="8080"
                inputMode="numeric"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-medium">Host</label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="proxy.example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="optional"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="optional"
                autoComplete="new-password"
              />
            </div>
          </div>

          {updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(updatedAt).toLocaleString()}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
