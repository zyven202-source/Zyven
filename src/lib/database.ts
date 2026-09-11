import { supabase } from './supabase';
import type {
  Product, Customer, Supplier, Category, Sale, SaleItem, Payment,
  Expense, Shift, StockMovement, CustomerLedgerEntry, AuditLog,
  CartItem, StockMovementType, ExpenseCategory, PaymentMethod,
} from '@/types';

// ============================================
// SHOP
// ============================================
export async function createShop(name: string, ownerId: string) {
  const { data, error } = await supabase
    .from('shops')
    .insert({ name, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;

  // Add owner as member
  await supabase.from('shop_members').insert({
    shop_id: data.id,
    user_id: ownerId,
    role: 'OWNER',
    is_active: true,
  });

  return data;
}

// ============================================
// PRODUCTS
// ============================================
export async function getProducts(shopId: string, search?: string, categoryId?: string) {
  let query = supabase
    .from('products')
    .select('*, category:categories(*), supplier:suppliers(*)')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('name');

  if (search) {
    query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%,sku.ilike.%${search}%`);
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Product[];
}

export async function getProduct(shopId: string, productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*), supplier:suppliers(*)')
    .eq('shop_id', shopId)
    .eq('id', productId)
    .single();
  if (error) throw error;
  return data as Product;
}

export async function searchProducts(shopId: string, query: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .or(`name.ilike.%${query}%,barcode.ilike.%${query}%,sku.ilike.%${query}%`)
    .order('name')
    .limit(50);
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'current_stock'> & { current_stock?: number }, userId?: string) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      ...product,
      current_stock: product.current_stock || 0,
    })
    .select()
    .single();
  if (error) throw error;

  // Record price history
  await supabase.from('product_price_history').insert({
    product_id: data.id,
    buying_price: product.buying_price,
    selling_price: product.selling_price,
  });

  // Audit log
  if (product.shop_id) {
    await supabase.from('audit_logs').insert({
      shop_id: product.shop_id,
      user_id: userId || data.shop_id,
      action: 'PRODUCT_CREATED',
      entity_type: 'product',
      entity_id: data.id,
      metadata: { name: product.name, buying_price: product.buying_price, selling_price: product.selling_price, initial_stock: product.current_stock || 0 },
    });
  }

  return data;
}

export async function updateProduct(productId: string, updates: Partial<Product>) {
  // Check if prices changed - record in history
  if (updates.buying_price !== undefined || updates.selling_price !== undefined) {
    const { data: current } = await supabase
      .from('products')
      .select('buying_price, selling_price')
      .eq('id', productId)
      .single();

    if (current && (
      current.buying_price !== updates.buying_price ||
      current.selling_price !== updates.selling_price
    )) {
      await supabase.from('product_price_history').insert({
        product_id: productId,
        buying_price: updates.buying_price ?? current.buying_price,
        selling_price: updates.selling_price ?? current.selling_price,
      });
    }
  }

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select()
    .single();
  if (error) throw error;

  // Audit log
  if (data?.shop_id) {
    await supabase.from('audit_logs').insert({
      shop_id: data.shop_id,
      user_id: data.shop_id,
      action: 'PRODUCT_EDITED',
      entity_type: 'product',
      entity_id: productId,
      metadata: { name: data.name, buying_price: data.buying_price, selling_price: data.selling_price },
    });
  }

  return data;
}

export async function getProductPriceHistory(productId: string) {
  const { data, error } = await supabase
    .from('product_price_history')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ============================================
// STOCK
// ============================================
export async function addStock(
  shopId: string,
  productId: string,
  quantity: number,
  buyingPrice: number,
  sellingPrice: number,
  userId: string,
  supplierId?: string,
  reason?: string
) {
  // Get current product
  const { data: product } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', productId)
    .single();

  if (!product) throw new Error('Product not found');

  // Update stock
  const newStock = product.current_stock + quantity;
  await supabase
    .from('products')
    .update({
      current_stock: newStock,
      buying_price: buyingPrice,
      selling_price: sellingPrice,
    })
    .eq('id', productId);

  // Record stock movement
  const { data: movement, error } = await supabase
    .from('stock_movements')
    .insert({
      shop_id: shopId,
      product_id: productId,
      quantity_change: quantity,
      movement_type: 'RECEIPT',
      reason: reason || 'Stock received',
      buying_price: buyingPrice,
      selling_price: sellingPrice,
      supplier_id: supplierId,
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;

  // Audit log
  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    user_id: userId,
    action: 'STOCK_RECEIVED',
    entity_type: 'product',
    entity_id: productId,
    metadata: { quantity, buying_price: buyingPrice, selling_price: sellingPrice, reason: reason || 'Stock received' },
  });

  return movement;
}

export async function adjustStock(
  shopId: string,
  productId: string,
  quantityChange: number,
  movementType: StockMovementType,
  userId: string,
  reason?: string,
  reference?: string
) {
  const { data: product } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', productId)
    .single();

  if (!product) throw new Error('Product not found');

  const newStock = Math.max(0, product.current_stock + quantityChange);
  await supabase
    .from('products')
    .update({ current_stock: newStock })
    .eq('id', productId);

  const { data: movement, error } = await supabase
    .from('stock_movements')
    .insert({
      shop_id: shopId,
      product_id: productId,
      quantity_change: quantityChange,
      movement_type: movementType,
      reason,
      reference,
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;

  return movement;
}

export async function getStockMovements(shopId: string, productId?: string) {
  let query = supabase
    .from('stock_movements')
    .select('*, product:products(name, sku, barcode), user:profiles(full_name)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as StockMovement[];
}

// ============================================
// SALES (POS)
// ============================================
export async function processSale(
  shopId: string,
  userId: string,
  cartItems: CartItem[],
  paymentMethod: PaymentMethod,
  customerId?: string,
  mpesaReference?: string,
  discount: number = 0,
  shiftId?: string
) {
  // Validate all products have valid buying prices
  for (const item of cartItems) {
    if (!item.buying_price || item.buying_price <= 0) {
      throw new Error(`Product "${item.product_name}" must have a valid buying price before it can be sold.`);
    }
    if (item.quantity > item.stock_available) {
      throw new Error(`Insufficient stock for "${item.product_name}". Available: ${item.stock_available}, requested: ${item.quantity}`);
    }
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity) - item.discount, 0);
  const total = subtotal - discount;
  const receiptNumber = generateReceiptNumber();

  // Create sale
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      shop_id: shopId,
      receipt_number: receiptNumber,
      customer_id: customerId || null,
      user_id: userId,
      subtotal,
      discount,
      total,
      payment_method: paymentMethod,
      mpesa_reference: mpesaReference || null,
    })
    .select()
    .single();
  if (saleError) throw saleError;

  // Create sale items and update stock
  const saleItems = [];
  for (const item of cartItems) {
    const itemTotal = (item.unit_price * item.quantity) - item.discount;
    const cogs = item.buying_price * item.quantity;
    const grossProfit = itemTotal - cogs;

    const { data: saleItem } = await supabase
      .from('sale_items')
      .insert({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        buying_price: item.buying_price,
        discount: item.discount,
        total: itemTotal,
        cogs,
        gross_profit: grossProfit,
      })
      .select()
      .single();

    saleItems.push(saleItem);

    // Update product stock
    const { data: product } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', item.product_id)
      .single();

    if (product) {
      await supabase
        .from('products')
        .update({ current_stock: Math.max(0, product.current_stock - item.quantity) })
        .eq('id', item.product_id);

      // Record stock movement
      await supabase.from('stock_movements').insert({
        shop_id: shopId,
        product_id: item.product_id,
        quantity_change: -item.quantity,
        movement_type: 'SALE',
        reason: `POS Sale ${receiptNumber}`,
        reference: sale.id,
        buying_price: item.buying_price,
        selling_price: item.unit_price,
        user_id: userId,
      });
    }
  }

  // Create payment record
  await supabase.from('payments').insert({
    shop_id: shopId,
    sale_id: sale.id,
    customer_id: customerId || null,
    amount: total,
    payment_method: paymentMethod,
    mpesa_reference: mpesaReference || null,
    user_id: userId,
  });

  // Handle credit - update customer balance
  if (paymentMethod === 'CREDIT' && customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('current_balance')
      .eq('id', customerId)
      .single();

    if (customer) {
      const newBalance = customer.current_balance + total;
      await supabase
        .from('customers')
        .update({ current_balance: newBalance })
        .eq('id', customerId);

      await supabase.from('customer_ledger_entries').insert({
        shop_id: shopId,
        customer_id: customerId,
        sale_id: sale.id,
        type: 'CREDIT',
        amount: total,
        balance_after: newBalance,
        description: `Credit sale ${receiptNumber}`,
        user_id: userId,
      });
    }
  }

  // Update shift totals if shift is active
  if (shiftId) {
    const { data: shift } = await supabase
      .from('shifts')
      .select('cash_sales, mpesa_sales, credit_sales')
      .eq('id', shiftId)
      .single();

    if (shift) {
      const updates: Record<string, number> = {};
      if (paymentMethod === 'CASH') updates.cash_sales = (Number(shift.cash_sales) || 0) + total;
      if (paymentMethod === 'M-PESA') updates.mpesa_sales = (Number(shift.mpesa_sales) || 0) + total;
      if (paymentMethod === 'CREDIT') updates.credit_sales = (Number(shift.credit_sales) || 0) + total;
      await supabase.from('shifts').update(updates).eq('id', shiftId);
    }
  }

  // Create audit log
  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    user_id: userId,
    action: 'SALE_CREATED',
    entity_type: 'sale',
    entity_id: sale.id,
    metadata: { receipt_number: receiptNumber, total, payment_method: paymentMethod },
  });

  return { sale, items: saleItems };
}

function generateReceiptNumber(): string {
  const now = new Date();
  const prefix = 'DL';
  const date = now.getFullYear().toString().slice(-2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const time = String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${date}-${time}-${rand}`;
}

// ============================================
// SALES QUERIES
// ============================================
export async function getSales(shopId: string, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, customer:customers(full_name, phone), user:profiles(full_name), items:sale_items(*)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data as Sale[];
}

export async function getSale(shopId: string, saleId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, customer:customers(full_name, phone), user:profiles(full_name), items:sale_items(*), payments(*)')
    .eq('shop_id', shopId)
    .eq('id', saleId)
    .single();
  if (error) throw error;
  return data as Sale;
}

export async function getTodaySales(shopId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('sales')
    .select('total, payment_method, created_at')
    .eq('shop_id', shopId)
    .gte('created_at', today.toISOString());
  if (error) throw error;

  const totalSales = data.reduce((sum, s) => sum + Number(s.total), 0);
  const cashSales = data.filter(s => s.payment_method === 'CASH').reduce((sum, s) => sum + Number(s.total), 0);
  const mpesaSales = data.filter(s => s.payment_method === 'M-PESA').reduce((sum, s) => sum + Number(s.total), 0);
  const creditSales = data.filter(s => s.payment_method === 'CREDIT').reduce((sum, s) => sum + Number(s.total), 0);

  return {
    totalSales,
    cashSales,
    mpesaSales,
    creditSales,
    transactionCount: data.length,
  };
}

export async function getSalesTrend(shopId: string, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const { data: salesData } = await supabase
    .from('sales')
    .select('total, created_at')
    .eq('shop_id', shopId)
    .gte('created_at', startDate.toISOString())
    .order('created_at');

  const { data: expensesData } = await supabase
    .from('expenses')
    .select('amount, expense_date')
    .eq('shop_id', shopId)
    .gte('expense_date', startDate.toISOString().split('T')[0]);

  if (!salesData) return [];

  // Group by date
  const trend: Record<string, { date: string; sales: number; transactions: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    trend[key] = { date: key, sales: 0, transactions: 0 };
  }

  for (const sale of salesData) {
    const key = sale.created_at.split('T')[0];
    if (trend[key]) {
      trend[key].sales += Number(sale.total);
      trend[key].transactions += 1;
    }
  }

  return Object.values(trend);
}

export async function getTopProducts(shopId: string, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const { data: sales } = await supabase
    .from('sales')
    .select('id')
    .eq('shop_id', shopId)
    .gte('created_at', startDate.toISOString());

  if (!sales || sales.length === 0) return [];

  const saleIds = sales.map(s => s.id);

  const { data: items } = await supabase
    .from('sale_items')
    .select('product_id, product_name, quantity, total, cogs, gross_profit')
    .in('sale_id', saleIds);

  if (!items) return [];

  // Aggregate by product
  const productMap: Record<string, {
    product_id: string;
    product_name: string;
    quantity_sold: number;
    revenue: number;
    profit: number;
  }> = {};

  for (const item of items) {
    if (!productMap[item.product_id]) {
      productMap[item.product_id] = {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_sold: 0,
        revenue: 0,
        profit: 0,
      };
    }
    productMap[item.product_id].quantity_sold += item.quantity;
    productMap[item.product_id].revenue += Number(item.total);
    productMap[item.product_id].profit += Number(item.gross_profit);
  }

  return Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

// ============================================
// CUSTOMERS (DAFTARI)
// ============================================
export async function getCustomers(shopId: string, search?: string) {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('shop_id', shopId)
    .order('full_name');

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Customer[];
}

export async function createCustomer(shopId: string, customer: { full_name: string; phone?: string; notes?: string }, userId?: string) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ shop_id: shopId, ...customer, current_balance: 0 })
    .select()
    .single();
  if (error) throw error;

  // Audit log
  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    user_id: userId || shopId,
    action: 'CUSTOMER_CREATED',
    entity_type: 'customer',
    entity_id: data.id,
    metadata: { name: customer.full_name, phone: customer.phone || null },
  });

  return data;
}

