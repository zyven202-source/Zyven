-- ============================================================
-- Zyven migration: financial integrity hardening
-- 1. record_customer_payment_atomic — race-free customer payments
-- 2. Unique index backing sale idempotency (client_ref)
-- Run in Supabase SQL editor AFTER schema.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Atomic customer payment
-- Locks the customer row, computes the new balance inside the
-- transaction, and inserts payment + ledger entry atomically.
-- Never lets two concurrent payments corrupt the balance.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_customer_payment_atomic(
  p_shop_id UUID,
  p_customer_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'CASH',
  p_mpesa_reference TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_customer RECORD;
  v_payment_id UUID;
  v_amount NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;
  IF p_payment_method = 'M-PESA' AND COALESCE(p_mpesa_reference, '') = '' THEN
    RAISE EXCEPTION 'M-Pesa payment requires a reference';
  END IF;

  SELECT current_balance INTO v_customer
  FROM customers
  WHERE id = p_customer_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Clamp to outstanding balance (overpay records the balance, not more)
  v_amount := LEAST(p_amount, GREATEST(v_customer.current_balance, 0));
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Customer has no outstanding balance';
  END IF;

  v_new_balance := GREATEST(0, v_customer.current_balance - v_amount);

  UPDATE customers
  SET current_balance = v_new_balance, updated_at = now()
  WHERE id = p_customer_id;

  INSERT INTO payments (shop_id, customer_id, amount, payment_method, mpesa_reference, user_id)
  VALUES (p_shop_id, p_customer_id, v_amount, p_payment_method, p_mpesa_reference, p_user_id)
  RETURNING id INTO v_payment_id;

  INSERT INTO customer_ledger_entries (shop_id, customer_id, payment_id, type, amount, balance_after, description, user_id)
  VALUES (p_shop_id, p_customer_id, v_payment_id, 'PAYMENT', v_amount, v_new_balance,
          'Payment received via ' || p_payment_method, p_user_id);

  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (p_shop_id, p_user_id, 'PAYMENT_RECORDED', 'payment', v_payment_id,
          jsonb_build_object('customer_id', p_customer_id, 'amount', v_amount,
                             'payment_method', p_payment_method, 'balance_after', v_new_balance));

  RETURN jsonb_build_object('payment_id', v_payment_id, 'amount', v_amount, 'balance_after', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION record_customer_payment_atomic TO authenticated;

-- ------------------------------------------------------------
-- 2. Idempotency for offline sale sync
-- Makes client_ref collisions impossible at the DB level: two
-- devices syncing the same queued sale can never double-insert.
-- The sale RPC writes notes = 'client_ref:<uuid>'.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS sales_client_ref_uniq
  ON sales (shop_id, notes)
  WHERE notes LIKE 'client_ref:%';
