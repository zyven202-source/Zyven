import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getSalesTrend, getTopProducts, getTotalExpenses } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { BarChart3, TrendingUp, DollarSign, Package, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { SkeletonPage } from '@/components/ui/skeleton';

const COLORS = ['#F59E0B', '#22C55E', '#3B82F6', '#EF4444', '#8B5CF6'];

export default function ReportsPage() {
  const { shop } = useAuth();
  const { addToast } = useToast();
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [summary, setSummary] = useState({ grossRevenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, transactions: 0, outstandingDebt: 0 });
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([]);

  useEffect(() => { if (shop) loadReport(); }, [shop, period]);

  const loadReport = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const [trend, products] = await Promise.all([getSalesTrend(shop.id, period), getTopProducts(shop.id, period)]);
      setSalesTrend(trend);
      setTopProducts(products);
      const totalRevenue = trend.reduce((sum, t) => sum + t.sales, 0);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - period);
      const { data: sales } = await supabase.from('sales').select('id, total, payment_method').eq('shop_id', shop.id).gte('created_at', startDate.toISOString());
      let totalCOGS = 0;
      let totalTransactions = sales?.length || 0;
      if (sales && sales.length > 0) {
        const { data: items } = await supabase.from('sale_items').select('cogs, gross_profit').in('sale_id', sales.map(s => s.id));
        if (items) totalCOGS = items.reduce((sum, i) => sum + Number(i.cogs), 0);
        const breakdown: Record<string, number> = { CASH: 0, 'M-PESA': 0, CREDIT: 0 };
        for (const sale of sales) breakdown[sale.payment_method] = (breakdown[sale.payment_method] || 0) + Number(sale.total);
        setPaymentBreakdown(Object.entries(breakdown).map(([name, value]) => ({ name, value })).filter(p => p.value > 0));
      }
      const expenses = await getTotalExpenses(shop.id, startDate.toISOString().split('T')[0]);
      const { data: debt } = await supabase.from('customers').select('current_balance').eq('shop_id', shop.id).gt('current_balance', 0);
      const outstandingDebt = debt?.reduce((sum, d) => sum + Number(d.current_balance), 0) || 0;
      setSummary({ grossRevenue: totalRevenue, cogs: totalCOGS, grossProfit: totalRevenue - totalCOGS, expenses, netProfit: totalRevenue - totalCOGS - expenses, transactions: totalTransactions, outstandingDebt });
    } catch { addToast('error', 'Failed to load reports'); } finally { setLoading(false); }
  };

  if (loading) {
    return <SkeletonPage label="Loading reports" />;
  }

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="page-header">
        <h1 className="text-xl font-bold text-text">Reports</h1>
        <div className="flex gap-1.5">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setPeriod(d)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', period === d ? 'bg-primary text-text-inverse' : 'bg-surface border border-border-subtle text-text-secondary')}>
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard label="Revenue" value={formatCurrency(summary.grossRevenue)} color="primary" />
        <KpiCard label="COGS" value={formatCurrency(summary.cogs)} color="default" />
        <KpiCard label="Gross Profit" value={formatCurrency(summary.grossProfit)} color="success" />
        <KpiCard label="Expenses" value={formatCurrency(summary.expenses)} color="danger" />
        <KpiCard label="Net Profit" value={formatCurrency(summary.netProfit)} color={summary.netProfit >= 0 ? 'success' : 'danger'} />
        <KpiCard label="Transactions" value={formatNumber(summary.transactions)} color="default" />
        <KpiCard label="Outstanding" value={formatCurrency(summary.outstandingDebt)} color="danger" />
      </div>

      {/* Sales Trend Chart */}
      {salesTrend.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text mb-4">Daily Sales</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesTrend.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A36" />
                <XAxis dataKey="date" tick={{ fill: '#546380', fontSize: 11 }} tickFormatter={v => new Date(v).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fill: '#546380', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#18212B', border: '1px solid #1E2A36', borderRadius: '8px', color: '#F1F5F9' }} formatter={(value) => [formatCurrency(Number(value)), 'Sales']} labelFormatter={v => new Date(String(v)).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })} />
                <Bar dataKey="sales" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Products & Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text mb-4">Top Products</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">No sales data yet</p>
          ) : (
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((product, i) => (
                <div key={product.product_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted w-5 tabular-nums">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-text">{product.product_name}</p>
                      <p className="text-[11px] text-text-muted">{product.quantity_sold} units</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-primary tabular-nums">{formatCurrency(product.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text mb-4">Payment Methods</h3>
          {paymentBreakdown.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">No payment data yet</p>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentBreakdown} cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={4} dataKey="value">
                      {paymentBreakdown.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#18212B', border: '1px solid #1E2A36', borderRadius: '8px', color: '#F1F5F9' }} formatter={(value) => [formatCurrency(Number(value))]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {paymentBreakdown.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-text-secondary">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-text tabular-nums">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary', success: 'text-success', danger: 'text-danger', default: 'text-text',
  };
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-3.5">
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className={cn('text-base font-bold tabular-nums mt-1', colorMap[color] || 'text-text')}>{value}</p>
    </div>
  );
}
