-- Zyven - Complete Database Schema
-- Run this against Supabase PostgreSQL

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SHOPS
-- =============================================
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SHOP MEMBERS
-- =============================================
CREATE TABLE IF NOT EXISTS shop_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'CASHIER' CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

-- =============================================
-- CUSTOMERS
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  current_balance NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SUPPLIERS
-- =============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PRODUCTS
-- =============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode TEXT,
  sku TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  buying_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (buying_price >= 0),
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (selling_price > 0),
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  minimum_stock INTEGER DEFAULT 5 CHECK (minimum_stock >= 0),
  unit TEXT DEFAULT 'pcs',
  expiry_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PRODUCT PRICE HISTORY
-- =============================================
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buying_price NUMERIC(12,2) NOT NULL,
  selling_price NUMERIC(12,2) NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- STOCK MOVEMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('RECEIPT', 'SALE', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'EXPIRED', 'LOST', 'THEFT', 'COUNTING_CORRECTION')),
  reason TEXT,
  reference TEXT,
  buying_price NUMERIC(12,2),
  selling_price NUMERIC(12,2),
  supplier_id UUID REFERENCES suppliers(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SALES
-- =============================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'M-PESA', 'CREDIT')),
  mpesa_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SALE ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  buying_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  cogs NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PAYMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'M-PESA', 'CREDIT')),
  mpesa_reference TEXT,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CUSTOMER LEDGER ENTRIES
-- =============================================
CREATE TABLE IF NOT EXISTS customer_ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('CREDIT', 'PAYMENT', 'ADJUSTMENT')),
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- EXPENSES
-- =============================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL CHECK (category IN ('RENT', 'ELECTRICITY', 'TRANSPORT', 'STAFF_PAYMENT', 'REPAIRS', 'SUPPLIES', 'OTHER')),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'M-PESA', 'CREDIT')),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SHIFTS
-- =============================================
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(12,2),
  expected_cash NUMERIC(12,2),
  cash_sales NUMERIC(12,2) DEFAULT 0,
  mpesa_sales NUMERIC(12,2) DEFAULT 0,
  credit_sales NUMERIC(12,2) DEFAULT 0,
  cash_refunds NUMERIC(12,2) DEFAULT 0,
  cash_payouts NUMERIC(12,2) DEFAULT 0,
  difference NUMERIC(12,2),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);

-- =============================================
-- CASH MOVEMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SALE', 'REFUND', 'PAYOUT', 'OPENING', 'CLOSING')),
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- AUDIT LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, key)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_shop_members_user ON shop_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_members_shop ON shop_members(shop_id);

CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(shop_id, phone);

CREATE INDEX IF NOT EXISTS idx_suppliers_shop ON suppliers(shop_id);

