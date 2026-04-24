-- ============================================================
-- controlp.io — Product Catalog Seed Data
-- Phase 1 · Gate 1
--
-- Cost formula: retail_price × 0.34
-- (All products fall in Tier 1: gross margin 66%, divisor 0.34)
-- Retail prices sourced from designer.html configurator.
-- ============================================================

-- ─── PRICING RULES ────────────────────────────────────────
INSERT INTO pricing_rules (name, tier_index, margin, max_retail) VALUES
  ('Tier 1 — Under $300 (66% margin)',   1, 0.6600, 300.00),
  ('Tier 2 — $300–$999.99 (50% margin)', 2, 0.5000, 1000.00),
  ('Tier 3 — $1,000+ (40% margin)',      3, 0.4000, NULL);

-- ─── PRODUCTS ─────────────────────────────────────────────
-- base_cost = cost of the cheapest possible configuration.
-- All variant/option cost_deltas are ADDITIVE on top of this.
INSERT INTO products (sku, slug, name, category, base_cost, vendor, sort_order) VALUES
  ('bc',  'business-cards',   'Business Cards',          'print',      9.86,  'in_house', 1),
  ('wa',  'wall-art',         'Wall Art / Framed Prints','wall-art',   26.86, 'in_house', 2),
  ('bn',  'banners',          'Banners',                 'banners',    9.86,  'b2sign',   3),
  ('rs',  'rigid-signs',      'Rigid Signs',             'signage',    6.12,  'b2sign',   4),
  ('af',  'a-frame-signs',    'A-Frame Signs',           'signage',    13.26, 'b2sign',   5),
  ('fl',  'flags',            'Flags',                   'flags',      16.66, 'b2sign',   6),
  ('vac', 'vision-art-chart', 'Vision Art Chart',        'custom-art', 12.00, 'in_house', 7);

-- ─── BUSINESS CARDS: VARIANTS (sizes) ─────────────────────
-- BC sizes don't change the base price; cost_delta = 0.
-- Quantity options carry the cost difference.
WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_variants (product_id, sku, name, dimension_w, dimension_h, cost_delta, sort_order)
SELECT p.id, v.sku, v.name, v.w, v.h, 0.00, v.s FROM p, (VALUES
  ('bc-standard', 'Standard (3.5"×2")',  3.5,  2.00, 1),
  ('bc-square',   'Square (2.5"×2.5")',  2.5,  2.50, 2),
  ('bc-slim',     'Slim (3.5"×1.75")',   3.5,  1.75, 3),
  ('bc-mini',     'Mini (2.5"×1.5")',    2.5,  1.50, 4),
  ('bc-euro',     'Euro (3.35"×2.17")',  3.35, 2.17, 5),
  ('bc-bookmark', 'Bookmark (2"×7")',    2.0,  7.00, 6)
) AS v(sku, name, w, h, s);

