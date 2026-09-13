-- ============================================================
-- controlp.io - Sales Pipeline (opportunities)
--
-- Additive only. Creates the opportunity record and its line items, quote
-- versions, append-only event history, tasks, file links, and editable stage
-- settings. Ctrl+P had no prior pipeline or opportunity tables, so there are no
-- existing stages to migrate.
--
-- Quotes are NOT a new pricing engine: a quote version links to an existing
-- `orders` row (status 'quote_requested') and records version, amount, sent and
-- expiry dates. Closed Won links or creates the customer (`users`) and order.
--
-- Apply only this file (SQL editor, psql, or the Supabase MCP). Do not use a
-- blanket `supabase db push` unless every pending migration is intended.
-- ============================================================

-- ─── Opportunities ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_number text UNIQUE NOT NULL DEFAULT 'OPP-' || upper(substr(gen_random_uuid()::text, 1, 8)),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  stage text NOT NULL DEFAULT 'new_inquiry' CHECK (stage IN (
    'new_inquiry', 'discovery', 'estimating', 'quote_sent', 'follow_up', 'approved',
    'closed_won', 'closed_lost', 'on_hold'
  )),
  probability int NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  estimated_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (estimated_value >= 0),
  service_category text,
  description text,
  source text,

  -- Who the job is for. A prospect without an account keeps a contact snapshot;
  -- the customer (users row) is linked or created once, at Closed Won.
  customer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  company text,
  source_submission_id uuid REFERENCES contact_submissions(id) ON DELETE SET NULL,

  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  expected_close_date date,
  requested_completion_date date,
  is_rush boolean NOT NULL DEFAULT false,
  fulfillment_method text CHECK (fulfillment_method IS NULL OR fulfillment_method IN (
    'pickup', 'shipping', 'local_delivery', 'installation', 'digital_delivery'
  )),
  fulfillment_notes text,
  artwork_source text CHECK (artwork_source IS NULL OR artwork_source IN (
    'customer_supplied', 'design_services', 'mixed', 'reorder_existing', 'undecided'
  )),
  artwork_status text CHECK (artwork_status IS NULL OR artwork_status IN (
    'not_started', 'awaiting_files', 'files_received', 'design_in_progress', 'concept_shared'
  )),
  budget numeric(12,2) CHECK (budget IS NULL OR budget >= 0),
  decision_makers text,

  next_action text,
  next_action_type text,
  next_action_due date,

  po_number text,
  payment_terms text,
  deposit_status text CHECK (deposit_status IS NULL OR deposit_status IN ('not_required', 'requested', 'received')),
  billing_confirmed boolean NOT NULL DEFAULT false,

  checklist jsonb NOT NULL DEFAULT '{}',
  extra_items jsonb NOT NULL DEFAULT '[]',

  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  won_summary text,
  lost_reason text,
  lost_notes text,
  competitor text,
  hold_reason text,
  hold_follow_up_date date,
  hold_from_stage text CHECK (hold_from_stage IS NULL OR hold_from_stage IN (
    'new_inquiry', 'discovery', 'estimating', 'quote_sent', 'follow_up', 'approved'
  )),
  reopened_at timestamptz,

  won_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  won_project_id uuid REFERENCES production_schedule_items(id) ON DELETE SET NULL,
  -- Claim used to make Closed Won conversion idempotent under retries.
  conversion_token uuid,
  conversion_started_at timestamptz,

  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pipeline_opportunities_lost_reason_required
    CHECK (stage <> 'closed_lost' OR lost_reason IS NOT NULL),
  CONSTRAINT pipeline_opportunities_hold_fields_required
    CHECK (stage <> 'on_hold' OR (hold_reason IS NOT NULL AND hold_follow_up_date IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_opps_stage ON pipeline_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_opps_owner ON pipeline_opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opps_customer ON pipeline_opportunities(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_opps_close ON pipeline_opportunities(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_pipeline_opps_next_action ON pipeline_opportunities(next_action_due);
CREATE INDEX IF NOT EXISTS idx_pipeline_opps_contact_email ON pipeline_opportunities(lower(contact_email));
-- A website inquiry becomes at most one opportunity, however many times "Add to Pipeline" is clicked.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_opps_submission
  ON pipeline_opportunities(source_submission_id) WHERE source_submission_id IS NOT NULL;
-- An order is the won outcome of at most one opportunity.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_opps_won_order
  ON pipeline_opportunities(won_order_id) WHERE won_order_id IS NOT NULL;

DROP TRIGGER IF EXISTS pipeline_opportunities_updated_at ON pipeline_opportunities;
CREATE TRIGGER pipeline_opportunities_updated_at
  BEFORE UPDATE ON pipeline_opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Line items (one opportunity, many products/services) ────────────────────
CREATE TABLE IF NOT EXISTS pipeline_opportunity_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  service_category text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  quantity numeric(12,2) CHECK (quantity IS NULL OR quantity >= 0),
  width numeric(10,2) CHECK (width IS NULL OR width >= 0),
  height numeric(10,2) CHECK (height IS NULL OR height >= 0),
  dimension_unit text CHECK (dimension_unit IS NULL OR dimension_unit IN ('in', 'ft', 'cm', 'mm')),
  material text,
  finishing text,
  artwork_source text CHECK (artwork_source IS NULL OR artwork_source IN (
    'customer_supplied', 'design_services', 'mixed', 'reorder_existing', 'undecided'
  )),
  unit_price_estimate numeric(12,2) CHECK (unit_price_estimate IS NULL OR unit_price_estimate >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_line_items_opp ON pipeline_opportunity_line_items(opportunity_id, position);

DROP TRIGGER IF EXISTS pipeline_opportunity_line_items_updated_at ON pipeline_opportunity_line_items;
CREATE TRIGGER pipeline_opportunity_line_items_updated_at
  BEFORE UPDATE ON pipeline_opportunity_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Quote versions (link to existing quote orders) ──────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_opportunity_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  version int NOT NULL CHECK (version > 0),
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'revision_requested', 'accepted', 'declined', 'expired', 'superseded'
  )),
  is_current boolean NOT NULL DEFAULT true,
  sent_at timestamptz,
  expires_at date,
  follow_up_date date,
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, version)
);

-- Only one current version per opportunity, so superseded amounts are never summed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_quotes_current
  ON pipeline_opportunity_quotes(opportunity_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_pipeline_quotes_order ON pipeline_opportunity_quotes(order_id);

DROP TRIGGER IF EXISTS pipeline_opportunity_quotes_updated_at ON pipeline_opportunity_quotes;
CREATE TRIGGER pipeline_opportunity_quotes_updated_at
  BEFORE UPDATE ON pipeline_opportunity_quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Event history (append-only) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_opportunity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created', 'stage_changed', 'owner_changed', 'fields_updated', 'quote_linked', 'quote_revised',
    'quote_updated', 'converted', 'task_created', 'task_completed', 'file_linked', 'manual_log'
  )),
  from_stage text,
  to_stage text,
  from_owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  to_owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  -- For manual logs: note, call, email, sms, meeting. Manual logs record something
  -- that happened elsewhere; they never claim a message was sent by Ctrl+P.
  log_kind text,
  summary text,
  body text,
  details jsonb NOT NULL DEFAULT '{}',
  is_manual_log boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_opp ON pipeline_opportunity_events(opportunity_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION pipeline_events_block_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'pipeline_opportunity_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS pipeline_opportunity_events_append_only ON pipeline_opportunity_events;
CREATE TRIGGER pipeline_opportunity_events_append_only
  BEFORE UPDATE ON pipeline_opportunity_events FOR EACH ROW EXECUTE FUNCTION pipeline_events_block_update();

-- ─── Opportunity tasks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_opportunity_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  due_date date,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_opp ON pipeline_opportunity_tasks(opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_assignee ON pipeline_opportunity_tasks(assigned_to, status, due_date);

DROP TRIGGER IF EXISTS pipeline_opportunity_tasks_updated_at ON pipeline_opportunity_tasks;
CREATE TRIGGER pipeline_opportunity_tasks_updated_at
  BEFORE UPDATE ON pipeline_opportunity_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── File links ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_opportunity_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  url text NOT NULL CHECK (url ~* '^https?://'),
  kind text NOT NULL DEFAULT 'reference' CHECK (kind IN ('artwork', 'reference', 'proof', 'document', 'other')),
  artwork_file_id uuid REFERENCES artwork_files(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_files_opp ON pipeline_opportunity_files(opportunity_id);

-- ─── Editable stage guidance ─────────────────────────────────────────────────
-- Rows exist only for stages an administrator edited; others use app defaults.
CREATE TABLE IF NOT EXISTS pipeline_stage_settings (
  stage text PRIMARY KEY CHECK (stage IN (
    'new_inquiry', 'discovery', 'estimating', 'quote_sent', 'follow_up', 'approved',
    'closed_won', 'closed_lost', 'on_hold'
  )),
  probability int NOT NULL CHECK (probability BETWEEN 0 AND 100),
  goal text NOT NULL DEFAULT '',
  actions jsonb NOT NULL DEFAULT '[]',
  items jsonb NOT NULL DEFAULT '[]',
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS pipeline_stage_settings_updated_at ON pipeline_stage_settings;
CREATE TRIGGER pipeline_stage_settings_updated_at
  BEFORE UPDATE ON pipeline_stage_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Permissions ─────────────────────────────────────────────────────────────
-- Mirrors lib/rbac/permissions.ts, adding pipeline.* keys:
--   super_admin, admin          all pipeline permissions (including pipeline.manage)
--   employee, staff             pipeline.view_all, pipeline.edit
--   customer_support            pipeline.view_assigned, pipeline.edit
--   production_manager          pipeline.view_all (read only)
CREATE OR REPLACE FUNCTION app_user_has_permission(permission_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_has_any_role(ARRAY['super_admin', 'admin'])
    OR (
      permission_key = ANY(ARRAY[
      'profile.view',
      'profile.edit',
      'messages.view',
      'messages.send',
      'notifications.view',
      'files.view'
      ])
      AND app_has_any_role(ARRAY[
        'customer',
        'vendor',
        'designer',
        'referral',
        'reseller',
        'employee',
        'staff',
        'production_manager',
        'installer',
        'customer_support'
      ])
    )
    OR (
      permission_key = ANY(ARRAY[
        'customers.view_assigned',
        'customers.edit',
        'orders.view_assigned',
        'orders.edit',
        'projects.view_assigned',
        'projects.edit',
        'quotes.view',
        'quotes.edit',
        'files.upload',
        'activity.view'
      ])
      AND app_has_any_role(ARRAY[
        'employee',
        'staff',
        'production_manager',
        'customer_support'
      ])
    )
    OR (
      permission_key = ANY(ARRAY[
        'orders.view_assigned',
        'projects.view_assigned',
        'projects.edit',
        'files.upload'
      ])
      AND app_has_role('installer')
    )
    OR (
      permission_key = ANY(ARRAY[
        'orders.view_assigned',
        'orders.create',
        'projects.view_assigned',
        'projects.create',
        'quotes.create',
        'invoices.view',
        'files.upload'
      ])
      AND app_has_role('customer')
    )
    OR (
      permission_key = ANY(ARRAY[
        'vendors.view_own',
        'vendors.edit_own',
        'orders.view_assigned',
        'projects.view_assigned',
        'quotes.view',
        'files.upload'
      ])
      AND app_has_role('vendor')
    )
    OR (
      permission_key = ANY(ARRAY[
        'designers.view_assigned',
        'customers.view_assigned',
        'orders.view_assigned',
        'projects.view_assigned',
        'projects.edit',
        'files.upload'
      ])
      AND app_has_role('designer')
    )
    OR (
      permission_key = ANY(ARRAY[
        'referrals.view_own',
        'customers.view_assigned'
      ])
      AND app_has_role('referral')
    )
    OR (
      permission_key = ANY(ARRAY[
        'resellers.view_own',
        'customers.view_assigned',
        'customers.create',
        'orders.view_assigned',
        'projects.view_assigned',
        'reports.view'
      ])
      AND app_has_role('reseller')
    )
    OR (
      permission_key = ANY(ARRAY['pipeline.view_all', 'pipeline.edit'])
      AND app_has_any_role(ARRAY['employee', 'staff'])
    )
    OR (
      permission_key = ANY(ARRAY['pipeline.view_assigned', 'pipeline.edit'])
      AND app_has_role('customer_support')
    )
    OR (
      permission_key = 'pipeline.view_all'
      AND app_has_role('production_manager')
    );
$$;

CREATE OR REPLACE FUNCTION can_view_pipeline_opportunity(target_opportunity uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_user_has_permission('pipeline.view_all')
    OR (
      app_user_has_permission('pipeline.view_assigned')
      AND EXISTS (
        SELECT 1 FROM pipeline_opportunities o
        WHERE o.id = target_opportunity AND o.owner_id = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION can_edit_pipeline_opportunity(target_opportunity uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_user_has_permission('pipeline.edit') AND can_view_pipeline_opportunity(target_opportunity);
$$;

-- ─── Row level security ──────────────────────────────────────────────────────
-- Admin API routes use the service role and enforce the same rules in code;
-- these policies protect direct client access.
ALTER TABLE pipeline_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunity_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunity_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunity_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_opportunity_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_opps_select" ON pipeline_opportunities;
CREATE POLICY "pipeline_opps_select" ON pipeline_opportunities FOR SELECT
  USING (
    app_user_has_permission('pipeline.view_all')
    OR (app_user_has_permission('pipeline.view_assigned') AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "pipeline_opps_insert" ON pipeline_opportunities;
CREATE POLICY "pipeline_opps_insert" ON pipeline_opportunities FOR INSERT
  WITH CHECK (
    app_user_has_permission('pipeline.edit')
    AND (app_user_has_permission('pipeline.view_all') OR owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "pipeline_opps_update" ON pipeline_opportunities;
CREATE POLICY "pipeline_opps_update" ON pipeline_opportunities FOR UPDATE
  USING (
    app_user_has_permission('pipeline.edit')
    AND (app_user_has_permission('pipeline.view_all') OR owner_id = auth.uid())
  )
  WITH CHECK (
    app_user_has_permission('pipeline.edit')
    AND (app_user_has_permission('pipeline.view_all') OR owner_id = auth.uid())
  );
-- No DELETE policy: opportunities are kept for reporting.

DROP POLICY IF EXISTS "pipeline_line_items_select" ON pipeline_opportunity_line_items;
CREATE POLICY "pipeline_line_items_select" ON pipeline_opportunity_line_items FOR SELECT
  USING (can_view_pipeline_opportunity(opportunity_id));
DROP POLICY IF EXISTS "pipeline_line_items_write" ON pipeline_opportunity_line_items;
CREATE POLICY "pipeline_line_items_write" ON pipeline_opportunity_line_items FOR ALL
  USING (can_edit_pipeline_opportunity(opportunity_id))
  WITH CHECK (can_edit_pipeline_opportunity(opportunity_id));

DROP POLICY IF EXISTS "pipeline_quotes_select" ON pipeline_opportunity_quotes;
CREATE POLICY "pipeline_quotes_select" ON pipeline_opportunity_quotes FOR SELECT
  USING (can_view_pipeline_opportunity(opportunity_id));
DROP POLICY IF EXISTS "pipeline_quotes_insert" ON pipeline_opportunity_quotes;
CREATE POLICY "pipeline_quotes_insert" ON pipeline_opportunity_quotes FOR INSERT
  WITH CHECK (can_edit_pipeline_opportunity(opportunity_id));
DROP POLICY IF EXISTS "pipeline_quotes_update" ON pipeline_opportunity_quotes;
CREATE POLICY "pipeline_quotes_update" ON pipeline_opportunity_quotes FOR UPDATE
  USING (can_edit_pipeline_opportunity(opportunity_id))
  WITH CHECK (can_edit_pipeline_opportunity(opportunity_id));

DROP POLICY IF EXISTS "pipeline_events_select" ON pipeline_opportunity_events;
CREATE POLICY "pipeline_events_select" ON pipeline_opportunity_events FOR SELECT
  USING (can_view_pipeline_opportunity(opportunity_id));
DROP POLICY IF EXISTS "pipeline_events_insert" ON pipeline_opportunity_events;
CREATE POLICY "pipeline_events_insert" ON pipeline_opportunity_events FOR INSERT
  WITH CHECK (can_edit_pipeline_opportunity(opportunity_id) AND actor_id = auth.uid());

DROP POLICY IF EXISTS "pipeline_tasks_select" ON pipeline_opportunity_tasks;
CREATE POLICY "pipeline_tasks_select" ON pipeline_opportunity_tasks FOR SELECT
  USING (can_view_pipeline_opportunity(opportunity_id));
DROP POLICY IF EXISTS "pipeline_tasks_write" ON pipeline_opportunity_tasks;
CREATE POLICY "pipeline_tasks_write" ON pipeline_opportunity_tasks FOR ALL
  USING (can_edit_pipeline_opportunity(opportunity_id))
  WITH CHECK (can_edit_pipeline_opportunity(opportunity_id));

DROP POLICY IF EXISTS "pipeline_files_select" ON pipeline_opportunity_files;
CREATE POLICY "pipeline_files_select" ON pipeline_opportunity_files FOR SELECT
  USING (can_view_pipeline_opportunity(opportunity_id));
DROP POLICY IF EXISTS "pipeline_files_write" ON pipeline_opportunity_files;
CREATE POLICY "pipeline_files_write" ON pipeline_opportunity_files FOR ALL
  USING (can_edit_pipeline_opportunity(opportunity_id))
  WITH CHECK (can_edit_pipeline_opportunity(opportunity_id));

DROP POLICY IF EXISTS "pipeline_stage_settings_select" ON pipeline_stage_settings;
CREATE POLICY "pipeline_stage_settings_select" ON pipeline_stage_settings FOR SELECT
  USING (app_user_has_permission('pipeline.view_all') OR app_user_has_permission('pipeline.view_assigned'));
DROP POLICY IF EXISTS "pipeline_stage_settings_manage" ON pipeline_stage_settings;
CREATE POLICY "pipeline_stage_settings_manage" ON pipeline_stage_settings FOR ALL
  USING (app_user_has_permission('pipeline.manage'))
  WITH CHECK (app_user_has_permission('pipeline.manage'));

COMMENT ON TABLE pipeline_opportunities IS
  'Sales Pipeline: one potential job from inquiry to Closed Won. Production continues on the linked order.';
COMMENT ON TABLE pipeline_opportunity_quotes IS
  'Quote versions for an opportunity. Each links an existing orders row; only the is_current version drives value.';
COMMENT ON TABLE pipeline_opportunity_events IS
  'Append-only stage, owner, quote, conversion and manual activity history for an opportunity.';
