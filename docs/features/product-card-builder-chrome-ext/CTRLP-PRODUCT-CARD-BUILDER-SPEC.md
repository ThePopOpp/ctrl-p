# Product Card Builder — Build Spec

**Company:** Control P / CTRL+P — controlp.io
**Feature:** Capture products from any vendor URL, price them for retail, publish them to the storefront
**Stack:** Next.js 15 / React 19 / ShadCN UI / Supabase / Coolify VPS

---

## 1. Overview

Control P sources printed goods from wholesale vendors. Today, getting a vendor's product into the CTRL+P catalog means manually copying a title, saving an image, retyping specs, looking up cost, doing markup math, and building a product page by hand. It is slow enough that the catalog stays smaller than it should be.

This feature collapses that into a few clicks.

A staff member visits any vendor product page. A capture tool reads the page, pulls out the product's title, image, specifications, and wholesale cost, and produces a draft **Product Card**. Staff review it, set or accept the markup, and save. The card becomes a real catalog item that can be published to the CTRL+P shop, rendered as its own product page, featured on marketing pages, and managed from the dashboard.

The system has three surfaces:

| Surface | Who uses it | What it does |
|---|---|---|
| **Capture** | Staff, on vendor sites | Reads a page, builds a draft card |
| **Manage** | Staff, in the dashboard | Review, price, organize, publish |
| **Publish** | Customers, on controlp.io | Shop grid, product pages, featured cards |

---

## 2. What a Product Card is

A Product Card is the single record that represents one sellable item. The same record drives the dashboard row, the shop tile, the product page, and any quote line that references it.

**Card face** — what shows in a grid tile:

- Featured image
- Title
- Subtitle (short descriptor: size, stock, or key spec)
- Price — starting-at price when the product has multiple variants
- Category badge
- **More** button

**Modal** — what opens when More is clicked:

- Image carousel, all images
- Full description
- Specification table (material, dimensions, finish, sides, turnaround)
- Variant/quantity pricing table
- Lead time
- Internal-only section, visible to staff only: vendor, vendor SKU, wholesale cost, margin, source URL, capture date

The modal is where detail lives. Keep the tile lean — image, title, subtitle, price, More. Nothing else earns its place in a grid.

---

## 3. End-to-end journey

1. Staff member is browsing a vendor's site and finds a product worth carrying
2. They click the CTRL+P extension icon — a panel opens alongside the page
3. The tool reads the page and pre-fills a draft: title, images, specs, cost, quantity breaks
4. Staff hovers the page to highlight and confirm regions if anything was missed, and can drag-select a specific area to capture as an image
5. The draft appears as an editable form — every field correctable
6. Staff assigns a category. The category's pricing tier auto-applies a markup, and retail price calculates live
7. Staff adjusts markup by percentage or flat dollar amount if this product warrants it
8. Save → the card lands in the dashboard as a **Draft**
9. In the dashboard, staff finish the retail-facing content: rewritten description, SEO title and slug, chosen featured image
10. Staff toggle **Publish** → the card appears in the shop and gets its own product page at `/shop/[slug]`

Steps 1–8 should take under two minutes. Steps 9–10 are a deliberate separate pass, because what gets captured from a vendor is not what should be published to customers — see section 9.

---

## 4. Capture architecture

### 4.1 Why a Chrome extension

Capturing from *any* URL means running on pages Control P does not control. A web app cannot reach into a third-party page — vendor sites send `X-Frame-Options: DENY` or a CSP `frame-ancestors` directive, which blocks embedding them in an iframe. There is no workaround worth building.

A Chrome extension runs *inside* the page. It has DOM access, can read structured data, can highlight elements on hover, and can screenshot the viewport. This is the only architecture that delivers "works on any site."

### 4.2 Extension components

**Manifest V3**, with this permission set:

