// Offline-first queue: localStorage-backed, idempotent sync via client_ref UUIDs
import { supabase } from './supabase';

const QUEUE_KEY = 'zyven_offline_queue';

export interface QueuedSale {
  client_ref: string;
  shop_id: string;
  user_id: string;
  cart: unknown[];
  payment_method: string;
  customer_id?: string;
  mpesa_reference?: string;
  discount: number;
  shift_id?: string;
  queued_at: string;
}

function readQueue(): QueuedSale[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedSale[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueueSize(): number {
  return readQueue().length;
}

export function enqueueSale(sale: Omit<QueuedSale, 'queued_at'>): string {
  const queue = readQueue();
  const entry: QueuedSale = { ...sale, queued_at: new Date().toISOString() };
  queue.push(entry);
  writeQueue(queue);
  return entry.client_ref;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Sync all queued sales. Uses process_sale_atomic RPC which is idempotent
 * (duplicate client_ref returns the existing sale, no double-write).
 * Returns number of sales successfully synced.
 */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: QueuedSale[] = [];

  for (const entry of queue) {
    try {
      const { error } = await supabase.rpc('process_sale_atomic', {
        p_shop_id: entry.shop_id,
        p_user_id: entry.user_id,
        p_client_ref: entry.client_ref,
        p_cart: entry.cart,
        p_payment_method: entry.payment_method,
        p_customer_id: entry.customer_id || null,
        p_mpesa_reference: entry.mpesa_reference || null,
        p_discount: entry.discount,
        p_shift_id: entry.shift_id || null,
      });
      if (error) throw error;
      synced++;
    } catch {
      // Keep in queue for retry (e.g. still offline, or stock conflict)
      failed++;
      remaining.push(entry);
    }
  }

  writeQueue(remaining);
  return { synced, failed };
}

/**
 * Attempt an online sale. Falls back to queueing if the network fails.
 * Returns 'synced' | 'queued' | error.
 */
export async function processSaleOnlineOrQueue(params: Omit<QueuedSale, 'queued_at'>): Promise<'synced' | 'queued'> {
  if (!isOnline()) {
    enqueueSale(params);
    return 'queued';
  }
  try {
    const { error } = await supabase.rpc('process_sale_atomic', {
      p_shop_id: params.shop_id,
      p_user_id: params.user_id,
      p_client_ref: params.client_ref,
      p_cart: params.cart,
      p_payment_method: params.payment_method,
      p_customer_id: params.customer_id || null,
      p_mpesa_reference: params.mpesa_reference || null,
      p_discount: params.discount,
      p_shift_id: params.shift_id || null,
    });
    if (error) throw error;
    return 'synced';
  } catch (err: unknown) {
    // Network failure → queue. DB validation failure → surface to user.
    const message = err instanceof Error ? err.message : String(err);
    if (/fetch|network|Failed to fetch|networkerror/i.test(message)) {
      enqueueSale(params);
      return 'queued';
    }
    throw err;
  }
}

/** Register listeners; call once from App. Auto-syncs when back online. */
export function initOfflineSync(onSynced?: (n: number) => void, onQueued?: (n: number) => void) {
  const trySync = async () => {
    if (!isOnline() || getQueueSize() === 0) return;
    const { synced } = await syncQueue();
    if (synced > 0 && onSynced) onSynced(synced);
    if (getQueueSize() > 0 && onQueued) onQueued(getQueueSize());
  };

  window.addEventListener('online', trySync);
  window.addEventListener('offline', () => {
    if (onQueued) onQueued(getQueueSize());
  });
  // Periodic retry every 30s
  const interval = setInterval(trySync, 30000);
  // Initial sync attempt
  trySync();

  return () => {
    window.removeEventListener('online', trySync);
    clearInterval(interval);
  };
}
