'use client';

import { useState, useEffect } from 'react';
import { updatesApi, type AppUpdateConfig } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Friendly display names for known app slugs (falls back to the slug).
const APP_LABELS: Record<string, string> = {
  'dat-go': 'DAT GO',
  'dat-hub': 'DAT Hub',
  horizon: 'Horizon',
};

export default function AppUpdatesPage() {
  const [configs, setConfigs] = useState<AppUpdateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingApp, setSavingApp] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await updatesApi.getConfig();
      setConfigs(res.data || []);
    } catch (error) {
      console.error('Error loading update config:', error);
      toast.error('Failed to load update settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleToggle = async (app: string, enabled: boolean) => {
    const label = APP_LABELS[app] || app;
    setSavingApp(app);
    // Optimistic update; revert on failure.
    setConfigs((prev) => prev.map((c) => (c.app === app ? { ...c, updatesEnabled: enabled } : c)));
    try {
      await updatesApi.setConfig(app, enabled);
      toast.success(`${label}: auto-updates ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      setConfigs((prev) => prev.map((c) => (c.app === app ? { ...c, updatesEnabled: !enabled } : c)));
      toast.error(`Failed to update ${label}: ${error.response?.data?.message || error.message}`);
    } finally {
      setSavingApp(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading update settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">App Auto-Updates</h1>
        <p className="text-gray-600 mt-2">
          Turn auto-updates on or off per app. When off, the update server stops offering updates and
          installed apps stay on their current version.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auto-update control</CardTitle>
          <CardDescription>
            Toggle each app on or off. Changes apply immediately and are shared across all backend
            servers (main, primary, backup, fallback).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configs.length === 0 && (
            <p className="text-sm text-muted-foreground">No apps found in the update server.</p>
          )}

          {configs.map((c) => (
            <div key={c.app} className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{APP_LABELS[c.app] || c.app}</span>
                  <Badge variant={c.updatesEnabled ? 'default' : 'secondary'}>
                    {c.updatesEnabled ? 'Updates ON' : 'Updates OFF'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  <code className="bg-muted px-1 rounded">{c.app}</code>
                </p>
              </div>
              <Switch
                checked={c.updatesEnabled}
                disabled={savingApp === c.app}
                onCheckedChange={(value) => handleToggle(c.app, value)}
                aria-label={`Toggle auto-updates for ${APP_LABELS[c.app] || c.app}`}
              />
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={fetchConfig} className="w-full">
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>
            <strong>ON:</strong> the update feed serves the latest installer; apps auto-update normally.
          </p>
          <p>
            <strong>OFF:</strong> the update feed reports the app as up-to-date, so installed apps stop
            downloading updates — no error, no install. Turn it back ON to resume.
          </p>
          <p className="text-xs">
            This setting is stored in the database and shared by every backend server, so it takes effect
            everywhere at once.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
