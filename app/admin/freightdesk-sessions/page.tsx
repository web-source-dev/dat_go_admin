'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Circle,
  Download,
  RefreshCw,
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
import { freightdeskApi } from '@/lib/api';
import { FreightdeskContainerSession, FreightdeskStatus } from '@/lib/types';

type CookieChannel = 'single' | 'double' | 'multi' | 'swiftSolutions' | 'dathub';

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
      case 'dathub':
        return session.isActive;
      default:
        return session.isActiveSingle;
    }
  };

  const handleImport = async (container: string, activate = false) => {
    setWorking(`${container}-import`);
    try {
      await freightdeskApi.importContainer(container, { activate, channel });
      await fetchData();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to import ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleActivate = async (container: string) => {
    setWorking(`${container}-activate`);
    try {
      await freightdeskApi.activate(container, channel);
      await fetchData();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to activate ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleImportAll = async (activate = false) => {
    setWorking('import-all');
    try {
      await freightdeskApi.importAll({ activate, channel });
      await fetchData();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to import all containers');
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
              Import session cookies from FreightDesk API and activate them for DAT GO channels
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
                <SelectItem value="dathub">DAT Go (legacy)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData} disabled={working !== null}>
              <RefreshCw size={18} className="mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => handleImportAll(false)}
              disabled={working !== null}
            >
              <Download size={18} className="mr-2" />
              Import All
            </Button>
            <Button
              onClick={() => handleImportAll(true)}
              disabled={working !== null}
            >
              <Upload size={18} className="mr-2" />
              Import & Activate Last
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

              return (
                <div
                  key={session.container}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-3xl font-bold text-foreground">{session.container}</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {session.cookieCount} cookies
                      </p>
                    </div>
                    {active ? (
                      <CheckCircle2 className="text-green-500 shrink-0" size={22} />
                    ) : (
                      <Circle className="text-muted-foreground shrink-0" size={22} />
                    )}
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <div>
                      Updated: <span className="text-foreground">{formatDate(session.lastUpdated)}</span>
                    </div>
                    <div>
                      Imported:{' '}
                      <span className={session.imported ? 'text-green-600' : 'text-foreground'}>
                        {session.imported ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {session.imported && (
                      <div className="truncate" title={session.fileName}>
                        File: <span className="text-foreground">{session.fileName}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || working !== null}
                      onClick={() => handleImport(session.container, false)}
                    >
                      <Download size={16} className="mr-2" />
                      {working === `${session.container}-import` ? 'Importing...' : 'Import'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy || working !== null}
                      onClick={() => handleImport(session.container, true)}
                    >
                      <Upload size={16} className="mr-2" />
                      Import & Activate
                    </Button>
                    {session.imported && !active && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy || working !== null}
                        onClick={() => handleActivate(session.container)}
                      >
                        Activate
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
