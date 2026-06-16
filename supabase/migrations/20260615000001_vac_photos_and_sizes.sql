-- ─── VAC: Update photo gallery and replace old size variants ──

-- Set photo gallery
UPDATE products SET photo_gallery = '[
  "https://www.b2sign.com/image/thumb/240501/HlwDMnqI-s1000.jpg",
  "https://www.b2sign.com/image/thumb/240305/p3UypbTG-s1000.jpg",
  "https://www.b2sign.com/image/thumb/240501/lE9KPBtG-s1000.jpg",
  "https://www.b2sign.com/image/thumb/240501/JFjXRt5F-s1000.jpg",
  "https://www.b2sign.com/image/thumb/240501/yxoxFs0n-s1000.jpg",
  "https://www.b2sign.com/image/thumb/250602/DSJy3oRr-s1000.jpg",
  "https://www.b2sign.com/image/thumb/250430/sZSbQfQd-s1000.jpg",
  "https://www.b2sign.com/image/thumb/250430/xspBpbCu-s1000.jpg"
]'::jsonb WHERE sku = 'vac';

-- Remove old size variants and replace with full set
DELETE FROM product_variants
WHERE product_id = (SELECT id FROM products WHERE sku = 'vac')
  AND sku IN ('vac-11x14','vac-16x20','vac-18x24','vac-24x36');

WITH p AS (SELECT id FROM products WHERE sku = 'vac')
INSERT INTO product_variants (product_id, sku, name, dimension_w, dimension_h, cost_delta, sort_order)
SELECT p.id, v.sku, v.name, v.w, v.h, v.delta, v.s FROM p, (VALUES
  ('vac-16x16', '16" × 16"',  16, 16,   2.00,  1),
  ('vac-16x24', '16" × 24"',  16, 24,   6.00,  2),
  ('vac-24x24', '24" × 24"',  24, 24,  10.00,  3),
  ('vac-24x36', '24" × 36"',  24, 36,  17.00,  4),
  ('vac-24x46', '24" × 46"',  24, 46,  23.00,  5),
  ('vac-24x60', '24" × 60"',  24, 60,  30.00,  6),
  ('vac-24x72', '24" × 72"',  24, 72,  37.00,  7),
  ('vac-36x36', '36" × 36"',  36, 36,  26.00,  8),
  ('vac-36x46', '36" × 46"',  36, 46,  35.00,  9),
  ('vac-36x60', '36" × 60"',  36, 60,  46.00, 10),
  ('vac-36x72', '36" × 72"',  36, 72,  57.00, 11),
  ('vac-46x46', '46" × 46"',  46, 46,  45.00, 12),
  ('vac-46x60', '46" × 60"',  46, 60,  58.00, 13),
  ('vac-46x72', '46" × 72"',  46, 72,  71.00, 14),
  ('vac-60x60', '60" × 60"',  60, 60,  76.00, 15),
  ('vac-60x72', '60" × 72"',  60, 72,  90.00, 16),
  ('vac-72x72', '72" × 72"',  72, 72, 106.00, 17)
) AS v(sku, name, w, h, delta, s);