-- ─── BUSINESS CARDS: OPTIONS ──────────────────────────────
-- Quantity: cost = retail×0.34. base_cost=9.86 (50 cards=$29 retail).
-- Delta = quantity_cost - base_cost (negative means cheaper than base).
WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'quantity', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('50',   '50 cards',   0.00,  1),   -- $29 × 0.34 = $9.86 = base
  ('100',  '100 cards',  3.40,  2),   -- $39 × 0.34 = $13.26  → delta +$3.40
  ('250',  '250 cards',  10.20, 3),   -- $59 × 0.34 = $20.06  → delta +$10.20
  ('500',  '500 cards',  20.40, 4),   -- $89 × 0.34 = $30.26  → delta +$20.40
  ('1000', '1,000 cards',33.86, 5),   -- $129 × 0.34 = $43.86 → delta +$34.00
  ('2500', '2,500 cards',74.86, 6),   -- $249 × 0.34 = $84.66 → delta +$74.80
  ('5000', '5,000 cards',142.00,7)    -- $449 × 0.34 = $152.66 → delta +$142.80
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'paper', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('standard', 'Standard 100lb',  0.00,  1),
  ('premium',  'Premium 130lb',   3.40,  2),  -- +$10 retail → +$3.40
  ('ultra',    'Ultra 18pt',      6.80,  3),  -- +$20 → +$6.80
  ('cotton',   'Cotton 100%',     8.50,  4),  -- +$25 → +$8.50
  ('kraft',    'Kraft Recycled',  5.10,  5),  -- +$15 → +$5.10
  ('pvc',      'Plastic / PVC',   11.90, 6)   -- +$35 → +$11.90
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'thickness', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('14pt', '14pt',          0.00, 1),
  ('16pt', '16pt',          1.70, 2),  -- +$5
  ('18pt', '18pt',          3.40, 3),  -- +$10
  ('32pt', '32pt Ultra',    8.50, 4)   -- +$25
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'finish', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('matte',      'Matte',       0.00, 1),
  ('gloss',      'Gloss',       0.00, 2),
  ('soft-touch', 'Soft Touch',  4.08, 3),  -- +$12
  ('velvet',     'Velvet',      5.10, 4),  -- +$15
  ('satin',      'Satin',       2.72, 5),  -- +$8
  ('silk',       'Silk',        3.40, 6),  -- +$10
  ('uncoated',   'Uncoated',    0.00, 7)
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'corners', v.key, v.label, 0.00, v.s FROM p, (VALUES
  ('square',        'Square',        1),
  ('soft-round',    'Slight Round',  2),
  ('rounded',       'Rounded',       3),
  ('extra-rounded', 'Extra Rounded', 4)
) AS v(key, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'shape', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('rectangle',   'Rectangle',  0.00, 1),
  ('rounded-rect','Rounded Rect',0.00,2),
  ('circle',      'Circle',     3.40, 3),  -- +$10
  ('oval',        'Oval',       2.72, 4),  -- +$8
  ('leaf',        'Leaf',       5.10, 5),  -- +$15
  ('custom',      'Custom',     6.80, 6)   -- +$20
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'sides', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('front', 'Front Only',     0.00, 1),
  ('both',  'Double-Sided',   3.40, 2)   -- +$10
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bc')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'effects', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('foil-gold',       'Gold Foil',        8.50,  1),  -- +$25
  ('foil-silver',     'Silver Foil',      8.50,  2),
  ('foil-rose-gold',  'Rose Gold Foil',   8.50,  3),
  ('foil-copper',     'Copper Foil',      8.50,  4),
  ('foil-holo',       'Holographic Foil', 8.50,  5),
  ('spot-uv',         'Spot UV',          5.10,  6),  -- +$15
  ('raised-spot-uv',  'Raised Spot UV',   6.80,  7),  -- +$20
  ('letterpress',     'Letterpress',      10.20, 8),  -- +$30
  ('edge-painting',   'Edge Painting',    6.12,  9)   -- +$18
) AS v(key, label, delta, s);

