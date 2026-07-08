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


interface EditUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onRefresh: () => void;
  user: User | null;
}

export function EditUserDialog({ open, onClose, onSuccess, onRefresh, user }: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<DATSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    dataSessionId: '',
    monthlyPaymentAmount: '',
    billingDate: '',
    plan: 'single' as 'single' | 'double' | 'multi',
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

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        dataSessionId: (typeof user.permissions?.dataSessionId === 'object' && user.permissions?.dataSessionId?._id)
          ? String((user.permissions.dataSessionId as { _id: string })._id)
          : String(user.permissions?.dataSessionId || ''),
        monthlyPaymentAmount: user.monthlyPaymentAmount?.toString() || '',
        billingDate: user.billingDate?.toString() || '',
        plan: user.plan || 'single',
        label: user.label || '',
        anydeskid: user.anydeskid || '',
        phone: user.phone || '',
        note: user.note || '',
        isTrial: user.isTrial || false,
        trialDurationHours: user.trialDurationHours?.toString() || '1',
        signalEnabled: user.signalEnabled === true,
      });
    }
  }, [user]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!formData.name || !formData.email) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Update basic user info
      const userUpdateData: any = {
        name: formData.name,
        email: formData.email,
        monthlyPaymentAmount: formData.monthlyPaymentAmount ? parseFloat(formData.monthlyPaymentAmount) : 0,
        billingDate: formData.billingDate ? parseInt(formData.billingDate) : undefined,
        plan: formData.plan,
        label: formData.label.trim() || undefined,
        anydeskid: formData.anydeskid.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        note: formData.note.trim() || undefined,
        isTrial: formData.isTrial,
        trialDurationHours: formData.isTrial ? parseFloat(formData.trialDurationHours) : undefined,
        signalEnabled: formData.signalEnabled,
      };

      // If session assignment changed, update permissions
      if (formData.dataSessionId !== (user.permissions?.dataSessionId || '')) {
        userUpdateData.permissions = {
          dataSessionId: formData.dataSessionId || undefined,
        };
      }

      const response = await usersApi.update(user._id, userUpdateData);

      // Create updated user object for UI update
      const updatedUser: User = {
        ...user,
        name: response.name || user.name,
        email: response.email || user.email,
        permissions: response.permissions || user.permissions,
        plan: (response as any).plan || user.plan || 'single',
        phone: (response as any).phone ?? user.phone,
        note: (response as any).note ?? user.note,
      };

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
      onSuccess(updatedUser);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and role.
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
                <Label htmlFor="billingDate">Billing Date</Label>
                <Input
                  id="billingDate"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Day of month"
                  value={formData.billingDate}
                  onChange={(e) => setFormData({ ...formData, billingDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Day of month when billing occurs (1-31).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="session">DAT Session</Label>
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
                  Change the DAT session assignment for this user
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
                  list="available-labels-edit"
                />
                <datalist id="available-labels-edit">
                  {availableLabels.map((label) => (
                    <option key={label} value={label} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Categorize user with a label (e.g., VIP, Premium, etc.)
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
                  Monthly subscription amount in Pakistani Rupees. Set to 0 for no payment required.
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
                    {user?.trialEndDate && (
                      <p className="text-xs text-blue-600">
                        Current trial ends: {new Date(user.trialEndDate).toLocaleString()}
                      </p>
                    )}
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
                  Controls whether this user can sign in to the Signal browser extension.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