```json
{
  "manifest_version": 3,
  "name": "CTRL+P Product Capture",
  "permissions": ["activeTab", "scripting", "sidePanel", "storage", "cookies"],
  "host_permissions": ["https://controlp.io/*"],
  "background": { "service_worker": "background.js" },
  "side_panel": { "default_path": "panel.html" },
  "action": { "default_title": "Capture product" }
}
```

`activeTab` grants access to the current page only when the user clicks the toolbar icon. Requesting `<all_urls>` instead would trigger an alarming install warning and heavier Web Store review, for no benefit — click-to-activate is the intended interaction anyway.

The `cookies` permission plus the controlp.io host permission lets the extension read the existing Supabase session, so staff are not signing in twice.

**Side panel (`chrome.sidePanel`, Chrome 114+)** hosts the capture and review UI. This is a native Chrome panel living outside the page's DOM, which means vendor CSS cannot touch your ShadCN styling and yours cannot leak into theirs. Build this as a small React app sharing components with the main dashboard.

**Content script** handles only the on-page interaction:
- `document.elementFromPoint()` on mousemove to identify the hovered element
- `getBoundingClientRect()` to position a highlight outline
- Click to select; Escape to cancel
- Drag to define a custom capture region
- Reads structured data and DOM content, posts it to the panel via `chrome.runtime.sendMessage`

Anything injected into the page must be inside a **Shadow DOM** with its styles scoped inside the shadow root. Without this, vendor stylesheets will break your overlay on roughly half of all sites.

**Service worker** performs `chrome.tabs.captureVisibleTab()`, which content scripts cannot call. It returns a data URL of the visible viewport.

### 4.3 Screenshot gotchas

Both of these will silently produce wrong output if missed:

- `captureVisibleTab` captures at the device pixel ratio. Multiply the element's bounding rect by `window.devicePixelRatio` before cropping, or every capture will be offset and mis-sized on any retina display.
- MV3 service workers have no DOM, so no `<canvas>` for cropping. Do the crop in the side panel context, or use the `chrome.offscreen` API.

### 4.4 Web app fallback

Staff paste a URL into the dashboard. A Playwright job on the VPS loads the page, screenshots it, and runs the same extraction pipeline. No extension install needed.

**This path cannot see wholesale cost on gated vendors.** Most trade printers show dealer pricing only to authenticated accounts, and a headless browser on your server is not authenticated. Use this path for:

- Public retail pages where cost is not gated
- Competitor price research
- Re-capturing product content when cost is already known

Label it clearly in the UI so staff understand why a price came back empty. Do not store vendor portal credentials in the app to work around this — the extension borrows the staff member's live browser session, which is both simpler and safer.

---

## 5. Extraction pipeline

Run four tiers, highest confidence first, and record which tier supplied each field.

**Tier 1 — Structured markup.** Most commercial product pages publish `schema.org/Product` as JSON-LD in a `<script type="application/ld+json">` tag, giving exact `name`, `sku`, `brand`, `offers.price`, `offers.priceCurrency`, and `image`. Also read Open Graph tags (`og:title`, `og:image`, `og:description`) and microdata attributes. When this tier hits, you have near-perfect data with no inference.

**Tier 2 — Targeted DOM parsing.** Price tables are the high-value target. When a `<table>` appears in the product region, parse it for quantity/price pairs — this captures eight quantity breaks in one click instead of eight separate captures. Also pull `<img>` sources at their highest available resolution, spec lists from `<dl>` and `<ul>` elements, and any select/option sets that indicate product configuration.

**Tier 3 — Vision extraction.** Send the screenshot to a vision model with a strict JSON schema for whatever Tier 1 and 2 did not supply. This handles canvas-rendered content, configurator widgets, and sites with no semantic markup. Instruct it to return `null` for fields it cannot see rather than guessing, and to report per-field confidence. **Never let it invent a price.**

**Tier 4 — Text layer.** Store the full extracted page text on the capture record. This is not for field mapping — it makes captures searchable later and lets staff copy spec details the structured passes missed.

