'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, DollarSign, Users, TrendingUp, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { salespersonCommissionApi } from '@/lib/api';
import { SalespersonWithCommission, SalespersonCommissionPayment, SalespersonCommissionSummary } from '@/lib/types';
import { toast } from 'sonner';

export default function SalespersonCommissionPage() {
  const [salespeople, setSalespeople] = useState<SalespersonWithCommission[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<SalespersonWithCommission | null>(null);
  const [commissionSummary, setCommissionSummary] = useState<SalespersonCommissionSummary | null>(null);
  const [allPayments, setAllPayments] = useState<SalespersonCommissionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SalespersonCommissionPayment | null>(null);
  const [availableCommissions, setAvailableCommissions] = useState<any[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    salespersonId: '',
    amount: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    paymentDate: new Date(),
    notes: '',
    coveredCommissionIds: [] as string[]
  });

  const [editForm, setEditForm] = useState({
    amount: '',
    paymentDate: new Date(),
    notes: ''
  });

  useEffect(() => {
    loadSalespeople();
  }, []);

  // Fetch available commissions when form values change
  useEffect(() => {
    if (createForm.salespersonId && createForm.month && createForm.year) {
      fetchAvailableCommissions(createForm.salespersonId, createForm.month, createForm.year);
    } else {
      setAvailableCommissions([]);
    }
  }, [createForm.salespersonId, createForm.month, createForm.year]);

  const loadSalespeople = async () => {
    try {
      setLoading(true);
      const response = await salespersonCommissionApi.getSalespeopleSummary();
      setSalespeople(response.salespeople);
    } catch (error) {
      console.error('Error loading salespeople:', error);
      toast.error('Failed to load salespeople');
    } finally {
      setLoading(false);
    }
  };

  const loadCommissionSummary = async (salespersonId: string) => {
    try {
      setSummaryLoading(true);
      const response = await salespersonCommissionApi.getSummary(salespersonId);
      setCommissionSummary(response);
    } catch (error) {
      console.error('Error loading commission summary:', error);
      toast.error('Failed to load commission summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadAllPayments = async (params?: any) => {
    try {
      setPaymentsLoading(true);
      const response = await salespersonCommissionApi.getAll(params);
      setAllPayments(response.payments);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    try {
      if (!createForm.salespersonId || !createForm.amount || !createForm.month || !createForm.year) {
        toast.error('Please fill in all required fields');
        return;
      }

      const paymentData = {
        salespersonId: createForm.salespersonId,
        amount: parseFloat(createForm.amount),
        month: createForm.month,
        year: createForm.year,
        paymentDate: createForm.paymentDate.toISOString(),
        notes: createForm.notes || undefined,
        coveredCommissionIds: createForm.coveredCommissionIds
      };

      await salespersonCommissionApi.create(paymentData);

      toast.success('Commission payment created successfully');
      setShowCreateDialog(false);
      resetCreateForm();

      // Refresh data
      await loadSalespeople();
      if (selectedSalesperson) {
        await loadCommissionSummary(selectedSalesperson._id);
      }
      await loadAllPayments();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Failed to create commission payment');
    }
  };

  const handleEditPayment = async () => {
    if (!editingPayment) return;

    try {
      if (!editForm.amount) {
        toast.error('Please enter an amount');
        return;
      }

      const paymentData = {
        amount: parseFloat(editForm.amount),
        paymentDate: editForm.paymentDate.toISOString(),
        notes: editForm.notes || undefined
      };

      await salespersonCommissionApi.update(editingPayment._id, paymentData);

      toast.success('Commission payment updated successfully');
      setShowEditDialog(false);
      setEditingPayment(null);

      // Refresh data
      await loadSalespeople();
      if (selectedSalesperson) {
        await loadCommissionSummary(selectedSalesperson._id);
      }
      await loadAllPayments();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Failed to update commission payment');
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await salespersonCommissionApi.delete(paymentId);
      toast.success('Commission payment deleted successfully');

      // Refresh data
      await loadSalespeople();
      if (selectedSalesperson) {
        await loadCommissionSummary(selectedSalesperson._id);
      }
      await loadAllPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Failed to delete commission payment');
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      salespersonId: '',
      amount: '',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      paymentDate: new Date(),
      notes: '',
      coveredCommissionIds: []
    });
    setAvailableCommissions([]);
  };

  const fetchAvailableCommissions = async (salespersonId: string, month: number, year: number) => {
    try {
      setLoadingCommissions(true);
      // Get commission summary for the salesperson
      const response = await salespersonCommissionApi.getSummary(salespersonId);
      const monthlyData = response.monthlySummary.find((m: any) => m.month === month && m.year === year);

      if (monthlyData) {
        // Filter to only unpaid commissions
        const unpaidCommissions = monthlyData.payments.filter((p: any) => !p.commissionPaid);
        setAvailableCommissions(unpaidCommissions);
      } else {
        setAvailableCommissions([]);
      }
    } catch (error) {
      console.error('Error fetching available commissions:', error);
      setAvailableCommissions([]);
    } finally {
      setLoadingCommissions(false);
    }
  };

  const openEditDialog = (payment: SalespersonCommissionPayment) => {
    setEditingPayment(payment);
    setEditForm({
      amount: payment.amount.toString(),
      paymentDate: new Date(payment.paymentDate),
      notes: payment.notes || ''
    });
    setShowEditDialog(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR'
    }).format(amount);
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading salespeople...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salesperson Commission Management</h1>
          <p className="text-muted-foreground">
            Track and manage commission payments to salespeople
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Commission Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Commission Payment</DialogTitle>
              <DialogDescription>
                Record a commission payment made to a salesperson
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="salesperson" className="text-right">
                  Salesperson
                </Label>
                <Select
                  value={createForm.salespersonId}
                  onValueChange={(value) => setCreateForm(prev => ({ ...prev, salespersonId: value }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select salesperson" />
                  </SelectTrigger>
                  <SelectContent>
                    {salespeople.map((salesperson) => (
                      <SelectItem key={salesperson._id} value={salesperson._id}>
                        {salesperson.name} ({salesperson.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="month" className="text-right">
                  Month
                </Label>
                <Select
                  value={createForm.month.toString()}
                  onValueChange={(value) => setCreateForm(prev => ({ ...prev, month: parseInt(value) }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {getMonthName(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="year" className="text-right">
                  Year
                </Label>
                <Input
                  id="year"
                  type="number"
                  value={createForm.year}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="paymentDate" className="text-right">
                  Payment Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !createForm.paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {createForm.paymentDate ? format(createForm.paymentDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={createForm.paymentDate}
                      onSelect={(date) => date && setCreateForm(prev => ({ ...prev, paymentDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Optional notes about this payment"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              {availableCommissions.length > 0 && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="pt-2">
                    Cover Commissions
                  </Label>
                  <div className="col-span-3 space-y-2">
                    {loadingCommissions ? (
                      <div className="text-sm text-muted-foreground">Loading commissions...</div>
                    ) : (
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {/* Select All checkbox */}
                        <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                          <input
                            type="checkbox"
                            id="select-all-commissions"
                            checked={createForm.coveredCommissionIds.length === availableCommissions.length && availableCommissions.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Select all
                                setCreateForm(prev => ({
                                  ...prev,
                                  coveredCommissionIds: availableCommissions.map(c => c.paymentId)
                                }));
                              } else {
                                // Deselect all
                                setCreateForm(prev => ({
                                  ...prev,
                                  coveredCommissionIds: []
                                }));
                              }
                            }}
                            className="rounded"
                          />
                          <label
                            htmlFor="select-all-commissions"
                            className="text-sm font-medium cursor-pointer"
                          >
                            Select All ({availableCommissions.length})
                          </label>
                        </div>
                        {/* Individual commission checkboxes */}
                        {availableCommissions.map((commission) => (
                          <div key={commission.paymentId} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`commission-${commission.paymentId}`}
                              checked={createForm.coveredCommissionIds.includes(commission.paymentId)}
                              onChange={(e) => {
                                const paymentId = commission.paymentId;
                                setCreateForm(prev => ({
                                  ...prev,
                                  coveredCommissionIds: e.target.checked
                                    ? [...prev.coveredCommissionIds, paymentId]
                                    : prev.coveredCommissionIds.filter(id => id !== paymentId)
                                }));
                              }}
                              className="rounded"
                            />
                            <label
                              htmlFor={`commission-${commission.paymentId}`}
                              className="text-sm cursor-pointer"
                            >
                              {commission.userName} - {formatCurrency(commission.commission)}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreatePayment}>
                Create Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Commission Details</TabsTrigger>
          <TabsTrigger value="payments">All Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Salespeople</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salespeople.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(salespeople.reduce((sum, sp) => sum + sp.totalEarned, 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(salespeople.reduce((sum, sp) => sum + sp.totalPaid, 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(salespeople.reduce((sum, sp) => sum + sp.outstanding, 0))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Salespeople Overview</CardTitle>
              <CardDescription>
                Click on a salesperson to view detailed commission information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Users Created</TableHead>
                    <TableHead>Total Earned</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Last Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salespeople.map((salesperson) => (
                    <TableRow
                      key={salesperson._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedSalesperson(salesperson);
                        loadCommissionSummary(salesperson._id);
                      }}
                    >
                      <TableCell className="font-medium">{salesperson.name}</TableCell>
                      <TableCell>{salesperson.email}</TableCell>
                      <TableCell>{salesperson.userCount}</TableCell>
                      <TableCell>{formatCurrency(salesperson.totalEarned)}</TableCell>
                      <TableCell>{formatCurrency(salesperson.totalPaid)}</TableCell>
                      <TableCell>
                        <Badge variant={salesperson.outstanding > 0 ? "destructive" : "secondary"}>
                          {formatCurrency(salesperson.outstanding)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {salesperson.lastPayment
                          ? format(new Date(salesperson.lastPayment), 'MMM dd, yyyy')
                          : 'Never'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {selectedSalesperson ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{selectedSalesperson.name}'s Commission Details</CardTitle>
                  <CardDescription>
                    Monthly breakdown of earned commissions and payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {summaryLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-lg">Loading commission details...</div>
                    </div>
                  ) : commissionSummary ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(commissionSummary.summary.totalEarned)}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Earned</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(commissionSummary.summary.totalPaid)}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Paid</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(commissionSummary.summary.totalOutstanding)}
                          </div>
                          <div className="text-sm text-muted-foreground">Outstanding</div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Monthly Breakdown</h3>
                        {commissionSummary.monthlySummary.map((month) => (
                          <Card key={`${month.year}-${month.month}`}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">
                                {getMonthName(month.month)} {month.year}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid gap-4 md:grid-cols-4">
                                <div>
                                  <div className="text-sm text-muted-foreground">Earned</div>
                                  <div className="font-semibold">{formatCurrency(month.totalEarned)}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Paid</div>
                                  <div className="font-semibold">{formatCurrency(month.paidAmount)}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Unpaid</div>
                                  <div className="font-semibold">{formatCurrency(month.unpaidAmount)}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Manual Payments</div>
                                  <div className="font-semibold">{month.manualPayments.length}</div>
                                </div>
                              </div>
                              {month.manualPayments.length > 0 && (
                                <div className="mt-4">
                                  <h4 className="text-sm font-medium mb-2">Payments Made:</h4>
                                  <div className="space-y-2">
                                    {month.manualPayments.map((payment) => (
                                      <div key={payment._id} className="flex justify-between items-center p-2 bg-muted rounded">
                                        <div>
                                          <div className="font-medium">{formatCurrency(payment.amount)}</div>
                                          <div className="text-sm text-muted-foreground">
                                            {format(new Date(payment.paymentDate), 'MMM dd, yyyy')} by {payment.createdBy}
                                          </div>
                                          {payment.notes && (
                                            <div className="text-sm text-muted-foreground mt-1">
                                              {payment.notes}
                                            </div>
                                          )}
                                          {payment.coveredCommissionIds && payment.coveredCommissionIds.length > 0 && (
                                            <div className="text-xs text-blue-600 mt-1">
                                              Covers {payment.coveredCommissionIds.length} commission{payment.coveredCommissionIds.length !== 1 ? 's' : ''}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openEditDialog({
                                              ...payment,
                                              salespersonId: selectedSalesperson._id,
                                              month: month.month,
                                              year: month.year,
                                              createdBy: { name: payment.createdBy } as any,
                                              period: `${getMonthName(month.month)} ${month.year}`
                                            } as SalespersonCommissionPayment)}
                                          >
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button size="sm" variant="outline">
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Commission Payment</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Are you sure you want to delete this commission payment? This action cannot be undone.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => handleDeletePayment(payment._id)}
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                  Delete
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Failed to load commission details
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select a salesperson from the overview tab to view commission details
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Commission Payments</CardTitle>
              <CardDescription>
                Complete list of all commission payments made to salespeople
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => loadAllPayments()}
                disabled={paymentsLoading}
                className="mb-4"
              >
                {paymentsLoading ? 'Loading...' : 'Refresh Payments'}
              </Button>

              {paymentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-lg">Loading payments...</div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Salesperson</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPayments.map((payment) => (
                      <TableRow key={payment._id}>
                        <TableCell>
                          {typeof payment.salespersonId === 'object' && payment.salespersonId
                            ? payment.salespersonId.name
                            : 'Unknown'
                          }
                        </TableCell>
                        <TableCell>{payment.period || `${getMonthName(payment.month)} ${payment.year}`}</TableCell>
                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>{format(new Date(payment.paymentDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          {typeof payment.createdBy === 'object' && payment.createdBy
                            ? payment.createdBy.name
                            : 'Unknown'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(payment)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Commission Payment</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this commission payment? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePayment(payment._id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Payment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Commission Payment</DialogTitle>
            <DialogDescription>
              Update commission payment details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-amount" className="text-right">
                Amount
              </Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editForm.amount}
                onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-paymentDate" className="text-right">
                Payment Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !editForm.paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editForm.paymentDate ? format(editForm.paymentDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editForm.paymentDate}
                    onSelect={(date) => date && setEditForm(prev => ({ ...prev, paymentDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="edit-notes"
                placeholder="Optional notes about this payment"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleEditPayment}>
              Update Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
