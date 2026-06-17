-- ============================================================
-- controlp.io — Add 25 oz. Aluminum Tundra Bike Bottle
-- Custom-imprinted metallic aluminum bottle, 7 colors,
-- silk-screen or 4-color process, minimum 36 units (1 carton).
-- ============================================================

INSERT INTO products (
  sku, slug, name, category, base_cost, base_price, vendor,
  active, status, sort_order, tagline, sizes, materials, print_options
) VALUES (
  'bb',
  'tundra-bike-bottle',
  '25 oz. Aluminum Tundra Bike Bottle',
  'custom-merch',
  7.00,
  14.99,
  'b2sign',
  true,
  'active',
  30,
  'Custom-imprinted metallic aluminum bottles — 7 colors, 4 imprint methods, minimum 36 units',
  '["25 oz (9½\" tall)"]'::jsonb,
  '["White","Black","Silver","Blue","Red","Green","Orange"]'::jsonb,
  '["Silk-Screen (2½\"×4½\")","Wraparound Silk-Screen (6\"×4½\")","4-Color Process — Standard (3¾\"×4\")","4-Color Process — Large (5¾\"×4\")"]'::jsonb
)
ON CONFLICT (sku) DO UPDATE SET
  slug         = EXCLUDED.slug,
  name         = EXCLUDED.name,
  category     = EXCLUDED.category,
  base_cost    = EXCLUDED.base_cost,
  base_price   = EXCLUDED.base_price,
  vendor       = EXCLUDED.vendor,
  active       = EXCLUDED.active,
  status       = EXCLUDED.status,
  sort_order   = EXCLUDED.sort_order,
  tagline      = EXCLUDED.tagline,
  sizes        = EXCLUDED.sizes,
  materials    = EXCLUDED.materials,
  print_options = EXCLUDED.print_options;

-- Color variants (all same price — tier pricing calculated in designer)
WITH p AS (SELECT id FROM products WHERE sku = 'bb')
INSERT INTO product_variants (product_id, sku, name, cost_delta, sort_order)
SELECT p.id, v.sku, v.name, 0, v.s
FROM p, (VALUES
  ('bb-white',  'White',  1),
  ('bb-black',  'Black',  2),
  ('bb-silver', 'Silver', 3),
  ('bb-blue',   'Blue',   4),
  ('bb-red',    'Red',    5),
  ('bb-green',  'Green',  6),
  ('bb-orange', 'Orange', 7)
) AS v(sku, name, s)
ON CONFLICT (product_id, sku) DO NOTHING;
