-- ============================================================
-- controlp.io — Initial Schema  v1
-- Phase 1 · Gate 1
-- ============================================================

-- ─── EXTENSIONS ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ────────────────────────────────────────────────
CREATE TYPE user_role       AS ENUM ('customer', 'staff', 'admin');
CREATE TYPE order_status    AS ENUM (
  'new', 'proof_pending', 'proof_approved',
  'in_production', 'shipped', 'delivered',
  'cancelled', 'refunded'
);
CREATE TYPE vendor_name     AS ENUM ('in_house', '4over', 'b2sign');
CREATE TYPE turnaround_type AS ENUM ('standard', 'rush', 'sameday');

-- ─── UPDATED_AT TRIGGER FUNCTION ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── USERS ────────────────────────────────────────────────
-- Extends auth.users; one row per authenticated account.
CREATE TABLE users (
  id                 uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              text        NOT NULL,
  full_name          text,
  phone              text,
  role               user_role   NOT NULL DEFAULT 'customer',
  tax_exempt         boolean     NOT NULL DEFAULT false,
  resale_cert_url    text,
  stripe_customer_id text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ADDRESSES ────────────────────────────────────────────
CREATE TABLE addresses (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label                text,
  full_name            text        NOT NULL,
  company              text,
  line1                text        NOT NULL,
  line2                text,
  city                 text        NOT NULL,
  state                text        NOT NULL,
  zip                  text        NOT NULL,
  country              text        NOT NULL DEFAULT 'US',
  is_default_shipping  boolean     NOT NULL DEFAULT false,
  is_default_billing   boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── PRODUCTS ─────────────────────────────────────────────
-- One row per product type (bc, wa, bn, rs, af, fl, vac).
-- base_cost is the floor cost for the cheapest configuration.
-- The pricing engine (lib/pricing/calculate.ts) reads costs and
-- applies the margin tiers to derive retail prices at runtime.
CREATE TABLE products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku         text        UNIQUE NOT NULL,
  slug        text        UNIQUE NOT NULL,
  name        text        NOT NULL,
  category    text        NOT NULL,
  description text,
  base_cost   numeric(10,2) NOT NULL DEFAULT 0,
  vendor      vendor_name   NOT NULL DEFAULT 'in_house',
  active      boolean       NOT NULL DEFAULT true,
  sort_order  int           NOT NULL DEFAULT 0,
  meta        jsonb,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── PRODUCT VARIANTS ─────────────────────────────────────
-- Size / material / finish combinations. Each variant stores
-- a cost_delta added on top of products.base_cost.
-- For quantity-priced products (BC) the quantity option holds
-- the delta; variants represent shape/size only.
CREATE TABLE product_variants (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku          text          NOT NULL,
  name         text          NOT NULL,
  dimension_w  numeric(8,3),
  dimension_h  numeric(8,3),
  cost_delta   numeric(10,2) NOT NULL DEFAULT 0,
  meta         jsonb,
  active       boolean       NOT NULL DEFAULT true,
  sort_order   int           NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  UNIQUE(product_id, sku)
);

-- ─── PRODUCT OPTIONS ──────────────────────────────────────
-- Upsells and configuration choices (quantity, paper, finish,
-- material, effects, hardware, sides, etc.).
-- cost_delta is added to the running unit cost.
CREATE TABLE product_options (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_group text          NOT NULL,
  option_key   text          NOT NULL,
  label        text          NOT NULL,
  cost_delta   numeric(10,2) NOT NULL DEFAULT 0,
  sort_order   int           NOT NULL DEFAULT 0,
  active       boolean       NOT NULL DEFAULT true,
  meta         jsonb,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  UNIQUE(product_id, option_group, option_key)
);

-- ─── PRICING RULES ────────────────────────────────────────
-- Stores the three margin tiers from reference/pricing-strategy.md.
-- calculate.ts reads these at runtime; changes apply to future
-- quotes only (never retroactively to existing orders).
CREATE TABLE pricing_rules (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text          NOT NULL,
  tier_index            int           NOT NULL,
  margin                numeric(5,4)  NOT NULL,
  max_retail            numeric(12,2),          -- NULL = no upper bound (Tier 3)
  quantity_break_tiers  jsonb,                  -- NULL in v1; populated in v2
  category_override     jsonb,                  -- NULL in v1; populated in v2
  active                boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);
CREATE TRIGGER pricing_rules_updated_at
  BEFORE UPDATE ON pricing_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ORDERS ───────────────────────────────────────────────
CREATE TABLE orders (
  id                    uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          text           UNIQUE NOT NULL
                          DEFAULT 'ORD-' || upper(substr(gen_random_uuid()::text, 1, 8)),
  user_id               uuid           REFERENCES users(id) ON DELETE SET NULL,
  status                order_status   NOT NULL DEFAULT 'new',
  shipping_address      jsonb,
  billing_address       jsonb,
  shipping_method       text,
  shipping_cost         numeric(10,2)  NOT NULL DEFAULT 0,
  subtotal              numeric(10,2)  NOT NULL DEFAULT 0,
  turnaround_fee        numeric(10,2)  NOT NULL DEFAULT 0,
  tax                   numeric(10,2)  NOT NULL DEFAULT 0,
  total                 numeric(10,2)  NOT NULL DEFAULT 0,
  coupon_id             uuid,
  discount_amount       numeric(10,2)  NOT NULL DEFAULT 0,
  store_credit_applied  numeric(10,2)  NOT NULL DEFAULT 0,
  stripe_session_id     text,
  stripe_payment_intent_id text,
  turnaround            turnaround_type NOT NULL DEFAULT 'standard',
  notes                 text,
  customer_notes        text,
  created_at            timestamptz    NOT NULL DEFAULT now(),
  updated_at            timestamptz    NOT NULL DEFAULT now()
);
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ORDER ITEMS ──────────────────────────────────────────
-- unit_cost and unit_price are frozen at creation time.
-- Never recalculate pricing after an order is placed.
CREATE TABLE order_items (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       uuid          NOT NULL REFERENCES products(id),
  variant_id       uuid          REFERENCES product_variants(id),
  options          jsonb         NOT NULL DEFAULT '{}',
  quantity         int           NOT NULL DEFAULT 1,
  unit_cost        numeric(10,2) NOT NULL,
  unit_price       numeric(10,2) NOT NULL,
  line_total       numeric(10,2) NOT NULL,
  artwork_file_id  uuid,
  design_draft_id  uuid,
  proof_required   boolean       NOT NULL DEFAULT true,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- ─── ARTWORK FILES ────────────────────────────────────────
CREATE TABLE artwork_files (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES users(id) ON DELETE SET NULL,
  order_item_id    uuid        REFERENCES order_items(id) ON DELETE SET NULL,
  storage_path     text        NOT NULL,
  bucket           text        NOT NULL DEFAULT 'artwork',
  filename         text        NOT NULL,
  mime_type        text        NOT NULL,
  file_size_bytes  bigint      NOT NULL,
  thumbnail_url    text,
  width_px         int,
  height_px        int,
  dpi              int,
  color_mode       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── DESIGN DRAFTS ────────────────────────────────────────
CREATE TABLE design_drafts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES users(id) ON DELETE CASCADE,
  product_id       uuid        NOT NULL REFERENCES products(id),
  title            text,
  state            jsonb       NOT NULL DEFAULT '{}',
  artwork_file_id  uuid        REFERENCES artwork_files(id),
  last_saved_at    timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── PROOFS ───────────────────────────────────────────────
CREATE TABLE proofs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id         uuid        NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  storage_path          text        NOT NULL,
  proof_url             text        NOT NULL,
  revision_number       int         NOT NULL DEFAULT 1,
  sent_at               timestamptz,
  customer_approved_at  timestamptz,
  revisions             jsonb       NOT NULL DEFAULT '[]',
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ─── SHIPMENTS ────────────────────────────────────────────
CREATE TABLE shipments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier                 text,
  tracking_number         text,
  tracking_url            text,
  status                  text,
  shipped_at              timestamptz,
  estimated_delivery_at   timestamptz,
  delivered_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── VENDOR JOBS ──────────────────────────────────────────
CREATE TABLE vendor_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id    uuid        NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  vendor           vendor_name NOT NULL,
  vendor_order_id  text,
  vendor_status    text,
  sync_state       text        NOT NULL DEFAULT 'pending',
  last_synced_at   timestamptz,
  error_message    text,
  raw_response     jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER vendor_jobs_updated_at
  BEFORE UPDATE ON vendor_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SMS MESSAGES ─────────────────────────────────────────
CREATE TABLE sms_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  order_id     uuid        REFERENCES orders(id) ON DELETE SET NULL,
  direction    text        NOT NULL DEFAULT 'outbound',
  to_number    text        NOT NULL,
  from_number  text        NOT NULL,
  body         text        NOT NULL,
  twilio_sid   text,
  status       text,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── EMAIL MESSAGES ───────────────────────────────────────
CREATE TABLE email_messages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES users(id) ON DELETE SET NULL,
  order_id       uuid        REFERENCES orders(id) ON DELETE SET NULL,
  template_name  text        NOT NULL,
  to_email       text        NOT NULL,
  subject        text        NOT NULL,
  resend_id      text,
  status         text,
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── COUPONS ──────────────────────────────────────────────
CREATE TABLE coupons (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text          UNIQUE NOT NULL,
  description     text,
  discount_type   text          NOT NULL,
  discount_value  numeric(10,2) NOT NULL,
  min_order_total numeric(10,2),
  max_uses        int,
  uses_count      int           NOT NULL DEFAULT 0,
  expires_at      timestamptz,
  active          boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- ─── STORE CREDITS ────────────────────────────────────────
CREATE TABLE store_credits (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      numeric(10,2) NOT NULL,
  reason      text,
  order_id    uuid          REFERENCES orders(id) ON DELETE SET NULL,
  expires_at  timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ─── DEFERRED FOREIGN KEYS ────────────────────────────────
ALTER TABLE orders      ADD FOREIGN KEY (coupon_id)       REFERENCES coupons(id)       ON DELETE SET NULL;
ALTER TABLE order_items ADD FOREIGN KEY (artwork_file_id) REFERENCES artwork_files(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD FOREIGN KEY (design_draft_id) REFERENCES design_drafts(id) ON DELETE SET NULL;

-- ─── INDEXES ──────────────────────────────────────────────
CREATE INDEX idx_orders_user_id       ON orders(user_id);
CREATE INDEX idx_orders_status        ON orders(status);
CREATE INDEX idx_orders_created_at    ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_artwork_user_id      ON artwork_files(user_id);
CREATE INDEX idx_design_drafts_user   ON design_drafts(user_id);
CREATE INDEX idx_vendor_jobs_state    ON vendor_jobs(sync_state);
CREATE INDEX idx_shipments_order      ON shipments(order_id);
