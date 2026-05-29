-- ============================================================
-- controlp.io - Production Schedule structured relationships
-- Supports Gantt FAB actions with first-class participants,
-- vendors, attachments, materials/products, and activity events.
-- ============================================================

CREATE TABLE IF NOT EXISTS production_schedule_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid NOT NULL REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  participant_type text NOT NULL DEFAULT 'staff' CHECK (participant_type IN (
    'staff',
    'customer',
    'contact',
    'vendor',
    'role',
    'viewer',
    'approver'
  )),
  display_name text,
  email text,
  phone text,
  company text,
  role_type text,
  permission_level text NOT NULL DEFAULT 'viewer' CHECK (permission_level IN (
    'owner',
    'editor',
    'viewer',
    'customer',
    'vendor'
  )),
  notification_preference text NOT NULL DEFAULT 'default' CHECK (notification_preference IN (
    'default',
    'email',
    'sms',
    'both',
    'none'
  )),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer', 'vendor', 'public')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid NOT NULL REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  vendor_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  role_type text,
  service_scope text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'requested',
    'quoted',
    'approved',
    'scheduled',
    'in_progress',
    'complete',
    'canceled'
  )),
  estimated_cost numeric(12,2),
  quoted_cost numeric(12,2),
  actual_cost numeric(12,2),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer', 'vendor', 'public')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid NOT NULL REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  artwork_file_id uuid REFERENCES artwork_files(id) ON DELETE SET NULL,
  proof_id uuid REFERENCES proofs(id) ON DELETE SET NULL,
  file_type text NOT NULL DEFAULT 'document' CHECK (file_type IN (
    'photo',
    'video',
    'artwork',
    'proof',
    'pdf',
    'document',
    'install_photo',
    'completion_photo',
    'other'
  )),
  file_name text,
  file_url text,
  storage_path text,
  bucket text,
  mime_type text,
  file_size_bytes bigint,
  title text,
  description text,
  approval_status text NOT NULL DEFAULT 'not_required' CHECK (approval_status IN (
    'draft',
    'pending_review',
    'sent',
    'approved',
    'rejected',
    'changes_requested',
    'not_required'
  )),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer', 'vendor', 'public')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid NOT NULL REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  relation_type text NOT NULL DEFAULT 'material' CHECK (relation_type IN ('product', 'selection', 'material')),
  name text NOT NULL,
  sku text,
  category text,
  vendor_name text,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit text,
  unit_cost numeric(12,2),
  unit_price numeric(12,2),
  estimated_total numeric(12,2),
  approval_status text NOT NULL DEFAULT 'not_required' CHECK (approval_status IN (
    'not_required',
    'pending',
    'approved',
    'rejected',
    'substitution_needed'
  )),
  production_status text NOT NULL DEFAULT 'planned' CHECK (production_status IN (
    'planned',
    'ordered',
    'received',
    'allocated',
    'used',
    'backordered',
    'canceled'
  )),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer', 'vendor', 'public')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid NOT NULL REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  event_type text NOT NULL,
  event_title text NOT NULL,
  event_description text,
  previous_value jsonb NOT NULL DEFAULT '{}',
  new_value jsonb NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'customer', 'vendor', 'public')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_schedule_participants_item_idx ON production_schedule_participants(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_participants_group_idx ON production_schedule_participants(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_participants_user_idx ON production_schedule_participants(user_id);
CREATE INDEX IF NOT EXISTS production_schedule_vendors_item_idx ON production_schedule_vendors(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_vendors_group_idx ON production_schedule_vendors(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_attachments_item_idx ON production_schedule_attachments(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_attachments_group_idx ON production_schedule_attachments(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_attachments_order_idx ON production_schedule_attachments(order_id, order_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_materials_item_idx ON production_schedule_materials(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_materials_group_idx ON production_schedule_materials(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_materials_product_idx ON production_schedule_materials(product_id);
CREATE INDEX IF NOT EXISTS production_schedule_events_item_idx ON production_schedule_events(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_events_group_idx ON production_schedule_events(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_events_type_idx ON production_schedule_events(event_type, created_at);

DROP TRIGGER IF EXISTS production_schedule_participants_updated_at ON production_schedule_participants;
CREATE TRIGGER production_schedule_participants_updated_at
  BEFORE UPDATE ON production_schedule_participants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS production_schedule_vendors_updated_at ON production_schedule_vendors;
CREATE TRIGGER production_schedule_vendors_updated_at
  BEFORE UPDATE ON production_schedule_vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS production_schedule_attachments_updated_at ON production_schedule_attachments;
CREATE TRIGGER production_schedule_attachments_updated_at
  BEFORE UPDATE ON production_schedule_attachments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS production_schedule_materials_updated_at ON production_schedule_materials;
CREATE TRIGGER production_schedule_materials_updated_at
  BEFORE UPDATE ON production_schedule_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE production_schedule_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedule_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedule_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedule_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_production_schedule_participants" ON production_schedule_participants;
CREATE POLICY "staff_manage_production_schedule_participants"
  ON production_schedule_participants FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_production_schedule_vendors" ON production_schedule_vendors;
CREATE POLICY "staff_manage_production_schedule_vendors"
  ON production_schedule_vendors FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_production_schedule_attachments" ON production_schedule_attachments;
CREATE POLICY "staff_manage_production_schedule_attachments"
  ON production_schedule_attachments FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_production_schedule_materials" ON production_schedule_materials;
CREATE POLICY "staff_manage_production_schedule_materials"
  ON production_schedule_materials FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_production_schedule_events" ON production_schedule_events;
CREATE POLICY "staff_manage_production_schedule_events"
  ON production_schedule_events FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "customers_view_visible_production_schedule_participants" ON production_schedule_participants;
CREATE POLICY "customers_view_visible_production_schedule_participants"
  ON production_schedule_participants FOR SELECT
  USING (
    visibility IN ('customer', 'public')
    AND EXISTS (
      SELECT 1 FROM production_schedule_items
      WHERE production_schedule_items.id = production_schedule_participants.schedule_item_id
        AND production_schedule_items.customer_visible = true
        AND production_schedule_items.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_view_visible_production_schedule_attachments" ON production_schedule_attachments;
CREATE POLICY "customers_view_visible_production_schedule_attachments"
  ON production_schedule_attachments FOR SELECT
  USING (
    visibility IN ('customer', 'public')
    AND EXISTS (
      SELECT 1 FROM production_schedule_items
      WHERE production_schedule_items.id = production_schedule_attachments.schedule_item_id
        AND production_schedule_items.customer_visible = true
        AND production_schedule_items.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_view_visible_production_schedule_materials" ON production_schedule_materials;
CREATE POLICY "customers_view_visible_production_schedule_materials"
  ON production_schedule_materials FOR SELECT
  USING (
    visibility IN ('customer', 'public')
    AND EXISTS (
      SELECT 1 FROM production_schedule_items
      WHERE production_schedule_items.id = production_schedule_materials.schedule_item_id
        AND production_schedule_items.customer_visible = true
        AND production_schedule_items.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_view_visible_production_schedule_events" ON production_schedule_events;
CREATE POLICY "customers_view_visible_production_schedule_events"
  ON production_schedule_events FOR SELECT
  USING (
    visibility IN ('customer', 'public')
    AND EXISTS (
      SELECT 1 FROM production_schedule_items
      WHERE production_schedule_items.id = production_schedule_events.schedule_item_id
        AND production_schedule_items.customer_visible = true
        AND production_schedule_items.customer_id = auth.uid()
    )
  );

COMMENT ON TABLE production_schedule_participants IS
  'Structured user, customer, vendor, and role participants connected to production schedule tasks/projects.';
COMMENT ON TABLE production_schedule_vendors IS
  'Vendor, subcontractor, and supplier relationships for production schedule items.';
COMMENT ON TABLE production_schedule_attachments IS
  'Files, photos, videos, artwork, and proofs attached to production schedule items.';
COMMENT ON TABLE production_schedule_materials IS
  'Products, product selections, and material requirements attached to production schedule items.';
COMMENT ON TABLE production_schedule_events IS
  'Timeline activity events created by Gantt FAB actions and structured schedule operations.';
