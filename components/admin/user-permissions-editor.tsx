'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usersApi, sessionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface DATSession {
  _id: string;
  name: string;
  proxy: string;
  isLoggedIn: boolean;
  userCounts: number;
  fileName: string | null;
}

interface UserPermissions {
  dataSessionId?: string | { _id: string; name: string; proxy: string };
  dashboard: boolean;
  searchTrucks: boolean;
  privateLoads: boolean;
  myLoads: boolean;
  privateNetwork: boolean;
  myTrucks: boolean;
  liveSupport: boolean;
  tools: boolean;
  sendFeedback: boolean;
  notifications: boolean;
  profile: boolean;
  sidebarDat: boolean;
  searchLoadsLaneRate: boolean;
  searchLoadsViewRoute: boolean;
  searchLoadsRateview: boolean;
  searchLoadsViewDirectory: boolean;
  // DAT Multitab Permissions (Phase 1)
  datMultitab: boolean;
  datMultitabNumbers: number;
  // Web Multitab Permissions (Phase 2)
  webMultitab: boolean;
  webMultitabNumbers: number;
  domain: string;
  domains: string[];
  // Platform Access Permissions
  desktop: boolean;
  mobile: boolean;
  extension: boolean;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  isBanned: boolean;
  isOnline: string | null;
  createdAt: string;
  permissions?: UserPermissions;
}

interface UserPermissionsEditorProps {
  user: User;
  onSave: (updatedUser: User) => void;
  onCancel: () => void;
}