Every field in the review form shows a small badge indicating its source: *verified* (Tier 1–2), *extracted* (Tier 3), or *manual*. A price marked *extracted* should be visually distinct, because acting on a vision-inferred cost without checking it is how margin quietly disappears.

Staff review is mandatory. Treat all extraction output as a draft, never as final.

---

## 6. Variants and quantity pricing

Print products do not have one price. A business card has a price for every combination of quantity, stock, finish, and sides. A single price field cannot represent this.

Model each card as having **variants** — one spec combination at one quantity, each with its own cost and derived retail.

| Qty | Stock | Finish | Cost | Retail |
|---|---|---|---|---|
| 250 | 14pt | Matte | $18.00 | $25.99 |
| 500 | 14pt | Matte | $24.00 | $33.99 |
| 1000 | 14pt | Matte | $34.00 | $47.99 |
| 500 | 16pt | Gloss | $31.00 | $43.99 |

The card's displayed price on a shop tile is the lowest variant retail, shown as "from $25.99". One variant is flagged `is_default` and pre-selects on the product page.

**Units matter.** Wide format and wall products price per square foot; cards and flyers price per piece; some products price per set or per box. The `price_unit` field determines what the stored number means. Show unit price and extended price separately — never mix units in one field.

---

## 7. Pricing and markup

### 7.1 Cost is not retail

The captured price is **wholesale cost**. Retail is derived from it. Store cost and the markup rule that produced retail; cache computed retail for query speed but recompute whenever cost or a rule changes.

Cost, margin, and markup rules are confidential. They must never reach a customer-facing surface. Enforce this in RLS policies and use separate API response shapes for internal versus public views — do not rely on the frontend to omit fields.

### 7.2 Markup and margin are different numbers

- **Markup %** measures against cost: `retail = cost × (1 + markup/100)`
- **Margin %** measures against retail: `margin = (retail − cost) / retail × 100`

A 50% markup yields a 33.3% margin. Achieving a 50% margin requires a 100% markup. Confusing these is the most common and most expensive mistake in a pricing feature.

**The UI must display both, always, live-linked.** Staff type into whichever they think in; the other updates instantly.

Test cases:

| Cost | Markup % | Retail | Margin % |
|---|---|---|---|
| $10.00 | 50% | $15.00 | 33.3% |
| $10.00 | 100% | $20.00 | 50.0% |
| $10.00 | 150% | $25.00 | 60.0% |
| $42.50 | 65% | $70.13 | 39.4% |

### 7.3 Calculation order

Fixed and explicit:

```
base     = cost × (1 + markup_pct / 100)
withFlat = base + markup_flat
retail   = applyRounding(withFlat, rounding_rule)
retail   = applyGuards(retail, cost, min_margin_pct)
```

Percentage applies to cost first, then flat dollars are added, then rounding, then guards. Negative values are valid — that is how a loss leader or promotional price is expressed.

### 7.4 Rounding

| Rule | $70.13 → |
|---|---|
| `none` | 70.13 |
| `nearest_dollar` | 70.00 |
| `nearest_five` | 70.00 |
| `charm_99` | 70.99 |
| `charm_95` | 70.95 |
| `round_up_dollar` | 71.00 |

Charm rules always round **up** to the next charm point. Rounding down silently eats margin on every unit sold.

### 7.5 Guards

- **Never below cost** — hard block, reject the save with an explanation
- **Minimum margin floor** — configurable per tier; warn and require an explicit override note
- **Sanity ceiling** — flag markup above 500% as a likely data entry error; warn, do not block

### 7.6 Pricing tiers

Three margin tiers, assigned by category:

| Tier | Applies to | Default markup |
|---|---|---|
| **A — Commodity** | Business cards, flyers, standard sizes — heavily price-shopped | 40% |
| **B — Standard** | Banners, signage, standard wide format | 75% |
| **C — Specialty** | Wall wraps, custom installs, short-run, rush work | 125% |

