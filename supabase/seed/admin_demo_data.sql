-- ============================================================
-- controlp.io - Admin dashboard demo data
-- Review-only seed file. Do not run against live Supabase unless
-- you intentionally want demo orders/messages/payments in prod.
-- ============================================================

BEGIN;

DELETE FROM activity_logs
WHERE details->>'source' = 'supabase/seed/admin_demo_data.sql';

DELETE FROM reviews
WHERE id IN ('90000000-0000-4000-8000-000000000001');

DELETE FROM messages
WHERE id IN (
  '80000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000002',
  '80000000-0000-4000-8000-000000000003'
);

DELETE FROM artwork_files
WHERE id IN (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000004'
);

DELETE FROM orders
WHERE order_number LIKE 'CP-DEMO-%';

INSERT INTO product_categories (id, name, slug, description, sort_order, active)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Signs and Banners', 'signs-banners', 'Large-format print products for storefronts, events, and jobsites.', 10, true),
  ('10000000-0000-4000-8000-000000000002', 'Business Essentials', 'business-essentials', 'Cards, flyers, labels, and everyday collateral.', 20, true),
  ('10000000-0000-4000-8000-000000000003', 'Vehicle Graphics', 'vehicle-graphics', 'Decals, magnets, partial wraps, and fleet graphics.', 30, true)
ON CONFLICT (slug) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = excluded.active;

INSERT INTO products (
  id, sku, slug, name, category, description, base_cost, vendor, active,
  short_description, product_type, base_price, status, featured
)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'DEMO-BANNER-13OZ', 'demo-vinyl-banner', 'Vinyl Banner', 'signs-banners', '13oz scrim vinyl banner with hems and grommets.', 42.00, 'in_house', true, 'Durable indoor/outdoor banners.', 'banner', 96.00, 'active', true),
  ('20000000-0000-4000-8000-000000000002', 'DEMO-BC-16PT', 'demo-business-cards', 'Business Cards', 'business-essentials', '16pt matte business cards.', 18.00, '4over', true, 'Classic cards with fast turnaround.', 'business_cards', 49.00, 'active', true),
  ('20000000-0000-4000-8000-000000000003', 'DEMO-YARD-18X24', 'demo-yard-signs', 'Yard Signs', 'signs-banners', '18x24 corrugated plastic signs with stakes.', 24.00, 'b2sign', true, 'Event and campaign yard signs.', 'yard_signs', 89.00, 'active', false),
  ('20000000-0000-4000-8000-000000000004', 'DEMO-FLEET-DECALS', 'demo-fleet-decals', 'Fleet Door Decals', 'vehicle-graphics', 'Laminated vehicle door graphics.', 85.00, 'in_house', true, 'Vehicle-ready decals for teams.', 'vehicle_graphics', 220.00, 'active', true)
ON CONFLICT (sku) DO UPDATE SET
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  base_cost = excluded.base_cost,
  vendor = excluded.vendor,
  active = excluded.active,
  short_description = excluded.short_description,
  product_type = excluded.product_type,
  base_price = excluded.base_price,
  status = excluded.status,
  featured = excluded.featured;

INSERT INTO orders (
  id, order_number, status, payment_status, production_status, company,
  customer_email, customer_phone, subtotal, shipping_cost, tax, total,
  turnaround, due_at, pickup_shipping_method, customer_notes, internal_notes,
  created_at
)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'CP-DEMO-1001', 'file_review', 'paid', 'file_check', 'Sonoran Coffee Co.', 'ops@sonorancoffee.example', '602-555-0141', 384.00, 0.00, 32.64, 416.64, 'rush', now() + interval '1 day', 'pickup', 'Need this for the Friday patio event.', 'Check uploaded logo resolution before proofing.', now() - interval '3 hours'),
  ('30000000-0000-4000-8000-000000000002', 'CP-DEMO-1002', 'proofing', 'pending', 'proof_pending', 'Desert Bloom Realty', 'marketing@desertbloom.example', '480-555-0188', 148.00, 18.00, 14.11, 180.11, 'standard', now() + interval '3 days', 'ship', 'Ship to Scottsdale office.', 'Waiting on customer approval for revised card proof.', now() - interval '9 hours'),
  ('30000000-0000-4000-8000-000000000003', 'CP-DEMO-1003', 'in_production', 'paid', 'printing', 'Mesa Youth Soccer', 'league@mesasoccer.example', '480-555-0199', 625.00, 34.00, 56.02, 715.02, 'standard', now() + interval '2 days', 'ship', 'Split shipment between two fields if possible.', 'B2Sign vendor order should be checked by noon.', now() - interval '1 day'),
  ('30000000-0000-4000-8000-000000000004', 'CP-DEMO-1004', 'awaiting_payment', 'unpaid', 'new', 'Copper State HVAC', 'fleet@copperstate.example', '623-555-0160', 880.00, 0.00, 74.80, 954.80, 'standard', now() + interval '6 days', 'pickup', 'Please include install estimate.', 'Quote approved verbally. Awaiting deposit.', now() - interval '2 days');