export async function getCustomer(shopId: string, customerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('shop_id', shopId)
    .eq('id', customerId)
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function getCustomerLedger(shopId: string, customerId: string) {
  const { data, error } = await supabase
    .from('customer_ledger_entries')
    .select('*, user:profiles(full_name)')
    .eq('shop_id', shopId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as CustomerLedgerEntry[];
}

export async function recordCustomerPayment(
  shopId: string,
  customerId: string,
  amount: number,
  userId: string,
  paymentMethod: PaymentMethod = 'CASH',
  mpesaReference?: string
) {
  const { data: customer } = await supabase
    .from('customers')
    .select('current_balance')
    .eq('id', customerId)
    .single();

  if (!customer) throw new Error('Customer not found');
  if (amount <= 0) throw new Error('Payment amount must be positive');

  const actualAmount = Math.min(amount, Number(customer.current_balance));
  const newBalance = Math.max(0, Number(customer.current_balance) - actualAmount);

  // Update customer balance
  await supabase
    .from('customers')
    .update({ current_balance: newBalance })
    .eq('id', customerId);

  // Create payment
  const { data: payment } = await supabase
    .from('payments')
    .insert({
      shop_id: shopId,
      customer_id: customerId,
      amount: actualAmount,
      payment_method: paymentMethod,
      mpesa_reference: mpesaReference,
      user_id: userId,
    })
    .select()
    .single();

  // Create ledger entry
  await supabase.from('customer_ledger_entries').insert({
    shop_id: shopId,
    customer_id: customerId,
    payment_id: payment?.id,
    type: 'PAYMENT',
    amount: actualAmount,
    balance_after: newBalance,
    description: `Payment received via ${paymentMethod}`,
    user_id: userId,
  });

  return { payment, newBalance };
}

// ============================================
// EXPENSES
// ============================================
export async function getExpenses(shopId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('expenses')
    .select('*, user:profiles(full_name)')
    .eq('shop_id', shopId)
    .order('expense_date', { ascending: false });

  if (startDate) query = query.gte('expense_date', startDate);
  if (endDate) query = query.lte('expense_date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data as Expense[];
}

export async function createExpense(
  shopId: string,
  expense: {
    amount: number;
    category: ExpenseCategory;
    description: string;
    expense_date: string;
    payment_method: PaymentMethod;
  },
  userId: string
) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ shop_id: shopId, user_id: userId, ...expense })
    .select()
    .single();
  if (error) throw error;

  // Audit log
  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    user_id: userId,
    action: 'EXPENSE_CREATED',
    entity_type: 'expense',
    entity_id: data.id,
    metadata: { amount: expense.amount, category: expense.category },
  });

  return data;
}

