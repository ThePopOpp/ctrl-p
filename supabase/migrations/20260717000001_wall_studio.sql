-- ============================================================
-- controlp.io — Wall Studio
-- Wall wrap / wallpaper / window film visualizer + pricing + booking.
-- All tables prefixed ws_. RLS enabled; service-role key bypasses all.
-- Writes go through server routes (service role); clients read catalog
-- publicly and read their own commerce rows.
-- ============================================================

-- ─── CATALOG ──────────────────────────────────────────────
create table if not exists ws_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null check (category in ('wallpaper','wall_wrap','window_film')),
  price_per_sqft numeric(8,2) not null,
  install_rate_per_sqft numeric(8,2) not null,
  accent_hex text not null,
  blend_mode text not null default 'multiply' check (blend_mode in ('multiply','normal')),
  repeat_pattern boolean not null default true,
  tile_url text,
  tile_svg text,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists ws_pricing_rules (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- ─── SAVED VISUALIZER SESSIONS (P1 persistence) ───────────
create table if not exists ws_visualizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  product_id uuid references ws_products,
  corners jsonb not null,
  cutouts jsonb not null default '[]',
  wall_w_ft numeric(6,1),
  wall_h_ft numeric(6,1),
  pattern_scale int,
  opacity numeric(3,2),
  snapshot_url text,
  created_at timestamptz default now()
);

-- ─── COMMERCE ─────────────────────────────────────────────
create table if not exists ws_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','cancelled','refunded')),
  contact jsonb not null,
  materials_total numeric(10,2) not null,
  install_included boolean not null default true,
  install_factors jsonb,
  install_lines jsonb,
  install_total numeric(10,2) not null default 0,
  grand_total numeric(10,2) not null,
  payment_ref text,
  created_at timestamptz default now()
);

create table if not exists ws_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references ws_orders on delete cascade,
  product_id uuid references ws_products,
  wall_w_ft numeric(6,1) not null,
  wall_h_ft numeric(6,1) not null,
  billed_sqft numeric(8,1) not null,
  unit_price numeric(8,2) not null,
  line_total numeric(10,2) not null,
  visualization_id uuid references ws_visualizations,
  created_at timestamptz default now()
);

-- ─── BOOKING ──────────────────────────────────────────────
create table if not exists ws_bookings (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  user_id uuid references auth.users,
  order_id uuid references ws_orders,
  name text not null,
  phone text not null,
  address text not null,
  project_type text not null,
  notes text,
  preferred_date date not null,
  time_window text not null,
  status text not null default 'requested'
    check (status in ('requested','confirmed','completed','cancelled')),
  created_at timestamptz default now()
);

create index if not exists ws_order_items_order_id_idx on ws_order_items(order_id);
create index if not exists ws_orders_user_id_idx on ws_orders(user_id);
create index if not exists ws_bookings_user_id_idx on ws_bookings(user_id);
create index if not exists ws_visualizations_user_id_idx on ws_visualizations(user_id);

-- ─── RLS ──────────────────────────────────────────────────
alter table ws_products       enable row level security;
alter table ws_pricing_rules  enable row level security;
alter table ws_visualizations enable row level security;
alter table ws_orders         enable row level security;
alter table ws_order_items    enable row level security;
alter table ws_bookings       enable row level security;

-- Catalog + rules: public read.
create policy "ws_products public read" on ws_products
  for select using (active = true);
create policy "ws_pricing_rules public read" on ws_pricing_rules
  for select using (true);

-- Owner read for commerce/booking rows (writes are server-side/service-role).
create policy "ws_visualizations owner read" on ws_visualizations
  for select using (user_id = auth.uid());
create policy "ws_orders owner read" on ws_orders
  for select using (user_id = auth.uid());
create policy "ws_order_items owner read" on ws_order_items
  for select using (exists (
    select 1 from ws_orders o where o.id = ws_order_items.order_id and o.user_id = auth.uid()
  ));
create policy "ws_bookings owner read" on ws_bookings
  for select using (user_id = auth.uid());

-- ─── SEED: pricing rules (spec §5 v1 constants) ───────────
insert into ws_pricing_rules (key, value) values
  ('min_sqft', '25'::jsonb),
  ('install_base_rates', '{"wallpaper":3.25,"wall_wrap":4.00,"window_film":3.00}'::jsonb),
  ('height_ladder_threshold', '10'::jsonb),
  ('height_ladder_pct', '0.10'::jsonb),
  ('height_lift_threshold', '14'::jsonb),
  ('height_lift_pct', '0.25'::jsonb),
  ('height_lift_flat', '150'::jsonb),
  ('exterior_pct', '0.20'::jsonb),
  ('textured_pct', '0.15'::jsonb),
  ('repair_pct', '0.10'::jsonb),
  ('repair_flat', '120'::jsonb),
  ('removal_per_sqft', '1.25'::jsonb),
  ('cleaning_per_sqft', '0.35'::jsonb),
  ('obstacle_each', '15'::jsonb),
  ('access_flat', '75'::jsonb),
  ('travel_free_miles', '15'::jsonb),
  ('travel_per_mile', '2.00'::jsonb),
  ('rush_pct', '0.25'::jsonb),
  ('rush_window_days', '7'::jsonb),
  ('service_floor', '150'::jsonb)
on conflict (key) do nothing;

