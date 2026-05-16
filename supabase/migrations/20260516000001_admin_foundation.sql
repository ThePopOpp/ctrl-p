-- ============================================================
-- controlp.io - Admin operations foundation
-- Phase 2 foundation for admin users, products, orders, files,
-- payments, reviews, communications, and audit history.
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'production_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'designer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'installer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer_support';

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'quote_requested';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'file_review';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'proofing';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_to_ship';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('pending', 'active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'unpaid', 'pending', 'paid', 'partially_paid',
    'failed', 'refunded', 'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE production_status AS ENUM (
    'new', 'file_check', 'design_needed', 'proof_pending',
    'proof_approved', 'print_ready', 'printing', 'finishing',
    'install_scheduled', 'ready', 'completed', 'on_hold'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE file_review_status AS ENUM (
    'waiting_for_file_review', 'needs_changes', 'proof_sent',
    'approved', 'rejected', 'in_production'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_channel AS ENUM ('email', 'sms', 'internal', 'dashboard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('pending', 'approved', 'unapproved', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS product_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  parent_id   uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  description text,
  sort_order  int NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS product_categories_updated_at ON product_categories;
CREATE TRIGGER product_categories_updated_at
  BEFORE UPDATE ON product_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS base_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_rules jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS print_options jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS finishing_options jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS quantity_tiers jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS turnaround_times jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS shipping_options jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS file_upload_requirements jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customizer_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status product_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS related_product_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS production_status production_status NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_shipping_method text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status order_status,
  new_status order_status NOT NULL,
  previous_production_status production_status,
  new_production_status production_status,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  status production_status NOT NULL DEFAULT 'new',
  priority int NOT NULL DEFAULT 100,
  assigned_staff_id uuid REFERENCES users(id) ON DELETE SET NULL,
  station text,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS production_jobs_updated_at ON production_jobs;
CREATE TRIGGER production_jobs_updated_at
  BEFORE UPDATE ON production_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE artwork_files
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_status file_review_status NOT NULL DEFAULT 'waiting_for_file_review',
  ADD COLUMN IF NOT EXISTS proof_version int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_comments text,
  ADD COLUMN IF NOT EXISTS customer_comments text,
  ADD COLUMN IF NOT EXISTS final_approved_file_id uuid;

ALTER TABLE proofs
  ADD COLUMN IF NOT EXISTS status file_review_status NOT NULL DEFAULT 'proof_sent',
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_comments text,
  ADD COLUMN IF NOT EXISTS admin_comments text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  channel message_channel NOT NULL DEFAULT 'dashboard',
  direction text NOT NULL DEFAULT 'outbound',
  subject text,
  body text NOT NULL,
  internal_only boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  channel message_channel NOT NULL,
  subject text,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS notification_templates_updated_at ON notification_templates;
CREATE TRIGGER notification_templates_updated_at
  BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  event_key text NOT NULL,
  channel message_channel NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'manual',
  provider_payment_id text,
  method text,
  status payment_status NOT NULL DEFAULT 'pending',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  notes text,
  received_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_refund_id text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  company_title text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL,
  status review_status NOT NULL DEFAULT 'pending',
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS reviews_updated_at ON reviews;
CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_customer_tags (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag_id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_production_status ON orders(production_status);
CREATE INDEX IF NOT EXISTS idx_orders_due_at ON orders(due_at);
CREATE INDEX IF NOT EXISTS idx_production_jobs_status_priority ON production_jobs(status, priority);
CREATE INDEX IF NOT EXISTS idx_artwork_review_status ON artwork_files(review_status);
CREATE INDEX IF NOT EXISTS idx_messages_order_created ON messages(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role::text IN (
      'staff', 'admin', 'super_admin', 'production_manager',
      'designer', 'installer', 'customer_support'
    )
    AND status = 'active'
    AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role::text IN ('admin', 'super_admin')
    AND status = 'active'
    AND deleted_at IS NULL
  );
$$;

CREATE POLICY "categories_public_read"
  ON product_categories FOR SELECT USING (active = true);
CREATE POLICY "staff_manage_categories"
  ON product_categories FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

CREATE POLICY "staff_manage_order_status_history"
  ON order_status_history FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());
CREATE POLICY "staff_manage_production_jobs"
  ON production_jobs FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

CREATE POLICY "messages_select_own"
  ON messages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_manage_messages"
  ON messages FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

CREATE POLICY "staff_manage_notification_templates"
  ON notification_templates FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_manage_notifications"
  ON notifications FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

CREATE POLICY "payments_select_own"
  ON payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_manage_payments"
  ON payments FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());
CREATE POLICY "staff_manage_refunds"
  ON refunds FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

CREATE POLICY "reviews_public_read_approved"
  ON reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "reviews_insert_own"
  ON reviews FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff_manage_reviews"
  ON reviews FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

CREATE POLICY "staff_manage_customer_tags"
  ON customer_tags FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());
CREATE POLICY "staff_manage_user_customer_tags"
  ON user_customer_tags FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());
CREATE POLICY "staff_read_activity_logs"
  ON activity_logs FOR SELECT USING (is_staff_or_admin());
CREATE POLICY "staff_insert_activity_logs"
  ON activity_logs FOR INSERT WITH CHECK (is_staff_or_admin());
