-- ─── Card-scoped automations ──────────────────────────────────────────────────
-- Scope the existing automations table to a specific digital card.
-- Global automations (digital_card_id IS NULL) still apply to all cards.

ALTER TABLE automations ADD COLUMN IF NOT EXISTS digital_card_id uuid REFERENCES digital_cards(id) ON DELETE CASCADE;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS preset_key text; -- e.g. 'lead_email', 'nfc_alert'

CREATE INDEX IF NOT EXISTS automations_card_idx    ON automations (digital_card_id) WHERE digital_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS automations_preset_idx  ON automations (digital_card_id, preset_key) WHERE preset_key IS NOT NULL;

-- Allow card owners to read/write their own card automations (service-role route handles this)
-- RLS remains admin-only for the base table; the API route bypasses via service role
-- and verifies card ownership before mutating.

-- ─── Pending (delayed) automations ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pending_automations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   uuid        NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_data    jsonb       NOT NULL DEFAULT '{}',
  scheduled_at    timestamptz NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'executed', 'failed', 'cancelled')),
  error_message   text,
  executed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_automations_due_idx  ON pending_automations (scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS pending_automations_auto_idx ON pending_automations (automation_id);

ALTER TABLE pending_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pending automations"
  ON pending_automations FOR ALL
  USING (auth.jwt() ->> 'role' IN ('super_admin', 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('super_admin', 'admin'));

-- ─── Lead enrichment columns ──────────────────────────────────────────────────

ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS tags          text[]      DEFAULT '{}';
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS utm_source    text;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS utm_medium    text;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS utm_campaign  text;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS follow_up_sent_at timestamptz;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS notes         text;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS assigned_to   uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS digital_card_leads_tags_idx   ON digital_card_leads USING gin (tags);
CREATE INDEX IF NOT EXISTS digital_card_leads_status_idx ON digital_card_leads (status);
CREATE INDEX IF NOT EXISTS digital_card_leads_owner_idx  ON digital_card_leads (owner_user_id, created_at DESC);
