-- ============================================================
-- controlp.io - Production Schedule / Gantt foundation
-- Adds schedule items and task dependencies that bridge Orders
-- into Production, Shipping, Delivery, Install, and customer
-- visible schedule checkpoints.
-- ============================================================

CREATE TABLE IF NOT EXISTS production_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  production_job_id uuid REFERENCES production_jobs(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  parent_item_id uuid REFERENCES production_schedule_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  item_type text NOT NULL DEFAULT 'task' CHECK (item_type IN (
    'phase',
    'task',
    'milestone',
    'approval',
    'artwork_review',
    'proof',
    'production_step',
    'qc_check',
    'delivery',
    'installation',
    'customer_action'
  )),
  phase text,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started',
    'in_progress',
    'waiting_on_customer',
    'waiting_on_artwork',
    'waiting_on_proof_approval',
    'waiting_on_materials',
    'waiting_on_vendor',
    'needs_internal_review',
    'needs_customer_review',
    'ready_for_production',
    'in_production',
    'quality_check',
    'completed',
    'approved',
    'reopened',
    'blocked',
    'on_hold'
  )),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low',
    'normal',
    'high',
    'rush',
    'critical',
    'blocking_production',
    'blocking_delivery_install'
  )),
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_department text,
  start_date date,
  end_date date,
  due_date date,
  estimated_duration_days numeric(8,2),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  customer_visible boolean NOT NULL DEFAULT false,
  internal_only boolean NOT NULL DEFAULT true,
  is_blocked boolean NOT NULL DEFAULT false,
  blocker_type text,
  blocker_reason text,
  artwork_review_status text,
  proof_status text,
  production_status text,
  sort_order integer NOT NULL DEFAULT 100,
  internal_notes text,
  customer_notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id uuid NOT NULL REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  dependent_item_id uuid NOT NULL REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'finish_to_start' CHECK (dependency_type IN (
    'finish_to_start',
    'start_to_start',
    'finish_to_finish',
    'start_to_finish'
  )),
  required_completion_date date,
  delay_impact_notes text,
  auto_shift_schedule boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_schedule_dependencies_distinct_items CHECK (parent_item_id <> dependent_item_id),
  CONSTRAINT production_schedule_dependencies_unique UNIQUE (parent_item_id, dependent_item_id)
);

CREATE INDEX IF NOT EXISTS production_schedule_items_order_id_idx ON production_schedule_items(order_id);
CREATE INDEX IF NOT EXISTS production_schedule_items_order_item_id_idx ON production_schedule_items(order_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_items_production_job_id_idx ON production_schedule_items(production_job_id);
CREATE INDEX IF NOT EXISTS production_schedule_items_product_id_idx ON production_schedule_items(product_id);
CREATE INDEX IF NOT EXISTS production_schedule_items_customer_id_idx ON production_schedule_items(customer_id);
CREATE INDEX IF NOT EXISTS production_schedule_items_assigned_to_user_id_idx ON production_schedule_items(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS production_schedule_items_status_idx ON production_schedule_items(status);
CREATE INDEX IF NOT EXISTS production_schedule_items_priority_idx ON production_schedule_items(priority);
CREATE INDEX IF NOT EXISTS production_schedule_items_dates_idx ON production_schedule_items(start_date, due_date, end_date);
CREATE INDEX IF NOT EXISTS production_schedule_items_customer_visible_idx ON production_schedule_items(customer_visible);
CREATE INDEX IF NOT EXISTS production_schedule_items_blocked_idx ON production_schedule_items(is_blocked);

CREATE INDEX IF NOT EXISTS production_schedule_dependencies_parent_idx ON production_schedule_dependencies(parent_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_dependencies_dependent_idx ON production_schedule_dependencies(dependent_item_id);

DROP TRIGGER IF EXISTS production_schedule_items_updated_at ON production_schedule_items;
CREATE TRIGGER production_schedule_items_updated_at
  BEFORE UPDATE ON production_schedule_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS production_schedule_dependencies_updated_at ON production_schedule_dependencies;
CREATE TRIGGER production_schedule_dependencies_updated_at
  BEFORE UPDATE ON production_schedule_dependencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE production_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedule_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_production_schedule_items" ON production_schedule_items;
CREATE POLICY "staff_manage_production_schedule_items"
  ON production_schedule_items FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "customers_view_visible_schedule_items" ON production_schedule_items;
CREATE POLICY "customers_view_visible_schedule_items"
  ON production_schedule_items FOR SELECT
  USING (
    customer_visible = true
    AND (
      customer_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM orders
        WHERE orders.id = production_schedule_items.order_id
          AND orders.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "staff_manage_production_schedule_dependencies" ON production_schedule_dependencies;
CREATE POLICY "staff_manage_production_schedule_dependencies"
  ON production_schedule_dependencies FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

COMMENT ON TABLE production_schedule_items IS
  'ControlP.io production schedule items for Gantt timelines, phases, tasks, milestones, proofs, blockers, delivery, installation, and customer-visible checkpoints.';

COMMENT ON TABLE production_schedule_dependencies IS
  'Dependencies between ControlP.io production schedule items. Phase 1 stores relationships; advanced auto-shifting is intentionally deferred.';
