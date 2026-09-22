'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usersApi, sessionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { User, DATSession } from '@/lib/types';


interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onRefresh: () => void;
}


export function AddUserDialog({ open, onClose, onSuccess, onRefresh }: AddUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<DATSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    dataSessionId: '',
    monthlyPaymentAmount: '',
    billingDate: '',
    referralCode: '',
    plan: 'single' as 'single' | 'double' | 'multi',
    sessionOpenMode: 'zip' as 'zip' | 'cookie',
    label: '',
    anydeskid: '',
    phone: '',
    note: '',
    isTrial: false,
    trialDurationHours: '1',
    signalEnabled: false,
  });
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSessions();
      fetchAvailableLabels();
    }
  }, [open]);

  const fetchAvailableLabels = async () => {
    try {
      const data = await usersApi.getAvailableLabels();
      setAvailableLabels(data.labels || []);
    } catch (error) {
      console.error('Failed to fetch available labels:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      // Get all sessions without pagination for the dropdown
      const response = await sessionsApi.getAll({ limit: 1000 });
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive',
      });
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Prepare user data
    const userData: any = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      monthlyPaymentAmount: formData.monthlyPaymentAmount ? parseFloat(formData.monthlyPaymentAmount) : 0,
      billingDate: formData.billingDate ? parseInt(formData.billingDate) : new Date().getDate(),
      referralCode: formData.referralCode.trim() || undefined,
      plan: formData.plan,
      sessionOpenMode: formData.sessionOpenMode,
      label: formData.label.trim() || undefined,
      anydeskid: formData.anydeskid.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      note: formData.note.trim() || undefined,
      isTrial: formData.isTrial,
      trialDurationHours: formData.isTrial ? parseFloat(formData.trialDurationHours) : undefined,
      signalEnabled: formData.signalEnabled,
    };

    // Add permissions if session is selected
    if (formData.dataSessionId && formData.dataSessionId !== 'none') {
      userData.permissions = {
        dataSessionId: formData.dataSessionId,
        // Set default permissions for new users
        dashboard: true,
        searchTrucks: false,
        privateLoads: false,
        myLoads: false,
        privateNetwork: false,
        myTrucks: false,
        liveSupport: false,
        tools: false,
        sendFeedback: false,
        notifications: false,
        profile: true,
        searchLoadsLaneRate: false,
        searchLoadsViewRoute: false,
        searchLoadsRateview: false,
        searchLoadsViewDirectory: false,
        // DAT Multitab Permissions (Phase 1)
        datMultitab: false,
        datMultitabNumbers: 1,
        // Web Multitab Permissions (Phase 2)
        webMultitab: false,
        webMultitabNumbers: 1,
        // Platform Access Permissions
        desktop: true,
        mobile: true,
        extension: true,
        domain: 'https://one.dat.com/search-loads-ow',
        domains: [],
      };
    }

    setLoading(true);
    try {
      const response = await usersApi.create(userData);

      // Create user object for UI update
      const newUser: User = {
        _id: response._id,
        name: response.name,
        email: response.email,
        role: response.role,
        isBanned: response.isBanned || false,
        isOnline: response.isOnline || null,
        createdAt: response.createdAt,
        permissions: response.permissions || {
          dataSessionId: formData.dataSessionId && formData.dataSessionId !== 'none' ? formData.dataSessionId : undefined,
          dashboard: true,
          searchTrucks: false,
          privateLoads: false,
          myLoads: false,
          privateNetwork: false,
          myTrucks: false,
          liveSupport: false,
          tools: false,
          sendFeedback: false,
          notifications: false,
          profile: true,
          searchLoadsLaneRate: false,
          searchLoadsViewRoute: false,
          searchLoadsRateview: false,
          searchLoadsViewDirectory: false,
          // DAT Multitab Permissions (Phase 1)
          datMultitab: false,
          datMultitabNumbers: 1,
          // Web Multitab Permissions (Phase 2)
          webMultitab: false,
          webMultitabNumbers: 1,
          // Platform Access Permissions
          desktop: true,
          mobile: true,
          extension: true,
          domain: 'https://one.dat.com/search-loads-ow',
          domains: []
        }
      };

      toast({
        title: 'Success',
        description: 'User created successfully',
      });
      onSuccess(newUser);
      onClose();
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        dataSessionId: '',
        monthlyPaymentAmount: '',
        billingDate: '',
        referralCode: '',
        plan: 'single',
        sessionOpenMode: 'zip',
        label: '',
        anydeskid: '',
        phone: '',
        note: '',
        isTrial: false,
        trialDurationHours: '1',
        signalEnabled: false,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setFormData({
        name: '',
        email: '',
        password: '',
        dataSessionId: '',
        monthlyPaymentAmount: '',
        billingDate: '',
        referralCode: '',
        plan: 'single',
        sessionOpenMode: 'zip',
        label: '',
        anydeskid: '',
        phone: '',
        note: '',
        isTrial: false,
        trialDurationHours: '1',
        signalEnabled: false,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with the specified details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingDate">Billing Date</Label>
                <Input
                  id="billingDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder={new Date().getDate().toString()}
                  value={formData.billingDate}
                  onChange={(e) => setFormData({ ...formData, billingDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Day of month when billing occurs (1-31). Defaults to creation date.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralCode">Referral Code (Optional)</Label>
                <Input
                  id="referralCode"
                  type="text"
                  placeholder="Enter referral code"
                  value={formData.referralCode}
                  onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                />
                <p className="text-xs text-muted-foreground">
                  Referral code from another user. Can only be used once and must be from a user created before you.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="session">DAT Session (Optional)</Label>
                <Select
                  value={formData.dataSessionId ? String(formData.dataSessionId) : 'none'}
                  onValueChange={(value: string) => setFormData({ ...formData, dataSessionId: value === 'none' ? '' : value })}
                  disabled={sessionsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={sessionsLoading ? "Loading sessions..." : "Select session"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No session assigned</SelectItem>
                    {sessions.map((session) => (
                      <SelectItem key={String(session._id)} value={String(session._id)}>
                        {session.name} ({session.userCounts} users)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assign a DAT session to enable user permissions and features
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Label (Optional)</Label>
                <Input
                  id="label"
                  type="text"
                  placeholder="Enter label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  list="available-labels"
                />
                <datalist id="available-labels">
                  <option value="test" />
                  <option value="swiftSolutions" />
                  <option value="horizon" />
                  {availableLabels
                    .filter((label) => label !== 'test' && label !== 'swiftSolutions' && label !== 'horizon')
                    .map((label) => (
                      <option key={label} value={label} />
                    ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Use label <code>test</code> for test-cookie users, <code>swiftSolutions</code> for Swift, or{' '}
                  <code>horizon</code> for Horizon users with their own cookie channel.
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyPaymentAmount">Monthly Payment Amount (PKR)</Label>
                <Input
                  id="monthlyPaymentAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.monthlyPaymentAmount}
                  onChange={(e) => setFormData({ ...formData, monthlyPaymentAmount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Monthly subscription amount in Pakistani Rupees. Leave empty for no payment required.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Plan *</Label>
                <Select
                  value={formData.plan}
                  onValueChange={(value: 'single' | 'double' | 'multi') => setFormData({ ...formData, plan: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="multi">Multi</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  User plan type (single/double/multi)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionOpenMode">DAT Session Open Mode *</Label>
                <Select
                  value={formData.sessionOpenMode}
                  onValueChange={(value: 'zip' | 'cookie') => setFormData({ ...formData, sessionOpenMode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zip">ZIP (profile session)</SelectItem>
                    <SelectItem value="cookie">Cookie file</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  ZIP uses the assigned session profile. Cookie uses the active cookie for this user&apos;s plan/label (single/double/multi, or test/swiftSolutions/horizon labels).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anydeskid">AnyDesk ID (Optional)</Label>
                <Input
                  id="anydeskid"
                  type="text"
                  placeholder="Enter AnyDesk ID"
                  value={formData.anydeskid}
                  onChange={(e) => setFormData({ ...formData, anydeskid: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  AnyDesk ID for remote support access
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Contact phone number for the user
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (Optional)</Label>
                <Input
                  id="note"
                  type="text"
                  placeholder="Enter additional notes"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Additional information about the user
                </p>
              </div>

              <div className="space-y-2 border-t pt-4 mt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isTrial"
                    checked={formData.isTrial}
                    onChange={(e) => setFormData({ ...formData, isTrial: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="isTrial" className="font-medium">Trial Account</Label>
                </div>
                {formData.isTrial && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="trialDurationHours">Trial Duration (Hours)</Label>
                    <Select
                      value={formData.trialDurationHours}
                      onValueChange={(value: string) => setFormData({ ...formData, trialDurationHours: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.5">30 Minutes</SelectItem>
                        <SelectItem value="1">1 Hour</SelectItem>
                        <SelectItem value="2">2 Hours</SelectItem>
                        <SelectItem value="4">4 Hours</SelectItem>
                        <SelectItem value="8">8 Hours</SelectItem>
                        <SelectItem value="12">12 Hours</SelectItem>
                        <SelectItem value="24">24 Hours (1 Day)</SelectItem>
                        <SelectItem value="48">48 Hours (2 Days)</SelectItem>
                        <SelectItem value="72">72 Hours (3 Days)</SelectItem>
                        <SelectItem value="168">168 Hours (1 Week)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Trial period duration. Account will be automatically disabled after expiration.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t pt-4 mt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="signalEnabled"
                    checked={formData.signalEnabled}
                    onChange={(e) => setFormData({ ...formData, signalEnabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="signalEnabled" className="font-medium">Enable Signal extension</Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  When enabled, this user can sign in to the Signal browser extension. Accounts are created in Dat Go only — there is no self-signup.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
