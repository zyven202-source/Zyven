import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getSuppliers, createSupplier } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Plus, Truck, Phone, Mail } from 'lucide-react';

export default function SuppliersPage() {
  const { shop, role } = useAuth();
  const { addToast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (!shop) return;
    getSuppliers(shop.id).then(data => { setSuppliers(data); setLoading(false); });
  }, [shop]);

  const handleAdd = async () => {
    if (!shop || !formName.trim()) { addToast('error', 'Name is required'); return; }
    try {
      await createSupplier(shop.id, {
        name: formName.trim(),
        phone: formPhone || undefined,
        email: formEmail || undefined,
        notes: formNotes || undefined,
      });
      addToast('success', 'Supplier added');
      setShowAdd(false); setFormName(''); setFormPhone(''); setFormEmail(''); setFormNotes('');
      if (shop) getSuppliers(shop.id).then(setSuppliers);
    } catch (err: any) {
      addToast('error', 'Failed to add supplier', err.message);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Suppliers</h1>
        {(role === 'OWNER' || role === 'MANAGER') && (
          <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Supplier</Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading suppliers...</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="h-12 w-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No suppliers yet</p>
          <p className="text-sm text-text-muted mt-1">Add suppliers to track your sources</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{s.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                      {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                    </div>
                    {s.notes && <p className="text-xs text-text-muted mt-1">{s.notes}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
            <DialogDescription>Add a new supplier</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="Supplier name" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="Phone number" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input placeholder="Email" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Optional notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAdd}>Add Supplier</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
