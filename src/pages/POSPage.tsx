import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { searchProducts, processSale, getActiveShift } from '@/lib/database';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, CartItem, PaymentMethod } from '@/types';
import {
  Search, ShoppingCart, Minus, Plus, Trash2, X,
  Banknote, CreditCard, Users, CheckCircle, AlertCircle,
  ScanBarcode, Package,
} from 'lucide-react';

export default function POSPage() {
  const { shop, user, role } = useAuth();
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

  // Load products
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

  // Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (shop) loadProducts(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, shop]);

  // Check for active shift
  useEffect(() => {
    if (!shop) return;
    getActiveShift(shop.id).then(s => setActiveShift(s));
  }, [shop]);

  // Load customers for credit
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
      addToast('error', `${product.name} needs a buying price before selling`);
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
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
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

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity) - item.discount, 0);
  const cartTotal = cartSubtotal;
  const cartProfit = cart.reduce((sum, item) => sum + ((item.unit_price - item.buying_price) * item.quantity) - item.discount, 0);

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

    setProcessing(true);
    try {
      const result = await processSale(
        shop!.id,
        user!.id,
        cart,
        paymentMethod,
        customerId || undefined,
        mpesaRef || undefined,
        0,
        activeShift?.id
      );
      setLastSale({ ...result.sale, items: result.items, shop: shop });
      setShowPayment(false);
      setShowReceipt(true);
      setCart([]);
      setMpesaRef('');
      setCustomerId('');
      setCustomerSearch('');
      addToast('success', 'Sale completed!', `Receipt: ${result.sale.receipt_number}`);
    } catch (err: any) {
      addToast('error', 'Sale failed', err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-border bg-surface">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              ref={searchRef}
              placeholder="Search products, scan barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          {!activeShift && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-warning/10 text-warning text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>No active shift. Open a shift first.</span>
            </div>
          )}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-text-muted">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-text-muted mb-3" />
              <p className="text-text-secondary font-medium">No products found</p>
              <p className="text-sm text-text-muted mt-1">
                {searchQuery ? 'Try a different search' : 'Add products from Inventory first'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {products.map(product => {
                const isOOS = product.current_stock <= 0;
                const isLow = product.current_stock <= product.minimum_stock && product.current_stock > 0;
                return (
                  <motion.button
                    key={product.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => addToCart(product)}
                    disabled={isOOS}
                    className={`relative p-3 rounded-xl border text-left transition-all ${
                      isOOS
                        ? 'border-border bg-surface/50 opacity-50'
                        : 'border-border bg-surface hover:border-primary/50 hover:bg-elevated'
                    }`}
                  >
                    {isLow && (
                      <Badge variant="warning" className="absolute top-2 right-2 text-[9px] px-1.5 py-0">
                        LOW
                      </Badge>
                    )}
                    {isOOS && (
                      <Badge variant="danger" className="absolute top-2 right-2 text-[9px] px-1.5 py-0">
                        OOS
                      </Badge>
                    )}
                    <p className="text-sm font-medium text-text-primary truncate pr-8">{product.name}</p>
                    <p className="text-lg font-bold text-primary mt-1">
                      {formatCurrency(Number(product.selling_price))}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Stock: {product.current_stock}
                    </p>
                    {product.sku && (
                      <p className="text-[10px] text-text-muted truncate mt-0.5">{product.sku}</p>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      <div className="lg:w-96 border-l border-border bg-surface flex flex-col">
        {/* Cart Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-text-primary">Cart</h2>
            {cart.length > 0 && (
              <Badge variant="default">{cart.length}</Badge>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-danger hover:text-red-400"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-10 w-10 text-text-muted mb-3" />
              <p className="text-sm text-text-muted">Tap products to add to cart</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <AnimatePresence>
                {cart.map(item => (
                  <motion.div
                    key={item.product_id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-3 rounded-lg bg-elevated"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{item.product_name}</p>
                        <p className="text-xs text-text-muted">
                          {formatCurrency(item.unit_price)} × {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-text-primary ml-2">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQuantity(item.product_id, -1)}
                          className="w-7 h-7 rounded-md bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.product_id, 1)}
                          className="w-7 h-7 rounded-md bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-danger hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Subtotal</span>
              <span className="text-text-primary">{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-text-primary">Total</span>
              <span className="text-primary">{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0 || !activeShift}
            onClick={() => setShowPayment(true)}
          >
            <CreditCard className="h-5 w-5" />
            Pay {formatCurrency(cartTotal)}
          </Button>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>Total: {formatCurrency(cartTotal)}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Payment Methods */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { method: 'CASH' as PaymentMethod, icon: Banknote, label: 'Cash' },
                { method: 'M-PESA' as PaymentMethod, icon: CreditCard, label: 'M-Pesa' },
                { method: 'CREDIT' as PaymentMethod, icon: Users, label: 'Credit' },
              ].map(({ method, icon: Icon, label }) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    paymentMethod === method
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-elevated text-text-secondary hover:border-primary/50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>

            {/* M-Pesa Reference */}
            {paymentMethod === 'M-PESA' && (
              <div className="space-y-2">
                <Label>M-Pesa Reference</Label>
                <Input
                  placeholder="e.g., QGH7B9YZ1P"
                  value={mpesaRef}
                  onChange={e => setMpesaRef(e.target.value)}
                />
              </div>
            )}

            {/* Credit Customer */}
            {paymentMethod === 'CREDIT' && (
              <div className="space-y-2">
                <Label>Customer</Label>
                <Input
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
                {customers.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                    {customers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerSearch(c.full_name);
                          setCustomers([]);
                        }}
                        className={`w-full text-left p-3 text-sm hover:bg-elevated transition-colors ${
                          customerId === c.id ? 'bg-primary/10 text-primary' : 'text-text-primary'
                        }`}
                      >
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-xs text-text-muted">
                          {c.phone || 'No phone'} • Balance: {formatCurrency(c.current_balance)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {!customerId && customerSearch && (
                  <p className="text-xs text-text-muted">Select a customer from the list</p>
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

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Sale Complete
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="bg-elevated rounded-lg p-4 font-mono text-sm space-y-2">
              <div className="text-center border-b border-border pb-2">
                <p className="font-bold text-text-primary">{shop?.name}</p>
                <p className="text-xs text-text-muted">Receipt: {lastSale.receipt_number}</p>
              </div>
              {lastSale.items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className="text-text-secondary">{item.product_name} × {item.quantity}</span>
                  <span className="text-text-primary">{formatCurrency(item.total)}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span className="text-text-primary">Total</span>
                <span className="text-primary">{formatCurrency(lastSale.total)}</span>
              </div>
              <div className="text-xs text-text-muted text-center mt-2">
                Asante sana! Thank you for shopping.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