These defaults are configurable in settings, not hardcoded. Every category maps to a tier, every card inherits its category's tier, and any card or variant can override. Always show where the current rule came from — *Tier B default* or *Card override* — so nobody wonders why two similar products priced differently.

### 7.7 The markup control

This is the widget the whole feature turns on. One row, four linked values:

```
Cost        Markup %      Margin %      Retail
$42.50   →  [  65  ]  ↔  [ 39.4 ]  →   $70.13  →  rounds to  $70.99
```

- Cost is read-only here; it comes from capture
- Markup and margin are both editable and drive each other
- Retail shows pre-rounding and post-rounding
- A toggle switches to flat-dollar mode: `Cost + $[27.63] = $70.13`
- A caption below shows the rule's source
- Margin below the tier floor turns the field amber with the floor value displayed

**Bulk markup changes require a preview.** Multi-select cards, apply a change, and show a before/after table of retail and margin for every affected variant before committing. Repricing a whole category without seeing the result first is how products quietly go out wrong.

---

## 8. Publishing and placement

Two separate concepts, and keeping them separate is what makes this flexible:

- **Status** is whether a card is allowed to be public at all — a lifecycle gate
- **Placement** is where a card actually appears — which pages, which sections, in what order

A card can be Published and appear nowhere. A card can be Published and appear in six places. Publishing does not imply placement, and placement is never automatic.

### 8.1 Status lifecycle

**Draft → Ready → Published → Archived**

Capture produces a Draft. Moving to Published requires passing the publish checklist (8.6). Archiving removes a card from every public placement immediately but preserves its history and any quotes referencing it.

### 8.2 Slots

A **slot** is a named, registered location where cards can be placed. Slots are defined in code and seeded into the database — staff assign cards to slots, but they cannot invent slots. This is deliberate: free-form placement produces orphaned records pointing at page sections that no longer exist.

Each slot declares what it is and what it accepts:

| Field | Purpose |
|---|---|
| `key` | Stable identifier used by the frontend — `home_hero`, `shop_promoted` |
| `label` | Human name shown in the dashboard |
| `surface` | `storefront` \| `landing` \| `dashboard` |
| `audience` | `public` \| `customer` \| `staff` |
| `max_items` | Hard cap; a hero holds one, a grid holds eight |
| `allowed_display_modes` | Which renderings are valid here |
| `context_type` | `null` for global slots, or `category` / `card` for repeating ones |
| `supports_scheduling` | Whether date windows apply |

Starter slot registry:

| Key | Surface | Audience | Max | Purpose |
|---|---|---|---|---|
| `home_hero` | storefront | public | 1 | Homepage headline product |
| `home_featured` | storefront | public | 8 | Homepage curated grid |
| `shop_promoted` | storefront | public | 4 | Pinned above the shop grid |
| `category_spotlight` | storefront | public | 3 | Per-category feature (context: category) |
| `product_related` | storefront | public | 6 | Related items on a product page (context: card) |
| `product_upsell` | storefront | public | 2 | Upgrade prompts on a product page (context: card) |
| `landing_cta` | landing | public | 1 | Product-backed CTA on a marketing page (context: page) |
| `landing_grid` | landing | public | 6 | Product set on a marketing page (context: page) |
| `customer_reorder` | dashboard | customer | 6 | Reorder suggestions in the account dashboard |
| `customer_new` | dashboard | customer | 4 | New products for existing customers |
| `staff_quick_order` | dashboard | staff | 10 | Fast-access products for staff quoting |

Add slots by adding registry entries and a `<Slot>` call in the corresponding page. No schema change needed.

### 8.3 Display modes

The same card renders differently depending on where it lands. A placement chooses one:

| Mode | Renders as |
|---|---|
| `tile` | Standard grid card — image, title, subtitle, from-price, More |
| `compact` | Small horizontal row — thumbnail, title, price |
| `hero` | Full-width — large image, headline treatment, prominent CTA |
| `cta_banner` | Copy-led band with product image and a single action |
| `list_row` | Dense text row for dashboard lists |
| `spec_highlight` | Card with the spec table surfaced on the face |

