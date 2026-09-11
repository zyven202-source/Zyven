import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getProduct, getStockMovements, getProductPriceHistory } from '@/lib/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  ArrowLeft, Package, AlertTriangle, History, Receipt, TrendingUp, Pencil,
} from 'lucide-react';
import { SkeletonDetail } from '@/components/ui/skeleton';

type Tab = 'overview' | 'stock' | 'prices' | 'sales';

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { shop, user } = useAuth();
  const { addToast } = useToast();
  const [product, setProduct] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [sales, setSales] = useState<{ units7: number; units30: number; unitsLifetime: number; velocity: number; estDaysLeft: number | null }>({ units7: 0, units30: 0, unitsLifetime: 0, velocity: 0, estDaysLeft: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop || !productId) return;
    (async () => {
      try {
        const p = await getProduct(shop.id, productId);
        setProduct(p);
        const [movements, prices] = await Promise.all([
          getStockMovements(shop.id, productId),
          getProductPriceHistory(productId),
        ]);
        setStockHistory(movements);
        setPriceHistory(prices);

        // Sales velocity from sale_items
        const { data: items } = await supabase
          .from('sale_items')
          .select('quantity, created_at, sale_id, sales!inner(shop_id, created_at)')
          .eq('product_id', productId)
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
        const rows = (items || []) as any[];
        const now = Date.now();
        const units7 = rows.filter(r => now - new Date(r.created_at).getTime() <= 7 * 86400000).reduce((s, r) => s + r.quantity, 0);
        const units30 = rows.reduce((s, r) => s + r.quantity, 0);
        const { count: lifetime } = await supabase
          .from('sale_items')
          .select('quantity', { count: 'exact', head: true })
          .eq('product_id', productId);
        const velocity = units30 / 30;
        const estDaysLeft = velocity > 0 ? Math.floor(p.current_stock / velocity) : null;
        setSales({ units7, units30, unitsLifetime: lifetime || 0, velocity, estDaysLeft });
      } catch {
        addToast('error', 'Failed to load product');
        navigate('/inventory');
      } finally {
        setLoading(false);
      }
    })();
  }, [shop, productId, navigate, addToast]);

  if (loading) {
    return <SkeletonDetail />;
  }
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center">
          <Package className="h-6 w-6 text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text-secondary">Product not found</p>
        <Button variant="outline" onClick={() => navigate('/inventory')}>Back to Inventory</Button>
      </div>
    );
  }

  const profit = Number(product.selling_price) - Number(product.buying_price);
  const margin = Number(product.selling_price) > 0 ? (profit / Number(product.selling_price)) * 100 : 0;
  const isOOS = product.current_stock === 0;
  const isLow = product.current_stock <= product.minimum_stock && !isOOS;
  const expirySoon = product.expiry_date && new Date(product.expiry_date).getTime() - Date.now() < 30 * 86400000;
  const expired = product.expiry_date && new Date(product.expiry_date).getTime() < Date.now();

  return (
    <div className="px-4 lg:px-8 py-5 max-w-4xl mx-auto space-y-5 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/inventory')} className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-elevated transition-colors" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-text truncate">{product.name}</h1>
          <p className="text-xs text-text-muted">
            {product.barcode && `BC ${product.barcode}`} {product.sku && `· SKU ${product.sku}`} {product.category && `· ${product.category.name}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/inventory', { state: { editProduct: product } })}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </div>

      {/* Status banner */}
      {(isOOS || isLow || expired || expirySoon) && (
        <div className={cn('px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium',
          expired ? 'bg-danger-muted text-danger' : isOOS ? 'bg-danger-muted text-danger' : expirySoon ? 'bg-warning-muted text-warning' : 'bg-warning-muted text-warning')}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {expired ? `Expired on ${new Date(product.expiry_date).toLocaleDateString()}` :
            isOOS ? 'Out of stock' :
            expirySoon ? `Expiring soon: ${new Date(product.expiry_date).toLocaleDateString()}` :
            `Low stock: ${product.current_stock} left (min ${product.minimum_stock})`}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto">
        {([['overview', 'Overview'], ['stock', 'Stock History'], ['prices', 'Price History'], ['sales', 'Sales']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              tab === key ? 'bg-primary text-text-inverse' : 'bg-surface border border-border-subtle text-text-secondary')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border-subtle rounded-xl p-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Buying Price</p>
              <p className="kpi-value-sm text-text mt-1">{formatCurrency(Number(product.buying_price))}</p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Selling Price</p>
              <p className="kpi-value-sm text-primary mt-1">{formatCurrency(Number(product.selling_price))}</p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Profit / Unit</p>
              <p className="kpi-value-sm text-success mt-1">{formatCurrency(profit)}</p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Margin</p>
              <p className="kpi-value-sm text-text mt-1">{margin.toFixed(1)}%</p>
            </div>
          </div>
          <div className="bg-surface border border-border-subtle rounded-xl p-4 space-y-2">
            <Row label="Current Stock" value={`${product.current_stock} ${product.unit || 'pcs'}`} accent={isOOS ? 'danger' : isLow ? 'warning' : undefined} />
            <Row label="Minimum Stock" value={`${product.minimum_stock}`} />
            <Row label="Stock Value (cost)" value={formatCurrency(Number(product.buying_price) * product.current_stock)} />
            <Row label="Potential Revenue" value={formatCurrency(Number(product.selling_price) * product.current_stock)} accent="primary" />
            <Row label="Potential Profit" value={formatCurrency(profit * product.current_stock)} accent="success" />
            {product.expiry_date && <Row label="Expiry Date" value={new Date(product.expiry_date).toLocaleDateString()} accent={expired ? 'danger' : expirySoon ? 'warning' : undefined} />}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">7-Day Sales</p>
              <p className="text-base font-bold text-text tabular-nums mt-1">{sales.units7}</p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">30-Day Sales</p>
              <p className="text-base font-bold text-text tabular-nums mt-1">{sales.units30}</p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-4 text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Velocity /day</p>
              <p className="text-base font-bold text-text tabular-nums mt-1">{sales.velocity.toFixed(1)}</p>
            </div>
          </div>
          {sales.estDaysLeft !== null && (
            <div className="px-4 py-3 rounded-xl bg-elevated text-sm text-text-secondary flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
              At current velocity, ~{sales.estDaysLeft} days of stock remain (estimate based on last 30 days).
            </div>
          )}
        </div>
      )}

      {tab === 'stock' && (
        <div className="bg-surface border border-border-subtle rounded-xl divide-y divide-[color:var(--color-border-subtle)]">
          {stockHistory.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No stock movements yet</p>
          ) : stockHistory.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <History className="h-4 w-4 text-text-muted flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{m.movement_type.replace(/_/g, ' ')}</p>
                  <p className="text-[11px] text-text-muted truncate">{m.reason || '—'} · {new Date(m.created_at).toLocaleString('en-KE')}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className={cn('text-sm font-bold tabular-nums', m.quantity_change > 0 ? 'text-success' : 'text-danger')}>
                  {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                </p>
                {m.buying_price && <p className="text-[10px] text-text-muted">buy {formatCurrency(Number(m.buying_price))}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'prices' && (
        <div className="bg-surface border border-border-subtle rounded-xl divide-y divide-[color:var(--color-border-subtle)]">
          {priceHistory.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No price changes recorded</p>
          ) : priceHistory.map((h, i) => {
            const prev = priceHistory[i + 1];
            const sellChanged = !prev || Number(prev.selling_price) !== Number(h.selling_price);
            const buyChanged = !prev || Number(prev.buying_price) !== Number(h.buying_price);
            return (
              <div key={h.id} className="flex items-center justify-between p-3.5">
                <div>
                  <p className="text-sm text-text">
                    {buyChanged && <span>Buy {formatCurrency(Number(h.buying_price))} </span>}
                    {sellChanged && <span>· Sell {formatCurrency(Number(h.selling_price))}</span>}
                    {!buyChanged && !sellChanged && <span className="text-text-muted">No change</span>}
                  </p>
                  <p className="text-[11px] text-text-muted">{new Date(h.created_at).toLocaleString('en-KE')}</p>
                </div>
                {i === 0 && <span className="px-2 py-0.5 rounded-md bg-primary-ghost text-primary text-[10px] font-bold uppercase">Current</span>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'sales' && (
        <div className="bg-surface border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Receipt className="h-4 w-4 text-primary" />
            Actual recorded sales for this product
          </div>
          <Row label="Last 7 days" value={`${sales.units7} units`} />
          <Row label="Last 30 days" value={`${sales.units30} units`} />
          <Row label="Lifetime units sold" value={`${sales.unitsLifetime}`} />
          <Row label="Average velocity" value={`${sales.velocity.toFixed(2)} units/day`} accent="primary" />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: 'primary' | 'success' | 'danger' | 'warning' }) {
  const map: Record<string, string> = {
    primary: 'text-primary', success: 'text-success', danger: 'text-danger', warning: 'text-warning', undefined: 'text-text',
  };
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={cn('font-medium tabular-nums', map[String(accent)])}>{value}</span>
    </div>
  );
}
