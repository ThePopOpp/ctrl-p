-- ============================================================
-- controlp.io - Pipeline quick actions
--
-- Additive. Supports the opportunity workspace's quick-action menu:
--   * new event types for real communications sent/placed from Ctrl+P
--     (`communication`), linked records (`record_linked`) and plan / contract /
--     SOW documents (`document_updated`)
--   * pipeline_opportunity_documents for plans, contracts and SOWs
--   * a private storage bucket for voice notes
--
-- Requires 20260913000001_sales_pipeline.sql. Safe to re-run.
-- ============================================================

ALTER TABLE pipeline_opportunity_events
  DROP CONSTRAINT IF EXISTS pipeline_opportunity_events_event_type_check;

ALTER TABLE pipeline_opportunity_events
  ADD CONSTRAINT pipeline_opportunity_events_event_type_check CHECK (event_type IN (
    'created', 'stage_changed', 'owner_changed', 'fields_updated', 'quote_linked', 'quote_revised',
    'quote_updated', 'converted', 'task_created', 'task_completed', 'file_linked', 'manual_log',
    'communication', 'record_linked', 'document_updated'
  ));

CREATE INDEX IF NOT EXISTS idx_pipeline_events_kind
  ON pipeline_opportunity_events(opportunity_id, event_type, log_kind);

-- ─── Plans, contracts and statements of work ────────────────────────────────
-- Records kept on the opportunity. Status is set by staff; there is no
-- e-signature integration, so "signed" means someone recorded that it was.
CREATE TABLE IF NOT EXISTS pipeline_opportunity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('plan', 'contract', 'sow')),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'signed', 'declined', 'archived')),
  amount numeric(12,2) CHECK (amount IS NULL OR amount >= 0),
  effective_date date,
  due_date date,
  body text,
  file_url text CHECK (file_url IS NULL OR file_url ~* '^https?://'),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_documents_opp ON pipeline_opportunity_documents(opportunity_id, kind);

DROP TRIGGER IF EXISTS pipeline_opportunity_documents_updated_at ON pipeline_opportunity_documents;
CREATE TRIGGER pipeline_opportunity_documents_updated_at
  BEFORE UPDATE ON pipeline_opportunity_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pipeline_opportunity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_documents_select" ON pipeline_opportunity_documents;
CREATE POLICY "pipeline_documents_select" ON pipeline_opportunity_documents FOR SELECT
  USING (can_view_pipeline_opportunity(opportunity_id));
DROP POLICY IF EXISTS "pipeline_documents_write" ON pipeline_opportunity_documents;
CREATE POLICY "pipeline_documents_write" ON pipeline_opportunity_documents FOR ALL
  USING (can_edit_pipeline_opportunity(opportunity_id))
  WITH CHECK (can_edit_pipeline_opportunity(opportunity_id));

-- ─── Voice notes storage ────────────────────────────────────────────────────
-- Private: files are only reachable through short-lived signed URLs issued by
-- the Pipeline API after its record-access check.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pipeline-voice-notes',
  'pipeline-voice-notes',
  false,
  10485760,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE pipeline_opportunity_documents IS
  'Plans, contracts and SOWs recorded on a sales opportunity. Status is staff-recorded; no e-signature integration.';
