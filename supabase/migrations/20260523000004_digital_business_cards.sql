-- ============================================================
-- controlp.io - Digital Business Cards phase 1
-- Customer-owned public card profiles, QR/NFC-ready metadata,
-- and unlimited custom links.
-- ============================================================

CREATE TABLE IF NOT EXISTS digital_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  card_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unpublished', 'disabled')),
  is_public boolean NOT NULL DEFAULT false,
  public_url text,
  first_name text,
  last_name text,
  display_name text,
  job_title text,
  company_name text,
  department text,
  bio text,
  profile_photo_url text,
  logo_url text,
  background_image_url text,
  background_color text NOT NULL DEFAULT '#07130b',
  accent_color text NOT NULL DEFAULT '#a3ff12',
  text_color text NOT NULL DEFAULT '#f7fff2',
  button_style text NOT NULL DEFAULT 'rounded',
  layout_style text NOT NULL DEFAULT 'stacked',
  primary_phone text,
  mobile_phone text,
  office_phone text,
  sms_phone text,
  primary_email text,
  secondary_email text,
  website_url text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text DEFAULT 'US',
  maps_url text,
  intro_video_url text,
  qr_settings jsonb NOT NULL DEFAULT '{"foreground":"#07130b","background":"#ffffff","size":512}',
  nfc_status text NOT NULL DEFAULT 'not_ordered',
  access_status text NOT NULL DEFAULT 'trial' CHECK (access_status IN ('trial', 'active', 'past_due', 'paused', 'expired', 'none')),
  access_plan text,
  access_expires_at timestamptz,
  assigned_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  assigned_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  view_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_card_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_card_id uuid NOT NULL REFERENCES digital_cards(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  link_type text NOT NULL DEFAULT 'custom' CHECK (link_type IN (
    'website',
    'social',
    'phone',
    'email',
    'sms',
    'map',
    'booking',
    'payment',
    'download',
    'video',
    'review',
    'custom'
  )),
  icon text,
  display_order integer NOT NULL DEFAULT 100,
  is_visible boolean NOT NULL DEFAULT true,
  open_in_new_tab boolean NOT NULL DEFAULT true,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digital_cards_user_id_idx ON digital_cards(user_id);
CREATE INDEX IF NOT EXISTS digital_cards_customer_id_idx ON digital_cards(customer_id);
CREATE INDEX IF NOT EXISTS digital_cards_slug_idx ON digital_cards(slug);
CREATE INDEX IF NOT EXISTS digital_cards_status_idx ON digital_cards(status);
CREATE INDEX IF NOT EXISTS digital_cards_assigned_order_id_idx ON digital_cards(assigned_order_id);
CREATE INDEX IF NOT EXISTS digital_cards_assigned_product_id_idx ON digital_cards(assigned_product_id);
CREATE INDEX IF NOT EXISTS digital_card_links_card_order_idx ON digital_card_links(digital_card_id, display_order);

DROP TRIGGER IF EXISTS digital_cards_updated_at ON digital_cards;
CREATE TRIGGER digital_cards_updated_at
  BEFORE UPDATE ON digital_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS digital_card_links_updated_at ON digital_card_links;
CREATE TRIGGER digital_card_links_updated_at
  BEFORE UPDATE ON digital_card_links FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE digital_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_card_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_manage_own_digital_cards" ON digital_cards;
CREATE POLICY "customers_manage_own_digital_cards"
  ON digital_cards FOR ALL
  USING (user_id = auth.uid() OR customer_id = auth.uid() OR is_staff_or_admin())
  WITH CHECK (user_id = auth.uid() OR customer_id = auth.uid() OR is_staff_or_admin());

DROP POLICY IF EXISTS "public_view_published_digital_cards" ON digital_cards;
CREATE POLICY "public_view_published_digital_cards"
  ON digital_cards FOR SELECT
  USING (is_public = true AND status = 'published');

DROP POLICY IF EXISTS "customers_manage_own_digital_card_links" ON digital_card_links;
CREATE POLICY "customers_manage_own_digital_card_links"
  ON digital_card_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_links.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_links.digital_card_id
        AND (digital_cards.user_id = auth.uid() OR digital_cards.customer_id = auth.uid() OR is_staff_or_admin())
    )
  );

DROP POLICY IF EXISTS "public_view_visible_digital_card_links" ON digital_card_links;
CREATE POLICY "public_view_visible_digital_card_links"
  ON digital_card_links FOR SELECT
  USING (
    is_visible = true
    AND EXISTS (
      SELECT 1 FROM digital_cards
      WHERE digital_cards.id = digital_card_links.digital_card_id
        AND digital_cards.is_public = true
        AND digital_cards.status = 'published'
    )
  );

COMMENT ON TABLE digital_cards IS
  'Customer-owned digital business cards for public URLs, QR codes, NFC products, and future print/product bundles.';

COMMENT ON TABLE digital_card_links IS
  'Unlimited visible/custom links and buttons attached to a digital business card.';
