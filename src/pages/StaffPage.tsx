import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Plus, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

export default function StaffPage() {
  const { shop, role } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('CASHIER');

  useEffect(() => { if (shop) loadMembers(); }, [shop]);

  const loadMembers = async () => {
    if (!shop) return;
    setLoading(true);
    const { data } = await supabase.from('shop_members').select('*, profile:profiles(email, full_name)').eq('shop_id', shop.id).order('created_at');
    if (data) setMembers(data);
    setLoading(false);
  };

  const handleAddMember = async () => {
    if (!shop || !formEmail.trim()) { addToast('error', 'Email is required'); return; }
    const { data: users } = await supabase.from('profiles').select('id').eq('email', formEmail.trim()).single();
    if (!users) { addToast('error', 'No user found with this email. They need to sign up first.'); return; }
    const { error } = await supabase.from('shop_members').insert({ shop_id: shop.id, user_id: users.id, role: formRole, is_active: true });
    if (error) { addToast('error', 'Failed to add member', error.message); return; }
    addToast('success', 'Staff member added');
    setShowAdd(false); setFormEmail(''); setFormRole('CASHIER'); loadMembers();
  };

  if (role !== 'OWNER') {
    return (
      <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3"><Shield className="h-6 w-6 text-text-muted" /></div>
        <p className="text-sm text-text-secondary">Only the shop owner can manage staff</p>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="page-header">
        <h1 className="text-xl font-bold text-text">Staff</h1>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Staff</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-1.5 h-1.5 rounded-full bg-primary" /><span className="text-text-muted text-sm ml-3">Loading</span></div>
      ) : members.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3"><Users className="h-6 w-6 text-text-muted" /></div>
          <p className="text-sm font-medium text-text-secondary">No staff members</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-ghost border border-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-sm font-semibold">{m.profile?.full_name?.charAt(0) || '?'}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{m.profile?.full_name || 'Unknown'}</p>
                  <p className="text-[11px] text-text-muted">{m.profile?.email || m.user_id}</p>
                </div>
              </div>
              <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
                m.role === 'OWNER' ? 'bg-primary text-text-inverse' : m.role === 'MANAGER' ? 'bg-success-muted text-success' : 'bg-elevated text-text-muted'
              )}>{m.role}</span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Staff Member</DialogTitle><DialogDescription>Staff must have an account first</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Email *</Label><Input placeholder="staff@email.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} /><p className="text-[11px] text-text-muted">They must have signed up already</p></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-text-secondary">Role *</Label>
              <Select value={formRole} onValueChange={v => setFormRole(v as UserRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MANAGER">Manager</SelectItem><SelectItem value="CASHIER">Cashier</SelectItem></SelectContent></Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddMember}>Add Staff</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
