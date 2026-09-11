import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getActiveShift, openShift, closeShift, getShifts } from '@/lib/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Clock, Lock, Unlock, CheckCircle, AlertTriangle } from 'lucide-react';
import { SkeletonPage } from '@/components/ui/skeleton';

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

  useEffect(() => { if (shop) loadData(); }, [shop]);

  const loadData = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const [active, allShifts] = await Promise.all([getActiveShift(shop.id), getShifts(shop.id)]);
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
    if (!openingCash || Number(openingCash) < 0) { addToast('error', 'Enter opening cash amount'); return; }
    try {
      await openShift(shop.id, user.id, Number(openingCash));
      addToast('success', 'Shift opened', `Opening cash: ${formatCurrency(Number(openingCash))}`);
      setShowOpen(false); setOpeningCash(''); loadData();
    } catch (err: any) { addToast('error', 'Failed to open shift', err.message); }
  };

  const handleCloseShift = async () => {
    if (!shop || !user || !activeShift) return;
    if (!closingCash && closingCash !== '0') { addToast('error', 'Enter counted closing cash'); return; }
    try {
      await closeShift(activeShift.id, shop.id, user.id, Number(closingCash), closeNotes || undefined);
      addToast('success', 'Shift closed');
      setShowClose(false); setClosingCash(''); setCloseNotes(''); loadData();
    } catch (err: any) { addToast('error', 'Failed to close shift', err.message); }
  };

  const expectedCash = activeShift
    ? Number(activeShift.opening_cash) + Number(activeShift.cash_sales) - Number(activeShift.cash_refunds) - Number(activeShift.cash_payouts)
    : 0;

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="page-header">
        <h1 className="text-xl font-bold text-text">Shifts</h1>
        {!activeShift && (
          <Button onClick={() => setShowOpen(true)}><Unlock className="h-4 w-4" /> Open Shift</Button>
        )}
      </div>

      {loading ? (
        <SkeletonPage label="Loading shifts" />
      ) : activeShift ? (
        <div className="space-y-4">
          <div className="bg-surface border border-primary/20 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-text">Active Shift</h2>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-primary text-text-inverse text-[10px] font-bold uppercase tracking-wider">Open</span>
            </div>
            <p className="text-xs text-text-muted mb-4">
              Opened {new Date(activeShift.opened_at).toLocaleString('en-KE')} by {activeShift.user?.full_name || 'Unknown'}
            </p>

            {/* Physical Cash Section */}
            <div className="p-4 rounded-xl bg-elevated mb-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-3">Physical Cash</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-text-muted">Opening</p>
                  <p className="text-lg font-bold text-text tabular-nums">{formatCurrency(Number(activeShift.opening_cash))}</p>
                </div>
                <div>
                  <p className="text-[11px] text-text-muted">Cash Sales</p>
                  <p className="text-lg font-bold text-success tabular-nums">{formatCurrency(Number(activeShift.cash_sales))}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border-subtle">
                <p className="text-[11px] text-text-muted">Expected Cash</p>
                <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(expectedCash)}</p>
              </div>
            </div>

            {/* Other Totals */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-elevated">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">M-Pesa</p>
                <p className="text-base font-bold text-primary tabular-nums mt-0.5">{formatCurrency(Number(activeShift.mpesa_sales))}</p>
              </div>
              <div className="p-3 rounded-xl bg-elevated">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Credit</p>
                <p className="text-base font-bold text-danger tabular-nums mt-0.5">{formatCurrency(Number(activeShift.credit_sales))}</p>
              </div>
            </div>

            {(role === 'OWNER' || role === 'MANAGER') && (
              <Button className="w-full mt-4" variant="destructive" onClick={() => setShowClose(true)}>
                <Lock className="h-4 w-4" /> Close Shift
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3"><Lock className="h-6 w-6 text-text-muted" /></div>
          <p className="text-sm font-medium text-text-secondary">No active shift</p>
          <p className="text-xs text-text-muted mt-1">Open a shift to start recording sales</p>
        </div>
      )}

      {/* Shift History */}
      {shifts.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">History</h2>
          <div className="space-y-1.5">
            {shifts.map(shift => (
              <div key={shift.id} className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-subtle">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase', shift.status === 'OPEN' ? 'bg-primary text-text-inverse' : 'bg-elevated text-text-muted')}>
                      {shift.status}
                    </span>
                    <span className="text-sm text-text-secondary">{new Date(shift.opened_at).toLocaleDateString('en-KE')}</span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    {shift.user?.full_name || 'Unknown'} · Open: {formatCurrency(Number(shift.opening_cash))}
                  </p>
                </div>
                {shift.status === 'CLOSED' && shift.difference !== null && (
                  <div className="text-right">
                    {Number(shift.difference) === 0 ? (
                      <span className="flex items-center gap-1 text-xs text-success"><CheckCircle className="h-3.5 w-3.5" /> Balanced</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-danger">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {Number(shift.difference) > 0 ? '+' : ''}{formatCurrency(Number(shift.difference))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Shift Dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Open Shift</DialogTitle><DialogDescription>Count and enter your opening cash</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Opening Cash (KSh) *</Label>
              <Input type="number" placeholder="e.g., 2000" value={openingCash} onChange={e => setOpeningCash(e.target.value)} autoFocus />
              <p className="text-[11px] text-text-muted">Count the physical cash in your drawer</p>
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
          <DialogHeader><DialogTitle>Close Shift</DialogTitle><DialogDescription>Count your cash drawer and close</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-elevated">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Expected Cash</p>
              <p className="text-xl font-bold text-primary tabular-nums mt-0.5">{formatCurrency(expectedCash)}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Counted Cash (KSh) *</Label>
              <Input type="number" placeholder="Count your physical cash" value={closingCash} onChange={e => setClosingCash(e.target.value)} autoFocus />
            </div>
            {closingCash && (
              <div className={cn('p-3 rounded-xl', Number(closingCash) - expectedCash === 0 ? 'bg-success-muted' : 'bg-danger-muted')}>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Difference</p>
                <p className={cn('text-lg font-bold tabular-nums mt-0.5', Number(closingCash) - expectedCash === 0 ? 'text-success' : 'text-danger')}>
                  {Number(closingCash) - expectedCash >= 0 ? '+' : ''}{formatCurrency(Number(closingCash) - expectedCash)}
                </p>
                {Number(closingCash) - expectedCash !== 0 && (
                  <p className="text-xs text-text-muted mt-0.5">{Number(closingCash) - expectedCash > 0 ? 'Overage' : 'Shortage'}</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Notes (optional)</Label>
              <Textarea placeholder="Any notes..." value={closeNotes} onChange={e => setCloseNotes(e.target.value)} />
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