-- ─── SEED: 9 designs (inline SVG tiles from the prototype) ─
insert into ws_products (slug, name, category, price_per_sqft, install_rate_per_sqft, accent_hex, blend_mode, repeat_pattern, tile_svg) values
  ('palm','Palm Verde','wallpaper',6.50,3.25,'#2f6b4f','multiply',true,
   '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#e9efe6"/><g stroke="#2f6b4f" stroke-width="3" fill="none" stroke-linecap="round"><path d="M20 100 Q35 60 30 20"/><path d="M30 20 Q10 35 8 55 M30 20 Q45 40 42 62 M28 40 Q12 52 14 70 M29 38 Q46 55 44 74"/><path d="M95 118 Q88 85 96 55"/><path d="M96 55 Q78 66 76 84 M96 55 Q112 72 110 90"/></g></svg>'),
  ('terr','Terrazzo Sol','wallpaper',6.00,3.25,'#c2603d','multiply',true,
   '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#f4ede4"/><g><polygon points="14,18 30,12 26,30" fill="#c2603d"/><polygon points="70,10 86,16 78,32 64,26" fill="#7f8f7a"/><polygon points="100,52 114,48 112,66" fill="#3f5d76"/><polygon points="30,60 48,56 44,76 28,74" fill="#d9b26a"/><polygon points="78,78 94,72 96,90 80,94" fill="#c2603d"/><polygon points="12,96 28,92 24,110" fill="#3f5d76"/><polygon points="54,104 70,100 66,116" fill="#7f8f7a"/><circle cx="58" cy="34" r="4" fill="#3f5d76"/><circle cx="104" cy="106" r="5" fill="#d9b26a"/></g></svg>'),
  ('deco','Deco Arc','wallpaper',7.25,3.25,'#1f3a5f','multiply',true,
   '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#1f3a5f"/><g fill="none" stroke="#d8b25c" stroke-width="2.5"><path d="M0 120 A60 60 0 0 1 120 120"/><path d="M15 120 A45 45 0 0 1 105 120"/><path d="M30 120 A30 30 0 0 1 90 120"/><path d="M45 120 A15 15 0 0 1 75 120"/><path d="M-60 60 A60 60 0 0 1 60 60" transform="translate(0,-60)"/><path d="M60 0 A60 60 0 0 1 180 0" transform="translate(-60,0)"/></g></svg>'),
  ('herr','Herringbone Oak','wallpaper',6.75,3.25,'#8a6240','multiply',true,
   '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#b98d5f"/><g stroke="#8a6240" stroke-width="2" fill="none"><path d="M0 0 L30 30 L60 0 L90 30 L120 0"/><path d="M0 40 L30 70 L60 40 L90 70 L120 40"/><path d="M0 80 L30 110 L60 80 L90 110 L120 80"/></g><g stroke="#caa273" stroke-width="1.4" fill="none"><path d="M0 20 L30 50 L60 20 L90 50 L120 20"/><path d="M0 60 L30 90 L60 60 L90 90 L120 60"/><path d="M0 100 L30 130 M60 100 L30 130 M60 100 L90 130 M120 100 L90 130"/></g></svg>'),
  ('carbon','Carbon Weave','wall_wrap',8.50,4.00,'#2b2b2e','multiply',true,
   '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#232326"/><g fill="#2e2e33"><rect x="0" y="0" width="28" height="13"/><rect x="30" y="15" width="28" height="13"/><rect x="0" y="30" width="28" height="13"/><rect x="30" y="45" width="28" height="13"/></g><g fill="#3a3a41"><rect x="30" y="0" width="28" height="6"/><rect x="0" y="15" width="28" height="6"/><rect x="30" y="30" width="28" height="6"/><rect x="0" y="45" width="28" height="6"/></g></svg>'),
  ('slate','Matte Slate','wall_wrap',8.00,4.00,'#3e4750','multiply',true,
   '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#49525c"/><rect width="200" height="200" fill="#3e4750" opacity=".5"/><g stroke="#565f6a" stroke-width="1" opacity=".6"><path d="M0 66 H200 M0 133 H200 M66 0 V200 M133 0 V200"/></g><g fill="#525b66" opacity=".35"><circle cx="40" cy="30" r="18"/><circle cx="150" cy="90" r="26"/><circle cx="80" cy="170" r="20"/></g></svg>'),
  ('mural','Desert Dusk Mural','wall_wrap',9.75,4.00,'#b4552d','multiply',false,
   '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c46b"/><stop offset=".5" stop-color="#e0784a"/><stop offset="1" stop-color="#8a4a5e"/></linearGradient></defs><rect width="600" height="450" fill="url(#sky)"/><circle cx="300" cy="230" r="80" fill="#fbe3b0" opacity=".85"/><path d="M0 450 L0 340 Q90 300 160 340 T340 330 T600 350 L600 450 Z" fill="#5c3550"/><path d="M0 450 L0 390 Q140 360 260 395 T600 400 L600 450 Z" fill="#3c2440"/><g fill="#3c2440"><path d="M120 340 l0 -55 m0 55 l-22 -30 m22 12 l20 -34" stroke="#3c2440" stroke-width="9" stroke-linecap="round"/></g></svg>'),
  ('fstripe','Frost Stripe','window_film',5.50,3.00,'#6c8ea4','normal',true,
   '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#ffffff" opacity="0"/><g fill="#e9f0f4" opacity=".85"><rect x="0" width="14" height="80"/><rect x="26" width="6" height="80"/><rect x="44" width="14" height="80"/><rect x="70" width="6" height="80"/></g></svg>'),
  ('fdot','Frost Dot','window_film',5.50,3.00,'#58748c','normal',true,
   '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#eef3f6" opacity=".78"/><g fill="#ffffff" opacity=".9"><circle cx="15" cy="15" r="7"/><circle cx="45" cy="15" r="4"/><circle cx="15" cy="45" r="4"/><circle cx="45" cy="45" r="7"/></g></svg>')
on conflict (slug) do nothing;
