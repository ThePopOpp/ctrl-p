-- ============================================================
-- controlp.io - Product designer field expansion
-- Adds flexible product fields for customer-customizable products.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS designer_template jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS designer_surfaces jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS designer_constraints jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS personalization_schema jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS proofing_settings jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS production_requirements jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_assets jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN products.designer_template IS
  'Online designer template definition, including canvas defaults, linked template ids, and layout metadata.';
COMMENT ON COLUMN products.designer_surfaces IS
  'Printable/customizable surfaces such as front, back, left sleeve, panel 1, etc.';
COMMENT ON COLUMN products.designer_constraints IS
  'Designer constraints such as bleed, safe area, min DPI, color mode, locked layers, and upload limits.';
COMMENT ON COLUMN products.personalization_schema IS
  'Customer-facing personalization inputs and variable data fields for this product.';
COMMENT ON COLUMN products.proofing_settings IS
  'Proofing behavior such as proof required, auto-proof eligibility, approval rules, and revision limits.';
COMMENT ON COLUMN products.production_requirements IS
  'Production metadata such as stations, vendor routing, packaging, install needs, and handoff instructions.';
COMMENT ON COLUMN products.product_assets IS
  'Reusable product images, mockups, dielines, templates, downloads, and design assets.';
