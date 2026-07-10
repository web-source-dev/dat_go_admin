'use client';

import { useState, useEffect, useCallback } from 'react';
import { schedulerApi, SCHEDULER_BACKENDS, type SchedulerBackendKey } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

// Which backend(s) a trigger runs against. 'all' fans out to every backend.
type TargetKey = SchedulerBackendKey | 'all';

// Map each action to its scheduler API call (each accepts a target baseURL).
const TRIGGERS: Record<string, (baseURL?: string) => Promise<any>> = {
  sync: schedulerApi.triggerSync,
  download: schedulerApi.triggerDownload,
  full: schedulerApi.triggerFull,
  payments: schedulerApi.triggerPaymentCheck,
  referrals: schedulerApi.triggerReferralUpdate,
  backup: schedulerApi.triggerBackup,
  freightdesk: schedulerApi.triggerFreightdesk,
};

// Build a short human summary from a trigger response (per backend).
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

export default function SchedulerPage() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [target, setTarget] = useState<TargetKey>('primary');
  const [syncOptions, setSyncOptions] = useState<SchedulerSyncOptions | null>(null);
  const [syncOptionsLoading, setSyncOptionsLoading] = useState(false);
  // The trigger awaiting confirmation in the dialog (null = no dialog open).
  const [pendingAction, setPendingAction] = useState<{ action: string; name: string } | null>(null);

  // The backend whose status we display: the selected one, or Primary for 'all'.
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
      // Always write to every backend so toggles stay consistent (each has its own DB).
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
          {
            description: 'Some backends failed — switch target and retry if needed.',
          }
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

  // Backends this trigger should run on, based on the current target selection.
  const resolveTargets = () =>
    target === 'all' ? SCHEDULER_BACKENDS : SCHEDULER_BACKENDS.filter((b) => b.key === target);

  // Clicking a trigger opens the confirmation dialog first; it only runs on confirm.
  const handleAction = (action: string, actionName: string) => {
    setPendingAction({ action, name: actionName });
  };

  // Runs the confirmed trigger against the selected backend(s).
  const runAction = async (action: string, actionName: string) => {
    const fn = TRIGGERS[action];
    if (!fn) return;
    const targets = resolveTargets();

    setActionLoading(action);
    // Run against each selected backend independently so one failure doesn't
    // block the others (important for the "All backends" option).
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="mt-4 text-gray-600">Loading scheduler status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scheduler Management</h1>
        <p className="text-gray-600 mt-2">Manually trigger scheduled tasks and monitor system status</p>
      </div>

      {/* Backend target selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Run on backend</CardTitle>
          <CardDescription>
            Choose which backend deployment the triggers below run on, or run them on all three at once.
            Each backend runs its own scheduler.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
              All backends
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            {target === 'all' ? (
              SCHEDULER_BACKENDS.map((b) => (
                <div key={b.key}>
                  <span className="font-medium">{b.label}:</span>{' '}
                  <code className="bg-muted px-1 rounded">{b.url}</code>
                </div>
              ))
            ) : (
              <div>
                <span className="font-medium">{statusBackend.label}:</span>{' '}
                <code className="bg-muted px-1 rounded">{statusBackend.url}</code>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Scheduler Status
            <Badge variant="outline">{statusBackend.label}</Badge>
          </CardTitle>
          <CardDescription>
            Current state and next scheduled run for the {statusBackend.label} backend
            {target === 'all' ? ' (status is shown per backend; All runs triggers on every backend)' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Auto scheduler (cron):</span>
            <Badge variant={status?.autoEnabled ? 'default' : 'secondary'}>
              {status?.autoEnabled ? 'Enabled' : 'Paused'}
            </Badge>
          </div>

          {!status?.autoEnabled && (
            <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
              Set <code className="text-xs bg-muted px-1 rounded">SCHEDULER_AUTO_ENABLED=true</code> on the
              server and restart to resume daily runs. Manual triggers below still work.
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Cron jobs registered:</span>
            <Badge variant={status?.isScheduled ? 'default' : 'secondary'}>
              {status?.isScheduled ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Currently Running:</span>
            <Badge variant={status?.isRunning ? 'destructive' : 'outline'}>
              {status?.isRunning ? 'Yes' : 'No'}
            </Badge>
          </div>

          {status?.nextRun && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Next Run (UTC):</span>
              <span className="text-sm text-gray-600">
                {new Date(status.nextRun).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            </div>
          )}

          {status?.nextRunPST && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Next Run (PST):</span>
              <span className="text-sm text-gray-600">
                {new Date(status.nextRunPST.replace(' PST', '')).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZone: 'Asia/Karachi'
                })} PST
              </span>
            </div>
          )}

          {status?.nextBackupRun != null && status.nextBackupRun !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Next DB backup (UTC):</span>
              <span className="text-sm text-gray-600">
                {new Date(status.nextBackupRun).toLocaleString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZone: 'UTC'
                })}
              </span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            className="w-full"
          >
            Refresh Status
          </Button>
        </CardContent>
      </Card>

      {/* Session sync behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Session Sync Behavior</CardTitle>
          <CardDescription>
            Applies to scheduler sync and user troubleshoot. Changes are saved to all backends.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Auto-assign users to another session</p>
              <p className="text-xs text-muted-foreground">
                When OFF, users keep their current session — sync will not reassign them, and
                troubleshoot will only retry their assigned session.
              </p>
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
            <div>
              <p className="text-sm font-medium">Auto-update session proxies from external API</p>
              <p className="text-xs text-muted-foreground">
                When OFF, session proxy strings are never overwritten by sync or troubleshoot.
                Edit proxies only from the admin sessions page.
              </p>
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

      {/* Manual Trigger Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Session Sync
            </CardTitle>
            <CardDescription>
              Sync sessions from external API, create new sessions, update existing ones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleAction('sync', 'Session Sync')}
              disabled={actionLoading === 'sync'}
              className="w-full"
            >
              {actionLoading === 'sync' ? (
                <>
                  Syncing...
                </>
              ) : (
                <>
                  Trigger Sync
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Download Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Download Files
            </CardTitle>
            <CardDescription>
              Download ZIP files for all sessions and extract cookies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleAction('download', 'Download Files')}
              disabled={actionLoading === 'download'}
              className="w-full"
            >
              {actionLoading === 'download' ? (
                <>
                  Downloading...
                </>
              ) : (
                <>
                  Trigger Download
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Full Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Full Sync
            </CardTitle>
            <CardDescription>
              Complete sync: sessions + downloads + FreightDesk containers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleAction('full', 'Full Sync')}
              disabled={actionLoading === 'full'}
              className="w-full"
              variant="default"
            >
              {actionLoading === 'full' ? (
                <>
                  Running Full Sync...
                </>
              ) : (
                <>
                  Trigger Full Sync
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* FreightDesk Containers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              FreightDesk Containers
            </CardTitle>
            <CardDescription>
              Import all FD container sessions into cookie files (labels preserved on re-import)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleAction('freightdesk', 'FreightDesk Import')}
              disabled={actionLoading === 'freightdesk'}
              className="w-full"
              variant="outline"
            >
              {actionLoading === 'freightdesk' ? 'Importing FD Containers...' : 'Import FD Containers'}
            </Button>
          </CardContent>
        </Card>

        {/* Payment Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Payment Check
            </CardTitle>
            <CardDescription>
              Check for overdue payments and ban users if necessary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleAction('payments', 'Payment Check')}
              disabled={actionLoading === 'payments'}
              className="w-full"
              variant="outline"
            >
              {actionLoading === 'payments' ? (
                <>
                  Checking...
                </>
              ) : (
                <>
                Check Payments
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Referral Updates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Referral Updates
            </CardTitle>
            <CardDescription>
              Update referral discount statuses (runs monthly automatically)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleAction('referrals', 'Referral Updates')}
              disabled={actionLoading === 'referrals'}
              className="w-full"
              variant="outline"
            >
              {actionLoading === 'referrals' ? (
                <>
                  Updating...
                </>
              ) : (
                <>
                  Update Referrals
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Database backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Database backup
            </CardTitle>
            <CardDescription>
              Copy local database to the online backup target (payment proofs embedded as base64). Requires{' '}
              <code className="text-xs bg-muted px-1 rounded">MONGODB_BACKUP_TARGET_URI</code> on the API server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleAction('backup', 'Database backup')}
              disabled={actionLoading === 'backup'}
              className="w-full"
              variant="secondary"
            >
              {actionLoading === 'backup' ? (
                <>Backing up...</>
              ) : (
                <>Run database backup</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Automatic Schedule:</strong> Runs daily at 5:00 PM Pakistan Standard Time (12:00 PM UTC)
          </p>
          <p>
            <strong>Full Sync:</strong> Recommended for manual runs - syncs sessions and downloads files
          </p>
          <p>
            <strong>Payment Check:</strong> Only bans users for current month overdue payments
          </p>
          <p>
            <strong>Referral Updates:</strong> Runs automatically on the 1st of each month
          </p>
          <p>
            <strong>Database backup:</strong> Optional daily job when the server has an online MongoDB URI configured;
            manual run uses the same job as the CLI <code className="text-xs bg-muted px-1 rounded">scheduler:backup</code>.
          </p>
          <Separator />
          <p className="text-xs">
            All manual triggers run asynchronously. Check the server logs for detailed progress.
          </p>
        </CardContent>
      </Card>

      {/* Confirmation: asks whether to run on all backends or the selected one before triggering */}
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
