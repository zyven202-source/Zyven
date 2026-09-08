import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, ShoppingCart, Package, Users, MoreHorizontal,
  TrendingUp, ArrowDownToLine, Receipt, BarChart3,
  Settings, Users2, Truck, LogOut, X, Menu,
  AlertTriangle, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  mobileOnly?: boolean;
  roles?: UserRole[];
  badge?: number;
}

const mobileNav: NavItem[] = [
  { path: '/', label: 'HOME', icon: Home },
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/inventory', label: 'INVENTORY', icon: Package },
  { path: '/daftari', label: 'DAFTARI', icon: Users },
  { path: '/more', label: 'MORE', icon: MoreHorizontal },
];

const sidebarNav: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/stock', label: 'Stock', icon: ArrowDownToLine },
  { path: '/daftari', label: 'Daftari', icon: Users },
  { path: '/expenses', label: 'Expenses', icon: Receipt, roles: ['OWNER', 'MANAGER'] },
  { path: '/shifts', label: 'Shifts', icon: Clock },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
  { path: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['OWNER', 'MANAGER'] },
  { path: '/staff', label: 'Staff', icon: Users2, roles: ['OWNER'] },
  { path: '/audit', label: 'Audit Log', icon: TrendingUp, roles: ['OWNER'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['OWNER'] },
];

const moreNav: NavItem[] = [
  { path: '/stock', label: 'Stock', icon: ArrowDownToLine },
  { path: '/expenses', label: 'Expenses', icon: Receipt },
  { path: '/suppliers', label: 'Suppliers', icon: Truck },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/shifts', label: 'Shifts', icon: Clock },
  { path: '/staff', label: 'Staff', icon: Users2 },
  { path: '/audit', label: 'Audit Log', icon: TrendingUp },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { profile, shop, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const isMorePage = location.pathname === '/more';

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-bg">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-surface border-r border-border">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">                    <span className="text-primary font-bold text-lg">Z</span>
          </div>
          <div><h1 className="text-sm font-bold text-text-primary">Zyven</h1>
                    <p className="text-xs text-text-muted truncate max-w-[150px]">{shop?.name || 'My Shop'}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {sidebarNav.map(item => {
            if (item.roles && role && !item.roles.includes(role)) return null;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center text-sm font-medium text-text-primary">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-text-muted truncate">{role || 'CASHIER'}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 mt-1" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-surface z-50 lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">Z</span>
                  </div>
                  <div>
                    <h1 className="text-sm font-bold text-text-primary">Zyven</h1>
                    <p className="text-xs text-text-muted">{shop?.name || 'My Shop'}</p>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-text-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
                {sidebarNav.map(item => {
                  if (item.roles && role && !item.roles.includes(role)) return null;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-border p-3">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <button onClick={() => setSidebarOpen(true)} className="text-text-secondary">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">Z</span>
            </div>
            <span className="text-sm font-bold text-text-primary">Zyven</span>
          </div>
          <div className="w-6" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden border-t border-border bg-surface safe-bottom">
          <div className="flex items-center justify-around px-2 py-1">
            {mobileNav.map(item => {
              const isActive = item.path === '/more'
                ? isMorePage
                : location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors min-w-[60px]',
                    isActive ? 'text-primary' : 'text-text-muted'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
