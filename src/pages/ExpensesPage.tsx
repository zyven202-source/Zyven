import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getExpenses, createExpense, getTotalExpenses } from '@/lib/database';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { Plus, Receipt, TrendingDown, Filter } from 'lucide-react';
import type { Expense, ExpenseCategory, PaymentMethod } from '@/types';

const categoryLabels: Record<ExpenseCategory, string> = {
  RENT: 'Rent',
  ELECTRICITY: 'Electricity',
  TRANSPORT: 'Transport',
  STAFF_PAYMENT: 'Staff Payment',
  REPAIRS: 'Repairs',
  SUPPLIES: 'Supplies',
  OTHER: 'Other',
};

const categoryColors: Record<ExpenseCategory, string> = {
  RENT: 'text-danger',
  ELECTRICITY: 'text-warning',
  TRANSPORT: 'text-primary',
  STAFF_PAYMENT: 'text-success',
  REPAIRS: 'text-danger',
  SUPPLIES: 'text-text-secondary',
  OTHER: 'text-text-muted',
};

export default function ExpensesPage() {
  const { shop, user, role } = useAuth();
  const { addToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  // Form
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('OTHER');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('CASH');

  useEffect(() => {
    if (!shop) return;
    loadExpenses();
  }, [shop]);

  const loadExpenses = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const data = await getExpenses(shop.id);
      setExpenses(data);
      const monthStart = new Date();
      monthStart.setDate(1);
      const total = await getTotalExpenses(shop.id, monthStart.toISOString().split('T')[0]);
      setTotalTotalExpenses(total);
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
      await createExpense(shop.id, {
        amount: Number(formAmount),
        category: formCategory,
        description: formDescription.trim(),
        expense_date: formDate,
        payment_method: formPaymentMethod,
      }, user.id);
      addToast('success', 'Expense recorded');
      setShowAdd(false);
      setFormAmount(''); setFormDescription(''); setFormDate(new Date().toISOString().split('T')[0]);
      loadExpenses();
    } catch (err: any) {
      addToast('error', 'Failed to record expense', err.message);
    }
  };

  const filteredExpenses = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Expenses</h1>
          <p className="text-xs text-text-muted">This month: {formatCurrency(totalExpenses)}</p>
        </div>
        {(role === 'OWNER' || role === 'MANAGER') && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            filter === 'all' ? 'bg-primary text-bg' : 'bg-elevated text-text-secondary'
          }`}
        >
          All
        </button>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === key ? 'bg-primary text-bg' : 'bg-elevated text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Expenses List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading expenses...</div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12">
          <Receipt className="h-12 w-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No expenses recorded</p>
          <p className="text-sm text-text-muted mt-1">Track your shop expenses here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense, i) => (
            <motion.div
              key={expense.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{expense.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${categoryColors[expense.category] || 'text-text-muted'}`}>
                        {categoryLabels[expense.category]}
                      </span>
                      <span className="text-xs text-text-muted">•</span>
                      <span className="text-xs text-text-muted">
                        {new Date(expense.expense_date).toLocaleDateString('en-KE')}
                      </span>
                      <span className="text-xs text-text-muted">•</span>
                      <span className="text-xs text-text-muted">{expense.payment_method}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-danger">{formatCurrency(Number(expense.amount))}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Expense Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a shop expense</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (KSh) *</Label>
              <Input type="number" placeholder="0" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formCategory} onValueChange={v => setFormCategory(v as ExpenseCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input placeholder="What was this expense for?" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={formPaymentMethod} onValueChange={v => setFormPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="M-PESA">M-Pesa</SelectItem>
                  </SelectContent>
                </Select>
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