export async function getTotalExpenses(shopId: string, startDate?: string) {
  let query = supabase
    .from('expenses')
    .select('amount')
    .eq('shop_id', shopId);

  if (startDate) query = query.gte('expense_date', startDate);

  const { data, error } = await query;
  if (error) return 0;
  return data.reduce((sum, e) => sum + Number(e.amount), 0);
}

// ============================================
// SHIFTS
// ============================================
export async function getActiveShift(shopId: string) {
  const { data, error } = await supabase
    .from('shifts')
    .select('*, user:profiles(full_name)')
    .eq('shop_id', shopId)
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Shift | null;
}

export async function openShift(shopId: string, userId: string, openingCash: number) {
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      shop_id: shopId,
      user_id: userId,
      opening_cash: openingCash,
      status: 'OPEN',
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    user_id: userId,
    action: 'SHIFT_OPENED',
    entity_type: 'shift',
    entity_id: data.id,
    metadata: { opening_cash: openingCash },
  });

  return data;
}

export async function closeShift(
  shiftId: string,
  shopId: string,
  userId: string,
  closingCash: number,
  notes?: string
) {
  const { data: shift } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .single();

  if (!shift) throw new Error('Shift not found');

  const expectedCash = Number(shift.opening_cash) + Number(shift.cash_sales) - Number(shift.cash_refunds) - Number(shift.cash_payouts);
  const difference = closingCash - expectedCash;

  const { data, error } = await supabase
    .from('shifts')
    .update({
      status: 'CLOSED',
      closing_cash: closingCash,
      expected_cash: expectedCash,
      difference,
      closed_at: new Date().toISOString(),
      notes,
    })
    .eq('id', shiftId)
    .select()
    .single();
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    user_id: userId,
    action: 'SHIFT_CLOSED',
    entity_type: 'shift',
    entity_id: shiftId,
    metadata: { expected_cash: expectedCash, closing_cash: closingCash, difference },
  });

  return data;
}

