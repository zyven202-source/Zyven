import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getCustomers, createCustomer, getCustomerLedger, recordCustomerPayment } from '@/lib/database';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { Plus, Search, Users, Phone, DollarSign, CreditCard, ArrowUpRight, MessageCircle } from 'lucide-react';
import type { Customer, CustomerLedgerEntry, PaymentMethod } from '@/types';

export default function DaftariPage() {
  const { shop, user } = useAuth();
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerEntry[]>([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  // Add customer form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payMpesaRef, setPayMpesaRef] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [shop]);

  const loadCustomers = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const data = await getCustomers(shop.id, search);
      setCustomers(data);
    } catch {
      addToast('error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 300);
    return () => clearTimeout(timer);
  }, [search, shop]);

  const handleAddCustomer = async () => {
    if (!shop || !newName.trim()) {
      addToast('error', 'Name is required');
      return;
    }
    try {
      await createCustomer(shop.id, {
        full_name: newName.trim(),
        phone: newPhone || undefined,
        notes: newNotes || undefined,
      });
      addToast('success', 'Customer added!');
      setShowAddCustomer(false);
      setNewName(''); setNewPhone(''); setNewNotes('');
      loadCustomers();
    } catch (err: any) {
      addToast('error', 'Failed to add customer', err.message);
    }
  };

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    if (shop) {
      const entries = await getCustomerLedger(shop.id, customer.id);
      setLedgerEntries(entries);
    }
  };

  const handleRecordPayment = async () => {
    if (!shop || !user || !selectedCustomer) return;
    if (!payAmount || Number(payAmount) <= 0) {
      addToast('error', 'Enter a valid amount');
      return;
    }
    if (Number(payAmount) > selectedCustomer.current_balance) {
      addToast('warning', `Payment exceeds balance of ${formatCurrency(selectedCustomer.current_balance)}`);
      return;
    }

    try {
      const result = await recordCustomerPayment(
        shop.id,
        selectedCustomer.id,
        Number(payAmount),
        user.id,
        payMethod,
        payMpesaRef || undefined
      );
      addToast('success', 'Payment recorded!', `New balance: ${formatCurrency(result.newBalance)}`);
      setShowPayment(false);
      setPayAmount('');
      setPayMpesaRef('');

      // Refresh
      const updated = customers.map(c =>
        c.id === selectedCustomer.id ? { ...c, current_balance: result.newBalance } : c
      );
      setCustomers(updated);
      setSelectedCustomer({ ...selectedCustomer, current_balance: result.newBalance });

      const entries = await getCustomerLedger(shop.id, selectedCustomer.id);
      setLedgerEntries(entries);
    } catch (err: any) {
      addToast('error', 'Payment failed', err.message);
    }
  };

  const sendWhatsAppReminder = (customer: Customer) => {
    const message = encodeURIComponent(
      `Hello ${customer.full_name},\n\nThis is a friendly reminder from ${shop?.name}.\n\nYour outstanding balance is ${formatCurrency(customer.current_balance)}.\n\nPlease clear your balance at your earliest convenience.\n\nAsante sana!`
    );
    window.open(`https://wa.me/${customer.phone?.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const totalDebt = customers.reduce((sum, c) => sum + Number(c.current_balance), 0);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Daftari</h1>
          <p className="text-xs text-text-muted">Customer Credit Ledger</p>
        </div>
        <Button onClick={() => setShowAddCustomer(true)}>
          <Plus className="h-4 w-4" />
          New Customer
        </Button>
      </div>

      {/* Total Debt */}
      <Card className="bg-gradient-to-br from-danger/10 to-danger/5 border-danger/20">
        <CardContent className="p-4">
          <p className="text-sm text-text-secondary">Total Outstanding Debt</p>
          <p className="text-2xl font-bold text-danger">{formatCurrency(totalDebt)}</p>
          <p className="text-xs text-text-muted mt-1">{customers.filter(c => Number(c.current_balance) > 0).length} customers with balance</p>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading customers...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No customers yet</p>
          <p className="text-sm text-text-muted mt-1">Add your first customer to start tracking credit</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((customer, i) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <Card
                className={`cursor-pointer hover:border-primary/30 transition-colors ${
                  Number(customer.current_balance) > 0 ? 'border-danger/20' : ''
                }`}
                onClick={() => selectCustomer(customer)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center text-sm font-bold text-text-primary">
                      {customer.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{customer.full_name}</p>
                      {customer.phone && (
                        <p className="text-xs text-text-muted flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {customer.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {Number(customer.current_balance) > 0 ? (
                      <Badge variant="danger">{formatCurrency(customer.current_balance)}</Badge>
                    ) : (
                      <Badge variant="success">Settled</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCustomer.full_name}</DialogTitle>
                {selectedCustomer.phone && (
                  <DialogDescription className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {selectedCustomer.phone}
                  </DialogDescription>
                )}
              </DialogHeader>

              {/* Balance */}
              <div className="p-4 rounded-xl bg-elevated text-center">
                <p className="text-sm text-text-muted">Outstanding Balance</p>
                <p className={`text-3xl font-bold ${
                  Number(selectedCustomer.current_balance) > 0 ? 'text-danger' : 'text-success'
                }`}>
                  {formatCurrency(selectedCustomer.current_balance)}
                </p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                {Number(selectedCustomer.current_balance) > 0 && (
                  <>
                    <Button onClick={() => setShowPayment(true)}>
                      <DollarSign className="h-4 w-4" />
                      Record Payment
                    </Button>
                    {selectedCustomer.phone && (
                      <Button variant="outline" onClick={() => sendWhatsAppReminder(selectedCustomer)}>
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Ledger History */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-text-secondary mb-2">Transaction History</h4>
                {ledgerEntries.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">No transactions yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {ledgerEntries.map(entry => (
                      <div key={entry.id} className="p-3 rounded-lg bg-elevated">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {entry.type === 'CREDIT' ? (
                              <CreditCard className="h-4 w-4 text-danger" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-success" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-text-primary">{entry.description}</p>
                              <p className="text-xs text-text-muted">
                                {new Date(entry.created_at).toLocaleDateString('en-KE', {
                                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${entry.type === 'CREDIT' ? 'text-danger' : 'text-success'}`}>
                              {entry.type === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                            </p>
                            <p className="text-xs text-text-muted">
                              Bal: {formatCurrency(entry.balance_after)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>Add a new customer to your ledger</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="e.g., Jane Wanjiku" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input placeholder="e.g., 0712345678" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Optional notes" value={newNotes} onChange={e => setNewNotes(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddCustomer}>Add Customer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.full_name} — Owes {formatCurrency(selectedCustomer?.current_balance || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (KSh) *</Label>
              <Input type="number" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payMethod} onValueChange={v => setPayMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="M-PESA">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMethod === 'M-PESA' && (
              <div className="space-y-2">
                <Label>M-Pesa Reference</Label>
                <Input placeholder="Reference number" value={payMpesaRef} onChange={e => setPayMpesaRef(e.target.value)} />
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleRecordPayment}>Record Payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
