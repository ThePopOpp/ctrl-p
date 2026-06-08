-- ============================================================
-- controlp.io — Expand Product Catalog
-- 2026-06-08
--
-- 1. Ensure all existing products are active with base_price set
-- 2. Add expanded product lineup matching controlp.io / VistaPrint structure
-- 3. Populate sizes, materials, print_options, tagline, description
-- ============================================================

-- ─── UPDATE EXISTING PRODUCTS WITH base_price ─────────────
-- Formula: base_price = base_cost / 0.34 (Tier 1, 66% margin), rounded to nearest $0.05
UPDATE products SET
  active     = true,
  status     = 'active',
  base_price = ROUND((base_cost / 0.34) / 0.05) * 0.05,
  tagline    = CASE sku
    WHEN 'bc'  THEN 'Premium business cards that leave a lasting impression'
    WHEN 'wa'  THEN 'Turn your photos and designs into stunning wall art'
    WHEN 'bn'  THEN 'Eye-catching banners for any event or promotion'
    WHEN 'rs'  THEN 'Durable rigid signs for indoor and outdoor use'
    WHEN 'af'  THEN 'Double-sided A-frame signs for storefronts and events'
    WHEN 'fl'  THEN 'Bold flags and feather banners to stand out from the crowd'
    WHEN 'vac' THEN 'Custom vision art charts for eye care professionals'
    ELSE tagline
  END,
  sizes      = CASE sku
    WHEN 'bc'  THEN '["3.5\"×2\" Standard","2.5\"×2.5\" Square","3.5\"×1.75\" Slim","2.5\"×1.5\" Mini","3.35\"×2.17\" Euro","2\"×7\" Bookmark"]'::jsonb
    WHEN 'bn'  THEN '["2''×4''","2''×6''","2''×8''","3''×6''","3''×8''","4''×8''","4''×10''","5''×10''","6''×12''"]'::jsonb
    WHEN 'rs'  THEN '["12\"×18\"","18\"×24\"","24\"×24\"","24\"×36\"","36\"×24\"","36\"×48\""]'::jsonb
    WHEN 'af'  THEN '["18\"×24\"","24\"×24\"","24\"×36\""]'::jsonb
    WHEN 'fl'  THEN '["Small (11.5\"×35\")","Medium (14\"×48\")","Large (16\"×55\")","XL (18\"×72\")"]'::jsonb
    WHEN 'wa'  THEN '["16\"×16\"","18\"×24\"","24\"×24\"","24\"×36\"","36\"×36\"","48\"×48\"","48\"×72\""]'::jsonb
    ELSE sizes
  END,
  materials  = CASE sku
    WHEN 'bc'  THEN '["Standard 100lb","Premium 130lb","Ultra 18pt","Cotton 100%","Kraft Recycled","Plastic / PVC"]'::jsonb
    WHEN 'bn'  THEN '["Standard Vinyl","Heavy-Duty Vinyl","Mesh Vinyl","Blockout Vinyl"]'::jsonb
    WHEN 'rs'  THEN '["Coroplast 4mm","PVC 3mm","Aluminum Composite"]'::jsonb
    WHEN 'af'  THEN '["Coroplast 4mm","PVC 3mm"]'::jsonb
    WHEN 'fl'  THEN '["Knitted Polyester","Dye-Sublimated Fabric"]'::jsonb
    WHEN 'wa'  THEN '["Wood Frame","PVC Frame","Aluminum Frame"]'::jsonb
    ELSE materials
  END,
  print_options = CASE sku
    WHEN 'bc'  THEN '["Matte","Gloss","Satin","Soft-Touch","Raised UV","Foil (Gold/Silver)"]'::jsonb
    WHEN 'bn'  THEN '["Single-Sided","Double-Sided","Grommets","No Grommets","Hemmed Edges","Pole Pocket Top","Pole Pocket Bottom"]'::jsonb
    WHEN 'rs'  THEN '["Single-Sided","Double-Sided"]'::jsonb
    ELSE print_options
  END
WHERE sku IN ('bc','wa','bn','rs','af','fl','vac');

-- ─── NEW PRODUCTS ──────────────────────────────────────────
INSERT INTO products (
  sku, slug, name, category, base_cost, base_price, vendor,
  active, status, sort_order, tagline, sizes, materials, print_options
) VALUES

