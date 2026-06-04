'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { api, paymentsApi } from '@/lib/api';
import { Payment, User } from '@/lib/types';
import { CheckCircle, Clock, AlertCircle, Coins, RotateCcw, Undo2, ChevronDown, Image as ImageIcon, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface UserPaymentsEditorProps {
  user: User;
  onClose: () => void;
}

export function UserPaymentsEditor({ user, onClose }: UserPaymentsEditorProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [notes, setNotes] = useState('');
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [refundNotes, setRefundNotes] = useState('');
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [proofBlobUrls, setProofBlobUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchUserPayments();
  }, [user._id]);

  useEffect(() => {
    return () => {
      Object.values(proofBlobUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [proofBlobUrls]);

  const fetchUserPayments = async () => {
    try {
      setLoading(true);
      const response = await paymentsApi.getUserPayments(user._id, { limit: 24 }); // Last 2 years
      const list = response.payments || [];
      setPayments(list);
      await preloadProofImages(list);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load payment history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const preloadProofImages = async (items: Payment[]) => {
    const paymentsWithProof = items.filter((p) => !!p.paymentProofImagePath && !!p._id);
    if (paymentsWithProof.length === 0) {
      setProofBlobUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
      return;
    }

    const entries = await Promise.all(
      paymentsWithProof.map(async (p) => {
        try {
          const response = await api.get(`/payment/${p._id}/proof-image`, {
            responseType: 'blob',
          });
          const blobUrl = URL.createObjectURL(response.data);
          return [p._id, blobUrl] as const;
        } catch {
          return [p._id, ''] as const;
        }
      })
    );

    setProofBlobUrls((prev) => {
      Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
      const next: Record<string, string> = {};
      entries.forEach(([id, url]) => {
        if (url) next[id] = url;
      });
      return next;
    });
  };

  const handleMarkAsPaid = async (payment: Payment) => {
    setSelectedPayment(payment);
    setNotes('');
    setProofImage(null);
    setShowNotesDialog(true);
  };

  const handleUploadProofOnly = async (payment: Payment, file: File) => {
    setUpdatingPaymentId(payment._id);
    try {
      await paymentsApi.uploadProofImage(payment._id, file);
      await fetchUserPayments();
      toast({
        title: 'Success',
        description: 'Payment proof uploaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to upload payment proof',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const confirmMarkAsPaid = async () => {
    if (!selectedPayment) return;

    // Validate that notes are provided
    if (!notes.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide notes when marking payment as paid',
        variant: 'destructive',
      });
      return;
    }

    const hasExistingProof = !!selectedPayment.paymentProofImagePath;
    if (!hasExistingProof && !proofImage) {
      toast({
        title: 'Error',
        description: 'Please upload payment screenshot/proof image before marking as paid',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingPaymentId(selectedPayment._id);
    try {
      if (proofImage) {
        await paymentsApi.uploadProofImage(selectedPayment._id, proofImage);
      }
      await paymentsApi.updateStatus(selectedPayment._id, 'paid', notes.trim());
      await fetchUserPayments();

      toast({
        title: 'Success',
        description: 'Payment marked as paid',
      });

      setShowNotesDialog(false);
      setSelectedPayment(null);
      setNotes('');
      setProofImage(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update payment',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const getPaymentProofImageUrl = (payment: Payment) => {
    if (!payment?._id) return null;
    return proofBlobUrls[payment._id] || null;
  };

  const handleRefund = async (payment: Payment) => {
    setSelectedPayment(payment);
    setRefundNotes('');
    setShowRefundDialog(true);
  };

  const confirmRefund = async () => {
    if (!selectedPayment) return;

    setUpdatingPaymentId(selectedPayment._id);
    try {
      await paymentsApi.refund(selectedPayment._id, refundNotes.trim() || undefined);

      // Refresh payments to get updated data
      await fetchUserPayments();

      toast({
        title: 'Success',
        description: 'Payment refunded successfully',
      });

      setShowRefundDialog(false);
      setSelectedPayment(null);
      setRefundNotes('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to refund payment',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const handleCancelRefund = async (payment: Payment) => {
    setUpdatingPaymentId(payment._id);
    try {
      await paymentsApi.cancelRefund(payment._id);

      // Refresh payments to get updated data
      await fetchUserPayments();

      toast({
        title: 'Success',
        description: 'Refund cancelled successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to cancel refund',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const getStatusBadge = (status: string, dueDate: string, isRefunded?: boolean) => {
    const isOverdue = new Date(dueDate) < new Date() && status === 'pending';

    if (isRefunded) {
      return <Badge className="bg-orange-500 text-white"><RotateCcw size={12} className="mr-1" />Refunded</Badge>;
    }

    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500 text-white"><CheckCircle size={12} className="mr-1" />Paid</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500 text-white"><CheckCircle size={12} className="mr-1" />Approved</Badge>;
      case 'pending':
        return isOverdue ? (
          <Badge variant="destructive"><AlertCircle size={12} className="mr-1" />Overdue</Badge>
        ) : (
          <Badge variant="secondary"><Clock size={12} className="mr-1" />Pending</Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleMarkCommissionPaid = async (paymentId: string) => {
    setUpdatingPaymentId(paymentId);
    try {
      await paymentsApi.markCommissionPaid(paymentId, true);

      // Update local state
      setPayments(prev => prev.map(p =>
        p._id === paymentId
          ? { ...p, salespersonCommissionPaid: true }
          : p
      ));

      toast({
        title: 'Success',
        description: 'Salesperson commission marked as paid',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to mark commission as paid',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const formatMonthYear = (month: number, year: number) => {
    return `${getMonthName(month)} ${year}`;
  };

  const formatCurrency = (amount: number) => {
    return `RS ${amount?.toLocaleString('en-PK') || '0'}`;
  };

  const formatShortDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="bg-muted/20 p-4 rounded-lg border border-border">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-muted-foreground">Loading payment history...</span>
        </div>
      </div>
    );
  }

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const overduePayments = payments.filter(p =>
    p.status === 'pending' && new Date(p.dueDate) < new Date()
  );

  // Find current and previous month payments
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = currentYear - 1;
  }

  const currentMonthPayment = payments.find(
    (p) => p.month === currentMonth && p.year === currentYear
  );
  const previousMonthPayment = payments.find(
    (p) => p.month === prevMonth && p.year === prevYear
  );

  return (
    <div className="bg-muted/20 p-4 rounded-lg border border-border">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Payment History</h3>
            <p className="text-xs text-muted-foreground">
              Monthly payment: RS {user.monthlyPaymentAmount || 0} • Billing day: {user.billingDate || 'N/A'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-3">
          {/* Current Month Payment */}
          <div className="bg-background p-3 rounded border">
            <div className="flex items-center gap-2 mb-1">
              <Coins size={16} className="text-blue-500" />
              <span className="text-xs font-medium">Current Month</span>
            </div>
            {currentMonthPayment ? (
              <>
                <p className="text-xs font-medium text-foreground mb-1">
                  {formatMonthYear(currentMonthPayment.month, currentMonthPayment.year)}
                </p>
                <p className={`text-lg font-bold ${
                  currentMonthPayment.status === 'paid' && !currentMonthPayment.isRefunded 
                    ? 'text-green-600' 
                    : currentMonthPayment.isRefunded 
                    ? 'text-orange-600' 
                    : 'text-red-600'
                }`}>
                  {formatCurrency(currentMonthPayment.amount)}
                </p>
                <p className={`text-xs mt-0.5 ${
                  currentMonthPayment.status === 'paid' && !currentMonthPayment.isRefunded 
                    ? 'text-green-600' 
                    : currentMonthPayment.isRefunded 
                    ? 'text-orange-600' 
                    : 'text-red-600'
                }`}>
                  {currentMonthPayment.isRefunded ? 'Refunded' : currentMonthPayment.status === 'paid' ? 'Paid' : 'Pending'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Due {formatShortDate(currentMonthPayment.dueDate)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No payment</p>
            )}
          </div>

          {/* Previous Month Payment */}
          <div className="bg-background p-3 rounded border">
            <div className="flex items-center gap-2 mb-1">
              <Coins size={16} className="text-purple-500" />
              <span className="text-xs font-medium">Previous Month</span>
            </div>
            {previousMonthPayment ? (
              <>
                <p className="text-xs font-medium text-foreground mb-1">
                  {formatMonthYear(previousMonthPayment.month, previousMonthPayment.year)}
                </p>
                <p className={`text-lg font-bold ${
                  previousMonthPayment.status === 'paid' && !previousMonthPayment.isRefunded 
                    ? 'text-green-600' 
                    : previousMonthPayment.isRefunded 
                    ? 'text-orange-600' 
                    : 'text-red-600'
                }`}>
                  {formatCurrency(previousMonthPayment.amount)}
                </p>
                <p className={`text-xs mt-0.5 ${
                  previousMonthPayment.status === 'paid' && !previousMonthPayment.isRefunded 
                    ? 'text-green-600' 
                    : previousMonthPayment.isRefunded 
                    ? 'text-orange-600' 
                    : 'text-red-600'
                }`}>
                  {previousMonthPayment.isRefunded ? 'Refunded' : previousMonthPayment.status === 'paid' ? 'Paid' : 'Pending'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Due {formatShortDate(previousMonthPayment.dueDate)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No payment</p>
            )}
          </div>

          {/* Pending */}
          <div className="bg-background p-3 rounded border">
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-lg font-bold text-foreground">{pendingPayments.length}</p>
          </div>

          {/* Overdue */}
          <div className="bg-background p-3 rounded border">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-sm font-medium">Overdue</span>
            </div>
            <p className="text-lg font-bold text-red-600">{overduePayments.length}</p>
          </div>

          {/* Paid */}
          <div className="bg-background p-3 rounded border">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-sm font-medium">Paid</span>
            </div>
            <p className="text-lg font-bold text-green-600">
              {payments.filter(p => p.status === 'paid' && !p.isRefunded).length}
            </p>
          </div>
        </div>

        {/* Payments List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Coins size={48} className="mx-auto mb-2 opacity-50" />
              <p>No payment records found</p>
            </div>
          ) : (
            payments.map((payment, i) => {
              const paymentId = payment._id || `${payment.year}-${payment.month}-${i}`;
              const originalAmount = payment.referralDiscount && payment.referralDiscount > 0 
                ? (payment.amount + payment.referralDiscount) 
                : payment.amount;
              const hasDiscount = payment.referralDiscount && payment.referralDiscount > 0;
              const isRefunded = payment.isRefunded;
              const referralStatuses = payment.referralStatuses || [];
              const isExpanded = expandedPaymentId === paymentId;
              
              // Calculate previous month for this payment
              let prevMonth = payment.month - 1;
              let prevYear = payment.year;
              if (prevMonth < 1) {
                prevMonth = 12;
                prevYear = payment.year - 1;
              }

              return (
                <div key={paymentId} className="bg-background rounded-lg border border-border overflow-hidden">
                  {/* Payment Header */}
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedPaymentId(prev => prev === paymentId ? null : paymentId)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-base">
                          {formatMonthYear(payment.month, payment.year)}
                        </span>
                        {getStatusBadge(payment.status, payment.dueDate, payment.isRefunded)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Due {formatDate(payment.dueDate)}
                      </div>
                      {(payment.referralDiscount || 0) > 0 && (
                      <div className="text-xs text-green-600 mt-1">
                        Referral discount: -{formatCurrency(payment.referralDiscount!)}
                      </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {formatCurrency(payment.amount)}
                        </div>
                        {hasDiscount && (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatCurrency(originalAmount)}
                          </div>
                        )}
                      </div>
                      <ChevronDown 
                        size={20} 
                        className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
                      {isRefunded && (
                        <div className="text-sm text-orange-600 font-medium">
                          Payment refunded{payment.refundDate ? ` on ${formatDate(payment.refundDate)}` : ''}
                        </div>
                      )}

                      <div className="space-y-2">
                        {(payment.referralDiscount || 0) > 0 ? (
                          <>
                            <div className="text-sm text-green-600">
                              {payment.referralDiscountReason ||
                                `${formatCurrency(payment.referralDiscount!)} referral discount`}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground line-through">
                                {formatCurrency(originalAmount)}
                              </span>
                              <span className="text-green-600">-{formatCurrency(payment.referralDiscount!)}</span>
                              <span className="font-bold">{formatCurrency(payment.amount)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No discount applied
                          </div>
                        )}
                      </div>

                      {hasDiscount && isRefunded && (
                        <div className="text-xs text-orange-600">
                          Discount removed due to refund
                        </div>
                      )}

                      {/* Salesperson Commission */}
                      {payment.salespersonCommission && payment.salespersonCommission > 0 && (
                        <div className="space-y-2 border-t border-border/50 pt-3 mt-3">
                          <div className="text-sm text-blue-600 font-medium">
                            Salesperson Commission: {formatCurrency(payment.salespersonCommission)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              payment.salespersonCommissionPaid
                                ? 'bg-green-500/20 text-green-600'
                                : 'bg-yellow-500/20 text-yellow-600'
                            }`}>
                              {payment.salespersonCommissionPaid ? 'Paid to Salesperson' : 'Pending Payment to Salesperson'}
                            </span>
                            {!payment.salespersonCommissionPaid && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkCommissionPaid(payment._id)}
                                className="text-xs h-6"
                              >
                                Mark as Paid
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Referral Statuses */}
                      {referralStatuses.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="text-xs font-medium text-muted-foreground">
                            Referral status for {formatMonthYear(payment.month, payment.year)} (based on {formatMonthYear(prevMonth, prevYear)} payments):
                          </div>
                          <div className="space-y-1.5">
                            {referralStatuses.map((ref: any, idx: number) => (
                              <div key={idx} className="flex items-start justify-between text-xs">
                                <div className="flex-1">
                                  <span className="font-medium text-foreground">{ref.name}</span>
                                  {ref.reason && (
                                    <p className="text-muted-foreground text-[10px] mt-0.5">{ref.reason}</p>
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ml-2 ${
                                  ref.status === 'active'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : ref.status === 'banned'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : ref.status === 'refunded'
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                }`}>
                                  {ref.status === 'active' ? 'Active' : ref.status === 'banned' ? 'Banned' : ref.status === 'refunded' ? 'Refunded' : 'Inactive'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {payment.notes && (
                        <div className="text-xs text-muted-foreground italic pt-2 border-t border-border">
                          "{payment.notes}"
                        </div>
                      )}

                      <div className="pt-2 border-t border-border">
                        {payment.paymentProofImagePath ? (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <ImageIcon size={12} />
                              Payment Proof
                            </div>
                            <a
                              href={getPaymentProofImageUrl(payment) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img
                                src={getPaymentProofImageUrl(payment) || ''}
                                alt="Payment proof"
                                className="h-24 w-auto rounded border object-cover"
                              />
                            </a>
                            <div className="text-[11px] text-muted-foreground">
                              {payment.paymentProofOriginalName || 'proof-image'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-orange-600">No payment proof uploaded</div>
                        )}
                      </div>

                      {payment.refundNotes && (
                        <div className="text-xs text-orange-600 italic pt-2 border-t border-border">
                          Refund Note: "{payment.refundNotes}"
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (event: Event) => {
                              const target = event.target as HTMLInputElement;
                              const file = target.files?.[0];
                              if (file) {
                                await handleUploadProofOnly(payment, file);
                              }
                            };
                            input.click();
                          }}
                          disabled={updatingPaymentId === payment._id}
                          className="text-xs"
                        >
                          <Upload size={12} className="mr-1" />
                          Upload Proof
                        </Button>
                        {payment.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsPaid(payment);
                            }}
                            disabled={updatingPaymentId === payment._id}
                            className="text-xs"
                          >
                            {updatingPaymentId === payment._id ? 'Updating...' : 'Mark Paid'}
                          </Button>
                        )}
                        {payment.status === 'paid' && !payment.isRefunded && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRefund(payment);
                            }}
                            disabled={updatingPaymentId === payment._id}
                            className="text-xs text-orange-600 border-orange-600 hover:bg-orange-50"
                          >
                            <RotateCcw size={12} className="mr-1" />
                            {updatingPaymentId === payment._id ? 'Processing...' : 'Refund'}
                          </Button>
                        )}
                        {payment.isRefunded && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelRefund(payment);
                            }}
                            disabled={updatingPaymentId === payment._id}
                            className="text-xs text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <Undo2 size={12} className="mr-1" />
                            {updatingPaymentId === payment._id ? 'Processing...' : 'Cancel Refund'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payment as Paid</DialogTitle>
            <DialogDescription>
              Confirm that payment for {selectedPayment && `${getMonthName(selectedPayment.month)} ${selectedPayment.year}`} has been received. Notes are required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
              <Label htmlFor="notes">Notes *</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about this payment (required)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                required
              />
              <div className="space-y-2">
                <Label htmlFor="paymentProofImage">Payment Screenshot / Proof *</Label>
                <Input
                  id="paymentProofImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProofImage(e.target.files?.[0] || null)}
                />
                {selectedPayment?.paymentProofImagePath && (
                  <p className="text-xs text-muted-foreground">
                    Existing proof found. Upload a new file only if you want to replace it.
                  </p>
                )}
              </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmMarkAsPaid} disabled={updatingPaymentId !== null}>
              {updatingPaymentId ? 'Marking as Paid...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund Payment</DialogTitle>
            <DialogDescription>
              Mark payment for {selectedPayment && `${getMonthName(selectedPayment.month)} ${selectedPayment.year}`} as refunded. This will also update referral discounts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
              <Label htmlFor="refundNotes">Refund Notes (Optional)</Label>
              <Textarea
                id="refundNotes"
                placeholder="Add notes about this refund..."
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                rows={3}
              />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRefund} disabled={updatingPaymentId !== null} className="bg-orange-600 hover:bg-orange-700">
              {updatingPaymentId ? 'Processing Refund...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
