import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getProducts, createProduct, updateProduct, getCategories, createCategory } from '@/lib/database';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import type { Product, Category } from '@/types';
import {
  Plus, Search, Package, TrendingUp, AlertTriangle,
  XCircle, Edit, DollarSign,
} from 'lucide-react';

type FilterType = 'all' | 'low_stock' | 'out_of_stock' | 'expiring';

export default function InventoryPage() {
  const { shop, role, user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBuyingPrice, setFormBuyingPrice] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formStock, setFormStock] = useState('0');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formCategory, setFormCategory] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formNotes, setFormNotes] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  useEffect(() => {
    if (!shop) return;
    loadData();
  }, [shop]);

  const loadData = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([getProducts(shop.id), getCategories(shop.id)]);
      setProducts(prods);
      setCategories(cats);
    } catch {
      addToast('error', 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (filter === 'low_stock' && p.current_stock > p.minimum_stock) return false;
    if (filter === 'out_of_stock' && p.current_stock > 0) return false;
    if (filter === 'expiring') {
      if (!p.expiry_date) return false;
      const days = (new Date(p.expiry_date).getTime() - Date.now()) / 86400000;
      if (days > 30) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalStockValue = products.reduce((sum, p) => sum + (Number(p.buying_price) * p.current_stock), 0);
  const lowStockCount = products.filter(p => p.current_stock <= p.minimum_stock && p.current_stock > 0).length;
  const outOfStockCount = products.filter(p => p.current_stock === 0).length;

  const resetForm = () => {
    setFormName(''); setFormBarcode(''); setFormSku('');
    setFormBuyingPrice(''); setFormSellingPrice(''); setFormStock('0');
    setFormMinStock('5'); setFormCategory(''); setFormUnit('pcs');
    setFormNotes(''); setFormExpiry(''); setEditingProduct(null);
  };

  const handleSaveProduct = async () => {
    if (!shop || !formName.trim()) { addToast('error', 'Product name is required'); return; }
    if (!formBuyingPrice || Number(formBuyingPrice) <= 0) { addToast('error', 'Valid buying price is required'); return; }
    if (!formSellingPrice || Number(formSellingPrice) <= 0) { addToast('error', 'Selling price must be greater than zero'); return; }
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: formName.trim(), barcode: formBarcode || undefined, sku: formSku || undefined,
          buying_price: Number(formBuyingPrice), selling_price: Number(formSellingPrice),
          minimum_stock: Number(formMinStock), category_id: formCategory || undefined,
          unit: formUnit, notes: formNotes || undefined,
          expiry_date: formExpiry || undefined,
        });
        addToast('success', 'Product updated');
      } else {
        await createProduct({
          shop_id: shop.id, name: formName.trim(),
          barcode: formBarcode || undefined, sku: formSku || undefined,
          buying_price: Number(formBuyingPrice), selling_price: Number(formSellingPrice),
          current_stock: Number(formStock), minimum_stock: Number(formMinStock),
          category_id: formCategory || undefined, unit: formUnit,
          notes: formNotes || undefined, is_active: true,
          expiry_date: formExpiry || undefined,
        }, user?.id);
        addToast('success', 'Product created');
      }
      setShowAddProduct(false);
      resetForm();
      loadData();
    } catch (err: any) {
      addToast('error', 'Failed to save product', err.message);
    }
  };

  const handleAddCategory = async () => {
    if (!shop || !newCategoryName.trim()) return;
    try {
      const cat = await createCategory(shop.id, newCategoryName.trim());
      setCategories(prev => [...prev, cat]);
      setFormCategory(cat.id);
      setNewCategoryName('');
      setShowNewCategory(false);
      addToast('success', 'Category created');
    } catch {
      addToast('error', 'Failed to create category');
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormBarcode(product.barcode || '');
    setFormSku(product.sku || '');
    setFormBuyingPrice(String(product.buying_price));
    setFormSellingPrice(String(product.selling_price));
    setFormMinStock(String(product.minimum_stock));
    setFormCategory(product.category_id || '');
    setFormUnit(product.unit);
    setFormNotes(product.notes || '');
    setFormExpiry(product.expiry_date ? String(product.expiry_date).split('T')[0] : '');
    setShowAddProduct(true);
  };

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: products.length },
    { key: 'low_stock', label: 'Low Stock', count: lowStockCount },
    { key: 'out_of_stock', label: 'Out of Stock', count: outOfStockCount },
    { key: 'expiring', label: 'Expiring', count: products.filter(p => p.expiry_date && (new Date(p.expiry_date).getTime() - Date.now()) / 86400000 <= 30).length },
  ];

  return (
    <div className="px-4 lg:px-8 py-5 max-w-7xl mx-auto space-y-5 pb-24 lg:pb-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-xl font-bold text-text">Inventory</h1>
        {(role === 'OWNER' || role === 'MANAGER') && (
          <Button onClick={() => { resetForm(); setShowAddProduct(true); }}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Products" value={String(products.length)} icon={Package} />
        <StatCard label="Stock Value" value={formatCurrency(totalStockValue)} icon={DollarSign} color="primary" />
        <StatCard label="Low / OOS" value={`${lowStockCount} / ${outOfStockCount}`} icon={AlertTriangle}
          color={lowStockCount + outOfStockCount > 0 ? 'warning' : 'default'} />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border-subtle bg-elevated text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-colors"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                filter === f.key
                  ? 'bg-primary text-text-inverse'
                  : 'bg-surface border border-border-subtle text-text-secondary hover:text-text'
              )}
            >
              {f.label}{f.count !== undefined ? ` (${f.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Products List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-text-muted text-sm">Loading inventory</span>
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center mb-3">
            <Package className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text-secondary">
            {search ? 'No products match your search' : 'No products yet'}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {search ? 'Try a different search term' : 'Add your first product to start'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map(product => {
            const profit = Number(product.selling_price) - Number(product.buying_price);
            const margin = Number(product.selling_price) > 0
              ? ((profit / Number(product.selling_price)) * 100) : 0;
            const isOOS = product.current_stock === 0;
            const isLow = product.current_stock <= product.minimum_stock && product.current_stock > 0;

            return (
              <button
                key={product.id}
                onClick={() => navigate(`/inventory/${product.id}`)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all active:scale-[0.99]',
                  isOOS ? 'border-danger/20 bg-surface' : isLow ? 'border-warning/20 bg-surface' : 'border-border-subtle bg-surface hover:border-border'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-text truncate">{product.name}</h3>
                      {isOOS && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-danger-muted text-danger">OOS</span>}
                      {isLow && !isOOS && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-warning-muted text-warning">LOW</span>}
                      {product.expiry_date && (new Date(product.expiry_date).getTime() - Date.now()) / 86400000 <= 30 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-warning-muted text-warning">
                          {new Date(product.expiry_date) < new Date() ? 'EXPIRED' : 'EXP SOON'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
                      {product.barcode && <span>BC: {product.barcode}</span>}
                      {product.sku && <span>SKU: {product.sku}</span>}
                      {product.category && <span>{product.category.name}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-primary tabular-nums">{formatCurrency(Number(product.selling_price))}</p>
                    <p className="text-[11px] text-text-muted tabular-nums">Cost {formatCurrency(Number(product.buying_price))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border-subtle">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Stock</p>
                    <p className={cn('text-sm font-semibold tabular-nums',
                      isOOS ? 'text-danger' : isLow ? 'text-warning' : 'text-text'
                    )}>{product.current_stock} {product.unit}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Profit</p>
                    <p className="text-sm font-semibold text-success tabular-nums">{formatCurrency(profit)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Margin</p>
                    <p className="text-sm font-semibold text-text tabular-nums">{margin.toFixed(1)}%</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(product); }}
                    className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-elevated transition-colors"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Add/Edit Product Dialog */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update product details' : 'Fill in the details to add a new product'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Product Name *</Label>
              <Input placeholder="e.g., Milk 500ml" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Barcode</Label>
                <Input placeholder="Scan or type" value={formBarcode} onChange={e => setFormBarcode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">SKU</Label>
                <Input placeholder="Stock keeping unit" value={formSku} onChange={e => setFormSku(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Buying Price (KSh) *</Label>
                <Input type="number" placeholder="0" value={formBuyingPrice} onChange={e => setFormBuyingPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-text-secondary">Selling Price (KSh) *</Label>
                <Input type="number" placeholder="0" value={formSellingPrice} onChange={e => setFormSellingPrice(e.target.value)} />
              </div>
            </div>
            {formBuyingPrice && formSellingPrice && Number(formBuyingPrice) > 0 && Number(formSellingPrice) > 0 && (
              <div className="px-3 py-2.5 rounded-lg bg-success-muted text-sm">
                <span className="text-text-secondary">Profit: </span>
                <span className="text-success font-semibold">{formatCurrency(Number(formSellingPrice) - Number(formBuyingPrice))}</span>
                <span className="text-text-muted ml-2">
                  ({(((Number(formSellingPrice) - Number(formBuyingPrice)) / Number(formSellingPrice)) * 100).toFixed(1)}% margin)
                </span>
              </div>
            )}
            {!editingProduct && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-text-secondary">Initial Stock</Label>
                  <Input type="number" value={formStock} onChange={e => setFormStock(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-text-secondary">Min Stock Level</Label>
                  <Input type="number" value={formMinStock} onChange={e => setFormMinStock(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Category</Label>
              <div className="flex gap-2">
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setShowNewCategory(true)}><Plus className="h-4 w-4" /></Button>
              </div>
              {showNewCategory && (
                <div className="flex gap-2">
                  <Input placeholder="New category" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                  <Button size="sm" onClick={handleAddCategory}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewCategory(false)}>Cancel</Button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Unit</Label>
              <Select value={formUnit} onValueChange={setFormUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Pieces</SelectItem>
                  <SelectItem value="kg">Kilograms</SelectItem>
                  <SelectItem value="litres">Litres</SelectItem>
                  <SelectItem value="packets">Packets</SelectItem>
                  <SelectItem value="rolls">Rolls</SelectItem>
                  <SelectItem value="bottles">Bottles</SelectItem>
                  <SelectItem value="cartons">Cartons</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Expiry Date (optional)</Label>
              <Input type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-text-secondary">Notes</Label>
              <Textarea placeholder="Optional notes..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAddProduct(false); resetForm(); }}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveProduct}>{editingProduct ? 'Save Changes' : 'Add Product'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProduct.name}</DialogTitle>
                <DialogDescription>
                  {selectedProduct.barcode && `Barcode: ${selectedProduct.barcode}`}
                  {selectedProduct.sku && ` · SKU: ${selectedProduct.sku}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-elevated">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Buying Price</p>
                    <p className="text-lg font-bold text-text tabular-nums mt-0.5">{formatCurrency(Number(selectedProduct.buying_price))}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-elevated">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Selling Price</p>
                    <p className="text-lg font-bold text-primary tabular-nums mt-0.5">{formatCurrency(Number(selectedProduct.selling_price))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-elevated text-center">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Profit/Unit</p>
                    <p className="text-sm font-bold text-success tabular-nums mt-0.5">
                      {formatCurrency(Number(selectedProduct.selling_price) - Number(selectedProduct.buying_price))}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-elevated text-center">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Margin</p>
                    <p className="text-sm font-bold text-text tabular-nums mt-0.5">
                      {Number(selectedProduct.selling_price) > 0
                        ? (((Number(selectedProduct.selling_price) - Number(selectedProduct.buying_price)) / Number(selectedProduct.selling_price)) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-elevated text-center">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Stock</p>
                    <p className={cn('text-sm font-bold tabular-nums mt-0.5',
                      selectedProduct.current_stock === 0 ? 'text-danger' : 'text-text'
                    )}>
                      {selectedProduct.current_stock} {selectedProduct.unit}
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-elevated space-y-2">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Stock Value</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">At Cost</span>
                    <span className="font-medium text-text tabular-nums">{formatCurrency(Number(selectedProduct.buying_price) * selectedProduct.current_stock)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">At Retail</span>
                    <span className="font-medium text-primary tabular-nums">{formatCurrency(Number(selectedProduct.selling_price) * selectedProduct.current_stock)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Potential Profit</span>
                    <span className="font-medium text-success tabular-nums">
                      {formatCurrency((Number(selectedProduct.selling_price) - Number(selectedProduct.buying_price)) * selectedProduct.current_stock)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { setSelectedProduct(null); startEdit(selectedProduct); }}>
                    <Edit className="h-4 w-4" /> Edit
                  </Button>
                  <Button className="flex-1" onClick={() => setSelectedProduct(null)}>Close</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = 'default' }: {
  label: string; value: string; icon: React.ElementType; color?: 'default' | 'primary' | 'warning';
}) {
  const colorMap = {
    default: 'text-text-muted',
    primary: 'text-primary',
    warning: 'text-warning',
  };
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-3">
      <Icon className={cn('h-4 w-4 mb-2', colorMap[color])} strokeWidth={1.8} />
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className={cn('text-base font-bold tabular-nums mt-0.5', color === 'primary' ? 'text-primary' : color === 'warning' ? 'text-warning' : 'text-text')}>
        {value}
      </p>
    </div>
  );
}
