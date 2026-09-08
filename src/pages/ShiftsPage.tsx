import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getActiveShift, openShift, closeShift, getShifts } from '@/lib/database';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { Clock, Lock, Unlock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ShiftsPage() {
  const { shop, user, role } = useAuth();
  const { addToast } = useToast();
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  useEffect(() => {
    if (!shop) return;
    loadData();
  }, [shop]);

  const loadData = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const [active, allShifts] = await Promise.all([
        getActiveShift(shop.id),
        getShifts(shop.id),
      ]);
      setActiveShift(active);
      setShifts(allShifts);
    } catch {
      addToast('error', 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async () => {
    if (!shop || !user) return;
    if (!openingCash || Number(openingCash) < 0) {
      addToast('error', 'Enter opening cash amount');
      return;
    }
    try {
      await openShift(shop.id, user.id, Number(openingCash));
      addToast('success', 'Shift opened!', `Opening cash: ${formatCurrency(Number(openingCash))}`);
      setShowOpen(false);
      setOpeningCash('');
      loadData();
    } catch (err: any) {
      addToast('error', 'Failed to open shift', err.message);
    }
  };

  const handleCloseShift = async () => {
    if (!shop || !user || !activeShift) return;
    if (!closingCash && closingCash !== '0') {
      addToast('error', 'Enter counted closing cash');
      return;
    }
    try {
      await closeShift(activeShift.id, shop.id, user.id, Number(closingCash), closeNotes || undefined);
      addToast('success', 'Shift closed!');
      setShowClose(false);
      setClosingCash('');
      setCloseNotes('');
      loadData();
    } catch (err: any) {
      addToast('error', 'Failed to close shift', err.message);
    }
  };

  const expectedCash = activeShift
    ? Number(activeShift.opening_cash) + Number(activeShift.cash_sales) - Number(activeShift.cash_refunds) - Number(activeShift.cash_payouts)
    : 0;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Shifts</h1>
        {!activeShift && (
          <Button onClick={() => setShowOpen(true)}>
            <Unlock className="h-4 w-4" /> Open Shift
          </Button>
        )}
      </div>

      {/* Active Shift */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading shifts...</div>
      ) : activeShift ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Active Shift
                <Badge variant="default">OPEN</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-text-muted">
                Opened {new Date(activeShift.opened_at).toLocaleString('en-KE')} by {activeShift.user?.full_name || 'Unknown'}
              </div>

              {/* Cash Drawer */}
              <div className="p-4 rounded-xl bg-elevated">
                <h4 className="text-sm font-medium text-text-secondary mb-3">PHYSICAL CASH</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-muted">Opening Cash</p>
                    <p className="text-lg font-bold text-text-primary">{formatCurrency(Number(activeShift.opening_cash))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Cash Sales</p>
                    <p className="text-lg font-bold text-success">{formatCurrency(Number(activeShift.cash_sales))}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-text-muted">Expected Physical Cash</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(expectedCash)}</p>
                </div>
              </div>

              {/* Other Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-elevated">
                  <p className="text-xs text-text-muted">M-Pesa Sales</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(Number(activeShift.mpesa_sales))}</p>
                </div>
                <div className="p-3 rounded-lg bg-elevated">
                  <p className="text-xs text-text-muted">Credit Sales</p>
                  <p className="text-lg font-bold text-danger">{formatCurrency(Number(activeShift.credit_sales))}</p>
                </div>
              </div>

              {(role === 'OWNER' || role === 'MANAGER') && (
                <Button className="w-full" variant="destructive" onClick={() => setShowClose(true)}>
                  <Lock className="h-4 w-4" /> Close Shift
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="text-center py-12">
          <Lock className="h-12 w-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No active shift</p>
          <p className="text-sm text-text-muted mt-1">Open a shift to start recording sales</p>
        </div>
      )}

      {/* Shift History */}
      {shifts.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-text-primary mb-3">Shift History</h2>
          <div className="space-y-2">
            {shifts.map((shift, i) => (
              <motion.div
                key={shift.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={shift.status === 'OPEN' ? 'default' : 'secondary'}>
                            {shift.status}
                          </Badge>
                          <span className="text-sm text-text-muted">
                            {new Date(shift.opened_at).toLocaleDateString('en-KE')}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-1">
                          {shift.user?.full_name || 'Unknown'} • Opened: {formatCurrency(Number(shift.opening_cash))}
                        </p>
                      </div>
                      {shift.status === 'CLOSED' && shift.difference !== null && (
                        <div className="text-right">
                          {Number(shift.difference) === 0 ? (
                            <span className="flex items-center gap-1 text-xs text-success">
                              <CheckCircle className="h-3.5 w-3.5" /> Balanced
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-danger">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {Number(shift.difference) > 0 ? '+' : ''}{formatCurrency(Number(shift.difference))}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Open Shift Dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open Shift</DialogTitle>
            <DialogDescription>Count and enter your opening cash</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Opening Cash (KSh) *</Label>
              <Input type="number" placeholder="e.g., 2000" value={openingCash} onChange={e => setOpeningCash(e.target.value)} autoFocus />
              <p className="text-xs text-text-muted">Count the physical cash in your drawer</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleOpenShift}>Open Shift</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close Shift</DialogTitle>
            <DialogDescription>Count your cash drawer and close the shift</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-elevated">
              <p className="text-xs text-text-muted">Expected Physical Cash</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(expectedCash)}</p>
            </div>
            <div className="space-y-2">
              <Label>Counted Cash (KSh) *</Label>
              <Input type="number" placeholder="Count your physical cash" value={closingCash} onChange={e => setClosingCash(e.target.value)} autoFocus />
            </div>
            {closingCash && (
              <div className={`p-3 rounded-lg ${Number(closingCash) - expectedCash === 0 ? 'bg-success/10' : 'bg-danger/10'}`}>
                <p className="text-xs text-text-muted">Difference</p>
                <p className={`text-lg font-bold ${
                  Number(closingCash) - expectedCash === 0 ? 'text-success' : 'text-danger'
                }`}>
                  {Number(closingCash) - expectedCash >= 0 ? '+' : ''}
                  {formatCurrency(Number(closingCash) - expectedCash)}
                </p>
                {Number(closingCash) - expectedCash !== 0 && (
                  <p className="text-xs text-text-muted mt-1">
                    {Number(closingCash) - expectedCash > 0 ? 'Overage' : 'Shortage'}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any notes about this shift..." value={closeNotes} onChange={e => setCloseNotes(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowClose(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCloseShift}>Close Shift</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
