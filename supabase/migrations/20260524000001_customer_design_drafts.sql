-- ============================================================
-- controlp.io - Customer saved designer drafts
-- Extends existing design_drafts so designer.html saves can
-- appear in the customer dashboard and later connect to orders,
-- artwork, proofing, production, payments, and shipping.
-- ============================================================

ALTER TABLE design_drafts
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS product_key text,
  ADD COLUMN IF NOT EXISTS product_label text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'ready_for_review',
    'ordered',
    'in_production',
    'archived'
  )),
  ADD COLUMN IF NOT EXISTS preview_svg text,
  ADD COLUMN IF NOT EXISTS preview_image_url text,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS design_drafts_status_idx ON design_drafts(status);
CREATE INDEX IF NOT EXISTS design_drafts_product_key_idx ON design_drafts(product_key);
CREATE INDEX IF NOT EXISTS design_drafts_order_id_idx ON design_drafts(order_id);
CREATE INDEX IF NOT EXISTS design_drafts_last_saved_idx ON design_drafts(last_saved_at DESC);

DROP TRIGGER IF EXISTS design_drafts_updated_at ON design_drafts;
CREATE TRIGGER design_drafts_updated_at
  BEFORE UPDATE ON design_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON COLUMN design_drafts.product_key IS
  'Legacy/static designer product key such as hat, bc, wa, banner, yard-sign, reverse-acrylic, or floor-decal.';
COMMENT ON COLUMN design_drafts.preview_svg IS
  'Lightweight SVG snapshot used for customer dashboard previews.';
COMMENT ON COLUMN design_drafts.status IS
  'Customer design lifecycle before and after checkout/order handoff.';
