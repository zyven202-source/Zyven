import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { searchProducts, getActiveShift } from '@/lib/database';
import { processSaleOnlineOrQueue, isOnline, getQueueSize } from '@/lib/offline';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { useToast } from '@/components/ui/toast';
import { AnimatePresence, motion } from 'framer-motion';
import type { Product, CartItem, PaymentMethod } from '@/types';
import {
  Search, ShoppingCart, Minus, Plus, Trash2,
  Banknote, CreditCard, Users, CheckCircle, AlertCircle,
  Package, ScanBarcode,
} from 'lucide-react';

export default function POSPage() {
  const { shop, user } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [mpesaRef, setMpesaRef] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(0);

  useEffect(() => {
    if (!shop) return;
    loadProducts('');
  }, [shop]);

  const loadProducts = async (q: string) => {
    if (!shop) return;
    setLoading(true);
    try {
      const data = await searchProducts(shop.id, q);
      setProducts(data);
    } catch {
      addToast('error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (shop) loadProducts(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, shop]);

  useEffect(() => {
    if (!shop) return;
    getActiveShift(shop.id).then(s => setActiveShift(s));
    setOfflineQueued(getQueueSize());
  }, [shop]);

  const handleBarcodeDetected = async (barcode: string) => {
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shop!.id)
        .eq('is_active', true)
        .or(`barcode.eq.${barcode},sku.eq.${barcode}`)
        .limit(1);
      if (data && data.length > 0) {
        addToCart(data[0]);
      } else {
        addToast('warning', `No product with barcode ${barcode}`);
      }
    } catch {
      addToast('error', 'Lookup failed');
    }
  };

  useEffect(() => {
    if (!shop || !customerSearch) return;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shop.id)
        .or(`full_name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
        .limit(10);
      if (data) setCustomers(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, shop]);

  const addToCart = (product: Product) => {
    if (product.current_stock <= 0) {
      addToast('warning', `${product.name} is out of stock`);
      return;
    }
    if (!product.buying_price || Number(product.buying_price) <= 0) {
      addToast('error', `${product.name} needs a buying price first`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          addToast('warning', `Only ${product.current_stock} available`);
          return prev;
        }
        return prev.map(i =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku || product.barcode,
        quantity: 1,
        unit_price: Number(product.selling_price),
        buying_price: Number(product.buying_price),
        discount: 0,
        stock_available: product.current_stock,
      }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product_id !== productId) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      if (newQty > item.stock_available) {
        addToast('warning', `Only ${item.stock_available} available`);
        return item;
      }
      return { ...item, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity) - item.discount, 0);

  const handlePayment = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'CREDIT' && !customerId) {
      addToast('error', 'Select a customer for credit sale');
      return;
    }
    if (paymentMethod === 'M-PESA' && !mpesaRef) {
      addToast('error', 'Enter M-Pesa reference number');
      return;
    }
    for (const item of cart) {
      if (!item.buying_price || item.buying_price <= 0) {
        addToast('error', `${item.product_name} needs a buying price before it can be sold`);
        return;
      }
    }
    setProcessing(true);
    try {
      const clientRef = crypto.randomUUID();
      const outcome = await processSaleOnlineOrQueue({
        client_ref: clientRef,
        shop_id: shop!.id,
        user_id: user!.id,
        cart: cart.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          product_sku: i.product_sku || null,
          quantity: i.quantity,
          unit_price: i.unit_price,
          buying_price: i.buying_price,
          discount: i.discount || 0,
        })),
        payment_method: paymentMethod,
        customer_id: customerId || undefined,
        mpesa_reference: mpesaRef || undefined,
        discount: 0,
        shift_id: activeShift?.id,
      });

      if (outcome === 'queued') {
        setOfflineQueued(getQueueSize());
        setShowPayment(false);
        setCart([]);
        setMpesaRef('');
        setCustomerId('');
        setCustomerSearch('');
        addToast('warning', 'Offline — sale saved', 'It will sync automatically when you are back online.');
        return;
      }

      // Refresh the sale for receipt display
      const { data: saleRow } = await supabase
        .from('sales')
        .select('*, items:sale_items(*)')
        .eq('shop_id', shop!.id)
        .eq('notes', `client_ref:${clientRef}`)
        .maybeSingle();

      setLastSale(saleRow ? { ...saleRow, shop } : { receipt_number: '—', total: cartTotal, items: cart.map(i => ({ product_name: i.product_name, quantity: i.quantity, total: i.unit_price * i.quantity })), shop });
      setShowPayment(false);
      setShowReceipt(true);
      setCart([]);
      setMpesaRef('');
      setCustomerId('');
      setCustomerSearch('');
      addToast('success', 'Sale completed');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sale failed';
      addToast('error', 'Sale failed', message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* ──── Products Panel ──── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-border-subtle bg-surface flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <input
              ref={searchRef}
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-24 rounded-xl border border-border-subtle bg-elevated text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-colors"
              autoFocus
            />
            <button
              onClick={() => setShowScanner(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-lg bg-surface border border-border-subtle flex items-center gap-1.5 text-text-secondary hover:text-primary hover:border-primary/30 transition-colors"
              aria-label="Scan barcode"
            >
              <ScanBarcode className="h-4 w-4" />
              <span className="text-[11px] font-medium">Scan</span>
            </button>
          </div>
          {!activeShift && (
            <div className="flex items-center gap-2 mt-2.5 px-3 py-2 rounded-lg bg-warning-muted text-warning text-xs font-medium">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Open a shift before making sales
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-text-muted text-sm">Loading</span>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mb-3">
                <Package className="h-6 w-6 text-text-muted" />
              </div>
              <p className="text-sm font-medium text-text-secondary">
                {searchQuery ? 'No products found' : 'No products yet'}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {searchQuery ? 'Try a different search' : 'Add products from Inventory'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {products.map(product => {
                const isOOS = product.current_stock <= 0;
                const isLow = product.current_stock <= product.minimum_stock && product.current_stock > 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={isOOS}
                    className={cn(
                      'p-3.5 rounded-xl border text-left transition-all active:scale-[0.97]',
                      isOOS
                        ? 'border-border-subtle bg-surface opacity-40 cursor-not-allowed'
                        : 'border-border-subtle bg-surface hover:border-primary/30 hover:bg-elevated'
                    )}
                  >
                    <p className="text-[13px] font-medium text-text truncate pr-6 leading-tight">{product.name}</p>
                    <p className="text-lg font-bold text-primary mt-2 tabular-nums">
                      {formatCurrency(Number(product.selling_price))}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn(
                        'text-[11px] font-medium',
                        isOOS ? 'text-danger' : isLow ? 'text-warning' : 'text-text-muted'
                      )}>
                        {product.current_stock} in stock
                      </span>
                      {isLow && !isOOS && (
                        <span className="w-1 h-1 rounded-full bg-warning" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ──── Cart Panel ──── */}
      <div className="lg:w-[380px] border-t lg:border-t-0 lg:border-l border-border-subtle bg-surface flex flex-col flex-shrink-0">
        {/* Cart Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" strokeWidth={2} />
            <span className="text-sm font-semibold text-text">Cart</span>
            {cart.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-primary text-text-inverse text-[10px] font-bold">
                {cart.length}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs font-medium text-text-muted hover:text-danger transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-elevated flex items-center justify-center mb-3">
                <ShoppingCart className="h-5 w-5 text-text-muted" />
              </div>
              <p className="text-sm text-text-muted">Tap a product to add</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              <AnimatePresence>
                {cart.map(item => (
                  <motion.div
                    key={item.product_id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 rounded-xl bg-elevated">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-text truncate">{item.product_name}</p>
                          <p className="text-[11px] text-text-muted mt-0.5 tabular-nums">
                            {formatCurrency(item.unit_price)} each
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-text tabular-nums flex-shrink-0">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartQuantity(item.product_id, -1)}
                            className="w-7 h-7 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text active:scale-95 transition-all"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums text-text">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.product_id, 1)}
                            className="w-7 h-7 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text active:scale-95 transition-all"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t border-border-subtle p-4 space-y-3 flex-shrink-0">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-muted">Total</span>
            <span className="kpi-value-sm text-primary">{formatCurrency(cartTotal)}</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0 || !activeShift}
            onClick={() => setShowPayment(true)}
          >
            <CreditCard className="h-4 w-4" />
            Pay {formatCurrency(cartTotal)}
          </Button>
        </div>
      </div>

      {/* ──── Barcode Scanner ──── */}
      <BarcodeScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={handleBarcodeDetected}
      />

      {/* ──── Payment Dialog ──── */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>Total: {formatCurrency(cartTotal)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {([
                { method: 'CASH' as PaymentMethod, icon: Banknote, label: 'Cash' },
                { method: 'M-PESA' as PaymentMethod, icon: CreditCard, label: 'M-Pesa' },
                { method: 'CREDIT' as PaymentMethod, icon: Users, label: 'Credit' },
              ]).map(({ method, icon: Icon, label }) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                    paymentMethod === method
                      ? 'border-primary bg-primary-ghost text-primary'
                      : 'border-border-subtle bg-elevated text-text-secondary hover:border-border'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>

            {paymentMethod === 'M-PESA' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">M-Pesa Reference</Label>
                <Input placeholder="e.g., QGH7B9YZ1P" value={mpesaRef} onChange={e => setMpesaRef(e.target.value)} />
              </div>
            )}

            {paymentMethod === 'CREDIT' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Customer</Label>
                <Input placeholder="Search by name or phone..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                {customers.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-border-subtle rounded-xl">
                    {customers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerSearch(c.full_name);
                          setCustomers([]);
                        }}
                        className={cn(
                          'w-full text-left p-3 text-sm hover:bg-elevated transition-colors border-b border-border-subtle last:border-0',
                          customerId === c.id ? 'bg-primary-ghost text-primary' : 'text-text'
                        )}
                      >
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-xs text-text-muted">
                          {c.phone || 'No phone'} · Balance: {formatCurrency(c.current_balance)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handlePayment}
              disabled={processing || (paymentMethod === 'CREDIT' && !customerId) || (paymentMethod === 'M-PESA' && !mpesaRef)}
            >
              {processing ? 'Processing...' : `Complete ${paymentMethod} Payment`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ──── Receipt Dialog ──── */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Sale Complete
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="bg-elevated rounded-xl p-4 font-mono text-sm space-y-1.5">
              <div className="text-center pb-2 border-b border-border-subtle">
                <p className="font-bold text-text">{shop?.name}</p>
                <p className="text-[11px] text-text-muted mt-0.5">Receipt #{lastSale.receipt_number}</p>
              </div>
              {lastSale.items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-text-secondary">
                  <span>{item.product_name} ×{item.quantity}</span>
                  <span className="text-text">{formatCurrency(item.total)}</span>
                </div>
              ))}
              <div className="border-t border-border-subtle pt-2 flex justify-between font-bold text-text">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(lastSale.total)}</span>
              </div>
              <p className="text-[11px] text-text-muted text-center mt-3">Asante sana! 🙏</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