Each slot declares which modes it allows, so staff cannot put a `hero` into a compact sidebar.

### 8.4 Per-placement overrides

The same product often needs different framing in different places. A placement can override, without touching the underlying card:

- `title_override` / `subtitle_override` — "Premium Business Cards" in the shop, "Get 500 Cards by Friday" in a CTA
- `image_override_id` — pick a different image from the card's gallery
- `cta_label` / `cta_href` — "Order now" vs "Request a quote" vs a landing page
- `badge_text` — "New", "Best seller", "Rush available"
- `variant_id` — which variant's price to feature; a hero might lead with the 1000-qty price rather than the cheapest

Overrides are per-placement and null by default. When null, the card's own values render.

### 8.5 Scheduling

Placements carry optional `starts_at` and `ends_at`. A holiday promo can be placed weeks ahead and expires on its own. The frontend query filters on the window, so nothing needs to be manually pulled down.

Show scheduled and expired placements distinctly in the dashboard — a placement that quietly stopped rendering because it expired should be visible, not invisible.

### 8.6 Publish checklist

Block Published status until the card has a title, a featured image with a valid source (section 9), at least one variant with a retail price, a category, a CTRL+P-written description, and a unique slug. Show which items are missing, not a generic error.

Placement into any `public` or `customer` audience slot additionally requires the card be Published. Staff-audience slots accept Ready cards, so internal quick-order lists can include products not yet on the storefront.

### 8.7 Frontend rendering

One server component resolves everything:

```tsx
<Slot slotKey="home_hero" />
<Slot slotKey="category_spotlight" contextId={category.id} />
<Slot slotKey="product_related" contextId={card.id} />
```

`<Slot>` queries active placements for that key and context, filters by date window and status, applies overrides, and renders each card in its assigned display mode. Empty slots render nothing rather than a placeholder.

Build one `ProductCard` component driven by the display mode, and one data layer with `internal` and `public` shapes. Two separate card implementations will drift apart within a month.

### 8.8 Managing placements

Two entry points, because staff think about this from both directions:

**From a card** — a Placements tab on the card editor listing every slot the card could go into, grouped by surface, with a toggle each. Turning one on reveals the display mode picker, override fields, and schedule.

**From a slot** — a Placement Manager page listing all slots. Open one to see its current cards in render order, drag to reorder, and add or remove. This is the view for "what's on the homepage right now."

Both should show a live preview of the card in the selected display mode. Placement without preview is guesswork.

---

## 9. Content and assets — read before publishing anything

Capturing a vendor's page for internal reference and republishing that content on a public commercial storefront are different things, and the second carries real exposure.

**Descriptions must be rewritten, not copied.** Vendor copy pasted verbatim onto your product pages is both a copyright issue and an SEO problem — Google treats duplicate content poorly, and you would be competing against the vendor's own page with their own words. Build the review step to make this explicit: show the captured description as reference in one field and require a separate CTRL+P description before the card can publish. This is a good place to offer AI-assisted rewriting, seeded with the captured specs.

**Images need a real source.** Three legitimate options, in order of preference:

1. **Vendor dealer asset packs.** Most wholesale printers provide marketing images explicitly licensed for reseller use — this is the intended path and usually just requires asking your rep.
2. **Your own photography.** Best differentiation, and unambiguously yours.
3. **Written permission** from the vendor for specific images.

Scraped product photos are fine as internal reference on a draft card. Publishing them to a public storefront without one of the above is a risk worth avoiding, and it is easy to avoid — add an `image_source` field with values `vendor_licensed | own_photo | permission | scraped_reference`, and block publishing any card whose featured image is `scraped_reference`. A dialog explaining why, with a link to request assets from the vendor, turns a compliance rule into a workflow step.

**Vendor terms.** Staff manually capturing pages they are already browsing is materially different from automated bulk scraping. Keep it that way: the fallback path stays single-URL and staff-initiated, rate-limited, and never crawls. Do not build a bulk importer.

