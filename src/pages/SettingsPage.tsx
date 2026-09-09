import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Download, Store, Shield, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { shop, profile, role, signOut, refreshShop } = useAuth();
  const { addToast } = useToast();
  const [shopName, setShopName] = useState(shop?.name || '');
  const [shopPhone, setShopPhone] = useState(shop?.phone || '');
  const [shopAddress, setShopAddress] = useState(shop?.address || '');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSaveShop = async () => {
    if (!shop || !shopName.trim()) return;
    setSaving(true);
    try {
      await supabase.from('shops').update({ name: shopName.trim(), phone: shopPhone || null, address: shopAddress || null }).eq('id', shop.id);
      await refreshShop();
      addToast('success', 'Shop settings saved');
    } catch (err: any) { addToast('error', 'Failed to save settings', err.message); } finally { setSaving(false); }
  };

  const handleExport = async () => {
    if (!shop) return;
    setExporting(true);
    try {
      const [products, sales, customers, expenses, shifts, suppliers] = await Promise.all([
        supabase.from('products').select('*').eq('shop_id', shop.id),
        supabase.from('sales').select('*, items:sale_items(*)').eq('shop_id', shop.id),
        supabase.from('customers').select('*').eq('shop_id', shop.id),
        supabase.from('expenses').select('*').eq('shop_id', shop.id),
        supabase.from('shifts').select('*').eq('shop_id', shop.id),
        supabase.from('suppliers').select('*').eq('shop_id', shop.id),
      ]);
      const backup = { version: '1.0', exported_at: new Date().toISOString(), shop, products: products.data, sales: sales.data, customers: customers.data, expenses: expenses.data, shifts: shifts.data, suppliers: suppliers.data };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `zyven-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
      addToast('success', 'Data exported');
    } catch (err: any) { addToast('error', 'Export failed', err.message); } finally { setExporting(false); }
  };

  return (
    <div className="px-4 lg:px-8 py-5 max-w-2xl mx-auto space-y-5 pb-24 lg:pb-6">
      <h1 className="text-xl font-bold text-text">Settings</h1>

      {/* Profile */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-5">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Profile</h3>
        <div className="space-y-3">
          <div><p className="text-[11px] text-text-muted">Name</p><p className="text-sm font-medium text-text">{profile?.full_name || 'Not set'}</p></div>
          <div><p className="text-[11px] text-text-muted">Email</p><p className="text-sm font-medium text-text">{profile?.email || 'Not set'}</p></div>
          <div><p className="text-[11px] text-text-muted">Role</p><p className="text-sm font-medium text-text">{role || 'CASHIER'}</p></div>
        </div>
      </div>

      {/* Shop Settings */}
      {(role === 'OWNER' || role === 'MANAGER') && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2"><Store className="h-3.5 w-3.5" /> Shop</h3>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Shop Name</Label><Input value={shopName} onChange={e => setShopName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Phone</Label><Input value={shopPhone} onChange={e => setShopPhone(e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Address</Label><Input value={shopAddress} onChange={e => setShopAddress(e.target.value)} placeholder="Optional" /></div>
            <Button onClick={handleSaveShop} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>
      )}

      {/* Data */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-5">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2"><Download className="h-3.5 w-3.5" /> Data</h3>
        <Button variant="outline" className="w-full" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4" />{exporting ? 'Exporting...' : 'Export Business Data'}
        </Button>
      </div>

      {/* Sign Out */}
      <button onClick={signOut} className="w-full p-4 rounded-2xl bg-danger-muted border border-danger/15 text-danger font-medium text-sm flex items-center justify-center gap-2 hover:bg-danger/15 transition-colors">
        <LogOut className="h-4 w-4" /> Sign Out
      </button>
    </div>
  );
}
