-- ============================================================
-- controlp.io - Digital card builder extensions
-- Adds page modes, lead form config, QR designer options,
-- customer theme library, media metadata, and version history.
-- ============================================================

ALTER TABLE digital_cards
  ADD COLUMN IF NOT EXISTS card_mode text NOT NULL DEFAULT 'standard'
    CHECK (card_mode IN ('standard', 'opener_slider', 'qr_only', 'nfc_landing')),
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'dark'
    CHECK (theme_mode IN ('light', 'dark', 'both')),
  ADD COLUMN IF NOT EXISTS layout_template text NOT NULL DEFAULT 'classic'
    CHECK (layout_template IN ('classic', 'split_profile', 'link_hub', 'sales_intro', 'portfolio', 'appointment_first')),
  ADD COLUMN IF NOT EXISTS qr_logo_url text,
  ADD COLUMN IF NOT EXISTS qr_corner_style text NOT NULL DEFAULT 'square'
    CHECK (qr_corner_style IN ('square', 'rounded', 'extra_rounded', 'dot')),
  ADD COLUMN IF NOT EXISTS qr_dot_style text NOT NULL DEFAULT 'square'
    CHECK (qr_dot_style IN ('square', 'rounded', 'dots', 'classy')),
  ADD COLUMN IF NOT EXISTS lead_form_settings jsonb NOT NULL DEFAULT '{"enabled":true,"title":"Send me your info","fields":[{"key":"name","label":"Name","enabled":true,"required":false},{"key":"email","label":"Email","enabled":true,"required":false},{"key":"phone","label":"Phone","enabled":true,"required":false},{"key":"message","label":"Message","enabled":true,"required":false}]}',
  ADD COLUMN IF NOT EXISTS slider_pages jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS media_settings jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subscription_provider text,
  ADD COLUMN IF NOT EXISTS subscription_reference text;

CREATE TABLE IF NOT EXISTS digital_card_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  theme_mode text NOT NULL DEFAULT 'dark' CHECK (theme_mode IN ('light', 'dark', 'both')),
  background_color text NOT NULL DEFAULT '#07130b',
  accent_color text NOT NULL DEFAULT '#a3ff12',
  text_color text NOT NULL DEFAULT '#f7fff2',
  qr_settings jsonb NOT NULL DEFAULT '{}',
  media_settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_card_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_card_id uuid NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  version_name text,
  snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digital_cards_card_mode_idx ON digital_cards(card_mode);
CREATE INDEX IF NOT EXISTS digital_cards_layout_template_idx ON digital_cards(layout_template);
CREATE INDEX IF NOT EXISTS digital_card_themes_user_id_idx ON digital_card_themes(user_id);
CREATE INDEX IF NOT EXISTS digital_card_versions_card_created_idx ON digital_card_versions(digital_card_id, created_at DESC);

DROP TRIGGER IF EXISTS digital_card_themes_updated_at ON digital_card_themes;
CREATE TRIGGER digital_card_themes_updated_at
  BEFORE UPDATE ON digital_card_themes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE digital_card_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_card_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_manage_own_digital_card_themes" ON digital_card_themes;
CREATE POLICY "customers_manage_own_digital_card_themes"
  ON digital_card_themes FOR ALL
  USING (user_id = auth.uid() OR is_staff_or_admin())
  WITH CHECK (user_id = auth.uid() OR is_staff_or_admin());

DROP POLICY IF EXISTS "customers_view_own_digital_card_versions" ON digital_card_versions;
CREATE POLICY "customers_view_own_digital_card_versions"
  ON digital_card_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_versions.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  );

DROP POLICY IF EXISTS "customers_create_own_digital_card_versions" ON digital_card_versions;
CREATE POLICY "customers_create_own_digital_card_versions"
  ON digital_card_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_versions.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  );

COMMENT ON COLUMN digital_cards.card_mode IS
  'Public landing mode: standard card, opener/slider, QR-only, or NFC landing page.';
COMMENT ON COLUMN digital_cards.lead_form_settings IS
  'Customer-configurable lead capture form fields for public digital cards.';
COMMENT ON TABLE digital_card_themes IS
  'Reusable customer-owned digital card theme presets.';
COMMENT ON TABLE digital_card_versions IS
  'Point-in-time saved digital card snapshots for restore/version history.';
