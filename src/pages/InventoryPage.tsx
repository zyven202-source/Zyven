import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getProducts, createProduct, updateProduct, getCategories, createCategory } from '@/lib/database';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import type { Product, Category } from '@/types';
import {
  Plus, Search, Package, Filter, TrendingUp, TrendingDown,
  AlertTriangle, XCircle, Edit, Eye, DollarSign, BarChart2,
} from 'lucide-react';

type FilterType = 'all' | 'low_stock' | 'fast_selling' | 'slow_moving' | 'out_of_stock';

export default function InventoryPage() {
  const { shop, user, role } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form state
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
      const [prods, cats] = await Promise.all([
        getProducts(shop.id),
        getCategories(shop.id),
      ]);
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
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalStockValue = products.reduce((sum, p) => sum + (Number(p.buying_price) * p.current_stock), 0);
  const totalPotentialRevenue = products.reduce((sum, p) => sum + (Number(p.selling_price) * p.current_stock), 0);
  const lowStockCount = products.filter(p => p.current_stock <= p.minimum_stock && p.current_stock > 0).length;
  const outOfStockCount = products.filter(p => p.current_stock === 0).length;

  const resetForm = () => {
    setFormName(''); setFormBarcode(''); setFormSku('');
    setFormBuyingPrice(''); setFormSellingPrice(''); setFormStock('0');
    setFormMinStock('5'); setFormCategory(''); setFormUnit('pcs');
    setFormNotes(''); setEditingProduct(null);
  };

  const handleSaveProduct = async () => {
    if (!shop || !formName.trim()) {
      addToast('error', 'Product name is required');
      return;
    }
    if (!formBuyingPrice || Number(formBuyingPrice) <= 0) {
      addToast('error', 'Valid buying price is required');
      return;
    }
    if (!formSellingPrice || Number(formSellingPrice) <= 0) {
      addToast('error', 'Selling price must be greater than zero');
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: formName.trim(),
          barcode: formBarcode || undefined,
          sku: formSku || undefined,
          buying_price: Number(formBuyingPrice),
          selling_price: Number(formSellingPrice),
          minimum_stock: Number(formMinStock),
          category_id: formCategory || undefined,
          unit: formUnit,
          notes: formNotes || undefined,
        });
        addToast('success', 'Product updated');
      } else {
        await createProduct({
          shop_id: shop.id,
          name: formName.trim(),
          barcode: formBarcode || undefined,
          sku: formSku || undefined,
          buying_price: Number(formBuyingPrice),
          selling_price: Number(formSellingPrice),
          current_stock: Number(formStock),
          minimum_stock: Number(formMinStock),
          category_id: formCategory || undefined,
          unit: formUnit,
          notes: formNotes || undefined,
          is_active: true,
        });
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
    } catch (err: any) {
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
    setShowAddProduct(true);
  };

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: products.length },
    { key: 'low_stock', label: 'Low Stock', count: lowStockCount },
    { key: 'out_of_stock', label: 'Out of Stock', count: outOfStockCount },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Inventory</h1>
        {(role === 'OWNER' || role === 'MANAGER') && (
          <Button onClick={() => { resetForm(); setShowAddProduct(true); }}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Products', value: products.length, icon: Package },
          { label: 'Stock Value', value: formatCurrency(totalStockValue), icon: DollarSign },
          { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, color: 'text-warning' },
          { label: 'Out of Stock', value: outOfStockCount, icon: XCircle, color: 'text-danger' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-3">
              <stat.icon className={`h-4 w-4 ${stat.color || 'text-text-muted'} mb-1`} />
              <p className="text-xs text-text-muted">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color || 'text-text-primary'}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search by name, barcode, SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key
                  ? 'bg-primary text-bg'
                  : 'bg-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              {f.label} {f.count !== undefined && `(${f.count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Products List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading inventory...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center py-12">
          <Package className="h-12 w-12 text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">
            {search ? 'No products match your search' : 'No products yet'}
          </p>
          <p className="text-sm text-text-muted mt-1">
            {search ? 'Try a different search term' : 'Add your first product to start'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map((product, i) => {
            const margin = Number(product.selling_price) > 0
              ? ((Number(product.selling_price) - Number(product.buying_price)) / Number(product.selling_price) * 100)
              : 0;
            const profit = Number(product.selling_price) - Number(product.buying_price);
            const isOOS = product.current_stock === 0;
            const isLow = product.current_stock <= product.minimum_stock && product.current_stock > 0;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card
                  className={`cursor-pointer hover:border-primary/30 transition-colors ${
                    isOOS ? 'border-danger/30' : isLow ? 'border-warning/30' : ''
                  }`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-text-primary truncate">{product.name}</h3>
                          {isOOS && <Badge variant="danger">OOS</Badge>}
                          {isLow && <Badge variant="warning">LOW</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                          {product.barcode && <span>BC: {product.barcode}</span>}
                          {product.sku && <span>SKU: {product.sku}</span>}
                          {product.category && <span>{product.category.name}</span>}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-primary">{formatCurrency(Number(product.selling_price))}</p>
                        <p className="text-xs text-text-muted">Cost: {formatCurrency(Number(product.buying_price))}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-text-muted">Stock</p>
                          <p className={`text-sm font-medium ${isOOS ? 'text-danger' : isLow ? 'text-warning' : 'text-text-primary'}`}>
                            {product.current_stock} {product.unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Profit/Unit</p>
                          <p className="text-sm font-medium text-success">{formatCurrency(profit)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Margin</p>
                          <p className="text-sm font-medium text-text-primary">{margin.toFixed(1)}%</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); startEdit(product); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Product Dialog */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update product details' : 'Fill in product details to add to inventory'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input placeholder="e.g., Milk 500ml" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input placeholder="Scan or type" value={formBarcode} onChange={e => setFormBarcode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input placeholder="Stock keeping unit" value={formSku} onChange={e => setFormSku(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Buying Price (KSh) *</Label>
                <Input type="number" placeholder="0" value={formBuyingPrice} onChange={e => setFormBuyingPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Selling Price (KSh) *</Label>
                <Input type="number" placeholder="0" value={formSellingPrice} onChange={e => setFormSellingPrice(e.target.value)} />
              </div>
            </div>

            {formBuyingPrice && formSellingPrice && Number(formBuyingPrice) > 0 && Number(formSellingPrice) > 0 && (
              <div className="p-3 rounded-lg bg-elevated text-sm">
                <span className="text-text-secondary">Profit: </span>
                <span className="text-success font-medium">
                  {formatCurrency(Number(formSellingPrice) - Number(formBuyingPrice))}
                </span>
                <span className="text-text-muted ml-2">
                  ({(((Number(formSellingPrice) - Number(formBuyingPrice)) / Number(formSellingPrice)) * 100).toFixed(1)}% margin)
                </span>
              </div>
            )}

            {!editingProduct && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Initial Stock</Label>
                  <Input type="number" value={formStock} onChange={e => setFormStock(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Min Stock Level</Label>
                  <Input type="number" value={formMinStock} onChange={e => setFormMinStock(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex gap-2">
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setShowNewCategory(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {showNewCategory && (
                <div className="flex gap-2">
                  <Input placeholder="New category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                  <Button size="sm" onClick={handleAddCategory}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewCategory(false)}>Cancel</Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={formUnit} onValueChange={setFormUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="litres">Litres</SelectItem>
                  <SelectItem value="packets">Packets</SelectItem>
                  <SelectItem value="rolls">Rolls</SelectItem>
                  <SelectItem value="bottles">Bottles</SelectItem>
                  <SelectItem value="cartons">Cartons</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAddProduct(false); resetForm(); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveProduct}>
                {editingProduct ? 'Save Changes' : 'Add Product'}
              </Button>
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
                  {selectedProduct.sku && ` • SKU: ${selectedProduct.sku}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-elevated">
                    <p className="text-xs text-text-muted">Buying Price</p>
                    <p className="text-lg font-bold text-text-primary">{formatCurrency(Number(selectedProduct.buying_price))}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-elevated">
                    <p className="text-xs text-text-muted">Selling Price</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(Number(selectedProduct.selling_price))}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-elevated text-center">
                    <p className="text-xs text-text-muted">Profit/Unit</p>
                    <p className="text-sm font-bold text-success">
                      {formatCurrency(Number(selectedProduct.selling_price) - Number(selectedProduct.buying_price))}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-elevated text-center">
                    <p className="text-xs text-text-muted">Margin</p>
                    <p className="text-sm font-bold text-text-primary">
                      {Number(selectedProduct.selling_price) > 0
                        ? (((Number(selectedProduct.selling_price) - Number(selectedProduct.buying_price)) / Number(selectedProduct.selling_price)) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-elevated text-center">
                    <p className="text-xs text-text-muted">Stock</p>
                    <p className={`text-sm font-bold ${
                      selectedProduct.current_stock === 0 ? 'text-danger' : 'text-text-primary'
                    }`}>
                      {selectedProduct.current_stock} {selectedProduct.unit}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-elevated">
                  <p className="text-xs text-text-muted mb-1">Stock Value</p>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">At Cost:</span>
                    <span className="text-sm font-medium text-text-primary">
                      {formatCurrency(Number(selectedProduct.buying_price) * selectedProduct.current_stock)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">At Retail:</span>
                    <span className="text-sm font-medium text-primary">
                      {formatCurrency(Number(selectedProduct.selling_price) * selectedProduct.current_stock)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Potential Profit:</span>
                    <span className="text-sm font-medium text-success">
                      {formatCurrency((Number(selectedProduct.selling_price) - Number(selectedProduct.buying_price)) * selectedProduct.current_stock)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { setSelectedProduct(null); startEdit(selectedProduct); }}>
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button className="flex-1" onClick={() => { setSelectedProduct(null); }}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
