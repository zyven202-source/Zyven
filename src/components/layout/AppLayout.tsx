import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, ShoppingCart, Package, Users,
  TrendingUp, ArrowDownToLine, Receipt, BarChart3,
  Settings, Users2, Truck, LogOut, X, Menu, Clock,
  ReceiptText, Sparkles, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const primaryNav: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/daftari', label: 'Daftari', icon: Users },
  { path: '/stock', label: 'Stock', icon: ArrowDownToLine },
];

const secondaryNav: NavItem[] = [
  { path: '/assistant', label: 'Duka Assistant', icon: Sparkles },
  { path: '/transactions', label: 'Transactions', icon: ReceiptText },
  { path: '/expenses', label: 'Expenses', icon: Receipt, roles: ['OWNER', 'MANAGER'] },
  { path: '/shifts', label: 'Shifts', icon: Clock },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
  { path: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['OWNER', 'MANAGER'] },
  { path: '/staff', label: 'Staff', icon: Users2, roles: ['OWNER'] },
  { path: '/audit', label: 'Audit Log', icon: ShieldCheck, roles: ['OWNER'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['OWNER'] },
];

const allNav = [...primaryNav, ...secondaryNav];

export function AppLayout() {
  const { profile, shop, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const filteredSecondary = secondaryNav.filter(
    item => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:flex lg:w-[260px] lg:flex-col bg-surface border-r border-border-subtle">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-border-subtle flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-text-inverse font-bold text-sm">Z</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-text tracking-tight">Zyven</h1>
            <p className="text-[11px] text-text-muted truncate">{shop?.name || 'My Shop'}</p>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-0.5">
            {primaryNav.map(item => (
              <SidebarItem
                key={item.path}
                item={item}
                active={isActive(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="my-4 mx-2 border-t border-border-subtle" />

          {/* Secondary */}
          <div className="space-y-0.5">
            {filteredSecondary.map(item => (
              <SidebarItem
                key={item.path}
                item={item}
                active={isActive(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>
        </nav>

        {/* User Footer */}
        <div className="border-t border-border-subtle p-3 flex-shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-ghost border border-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xs font-semibold">
                {profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-text-muted">{role || 'CASHIER'}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 mt-1 rounded-lg text-sm text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ═══ Mobile Sidebar Overlay ═══ */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-surface z-50 lg:hidden flex flex-col shadow-lg"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-border-subtle flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-text-inverse font-bold text-sm">Z</span>
                  </div>
                  <div>
                    <h1 className="text-sm font-bold text-text">Zyven</h1>
                    <p className="text-[11px] text-text-muted">{shop?.name || 'My Shop'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-elevated transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nav */}
              <nav className="flex-1 overflow-y-auto py-4 px-3">
                <div className="space-y-0.5">
                  {primaryNav.map(item => (
                    <SidebarItem
                      key={item.path}
                      item={item}
                      active={isActive(item.path)}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    />
                  ))}
                </div>
                <div className="my-4 mx-2 border-t border-border-subtle" />
                <div className="space-y-0.5">
                  {filteredSecondary.map(item => (
                    <SidebarItem
                      key={item.path}
                      item={item}
                      active={isActive(item.path)}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    />
                  ))}
                </div>
              </nav>

              {/* Footer */}
              <div className="border-t border-border-subtle p-3 flex-shrink-0">
                <button
                  onClick={() => { signOut(); setSidebarOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border-subtle bg-surface flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-elevated transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-text-inverse font-bold text-[10px]">Z</span>
            </div>
            <span className="text-sm font-semibold text-text tracking-tight">Zyven</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="lg:hidden border-t border-border-subtle bg-surface flex-shrink-0 safe-bottom">
          <div className="flex items-stretch px-1">
            {primaryNav.map(item => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative',
                    active ? 'text-primary' : 'text-text-muted'
                  )}
                >
                  {active && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
                  )}
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="text-[10px] font-medium leading-none mt-0.5">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

/* ──── Sidebar Item Component ──── */
function SidebarItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
        active
          ? 'bg-primary-ghost text-primary'
          : 'text-text-secondary hover:text-text hover:bg-elevated'
      )}
    >
      <item.icon
        className={cn('h-[18px] w-[18px] flex-shrink-0', active && 'text-primary')}
        strokeWidth={active ? 2.2 : 1.8}
      />
      {item.label}
      {active && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </button>
  );
}