-- ─── WALL ART: VARIANTS (sizes) ───────────────────────────
-- base_cost = $79 (16"×16") × 0.34 = $26.86. Delta = size_cost - 26.86.
WITH p AS (SELECT id FROM products WHERE sku = 'wa')
INSERT INTO product_variants (product_id, sku, name, dimension_w, dimension_h, cost_delta, meta, sort_order)
SELECT p.id, v.sku, v.name, v.w, v.h, v.delta, v.meta::jsonb, v.s FROM p, (VALUES
  ('wa-16x16','16" × 16"', 16,16, 0.00, '{"group":"square"}',    1), -- $79 × 0.34 = $26.86 = base
  ('wa-16x24','16" × 24"', 16,24, 3.40, '{"group":"landscape"}', 2), -- $89 × 0.34 = $30.26 → +$3.40
  ('wa-24x24','24" × 24"', 24,24, 6.80, '{"group":"square"}',    3), -- $99 × 0.34 = $33.66 → +$6.80
  ('wa-24x36','24" × 36"', 24,36, 17.00,'{"group":"landscape"}', 4), -- $129 × 0.34 = $43.86 → +$17.00
  ('wa-24x46','24" × 46"', 24,46, 23.80,'{"group":"landscape"}', 5), -- $149 → +$23.80
  ('wa-24x60','24" × 60"', 24,60, 34.00,'{"group":"landscape"}', 6), -- $179 → +$34.00
  ('wa-24x72','24" × 72"', 24,72, 40.80,'{"group":"landscape"}', 7), -- $199 → +$40.80
  ('wa-36x36','36" × 36"', 36,36, 23.80,'{"group":"square"}',    8), -- $149 → +$23.80
  ('wa-36x46','36" × 46"', 36,46, 30.60,'{"group":"landscape"}', 9), -- $169 → +$30.60
  ('wa-36x60','36" × 60"', 36,60, 40.80,'{"group":"landscape"}',10), -- $199 → +$40.80
  ('wa-36x72','36" × 72"', 36,72, 51.00,'{"group":"landscape"}',11), -- $229 → +$51.00
  ('wa-46x46','46" × 46"', 46,46, 40.80,'{"group":"square"}',   12), -- $199 → +$40.80
  ('wa-46x60','46" × 60"', 46,60, 51.00,'{"group":"landscape"}',13), -- $229 → +$51.00
  ('wa-46x72','46" × 72"', 46,72, 61.20,'{"group":"landscape"}',14), -- $259 → +$61.20
  ('wa-60x60','60" × 60"', 60,60, 57.80,'{"group":"square"}',   15), -- $249 → +$57.80
  ('wa-60x72','60" × 72"', 60,72, 75.00,'{"group":"landscape"}',16), -- $299 → +$75.00
  ('wa-72x72','72" × 72"', 72,72, 85.20,'{"group":"square"}',   17)  -- $329 → +$85.20
) AS v(sku, name, w, h, delta, meta, s);

-- ─── WALL ART: OPTIONS ────────────────────────────────────
WITH p AS (SELECT id FROM products WHERE sku = 'wa')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'frameMaterial', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('wood',          'Wood',          0.00,  1),  -- $0 adj
  ('pvc-composite', 'PVC/Composite', -5.10, 2),  -- -$15 adj × 0.34
  ('aluminum',      'Aluminum',      8.50,  3)   -- +$25 adj × 0.34
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'wa')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'frameColor', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('black', 'Black', 0.00, 1),
  ('white', 'White', 1.70, 2),  -- +$5 × 0.34
  ('pecan', 'Pecan', 3.40, 3)   -- +$10 × 0.34
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'wa')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'quantity', v.key, v.label, 0.00, v.s FROM p, (VALUES
  ('1',  '1 print',   1),
  ('2',  '2 prints',  2),
  ('3',  '3 prints',  3),
  ('5',  '5 prints',  4),
  ('10', '10 prints', 5),
  ('15', '15 prints', 6),
  ('20', '20 prints', 7),
  ('25', '25 prints', 8),
  ('50', '50 prints', 9)
) AS v(key, label, s);

-- ─── BANNERS: VARIANTS (sizes) ────────────────────────────
-- base_cost = $29 (2'×4') × 0.34 = $9.86. Delta = size_cost - 9.86.
WITH p AS (SELECT id FROM products WHERE sku = 'bn')
INSERT INTO product_variants (product_id, sku, name, dimension_w, dimension_h, cost_delta, meta, sort_order)
SELECT p.id, v.sku, v.name, v.w, v.h, v.delta, v.meta::jsonb, v.s FROM p, (VALUES
  ('bn-2x4',  "2'×4'",  24,  48,  0.00, '{"group":"vertical"}',   1), -- $29 = base
  ('bn-2x6',  "2'×6'",  24,  72,  5.44, '{"group":"vertical"}',   2), -- $45 → +$5.44
  ('bn-3x6',  "3'×6'",  36,  72,  10.20,'{"group":"vertical"}',   3), -- $59 → +$10.20
  ('bn-4x8',  "4'×8'",  48,  96,  20.40,'{"group":"vertical"}',   4), -- $89 → +$20.40
  ('bn-4x10', "4'×10'", 48,  120, 27.20,'{"group":"vertical"}',   5), -- $109 → +$27.20
  ('bn-6x2',  "6'×2'",  72,  24,  12.24,'{"group":"horizontal"}', 6), -- $65 → +$12.24
  ('bn-8x3',  "8'×3'",  96,  36,  20.40,'{"group":"horizontal"}', 7)  -- $89 → +$20.40
) AS v(sku, name, w, h, delta, meta, s);

