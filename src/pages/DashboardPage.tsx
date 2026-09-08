import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { getDashboardData } from '@/lib/database';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  ShoppingCart, TrendingUp, Receipt, Users, AlertTriangle,
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
          <div className="w-2 h-2 rounded-full bg-primary animate-[pulse_1.5s_ease-in-out_infinite]" />
          <span className="text-text-muted text-sm">Loading dashboard</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-text-primary">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-text-secondary mt-1">{today}</p>
      </div>

      {/* Main KPI */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-primary/5 border border-primary/15">
          <CardContent className="p-5">
            <p className="text-sm text-text-secondary mb-1">Today's Sales</p>
            <p className="text-3xl lg:text-4xl font-bold text-primary">
              {formatCurrency(data?.todaySales || 0)}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs text-text-secondary">{formatNumber(data?.transactionCount || 0)} sales</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Net Profit',
            value: formatCurrency(data?.netProfit || 0),
            icon: TrendingUp,
            color: 'text-success',
            delay: 0.15,
          },
          {
            label: 'Cash Today',
            value: formatCurrency(data?.cashSales || 0),
            icon: Wallet,
            color: 'text-text-primary',
            delay: 0.2,
          },
          {
            label: 'M-Pesa Today',
            value: formatCurrency(data?.mpesaSales || 0),
            icon: CreditCard,
            color: 'text-primary',
            delay: 0.25,
          },
          {
            label: 'Outstanding Debt',
            value: formatCurrency(data?.outstandingDebt || 0),
            icon: Users,
            color: 'text-danger',
            delay: 0.3,
          },
        ].map((kpi) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: kpi.delay }}
          >
            <Card className="bg-surface">
              <CardContent className="p-4">
                <kpi.icon className={`h-4 w-4 ${kpi.color} mb-2`} />
                <p className="text-xs text-text-muted">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color} mt-0.5`}>{kpi.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '+ SALE', icon: ShoppingCart, path: '/pos', color: 'bg-primary text-bg' },
            { label: '+ CREDIT', icon: Users, path: '/daftari', color: 'bg-elevated text-text-primary border border-border' },
            { label: '+ PAYMENT', icon: ArrowUpRight, path: '/daftari', color: 'bg-success/10 text-success' },
            { label: '+ STOCK', icon: Package, path: '/stock', color: 'bg-elevated text-text-primary border border-border' },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all active:scale-95 ${action.color}`}
            >
              <action.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Needs Attention */}
      {(data?.lowStockProducts?.length > 0 || data?.overdueCustomers?.length > 0 || data?.activeShift) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.activeShift && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-elevated">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">Active Shift</p>
                      <p className="text-xs text-text-muted">Opened at {new Date(data.activeShift.opened_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/shifts')}>
                    View
                  </Button>
                </div>
              )}
              {data?.lowStockProducts?.slice(0, 3).map((product: any) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-elevated">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-warning" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{product.name}</p>
                      <p className="text-xs text-text-muted">
                        {product.current_stock === 0 ? 'Out of stock' : `Only ${product.current_stock} left`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={product.current_stock === 0 ? 'danger' : 'warning'}>
                    {product.current_stock === 0 ? 'OOS' : 'LOW'}
                  </Badge>
                </div>
              ))}
              {data?.overdueCustomers?.slice(0, 3).map((customer: any) => (
                <div key={customer.id} className="flex items-center justify-between p-3 rounded-lg bg-elevated">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-danger" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{customer.full_name}</p>
                      <p className="text-xs text-text-muted">Owes {formatCurrency(customer.current_balance)}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/daftari')}>
                    View
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
