import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getExpenses, createExpense, getTotalExpenses } from '@/lib/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Plus, Receipt } from 'lucide-react';
import type { Expense, ExpenseCategory, PaymentMethod } from '@/types';

const categoryLabels: Record<ExpenseCategory, string> = {
  RENT: 'Rent', ELECTRICITY: 'Electricity', TRANSPORT: 'Transport',
  STAFF_PAYMENT: 'Staff Payment', REPAIRS: 'Repairs', SUPPLIES: 'Supplies', OTHER: 'Other',
};

export default function ExpensesPage() {
  const { shop, user, role } = useAuth();
  const { addToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('OTHER');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('CASH');

  useEffect(() => { if (shop) loadExpenses(); }, [shop]);

  const loadExpenses = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const data = await getExpenses(shop.id);
      setExpenses(data);
      const monthStart = new Date(); monthStart.setDate(1);
      const total = await getTotalExpenses(shop.id, monthStart.toISOString().split('T')[0]);
      setTotalExpenses(total);
    } catch {
      addToast('error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!shop || !user) return;
    if (!formAmount || Number(formAmount) <= 0) { addToast('error', 'Enter a valid amount'); return; }
    if (!formDescription.trim()) { addToast('error', 'Description is required'); return; }
    try {
      await createExpense(shop.id, { amount: Number(formAmount), category: formCategory, description: formDescription.trim(), expense_date: formDate, payment_method: formPaymentMethod }, user.id);
      addToast('success', 'Expense recorded');
      setShowAdd(false); setFormAmount(''); setFormDescription(''); setFormDate(new Date().toISOString().split('T')[0]);
      loadExpenses();
    } catch (err: any) {
      addToast('error', 'Failed to record expense', err.message);
    }
  };

  const filteredExpenses = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-text">Expenses</h1>
          <p className="text-xs text-text-muted mt-0.5">This month: {formatCurrency(totalExpenses)}</p>
        </div>
        {(role === 'OWNER' || role === 'MANAGER') && (
          <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Expense</Button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <button onClick={() => setFilter('all')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors', filter === 'all' ? 'bg-primary text-text-inverse' : 'bg-surface border border-border-subtle text-text-secondary')}>All</button>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors', filter === key ? 'bg-primary text-text-inverse' : 'bg-surface border border-border-subtle text-text-secondary')}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-1.5 h-1.5 rounded-full bg-primary" /><span className="text-text-muted text-sm ml-3">Loading</span></div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3"><Receipt className="h-6 w-6 text-text-muted" /></div>
          <p className="text-sm font-medium text-text-secondary">No expenses recorded</p>
          <p className="text-xs text-text-muted mt-1">Track your shop expenses here</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredExpenses.map(expense => (
            <div key={expense.id} className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-subtle">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text truncate">{expense.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-text-muted">{categoryLabels[expense.category]}</span>
                  <span className="text-text-muted">·</span>
                  <span className="text-[11px] text-text-muted">{new Date(expense.expense_date).toLocaleDateString('en-KE')}</span>
                  <span className="text-text-muted">·</span>
                  <span className="text-[11px] text-text-muted">{expense.payment_method}</span>
                </div>
              </div>
              <p className="text-sm font-bold text-danger tabular-nums flex-shrink-0 ml-3">-{formatCurrency(Number(expense.amount))}</p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle><DialogDescription>Record a shop expense</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Amount (KSh) *</Label><Input type="number" placeholder="0" value={formAmount} onChange={e => setFormAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Category *</Label>
              <Select value={formCategory} onValueChange={v => setFormCategory(v as ExpenseCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Description *</Label><Input placeholder="What was this expense for?" value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Date</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Method</Label>
                <Select value={formPaymentMethod} onValueChange={v => setFormPaymentMethod(v as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="M-PESA">M-Pesa</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAdd}>Save Expense</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
