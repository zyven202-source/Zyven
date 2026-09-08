import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Settings, Download, Upload, Store, Shield, LogOut } from 'lucide-react';

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
      await supabase.from('shops').update({
        name: shopName.trim(),
        phone: shopPhone || null,
        address: shopAddress || null,
      }).eq('id', shop.id);
      await refreshShop();
      addToast('success', 'Shop settings saved');
    } catch (err: any) {
      addToast('error', 'Failed to save settings', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!shop) return;
    setExporting(true);
    try {
      // Export all data
      const [products, sales, customers, expenses, shifts, suppliers] = await Promise.all([
        supabase.from('products').select('*').eq('shop_id', shop.id),
        supabase.from('sales').select('*, items:sale_items(*)').eq('shop_id', shop.id),
        supabase.from('customers').select('*').eq('shop_id', shop.id),
        supabase.from('expenses').select('*').eq('shop_id', shop.id),
        supabase.from('shifts').select('*').eq('shop_id', shop.id),
        supabase.from('suppliers').select('*').eq('shop_id', shop.id),
      ]);

      const backup = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        shop: shop,
        products: products.data,
        sales: sales.data,
        customers: customers.data,
        expenses: expenses.data,
        shifts: shifts.data,
        suppliers: suppliers.data,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dukaledger-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Data exported successfully');
    } catch (err: any) {
      addToast('error', 'Export failed', err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4 pb-24 lg:pb-6">
      <h1 className="text-xl font-bold text-text-primary">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-text-secondary">Name</p>
            <p className="text-text-primary">{profile?.full_name || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Email</p>
            <p className="text-text-primary">{profile?.email || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Role</p>
            <p className="text-text-primary">{role || 'CASHIER'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Shop Settings */}
      {(role === 'OWNER' || role === 'MANAGER') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" /> Shop Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shop Name</Label>
              <Input value={shopName} onChange={e => setShopName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={shopPhone} onChange={e => setShopPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={shopAddress} onChange={e => setShopAddress(e.target.value)} placeholder="Optional" />
            </div>
            <Button onClick={handleSaveShop} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Data Management
          </CardTitle>
          <CardDescription>Export and backup your business data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export Business Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card>
        <CardContent className="p-4">
          <Button variant="destructive" className="w-full justify-center gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
