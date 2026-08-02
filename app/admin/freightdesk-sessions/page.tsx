'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Circle,
  Download,
  RefreshCw,
  Tag,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { freightdeskApi, SCHEDULER_BACKENDS } from '@/lib/api';
import { COOKIE_LABEL_OPTIONS, CookieLabel, isAssignableCookieLabel } from '@/lib/cookieLabels';
import { FreightdeskContainerSession, FreightdeskStatus } from '@/lib/types';

type CookieChannel = 'single' | 'double' | 'multi' | 'swiftSolutions' | 'test' | 'dathub';

export default function FreightdeskSessionsPage() {
  const [sessions, setSessions] = useState<FreightdeskContainerSession[]>([]);
  const [status, setStatus] = useState<FreightdeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<CookieChannel>('single');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusData, sessionData] = await Promise.all([
        freightdeskApi.getStatus(),
        freightdeskApi.getSessions(),
      ]);
      setStatus(statusData);
      setSessions(sessionData.sessions || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load FreightDesk sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const isActiveForChannel = (session: FreightdeskContainerSession) => {
    switch (channel) {
      case 'double':
        return session.isActiveDouble;
      case 'multi':
        return session.isActiveMulti;
      case 'swiftSolutions':
        return session.isActiveSwiftSolutions;
      case 'test':
        return session.isActiveTest;
      case 'dathub':
        return session.isActive;
      case 'single':
      default:
        return session.isActiveSingle;
    }
  };

  // Fans an action out to every configured backend (main/primary/backup) so
  // a re-import or activation is never left stale on the backends the browser
  // isn't currently pointed at. Mirrors the pattern used on the Scheduler page.
  const fanOutToBackends = async (
    actionLabel: string,
    call: (baseURL: string) => Promise<any>
  ) => {
    const results = await Promise.allSettled(SCHEDULER_BACKENDS.map((b) => call(b.url)));
    let anyOk = false;
    results.forEach((result, i) => {
      const backend = SCHEDULER_BACKENDS[i];
      if (result.status === 'fulfilled') {
        anyOk = true;
        toast.success(`${backend.label}: ${actionLabel} ✓`);
      } else {
        const err: any = result.reason;
        toast.error(`${backend.label}: ${actionLabel} failed`, {
          description: err?.response?.data?.message || err?.message || 'Request failed',
        });
      }
    });
    if (!anyOk) {
      throw new Error(`${actionLabel} failed on all backends`);
    }
  };

  const handleImport = async (container: string, activate = false) => {
    setWorking(`${container}-import`);
    try {
      await fanOutToBackends(`Re-import ${container}`, (baseURL) =>
        freightdeskApi.importContainer(container, { activate, channel, forceReimport: true }, baseURL)
      );
      await fetchData();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to re-import ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleActivate = async (container: string) => {
    setWorking(`${container}-activate`);
    try {
      await fanOutToBackends(`Activate ${container}`, (baseURL) =>
        freightdeskApi.importContainer(container, { activate: true, channel, forceReimport: true }, baseURL)
      );
      await fetchData();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to activate ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleLabelChange = async (container: string, label: string) => {
    if (!isAssignableCookieLabel(label)) return;
    setWorking(`${container}-label`);
    try {
      await freightdeskApi.updateLabel(container, label);
      setSessions((prev) =>
        prev.map((s) => (s.container === container ? { ...s, label } : s))
      );
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to update label for ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleImportAll = async (activate = false) => {
    setWorking('import-all');
    try {
      await fanOutToBackends('Re-import all containers', (baseURL) =>
        freightdeskApi.importAll({ activate, channel, forceReimport: true }, baseURL)
      );
      await fetchData();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to re-import all containers');
    } finally {
      setWorking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading FreightDesk container sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Boxes className="text-primary" />
              FreightDesk Containers
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Import cookies from FreightDesk, set labels, and activate per channel. Labels sync with FreightDesk admin and are preserved on re-import.
            </p>
            {status && (
              <p className="text-xs text-muted-foreground mt-2">
                API: {status.apiUrl} · Partner key {status.configured ? 'configured' : 'missing'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={channel} onValueChange={(value: CookieChannel) => setChannel(value)}>
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue placeholder="Activation channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single plan</SelectItem>
                <SelectItem value="double">Double plan</SelectItem>
                <SelectItem value="multi">Multi plan</SelectItem>
                <SelectItem value="swiftSolutions">Swift Solutions</SelectItem>
                <SelectItem value="test">Test users</SelectItem>
                <SelectItem value="dathub">DAT Go (legacy)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData} disabled={working !== null}>
              <RefreshCw size={18} className="mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => handleImportAll(false)} disabled={working !== null}>
              <Download size={18} className="mr-2" />
              Re-import All
            </Button>
            <Button onClick={() => handleImportAll(true)} disabled={working !== null}>
              <Upload size={18} className="mr-2" />
              Re-import & Activate Last
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-8 py-4 bg-destructive/10 border-b border-destructive/20">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <div className="flex-1 px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {sessions.length === 0 ? (
            <div className="col-span-full rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
              No FreightDesk container sessions found.
            </div>
          ) : (
            sessions.map((session) => {
              const active = isActiveForChannel(session);
              const busy = working?.startsWith(session.container);
              const currentLabel = session.label || 'new';

              return (
                <div
                  key={session.container}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-3xl font-bold text-foreground">{session.container}</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {session.remoteCookieCount ?? session.cookieCount} remote
                        {session.localCookieCount !== undefined
                          ? ` · ${session.localCookieCount} local`
                          : ''}
                      </p>
                    </div>
                    {active ? (
                      <CheckCircle2 className="text-green-500 shrink-0" size={22} />
                    ) : (
                      <Circle className="text-muted-foreground shrink-0" size={22} />
                    )}
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Tag size={14} /> Label
                      </span>
                      <Select
                        value={currentLabel}
                        onValueChange={(value) => handleLabelChange(session.container, value)}
                        disabled={busy || working !== null}
                      >
                        <SelectTrigger className="h-8 w-[190px] bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COOKIE_LABEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                          {currentLabel === 'multi' && (
                            <SelectItem value="multi">Multi (legacy)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="text-muted-foreground">
                      Updated: <span className="text-foreground">{formatDate(session.lastUpdated)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Imported:{' '}
                      <span className={session.ready ? 'text-green-600' : session.imported ? 'text-amber-600' : 'text-foreground'}>
                        {session.ready ? 'Ready' : session.imported ? 'Stale' : 'No'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-5 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || working !== null}
                      onClick={() => handleImport(session.container, false)}
                    >
                      <Download size={16} className="mr-2" />
                      {working === `${session.container}-import` ? 'Re-importing...' : 'Re-import'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy || working !== null}
                      onClick={() => handleImport(session.container, true)}
                    >
                      <Upload size={16} className="mr-2" />
                      Import & Activate
                    </Button>
                    {session.ready && !active && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy || working !== null}
                        onClick={() => handleActivate(session.container)}
                      >
                        {working === `${session.container}-activate` ? 'Activating...' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
