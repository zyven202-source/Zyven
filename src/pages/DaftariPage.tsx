import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getCustomers, createCustomer, getCustomerLedger, recordCustomerPayment } from '@/lib/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Plus, Search, Users, Phone, DollarSign, CreditCard, ArrowUpRight, MessageCircle } from 'lucide-react';
import type { Customer, CustomerLedgerEntry, PaymentMethod } from '@/types';
import { SkeletonPage } from '@/components/ui/skeleton';

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

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payMpesaRef, setPayMpesaRef] = useState('');

  useEffect(() => { loadCustomers(); }, [shop]);

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
    if (!shop || !newName.trim()) { addToast('error', 'Name is required'); return; }
    try {
      await createCustomer(shop.id, { full_name: newName.trim(), phone: newPhone || undefined, notes: newNotes || undefined }, user?.id);
      addToast('success', 'Customer added');
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
    if (!payAmount || Number(payAmount) <= 0) { addToast('error', 'Enter a valid amount'); return; }
    if (Number(payAmount) > selectedCustomer.current_balance) {
      addToast('warning', `Payment exceeds balance of ${formatCurrency(selectedCustomer.current_balance)}`);
      return;
    }
    try {
      const result = await recordCustomerPayment(shop.id, selectedCustomer.id, Number(payAmount), user.id, payMethod, payMpesaRef || undefined);
      addToast('success', 'Payment recorded', `New balance: ${formatCurrency(result.newBalance)}`);
      setShowPayment(false); setPayAmount(''); setPayMpesaRef('');
      const updated = customers.map(c => c.id === selectedCustomer.id ? { ...c, current_balance: result.newBalance } : c);
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
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-text">Daftari</h1>
          <p className="text-xs text-text-muted mt-0.5">Customer Credit Ledger</p>
        </div>
        <Button onClick={() => setShowAddCustomer(true)}><Plus className="h-4 w-4" /> New Customer</Button>
      </div>

      {/* Total Debt KPI */}
      <div className="bg-surface border border-danger/15 rounded-2xl p-5">
        <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Total Outstanding</p>
        <p className="kpi-value text-danger">{formatCurrency(totalDebt)}</p>
        <p className="text-xs text-text-muted mt-1">{customers.filter(c => Number(c.current_balance) > 0).length} customers with balance</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
        <input
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-subtle bg-elevated text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-colors"
        />
      </div>

      {loading ? (
        <SkeletonPage label="Loading customers" />
      ) : customers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3"><Users className="h-6 w-6 text-text-muted" /></div>
          <p className="text-sm font-medium text-text-secondary">No customers yet</p>
          <p className="text-xs text-text-muted mt-1">Add your first customer to start tracking credit</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(customer => (
            <button
              key={customer.id}
              onClick={() => selectCustomer(customer)}
              className={cn(
                'w-full text-left p-4 rounded-xl border transition-all active:scale-[0.99]',
                Number(customer.current_balance) > 0 ? 'border-danger/15 bg-surface' : 'border-border-subtle bg-surface hover:border-border'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-ghost border border-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-sm font-semibold">{customer.full_name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{customer.full_name}</p>
                    {customer.phone && <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {customer.phone}</p>}
                  </div>
                </div>
                <div className="text-right">
                  {Number(customer.current_balance) > 0 ? (
                    <span className="px-2.5 py-1 rounded-lg bg-danger-muted text-danger text-xs font-semibold tabular-nums">{formatCurrency(customer.current_balance)}</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-success-muted text-success text-xs font-semibold">Settled</span>
                  )}
                </div>
              </div>
            </button>
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
                {selectedCustomer.phone && <DialogDescription className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedCustomer.phone}</DialogDescription>}
              </DialogHeader>
              <div className="p-4 rounded-xl bg-elevated text-center">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Outstanding Balance</p>
                <p className={cn('kpi-value mt-1', Number(selectedCustomer.current_balance) > 0 ? 'text-danger' : 'text-success')}>
                  {formatCurrency(selectedCustomer.current_balance)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Number(selectedCustomer.current_balance) > 0 && (
                  <>
                    <Button onClick={() => setShowPayment(true)}><DollarSign className="h-4 w-4" /> Record Payment</Button>
                    {selectedCustomer.phone && <Button variant="outline" onClick={() => sendWhatsAppReminder(selectedCustomer)}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>}
                  </>
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Transaction History</h4>
                {ledgerEntries.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">No transactions yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {ledgerEntries.map(entry => (
                      <div key={entry.id} className="p-3 rounded-xl bg-elevated">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {entry.type === 'CREDIT' ? <CreditCard className="h-4 w-4 text-danger" /> : <ArrowUpRight className="h-4 w-4 text-success" />}
                            <div>
                              <p className="text-sm font-medium text-text">{entry.description}</p>
                              <p className="text-[11px] text-text-muted">{new Date(entry.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-sm font-bold tabular-nums', entry.type === 'CREDIT' ? 'text-danger' : 'text-success')}>
                              {entry.type === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                            </p>
                            <p className="text-[10px] text-text-muted">Bal: {formatCurrency(entry.balance_after)}</p>
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
          <DialogHeader><DialogTitle>Add Customer</DialogTitle><DialogDescription>Add a new customer to your ledger</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Full Name *</Label><Input placeholder="e.g., Jane Wanjiku" value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Phone</Label><Input placeholder="e.g., 0712345678" value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Notes</Label><Input placeholder="Optional" value={newNotes} onChange={e => setNewNotes(e.target.value)} /></div>
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
          <DialogHeader><DialogTitle>Record Payment</DialogTitle><DialogDescription>{selectedCustomer?.full_name} — Owes {formatCurrency(selectedCustomer?.current_balance || 0)}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Amount (KSh) *</Label><Input type="number" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Method</Label>
              <Select value={payMethod} onValueChange={v => setPayMethod(v as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="M-PESA">M-Pesa</SelectItem></SelectContent></Select>
            </div>
            {payMethod === 'M-PESA' && <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Reference</Label><Input placeholder="Reference number" value={payMpesaRef} onChange={e => setPayMpesaRef(e.target.value)} /></div>}
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
