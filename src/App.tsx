import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { initOfflineSystems } from '@/lib/pwa';
import { getQueueSize } from '@/lib/offline';

// Pages
import AuthPage from '@/pages/AuthPage';
import DashboardPage from '@/pages/DashboardPage';
import POSPage from '@/pages/POSPage';
import InventoryPage from '@/pages/InventoryPage';
import StockPage from '@/pages/StockPage';
import DaftariPage from '@/pages/DaftariPage';
import ExpensesPage from '@/pages/ExpensesPage';
import ShiftsPage from '@/pages/ShiftsPage';
import ReportsPage from '@/pages/ReportsPage';
import SuppliersPage from '@/pages/SuppliersPage';
import StaffPage from '@/pages/StaffPage';
import AuditLogPage from '@/pages/AuditLogPage';
import SettingsPage from '@/pages/SettingsPage';
import MorePage from '@/pages/MorePage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import TransactionsPage from '@/pages/TransactionsPage';
import AssistantPage from '@/pages/AssistantPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, shop } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary font-bold text-xl">Z</span>
          </div>
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, shop, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary font-bold text-xl">Z</span>
          </div>
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/:productId" element={<ProductDetailPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/daftari" element={<DaftariPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/more" element={<MorePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function OfflineSyncBridge() {
  const { addToast } = useToast();
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    initOfflineSystems({
      onSynced: (n) => addToast('success', 'Back online', `${n} offline sale${n > 1 ? 's' : ''} synced`),
      onQueued: (n) => { if (n > 0) addToast('warning', 'Offline mode', `${n} sale${n > 1 ? 's' : ''} saved and will sync when online`); },
    });
  }, [addToast]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <OfflineSyncBridge />
          <OfflineBadge />
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function OfflineBadge() {
  const [offline, setOffline] = React.useState(!navigator.onLine);
  const [pending, setPending] = React.useState(getQueueSize());

  React.useEffect(() => {
    const update = () => { setOffline(!navigator.onLine); setPending(getQueueSize()); };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const t = setInterval(update, 10000);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); clearInterval(t); };
  }, []);

  if (!offline && pending === 0) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
      <div className="mt-2 px-3 py-1.5 rounded-full bg-warning text-text-inverse text-[11px] font-semibold shadow-lg">
        {offline ? `Offline — sales are saved locally${pending > 0 ? ` (${pending} pending)` : ''}` : `Syncing ${pending} pending sale${pending > 1 ? 's' : ''}...`}
      </div>
    </div>
  );
}
