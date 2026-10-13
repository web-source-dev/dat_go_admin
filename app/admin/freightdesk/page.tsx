'use client';

import { useEffect, useRef, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { maskProxy, truncateText } from '@/lib/utils';
import {
  freightdeskApi,
  COOKIE_LABEL_OPTIONS,
  type FreightdeskContainerSession,
  type FreightdeskStatus,
  type FreightdeskChangeStatus,
  type FreightdeskImportMode,
  type FreightdeskImportOutcome,
  type CookieDiff,
  type CookieChannel,
  type AssignableCookieLabel
} from '@/lib/api';

function isActiveForChannel(session: FreightdeskContainerSession, channel: CookieChannel) {
  switch (channel) {
    case 'double':
      return !!session.isActiveDouble;
    case 'multi':
      return !!session.isActiveMulti;
    case 'horizon':
      return !!session.isActiveHorizon;
    case 'swiftSolutions':
      return !!session.isActiveSwiftSolutions;
    case 'test':
      return !!session.isActiveTest;
    case 'single':
    default:
      return !!session.isActiveSingle;
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const CHANNEL_NAMES: Record<CookieChannel, string> = {
  single: 'Single plan',
  double: 'Double plan',
  multi: 'Multi plan',
  horizon: 'Horizon',
  swiftSolutions: 'Swift Solutions',
  test: 'Test users',
  dathub: 'DAT Hub'
};

const CHANGE_BADGES: Record<FreightdeskChangeStatus, { label: string; className: string }> = {
  new: { label: 'Not imported', className: 'bg-sky-50 text-sky-700' },
  changed: { label: 'Changed in FreightDesk', className: 'bg-amber-50 text-amber-700' },
  reimported: { label: 'Re-imported', className: 'bg-slate-100 text-slate-600' },
  unchanged: { label: 'No changes', className: 'bg-slate-100 text-slate-500' },
  'kept-newer': { label: 'Server copy newer', className: 'bg-emerald-50 text-emerald-700' }
};

function ChangeBadge({ status }: { status?: FreightdeskChangeStatus | null }) {
  if (!status) return null;
  const badge = CHANGE_BADGES[status];
  if (!badge) return null;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
      {badge.label}
    </span>
  );
}

/** Which login cookies differ between FreightDesk and the database. */
function DiffSummary({ diff }: { diff?: CookieDiff | null }) {
  if (!diff || !diff.total) return null;
  const parts: [string, string[]][] = [
    ['Changed', diff.changed],
    ['Added', diff.added],
    ['Removed', diff.removed],
    ['Renewed', diff.renewed]
  ];
  return (
    <ul className="space-y-0.5 text-xs text-slate-600">
      {parts
        .filter(([, names]) => names.length)
        .map(([label, names]) => (
          <li key={label}>
            <span className="text-slate-400">{label}:</span>{' '}
            <span className="font-mono break-all">{names.join(', ')}</span>
          </li>
        ))}
    </ul>
  );
}

/** Remote (FreightDesk) and stored (DB) cookies differ for an imported container. */
function cookiesDiffer(s: FreightdeskContainerSession) {
  if (!s.imported) return false;
  const countsDiffer =
    s.remoteCookieCount != null &&
    s.localCookieCount != null &&
    s.remoteCookieCount !== s.localCookieCount;
  const loginDiffers = Boolean(s.diff && s.diff.total > 0);
  return countsDiffer || loginDiffers;
}

/** Why remote and stored cookies differ (same account case). */
function divergeReason(s: FreightdeskContainerSession) {
  if (s.syncedAt) {
    return 'The stored copy was renewed from a running DAT GO desktop session since import, so its login cookies differ from FreightDesk — same account, usually fine. Keep both if you want to verify.';
  }
  return 'The remote and stored cookie sets are different. Review both, or keep both.';
}

/** Containers grouped by DAT account, only accounts held by two or more containers. */
function duplicateAccountGroups(sessions: FreightdeskContainerSession[]) {
  const groups = new Map<string, FreightdeskContainerSession[]>();
  for (const s of sessions) {
    if (!s.accountId) continue;
    groups.set(s.accountId, [...(groups.get(s.accountId) || []), s]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Which DAT account a container logs into, and which other containers share it. */
function AccountInfo({ session }: { session: FreightdeskContainerSession }) {
  const sameAccount = session.sameAccountAs || [];
  const sameBrowser = session.sameBrowserAs || [];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">DAT account</span>
        {session.accountId ? (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-xs ${
              sameAccount.length ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
            }`}
            title={`${session.accountId}${session.accountEmail ? ` · ${session.accountEmail}` : ''}\nFrom: ${
              session.accountSource || 'unknown'
            }`}
          >
            {session.accountShortId || session.accountId}
          </span>
        ) : (
          <span className="text-xs text-slate-400" title="No ajs_user_id cookie or login token in this session">
            Unknown
          </span>
        )}
      </div>
      {session.accountName || session.accountEmail || session.accountPlan ? (
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 space-y-0.5">
          {session.accountName ? (
            <div className="text-xs font-medium text-slate-700">{session.accountName}</div>
          ) : null}
          {session.accountEmail ? (
            <div className="text-xs text-slate-500 break-all">{session.accountEmail}</div>
          ) : null}
          {session.accountPlan ? (
            <div>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  /paid/i.test(session.accountPlan)
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {session.accountPlan}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {sameAccount.length ? (
        <div className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
          Same DAT account as <span className="font-semibold">{sameAccount.join(', ')}</span>
        </div>
      ) : session.accountId ? (
        <div className="text-xs text-emerald-600">Unique account</div>
      ) : null}
      {sameBrowser.length ? (
        <div
          className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700"
          title="Shares a device id (dat_agent_device_id, Auth0 did, Segment or Hotjar id): the cookies were exported from the same browser. Often the same account, but not proof."
        >
          Same browser as <span className="font-semibold">{sameBrowser.join(', ')}</span>
        </div>
      ) : null}
      {session.accountChanged ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 space-y-1">
          <div className="font-semibold">⚠ Different account in FreightDesk than the stored copy</div>
          <div>
            <span className="text-red-500">Remote (FreightDesk):</span>{' '}
            <span className="font-medium">{session.remoteAccountName || session.remoteAccountShortId || 'unknown'}</span>
            {session.remoteAccountEmail ? ` · ${session.remoteAccountEmail}` : ''}
          </div>
          <div>
            <span className="text-red-500">Server (stored):</span>{' '}
            <span className="font-medium">{session.dbAccountName || session.dbAccountShortId || 'unknown'}</span>
            {session.dbAccountEmail ? ` · ${session.dbAccountEmail}` : ''}
          </div>
          <div className="text-red-600">
            The server copy may show as “newer” only because it was synced later — it is a different login. Review both, or keep both.
          </div>
        </div>
      ) : null}
      {!session.accountChanged && cookiesDiffer(session) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 space-y-1">
          <div className="font-semibold">⚠ Remote and stored cookies differ (same account)</div>
          <div>
            FreightDesk: {session.remoteCookieCount} cookies · Stored: {session.localCookieCount} cookies
          </div>
          <DiffSummary diff={session.diff} />
          <div className="text-amber-600">{divergeReason(session)}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function FreightdeskContainersPage() {
  const [sessions, setSessions] = useState<FreightdeskContainerSession[]>([]);
  const [status, setStatus] = useState<FreightdeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<CookieChannel>('single');
  /** Per-container outcome of the last Import All / Import Changed run. */
  const [results, setResults] = useState<FreightdeskImportOutcome[] | null>(null);
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);
  /** Containers already announced as importable, so we only chime when NEW ones appear. */
  const announcedImportable = useRef<Set<string>>(new Set());

  /** Containers that have something to import right now (brand new, or cookies changed). */
  const importableContainers = (list: FreightdeskContainerSession[]) =>
    list.filter((s) => s.changeStatus === 'new' || s.changeStatus === 'changed').map((s) => s.container);

  const applySessions = (next: FreightdeskContainerSession[], announce: boolean) => {
    const importable = importableContainers(next);
    const importableSet = new Set(importable);
    if (announce) {
      // Show an on-page note for newly-importable containers. Sound/voice/desktop alerts are
      // handled globally by AlertsWatcher so they also fire on other admin pages.
      const fresh = importable.filter((c) => !announcedImportable.current.has(c));
      if (fresh.length) {
        setMessage(
          `${fresh.length} new cookie${fresh.length > 1 ? 's' : ''} available to import: ` +
            `${fresh.slice(0, 8).join(', ')}${fresh.length > 8 ? '…' : ''}. You can import them now.`
        );
      }
    }
    // Remember exactly the currently-importable set: imported/cleared containers drop out, so
    // if one later changes again it will announce once more; nothing repeats in between.
    announcedImportable.current = importableSet;
    setSessions(next);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statusData, sessionData] = await Promise.all([
        freightdeskApi.getStatus(),
        freightdeskApi.getSessions()
      ]);
      setStatus(statusData);
      applySessions(sessionData.sessions || [], false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load FreightDesk containers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Live container updates: silently poll every 20s and announce new/updated containers.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const [statusData, sessionData] = await Promise.all([
          freightdeskApi.getStatus(),
          freightdeskApi.getSessions()
        ]);
        if (stop) return;
        setStatus(statusData);
        applySessions(sessionData.sessions || [], true);
        setLastLiveAt(new Date());
      } catch {
        // ignore transient poll errors; the next tick retries
      }
    };
    const id = setInterval(tick, 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImport = async (
    container: string,
    activate = false,
    mode: FreightdeskImportMode = 'all'
  ) => {
    setWorking(`${container}-${activate ? 'activate' : 'import'}`);
    setError('');
    setMessage('');
    try {
      const res = await freightdeskApi.importContainer(container, { activate, channel, mode });
      if (!activate && res.imported === false && res.status === 'kept-newer') {
        // The DB copy has a newer DAT login (usually synced from a running Dat Desk).
        const overwrite = window.confirm(
          `${container}: ${res.reason || 'the server copy is newer'}.\n\n` +
            'Replace it with the older FreightDesk cookies anyway?'
        );
        if (overwrite) {
          const forced = await freightdeskApi.importContainer(container, { channel, mode: 'force' });
          setMessage(forced.message || `Imported ${container}`);
        } else {
          setMessage(`Kept the newer server copy of ${container}.`);
        }
      } else if (res.imported === false && res.status === 'unchanged') {
        // Not an error: FreightDesk's cookies are identical to what we already imported.
        setMessage(
          `${container}: skipped — FreightDesk cookies are unchanged since the last import, so nothing new to import (your stored copy is already the latest).`
        );
      } else {
        setMessage(res.message || `Imported ${container}`);
      }
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to import ${container}`);
    } finally {
      setWorking(null);
    }
  };

  // "Keep both": add FreightDesk's current (different) account as a NEW separate cookie,
  // leaving the existing stored copy untouched.
  const handleImportSeparate = async (container: string) => {
    setWorking(`${container}-separate`);
    setError('');
    setMessage('');
    try {
      const res = await freightdeskApi.importSeparate(container);
      setMessage(
        res.message ||
          `Added a separate cookie for ${container}. Activate it on the Cookies page.`
      );
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to add separate cookie for ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleImportAll = async (activate = false, mode: FreightdeskImportMode = 'all') => {
    if (
      activate &&
      !window.confirm(
        `Import all FreightDesk containers and ACTIVATE the last imported one for ${CHANNEL_NAMES[channel]}?

` +
          `This replaces the cookie currently active for ${CHANNEL_NAMES[channel]} — every user on that channel will switch to it.`
      )
    ) {
      return;
    }
    setWorking(activate ? 'import-all-activate' : mode === 'changed' ? 'import-changed' : 'import-all');
    setError('');
    setResults(null);
    setMessage(activate ? 'Import all & activate started…' : 'Import started…');
    try {
      const res = await freightdeskApi.importAll({ activate, channel, mode }, (info) => {
        if (info?.message) setMessage(info.message);
      });
      const summary = [
        `${res.imported ?? res.containers?.length ?? 0} imported`,
        `${res.skipped ?? res.skippedContainers?.length ?? 0} skipped`,
        `${res.failed ?? res.errors?.length ?? 0} failed`
      ].join(' · ');
      setMessage(
        `${res.message || 'Import complete'} (${summary}${res.total != null ? ` of ${res.total}` : ''})` +
          (res.activated && res.channel ? ` — activated the last import for ${CHANNEL_NAMES[res.channel] || res.channel}.` : '')
      );
      const failedOutcomes: FreightdeskImportOutcome[] = (res.errors || []).map((e) => ({
        container: e.container,
        error: e.error || 'Import failed'
      }));
      setResults(
        [...(res.containers || []), ...(res.skippedContainers || []), ...failedOutcomes].sort((a, b) =>
          a.container.localeCompare(b.container)
        )
      );
      await load();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to import all containers';
      if (/cors|network error|err_failed|failed to fetch/i.test(String(msg))) {
        setError(
          'Import request failed before completion (often a proxy timeout). The server may still be importing — wait a minute and refresh.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setWorking(null);
    }
  };

  const handleLabelChange = async (container: string, label: string) => {
    if (!COOKIE_LABEL_OPTIONS.some((o) => o.value === label)) return;
    setWorking(`${container}-label`);
    setError('');
    try {
      await freightdeskApi.updateLabel(container, label as AssignableCookieLabel);
      setSessions((prev) =>
        prev.map((s) => (s.container === container ? { ...s, label: label as AssignableCookieLabel } : s))
      );
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to update label for ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleWorkingChange = async (session: FreightdeskContainerSession, isWorking: boolean) => {
    if (!session.imported && !session.cookieId) {
      setError(`Import ${session.container} before marking working status.`);
      return;
    }
    setWorking(`${session.container}-working`);
    setError('');
    setSessions((prev) =>
      prev.map((s) => (s.container === session.container ? { ...s, isWorking } : s))
    );
    try {
      await freightdeskApi.setWorking(session.container, isWorking);
    } catch (err: any) {
      setSessions((prev) =>
        prev.map((s) =>
          s.container === session.container ? { ...s, isWorking: !isWorking } : s
        )
      );
      setError(
        err.response?.data?.message || err.message || `Failed to update working status for ${session.container}`
      );
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Boxes className="text-primary shrink-0" />
              FD Containers
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Import FreightDesk container cookies into DAT GO. Activate per plan, Horizon, Swift Solutions, or Test channel.
            </p>
            {status ? (
              <p className="text-xs text-muted-foreground mt-2">
                API: {status.apiUrl} · Partner key{' '}
                <span className={status.configured ? 'text-green-600' : 'text-amber-600'}>
                  {status.configured ? 'configured' : 'missing'}
                </span>
              </p>
            ) : null}
            <p
              className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium mt-2"
              title={lastLiveAt ? `Last live check ${lastLiveAt.toLocaleTimeString()}` : 'Live updates on'}
            >
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live updates · import alerts enabled
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={channel}
              onValueChange={(value) => setChannel(value as CookieChannel)}
              disabled={working !== null}
            >
              <SelectTrigger className="w-[180px] bg-background border-border">
                <SelectValue placeholder="Activation channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single plan</SelectItem>
                <SelectItem value="double">Double plan</SelectItem>
                <SelectItem value="multi">Multi plan</SelectItem>
                <SelectItem value="horizon">Horizon</SelectItem>
                <SelectItem value="swiftSolutions">Swift Solutions</SelectItem>
                <SelectItem value="test">Test users</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load} disabled={working !== null}>
              <RefreshCw size={18} className="mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => handleImportAll(false, 'changed')}
              disabled={working !== null}
              title="Import only containers whose cookies changed in FreightDesk since the last import"
            >
              {working === 'import-changed' ? 'Importing…' : 'Import changed only'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleImportAll(false)}
              disabled={working !== null}
              title="Import every container (a newer copy synced from DAT GO desktop is kept when newer)"
            >
              <Download size={18} className="mr-2" />
              {working === 'import-all' ? 'Importing…' : 'Import all'}
            </Button>
            <Button onClick={() => handleImportAll(true)} disabled={working !== null}>
              <Upload size={18} className="mr-2" />
              {working === 'import-all-activate' ? 'Importing…' : 'Import all & activate last'}
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="px-8 py-4 bg-destructive/10 border-b border-destructive/20">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      <div className="flex-1 px-8 py-6 overflow-auto">
        {message ? (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-300 text-sm px-3 py-2">
            {message}
          </div>
        ) : null}

        {results && results.length ? (
          <div className="rounded-lg border border-border bg-card mb-4 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Last import</h2>
              <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setResults(null)}>
                Dismiss
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {results.map((r) => (
                <li key={r.container} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-4">
                  <span className="w-20 shrink-0 font-semibold text-brand-900">{r.container}</span>
                  <span className="shrink-0">
                    {r.error ? (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700">
                        Failed
                      </span>
                    ) : (
                      <ChangeBadge status={r.status} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    {r.error ? (
                      <span className="text-xs text-red-600 break-all">{r.error}</span>
                    ) : r.diff?.total ? (
                      <DiffSummary diff={r.diff} />
                    ) : (
                      <span className="text-xs text-slate-400">{r.reason || 'No login cookie changes'}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && duplicateAccountGroups(sessions).length ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            <div className="font-semibold">Containers sharing a DAT account</div>
            <ul className="mt-1 space-y-0.5">
              {duplicateAccountGroups(sessions).map((group) => (
                <li key={group[0].accountId}>
                  <span className="font-mono text-xs">{group[0].accountShortId || group[0].accountId}</span>
                  {group[0].accountEmail ? <span className="text-xs"> ({group[0].accountEmail})</span> : null}:{' '}
                  <span className="font-semibold">{group.map((s) => s.container).join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="mt-2 text-sm text-muted-foreground">Loading FreightDesk containers…</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No FreightDesk containers found. Check partner API key and FreightDesk connectivity.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {sessions.map((session) => {
              const active = isActiveForChannel(session, channel);
              const busy = working?.startsWith(session.container);
              const currentLabel = session.label || 'new';

              return (
                <div
                  key={session.container}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-3xl font-bold text-foreground tracking-tight">
                        {session.container}
                      </div>
                      <p
                        className={`text-sm mt-1 ${
                          cookiesDiffer(session) ? 'font-semibold text-amber-700' : 'text-slate-500'
                        }`}
                        title={cookiesDiffer(session) ? 'Remote and stored cookie counts differ — see the note below' : undefined}
                      >
                        {session.remoteCookieCount ?? session.cookieCount ?? 0} remote
                        {session.localCookieCount !== undefined
                          ? ` · ${session.localCookieCount} in DB`
                          : ''}
                        {cookiesDiffer(session) ? ' ⚠' : ''}
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
                      <span className="text-muted-foreground">Working</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${
                            session.isWorking ? 'text-green-600' : 'text-muted-foreground'
                          }`}
                        >
                          {session.isWorking ? 'Working' : 'Not working'}
                        </span>
                        <Switch
                          checked={Boolean(session.isWorking)}
                          disabled={busy || working !== null || (!session.imported && !session.cookieId)}
                          aria-label={`Mark ${session.container} as working`}
                          onCheckedChange={(next) => handleWorkingChange(session, next)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Label</span>
                      <Select
                        value={currentLabel}
                        disabled={busy || working !== null}
                        onValueChange={(value) => handleLabelChange(session.container, value)}
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
                          {!COOKIE_LABEL_OPTIONS.some((o) => o.value === currentLabel) ? (
                            <SelectItem value={currentLabel}>{currentLabel}</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-slate-500">
                      Updated:{' '}
                      <span className="text-slate-800">{formatDate(session.lastUpdated)}</span>
                    </div>
                    <AccountInfo session={session} />
                    {session.syncedAt ? (
                      <div className="text-muted-foreground">
                        Synced from DAT GO desktop:{' '}
                        <span className="text-foreground">{formatDate(session.syncedAt)}</span>
                        {session.syncedBy ? (
                          <span className="block text-xs text-slate-400 break-all">{session.syncedBy}</span>
                        ) : null}
                      </div>
                    ) : null}
                    {session.proxy || session.userAgent ? (
                      <div className="space-y-0.5 text-xs">
                        {session.proxy ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 shrink-0">Bound proxy</span>
                            <span className="font-mono text-slate-700 truncate" title={maskProxy(session.proxy)}>
                              {maskProxy(session.proxy)}
                            </span>
                          </div>
                        ) : null}
                        {session.userAgent ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 shrink-0">User agent</span>
                            <span className="font-mono text-slate-700 truncate" title={session.userAgent}>
                              {truncateText(session.userAgent, 40)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {session.authExpiresAt ? (
                      <div className="text-slate-500">
                        DAT login valid until:{' '}
                        <span className="text-slate-800">{formatDate(session.authExpiresAt)}</span>
                      </div>
                    ) : null}
                    {session.changeStatus ? (
                      <div className="space-y-1">
                        <ChangeBadge status={session.changeStatus} />
                        {session.changeStatus === 'changed' || session.changeStatus === 'kept-newer' ? (
                          <DiffSummary diff={session.diff} />
                        ) : null}
                      </div>
                    ) : null}
                    <div className="text-slate-500">
                      Imported:{' '}
                      <span
                        className={
                          session.ready
                            ? 'text-emerald-600'
                            : session.imported
                              ? 'text-amber-600'
                              : 'text-slate-800'
                        }
                      >
                        {session.ready ? 'Ready' : session.imported ? 'Stale' : 'No'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-5 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={busy || working !== null}
                      onClick={() => handleImport(session.container, false)}
                    >
                      <Download size={16} className="mr-2" />
                      {working === `${session.container}-import` ? 'Importing…' : 'Import'}
                    </Button>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={busy || working !== null}
                      onClick={() => handleImport(session.container, true)}
                    >
                      <Upload size={16} className="mr-2" />
                      {working === `${session.container}-activate`
                        ? 'Activating…'
                        : 'Import & activate'}
                    </Button>
                    {session.accountChanged || cookiesDiffer(session) ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20"
                        disabled={busy || working !== null}
                        onClick={() => handleImportSeparate(session.container)}
                        title={
                          session.accountChanged
                            ? 'FreightDesk holds a different account than the stored copy. Add it as a NEW cookie and keep both.'
                            : 'Remote and stored cookies differ. Add the FreightDesk copy as a NEW cookie and keep both to verify.'
                        }
                      >
                        {working === `${session.container}-separate`
                          ? 'Adding…'
                          : 'Keep both (add remote as new cookie)'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
