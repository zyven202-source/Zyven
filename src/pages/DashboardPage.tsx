import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getDashboardData } from '@/lib/database';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  ShoppingCart, TrendingUp, Users, AlertTriangle,
  Plus, ArrowUpRight, Wallet, CreditCard, Package, Clock,
} from 'lucide-react';

export default function DashboardPage() {
  const { shop, profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) return;
    getDashboardData(shop.id).then(d => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [shop]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const today = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-text-muted text-sm">Loading dashboard</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* ──── Header ──── */}
      <div>
        <h1 className="text-2xl font-bold text-text tracking-tight">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-text-muted mt-1">{today}</p>
      </div>

      {/* ──── Hero KPI: Today's Sales ──── */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-5">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Today's Sales</p>
        <p className="kpi-value text-primary">
          {formatCurrency(data?.todaySales || 0)}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="status-dot status-dot-success" />
          <span className="text-xs text-text-secondary">{formatNumber(data?.transactionCount || 0)} transactions</span>
        </div>
      </div>

      {/* ──── Secondary KPIs ──── */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Net Profit"
          value={formatCurrency(data?.netProfit || 0)}
          icon={TrendingUp}
          color="success"
        />
        <KpiCard
          label="Cash Today"
          value={formatCurrency(data?.cashSales || 0)}
          icon={Wallet}
          color="text"
        />
        <KpiCard
          label="M-Pesa Today"
          value={formatCurrency(data?.mpesaSales || 0)}
          icon={CreditCard}
          color="primary"
        />
        <KpiCard
          label="Outstanding"
          value={formatCurrency(data?.outstandingDebt || 0)}
          icon={Users}
          color="danger"
        />
      </div>

      {/* ──── Quick Actions ──── */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: 'Sale', icon: ShoppingCart, path: '/pos', accent: true },
          { label: 'Credit', icon: Users, path: '/daftari', accent: false },
          { label: 'Payment', icon: ArrowUpRight, path: '/daftari', accent: false },
          { label: 'Stock', icon: Package, path: '/stock', accent: false },
        ].map(action => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className={cn(
              'flex flex-col items-center gap-2 py-4 rounded-xl transition-all active:scale-[0.97]',
              action.accent
                ? 'bg-primary text-text-inverse'
                : 'bg-surface border border-border-subtle text-text-secondary hover:text-text hover:border-border'
            )}
          >
            <action.icon className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {/* ──── Needs Attention ──── */}
      {(data?.lowStockProducts?.length > 0 || data?.overdueCustomers?.length > 0 || data?.activeShift) && (
        <div>
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Needs Attention
          </h2>
          <div className="space-y-2">
            {data?.activeShift && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border-subtle">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-ghost flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">Active Shift</p>
                    <p className="text-xs text-text-muted">
                      Opened {new Date(data.activeShift.opened_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/shifts')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary-ghost hover:bg-primary/15 transition-colors"
                >
                  View
                </button>
              </div>
            )}

            {data?.lowStockProducts?.slice(0, 3).map((product: any) => (
              <div key={product.id} className="flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border-subtle">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-warning-muted flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{product.name}</p>
                    <p className="text-xs text-text-muted">
                      {product.current_stock === 0 ? 'Out of stock' : `Only ${product.current_stock} left`}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ml-3',
                  product.current_stock === 0
                    ? 'bg-danger-muted text-danger'
                    : 'bg-warning-muted text-warning'
                )}>
                  {product.current_stock === 0 ? 'OOS' : 'LOW'}
                </span>
              </div>
            ))}

            {data?.overdueCustomers?.slice(0, 3).map((customer: any) => (
              <div key={customer.id} className="flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border-subtle">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-danger-muted flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-danger" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{customer.full_name}</p>
                    <p className="text-xs text-text-muted">Owes {formatCurrency(customer.current_balance)}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/daftari')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-danger bg-danger-muted hover:bg-danger/15 transition-colors"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──── KPI Card ──── */
function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'success' | 'primary' | 'danger' | 'text';
}) {
  const colorMap = {
    success: 'text-success',
    primary: 'text-primary',
    danger: 'text-danger',
    text: 'text-text',
  };
  const bgMap = {
    success: 'bg-success-muted',
    primary: 'bg-primary-ghost',
    danger: 'bg-danger-muted',
    text: 'bg-elevated',
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-4">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bgMap[color])}>
        <Icon className={cn('h-4 w-4', colorMap[color])} strokeWidth={1.8} />
      </div>
      <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
      <p className={cn('kpi-value-sm mt-1', colorMap[color])}>{value}</p>
    </div>
  );
}
