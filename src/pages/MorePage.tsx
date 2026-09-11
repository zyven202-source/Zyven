import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ArrowDownToLine, Receipt, Truck, BarChart3, Clock, Users2, ShieldCheck, Settings, LogOut, Sparkles, ReceiptText } from 'lucide-react';
import { SkeletonPage } from '@/components/ui/skeleton';

export default function MorePage() {
  const navigate = useNavigate();
  const { role, signOut } = useAuth();

  const items = [
    { label: 'Duka Assistant', icon: Sparkles, path: '/assistant', desc: 'Ask about your numbers' },
    { label: 'Transactions', icon: ReceiptText, path: '/transactions', desc: 'All sales with receipts' },
    { label: 'Stock Management', icon: ArrowDownToLine, path: '/stock', desc: 'Receive and track inventory' },
    { label: 'Expenses', icon: Receipt, path: '/expenses', desc: 'Track shop expenses' },
    { label: 'Suppliers', icon: Truck, path: '/suppliers', desc: 'Manage suppliers', roles: ['OWNER', 'MANAGER'] },
    { label: 'Reports', icon: BarChart3, path: '/reports', desc: 'Analytics and insights', roles: ['OWNER', 'MANAGER'] },
    { label: 'Shifts', icon: Clock, path: '/shifts', desc: 'Cash shift management' },
    { label: 'Staff', icon: Users2, path: '/staff', desc: 'Manage your team', roles: ['OWNER'] },
    { label: 'Audit Log', icon: ShieldCheck, path: '/audit', desc: 'View all actions', roles: ['OWNER'] },
    { label: 'Settings', icon: Settings, path: '/settings', desc: 'App and shop settings' },
  ];

  const filteredItems = items.filter(item => !item.roles || (role && item.roles.includes(role)));

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <h1 className="text-xl font-bold text-text">More</h1>

      <div className="space-y-1.5">
        {filteredItems.map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full text-left flex items-center gap-4 p-4 rounded-xl bg-surface border border-border-subtle hover:border-border transition-colors active:scale-[0.99]"
          >
            <div className="w-10 h-10 rounded-xl bg-elevated flex items-center justify-center flex-shrink-0">
              <item.icon className="h-5 w-5 text-text-secondary" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">{item.label}</p>
              <p className="text-[11px] text-text-muted">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={signOut}
        className="w-full p-4 rounded-2xl bg-danger-muted border border-danger/15 text-danger font-medium text-sm flex items-center justify-center gap-2 hover:bg-danger/15 transition-colors"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </button>
    </div>
  );
}
