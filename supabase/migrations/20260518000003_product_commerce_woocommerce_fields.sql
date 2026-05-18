-- ============================================================
-- controlp.io - Product commerce and WooCommerce field expansion
-- Adds storefront, shipping, template, import, and sync metadata.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS alternate_skus jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS brands jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sale_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS tax_status text NOT NULL DEFAULT 'taxable',
  ADD COLUMN IF NOT EXISTS tax_class text,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS accessories jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS photo_gallery jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tips jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS similar_products jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS linked_products jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS weight_lbs numeric(12,3),
  ADD COLUMN IF NOT EXISTS dimension_length_in numeric(12,3),
  ADD COLUMN IF NOT EXISTS dimension_width_in numeric(12,3),
  ADD COLUMN IF NOT EXISTS dimension_height_in numeric(12,3),
  ADD COLUMN IF NOT EXISTS shipping_class text,
  ADD COLUMN IF NOT EXISTS template_files jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS import_sources jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS woo_product_id text,
  ADD COLUMN IF NOT EXISTS woo_permalink text,
  ADD COLUMN IF NOT EXISTS woo_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS woo_sync_status text NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS woo_last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS products_stock_status_idx ON products(stock_status);
CREATE INDEX IF NOT EXISTS products_woo_product_id_idx ON products(woo_product_id);
CREATE INDEX IF NOT EXISTS products_woo_sync_enabled_idx ON products(woo_sync_enabled);

COMMENT ON COLUMN products.alternate_skus IS
  'Additional SKUs, vendor SKUs, WooCommerce SKUs, UPCs, or internal aliases for the product.';
COMMENT ON COLUMN products.template_files IS
  'Customer and production template downloads such as PDF, PNG, SVG, EPS, dielines, and proof assets.';
COMMENT ON COLUMN products.import_sources IS
  'CSV, WooCommerce, vendor catalog, or manual import metadata used to trace product origin and sync behavior.';
COMMENT ON COLUMN products.woo_product_id IS
  'WooCommerce product id on the connected WordPress storefront.';
COMMENT ON COLUMN products.woo_sync_status IS
  'WooCommerce sync state such as not_synced, imported, pushed, pulled, synced, failed.';