CREATE INDEX IF NOT EXISTS idx_categories_shop ON categories(shop_id);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(shop_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(shop_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(shop_id, is_active);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_shop ON stock_movements(shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

CREATE INDEX IF NOT EXISTS idx_payments_shop ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

CREATE INDEX IF NOT EXISTS idx_ledger_customer ON customer_ledger_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_shop ON customer_ledger_entries(shop_id);

CREATE INDEX IF NOT EXISTS idx_expenses_shop ON expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

CREATE INDEX IF NOT EXISTS idx_shifts_shop ON shifts(shop_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_shop ON audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_settings_shop ON settings(shop_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's shop IDs
CREATE OR REPLACE FUNCTION public.get_user_shop_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Helper function: check if user has role in shop
CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shop_members
    WHERE shop_id = _shop_id AND user_id = auth.uid() AND role = _role AND is_active = true
  );
$$;

-- Helper function: get user's role in shop
CREATE OR REPLACE FUNCTION public.get_shop_role(_shop_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM shop_members
  WHERE shop_id = _shop_id AND user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- PROFILES
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- SHOPS
CREATE POLICY "Users can view their shops" ON shops FOR SELECT USING (id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Owners can update shop" ON shops FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Authenticated users can create shop" ON shops FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- SHOP MEMBERS
CREATE POLICY "Members can view shop members" ON shop_members FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Owners/managers can manage members" ON shop_members FOR ALL USING (
  shop_id IN (SELECT get_user_shop_ids()) AND
  (get_shop_role(shop_id) IN ('OWNER', 'MANAGER') OR user_id = auth.uid())
);

-- CUSTOMERS
CREATE POLICY "Shop members can view customers" ON customers FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can insert customers" ON customers FOR INSERT WITH CHECK (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can update customers" ON customers FOR UPDATE USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Managers/owners can delete customers" ON customers FOR DELETE USING (
  shop_id IN (SELECT get_user_shop_ids()) AND get_shop_role(shop_id) IN ('OWNER', 'MANAGER')
);

-- SUPPLIERS
CREATE POLICY "Shop members can view suppliers" ON suppliers FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can manage suppliers" ON suppliers FOR ALL USING (shop_id IN (SELECT get_user_shop_ids()) AND get_shop_role(shop_id) IN ('OWNER', 'MANAGER'));

-- CATEGORIES
CREATE POLICY "Shop members can view categories" ON categories FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can manage categories" ON categories FOR ALL USING (shop_id IN (SELECT get_user_shop_ids()));

-- PRODUCTS
CREATE POLICY "Shop members can view products" ON products FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can manage products" ON products FOR ALL USING (shop_id IN (SELECT get_user_shop_ids()));

-- PRODUCT PRICE HISTORY
CREATE POLICY "Shop members can view price history" ON product_price_history FOR SELECT USING (
  product_id IN (SELECT id FROM products WHERE shop_id IN (SELECT get_user_shop_ids()))
);
CREATE POLICY "Shop members can insert price history" ON product_price_history FOR INSERT WITH CHECK (
  product_id IN (SELECT id FROM products WHERE shop_id IN (SELECT get_user_shop_ids()))
);

-- STOCK MOVEMENTS
CREATE POLICY "Shop members can view stock movements" ON stock_movements FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can insert stock movements" ON stock_movements FOR INSERT WITH CHECK (shop_id IN (SELECT get_user_shop_ids()));

-- SALES
CREATE POLICY "Shop members can view sales" ON sales FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can create sales" ON sales FOR INSERT WITH CHECK (shop_id IN (SELECT get_user_shop_ids()));

-- SALE ITEMS
CREATE POLICY "Shop members can view sale items" ON sale_items FOR SELECT USING (
  sale_id IN (SELECT id FROM sales WHERE shop_id IN (SELECT get_user_shop_ids()))
);
CREATE POLICY "Shop members can insert sale items" ON sale_items FOR INSERT WITH CHECK (
  sale_id IN (SELECT id FROM sales WHERE shop_id IN (SELECT get_user_shop_ids()))
);

-- PAYMENTS
CREATE POLICY "Shop members can view payments" ON payments FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can insert payments" ON payments FOR INSERT WITH CHECK (shop_id IN (SELECT get_user_shop_ids()));

-- CUSTOMER LEDGER
CREATE POLICY "Shop members can view ledger entries" ON customer_ledger_entries FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can insert ledger entries" ON customer_ledger_entries FOR INSERT WITH CHECK (shop_id IN (SELECT get_user_shop_ids()));

-- EXPENSES
CREATE POLICY "Shop members can view expenses" ON expenses FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Managers/owners can manage expenses" ON expenses FOR ALL USING (
  shop_id IN (SELECT get_user_shop_ids()) AND get_shop_role(shop_id) IN ('OWNER', 'MANAGER')
);

-- SHIFTS
CREATE POLICY "Shop members can view shifts" ON shifts FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can create shifts" ON shifts FOR INSERT WITH CHECK (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Shop members can update own shifts" ON shifts FOR UPDATE USING (shop_id IN (SELECT get_user_shop_ids()));

-- CASH MOVEMENTS
CREATE POLICY "Shop members can view cash movements" ON cash_movements FOR SELECT USING (
  shift_id IN (SELECT id FROM shifts WHERE shop_id IN (SELECT get_user_shop_ids()))
);
CREATE POLICY "Shop members can insert cash movements" ON cash_movements FOR INSERT WITH CHECK (
  shift_id IN (SELECT id FROM shifts WHERE shop_id IN (SELECT get_user_shop_ids()))
);

-- AUDIT LOGS
CREATE POLICY "Shop members can view audit logs" ON audit_logs FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "System can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (shop_id IN (SELECT get_user_shop_ids()));

-- SETTINGS
CREATE POLICY "Shop members can view settings" ON settings FOR SELECT USING (shop_id IN (SELECT get_user_shop_ids()));
CREATE POLICY "Owners can manage settings" ON settings FOR ALL USING (
  shop_id IN (SELECT get_user_shop_ids()) AND get_shop_role(shop_id) = 'OWNER'
);

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
