'use client';

import { useState, useEffect } from 'react';
import { schedulerApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface SchedulerStatus {
  isRunning: boolean;
  isScheduled: boolean;
  nextRun: string | null;
  nextRunPST: string | null;
  backupScheduled?: boolean;
  nextBackupRun?: string | null;
}

export default function SchedulerPage() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await schedulerApi.getStatus();
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
      toast.error('Failed to fetch scheduler status');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, actionName: string) => {
    setActionLoading(action);
    try {
      let response;
      switch (action) {
        case 'sync':
          response = await schedulerApi.triggerSync();
          break;
        case 'download':
          response = await schedulerApi.triggerDownload();
          break;
        case 'full':
          response = await schedulerApi.triggerFull();
          break;
        case 'payments':
          response = await schedulerApi.triggerPaymentCheck();
          break;
        case 'referrals':
          response = await schedulerApi.triggerReferralUpdate();
          break;
        case 'backup':
          response = await schedulerApi.triggerBackup();
          break;
        default:
          throw new Error('Unknown action');
      }

      if (action === 'backup' && response.data?.skipped) {
        toast.message('Database backup skipped', {
          description:
            response.data.reason === 'no-target-uri'
              ? 'Set MONGODB_BACKUP_TARGET_URI on the server.'
              : response.data.reason === 'target-same-as-primary' || response.data.reason === 'target-same-as-source'
                ? 'Backup target URI must differ from the source URI.'
                : response.data.reason === 'already-running'
                  ? 'A backup is already running.'
                  : (response.data.reason as string) || 'See server logs.',
        });
      } else {
        toast.success(`${actionName} completed successfully`);
      }

      // Show additional details if available
      if (response.data) {
        if (response.data.created !== undefined) {
          toast.info(`Sessions: ${response.data.created} created, ${response.data.updated} updated, ${response.data.deleted} deleted`);
        } else if (response.data.checked !== undefined) {
          toast.info(`Payments: ${response.data.checked} checked, ${response.data.banned} users banned`);
        } else if (response.data.updated !== undefined && action !== 'backup') {
          toast.info(`Referrals: ${response.data.updated} discount statuses updated`);
        } else if (response.data.collections && action === 'backup') {
          const entries = Object.entries(response.data.collections as Record<string, number>);
          const summary = entries.map(([k, v]) => `${k}: ${v}`).join(', ');
          toast.info(`Synced collections — ${summary}`);
        }
      }

      // Refresh status after action
      await fetchStatus();
    } catch (error: any) {
      console.error(`Error triggering ${action}:`, error);
      toast.error(`Failed to ${actionName.toLowerCase()}: ${error.response?.data?.message || error.message}`);
    } finally {
      setActionLoading(null);
    }
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

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Scheduler Status
          </CardTitle>
          <CardDescription>Current state and next scheduled run</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
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
              Complete sync: sessions + downloads (recommended for manual runs)
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
    </div>
  );
}
