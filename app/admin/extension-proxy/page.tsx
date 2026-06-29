'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Globe,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Server,
  Shield,
  Wrench,
} from 'lucide-react';
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
import { extensionProxyApi, sessionsApi } from '@/lib/api';
import type { ExtensionProxyAdminConfig, ExtensionProxyPoolItem, Session } from '@/lib/types';

function maskProxyPreview(proxy: string) {
  if (!proxy) return '—';
  const parts = proxy.split(':');
  if (parts.length < 2) return '***';
  return `${parts[0]}:${parts[1]}`;
}

type ProxySource = 'env' | 'session' | 'custom' | 'proxyPool';

export default function ExtensionProxyPage() {
  const [config, setConfig] = useState<ExtensionProxyAdminConfig | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [source, setSource] = useState<ProxySource>('env');
  const [sessionId, setSessionId] = useState<string>('');
  const [proxyIpId, setProxyIpId] = useState<string>('');
  const [poolSearch, setPoolSearch] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applyConfig = (data: ExtensionProxyAdminConfig) => {
    setConfig(data);
    setEnabled(data.enabled);
    setSource(data.source);
    setSessionId(data.sessionId || '');
    setProxyIpId(data.proxyIpId || '');
    setCustomHost(data.custom?.host || '');
    setCustomPort(data.custom?.port ? String(data.custom.port) : '');
    setCustomUsername(data.custom?.username || '');
    setCustomPassword(data.custom?.password || '');
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [proxyData, sessionsData] = await Promise.all([
        extensionProxyApi.getConfig(),
        sessionsApi.getAll({ limit: 200 }),
      ]);
      applyConfig(proxyData);
      setSessions(sessionsData.sessions || []);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || err.message || 'Failed to load extension proxy settings'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableProxies = config?.availableProxies || [];

  const filteredProxies = useMemo(() => {
    const q = poolSearch.trim().toLowerCase();
    if (!q) return availableProxies;
    return availableProxies.filter((p) => {
      const haystack = [
        p.container,
        p.host,
        String(p.port),
        p.username,
        p.providerName,
        p.proxyPreview,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [availableProxies, poolSearch]);

  const buildPayload = () => {
    const payload: Parameters<typeof extensionProxyApi.updateConfig>[0] = {
      enabled,
      source,
      sessionId: source === 'session' ? sessionId || null : null,
      proxyIpId: source === 'proxyPool' ? proxyIpId || null : null,
    };

    if (source === 'custom' || customHost || customPort || customUsername || customPassword) {
      payload.customProxy = {
        host: customHost,
        port: customPort,
        username: customUsername,
        password: customPassword,
      };
    }

    return payload;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await extensionProxyApi.updateConfig(buildPayload());
      applyConfig(data);
      toast.success(data.message || 'Extension proxy saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustomOnly = async () => {
    setSaving(true);
    try {
      const data = await extensionProxyApi.updateConfig({
        customProxy: {
          host: customHost,
          port: customPort,
          username: customUsername,
          password: customPassword,
        },
      });
      applyConfig(data);
      toast.success('Custom proxy details saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save custom proxy');
    } finally {
      setSaving(false);
    }
  };

  const handleUseProxyIp = async (proxy: ExtensionProxyPoolItem) => {
    setSaving(true);
    try {
      const data = await extensionProxyApi.useProxyIp(proxy._id);
      applyConfig(data);
      toast.success(`Extensions now use container ${proxy.container} (${proxy.host}:${proxy.port})`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to apply proxy');
    } finally {
      setSaving(false);
    }
  };

  const handleUseEnv = async () => {
    setSaving(true);
    try {
      const data = await extensionProxyApi.updateConfig({
        enabled: true,
        source: 'env',
        sessionId: null,
        proxyIpId: null,
      });
      applyConfig(data);
      toast.success('Extensions now use the server .env proxy');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to switch');
    } finally {
      setSaving(false);
    }
  };

  const customValid = Boolean(customHost.trim() && parseInt(customPort, 10) > 0);
  const saveDisabled =
    saving ||
    (source === 'session' && !sessionId) ||
    (source === 'custom' && !customValid) ||
    (source === 'proxyPool' && !proxyIpId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[320px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const active = config?.active;

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-6 border-b border-border bg-background">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Globe className="h-7 w-7 text-primary" />
              Extension Proxy
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which proxy Chrome and Swift extensions receive from{' '}
              <code className="text-xs bg-muted px-1 rounded">GET /proxy/config</code>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={saving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-6xl">
        {active?.enabled && !active.error && (
          <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Active for extensions</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Source: <span className="capitalize">{active.source === 'proxyPool' ? 'proxy pool' : active.source}</span>
                {' · '}
                {active.host}:{active.port}
                {active.username ? ` · ${active.username}` : ''}
                {config?.proxyIp?.container ? ` · container ${config.proxyIp.container}` : ''}
              </p>
            </div>
          </div>
        )}

        {active?.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {active.error}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable proxy for extensions</p>
              <p className="text-sm text-muted-foreground">
                When off, extensions receive <code className="text-xs">enabled: false</code>
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-3">
            <p className="font-medium text-foreground">Proxy source</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setSource('env')}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  source === 'env'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Server className="h-4 w-4" />
                  Server .env
                </div>
                <p className="text-xs text-muted-foreground mt-2">PROXY_* from backend .env</p>
                {config?.env.configured && (
                  <p className="text-xs font-mono mt-2 text-foreground">
                    {config.env.host}:{config.env.port}
                  </p>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSource('proxyPool')}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  source === 'proxyPool'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Database className="h-4 w-4" />
                  Proxy pool
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {availableProxies.length} imported proxies
                </p>
                {config?.proxyIp && (
                  <p className="text-xs font-mono mt-2 text-foreground">
                    {config.proxyIp.container} · {config.proxyIp.proxyPreview}
                  </p>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSource('session')}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  source === 'session'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Shield className="h-4 w-4" />
                  DAT session
                </div>
                <p className="text-xs text-muted-foreground mt-2">Proxy from a DAT session</p>
              </button>

              <button
                type="button"
                onClick={() => setSource('custom')}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  source === 'custom'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Wrench className="h-4 w-4" />
                  Custom proxy
                </div>
                <p className="text-xs text-muted-foreground mt-2">Manually entered credentials</p>
                {config?.custom?.configured && (
                  <p className="text-xs font-mono mt-2 text-foreground">
                    {config.custom.host}:{config.custom.port}
                  </p>
                )}
              </button>
            </div>
          </div>

          {source === 'proxyPool' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Selected pool proxy</label>
              <Select value={proxyIpId} onValueChange={setProxyIpId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a proxy from the pool…" />
                </SelectTrigger>
                <SelectContent>
                  {availableProxies.map((p) => (
                    <SelectItem key={p._id} value={p._id} disabled={!p.isActive}>
                      {p.container} — {p.host}:{p.port}
                      {!p.isActive ? ' (inactive)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {source === 'session' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">DAT session</label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a session…" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} — {maskProxyPreview(s.proxy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {source === 'custom' && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Pencil className="h-4 w-4" />
                Custom proxy details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-foreground">Host</label>
                  <Input
                    placeholder="proxy.example.com"
                    value={customHost}
                    onChange={(e) => setCustomHost(e.target.value)}
                    className="bg-background font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-foreground">Port</label>
                  <Input
                    type="number"
                    placeholder="8080"
                    value={customPort}
                    onChange={(e) => setCustomPort(e.target.value)}
                    className="bg-background font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-foreground">Username</label>
                  <Input
                    placeholder="Optional"
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    className="bg-background font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-foreground">Password</label>
                  <Input
                    type="password"
                    placeholder="Optional"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="bg-background font-mono text-sm"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveCustomOnly}
                disabled={saving || !customValid}
              >
                Save custom details only
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleSave} disabled={saveDisabled}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save & apply
            </Button>
            {source !== 'env' && (
              <Button variant="outline" onClick={handleUseEnv} disabled={saving}>
                Switch to .env proxy
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Imported proxy pool
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {availableProxies.length} proxies in database — click Use to apply immediately
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search container, host…"
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
          </div>

          {availableProxies.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground text-sm">
              No proxies in the database. Run{' '}
              <code className="text-xs bg-muted px-1 rounded">npm run proxies:import</code> in the
              backend folder.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Container</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Host:Port</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Username</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Provider</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProxies.map((proxy) => {
                    const isActive =
                      config?.source === 'proxyPool' && config.proxyIpId === proxy._id;
                    return (
                      <tr
                        key={proxy._id}
                        className={`border-b border-border last:border-0 ${
                          isActive ? 'bg-primary/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-semibold">{proxy.container}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {proxy.host}:{proxy.port}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {proxy.username || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{proxy.providerName || '—'}</td>
                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Active
                            </span>
                          ) : proxy.isActive ? (
                            <span className="text-xs text-green-600">Available</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant={isActive ? 'secondary' : 'default'}
                            disabled={saving || !proxy.isActive || isActive}
                            onClick={() => handleUseProxyIp(proxy)}
                          >
                            {isActive ? 'In use' : 'Use for extensions'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredProxies.length === 0 && (
                <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                  No proxies match your search.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