-- ─── BANNERS: OPTIONS ─────────────────────────────────────
WITH p AS (SELECT id FROM products WHERE sku = 'bn')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'material', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('vinyl',    '13oz Vinyl',     0.00, 1),
  ('mesh',     '9oz Mesh',       2.72, 2),  -- +$8 × 0.34
  ('blockout', '18oz Blockout',  4.08, 3),  -- +$12 × 0.34
  ('fabric',   'Fabric',         6.12, 4)   -- +$18 × 0.34
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bn')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'finish', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('hemmed',      'Hemmed Edges', 0.00, 1),
  ('grommets',    'Grommets',     1.70, 2),  -- +$5 × 0.34
  ('pole-pocket', 'Pole Pocket',  1.70, 3)   -- +$5 × 0.34
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'bn')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'quantity', v.key, v.label, 0.00, v.s FROM p, (VALUES
  ('1',  '1 banner',   1),
  ('2',  '2 banners',  2),
  ('3',  '3 banners',  3),
  ('5',  '5 banners',  4),
  ('10', '10 banners', 5),
  ('25', '25 banners', 6),
  ('50', '50 banners', 7)
) AS v(key, label, s);

-- ─── RIGID SIGNS: VARIANTS (sizes) ───────────────────────
-- base_cost = $18 (12"×18") × 0.34 = $6.12. Delta = size_cost - 6.12.
WITH p AS (SELECT id FROM products WHERE sku = 'rs')
INSERT INTO product_variants (product_id, sku, name, dimension_w, dimension_h, cost_delta, meta, sort_order)
SELECT p.id, v.sku, v.name, v.w, v.h, v.delta, v.meta::jsonb, v.s FROM p, (VALUES
  ('rs-12x18','12" × 18"', 12,18, 0.00, '{"group":"portrait"}',  1), -- $18 = base
  ('rs-18x24','18" × 24"', 18,24, 3.40, '{"group":"portrait"}',  2), -- $28 → +$3.40
  ('rs-24x36','24" × 36"', 24,36, 9.18, '{"group":"portrait"}',  3), -- $45 → +$9.18
  ('rs-18x12','18" × 12"', 18,12, 0.00, '{"group":"landscape"}', 4), -- $18 = base
  ('rs-24x18','24" × 18"', 24,18, 3.40, '{"group":"landscape"}', 5), -- $28 → +$3.40
  ('rs-36x24','36" × 24"', 36,24, 9.18, '{"group":"landscape"}', 6)  -- $45 → +$9.18
) AS v(sku, name, w, h, delta, meta, s);

-- ─── RIGID SIGNS: OPTIONS ─────────────────────────────────
WITH p AS (SELECT id FROM products WHERE sku = 'rs')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'material', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('coroplast', 'Coroplast',  0.00, 1),
  ('pvc',       'PVC Board',  2.72, 2),  -- +$8 × 0.34
  ('aluminum',  'Aluminum',   5.10, 3)   -- +$15 × 0.34
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'rs')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'quantity', v.key, v.label, 0.00, v.s FROM p, (VALUES
  ('1',   '1 sign',    1),
  ('2',   '2 signs',   2),
  ('3',   '3 signs',   3),
  ('5',   '5 signs',   4),
  ('10',  '10 signs',  5),
  ('25',  '25 signs',  6),
  ('50',  '50 signs',  7),
  ('100', '100 signs', 8)
) AS v(key, label, s);

-- ─── A-FRAME SIGNS: VARIANTS (sizes) ──────────────────────
-- base_cost = $39 (18"×24") × 0.34 = $13.26.
WITH p AS (SELECT id FROM products WHERE sku = 'af')
INSERT INTO product_variants (product_id, sku, name, dimension_w, dimension_h, cost_delta, sort_order)
SELECT p.id, v.sku, v.name, v.w, v.h, v.delta, v.s FROM p, (VALUES
  ('af-18x24','18" × 24"', 18,24, 0.00, 1), -- $39 = base
  ('af-22x28','22" × 28"', 22,28, 3.40, 2), -- $49 → +$3.40
  ('af-24x36','24" × 36"', 24,36, 8.84, 3)  -- $65 → +$8.84
) AS v(sku, name, w, h, delta, s);