-- ── BANNERS ──────────────────────────────────────────────
('vb', 'vinyl-banners', 'Vinyl Banners', 'banners', 9.86, 29.00, 'b2sign',
  true, 'active', 10,
  'Weather-resistant vinyl banners for indoor and outdoor use',
  '["2''×4''","2''×6''","2''×8''","3''×6''","3''×8''","4''×8''","4''×10''","5''×10''","6''×12''","Custom Size"]'::jsonb,
  '["Standard 13oz Vinyl","Heavy-Duty 18oz Vinyl","Mesh Vinyl (Wind-Resistant)","Blockout Vinyl (No Light Bleed)"]'::jsonb,
  '["Single-Sided","Double-Sided","Metal Grommets","Pole Pocket Top","Pole Pocket Bottom","Hemmed & Stitched Edges","No Finishing"]'::jsonb
),

('mb', 'mesh-banners', 'Mesh Banners', 'banners', 12.00, 35.30, 'b2sign',
  true, 'active', 11,
  'Wind-resistant mesh banners ideal for fences and outdoor structures',
  '["2''×4''","3''×6''","3''×8''","4''×8''","5''×10''","6''×12''","Custom Size"]'::jsonb,
  '["60% Mesh Vinyl (Light Wind-Through)","80% Mesh Vinyl (Heavy-Duty)"]'::jsonb,
  '["Single-Sided","Metal Grommets","Hemmed Edges","Pole Pocket"]'::jsonb
),

('srb', 'step-repeat-banner', 'Step & Repeat Banner', 'banners', 68.00, 200.00, 'b2sign',
  true, 'active', 12,
  'Red-carpet style backdrop banners for events and photo opportunities',
  '["4''×8''","6''×8''","8''×8''","8''×10''","10''×10''","10''×12''","Custom Size"]'::jsonb,
  '["Standard 13oz Vinyl","Heavy-Duty 18oz Vinyl"]'::jsonb,
  '["Single-Sided","Metal Grommets","Hemmed Edges"]'::jsonb
),

-- ── DISPLAYS ─────────────────────────────────────────────
('rb', 'retractable-banner-stands', 'Retractable Banner Stands', 'displays', 45.00, 132.35, 'b2sign',
  true, 'active', 20,
  'Professional pull-up banner stands — fast setup, easy transport',
  '["24\"×63\"","33\"×78\"","36\"×78\"","47\"×78\""]'::jsonb,
  '["Economy Aluminum Stand","Premium Aluminum Stand","Heavy-Duty Steel Stand"]'::jsonb,
  '["Single-Sided Print","Glossy Laminate","Matte Laminate"]'::jsonb
),

('tfd', 'tension-fabric-display', 'Tension Fabric Display', 'displays', 55.00, 161.75, 'b2sign',
  true, 'active', 21,
  'Lightweight fabric displays with wrinkle-free, vibrant graphics',
  '["8ft Straight","10ft Straight","8ft Curved","10ft Curved","20ft Straight"]'::jsonb,
  '["Dye-Sublimated Fabric","Blockout Fabric (No Light-Through)"]'::jsonb,
  '["Full-Color Print","Single-Sided","Double-Sided (Blockout)"]'::jsonb
),

('pbs', 'pole-banner-set', 'Pole Banner Set', 'displays', 35.00, 103.00, 'b2sign',
  true, 'active', 22,
  'Street pole banners with mounting brackets for storefronts and events',
  '["12\"×36\"","18\"×48\"","18\"×60\"","24\"×60\"","24\"×72\""]'::jsonb,
  '["Premium Knitted Polyester","Heavy-Duty Vinyl"]'::jsonb,
  '["Double-Sided Print","Pole Pocket Top & Bottom","Single-Sided Print"]'::jsonb
),

('xs', 'x-stand-banner', 'X-Stand Banner', 'displays', 22.00, 64.70, 'b2sign',
  true, 'active', 23,
  'Lightweight X-frame banner stands for trade shows and retail',
  '["24\"×63\"","24\"×70\"","32\"×70\""]'::jsonb,
  '["Matte Paper / Polypropylene","Glossy Film"]'::jsonb,
  '["Single-Sided Print"]'::jsonb
),

('td', 'tabletop-display', 'Tabletop Display', 'displays', 18.00, 52.95, 'b2sign',
  true, 'active', 24,
  'Compact tabletop banner stands perfect for counters and trade show tables',
  '["11.5\"×17\"","11.5\"×23\"","11.5\"×28\""]'::jsonb,
  '["Economy Stand","Premium Aluminum Stand"]'::jsonb,
  '["Single-Sided Print","Matte Finish","Glossy Finish"]'::jsonb
),