export function UserPermissionsEditor({ user, onSave, onCancel }: UserPermissionsEditorProps) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<DATSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissions>({
    dataSessionId: (typeof user.permissions?.dataSessionId === 'object' && user.permissions?.dataSessionId?._id)
      ? String((user.permissions.dataSessionId as { _id: string })._id)
      : user.permissions?.dataSessionId,
    dashboard: user.permissions?.dashboard || false,
    searchTrucks: user.permissions?.searchTrucks || false,
    privateLoads: user.permissions?.privateLoads || false,
    myLoads: user.permissions?.myLoads || false,
    privateNetwork: user.permissions?.privateNetwork || false,
    myTrucks: user.permissions?.myTrucks || false,
    liveSupport: user.permissions?.liveSupport || false,
    tools: user.permissions?.tools || false,
    sendFeedback: user.permissions?.sendFeedback || false,
    notifications: user.permissions?.notifications || false,
    profile: user.permissions?.profile || false,
    sidebarDat: user.permissions?.sidebarDat || false,
    searchLoadsLaneRate: user.permissions?.searchLoadsLaneRate || false,
    searchLoadsViewRoute: user.permissions?.searchLoadsViewRoute || false,
    searchLoadsRateview: user.permissions?.searchLoadsRateview || false,
    searchLoadsViewDirectory: user.permissions?.searchLoadsViewDirectory || false,
    // DAT Multitab Permissions (Phase 1)
    datMultitab: user.permissions?.datMultitab || false,
    datMultitabNumbers: user.permissions?.datMultitabNumbers || 1,
    // Web Multitab Permissions (Phase 2)
    webMultitab: user.permissions?.webMultitab || false,
    webMultitabNumbers: user.permissions?.webMultitabNumbers || 1,
    domain: user.permissions?.domain || 'https://one.dat.com/search-loads-ow',
    domains: user.permissions?.domains || [],
    // Platform Access Permissions
    desktop: user.permissions?.desktop !== false, // Default to true
    mobile: user.permissions?.mobile !== false, // Default to true
    extension: user.permissions?.extension !== false, // Default to true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      const response = await sessionsApi.getAll({ limit: 1000 });
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await usersApi.update(user._id, { permissions });

      // Create updated user object for UI update
      const updatedUser: User = {
        ...user,
        permissions: response.permissions || permissions
      };

      toast({
        title: 'Success',
        description: 'User permissions updated successfully',
      });
      onSave(updatedUser);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update permissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = (key: keyof UserPermissions, value: any) => {
    setPermissions(prev => ({ ...prev, [key]: value }));
  };

  const featurePermissions = [
    { key: 'dashboard', label: 'Dashboard Access' },
    { key: 'searchTrucks', label: 'Search Trucks' },
    { key: 'privateLoads', label: 'Private Loads' },
    { key: 'myLoads', label: 'My Loads' },
    { key: 'privateNetwork', label: 'Private Network' },
    { key: 'myTrucks', label: 'My Trucks' },
    { key: 'liveSupport', label: 'Live Support' },
    { key: 'tools', label: 'Tools' },
    { key: 'sendFeedback', label: 'Send Feedback' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'profile', label: 'Profile Access' },
    { key: 'sidebarDat', label: 'Sidebar DAT' },
  ];

  const searchLoadPermissions = [
    { key: 'searchLoadsLaneRate', label: 'Lane Rate View' },
    { key: 'searchLoadsViewRoute', label: 'View Route' },
    { key: 'searchLoadsRateview', label: 'Rate View' },
    { key: 'searchLoadsViewDirectory', label: 'View Directory' },
  ];

  const platformPermissions = [
    { key: 'desktop', label: 'Desktop App' },
    { key: 'mobile', label: 'Mobile App' },
    { key: 'extension', label: 'Browser Extension' },
  ];

  return (
    <div className="bg-muted/20 p-4 rounded-lg border border-border">
      <div className="space-y-3">
        {/* Compact Header with Session and Domain */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label htmlFor="session" className="text-xs font-medium text-muted-foreground mb-1 block">DAT Session</Label>
            <Select
              value={permissions.dataSessionId ? String(permissions.dataSessionId) : 'none'}
              onValueChange={(value: string) => updatePermission('dataSessionId', value === 'none' ? undefined : value)}
              disabled={sessionsLoading}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder={sessionsLoading ? "Loading..." : "Select session"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No session</SelectItem>
                {sessions.map((session) => (
                  <SelectItem key={String(session._id)} value={String(session._id)}>
                    {session.name} ({session.userCounts} users)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="domain" className="text-xs font-medium text-muted-foreground mb-1 block">Domain</Label>
            <Input
              id="domain"
              value={permissions.domain}
              onChange={(e) => updatePermission('domain', e.target.value)}
              placeholder="https://one.dat.com/search-loads-ow"
              className="h-8 border-2 border-border bg-background"
            />
          </div>
        </div>

        {/* Feature Permissions - Compact Grid */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">Features</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {featurePermissions.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="text-xs text-foreground cursor-pointer">
                  {label.replace(' Access', '').replace('My ', '')}
                </Label>
                <Switch
                  id={key}
                  checked={permissions[key as keyof UserPermissions] as boolean}
                  onCheckedChange={(checked) => updatePermission(key as keyof UserPermissions, checked)}
                  className="scale-75"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Search Loads Permissions - Compact */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">Search Loads</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {searchLoadPermissions.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="text-xs text-foreground cursor-pointer">
                  {label.replace(' Support', '').replace('Lane Rate View', 'Lane Rate').replace('View Route', 'Route')}
                </Label>
                <Switch
                  id={key}
                  checked={permissions[key as keyof UserPermissions] as boolean}
                  onCheckedChange={(checked) => updatePermission(key as keyof UserPermissions, checked)}
                  className="scale-75"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Multitab Permissions - Phase 1 (DAT) and Phase 2 (Web) */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">Multitab Permissions</Label>
          <div className="space-y-3">
            {/* DAT Multitab (Phase 1) */}
            <div className="bg-muted/30 p-2 rounded border border-border/50">
              <Label className="text-xs font-semibold text-foreground mb-2 block">Phase 1: DAT Multitab</Label>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="datMultitab"
                    checked={permissions.datMultitab}
                    onCheckedChange={(checked) => updatePermission('datMultitab', checked)}
                    className="scale-75"
                  />
                  <Label htmlFor="datMultitab" className="text-xs text-foreground cursor-pointer">
                    Enable DAT Multitab
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="datMultitabNumbers" className="text-xs text-foreground">
                    Max Tabs:
                  </Label>
                  <Input
                    id="datMultitabNumbers"
                    type="number"
                    min="1"
                    max="10"
                    value={permissions.datMultitabNumbers}
                    onChange={(e) => updatePermission('datMultitabNumbers', parseInt(e.target.value) || 1)}
                    disabled={!permissions.datMultitab}
                    className="w-16 h-6 text-xs border-2 border-border bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Web Multitab (Phase 2) */}
            <div className="bg-muted/30 p-2 rounded border border-border/50">
              <Label className="text-xs font-semibold text-foreground mb-2 block">Phase 2: Web Multitab</Label>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="webMultitab"
                    checked={permissions.webMultitab}
                    onCheckedChange={(checked) => updatePermission('webMultitab', checked)}
                    className="scale-75"
                  />
                  <Label htmlFor="webMultitab" className="text-xs text-foreground cursor-pointer">
                    Enable Web Multitab
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="webMultitabNumbers" className="text-xs text-foreground">
                    Max Tabs:
                  </Label>
                  <Input
                    id="webMultitabNumbers"
                    type="number"
                    min="1"
                    max="10"
                    value={permissions.webMultitabNumbers}
                    onChange={(e) => updatePermission('webMultitabNumbers', parseInt(e.target.value) || 1)}
                    disabled={!permissions.webMultitab}
                    className="w-16 h-6 text-xs border-2 border-border bg-background"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Access Permissions */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">Platform Access</Label>
          <div className="grid grid-cols-3 gap-2">
            {platformPermissions.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="text-xs text-foreground cursor-pointer">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={permissions[key as keyof UserPermissions] as boolean}
                  onCheckedChange={(checked) => updatePermission(key as keyof UserPermissions, checked)}
                  className="scale-75"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons - Compact */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
