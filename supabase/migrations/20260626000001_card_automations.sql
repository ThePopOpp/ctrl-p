-- ─── Base automations table (idempotent — safe to run even if email_system migration was skipped) ──

CREATE TABLE IF NOT EXISTS automations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  description         text,
  trigger_type        text NOT NULL,
  trigger_conditions  jsonb DEFAULT '{}',
  action_type         text NOT NULL,
  action_data         jsonb DEFAULT '{}',
  delay_minutes       integer DEFAULT 0,
  enabled             boolean DEFAULT true,
  last_run_at         timestamptz,
  run_count           integer DEFAULT 0,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_trigger_idx ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS automations_enabled_idx ON automations(enabled);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'Admins manage automations'
  ) THEN
    ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Admins manage automations"
      ON automations FOR ALL
      USING (auth.jwt() ->> 'role' IN ('super_admin', 'admin'))
      WITH CHECK (auth.jwt() ->> 'role' IN ('super_admin', 'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS automation_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_data    jsonb DEFAULT '{}',
  action_result   jsonb DEFAULT '{}',
  status          text DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  error_message   text,
  executed_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_logs_automation_idx ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS automation_logs_executed_idx   ON automation_logs(executed_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automation_logs' AND policyname = 'Admins view automation logs'
  ) THEN
    ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Admins view automation logs"
      ON automation_logs FOR SELECT
      USING (auth.jwt() ->> 'role' IN ('super_admin', 'admin'));
  END IF;
END $$;

-- ─── Card-scoped automations ──────────────────────────────────────────────────
-- Scope automations to a specific digital card.
-- Global automations (digital_card_id IS NULL) still apply to all cards.

ALTER TABLE automations ADD COLUMN IF NOT EXISTS digital_card_id uuid REFERENCES digital_cards(id) ON DELETE CASCADE;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS preset_key text;

CREATE INDEX IF NOT EXISTS automations_card_idx   ON automations (digital_card_id) WHERE digital_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS automations_preset_idx ON automations (digital_card_id, preset_key) WHERE preset_key IS NOT NULL;

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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pending_automations' AND policyname = 'Admins manage pending automations'
  ) THEN
    ALTER TABLE pending_automations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Admins manage pending automations"
      ON pending_automations FOR ALL
      USING (auth.jwt() ->> 'role' IN ('super_admin', 'admin'))
      WITH CHECK (auth.jwt() ->> 'role' IN ('super_admin', 'admin'));
  END IF;
END $$;

-- ─── Lead enrichment columns ──────────────────────────────────────────────────

ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS tags              text[]      DEFAULT '{}';
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS utm_source        text;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS utm_medium        text;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS utm_campaign      text;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS follow_up_sent_at timestamptz;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS notes             text;
ALTER TABLE digital_card_leads ADD COLUMN IF NOT EXISTS assigned_to       uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS digital_card_leads_tags_idx   ON digital_card_leads USING gin (tags);
CREATE INDEX IF NOT EXISTS digital_card_leads_status_idx ON digital_card_leads (status);
CREATE INDEX IF NOT EXISTS digital_card_leads_owner_idx  ON digital_card_leads (owner_user_id, created_at DESC);
