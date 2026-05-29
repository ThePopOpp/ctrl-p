-- ============================================================
-- controlp.io - Production schedule project relationships
-- Adds structured participants, vendors, attachments, materials,
-- and activity events for Gantt FAB project/task actions.
-- ============================================================

CREATE TABLE IF NOT EXISTS production_schedule_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  participant_type text NOT NULL DEFAULT 'staff' CHECK (participant_type IN (
    'staff',
    'customer',
    'customer_contact',
    'vendor',
    'subcontractor',
    'role',
    'viewer',
    'ai_agent'
  )),
  display_name text,
  email text,
  phone text,
  company text,
  role_type text,
  permission_level text NOT NULL DEFAULT 'task_context' CHECK (permission_level IN (
    'owner',
    'editor',
    'contributor',
    'viewer',
    'task_context',
    'customer_visible',
    'vendor_visible'
  )),
  notification_preference text NOT NULL DEFAULT 'default' CHECK (notification_preference IN (
    'default',
    'none',
    'dashboard',
    'email',
    'sms',
    'email_sms'
  )),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  vendor_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  role_type text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'requested',
    'quoted',
    'approved',
    'ordered',
    'in_progress',
    'delivered',
    'completed',
    'blocked',
    'canceled'
  )),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  artwork_file_id uuid REFERENCES artwork_files(id) ON DELETE SET NULL,
  proof_id uuid REFERENCES proofs(id) ON DELETE SET NULL,
  file_type text NOT NULL DEFAULT 'file' CHECK (file_type IN (
    'photo',
    'video',
    'artwork',
    'proof',
    'file',
    'pdf',
    'design_file',
    'install_photo',
    'completion_photo',
    'customer_upload',
    'vendor_upload'
  )),
  file_name text,
  file_url text,
  storage_path text,
  bucket text,
  mime_type text,
  file_size_bytes bigint,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN (
    'internal',
    'customer_visible',
    'vendor_visible',
    'public_link',
    'approval_required',
    'archived'
  )),
  approval_status text NOT NULL DEFAULT 'not_required' CHECK (approval_status IN (
    'not_required',
    'draft',
    'ready_for_review',
    'sent_to_customer',
    'approved',
    'rejected',
    'changes_requested'
  )),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  vendor_name text,
  name text NOT NULL,
  category text,
  manufacturer text,
  sku text,
  model text,
  material_type text,
  print_method text,
  finish text,
  size text,
  color text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_cost numeric(12,2),
  unit_price numeric(12,2),
  availability_status text NOT NULL DEFAULT 'unknown' CHECK (availability_status IN (
    'unknown',
    'in_stock',
    'ordered',
    'backordered',
    'unavailable',
    'received'
  )),
  delivery_status text NOT NULL DEFAULT 'not_needed' CHECK (delivery_status IN (
    'not_needed',
    'pending',
    'ordered',
    'in_transit',
    'delivered',
    'delayed'
  )),
  client_approval_status text NOT NULL DEFAULT 'not_required' CHECK (client_approval_status IN (
    'not_required',
    'pending',
    'approved',
    'rejected',
    'changes_requested'
  )),
  internal_approval_status text NOT NULL DEFAULT 'not_required' CHECK (internal_approval_status IN (
    'not_required',
    'pending',
    'approved',
    'rejected',
    'changes_requested'
  )),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_schedule_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid REFERENCES production_schedule_items(id) ON DELETE CASCADE,
  schedule_group_id uuid,
  project_name text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN (
    'user',
    'customer',
    'vendor',
    'system',
    'ai_agent'
  )),
  event_type text NOT NULL,
  event_title text NOT NULL,
  event_description text,
  previous_value jsonb NOT NULL DEFAULT '{}',
  new_value jsonb NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN (
    'internal',
    'customer_visible',
    'vendor_visible',
    'public'
  )),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_schedule_participants_item_idx
  ON production_schedule_participants(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_participants_group_idx
  ON production_schedule_participants(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_participants_user_idx
  ON production_schedule_participants(user_id);

CREATE INDEX IF NOT EXISTS production_schedule_vendors_item_idx
  ON production_schedule_vendors(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_vendors_group_idx
  ON production_schedule_vendors(schedule_group_id);

CREATE INDEX IF NOT EXISTS production_schedule_attachments_item_idx
  ON production_schedule_attachments(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_attachments_group_idx
  ON production_schedule_attachments(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_attachments_order_idx
  ON production_schedule_attachments(order_id, order_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_attachments_artwork_idx
  ON production_schedule_attachments(artwork_file_id);
CREATE INDEX IF NOT EXISTS production_schedule_attachments_proof_idx
  ON production_schedule_attachments(proof_id);

CREATE INDEX IF NOT EXISTS production_schedule_materials_item_idx
  ON production_schedule_materials(schedule_item_id);
CREATE INDEX IF NOT EXISTS production_schedule_materials_group_idx
  ON production_schedule_materials(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_materials_product_idx
  ON production_schedule_materials(product_id);

CREATE INDEX IF NOT EXISTS production_schedule_activity_events_item_idx
  ON production_schedule_activity_events(schedule_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS production_schedule_activity_events_group_idx
  ON production_schedule_activity_events(schedule_group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS production_schedule_activity_events_type_idx
  ON production_schedule_activity_events(event_type, created_at DESC);

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
ALTER TABLE production_schedule_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_production_schedule_participants" ON production_schedule_participants;
CREATE POLICY "staff_manage_production_schedule_participants"
  ON production_schedule_participants FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_production_schedule_vendors" ON production_schedule_vendors;
CREATE POLICY "staff_manage_production_schedule_vendors"
  ON production_schedule_vendors FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_production_schedule_attachments" ON production_schedule_attachments;
CREATE POLICY "staff_manage_production_schedule_attachments"
  ON production_schedule_attachments FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_production_schedule_materials" ON production_schedule_materials;
CREATE POLICY "staff_manage_production_schedule_materials"
  ON production_schedule_materials FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_production_schedule_activity_events" ON production_schedule_activity_events;
CREATE POLICY "staff_manage_production_schedule_activity_events"
  ON production_schedule_activity_events FOR ALL USING (is_staff_or_admin()) WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "customers_view_visible_production_schedule_attachments" ON production_schedule_attachments;
CREATE POLICY "customers_view_visible_production_schedule_attachments"
  ON production_schedule_attachments FOR SELECT
  USING (
    visibility IN ('customer_visible', 'public_link', 'approval_required')
    AND EXISTS (
      SELECT 1
      FROM production_schedule_items
      WHERE production_schedule_items.id = production_schedule_attachments.schedule_item_id
        AND production_schedule_items.customer_visible = true
        AND (
          production_schedule_items.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM orders
            WHERE orders.id = production_schedule_items.order_id
              AND orders.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "customers_view_visible_production_schedule_activity_events" ON production_schedule_activity_events;
CREATE POLICY "customers_view_visible_production_schedule_activity_events"
  ON production_schedule_activity_events FOR SELECT
  USING (
    visibility IN ('customer_visible', 'public')
    AND EXISTS (
      SELECT 1
      FROM production_schedule_items
      WHERE production_schedule_items.id = production_schedule_activity_events.schedule_item_id
        AND production_schedule_items.customer_visible = true
        AND (
          production_schedule_items.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM orders
            WHERE orders.id = production_schedule_items.order_id
              AND orders.user_id = auth.uid()
          )
        )
    )
  );

COMMENT ON TABLE production_schedule_participants IS
  'Structured people, contacts, role, vendor, and AI-agent participants attached to production schedule projects and tasks.';
COMMENT ON TABLE production_schedule_vendors IS
  'Vendor and subcontractor records attached from Gantt project/task actions.';
COMMENT ON TABLE production_schedule_attachments IS
  'Structured file, photo, video, artwork, and proof attachments connected to production schedule projects and tasks.';
COMMENT ON TABLE production_schedule_materials IS
  'Structured products, materials, selections, costs, and availability records attached to production schedule projects and tasks.';
COMMENT ON TABLE production_schedule_activity_events IS
  'Detailed project/task activity history for Gantt, Kanban, Calendar, booking, file, notification, and AI Agent workflows.';
