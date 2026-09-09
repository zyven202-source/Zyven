import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getAuditLogs } from '@/lib/database';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { Shield, Plus, Edit, DollarSign, Clock, Package } from 'lucide-react';

const actionIcons: Record<string, React.ElementType> = {
  SALE_CREATED: DollarSign, EXPENSE_CREATED: DollarSign, SHIFT_OPENED: Clock, SHIFT_CLOSED: Clock, PRODUCT_CREATED: Plus, PRODUCT_EDITED: Edit, STOCK_RECEIVED: Package,
};
const actionColors: Record<string, string> = {
  SALE_CREATED: 'text-success', EXPENSE_CREATED: 'text-danger', SHIFT_OPENED: 'text-primary', SHIFT_CLOSED: 'text-primary', STOCK_RECEIVED: 'text-success',
};

export default function AuditLogPage() {
  const { shop, role } = useAuth();
  const { addToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) return;
    getAuditLogs(shop.id).then(data => { setLogs(data); setLoading(false); }).catch(() => { addToast('error', 'Failed to load audit logs'); setLoading(false); });
  }, [shop]);

  if (role !== 'OWNER') {
    return (
      <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3"><Shield className="h-6 w-6 text-text-muted" /></div>
        <p className="text-sm text-text-secondary">Only the shop owner can view audit logs</p>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <h1 className="text-xl font-bold text-text">Audit Log</h1>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-1.5 h-1.5 rounded-full bg-primary" /><span className="text-text-muted text-sm ml-3">Loading</span></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3"><Shield className="h-6 w-6 text-text-muted" /></div>
          <p className="text-sm font-medium text-text-secondary">No audit entries yet</p>
          <p className="text-xs text-text-muted mt-1">Actions are recorded automatically</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map(log => {
            const Icon = actionIcons[log.action] || Shield;
            const color = actionColors[log.action] || 'text-text-muted';
            return (
              <div key={log.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-surface border border-border-subtle">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', color === 'text-success' ? 'bg-success-muted' : color === 'text-danger' ? 'bg-danger-muted' : 'bg-primary-ghost')}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{log.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                  <p className="text-[11px] text-text-muted">{log.user?.full_name || 'System'} · {new Date(log.created_at).toLocaleString('en-KE')}</p>
                </div>
                {log.metadata && (
                  <div className="text-xs text-text-muted text-right flex-shrink-0">
                    {log.metadata.total && <p className="tabular-nums">KSh {String(log.metadata.total)}</p>}
                    {log.metadata.amount && <p className="tabular-nums">KSh {String(log.metadata.amount)}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