INSERT INTO order_items (
  id, order_id, product_id, options, quantity, unit_cost, unit_price,
  line_total, proof_required, created_at
)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '{"size":"4x8","finishing":"hems_grommets"}', 2, 42.00, 192.00, 384.00, true, now() - interval '3 hours'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '{"quantity":"500","paper":"16pt_matte"}', 1, 18.00, 148.00, 148.00, true, now() - interval '9 hours'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '{"size":"18x24","stakes":true}', 50, 4.75, 12.50, 625.00, false, now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', '{"vehicles":"4","laminate":"gloss"}', 4, 85.00, 220.00, 880.00, true, now() - interval '2 days');

INSERT INTO artwork_files (
  id, user_id, order_item_id, order_id, storage_path, bucket, filename,
  mime_type, file_size_bytes, width_px, height_px, dpi, color_mode,
  review_status, proof_version, admin_comments, customer_comments, created_at
)
VALUES
  ('50000000-0000-4000-8000-000000000001', null, '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'demo/sonoran-banner-logo.pdf', 'artwork', 'sonoran-banner-logo.pdf', 'application/pdf', 2840000, 9600, 4800, 150, 'CMYK', 'waiting_for_file_review', 0, 'Needs preflight before proof.', 'Uploaded latest logo file.', now() - interval '2 hours'),
  ('50000000-0000-4000-8000-000000000002', null, '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'demo/desert-bloom-card-front.pdf', 'artwork', 'desert-bloom-card-front.pdf', 'application/pdf', 940000, 1050, 600, 300, 'CMYK', 'proof_sent', 1, 'Proof sent, awaiting approval.', null, now() - interval '8 hours'),
  ('50000000-0000-4000-8000-000000000004', null, '40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 'demo/copper-state-door-decal.ai', 'artwork', 'copper-state-door-decal.ai', 'application/postscript', 5100000, 7200, 3600, 300, 'CMYK', 'needs_changes', 0, 'Missing bleed on passenger side layout.', 'Can revise if needed.', now() - interval '1 day');

INSERT INTO production_jobs (
  id, order_id, order_item_id, status, priority, station, due_at, notes, created_at
)
VALUES
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'file_check', 10, 'Prepress', now() + interval '6 hours', 'Rush proof after preflight.', now() - interval '2 hours'),
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'proof_pending', 30, 'Design', now() + interval '1 day', 'Revision 2 is out to customer.', now() - interval '7 hours'),
  ('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 'printing', 20, 'Vendor queue', now() + interval '1 day', 'Confirm B2Sign tracking after print.', now() - interval '1 day');

INSERT INTO payments (
  id, order_id, user_id, provider, provider_payment_id, method, status,
  amount, currency, notes, received_at, created_at
)
VALUES
  ('70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', null, 'manual', 'DEMO-CASH-1001', 'card_terminal', 'paid', 416.64, 'usd', 'Paid in store.', now() - interval '2 hours', now() - interval '2 hours'),
  ('70000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', null, 'stripe', 'pi_demo_1002', 'card', 'pending', 180.11, 'usd', 'Invoice link sent.', null, now() - interval '8 hours'),
  ('70000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', null, 'stripe', 'pi_demo_1003', 'card', 'paid', 715.02, 'usd', 'Paid online.', now() - interval '1 day', now() - interval '1 day');

INSERT INTO messages (
  id, user_id, order_id, channel, direction, subject, body,
  internal_only, read_at, sent_at, created_at
)
VALUES
  ('80000000-0000-4000-8000-000000000001', null, '30000000-0000-4000-8000-000000000001', 'dashboard', 'inbound', 'Can you check the logo?', 'We uploaded the latest logo. Please let us know if it is print-ready.', false, null, null, now() - interval '90 minutes'),
  ('80000000-0000-4000-8000-000000000002', null, '30000000-0000-4000-8000-000000000002', 'email', 'outbound', 'Proof ready for approval', 'Your revised business card proof is ready.', false, null, now() - interval '8 hours', now() - interval '8 hours'),
  ('80000000-0000-4000-8000-000000000003', null, '30000000-0000-4000-8000-000000000004', 'internal', 'inbound', 'Deposit follow-up', 'Call Copper State HVAC if deposit is not received by 3 PM.', true, null, null, now() - interval '3 hours');

INSERT INTO reviews (
  id, user_id, order_id, product_id, customer_name, company_title,
  rating, review_text, status, featured, created_at
)
VALUES
  ('90000000-0000-4000-8000-000000000001', null, '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Maria Lopez', 'Mesa Youth Soccer', 5, 'Fast turnaround and the signs looked great at the fields.', 'pending', false, now() - interval '4 hours');

INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details, created_at)
SELECT u.id, 'demo_seed_prepared', 'order', '30000000-0000-4000-8000-000000000001', '{"source":"supabase/seed/admin_demo_data.sql"}', now()
FROM users u
WHERE lower(u.email) = 'jw@controlp.io'
LIMIT 1;

COMMIT;
