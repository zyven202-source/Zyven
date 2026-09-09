import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Download, Upload, Store, Shield, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { shop, profile, role, signOut, refreshShop } = useAuth();
  const { addToast } = useToast();
  const [shopName, setShopName] = useState(shop?.name || '');
  const [shopPhone, setShopPhone] = useState(shop?.phone || '');
  const [shopAddress, setShopAddress] = useState(shop?.address || '');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleImport = async (file: File) => {
    if (!shop) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      // Validate structure before writing anything
      if (!backup || backup.version !== '1.0' || !backup.shop || typeof backup.shop.id !== 'string') {
        addToast('error', 'Invalid backup file', 'This does not look like a Zyven export.');
        return;
      }
      if (backup.shop.id !== shop.id) {
        addToast('error', 'Wrong shop backup', `This backup belongs to "${backup.shop.name}". You can only restore into the same shop.`);
        return;
      }
      const counts = {
        products: Array.isArray(backup.products) ? backup.products.length : 0,
        customers: Array.isArray(backup.customers) ? backup.customers.length : 0,
        expenses: Array.isArray(backup.expenses) ? backup.expenses.length : 0,
        suppliers: Array.isArray(backup.suppliers) ? backup.suppliers.length : 0,
      };
      const ok = window.confirm(
        `Restore backup from ${new Date(backup.exported_at).toLocaleString('en-KE')}?\n\n` +
        `It contains ${counts.products} products, ${counts.customers} customers, ${counts.expenses} expenses, ${counts.suppliers} suppliers.\n\n` +
        'Existing records with the same IDs will be updated; nothing will be deleted.'
      );
      if (!ok) return;

      // Upsert non-financial master data only (never overwrite transactions)
      const upsert = async (table: string, rows: Record<string, unknown>[] | null | undefined, cols: string[]) => {
        if (!rows || rows.length === 0) return;
        const payload = rows.map((r) => {
          const o: Record<string, unknown> = { id: r.id };
          for (const c of cols) if (r[c] !== undefined) o[c] = r[c];
          return o;
        });
        const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
        if (error) throw error;
      };

      await upsert('suppliers', backup.suppliers, ['name', 'phone', 'email', 'address', 'notes']);
      await upsert('customers', backup.customers, ['full_name', 'phone', 'notes', 'current_balance']);
      await upsert('products', backup.products, ['name', 'barcode', 'sku', 'buying_price', 'selling_price', 'minimum_stock', 'unit', 'notes', 'is_active']);
      await upsert('expenses', backup.expenses, ['amount', 'category', 'description', 'expense_date', 'payment_method']);

      addToast('success', 'Restore complete', 'Master data has been restored.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      addToast('error', 'Import failed', message);
    }
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
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />{exporting ? 'Exporting...' : 'Export Business Data'}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import / Restore Backup
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }}
          />
          <p className="text-[11px] text-text-muted">Restore only updates products, customers, suppliers and expenses. Sales history is never modified.</p>
        </div>
      </div>

      {/* Sign Out */}
      <button onClick={signOut} className="w-full p-4 rounded-2xl bg-danger-muted border border-danger/15 text-danger font-medium text-sm flex items-center justify-center gap-2 hover:bg-danger/15 transition-colors">
        <LogOut className="h-4 w-4" /> Sign Out
      </button>
    </div>
  );
}