export async function getShifts(shopId: string, limit = 30) {
  const { data, error } = await supabase
    .from('shifts')
    .select('*, user:profiles(full_name)')
    .eq('shop_id', shopId)
    .order('opened_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Shift[];
}

// ============================================
// CATEGORIES
// ============================================
export async function getCategories(shopId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('shop_id', shopId)
    .order('name');
  if (error) throw error;
  return data as Category[];
}

export async function createCategory(shopId: string, name: string) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ shop_id: shopId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// SUPPLIERS
// ============================================
export async function getSuppliers(shopId: string) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('shop_id', shopId)
    .order('name');
  if (error) throw error;
  return data as Supplier[];
}

export async function createSupplier(shopId: string, supplier: { name: string; phone?: string; email?: string; address?: string; notes?: string }, userId?: string) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ shop_id: shopId, ...supplier })
    .select()
    .single();
  if (error) throw error;

  // Audit log
  await supabase.from('audit_logs').insert({
    shop_id: shopId,
    user_id: userId || shopId,
    action: 'SUPPLIER_CREATED',
    entity_type: 'supplier',
    entity_id: data.id,
    metadata: { name: supplier.name },
  });

  return data;
}

// ============================================
// AUDIT LOGS
// ============================================
export async function getAuditLogs(shopId: string, limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, user:profiles(full_name)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AuditLog[];
}