---

## 10. Cost staleness

Print costs move constantly — paper, freight surcharges, seasonal pricing. A card priced six months ago may be selling below its current tier target.

- Display `cost_captured_at`; flag anything over 30 days
- **Refresh** re-opens the source URL in the extension for a fresh cost capture
- On refresh, if cost changed, show a diff: old cost, new cost, old margin at current retail, new margin at current retail. Staff choose to hold retail (absorbing the change) or reprice
- Log every change to cost history
- Dashboard widget listing cards whose margin has drifted more than 10 points below their tier target

---

## 11. Data model (Supabase)

```sql
create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  website_url text,
  dealer_portal_url text,
  account_number text,
  requires_login boolean default true,
  provides_marketing_assets boolean default false,
  default_lead_time_days int,
  notes text,
  created_at timestamptz default now()
);

create table pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  default_markup_pct numeric(6,2) not null,
  default_markup_flat numeric(10,2) default 0,
  min_margin_pct numeric(5,2),
  rounding_rule text default 'charm_99',
  sort_order int
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  tier_id uuid references pricing_tiers(id),
  parent_id uuid references categories(id),
  description text,
  sort_order int default 0,
  is_visible boolean default true
);

create table captures (
  id uuid primary key default gen_random_uuid(),
  captured_by uuid references profiles(id),
  source_url text not null,
  vendor_id uuid references vendors(id),
  capture_method text not null,        -- 'extension' | 'headless' | 'manual'
  screenshot_path text,
  raw_structured_data jsonb,
  detected_price_table jsonb,
  extracted_text text,
  extraction_sources jsonb,            -- which tier supplied each field
  created_at timestamptz default now()
);

create table product_cards (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid references captures(id),
  vendor_id uuid references vendors(id),
  category_id uuid references categories(id),

  -- card face
  title text not null,
  subtitle text,
  slug text unique,

  -- content
  description text,                    -- CTRL+P written, customer-facing
  captured_description text,           -- vendor original, internal reference only
  spec_table jsonb default '{}',

  -- identifiers
  vendor_sku text,
  internal_sku text unique,

  -- pricing rule; null inherits from category tier
  markup_pct numeric(6,2),
  markup_flat numeric(10,2),
  rounding_rule text,
  markup_source text default 'tier',   -- 'tier' | 'card_override'

  price_unit text default 'each',      -- 'each' | 'sq_ft' | 'linear_ft' | 'set'
  lead_time_days int,

  -- publishing
  status text default 'draft',         -- draft | ready | published | archived
  published_at timestamptz,
  seo_title text,
  seo_description text,

  source_url text,
  cost_captured_at timestamptz,

  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references product_cards(id) on delete cascade,

  label text,                          -- '500 / 16pt / Gloss'
  quantity numeric(12,2) default 1,
  spec jsonb default '{}',

  unit_cost numeric(12,4) not null,
  extended_cost numeric(12,2),

  markup_pct numeric(6,2),             -- null inherits from card
  markup_flat numeric(10,2),

  cached_unit_retail numeric(12,4),
  cached_extended_retail numeric(12,2),
  cached_margin_pct numeric(5,2),

  retail_override numeric(12,2),
  retail_override_reason text,
  retail_override_by uuid references profiles(id),

  is_default boolean default false,
  is_available boolean default true,
  sort_order int default 0
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references product_cards(id) on delete cascade,
  storage_path text not null,
  caption text,
  alt_text text,
  image_source text not null default 'scraped_reference',
    -- 'vendor_licensed' | 'own_photo' | 'permission' | 'scraped_reference'
  source_note text,
  sort_order int default 0,
  is_primary boolean default false
);

-- Registered locations cards can be placed into. Seeded from code.
create table placement_slots (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,            -- 'home_hero', 'product_related'
  label text not null,
  description text,
  surface text not null,               -- 'storefront' | 'landing' | 'dashboard'
  audience text not null default 'public',  -- 'public' | 'customer' | 'staff'
  context_type text,                   -- null | 'category' | 'card' | 'page'
  max_items int default 1,
  allowed_display_modes text[] not null default '{tile}',
  supports_scheduling boolean default true,
  is_active boolean default true,
  sort_order int default 0
);

-- A card assigned to a slot
create table card_placements (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references product_cards(id) on delete cascade,
  slot_id uuid references placement_slots(id) on delete cascade,

  context_id uuid,                     -- category/card/page id for repeating slots
  display_mode text not null default 'tile',
  sort_order int default 0,

  -- optional per-placement overrides; null falls back to the card
  title_override text,
  subtitle_override text,
  image_override_id uuid references product_images(id),
  variant_id uuid references product_variants(id),
  cta_label text,
  cta_href text,
  badge_text text,

  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean default true,

  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (card_id, slot_id, context_id)
);

create index on card_placements (slot_id, context_id, sort_order)
  where is_active;

create table cost_history (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references product_variants(id) on delete cascade,
  old_unit_cost numeric(12,4),
  new_unit_cost numeric(12,4),
  changed_by uuid references profiles(id),
  change_source text,                  -- 'capture' | 'refresh' | 'manual'
  changed_at timestamptz default now()
);
```

