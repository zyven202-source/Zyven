import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/toast';
import { AppLayout } from '@/components/layout/AppLayout';

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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, shop } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-primary font-bold text-xl">Z</span>
          </div>
          <p className="text-text-muted text-sm">Loading Zyven...</p>
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
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-primary font-bold text-xl">Z</span>
          </div>
          <p className="text-text-muted text-sm">Loading Zyven...</p>
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
