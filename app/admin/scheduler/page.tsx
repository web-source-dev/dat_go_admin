'use client';

import { useState, useEffect, useCallback } from 'react';
import { schedulerApi, SCHEDULER_BACKENDS, type SchedulerBackendKey } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface SchedulerStatus {
  autoEnabled?: boolean;
  isRunning: boolean;
  isScheduled: boolean;
  nextRun: string | null;
  nextRunPST: string | null;
  backupScheduled?: boolean;
  nextBackupRun?: string | null;
}

interface SchedulerSyncOptions {
  autoAssignUserSessionsOnSync: boolean;
  autoUpdateSessionProxiesOnSync: boolean;
}

type TargetKey = SchedulerBackendKey | 'all';

const TRIGGERS: Record<string, (baseURL?: string) => Promise<any>> = {
  sync: schedulerApi.triggerSync,
  download: schedulerApi.triggerDownload,
  full: schedulerApi.triggerFull,
  payments: schedulerApi.triggerPaymentCheck,
  referrals: schedulerApi.triggerReferralUpdate,
  backup: schedulerApi.triggerBackup,
  freightdesk: schedulerApi.triggerFreightdesk,
};

const ACTIONS: {
  action: string;
  name: string;
  label: string;
  description: string;
}[] = [
  {
    action: 'sync',
    name: 'Session Sync',
    label: 'Sync Sessions',
    description: 'Sync sessions from external API',
  },
  {
    action: 'download',
    name: 'Download Files',
    label: 'Download ZIPs',
    description: 'Download session ZIPs + extract cookies',
  },
  {
    action: 'full',
    name: 'Full Sync',
    label: 'Full Sync',
    description: 'Sessions + downloads + FreightDesk',
  },
  {
    action: 'freightdesk',
    name: 'FreightDesk Import',
    label: 'FD Import',
    description: 'Import FreightDesk containers',
  },
  {
    action: 'payments',
    name: 'Payment Check',
    label: 'Check Payments',
    description: 'Overdue payments + ban check',
  },
  {
    action: 'referrals',
    name: 'Referral Updates',
    label: 'Update Referrals',
    description: 'Refresh referral discount statuses',
  },
  {
    action: 'backup',
    name: 'Database backup',
    label: 'DB Backup',
    description: 'Copy DB to backup target URI',
  },
];

function summarize(action: string, response: any): string | undefined {
  const data = response?.data;
  if (!data) return undefined;
  if (action === 'backup' && data.skipped) {
    if (data.reason === 'no-target-uri') return 'Skipped: set MONGODB_BACKUP_TARGET_URI on the server.';
    if (data.reason === 'target-same-as-primary' || data.reason === 'target-same-as-source')
      return 'Skipped: backup target URI must differ from the source URI.';
    if (data.reason === 'already-running') return 'Skipped: a backup is already running.';
    return `Skipped: ${(data.reason as string) || 'see server logs.'}`;
  }
  if (data.created !== undefined)
    return `Sessions: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`;
  if (data.imported !== undefined && action === 'freightdesk')
    return `FreightDesk: ${data.imported} imported, ${data.failed || 0} failed`;
  if (data.checked !== undefined) return `Payments: ${data.checked} checked, ${data.banned} banned`;
  if (data.updated !== undefined && action !== 'backup') return `Referrals: ${data.updated} updated`;
  if (data.collections && action === 'backup') {
    const entries = Object.entries(data.collections as Record<string, number>);
    return `Synced — ${entries.map(([k, v]) => `${k}: ${v}`).join(', ')}`;
  }
  return undefined;
}

function formatShortDate(value: string, timeZone?: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
}

