-- ============================================================
-- controlp.io — Row-Level Security Policies
-- Phase 1 · Gate 1
-- All tables have RLS enabled; service-role key bypasses all.
-- ============================================================

-- ─── ENABLE RLS ON ALL TABLES ─────────────────────────────
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE artwork_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_drafts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proofs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credits   ENABLE ROW LEVEL SECURITY;

-- ─── HELPER: role check (SECURITY DEFINER runs as owner) ──
CREATE OR REPLACE FUNCTION is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('staff', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- ─── USERS ────────────────────────────────────────────────
CREATE POLICY "users_select_own"
  ON users FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE USING (id = auth.uid());

CREATE POLICY "staff_select_all_users"
  ON users FOR SELECT USING (is_staff_or_admin());

CREATE POLICY "staff_update_all_users"
  ON users FOR UPDATE USING (is_staff_or_admin());

-- New user row is inserted by a trigger on auth.users sign-up.
-- The trigger runs with elevated privileges; no INSERT policy needed.

-- ─── ADDRESSES ────────────────────────────────────────────
CREATE POLICY "addresses_all_own"
  ON addresses FOR ALL USING (user_id = auth.uid());

CREATE POLICY "staff_select_all_addresses"
  ON addresses FOR SELECT USING (is_staff_or_admin());

-- ─── PRODUCTS (public catalog) ────────────────────────────
CREATE POLICY "products_public_read"
  ON products FOR SELECT USING (active = true);

CREATE POLICY "staff_manage_products"
  ON products FOR ALL USING (is_staff_or_admin());

-- ─── PRODUCT VARIANTS ─────────────────────────────────────
CREATE POLICY "variants_public_read"
  ON product_variants FOR SELECT USING (active = true);

CREATE POLICY "staff_manage_variants"
  ON product_variants FOR ALL USING (is_staff_or_admin());

-- ─── PRODUCT OPTIONS ──────────────────────────────────────
CREATE POLICY "options_public_read"
  ON product_options FOR SELECT USING (active = true);

CREATE POLICY "staff_manage_options"
  ON product_options FOR ALL USING (is_staff_or_admin());

-- ─── PRICING RULES (staff-only; never exposed to public) ──
CREATE POLICY "staff_manage_pricing"
  ON pricing_rules FOR ALL USING (is_staff_or_admin());

-- ─── ORDERS ───────────────────────────────────────────────
CREATE POLICY "orders_select_own"
  ON orders FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "orders_insert_own"
  ON orders FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "staff_manage_orders"
  ON orders FOR ALL USING (is_staff_or_admin());

-- ─── ORDER ITEMS ──────────────────────────────────────────
CREATE POLICY "order_items_select_own"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "order_items_insert_own"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "staff_manage_order_items"
  ON order_items FOR ALL USING (is_staff_or_admin());

-- ─── ARTWORK FILES ────────────────────────────────────────
CREATE POLICY "artwork_all_own"
  ON artwork_files FOR ALL USING (user_id = auth.uid());

CREATE POLICY "staff_manage_artwork"
  ON artwork_files FOR ALL USING (is_staff_or_admin());

-- ─── DESIGN DRAFTS ────────────────────────────────────────
CREATE POLICY "drafts_all_own"
  ON design_drafts FOR ALL USING (user_id = auth.uid());

CREATE POLICY "staff_select_drafts"
  ON design_drafts FOR SELECT USING (is_staff_or_admin());

-- ─── PROOFS ───────────────────────────────────────────────
CREATE POLICY "proofs_select_own_orders"
  ON proofs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = proofs.order_item_id
      AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "staff_manage_proofs"
  ON proofs FOR ALL USING (is_staff_or_admin());

-- ─── SHIPMENTS ────────────────────────────────────────────
CREATE POLICY "shipments_select_own"
  ON shipments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = shipments.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "staff_manage_shipments"
  ON shipments FOR ALL USING (is_staff_or_admin());

-- ─── VENDOR JOBS (internal only) ──────────────────────────
CREATE POLICY "staff_manage_vendor_jobs"
  ON vendor_jobs FOR ALL USING (is_staff_or_admin());

-- ─── SMS / EMAIL MESSAGES ─────────────────────────────────
CREATE POLICY "sms_select_own"
  ON sms_messages FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "staff_manage_sms"
  ON sms_messages FOR ALL USING (is_staff_or_admin());

CREATE POLICY "email_select_own"
  ON email_messages FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "staff_manage_email"
  ON email_messages FOR ALL USING (is_staff_or_admin());

-- ─── COUPONS ──────────────────────────────────────────────
-- Customers can look up active coupons by code at checkout.
CREATE POLICY "coupons_public_read_active"
  ON coupons FOR SELECT USING (active = true);

CREATE POLICY "staff_manage_coupons"
  ON coupons FOR ALL USING (is_staff_or_admin());

-- ─── STORE CREDITS ────────────────────────────────────────
CREATE POLICY "credits_select_own"
  ON store_credits FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "staff_manage_credits"
  ON store_credits FOR ALL USING (is_staff_or_admin());

-- ─── AUTO-CREATE USER ROW ON SIGN-UP ──────────────────────
-- Mirrors auth.users → public.users on every new registration.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
