export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';

export type PaymentMethod = 'CASH' | 'M-PESA' | 'CREDIT';

export type StockMovementType =
  | 'RECEIPT'
  | 'SALE'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'DAMAGE'
  | 'EXPIRED'
  | 'LOST'
  | 'THEFT'
  | 'COUNTING_CORRECTION';

export type ShiftStatus = 'OPEN' | 'CLOSED';

export type ExpenseCategory =
  | 'RENT'
  | 'ELECTRICITY'
  | 'TRANSPORT'
  | 'STAFF_PAYMENT'
  | 'REPAIRS'
  | 'SUPPLIES'
  | 'OTHER';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ShopMember {
  id: string;
  shop_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  profile?: Profile;
  shop?: Shop;
}

export interface Customer {
  id: string;
  shop_id: string;
  full_name: string;
  phone?: string;
  current_balance: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  shop_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  shop_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Product {
  id: string;
  shop_id: string;
  name: string;
  barcode?: string;
  sku?: string;
  category_id?: string;
  supplier_id?: string;
  buying_price: number;
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  unit: string;
  expiry_date?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  supplier?: Supplier;
}

export interface ProductPriceHistory {
  id: string;
  product_id: string;
  buying_price: number;
  selling_price: number;
  changed_by?: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  shop_id: string;
  product_id: string;
  quantity_change: number;
  movement_type: StockMovementType;
  reason?: string;
  reference?: string;
  buying_price?: number;
  selling_price?: number;
  supplier_id?: string;
  user_id: string;
  created_at: string;
  product?: Product;
  user?: Profile;
}

export interface Sale {
  id: string;
  shop_id: string;
  receipt_number: string;
  customer_id?: string;
  user_id: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  mpesa_reference?: string;
  notes?: string;
  created_at: string;
  customer?: Customer;
  user?: Profile;
  items?: SaleItem[];
  payments?: Payment[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  buying_price: number;
  discount: number;
  total: number;
  cogs: number;
  gross_profit: number;
  created_at: string;
}

export interface Payment {
  id: string;
  shop_id: string;
  sale_id?: string;
  customer_id?: string;
  amount: number;
  payment_method: PaymentMethod;
  mpesa_reference?: string;
  notes?: string;
  user_id: string;
  created_at: string;
  customer?: Customer;
  sale?: Sale;
}

export interface CustomerLedgerEntry {
  id: string;
  shop_id: string;
  customer_id: string;
  sale_id?: string;
  payment_id?: string;
  type: 'CREDIT' | 'PAYMENT' | 'ADJUSTMENT';
  amount: number;
  balance_after: number;
  description?: string;
  created_at: string;
  user_id: string;
}

export interface Expense {
  id: string;
  shop_id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  expense_date: string;
  payment_method: PaymentMethod;
  user_id: string;
  created_at: string;
  user?: Profile;
}

export interface Shift {
  id: string;
  shop_id: string;
  user_id: string;
  status: ShiftStatus;
  opening_cash: number;
  closing_cash?: number;
  expected_cash?: number;
  cash_sales: number;
  mpesa_sales: number;
  credit_sales: number;
  cash_refunds: number;
  cash_payouts: number;
  difference?: number;
  opened_at: string;
  closed_at?: string;
  notes?: string;
}

export interface CashMovement {
  id: string;
  shift_id: string;
  type: 'SALE' | 'REFUND' | 'PAYOUT' | 'OPENING' | 'CLOSING';
  amount: number;
  reference?: string;
  description?: string;
  user_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  shop_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  user?: Profile;
}

export interface Settings {
  id: string;
  shop_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

// POS Cart Types
export interface CartItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  buying_price: number;
  discount: number;
  stock_available: number;
}

// Dashboard Types
export interface DashboardData {
  todaySales: number;
  netProfit: number;
  transactions: number;
  outstandingDebt: number;
  lowStockProducts: Product[];
  overdueCustomers: Customer[];
  recentSales: Sale[];
}

// Analytics Types
export interface SalesTrend {
  date: string;
  sales: number;
  profit: number;
  transactions: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue: number;
  profit: number;
}

// Shift Reconciliation
export interface ShiftSummary {
  opening_cash: number;
  cash_sales: number;
  cash_refunds: number;
  cash_payouts: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  mpesa_total: number;
  credit_total: number;
}
