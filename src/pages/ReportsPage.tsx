import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getSalesTrend, getTopProducts, getTotalExpenses, getTodaySales } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#F59E0B', '#22C55E', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ReportsPage() {
  const { shop } = useAuth();
  const { addToast } = useToast();
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    grossRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    transactions: 0,
    outstandingDebt: 0,
  });
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([]);

  useEffect(() => {
    if (!shop) return;
    loadReport();
  }, [shop, period]);

  const loadReport = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const [trend, products] = await Promise.all([
        getSalesTrend(shop.id, period),
        getTopProducts(shop.id, period),
      ]);

      setSalesTrend(trend);
      setTopProducts(products);

      // Calculate summary
      const totalRevenue = trend.reduce((sum, t) => sum + t.sales, 0);

      // Get COGS from sale items
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
      const { data: sales } = await supabase
        .from('sales')
        .select('id, total, payment_method')
        .eq('shop_id', shop.id)
        .gte('created_at', startDate.toISOString());

      let totalCOGS = 0;
      let totalTransactions = sales?.length || 0;

      if (sales && sales.length > 0) {
        const { data: items } = await supabase
          .from('sale_items')
          .select('cogs, gross_profit')
          .in('sale_id', sales.map(s => s.id));

        if (items) {
          totalCOGS = items.reduce((sum, i) => sum + Number(i.cogs), 0);
        }

        // Payment breakdown
        const breakdown: Record<string, number> = { CASH: 0, 'M-PESA': 0, CREDIT: 0 };
        for (const sale of sales) {
          breakdown[sale.payment_method] = (breakdown[sale.payment_method] || 0) + Number(sale.total);
        }
        setPaymentBreakdown(Object.entries(breakdown).map(([name, value]) => ({ name, value })).filter(p => p.value > 0));
      }

      const expenses = await getTotalExpenses(shop.id, startDate.toISOString().split('T')[0]);

      // Outstanding debt
      const { data: debt } = await supabase
        .from('customers')
        .select('current_balance')
        .eq('shop_id', shop.id)
        .gt('current_balance', 0);
      const outstandingDebt = debt?.reduce((sum, d) => sum + Number(d.current_balance), 0) || 0;

      setSummary({
        grossRevenue: totalRevenue,
        cogs: totalCOGS,
        grossProfit: totalRevenue - totalCOGS,
        expenses,
        netProfit: totalRevenue - totalCOGS - expenses,
        transactions: totalTransactions,
        outstandingDebt,
      });
    } catch {
      addToast('error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-text-muted">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Reports & Analytics</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === d ? 'bg-primary text-bg' : 'bg-elevated text-text-secondary'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Gross Revenue', value: formatCurrency(summary.grossRevenue), icon: DollarSign, color: 'text-primary' },
          { label: 'COGS', value: formatCurrency(summary.cogs), icon: Package, color: 'text-text-secondary' },
          { label: 'Gross Profit', value: formatCurrency(summary.grossProfit), icon: TrendingUp, color: 'text-success' },
          { label: 'Expenses', value: formatCurrency(summary.expenses), icon: TrendingDown, color: 'text-danger' },
          { label: 'Net Profit', value: formatCurrency(summary.netProfit), icon: DollarSign, color: summary.netProfit >= 0 ? 'text-success' : 'text-danger' },
          { label: 'Transactions', value: formatNumber(summary.transactions), icon: ShoppingCart, color: 'text-text-primary' },
          { label: 'Outstanding', value: formatCurrency(summary.outstandingDebt), icon: Users, color: 'text-danger' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <kpi.icon className={`h-4 w-4 ${kpi.color} mb-1`} />
              <p className="text-xs text-text-muted">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Trend Chart */}
      {salesTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#26313C" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    tickFormatter={v => new Date(v).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#18212B', border: '1px solid #26313C', borderRadius: '8px' }}
                    labelStyle={{ color: '#F8FAFC' }}
                    formatter={(value) => [formatCurrency(Number(value)), 'Sales']}
                    labelFormatter={v => new Date(String(v)).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  />
                  <Bar dataKey="sales" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products & Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No sales data yet</p>
            ) : (
              <div className="space-y-3">
                {topProducts.slice(0, 5).map((product, i) => (
                  <div key={product.product_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-muted w-5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{product.product_name}</p>
                        <p className="text-xs text-text-muted">{product.quantity_sold} units sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-primary">{formatCurrency(product.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No payment data yet</p>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentBreakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#18212B', border: '1px solid #26313C', borderRadius: '8px' }}
                        formatter={(value) => [formatCurrency(Number(value))]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {paymentBreakdown.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-text-secondary">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-text-primary">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
