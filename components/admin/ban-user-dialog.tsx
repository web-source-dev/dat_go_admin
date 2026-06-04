'use client';

import { useState } from 'react';
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
import { usersApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  isBanned: boolean;
  isOnline: string | null;
  createdAt: string;
}

interface BanUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (userId: string, isBanned: boolean) => void;
  user: User | null;
}

export function BanUserDialog({ open, onClose, onSuccess, user }: BanUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleBanToggle = async () => {
    if (!user) return;

    const action = user.isBanned ? 'unban' : 'ban';
    setLoading(true);
    try {
      await usersApi.update(user._id, { isBanned: !user.isBanned });
      toast({
        title: 'Success',
        description: `User ${action}ned successfully`,
      });
      onSuccess(user._id, !user.isBanned);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || `Failed to ${action} user`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const actionText = user?.isBanned ? 'Unban' : 'Ban';
  const actionDescription = user?.isBanned ? 'unban' : 'ban';

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{actionText} User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {actionDescription.toLowerCase()} <strong>{user?.name}</strong> ({user?.email})?
            {user?.isBanned
              ? ' This will restore their access to the system.'
              : ' This will prevent them from logging in and accessing the system.'
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBanToggle}
            disabled={loading}
            className={user?.isBanned ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
          >
            {loading ? `${actionText}ning...` : `${actionText} User`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