// ============================================
// DASHBOARD
// ============================================
export async function getDashboardData(shopId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Today's sales
  const todaySales = await getTodaySales(shopId);

  // Total profit this month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const { data: monthSales } = await supabase
    .from('sales')
    .select('id')
    .eq('shop_id', shopId)
    .gte('created_at', monthStart);

  let totalProfit = 0;
  let totalCOGS = 0;
  if (monthSales && monthSales.length > 0) {
    const { data: items } = await supabase
      .from('sale_items')
      .select('cogs, gross_profit')
      .in('sale_id', monthSales.map(s => s.id));

    if (items) {
      totalCOGS = items.reduce((sum, i) => sum + Number(i.cogs), 0);
      totalProfit = items.reduce((sum, i) => sum + Number(i.gross_profit), 0);
    }
  }

  // Outstanding debt
  const { data: debtCustomers } = await supabase
    .from('customers')
    .select('current_balance')
    .eq('shop_id', shopId)
    .gt('current_balance', 0);

  const outstandingDebt = debtCustomers?.reduce((sum, c) => sum + Number(c.current_balance), 0) || 0;

  // Low stock products
  const { data: lowStock } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .lte('current_stock', 5);

  // Overdue customers
  const overdueCustomers = debtCustomers?.filter(c => Number(c.current_balance) > 0) || [];

  // Active shift
  const activeShift = await getActiveShift(shopId);

  // Today's expenses
  const todayExpenses = await getTotalExpenses(shopId, today.toISOString().split('T')[0]);

  // Recent transactions (5 latest)
  const recentSales = await getSales(shopId, 5);

  return {
    todaySales: todaySales.totalSales,
    cashSales: todaySales.cashSales,
    mpesaSales: todaySales.mpesaSales,
    creditSales: todaySales.creditSales,
    transactionCount: todaySales.transactionCount,
    netProfit: totalProfit - todayExpenses,
    totalProfit,
    totalCOGS,
    outstandingDebt,
    lowStockProducts: lowStock || [],
    overdueCustomers,
    activeShift,
    todayExpenses,
    recentSales,
  };
}
