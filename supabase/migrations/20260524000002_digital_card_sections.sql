-- ============================================================
-- controlp.io - Digital card sections / layers phase 2
-- Adds reorderable public card sections with per-side spacing.
-- ============================================================

CREATE TABLE IF NOT EXISTS digital_card_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_card_id uuid NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  section_type text NOT NULL DEFAULT 'custom' CHECK (section_type IN (
    'profile_header',
    'quick_actions',
    'links',
    'video',
    'qr_code',
    'nfc',
    'gallery',
    'scratch_card',
    'punch_card',
    'loyalty_card',
    'custom'
  )),
  label text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 100,
  is_visible boolean NOT NULL DEFAULT true,
  customer_editable boolean NOT NULL DEFAULT true,
  margin_top integer NOT NULL DEFAULT 0 CHECK (margin_top >= 0 AND margin_top <= 240),
  margin_right integer NOT NULL DEFAULT 0 CHECK (margin_right >= 0 AND margin_right <= 240),
  margin_bottom integer NOT NULL DEFAULT 16 CHECK (margin_bottom >= 0 AND margin_bottom <= 240),
  margin_left integer NOT NULL DEFAULT 0 CHECK (margin_left >= 0 AND margin_left <= 240),
  padding_top integer NOT NULL DEFAULT 0 CHECK (padding_top >= 0 AND padding_top <= 240),
  padding_right integer NOT NULL DEFAULT 0 CHECK (padding_right >= 0 AND padding_right <= 240),
  padding_bottom integer NOT NULL DEFAULT 0 CHECK (padding_bottom >= 0 AND padding_bottom <= 240),
  padding_left integer NOT NULL DEFAULT 0 CHECK (padding_left >= 0 AND padding_left <= 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digital_card_sections_card_order_idx
  ON digital_card_sections(digital_card_id, display_order);
CREATE INDEX IF NOT EXISTS digital_card_sections_type_idx
  ON digital_card_sections(section_type);
CREATE INDEX IF NOT EXISTS digital_card_sections_visible_idx
  ON digital_card_sections(is_visible);

DROP TRIGGER IF EXISTS digital_card_sections_updated_at ON digital_card_sections;
CREATE TRIGGER digital_card_sections_updated_at
  BEFORE UPDATE ON digital_card_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE digital_card_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_manage_own_digital_card_sections" ON digital_card_sections;
CREATE POLICY "customers_manage_own_digital_card_sections"
  ON digital_card_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_sections.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_sections.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  );

DROP POLICY IF EXISTS "public_view_visible_digital_card_sections" ON digital_card_sections;
CREATE POLICY "public_view_visible_digital_card_sections"
  ON digital_card_sections FOR SELECT
  USING (
    is_visible = true
    AND EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_sections.digital_card_id
        AND digital_cards.is_public = true
        AND digital_cards.status = 'published'
    )
  );

COMMENT ON TABLE digital_card_sections IS
  'Customer-editable digital business card sections/layers with ordering, visibility, and per-side spacing.';
