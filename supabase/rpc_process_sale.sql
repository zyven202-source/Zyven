-- Atomic sale processing RPC (financial integrity: single transaction)
-- Idempotency: client passes client_ref (UUID); if sale with same client_ref exists, return it.

CREATE OR REPLACE FUNCTION process_sale_atomic(
  p_shop_id UUID,
  p_user_id UUID,
  p_client_ref UUID,
  p_cart JSONB,          -- [{product_id, quantity, unit_price, buying_price, discount}]
  p_payment_method TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_mpesa_reference TEXT DEFAULT NULL,
  p_discount NUMERIC DEFAULT 0,
  p_shift_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_existing_sale RECORD;
  v_sale_id UUID;
  v_receipt_number TEXT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_item_total NUMERIC;
  v_cogs NUMERIC;
  v_product RECORD;
  v_new_stock INTEGER;
  v_customer RECORD;
  v_new_balance NUMERIC;
  v_shift_record RECORD;
BEGIN
  -- Idempotency check
  SELECT * INTO v_existing_sale FROM sales WHERE shop_id = p_shop_id AND notes = 'client_ref:' || p_client_ref::text LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('sale_id', v_existing_sale.id, 'duplicate', true);
  END IF;

  -- Generate receipt number
  v_receipt_number := 'ZV-' || to_char(now(), 'YYMMDD') || '-' ||
    lpad((floor(random() * 900000) + 100000)::text, 6, '0');

  -- Compute totals from cart
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
    v_item_total := ((v_item->>'unit_price')::numeric * (v_item->>'quantity')::int) - COALESCE((v_item->>'discount')::numeric, 0);
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;
  v_total := v_subtotal - p_discount;

  -- Insert sale. ON CONFLICT guards against two devices syncing the same
  -- queued sale concurrently (backed by sales_client_ref_uniq partial index).
  INSERT INTO sales (shop_id, receipt_number, customer_id, user_id, subtotal, discount, total, payment_method, mpesa_reference, notes)
  VALUES (p_shop_id, v_receipt_number, p_customer_id, p_user_id, v_subtotal, p_discount, v_total, p_payment_method, p_mpesa_reference, 'client_ref:' || p_client_ref::text)
  ON CONFLICT (shop_id, notes) WHERE notes LIKE 'client_ref:%' DO NOTHING
  RETURNING id INTO v_sale_id;

  IF v_sale_id IS NULL THEN
    -- Concurrent duplicate: return the sale the other transaction inserted.
    SELECT * INTO v_existing_sale FROM sales WHERE shop_id = p_shop_id AND notes = 'client_ref:' || p_client_ref::text LIMIT 1;
    RETURN jsonb_build_object('sale_id', v_existing_sale.id, 'duplicate', true);
  END IF;

  -- Process each item: sale_items + stock decrement + stock movement
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
    SELECT current_stock, buying_price INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'product_id';
    END IF;

    IF v_product.current_stock < (v_item->>'quantity')::int THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, need %', v_item->>'product_id', v_product.current_stock, v_item->>'quantity';
    END IF;

    IF COALESCE((v_item->>'buying_price')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Product % needs a valid buying price', v_item->>'product_id';
    END IF;

    v_item_total := ((v_item->>'unit_price')::numeric * (v_item->>'quantity')::int) - COALESCE((v_item->>'discount')::numeric, 0);
    v_cogs := (v_item->>'buying_price')::numeric * (v_item->>'quantity')::int;

    INSERT INTO sale_items (sale_id, product_id, product_name, product_sku, quantity, unit_price, buying_price, discount, total, cogs, gross_profit)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'product_name'),
      (v_item->>'product_sku'),
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'buying_price')::numeric,
      COALESCE((v_item->>'discount')::numeric, 0),
      v_item_total,
      v_cogs,
      v_item_total - v_cogs
    );

    v_new_stock := v_product.current_stock - (v_item->>'quantity')::int;
    UPDATE products SET current_stock = v_new_stock, updated_at = now() WHERE id = (v_item->>'product_id')::uuid;

    INSERT INTO stock_movements (shop_id, product_id, quantity_change, movement_type, reason, reference, buying_price, selling_price, user_id)
    VALUES (p_shop_id, (v_item->>'product_id')::uuid, -(v_item->>'quantity')::int, 'SALE', 'POS Sale ' || v_receipt_number, v_sale_id::text, (v_item->>'buying_price')::numeric, (v_item->>'unit_price')::numeric, p_user_id);
  END LOOP;

  -- Payment record
  INSERT INTO payments (shop_id, sale_id, customer_id, amount, payment_method, mpesa_reference, user_id)
  VALUES (p_shop_id, v_sale_id, p_customer_id, v_total, p_payment_method, p_mpesa_reference, p_user_id);

  -- Credit handling
  IF p_payment_method = 'CREDIT' THEN
    IF p_customer_id IS NULL THEN
      RAISE EXCEPTION 'Credit sale requires a customer';
    END IF;
    SELECT current_balance INTO v_customer FROM customers WHERE id = p_customer_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer not found';
    END IF;
    v_new_balance := v_customer.current_balance + v_total;
    UPDATE customers SET current_balance = v_new_balance, updated_at = now() WHERE id = p_customer_id;
    INSERT INTO customer_ledger_entries (shop_id, customer_id, sale_id, type, amount, balance_after, description, user_id)
    VALUES (p_shop_id, p_customer_id, v_sale_id, 'CREDIT', v_total, v_new_balance, 'Credit sale ' || v_receipt_number, p_user_id);
  END IF;

  -- Shift totals
  IF p_shift_id IS NOT NULL THEN
    SELECT * INTO v_shift_record FROM shifts WHERE id = p_shift_id FOR UPDATE;
    IF FOUND THEN
      UPDATE shifts SET
        cash_sales = CASE WHEN p_payment_method = 'CASH' THEN COALESCE(cash_sales, 0) + v_total ELSE cash_sales END,
        mpesa_sales = CASE WHEN p_payment_method = 'M-PESA' THEN COALESCE(mpesa_sales, 0) + v_total ELSE mpesa_sales END,
        credit_sales = CASE WHEN p_payment_method = 'CREDIT' THEN COALESCE(credit_sales, 0) + v_total ELSE credit_sales END
      WHERE id = p_shift_id;
    END IF;
  END IF;

  -- Audit log
  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (p_shop_id, p_user_id, 'SALE_CREATED', 'sale', v_sale_id,
    jsonb_build_object('receipt_number', v_receipt_number, 'total', v_total, 'payment_method', p_payment_method));

  RETURN jsonb_build_object('sale_id', v_sale_id, 'receipt_number', v_receipt_number, 'total', v_total, 'duplicate', false);
END;
$$;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION process_sale_atomic TO authenticated;
