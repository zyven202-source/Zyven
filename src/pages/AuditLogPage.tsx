import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getAuditLogs } from '@/lib/database';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { Shield, Plus, Edit, Trash2, DollarSign, Clock, Package, User } from 'lucide-react';

const actionIcons: Record<string, any> = {
  SALE_CREATED: DollarSign,
  EXPENSE_CREATED: DollarSign,
  SHIFT_OPENED: Clock,
  SHIFT_CLOSED: Clock,
  PRODUCT_CREATED: Plus,
  PRODUCT_EDITED: Edit,
  STOCK_RECEIVED: Package,
};

const actionColors: Record<string, string> = {
  SALE_CREATED: 'text-success',
  EXPENSE_CREATED: 'text-danger',
  SHIFT_OPENED: 'text-primary',
  SHIFT_CLOSED: 'text-primary',
  STOCK_RECEIVED: 'text-success',
};

export default function AuditLogPage() {
  const { shop, role } = useAuth();
  const { addToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) return;
    getAuditLogs(shop.id).then(data => { setLogs(data); setLoading(false); }).catch(() => {
      addToast('error', 'Failed to load audit logs');
      setLoading(false);
    });
  }, [shop]);

  if (role !== 'OWNER') {
    return (
      <div className="p-4 lg:p-6 max-w-7xl mx-auto text-center py-12">
        <Shield className="h-12 w-12 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary">Only the shop owner can view audit logs</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <h1 className="text-xl font-bold text-text-primary">Audit Log</h1>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No audit entries yet</p>
          <p className="text-sm text-text-muted mt-1">Actions will be recorded here automatically</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, i) => {
            const Icon = actionIcons[log.action] || Shield;
            const color = actionColors[log.action] || 'text-text-muted';
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {log.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </p>
                      <p className="text-xs text-text-muted">
                        {log.user?.full_name || 'System'} • {new Date(log.created_at).toLocaleString('en-KE')}
                      </p>
                    </div>
                    {log.metadata && (
                      <div className="text-xs text-text-muted text-right">
                        {log.metadata.total && <p>{`KSh ${String(log.metadata.total)}`}</p>}
                        {log.metadata.amount && <p>{`KSh ${String(log.metadata.amount)}`}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
