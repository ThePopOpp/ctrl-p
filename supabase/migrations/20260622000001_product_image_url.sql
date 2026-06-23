-- Add featured/hero image URL to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN products.image_url IS
  'Primary hero image shown in product listings and storefront. A single URL (uploaded to artwork storage or external).';