('pud', 'pop-up-display', 'Pop-Up Display', 'displays', 120.00, 352.95, 'b2sign',
  true, 'active', 25,
  'Curved pop-up trade show displays with magnetic locking frame',
  '["8ft Curved (6 panels)","10ft Curved (8 panels)","20ft Curved (12 panels)"]'::jsonb,
  '["Dye-Sublimated Fabric","High-Res Vinyl Graphics"]'::jsonb,
  '["Full-Color Print","Backlit Option","Standard (Front-Lit)"]'::jsonb
),

-- ── SIGNAGE ──────────────────────────────────────────────
('ys', 'yard-signs', 'Yard Signs', 'signage', 8.00, 23.55, 'b2sign',
  true, 'active', 30,
  'Durable corrugated plastic yard signs with wire stakes',
  '["12\"×18\"","18\"×24\"","24\"×24\"","24\"×36\"","36\"×48\""]'::jsonb,
  '["Corrugated Plastic 4mm","Corrugated Plastic 6mm (Heavy-Duty)"]'::jsonb,
  '["Single-Sided","Double-Sided","With H-Stake","Without H-Stake"]'::jsonb
),

('fbs', 'foam-board-signs', 'Foam Board Signs', 'signage', 12.00, 35.30, 'b2sign',
  true, 'active', 31,
  'Lightweight foam board signs for events, retail, and office use',
  '["11\"×17\"","18\"×24\"","22\"×28\"","24\"×36\"","36\"×48\""]'::jsonb,
  '["Standard Foam Board 5mm","Gatorboard 3/16\" (Rigid)","PVC-Free Board 3mm"]'::jsonb,
  '["Single-Sided","Full-Color UV Print","Matte Finish","Glossy Finish"]'::jsonb
),

-- ── PRINT ────────────────────────────────────────────────
('utbc', 'ultra-thick-business-cards', 'Ultra Thick Business Cards', 'print', 16.00, 47.05, 'in_house',
  true, 'active', 2,
  '32pt ultra-thick cardstock — as thick as a credit card',
  '["3.5\"×2\" Standard"]'::jsonb,
  '["32pt Ultra-Thick Cardstock"]'::jsonb,
  '["Gloss UV Front / Matte Back","Matte Both Sides","Raised Spot UV","Gold Foil Accent","Silver Foil Accent"]'::jsonb
),

('diebc', 'die-cut-business-cards', 'Die-Cut Business Cards', 'print', 18.00, 52.95, 'in_house',
  true, 'active', 3,
  'Stand-out custom-shape business cards with premium finishes',
  '["Rounded Corners","Circle (2\"×2\")","Oval","Leaf","Ticket","House Shape","Custom Shape"]'::jsonb,
  '["16pt Cardstock","18pt Cardstock","32pt Ultra-Thick"]'::jsonb,
  '["Matte","Gloss","Soft-Touch","Raised UV","Gold Foil","Silver Foil"]'::jsonb
)

ON CONFLICT (slug) DO UPDATE SET
  active        = EXCLUDED.active,
  status        = EXCLUDED.status,
  base_price    = EXCLUDED.base_price,
  tagline       = EXCLUDED.tagline,
  sizes         = EXCLUDED.sizes,
  materials     = EXCLUDED.materials,
  print_options = EXCLUDED.print_options;

-- ─── PRODUCT CATEGORIES ───────────────────────────────────
INSERT INTO product_categories (name, slug, description, sort_order, active) VALUES
  ('Banners',           'banners',   'Vinyl, mesh, fabric, and step-repeat banners',        1,  true),
  ('Signs & Yard Signs','signage',   'Coroplast, foam board, A-frame, and rigid signs',     2,  true),
  ('Displays & Stands', 'displays',  'Retractable, tension fabric, pop-up, and tabletop',  3,  true),
  ('Business Cards',    'print',     'Standard, ultra-thick, and die-cut business cards',   4,  true),
  ('Flags',             'flags',     'Feather flags, teardrop flags, and pole banners',     5,  true),
  ('Wall Art',          'wall-art',  'Framed prints, canvas, and custom wall art',          6,  true)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order  = EXCLUDED.sort_order,
  active      = EXCLUDED.active;
