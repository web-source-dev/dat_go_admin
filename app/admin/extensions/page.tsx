'use client';

import { useEffect, useState, useRef } from 'react';
import { Puzzle, Plus, Trash2, Upload, RefreshCw, MoreVertical } from 'lucide-react';
import { extensionsApi, type ManagedExtension } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<ManagedExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    version: '',
    description: '',
    enabled: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchExtensions = async () => {
    try {
      setLoading(true);
      const res = await extensionsApi.list();
      setExtensions(res.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load extensions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const resetUploadForm = () => {
    setFile(null);
    setForm({ name: '', slug: '', version: '', description: '', enabled: true });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Select a .zip file first');
      return;
    }

    setUploading(true);
    try {
      const res = await extensionsApi.upload(file, {
        name: form.name || undefined,
        slug: form.slug || undefined,
        version: form.version || undefined,
        description: form.description || undefined,
        enabled: form.enabled,
      });
      toast.success(res.message || 'Extension uploaded');
      setUploadOpen(false);
      resetUploadForm();
      await fetchExtensions();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = async (ext: ManagedExtension, enabled: boolean) => {
    setSavingId(ext._id);
    setExtensions((prev) => prev.map((e) => (e._id === ext._id ? { ...e, enabled } : e)));
    try {
      await extensionsApi.update(ext._id, { enabled });
      toast.success(`${ext.name}: ${enabled ? 'enabled' : 'disabled'} for desktop clients`);
    } catch (error: any) {
      setExtensions((prev) => prev.map((e) => (e._id === ext._id ? { ...e, enabled: !enabled } : e)));
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (ext: ManagedExtension) => {
    if (!confirm(`Delete extension "${ext.name}"? Horizon and DAT GO clients will stop loading it.`)) return;
    try {
      await extensionsApi.delete(ext._id);
      toast.success('Extension deleted');
      setExtensions((prev) => prev.filter((e) => e._id !== ext._id));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const onFileChange = (f: File | null) => {
    setFile(f);
    if (f && !form.name) {
      const base = f.name.replace(/\.zip$/i, '');
      setForm((prev) => ({ ...prev, name: prev.name || base }));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Puzzle className="h-8 w-8" />
            Horizon / DAT GO Extensions
          </h1>
          <p className="text-gray-600 mt-2 max-w-2xl">
            Upload Chromium extension ZIP packages (Signal, Foxy Proxy, or any unpacked
            extension). When enabled, Horizon and DAT GO desktop clients download and load
            them with Electron&apos;s <code className="text-xs bg-muted px-1 rounded">session.loadExtension()</code>.
            Re-uploading the same slug replaces the package.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={fetchExtensions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload ZIP
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading extensions...</p>
      ) : extensions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No extensions yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Upload an unpacked Chromium extension as a .zip (must include manifest.json).
          </p>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload ZIP
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {extensions.map((ext) => (
                <tr key={ext._id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{ext.name}</div>
                    {ext.description ? (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ext.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{ext.slug}</code>
                  </td>
                  <td className="px-4 py-3">{ext.version}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatBytes(ext.fileSize)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={ext.enabled ? 'default' : 'secondary'}>
                        {ext.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Switch
                        checked={ext.enabled}
                        disabled={savingId === ext._id}
                        onCheckedChange={(v) => handleToggle(ext, v)}
                        aria-label={`Toggle ${ext.name}`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(ext)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Package requirements</p>
        <p>ZIP must contain a Chromium extension with <code className="bg-muted px-1 rounded">manifest.json</code> (MV2 or MV3).</p>
        <p>Chrome Web Store IDs alone will not install — you need the extension files.</p>
        <p>
          Horizon shows each enabled extension as a toolbar icon (like Chrome). Click opens
          the extension popup; right-click opens options when available.
        </p>
        <p>Enabled packages are fetched by Horizon and DAT GO after login and loaded into each DAT session partition.</p>
        <p>
          Google sign-in (Signal / Gmail OAuth) opens in installed Chrome or Edge because
          Google blocks Electron&apos;s embedded Chromium.
        </p>
      </div>

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) resetUploadForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload extension ZIP</DialogTitle>
            <DialogDescription>
              Select a .zip of an unpacked Chromium extension. Same slug replaces the existing package.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ext-file">ZIP file</Label>
              <Input
                id="ext-file"
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-name">Name (optional)</Label>
              <Input
                id="ext-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="From manifest if omitted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-slug">Slug (optional)</Label>
              <Input
                id="ext-slug"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="Derived from name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-version">Version (optional)</Label>
              <Input
                id="ext-version"
                value={form.version}
                onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
                placeholder="From manifest if omitted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-desc">Description</Label>
              <Textarea
                id="ext-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ext-enabled">Enable for Horizon immediately</Label>
              <Switch
                id="ext-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
