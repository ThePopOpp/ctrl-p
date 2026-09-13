-- ============================================================
-- controlp.io — Product Card Builder
-- Capture products from vendor URLs, price them for retail,
-- publish them to the storefront.
-- Spec: docs/features/product-card-builder-chrome-ext/CTRLP-PRODUCT-CARD-BUILDER-SPEC.md
--
-- NAMING — the spec's table names collide with the legacy catalog:
--   spec `product_variants` → `product_card_variants` (legacy product_variants
--                              holds size/material combos for `products`)
--   spec `categories`       → reuses the existing `product_categories` tree,
--                              extended with `tier_id`. Two category trees for
--                              one storefront is a data-integrity trap.
--   spec `captures`         → `product_captures`
--   spec `cost_history`     → `product_cost_history`
-- The legacy `pricing_rules` table (margin bands by retail price) is untouched;
-- `pricing_tiers` below is the card builder's markup layer and is seeded with
-- BOTH the spec's A/B/C markup tiers and tiers equivalent to the margin bands
-- in reference/pricing-strategy.md, so the model can be chosen per category
-- rather than decided in code. See spec open question 4.
--
-- CONFIDENTIALITY — cost, margin and markup must never reach a customer.
-- Enforced three ways: RLS denies anon/authenticated rows that are not
-- published; column-level GRANTs make the cost columns unreachable even to a
-- crafted PostgREST query; and /api/shop/* serves a separate response shape.
-- ============================================================

-- ─── VENDORS ──────────────────────────────────────────────
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  website_url text,
  dealer_portal_url text,
  account_number text,
  requires_login boolean not null default true,
  provides_marketing_assets boolean not null default false,
  default_lead_time_days int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_vendors_domain on vendors (domain) where domain is not null;

-- ─── PRICING TIERS ────────────────────────────────────────
-- Markup applied to captured wholesale cost. Defaults are DATA, not code.
create table if not exists pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  default_markup_pct numeric(6,2) not null,
  default_markup_flat numeric(10,2) not null default 0,
  min_margin_pct numeric(5,2),
  rounding_rule text not null default 'charm_99'
    check (rounding_rule in ('none','nearest_dollar','nearest_five','charm_99','charm_95','round_up_dollar')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Exactly one tier may be the fallback for categories with no tier assigned.
-- The partial predicate limits the index to rows where is_default is true, so
-- every indexed row carries the same value and uniqueness allows only one.
create unique index if not exists idx_pricing_tiers_single_default
  on pricing_tiers (is_default) where is_default;

-- ─── CATEGORIES (extend the existing tree) ────────────────
alter table product_categories
  add column if not exists tier_id uuid references pricing_tiers(id) on delete set null;

-- ─── CAPTURES ─────────────────────────────────────────────
create table if not exists product_captures (
  id uuid primary key default gen_random_uuid(),
  captured_by uuid references users(id) on delete set null,
  source_url text not null,
  vendor_id uuid references vendors(id) on delete set null,
  capture_method text not null check (capture_method in ('extension','headless','manual')),
  status text not null default 'complete' check (status in ('queued','running','complete','failed')),
  error_message text,
  screenshot_path text,
  raw_structured_data jsonb,       -- JSON-LD / OG / microdata, verbatim
  detected_price_table jsonb,      -- parsed quantity/price pairs
  extracted_text text,             -- Tier 4: searchable page text
  extraction_sources jsonb not null default '{}',  -- field -> 'structured'|'dom'|'vision'|'manual'
  draft jsonb,                     -- assembled draft card the panel renders
  created_at timestamptz not null default now()
);

-- ─── PRODUCT CARDS ────────────────────────────────────────
create table if not exists product_cards (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid references product_captures(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  category_id uuid references product_categories(id) on delete set null,

  -- card face
  title text not null,
  subtitle text,
  slug text unique,

  -- content
  description text,                -- CTRL+P written, customer-facing
  captured_description text,       -- vendor original, internal reference only
  spec_table jsonb not null default '{}',

  -- identifiers
  vendor_sku text,
  internal_sku text unique,

  -- pricing rule; null inherits from the category's tier
  markup_pct numeric(6,2),
  markup_flat numeric(10,2),
  rounding_rule text
    check (rounding_rule is null or rounding_rule in
      ('none','nearest_dollar','nearest_five','charm_99','charm_95','round_up_dollar')),
  markup_source text not null default 'tier' check (markup_source in ('tier','card_override')),

  price_unit text not null default 'each'
    check (price_unit in ('each','sq_ft','linear_ft','set','box')),
  lead_time_days int,

  -- publishing
  status text not null default 'draft' check (status in ('draft','ready','published','archived')),
  published_at timestamptz,
  seo_title text,
  seo_description text,

  source_url text,
  cost_captured_at timestamptz,

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── VARIANTS ─────────────────────────────────────────────
-- One spec combination at one quantity. Cost is authoritative; retail is
-- derived and cached. `cached_*` is a read cache, never a source of truth.
create table if not exists product_card_variants (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references product_cards(id) on delete cascade,

  label text,                      -- '500 / 16pt / Gloss'
  quantity numeric(12,2) not null default 1,
  spec jsonb not null default '{}',

  unit_cost numeric(12,4) not null,
  extended_cost numeric(12,2),

  markup_pct numeric(6,2),         -- null inherits from the card
  markup_flat numeric(10,2),

  cached_unit_retail numeric(12,4),
  cached_extended_retail numeric(12,2),
  cached_margin_pct numeric(5,2),

  retail_override numeric(12,2),
  retail_override_reason text,
  retail_override_by uuid references users(id) on delete set null,

  is_default boolean not null default false,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_card_variants_cost_nonneg check (unit_cost >= 0)
);
-- At most one default variant per card.
create unique index if not exists idx_card_variants_single_default
  on product_card_variants (card_id) where is_default;

-- ─── IMAGES ───────────────────────────────────────────────
create table if not exists product_card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references product_cards(id) on delete cascade,
  storage_path text not null,
  caption text,
  alt_text text,
  image_source text not null default 'scraped_reference'
    check (image_source in ('vendor_licensed','own_photo','permission','scraped_reference')),
  source_note text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_card_images_single_primary
  on product_card_images (card_id) where is_primary;

-- ─── PLACEMENT SLOTS ──────────────────────────────────────
-- Registered locations cards can be placed into. Seeded from code; staff
-- assign cards to slots but cannot invent slots.
create table if not exists placement_slots (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  description text,
  surface text not null check (surface in ('storefront','landing','dashboard')),
  audience text not null default 'public' check (audience in ('public','customer','staff')),
  context_type text check (context_type is null or context_type in ('category','card','page')),
  max_items int not null default 1,
  allowed_display_modes text[] not null default '{tile}',
  supports_scheduling boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── CARD PLACEMENTS ──────────────────────────────────────
create table if not exists card_placements (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references product_cards(id) on delete cascade,
  slot_id uuid not null references placement_slots(id) on delete cascade,

  context_id text,                 -- category/card uuid, or a page key for file-based routes
  display_mode text not null default 'tile'
    check (display_mode in ('tile','compact','hero','cta_banner','list_row','spec_highlight')),
  sort_order int not null default 0,

  -- optional per-placement overrides; null falls back to the card
  title_override text,
  subtitle_override text,
  image_override_id uuid references product_card_images(id) on delete set null,
  variant_id uuid references product_card_variants(id) on delete set null,
  cta_label text,
  cta_href text,
  badge_text text,

  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- context_id is nullable, so a plain UNIQUE would let a card be added to a
-- global slot twice. Two partial indexes cover both cases.
create unique index if not exists idx_card_placements_unique_ctx
  on card_placements (card_id, slot_id, context_id) where context_id is not null;
create unique index if not exists idx_card_placements_unique_global
  on card_placements (card_id, slot_id) where context_id is null;

create index if not exists idx_card_placements_resolve
  on card_placements (slot_id, context_id, sort_order) where is_active;

-- ─── COST HISTORY ─────────────────────────────────────────
create table if not exists product_cost_history (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_card_variants(id) on delete cascade,
  old_unit_cost numeric(12,4),
  new_unit_cost numeric(12,4),
  changed_by uuid references users(id) on delete set null,
  change_source text not null default 'manual' check (change_source in ('capture','refresh','manual','import')),
  note text,
  changed_at timestamptz not null default now()
);
create index if not exists idx_cost_history_variant on product_cost_history (variant_id, changed_at desc);

-- ─── INDEXES ──────────────────────────────────────────────
create index if not exists idx_product_cards_status_category on product_cards (status, category_id);
create index if not exists idx_product_cards_slug on product_cards (slug);
create index if not exists idx_product_cards_vendor on product_cards (vendor_id);
create index if not exists idx_card_variants_card on product_card_variants (card_id, sort_order);
create index if not exists idx_card_images_card on product_card_images (card_id, sort_order);
create index if not exists idx_captures_text on product_captures using gin (to_tsvector('english', coalesce(extracted_text, '')));

-- ─── updated_at triggers ──────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'vendors','pricing_tiers','product_cards','product_card_variants',
    'placement_slots','card_placements'
  ] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format(
      'create trigger %I_updated_at before update on %I for each row execute function update_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ─── PUBLISH GUARD ────────────────────────────────────────
-- Blocks publishing a card whose featured image has no legitimate source.
-- The full checklist lives in the API (it can explain what is missing); this
-- is the backstop that a direct SQL write cannot get around.
create or replace function enforce_card_publish_rules()
returns trigger
language plpgsql
as $$
declare
  primary_source text;
begin
  if new.status <> 'published' then
    return new;
  end if;

  if new.slug is null or length(trim(new.slug)) = 0 then
    raise exception 'Cannot publish "%" — a unique slug is required.', new.title
      using errcode = 'check_violation';
  end if;

  if new.description is null or length(trim(new.description)) = 0 then
    raise exception 'Cannot publish "%" — a CTRL+P-written description is required. '
      'Vendor copy cannot be republished verbatim.', new.title
      using errcode = 'check_violation';
  end if;

  select image_source into primary_source
  from product_card_images
  where card_id = new.id and is_primary
  limit 1;

  if primary_source is null then
    raise exception 'Cannot publish "%" — a featured image is required.', new.title
      using errcode = 'check_violation';
  end if;

  if primary_source = 'scraped_reference' then
    raise exception 'Cannot publish "%" — the featured image is a scraped vendor '
      'reference. Replace it with a dealer-licensed asset, your own photo, or an '
      'image you have written permission to use.', new.title
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from product_card_variants
    where card_id = new.id
      and is_available
      and coalesce(retail_override, cached_unit_retail) is not null
  ) then
    raise exception 'Cannot publish "%" — at least one available variant needs a retail price.', new.title
      using errcode = 'check_violation';
  end if;

  if new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists product_cards_publish_guard on product_cards;
create trigger product_cards_publish_guard
  before insert or update on product_cards
  for each row execute function enforce_card_publish_rules();

-- Demoting an image away from a legitimate source must not leave a published
-- card standing on a scraped photo.
create or replace function enforce_image_source_on_published()
returns trigger
language plpgsql
as $$
begin
  if new.is_primary and new.image_source = 'scraped_reference'
     and exists (select 1 from product_cards where id = new.card_id and status = 'published') then
    raise exception 'This card is published — its featured image cannot be a scraped reference.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists card_images_source_guard on product_card_images;
create trigger card_images_source_guard
  before insert or update on product_card_images
  for each row execute function enforce_image_source_on_published();

-- ─── SLOT CAPACITY HELPER ─────────────────────────────────
-- The API enforces max_items so it can name what to remove first; this
-- function is the single source of truth both sides read.
create or replace function slot_fill_count(p_slot_id uuid, p_context_id text, p_exclude uuid default null)
returns int
language sql
stable
as $$
  select count(*)::int
  from card_placements p
  where p.slot_id = p_slot_id
    and p.is_active
    and p.context_id is not distinct from p_context_id
    and (p_exclude is null or p.id <> p_exclude);
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table vendors                enable row level security;
alter table pricing_tiers          enable row level security;
alter table product_captures       enable row level security;
alter table product_cards          enable row level security;
alter table product_card_variants  enable row level security;
alter table product_card_images    enable row level security;
alter table placement_slots        enable row level security;
alter table card_placements        enable row level security;
alter table product_cost_history   enable row level security;

-- Staff: full read. Writes go through server routes on the service-role key,
-- which bypasses RLS entirely — these policies govern direct client reads.
create policy "vendors staff read"        on vendors               for select using (is_staff_or_admin());
create policy "pricing_tiers staff read"  on pricing_tiers         for select using (is_staff_or_admin());
create policy "captures staff read"       on product_captures      for select using (is_staff_or_admin());
create policy "cost_history staff read"   on product_cost_history  for select using (is_staff_or_admin());
create policy "cards staff read"          on product_cards         for select using (is_staff_or_admin());
create policy "variants staff read"       on product_card_variants for select using (is_staff_or_admin());
create policy "images staff read"         on product_card_images   for select using (is_staff_or_admin());
create policy "slots staff read"          on placement_slots       for select using (is_staff_or_admin());
create policy "placements staff read"     on card_placements       for select using (is_staff_or_admin());

-- Public: published cards only.
create policy "cards public read" on product_cards
  for select to anon, authenticated using (status = 'published');

create policy "variants public read" on product_card_variants
  for select to anon, authenticated using (
    is_available and exists (
      select 1 from product_cards c where c.id = product_card_variants.card_id and c.status = 'published'
    )
  );

create policy "images public read" on product_card_images
  for select to anon, authenticated using (exists (
    select 1 from product_cards c where c.id = product_card_images.card_id and c.status = 'published'
  ));

create policy "slots public read" on placement_slots
  for select to anon, authenticated using (is_active and audience = 'public');

create policy "placements public read" on card_placements
  for select to anon, authenticated using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and exists (
      select 1 from placement_slots s
      where s.id = card_placements.slot_id and s.is_active and s.audience = 'public'
    )
    and exists (
      select 1 from product_cards c where c.id = card_placements.card_id and c.status = 'published'
    )
  );

-- Column-level grants. RLS filters ROWS; these filter COLUMNS. Without them a
-- crafted PostgREST request against a published card would return unit_cost.
-- Anything not listed here is unreachable to a customer session, full stop.
revoke select on product_cards        from anon, authenticated;
revoke select on product_card_variants from anon, authenticated;
revoke select on product_card_images  from anon, authenticated;
revoke select on vendors              from anon, authenticated;
revoke select on pricing_tiers        from anon, authenticated;
revoke select on product_captures     from anon, authenticated;
revoke select on product_cost_history from anon, authenticated;

grant select (
  id, category_id, title, subtitle, slug, description, spec_table,
  price_unit, lead_time_days, status, published_at, seo_title, seo_description,
  created_at, updated_at
) on product_cards to anon, authenticated;

grant select (
  id, card_id, label, quantity, spec, cached_unit_retail, cached_extended_retail,
  retail_override, is_default, is_available, sort_order
) on product_card_variants to anon, authenticated;

grant select (
  id, card_id, storage_path, caption, alt_text, sort_order, is_primary
) on product_card_images to anon, authenticated;

-- ============================================================
-- SEED
-- ============================================================

-- Pricing tiers. Two families, both configurable in admin settings:
--   A/B/C   — spec §7.6, markup assigned by category
--   M1/M2/M3 — reference/pricing-strategy.md margin bands, expressed as the
--              equivalent markup (markup = margin / (1 - margin))
insert into pricing_tiers (code, name, description, default_markup_pct, min_margin_pct, rounding_rule, is_default, sort_order)
values
  ('A', 'Commodity',  'Business cards, flyers, standard sizes — heavily price-shopped', 40,  25, 'charm_99', true,  10),
  ('B', 'Standard',   'Banners, signage, standard wide format',                          75,  35, 'charm_99', false, 20),
  ('C', 'Specialty',  'Wall wraps, custom installs, short-run, rush work',              125,  45, 'charm_99', false, 30),
  ('M1', 'Margin band 1 — 66%', 'reference/pricing-strategy.md: under $300 retail',   194.12, 60, 'charm_99', false, 40),
  ('M2', 'Margin band 2 — 50%', 'reference/pricing-strategy.md: $300–$999.99 retail', 100.00, 45, 'charm_99', false, 50),
  ('M3', 'Margin band 3 — 40%', 'reference/pricing-strategy.md: $1,000 and above',     66.67, 35, 'charm_99', false, 60)
on conflict (code) do nothing;

-- Placement slot registry (spec §8.2). Adding a slot = a row here plus a
-- <Slot> call in the page. No schema change.
insert into placement_slots (key, label, description, surface, audience, context_type, max_items, allowed_display_modes, sort_order)
values
  ('home_hero',         'Homepage hero',            'Headline product on the homepage',            'storefront', 'public',   null,       1,  '{hero,cta_banner}',                10),
  ('home_featured',     'Homepage featured grid',   'Curated grid on the homepage',                'storefront', 'public',   null,       8,  '{tile,spec_highlight}',            20),
  ('shop_promoted',     'Shop promoted',            'Pinned above the shop grid',                  'storefront', 'public',   null,       4,  '{tile,spec_highlight}',            30),
  ('category_spotlight','Category spotlight',       'Per-category feature',                        'storefront', 'public',   'category', 3,  '{tile,spec_highlight,compact}',    40),
  ('product_related',   'Related products',         'Related items on a product page',             'storefront', 'public',   'card',     6,  '{tile,compact}',                   50),
  ('product_upsell',    'Product upsell',           'Upgrade prompts on a product page',           'storefront', 'public',   'card',     2,  '{compact,cta_banner}',             60),
  ('landing_cta',       'Landing page CTA',         'Product-backed CTA on a marketing page',      'landing',    'public',   'page',     1,  '{cta_banner,hero}',                70),
  ('landing_grid',      'Landing page grid',        'Product set on a marketing page',             'landing',    'public',   'page',     6,  '{tile,compact}',                   80),
  ('customer_reorder',  'Customer reorder',         'Reorder suggestions in the account dashboard','dashboard',  'customer', null,       6,  '{compact,list_row}',               90),
  ('customer_new',      'New for customers',        'New products for existing customers',         'dashboard',  'customer', null,       4,  '{tile,compact}',                  100),
  ('staff_quick_order', 'Staff quick order',        'Fast-access products for staff quoting',      'dashboard',  'staff',    null,       10, '{list_row,compact}',              110)
on conflict (key) do update set
  label                 = excluded.label,
  description           = excluded.description,
  surface               = excluded.surface,
  audience              = excluded.audience,
  context_type          = excluded.context_type,
  max_items             = excluded.max_items,
  allowed_display_modes = excluded.allowed_display_modes,
  sort_order            = excluded.sort_order;

-- Known suppliers. Both are reseller partners with dealer portals — see
-- reference/vendors.md. Capture is staff-initiated on pages they are already
-- authenticated to; there is no crawler and no stored portal credential.
insert into vendors (name, domain, website_url, requires_login, provides_marketing_assets, notes)
values
  ('4Over',  '4over.com',  'https://www.4over.com',  true, true,  'Reseller partner — business cards, flyers, postcards, apparel, yard signs.'),
  ('B2Sign', 'b2sign.com', 'https://www.b2sign.com', true, true,  'Reseller partner — banners, signs, trade show displays.'),
  ('In-house', null, null, false, true, 'Vehicle wraps, specialty large format, rush/local jobs.')
on conflict do nothing;
