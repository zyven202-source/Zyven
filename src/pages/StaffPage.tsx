import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Plus, Users, Shield } from 'lucide-react';
import type { UserRole } from '@/types';

const roleColors: Record<UserRole, string> = {
  OWNER: 'text-primary',
  MANAGER: 'text-success',
  CASHIER: 'text-text-secondary',
};

export default function StaffPage() {
  const { shop, role } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('CASHIER');

  useEffect(() => {
    if (!shop) return;
    loadMembers();
  }, [shop]);

  const loadMembers = async () => {
    if (!shop) return;
    setLoading(true);
    const { data } = await supabase
      .from('shop_members')
      .select('*, profile:profiles(email, full_name)')
      .eq('shop_id', shop.id)
      .order('created_at');
    if (data) setMembers(data);
    setLoading(false);
  };

  const handleAddMember = async () => {
    if (!shop || !formEmail.trim()) {
      addToast('error', 'Email is required');
      return;
    }
    // Find user by email
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', formEmail.trim())
      .single();

    if (!users) {
      addToast('error', 'No user found with this email. They need to sign up first.');
      return;
    }

    const { error } = await supabase.from('shop_members').insert({
      shop_id: shop.id,
      user_id: users.id,
      role: formRole,
      is_active: true,
    });

    if (error) {
      addToast('error', 'Failed to add member', error.message);
      return;
    }

    addToast('success', 'Staff member added');
    setShowAdd(false);
    setFormEmail('');
    setFormRole('CASHIER');
    loadMembers();
  };

  if (role !== 'OWNER') {
    return (
      <div className="p-4 lg:p-6 max-w-7xl mx-auto text-center py-12">
        <Shield className="h-12 w-12 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary">Only the shop owner can manage staff</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Staff</h1>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Staff</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading staff...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No staff members</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center text-sm font-bold text-text-primary">
                    {m.profile?.full_name?.charAt(0) || m.user_id?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{m.profile?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-text-muted">{m.profile?.email || m.user_id}</p>
                  </div>
                </div>
                <Badge variant={m.role === 'OWNER' ? 'default' : m.role === 'MANAGER' ? 'success' : 'secondary'}>
                  {m.role}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>Staff must have an account to be added</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input placeholder="staff@email.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
              <p className="text-xs text-text-muted">The person must have already signed up</p>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={formRole} onValueChange={v => setFormRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                </SelectContent>
              </Select>
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
