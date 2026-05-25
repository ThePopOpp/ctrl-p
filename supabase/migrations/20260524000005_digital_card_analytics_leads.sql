-- ============================================================
-- controlp.io - Digital card analytics and leads
-- Tracks public card engagement, shares, likes, QR scans,
-- link clicks, contact saves, and customer lead capture.
-- ============================================================

CREATE TABLE IF NOT EXISTS digital_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_card_id uuid NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  link_id uuid REFERENCES digital_card_links(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'view',
    'share',
    'like',
    'qr_scan',
    'link_click',
    'copy_link',
    'save_contact',
    'lead_submit'
  )),
  source text,
  device_type text,
  referrer text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_card_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_card_id uuid NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  company text,
  message text,
  preferred_contact text,
  source text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'archived')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digital_card_events_card_type_idx
  ON digital_card_events(digital_card_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS digital_card_events_user_id_idx
  ON digital_card_events(user_id);
CREATE INDEX IF NOT EXISTS digital_card_leads_card_created_idx
  ON digital_card_leads(digital_card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS digital_card_leads_owner_status_idx
  ON digital_card_leads(owner_user_id, status);

DROP TRIGGER IF EXISTS digital_card_leads_updated_at ON digital_card_leads;
CREATE TRIGGER digital_card_leads_updated_at
  BEFORE UPDATE ON digital_card_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE digital_card_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_card_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_digital_card_events" ON digital_card_events;
CREATE POLICY "public_insert_digital_card_events"
  ON digital_card_events FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "customers_view_own_digital_card_events" ON digital_card_events;
CREATE POLICY "customers_view_own_digital_card_events"
  ON digital_card_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_events.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  );

DROP POLICY IF EXISTS "public_insert_digital_card_leads" ON digital_card_leads;
CREATE POLICY "public_insert_digital_card_leads"
  ON digital_card_leads FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "customers_manage_own_digital_card_leads" ON digital_card_leads;
CREATE POLICY "customers_manage_own_digital_card_leads"
  ON digital_card_leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_leads.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_leads.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  );

COMMENT ON TABLE digital_card_events IS
  'Public and customer-visible analytics events for digital cards, QR scans, shares, likes, link clicks, and contact saves.';

COMMENT ON TABLE digital_card_leads IS
  'Lead capture submissions created from public digital business cards.';