-- ─── A-FRAME: OPTIONS ─────────────────────────────────────
WITH p AS (SELECT id FROM products WHERE sku = 'af')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'insertType', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('coroplast', 'Coroplast Insert', 0.00, 1),
  ('pvc',       'PVC Insert',       2.72, 2)  -- +$8 × 0.34
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'af')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'sides', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('single', 'Single-Sided', 0.00, 1),
  ('double', 'Double-Sided', 5.10, 2)  -- +$15 × 0.34
) AS v(key, label, delta, s);

-- ─── FLAGS: VARIANTS (sizes) ──────────────────────────────
-- base_cost = $49 (Feather S) × 0.34 = $16.66.
WITH p AS (SELECT id FROM products WHERE sku = 'fl')
INSERT INTO product_variants (product_id, sku, name, dimension_w, dimension_h, cost_delta, meta, sort_order)
SELECT p.id, v.sku, v.name, v.w, v.h, v.delta, v.meta::jsonb, v.s FROM p, (VALUES
  ('fl-feather-s',  'Feather S',  18, 72,  0.00, '{"shape":"feather"}',  1), -- $49 = base
  ('fl-feather-m',  'Feather M',  18, 96,  3.40, '{"shape":"feather"}',  2), -- $59 → +$3.40
  ('fl-feather-l',  'Feather L',  22, 138, 10.20,'{"shape":"feather"}',  3), -- $79 → +$10.20
  ('fl-feather-xl', 'Feather XL', 24, 168, 17.00,'{"shape":"feather"}',  4), -- $99 → +$17.00
  ('fl-tear-s',     'Teardrop S', 24, 72,  3.40, '{"shape":"teardrop"}', 5), -- $59 → +$3.40
  ('fl-tear-m',     'Teardrop M', 36, 96,  10.20,'{"shape":"teardrop"}', 6), -- $79 → +$10.20
  ('fl-tear-l',     'Teardrop L', 48, 120, 17.00,'{"shape":"teardrop"}', 7)  -- $99 → +$17.00
) AS v(sku, name, w, h, delta, meta, s);

-- ─── FLAGS: OPTIONS ───────────────────────────────────────
WITH p AS (SELECT id FROM products WHERE sku = 'fl')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'base', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('ground-spike', 'Ground Spike', 0.00, 1),
  ('cross-base',   'Cross Base',   4.08, 2),  -- +$12 × 0.34
  ('water-base',   'Water Base',   6.12, 3)   -- +$18 × 0.34
) AS v(key, label, delta, s);

WITH p AS (SELECT id FROM products WHERE sku = 'fl')
INSERT INTO product_options (product_id, option_group, option_key, label, cost_delta, sort_order)
SELECT p.id, 'sides', v.key, v.label, v.delta, v.s FROM p, (VALUES
  ('single', 'Single-Sided', 0.00, 1),
  ('double', 'Double-Sided', 5.10, 2)  -- +$15 × 0.34
) AS v(key, label, delta, s);

-- ─── VISION ART CHART: VARIANTS (print sizes) ────────────
WITH p AS (SELECT id FROM products WHERE sku = 'vac')
INSERT INTO product_variants (product_id, sku, name, dimension_w, dimension_h, cost_delta, sort_order)
SELECT p.id, v.sku, v.name, v.w, v.h, v.delta, v.s FROM p, (VALUES
  ('vac-11x14', '11" × 14"',  11, 14, 0.00,  1),
  ('vac-16x20', '16" × 20"',  16, 20, 4.08,  2),
  ('vac-18x24', '18" × 24"',  18, 24, 8.50,  3),
  ('vac-24x36', '24" × 36"',  24, 36, 17.00, 4)
) AS v(sku, name, w, h, delta, s);