Enable RLS on every table. Index `product_cards(status, category_id)`, `product_cards(slug)`, `product_variants(card_id)`, and a GIN index on `captures.extracted_text`.

Add a DB-level check or trigger preventing `status = 'published'` when the primary image's `image_source` is `scraped_reference`.

Enforce three placement rules at write time, in the API layer:

1. `display_mode` must be in the slot's `allowed_display_modes`
2. Active placements for a `(slot_id, context_id)` pair must not exceed `max_items` — reject with a message naming what would need to be removed first
3. A card placed into a `public` or `customer` audience slot must have `status = 'published'`; `staff` slots accept `ready` as well

Rule 2 is the one that will bite in practice. Make the error actionable rather than a constraint violation.

---

## 12. API routes

```
POST   /api/capture                    Accept screenshot + DOM payload, run pipeline, return draft
POST   /api/capture/url                Queue headless capture
GET    /api/capture/:id                Poll status

GET    /api/cards                      List, filter, search (internal shape)
POST   /api/cards                      Create from reviewed draft
PATCH  /api/cards/:id                  Edit
POST   /api/cards/:id/publish          Validate checklist, publish
POST   /api/cards/:id/refresh-cost     Re-capture cost from source
DELETE /api/cards/:id                  Archive

POST   /api/cards/bulk-markup          Preview + apply markup across selection

GET    /api/slots                      Slot registry with current fill counts
GET    /api/slots/:key/placements      Cards in a slot, ordered (optional ?contextId=)
POST   /api/slots/:key/placements      Add a card to a slot
PATCH  /api/placements/:id             Overrides, display mode, schedule
PATCH  /api/slots/:key/reorder         Bulk sort_order update
DELETE /api/placements/:id             Remove from slot
GET    /api/cards/:id/placements       Every slot this card appears in

GET    /api/shop/products              Public shape — retail only, published only
GET    /api/shop/products/:slug        Public product detail
GET    /api/shop/slot/:key             Resolved placements for a slot, overrides applied

GET    /api/pricing/tiers              Tier settings
PATCH  /api/pricing/tiers/:id          Update defaults
POST   /api/pricing/calculate          Compute retail from cost + rule (used live by the UI)
```

Keep `/api/shop/*` on a separate response shape that structurally cannot include cost, margin, or markup fields. Add an integration test asserting a public response contains none of them.

---

## 13. Components

