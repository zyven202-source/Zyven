import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowDownToLine, Receipt, Truck, BarChart3, Clock,
  Users2, TrendingUp, Settings, LogOut,
} from 'lucide-react';

export default function MorePage() {
  const navigate = useNavigate();
  const { role, signOut } = useAuth();

  const items = [
    { label: 'Stock Management', icon: ArrowDownToLine, path: '/stock', desc: 'Receive and track inventory' },
    { label: 'Expenses', icon: Receipt, path: '/expenses', desc: 'Track shop expenses' },
    { label: 'Suppliers', icon: Truck, path: '/suppliers', desc: 'Manage suppliers', roles: ['OWNER', 'MANAGER'] },
    { label: 'Reports', icon: BarChart3, path: '/reports', desc: 'Analytics and insights', roles: ['OWNER', 'MANAGER'] },
    { label: 'Shifts', icon: Clock, path: '/shifts', desc: 'Cash shift management' },
    { label: 'Staff', icon: Users2, path: '/staff', desc: 'Manage your team', roles: ['OWNER'] },
    { label: 'Audit Log', icon: TrendingUp, path: '/audit', desc: 'View all system actions', roles: ['OWNER'] },
    { label: 'Settings', icon: Settings, path: '/settings', desc: 'App and shop settings' },
  ];

  const filteredItems = items.filter(item => !item.roles || (role && item.roles.includes(role)));

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <h1 className="text-xl font-bold text-text-primary">More</h1>

      <div className="space-y-2">
        {filteredItems.map(item => (
          <Card
            key={item.path}
            className="cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => navigate(item.path)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-elevated flex items-center justify-center">
                <item.icon className="h-5 w-5 text-text-secondary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-text-primary">{item.label}</p>
                <p className="text-xs text-text-muted">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <button
        onClick={signOut}
        className="w-full p-4 rounded-xl bg-danger/10 text-danger font-medium text-center hover:bg-danger/20 transition-colors"
      >
        <LogOut className="h-5 w-5 mx-auto mb-1" />
        Sign Out
      </button>
    </div>
  );
}
