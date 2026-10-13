'use client';

type CustomTab = {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
  openMode: 'app' | 'external';
};

export type Permissions = {
  openDat: boolean;
  datMultitab: boolean;
  datMultitabNumbers: number;
  webMultitab: boolean;
  webMultitabNumbers: number;
  extensionsEnabled: boolean;
  proxyEnabled: boolean;
  maxEmailAccounts: number;
  maxTemplates: number;
  customTabs: CustomTab[];
};

export const defaultPermissions = (): Permissions => ({
  openDat: true,
  datMultitab: false,
  datMultitabNumbers: 1,
  webMultitab: false,
  webMultitabNumbers: 1,
  extensionsEnabled: true,
  proxyEnabled: true,
  maxEmailAccounts: 3,
  maxTemplates: 10,
  customTabs: []
});

type Props = {
  value: Permissions;
  onChange: (next: Permissions) => void;
};

function newTab(): CustomTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    url: 'https://',
    enabled: true,
    openMode: 'app'
  };
}

export default function PermissionsEditor({ value, onChange }: Props) {
  const set = (patch: Partial<Permissions>) => onChange({ ...value, ...patch });

  const updateTab = (id: string, patch: Partial<CustomTab>) => {
    onChange({
      ...value,
      customTabs: value.customTabs.map((t) => (t.id === id ? { ...t, ...patch } : t))
    });
  };

  const removeTab = (id: string) => {
    onChange({
      ...value,
      customTabs: value.customTabs.filter((t) => t.id !== id)
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-brand-700 font-semibold mb-2">
          Permissions
        </div>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={value.openDat}
            onChange={(e) => set({ openDat: e.target.checked })}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Allow Open DAT
        </label>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={value.proxyEnabled !== false}
            onChange={(e) => set({ proxyEnabled: e.target.checked })}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Allow proxy
        </label>
        <p className="mt-1 mb-2 text-[11px] text-slate-500">
          When off, this user never uses a proxy (assigned, global, or custom) — desktop apps open DAT
          with a direct connection.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.extensionsEnabled !== false}
            onChange={(e) => set({ extensionsEnabled: e.target.checked })}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Allow extensions
        </label>
        <p className="mt-1 text-[11px] text-slate-500">
          When off, Dat Desk / Horizon / Swift / Smart Dat will not load managed extensions (including DAT Email)
          for this user.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-white p-3 space-y-2">
          <div className="text-sm font-medium">Email accounts</div>
          <p className="text-[11px] text-slate-500">How many emails this user can send from</p>
          <label className="block text-[11px] text-slate-500">Max sending emails</label>
          <input
            type="number"
            min={0}
            max={100}
            value={value.maxEmailAccounts ?? 3}
            onChange={(e) => set({ maxEmailAccounts: Number(e.target.value) || 0 })}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <p className="text-[11px] text-slate-400">0 = unlimited. Lowering this disables extra inboxes. Open the user page to choose which stay enabled.</p>
        </div>

        <div className="rounded-lg border bg-white p-3 space-y-2">
          <div className="text-sm font-medium">Templates</div>
          <p className="text-[11px] text-slate-500">How many email templates this user can create</p>
          <label className="block text-[11px] text-slate-500">Max templates</label>
          <input
            type="number"
            min={0}
            max={100}
            value={value.maxTemplates ?? 10}
            onChange={(e) => set({ maxTemplates: Number(e.target.value) || 0 })}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <p className="text-[11px] text-slate-400">0 = unlimited. Editing an existing template is always allowed.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-white p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={value.datMultitab}
              onChange={(e) => set({ datMultitab: e.target.checked })}
            />
            DAT tabs
          </label>
          <p className="text-[11px] text-slate-500">Tabs inside DAT One UI</p>
          <label className="block text-[11px] text-slate-500">Max DAT tabs</label>
          <input
            type="number"
            min={1}
            max={10}
            disabled={!value.datMultitab}
            value={value.datMultitabNumbers}
            onChange={(e) => set({ datMultitabNumbers: Number(e.target.value) || 1 })}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="rounded-lg border bg-white p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={value.webMultitab}
              onChange={(e) => set({ webMultitab: e.target.checked })}
            />
            Web tabs
          </label>
          <p className="text-[11px] text-slate-500">Electron tabs in DAT window</p>
          <label className="block text-[11px] text-slate-500">Max web tabs</label>
          <input
            type="number"
            min={1}
            max={10}
            disabled={!value.webMultitab}
            value={value.webMultitabNumbers}
            onChange={(e) => set({ webMultitabNumbers: Number(e.target.value) || 1 })}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-brand-700 font-semibold">
              Custom in-app tabs
            </div>
            <p className="text-[11px] text-slate-500">Buttons shown on the desktop dashboard</p>
          </div>
          <button
            type="button"
            onClick={() => set({ customTabs: [...value.customTabs, newTab()] })}
            className="text-sm rounded-lg border px-2 py-1 hover:bg-white"
          >
            + Add tab
          </button>
        </div>

        <div className="space-y-2">
          {value.customTabs.map((tab) => (
            <div key={tab.id} className="rounded-lg border bg-white p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Title"
                  value={tab.title}
                  onChange={(e) => updateTab(tab.id, { title: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <select
                  value={tab.openMode}
                  onChange={(e) =>
                    updateTab(tab.id, { openMode: e.target.value as 'app' | 'external' })
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="app">Open in app</option>
                  <option value="external">Open external</option>
                </select>
              </div>
              <input
                placeholder="https://..."
                value={tab.url}
                onChange={(e) => updateTab(tab.id, { url: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-mono"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tab.enabled}
                    onChange={(e) => updateTab(tab.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <button
                  type="button"
                  onClick={() => removeTab(tab.id)}
                  className="text-sm text-red-600 underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {!value.customTabs.length ? (
            <p className="text-xs text-slate-400 text-center py-3">No custom tabs yet</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
