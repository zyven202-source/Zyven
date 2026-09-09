import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { searchProducts, addStock, adjustStock, getStockMovements, createProduct, getSuppliers } from '@/lib/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { useToast } from '@/components/ui/toast';
import { Search, Plus, ArrowDownToLine, Package, History, ScanBarcode, MinusCircle } from 'lucide-react';
import type { StockMovementType } from '@/types';

export default function StockPage() {
  const { shop, user } = useAuth();
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [quantity, setQuantity] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [reason, setReason] = useState('');

  const [newName, setNewName] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newBuyingPrice, setNewBuyingPrice] = useState('');
  const [newSellingPrice, setNewSellingPrice] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newMinStock, setNewMinStock] = useState('5');
  const [showScanner, setShowScanner] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustType, setAdjustType] = useState<StockMovementType>('DAMAGE');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    if (!shop) return;
    getSuppliers(shop.id).then(setSuppliers);
  }, [shop]);

  const handleSearch = async () => {
    if (!shop || !searchQuery.trim()) return;
    setLoading(true);
    try {
      const results = await searchProducts(shop.id, searchQuery);
      setSearchResults(results);
    } catch {
      addToast('error', 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, shop]);

  const selectProduct = async (product: any) => {
    setSelectedProduct(product);
    setBuyingPrice(String(product.buying_price));
    setSellingPrice(String(product.selling_price));
    setShowAddStock(true);
    if (shop) {
      const movements = await getStockMovements(shop.id, product.id);
      setStockHistory(movements);
    }
  };

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
        setSearchQuery('');
        setSearchResults([]);
        selectProduct(data[0]);
      } else {
        addToast('warning', `No product with barcode ${barcode}`);
        setNewBarcode(barcode);
        setShowNewProduct(true);
      }
    } catch {
      addToast('error', 'Lookup failed');
    }
  };

  const handleAdjustStock = async () => {
    if (!shop || !user || !selectedProduct) return;
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) { addToast('error', 'Quantity must be greater than 0'); return; }
    if (!adjustReason.trim()) { addToast('error', 'A reason is required for stock adjustments'); return; }
    try {
      await adjustStock(shop.id, selectedProduct.id, -qty, adjustType, user.id, adjustReason.trim());
      await supabase.from('audit_logs').insert({
        shop_id: shop.id, user_id: user.id, action: 'STOCK_ADJUSTED', entity_type: 'product', entity_id: selectedProduct.id,
        metadata: { product: selectedProduct.name, quantity: -qty, reason: adjustReason.trim(), movement_type: adjustType },
      });
      addToast('success', 'Stock adjusted', `${selectedProduct.name}: -${qty}`);
      setShowAdjust(false);
      setAdjustQty(''); setAdjustReason('');
      handleSearch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Adjustment failed';
      addToast('error', 'Adjustment failed', message);
    }
  };

  const handleAddStock = async () => {
    if (!shop || !user || !selectedProduct) return;
    if (!quantity || Number(quantity) <= 0) { addToast('error', 'Quantity must be greater than 0'); return; }
    if (!buyingPrice || Number(buyingPrice) <= 0) { addToast('error', 'Buying price must be greater than 0'); return; }
    if (!sellingPrice || Number(sellingPrice) <= 0) { addToast('error', 'Selling price must be greater than 0'); return; }
    try {
      await addStock(shop.id, selectedProduct.id, Number(quantity), Number(buyingPrice), Number(sellingPrice), user.id, supplierId || undefined, reason || 'Stock received');
      addToast('success', 'Stock added', `${selectedProduct.name}: +${quantity}`);
      setShowAddStock(false);
      setSelectedProduct(null);
      setQuantity(''); setReason('');
      handleSearch();
    } catch (err: any) {
      addToast('error', 'Failed to add stock', err.message);
    }
  };

  const handleCreateNewProduct = async () => {
    if (!shop || !user) return;
    if (!newName.trim()) { addToast('error', 'Product name is required'); return; }
    if (!newBuyingPrice || Number(newBuyingPrice) <= 0) { addToast('error', 'Buying price is required'); return; }
    if (!newSellingPrice || Number(newSellingPrice) <= 0) { addToast('error', 'Selling price is required'); return; }
    if (!newQuantity || Number(newQuantity) <= 0) { addToast('error', 'Quantity must be greater than 0'); return; }
    try {
      const product = await createProduct({
        shop_id: shop.id, name: newName.trim(), barcode: newBarcode || undefined,
        buying_price: Number(newBuyingPrice), selling_price: Number(newSellingPrice),
        current_stock: Number(newQuantity), minimum_stock: Number(newMinStock),
        unit: 'pcs', is_active: true,
      });
      await addStock(shop.id, product.id, Number(newQuantity), Number(newBuyingPrice), Number(newSellingPrice), user.id, supplierId || undefined, 'Initial stock');
      addToast('success', 'Product created with stock');
      setShowNewProduct(false);
      setNewName(''); setNewBarcode(''); setNewBuyingPrice(''); setNewSellingPrice(''); setNewQuantity(''); setNewMinStock('5');
    } catch (err: any) {
      addToast('error', 'Failed to create product', err.message);
    }
  };

  const movementLabels: Record<string, string> = {
    RECEIPT: 'Received', SALE: 'Sale', ADJUSTMENT: 'Adjusted', RETURN: 'Return',
    DAMAGE: 'Damaged', EXPIRED: 'Expired', LOST: 'Lost', THEFT: 'Theft', COUNTING_CORRECTION: 'Counted',
  };

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      <div className="page-header">
        <h1 className="text-xl font-bold text-text">Stock</h1>
        <Button variant="outline" onClick={() => setShowNewProduct(true)}>
          <Plus className="h-4 w-4" /> New Product
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
        <input
          placeholder="Search product by name, barcode, or SKU..."
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

      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map(product => (
            <button
              key={product.id}
              onClick={() => selectProduct(product)}
              className="w-full text-left p-4 rounded-xl border border-border-subtle bg-surface hover:border-primary/30 transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text">{product.name}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Buy {formatCurrency(Number(product.buying_price))} · Sell {formatCurrency(Number(product.selling_price))}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); setAdjustType('DAMAGE'); setAdjustQty(''); setAdjustReason(''); setShowAdjust(true); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
                    aria-label="Adjust stock"
                  >
                    <MinusCircle className="h-4 w-4" />
                  </button>
                  <div className="text-right">
                    <p className={cn('text-sm font-bold tabular-nums', product.current_stock === 0 ? 'text-danger' : 'text-text')}>
                      {product.current_stock} {product.unit}
                    </p>
                    <p className="text-[10px] text-text-muted">in stock</p>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {searchQuery && searchResults.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3">
            <Package className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm text-text-secondary">No product found for "{searchQuery}"</p>
          <Button className="mt-3" onClick={() => { setNewName(searchQuery); setShowNewProduct(true); }}>
            Create New Product
          </Button>
        </div>
      )}

      {!searchQuery && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mx-auto mb-3">
            <ArrowDownToLine className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text-secondary">Search to add stock</p>
          <p className="text-xs text-text-muted mt-1">Or create a new product with initial stock</p>
        </div>
      )}

      {/* Add Stock Dialog */}
      <Dialog open={showAddStock} onOpenChange={setShowAddStock}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
            <DialogDescription>{selectedProduct?.name} — {selectedProduct?.current_stock} in stock</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Quantity *</Label>
              <Input type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Buying Price (KSh) *</Label>
                <Input type="number" value={buyingPrice} onChange={e => setBuyingPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Selling Price (KSh) *</Label>
                <Input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
              </div>
            </div>
            {suppliers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Notes</Label>
              <Input placeholder="e.g., From supplier ABC" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            {stockHistory.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> Recent History
                </h4>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {stockHistory.slice(0, 8).map(m => (
                    <div key={m.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-elevated">
                      <span className="text-text-secondary">{movementLabels[m.movement_type] || m.movement_type}</span>
                      <span className={cn('font-semibold tabular-nums', m.quantity_change > 0 ? 'text-success' : 'text-danger')}>
                        {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                      </span>
                      <span className="text-text-muted">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddStock(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddStock}>Add Stock</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>{selectedProduct?.name} — {selectedProduct?.current_stock} in stock</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Reason *</Label>
              <Select value={adjustType} onValueChange={v => setAdjustType(v as StockMovementType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAMAGE">Damaged</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                  <SelectItem value="THEFT">Theft</SelectItem>
                  <SelectItem value="COUNTING_CORRECTION">Counting correction</SelectItem>
                  <SelectItem value="ADJUSTMENT">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Quantity removed *</Label>
              <Input type="number" min="1" placeholder="0" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Details (required) *</Label>
              <Textarea placeholder="Explain what happened..." value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            </div>
            <p className="text-[11px] text-text-muted">Every adjustment is recorded in the audit log.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdjust(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleAdjustStock}>Remove Stock</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner open={showScanner} onClose={() => setShowScanner(false)} onDetected={handleBarcodeDetected} />

      {/* New Product Dialog */}
      <Dialog open={showNewProduct} onOpenChange={setShowNewProduct}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>Add a new product with initial stock</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Product Name *</Label>
              <Input placeholder="e.g., Milk 500ml" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Barcode/SKU</Label>
              <Input placeholder="Optional" value={newBarcode} onChange={e => setNewBarcode(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Buying Price (KSh) *</Label>
                <Input type="number" value={newBuyingPrice} onChange={e => setNewBuyingPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Selling Price (KSh) *</Label>
                <Input type="number" value={newSellingPrice} onChange={e => setNewSellingPrice(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Quantity *</Label>
                <Input type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Min Stock</Label>
                <Input type="number" value={newMinStock} onChange={e => setNewMinStock(e.target.value)} />
              </div>
            </div>
            {suppliers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowNewProduct(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCreateNewProduct}>Create Product</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
