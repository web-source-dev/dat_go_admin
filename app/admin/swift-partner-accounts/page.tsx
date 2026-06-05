'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cookiesApi } from '@/lib/api';
import type {
  PartnerSwiftCookieOption,
  PartnerSwiftDashboardConfig,
} from '@/lib/types';

export default function SwiftPartnerAccountsPage() {
  const [config, setConfig] = useState<PartnerSwiftDashboardConfig | null>(null);
  const [manualEnabled, setManualEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staleRemoved, setStaleRemoved] = useState<PartnerSwiftDashboardConfig['staleRemoved']>([]);

  const applyConfig = (data: PartnerSwiftDashboardConfig, notifyPrune = false) => {
    setConfig(data);
    setManualEnabled(Boolean(data.manualSelectionEnabled));
    setSelectedIds(data.selectedCookieIds || []);
    setStaleRemoved(data.staleRemoved || []);

    if (notifyPrune && data.selectionPruned && (data.staleRemoved?.length ?? 0) > 0) {
      const count = data.staleRemoved!.length;
      toast.warning(
        `Removed ${count} stale account${count === 1 ? '' : 's'} from selection (deleted or empty after sync).`
      );
    } else if (notifyPrune && data.message && data.selectionPruned) {
      toast.warning(data.message);
    }
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cookiesApi.getPartnerSwiftDashboardConfig();
      applyConfig(data, true);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || err.message || 'Failed to load Swift partner config'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const slotLimit = config?.slotLimit ?? 6;
  const cookieById = new Map(
    (config?.availableCookies || []).map((c) => [c._id, c])
  );
  const resolvedSelected = selectedIds
    .map((id) => cookieById.get(id))
    .filter((c): c is PartnerSwiftCookieOption => Boolean(c));
  const missingSelectedIds = selectedIds.filter((id) => !cookieById.has(id));
  const validSelectedCount = resolvedSelected.length;

  const toggleCookie = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (next.length === 0) {
          setManualEnabled(false);
        }
        return next;
      }
      if (prev.length >= slotLimit) {
        toast.error(`You can select at most ${slotLimit} accounts`);
        return prev;
      }
      setManualEnabled(true);
      return [...prev, id];
    });
  };

  const moveCookie = (index: number, direction: -1 | 1) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.length > 0 && !manualEnabled) {
      setManualEnabled(true);
    }

    setSaving(true);
    try {
      const data = await cookiesApi.updatePartnerSwiftDashboardConfig({
        manualSelectionEnabled:
          selectedIds.length > 0 ? true : manualEnabled,
        selectedCookieIds: selectedIds,
      });
      applyConfig(data);
      toast.success(data.message || 'Swift partner dashboard config saved');
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || err.message || 'Failed to save config'
      );
    } finally {
      setSaving(false);
    }
  };

  const renderCookieRow = (cookie: PartnerSwiftCookieOption, selectedIndex?: number) => {
    const isSelected = selectedIndex !== undefined;
    const slot = isSelected ? selectedIndex + 1 : null;

    return (
      <div
        key={cookie._id}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
          isSelected
            ? 'border-primary/40 bg-primary/5'
            : 'border-border bg-card hover:border-border/80'
        }`}
      >
        <button
          type="button"
          onClick={() => toggleCookie(cookie._id)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={isSelected ? 'Remove from dashboard' : 'Add to dashboard'}
        >
          {isSelected ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">
            {cookie.sessionName || cookie.fileName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {cookie.fileName}
            {cookie.label ? ` · ${cookie.label}` : ''}
          </p>
        </div>

        {isSelected && slot !== null && (
          <span className="text-xs font-semibold text-primary shrink-0">
            Slot {slot}
          </span>
        )}

        {!cookie.ready && (
          <span className="text-xs text-amber-600 shrink-0">Not ready</span>
        )}

        {cookie.isActiveSwiftSolutions && (
          <span className="text-xs text-emerald-600 shrink-0">Live</span>
        )}

        {isSelected && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={selectedIndex === 0}
              onClick={() => moveCookie(selectedIndex!, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={selectedIndex === selectedIds.length - 1}
              onClick={() => moveCookie(selectedIndex!, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Swift Partner Accounts</h1>
          </div>
          <p className="text-muted-foreground">
            Choose which extension accounts appear on the Swift Solutions partner
            dashboard (max {slotLimit}). Order controls Account 1, Account 2, etc.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadConfig} disabled={loading || saving}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 mb-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Manual account selection</p>
            <p className="text-sm text-muted-foreground mt-1">
              {manualEnabled
                ? 'Only the accounts you select below are shown on the partner dashboard.'
                : 'Automatic mode uses session name filters (e.g. aneeq, avva) and shows up to 6 accounts.'}
            </p>
          </div>
          <Switch checked={manualEnabled} onCheckedChange={setManualEnabled} />
        </div>

        {missingSelectedIds.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              {missingSelectedIds.length} selected ID{missingSelectedIds.length === 1 ? '' : 's'} not
              found — click Refresh to clean up, then re-add accounts if needed.
            </p>
          </div>
        )}

        {staleRemoved && staleRemoved.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                {staleRemoved.length} saved account{staleRemoved.length === 1 ? '' : 's'} no longer exist
              </p>
              <p className="text-muted-foreground mt-1">
                These were removed from the database during sync or lost cookie data. They were
                cleaned from your selection automatically. Add replacements from the list on the
                right, then Save.
              </p>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                {staleRemoved.map((entry) => (
                  <li key={entry.id}>
                    <code className="bg-muted px-1 rounded">{entry.id}</code>
                    {entry.sessionName || entry.fileName
                      ? ` — ${entry.sessionName || entry.fileName}`
                      : ''}
                    {' '}
                    ({entry.reason === 'deleted' ? 'deleted' : 'no cookie data'})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {config && (
          <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm">
            <span className="font-medium">Partner preview: </span>
            {manualEnabled
              ? `${validSelectedCount} of ${slotLimit} slots active`
              : `${config.previewAccountCount} account(s) in automatic mode`}
            {config.previewAccounts.length > 0 && (
              <span className="text-muted-foreground">
                {' '}
                — {config.previewAccounts.map((a) => a.displayName).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Selected for dashboard ({validSelectedCount}/{slotLimit})
            </h2>
            {validSelectedCount === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center">
                {manualEnabled
                  ? 'No accounts selected. The partner dashboard will be empty until you pick accounts.'
                  : 'Enable manual selection to choose accounts. In automatic mode, accounts are picked by server rules.'}
              </p>
            ) : (
              resolvedSelected.map((cookie, index) => renderCookieRow(cookie, index))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Available cookie files</h2>
            <p className="text-sm text-muted-foreground">
              Click a row to add or remove it from the partner dashboard.
            </p>
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {(config?.availableCookies || []).map((cookie) =>
                selectedIds.includes(cookie._id)
                  ? null
                  : renderCookieRow(cookie)
              )}
              {(config?.availableCookies || []).length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
                  No cookie files with data found. Upload cookies first.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