```
components/products/
  ProductCard.tsx            variant: 'shop' | 'featured' | 'dashboard'
  ProductCardModal.tsx       Dialog — gallery, specs, variant table, internal panel
  VariantTable.tsx           Editable rows: qty, spec, cost, markup, retail, margin
  MarkupControl.tsx          The four-value linked pricing widget
  CaptureReviewForm.tsx      Draft review, field source badges, variant import
  PublishChecklist.tsx       What's missing before publish
  ImageSourceSelect.tsx      Asset provenance, blocks scraped images at publish
  BulkMarkupDialog.tsx       Multi-select repricing with before/after preview
  PricingTierSettings.tsx    Admin

components/placements/
  Slot.tsx                   Server component — resolves and renders a slot
  CardPlacementsTab.tsx      From a card: every slot it can go into, toggles
  PlacementManager.tsx       From a slot: current cards, drag reorder, add/remove
  PlacementEditor.tsx        Display mode, overrides, schedule for one placement
  PlacementPreview.tsx       Live render of the card in the chosen display mode
  SlotFillIndicator.tsx      "3 of 8 filled" with over-capacity warning

app/shop/page.tsx            Grid + filters
app/shop/[category]/page.tsx Category grid
app/shop/[slug]/page.tsx     Product page, generateMetadata for SEO
app/dashboard/products/      Internal management
```

Extension side panel reuses `CaptureReviewForm`, `MarkupControl`, and `VariantTable` — share them through a workspace package rather than duplicating.

---

## 14. Permissions

| Role | Capture | See cost/margin | Set markup | Tier defaults | Publish |
|---|---|---|---|---|---|
| Owner/Admin | Yes | Yes | Yes | Yes | Yes |
| Staff | Yes | Yes | Per-card | No | Yes |
| Customer | No | **Never** | No | No | No |

Cost leaking to a customer is the worst failure this feature can produce. Write RLS so public queries cannot reach `unit_cost`, `cached_margin_pct`, `markup_pct`, `captured_description`, or `cost_history`, and assert it in a test rather than trusting the frontend.

---

## 15. Build phases

**Phase 1 — Pricing engine.** Tiers, categories, the calculation function, rounding, guards. Unit tests against the table in 7.2. No UI beyond admin settings. Everything downstream depends on this math being right.

**Phase 2 — Cards and manual entry.** Card and variant models, `MarkupControl`, `VariantTable`, dashboard list and modal. Staff can build products by hand with correct pricing.

**Phase 3 — Storefront.** Shop grid, product pages, SEO, publish workflow and checklist.

**Phase 3.5 — Placements.** Slot registry, `card_placements`, the `<Slot>` renderer, display modes, per-placement overrides, both management views, scheduling. Seed the slot registry with the table in 8.2 and wire the storefront pages to render through `<Slot>` rather than hardcoded queries.

**Phase 4 — Extension capture.** MV3 extension, side panel, hover-select, screenshot, Tier 1–2 extraction, draft review.

**Phase 5 — Advanced extraction.** Vision extraction, price table import, field source badges, cost refresh and staleness dashboard.

Phases 1–3 deliver a complete working catalog on their own. Capture makes it fast, but it is the highest-risk piece and should not block the parts that produce value immediately.

---

## 16. Out of scope for v1

- Automated scheduled cost monitoring
- Customer-specific pricing levels
- Order placement or vendor API submission
- Inventory and stock tracking
- Shipping cost calculation
- Multi-currency
- Mobile capture — extension is desktop Chrome only

---

## 17. Open questions

1. Does controlp.io already have a square-foot pricing engine from the wall wrap work? If so, this markup layer should extend it, not sit beside it — two pricing systems means fixing every pricing bug twice.
2. Do published cards feed a cart and checkout, a quote request flow, or both?
3. Which vendors currently supply dealer marketing assets? That list determines which categories can publish first.
4. Do the three tier defaults (40/75/125) reflect actual CTRL+P pricing, or should they start elsewhere?
5. Should `internal_sku` follow an existing numbering convention?
6. Are controlp.io landing pages database-backed or file-based routes? If file-based, `landing_cta` and `landing_grid` need a stable page key to use as `context_id` — decide that convention before Phase 3.5.

Resolve question 1 before Phase 1 begins.
