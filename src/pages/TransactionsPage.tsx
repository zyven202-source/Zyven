import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getSales, getSale } from '@/lib/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Receipt as ReceiptIcon } from 'lucide-react';
import { ReceiptView, PrintReceipt, type ReceiptData } from '@/components/receipts/Receipt';
import { Search, Clock } from 'lucide-react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString('en-KE');
}

export default function TransactionsPage() {
  const { shop } = useAuth();
  const { addToast } = useToast();
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!shop) return;
    setLoading(true);
    getSales(shop.id, PAGE_SIZE, page * PAGE_SIZE)
      .then(setSales)
      .catch(() => addToast('error', 'Failed to load transactions'))
      .finally(() => setLoading(false));
  }, [shop, page, addToast]);

  const openDetail = async (saleId: string) => {
    if (!shop) return;
    try {
      const full = await getSale(shop.id, saleId);
      setSelected(full);
    } catch {
      addToast('error', 'Failed to load sale');
    }
  };

  const filtered = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.receipt_number?.toLowerCase().includes(q) ||
      s.customer?.full_name?.toLowerCase().includes(q) ||
      s.payment_method?.toLowerCase().includes(q);
  });

  const toReceipt = (s: any): ReceiptData => ({
    shop_name: shop?.name || 'Shop',
    shop_phone: shop?.phone,
    shop_address: shop?.address,
    receipt_number: s.receipt_number,
    created_at: s.created_at,
    payment_method: s.payment_method,
    customer_name: s.customer?.full_name,
    mpesa_reference: s.mpesa_reference,
    items: (s.items || []).map((i: any) => ({ product_name: i.product_name, quantity: i.quantity, unit_price: Number(i.unit_price), total: Number(i.total) })),
    subtotal: Number(s.subtotal),
    discount: Number(s.discount || 0),
    total: Number(s.total),
  });

  return (
    <div className="px-4 lg:px-8 py-5 max-w-4xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="page-header">
        <h1 className="text-xl font-bold text-text">Transactions</h1>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</Button>
          <Button variant="outline" size="sm" disabled={sales.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
        <input
          placeholder="Search by receipt, customer, method..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-subtle bg-elevated text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-1.5 h-1.5 rounded-full bg-primary" /><span className="text-text-muted text-sm ml-3">Loading</span></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3"><ReceiptIcon className="h-6 w-6 text-text-muted" /></div>
          <p className="text-sm font-medium text-text-secondary">{search ? 'No matching transactions' : 'No transactions yet'}</p>
          <p className="text-xs text-text-muted mt-1">{search ? 'Try a different search' : 'Your sales will appear here'}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(s => (
            <button key={s.id} onClick={() => openDetail(s.id)}
              className="w-full text-left p-4 rounded-xl bg-surface border border-border-subtle hover:border-border transition-colors active:scale-[0.99]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">#{s.receipt_number}</p>
                  <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> {timeAgo(s.created_at)} · {s.payment_method}
                    {s.customer?.full_name ? ` · ${s.customer.full_name}` : ''}
                  </p>
                </div>
                <p className="text-sm font-bold text-primary tabular-nums flex-shrink-0">{formatCurrency(Number(s.total))}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ReceiptIcon className="h-4 w-4 text-primary" /> #{selected.receipt_number}
                </DialogTitle>
              </DialogHeader>
              <ReceiptView data={toReceipt(selected)} compact />
              {/* COGS breakdown (owner/manager insight) */}
              <div className="bg-elevated rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Profitability</p>
                {(() => {
                  const cogs = (selected.items || []).reduce((sum: number, i: any) => sum + Number(i.cogs || 0), 0);
                  const profit = (selected.items || []).reduce((sum: number, i: any) => sum + Number(i.gross_profit || 0), 0);
                  return (
                    <>
                      <div className="flex justify-between text-xs"><span className="text-text-muted">COGS</span><span className="text-text tabular-nums">{formatCurrency(cogs)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-text-muted">Gross Profit</span><span className={cn('tabular-nums font-semibold', profit >= 0 ? 'text-success' : 'text-danger')}>{formatCurrency(profit)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-text-muted">Cashier</span><span className="text-text">{selected.user?.full_name || '—'}</span></div>
                    </>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <PrintReceipt data={toReceipt(selected)} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