export default function SchedulerPage() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [target, setTarget] = useState<TargetKey>('primary');
  const [syncOptions, setSyncOptions] = useState<SchedulerSyncOptions | null>(null);
  const [syncOptionsLoading, setSyncOptionsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: string; name: string } | null>(null);

  const statusBackend =
    target === 'all'
      ? SCHEDULER_BACKENDS[0]
      : SCHEDULER_BACKENDS.find((b) => b.key === target) || SCHEDULER_BACKENDS[0];

  const fetchStatus = useCallback(async () => {
    try {
      const [statusResponse, optionsResponse] = await Promise.all([
        schedulerApi.getStatus(statusBackend.url),
        schedulerApi.getSyncOptions(statusBackend.url),
      ]);
      setStatus(statusResponse.data);
      setSyncOptions(optionsResponse.data);
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
      setStatus(null);
      setSyncOptions(null);
      toast.error(`Failed to fetch status from ${statusBackend.label}`);
    } finally {
      setLoading(false);
    }
  }, [statusBackend.url, statusBackend.label]);

  const updateSyncOptions = async (patch: Partial<SchedulerSyncOptions>) => {
    try {
      setSyncOptionsLoading(true);
      const results = await Promise.allSettled(
        SCHEDULER_BACKENDS.map((b) => schedulerApi.updateSyncOptions(patch, b.url))
      );
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      if (ok.length === 0) {
        throw new Error('All backends failed to update sync settings');
      }

      const primaryOk = results[0];
      if (primaryOk.status === 'fulfilled') {
        setSyncOptions(primaryOk.value.data);
      } else {
        const firstOk = ok[0] as PromiseFulfilledResult<{
          success: boolean;
          data: SchedulerSyncOptions;
        }>;
        setSyncOptions(firstOk.value.data);
      }

      if (failed.length > 0) {
        toast.warning(
          `Sync settings updated on ${ok.length}/${SCHEDULER_BACKENDS.length} backends`,
          { description: 'Some backends failed — switch target and retry if needed.' }
        );
      } else {
        toast.success('Sync settings updated on all backends');
      }
    } catch (error: any) {
      toast.error('Failed to update sync settings', {
        description: error?.response?.data?.message || error?.message || 'Request failed',
      });
    } finally {
      setSyncOptionsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const resolveTargets = () =>
    target === 'all' ? SCHEDULER_BACKENDS : SCHEDULER_BACKENDS.filter((b) => b.key === target);

  const handleAction = (action: string, actionName: string) => {
    setPendingAction({ action, name: actionName });
  };

  const runAction = async (action: string, actionName: string) => {
    const fn = TRIGGERS[action];
    if (!fn) return;
    const targets = resolveTargets();

    setActionLoading(action);
    const results = await Promise.allSettled(targets.map((b) => fn(b.url)));

    let anyOk = false;
    results.forEach((result, i) => {
      const backend = targets[i];
      if (result.status === 'fulfilled') {
        anyOk = true;
        const detail = summarize(action, result.value);
        toast.success(`${backend.label}: ${actionName} ✓`, detail ? { description: detail } : undefined);
      } else {
        const error: any = result.reason;
        toast.error(`${backend.label}: ${actionName} failed`, {
          description: error?.response?.data?.message || error?.message || 'Request failed',
        });
      }
    });

    if (anyOk) await fetchStatus();
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Loading scheduler status...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 w-full min-h-full">
      {/* Header + backend target */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scheduler</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Status, sync options, and manual triggers
            {' · '}
            Target:{' '}
            {target === 'all' ? (
              <span className="font-medium text-foreground">all backends</span>
            ) : (
              <>
                <span className="font-medium text-foreground">{statusBackend.label}</span>{' '}
                <code className="bg-muted px-1 rounded text-xs">{statusBackend.url}</code>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SCHEDULER_BACKENDS.map((b) => (
            <Button
              key={b.key}
              size="sm"
              variant={target === b.key ? 'default' : 'outline'}
              onClick={() => setTarget(b.key)}
            >
              {b.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={target === 'all' ? 'default' : 'outline'}
            onClick={() => setTarget('all')}
          >
            All
          </Button>
          <Button size="sm" variant="outline" onClick={fetchStatus} title="Refresh status">
            <RefreshCw size={16} className="mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top row: status | sync options — compact height */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3 px-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Status
              <Badge variant="outline">{statusBackend.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={status?.autoEnabled ? 'default' : 'secondary'}>
                Auto: {status?.autoEnabled ? 'On' : 'Paused'}
              </Badge>
              <Badge variant={status?.isScheduled ? 'default' : 'secondary'}>
                Cron: {status?.isScheduled ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant={status?.isRunning ? 'destructive' : 'outline'}>
                Running: {status?.isRunning ? 'Yes' : 'No'}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">UTC</span>
                <span className="font-medium">
                  {status?.nextRun ? formatShortDate(status.nextRun, 'UTC') : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">PST</span>
                <span className="font-medium">
                  {status?.nextRunPST
                    ? `${formatShortDate(status.nextRunPST.replace(' PST', ''), 'Asia/Karachi')} PST`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Backup</span>
                <span className="font-medium">
                  {status?.nextBackupRun
                    ? formatShortDate(String(status.nextBackupRun), 'UTC')
                    : '—'}
                </span>
              </div>
            </div>

            {!status?.autoEnabled && (
              <p className="text-xs text-muted-foreground">
                Set <code className="bg-muted px-1 rounded">SCHEDULER_AUTO_ENABLED=true</code> for
                daily cron. Manual triggers still work.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-2">
            <CardTitle className="text-base">Sync Options</CardTitle>
            <CardDescription className="text-xs">
              Saved to all backends · sync + troubleshoot
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Auto-assign user sessions</p>
                <p className="text-xs text-muted-foreground">Off = keep current session mapping</p>
              </div>
              <Switch
                checked={Boolean(syncOptions?.autoAssignUserSessionsOnSync)}
                disabled={syncOptionsLoading || !syncOptions}
                onCheckedChange={(checked) =>
                  updateSyncOptions({ autoAssignUserSessionsOnSync: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Auto-update session proxies</p>
                <p className="text-xs text-muted-foreground">Off = never overwrite proxies from API</p>
              </div>
              <Switch
                checked={Boolean(syncOptions?.autoUpdateSessionProxiesOnSync)}
                disabled={syncOptionsLoading || !syncOptions}
                onCheckedChange={(checked) =>
                  updateSyncOptions({ autoUpdateSessionProxiesOnSync: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full-width action buttons — same primary style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Manual Triggers</CardTitle>
          <CardDescription>
            Runs on {target === 'all' ? 'all backends' : statusBackend.label}. Confirm before each run.
            Daily auto schedule: 5:00 PM PST (12:00 PM UTC).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
            {ACTIONS.map((item) => (
              <Button
                key={item.action}
                variant="default"
                className="h-auto min-h-[88px] flex-col items-start justify-center gap-1 py-4 px-4 text-left whitespace-normal"
                disabled={actionLoading === item.action || !!actionLoading}
                onClick={() => handleAction(item.action, item.name)}
                title={item.description}
              >
                <span className="text-sm font-semibold w-full">
                  {actionLoading === item.action ? 'Running…' : item.label}
                </span>
                <span className="text-xs font-normal text-primary-foreground/80 w-full leading-snug">
                  {item.description}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run “{pendingAction?.name}”?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will run on{' '}
                  <span className="font-medium">
                    {target === 'all' ? 'all backends' : `the ${statusBackend.label} backend`}
                  </span>
                  :
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {resolveTargets().map((b) => (
                    <li key={b.key}>
                      <span className="font-medium">{b.label}</span> —{' '}
                      <code className="text-xs bg-muted px-1 rounded">{b.url}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const p = pendingAction;
                setPendingAction(null);
                if (p) runAction(p.action, p.name);
              }}
            >
              Run now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
