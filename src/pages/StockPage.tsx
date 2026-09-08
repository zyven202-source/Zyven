import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { searchProducts, addStock, getStockMovements, createProduct, getSuppliers } from '@/lib/database';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { Search, Plus, ArrowDownToLine, Package, Truck, History } from 'lucide-react';

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

  // Add stock form
  const [quantity, setQuantity] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [reason, setReason] = useState('');

  // New product form
  const [newName, setNewName] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newBuyingPrice, setNewBuyingPrice] = useState('');
  const [newSellingPrice, setNewSellingPrice] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newMinStock, setNewMinStock] = useState('5');

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

    // Load stock history
    if (shop) {
      const movements = await getStockMovements(shop.id, product.id);
      setStockHistory(movements);
    }
  };

  const handleAddStock = async () => {
    if (!shop || !user) return;
    if (!selectedProduct) return;
    if (!quantity || Number(quantity) <= 0) {
      addToast('error', 'Quantity must be greater than 0');
      return;
    }
    if (!buyingPrice || Number(buyingPrice) <= 0) {
      addToast('error', 'Buying price must be greater than 0');
      return;
    }
    if (!sellingPrice || Number(sellingPrice) <= 0) {
      addToast('error', 'Selling price must be greater than 0');
      return;
    }

    try {
      await addStock(
        shop.id,
        selectedProduct.id,
        Number(quantity),
        Number(buyingPrice),
        Number(sellingPrice),
        user.id,
        supplierId || undefined,
        reason || 'Stock received'
      );
      addToast('success', 'Stock added!', `${selectedProduct.name}: +${quantity}`);
      setShowAddStock(false);
      setSelectedProduct(null);
      setQuantity('');
      setReason('');
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
        shop_id: shop.id,
        name: newName.trim(),
        barcode: newBarcode || undefined,
        buying_price: Number(newBuyingPrice),
        selling_price: Number(newSellingPrice),
        current_stock: Number(newQuantity),
        minimum_stock: Number(newMinStock),
        unit: 'pcs',
        is_active: true,
      });

      // Record stock movement
      await addStock(
        shop.id,
        product.id,
        Number(newQuantity),
        Number(newBuyingPrice),
        Number(newSellingPrice),
        user.id,
        supplierId || undefined,
        'Initial stock'
      );

      addToast('success', 'Product created with stock!');
      setShowNewProduct(false);
      resetNewProductForm();
    } catch (err: any) {
      addToast('error', 'Failed to create product', err.message);
    }
  };

  const resetNewProductForm = () => {
    setNewName(''); setNewBarcode(''); setNewBuyingPrice('');
    setNewSellingPrice(''); setNewQuantity(''); setNewMinStock('5');
  };

  const movementTypeLabels: Record<string, string> = {
    RECEIPT: 'Stock Received',
    SALE: 'POS Sale',
    ADJUSTMENT: 'Adjusted',
    RETURN: 'Return',
    DAMAGE: 'Damaged',
    EXPIRED: 'Expired',
    LOST: 'Lost',
    THEFT: 'Theft',
    COUNTING_CORRECTION: 'Count Correction',
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Stock Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowNewProduct(true)}>
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search product by name, barcode, or SKU to add stock..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map(product => (
            <Card key={product.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => selectProduct(product)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">{product.name}</p>
                  <p className="text-xs text-text-muted">
                    Buy: {formatCurrency(Number(product.buying_price))} • Sell: {formatCurrency(Number(product.selling_price))}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${product.current_stock === 0 ? 'text-danger' : 'text-text-primary'}`}>
                    {product.current_stock} {product.unit}
                  </p>
                  <p className="text-xs text-text-muted">in stock</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {searchQuery && searchResults.length === 0 && !loading && (
        <div className="text-center py-8">
          <Package className="h-10 w-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No product found for "{searchQuery}"</p>
          <Button className="mt-3" onClick={() => { setNewName(searchQuery); setShowNewProduct(true); }}>
            Create New Product
          </Button>
        </div>
      )}

      {!searchQuery && (
        <div className="text-center py-12">
          <ArrowDownToLine className="h-12 w-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">Search for a product to add stock</p>
          <p className="text-sm text-text-muted mt-1">Or create a new product with initial stock</p>
        </div>
      )}

      {/* Add Stock Dialog */}
      <Dialog open={showAddStock} onOpenChange={setShowAddStock}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} — Currently {selectedProduct?.current_stock} in stock
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity to Add *</Label>
              <Input type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Buying Price (KSh) *</Label>
                <Input type="number" value={buyingPrice} onChange={e => setBuyingPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Selling Price (KSh) *</Label>
                <Input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
              </div>
            </div>
            {suppliers.length > 0 && (
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="e.g., From supplier ABC" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddStock(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddStock}>Add Stock</Button>
            </div>

            {/* Stock History */}
            {stockHistory.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" /> Recent Stock History
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {stockHistory.slice(0, 10).map(m => (
                    <div key={m.id} className="flex items-center justify-between text-xs p-2 rounded bg-elevated">
                      <span className="text-text-secondary">{movementTypeLabels[m.movement_type] || m.movement_type}</span>
                      <span className={`font-medium ${m.quantity_change > 0 ? 'text-success' : 'text-danger'}`}>
                        {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                      </span>
                      <span className="text-text-muted">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Product Dialog */}
      <Dialog open={showNewProduct} onOpenChange={setShowNewProduct}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>Add a new product with initial stock</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input placeholder="e.g., Milk 500ml" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Barcode/SKU</Label>
              <Input placeholder="Optional" value={newBarcode} onChange={e => setNewBarcode(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Buying Price (KSh) *</Label>
                <Input type="number" value={newBuyingPrice} onChange={e => setNewBuyingPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Selling Price (KSh) *</Label>
                <Input type="number" value={newSellingPrice} onChange={e => setNewSellingPrice(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Initial Quantity *</Label>
                <Input type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Min Stock Level</Label>
                <Input type="number" value={newMinStock} onChange={e => setNewMinStock(e.target.value)} />
              </div>
            </div>
            {suppliers.length > 0 && (
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowNewProduct(false); resetNewProductForm(); }}>Cancel</Button>
              <Button className="flex-1" onClick={handleCreateNewProduct}>Create Product</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
