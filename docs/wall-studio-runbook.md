# Wall Studio — Runbook

Customer-facing wall wrap / wallpaper / window-film visualizer with live pricing,
a cut-design tool, cart + checkout (through the existing Square flow), install
quoting, and install booking. Public entry point: **`/studio`** (nav: "Wall Studio").

## Migrations (apply in order)

| File | What it does | Required for |
|---|---|---|
| `20260717000001_wall_studio.sql` | `ws_products`, `ws_pricing_rules`, `ws_visualizations`, `ws_bookings` (+ the now-dropped `ws_orders`/`ws_order_items`), RLS, and the v1 seed (9 designs + §5 pricing rules) | Catalog, visualizer, Save-this-look |
| `20260717000002_wall_studio_commerce.sql` | `order_items.product_id` nullable; loosen `ws_bookings` FK | **Wall checkout** (order-items insert) |
| `20260717000003_wall_studio_polish.sql` | Add `ws_bookings.email`; drop unused `ws_orders`/`ws_order_items` | **Booking** (email column) |

Apply with `supabase db push` or paste into the SQL editor.

## Environment

Wall Studio reuses existing infrastructure — no new required env vars:

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (all server writes/reads use the service role).
- **Storage**: reuses the existing public **`artwork`** bucket (Save-this-look snapshots live under `wall-studio/`).
- **Payments**: existing **Square** vars (`SQUARE_*`) — checkout goes through `/api/checkout/order`.
- **Email**: existing SMTP vars (`SMTP_HOST/PORT/USER/PASSWORD/FROM/SECURE`) — booking + order confirmations. Emails no-op if SMTP isn't configured.

## How pricing flows (single source of truth)

`ws_pricing_rules` (DB) → `pricingRulesFromRows()` → **`lib/wall-studio/pricing.ts`** (pure, unit-tested) is used in three places, all reading the same rules:

1. **Live** in the visualizer (`PreviewControls`) and Install Quote sheet.
2. **Server re-price** at checkout (`/api/checkout/order` recomputes wall materials from `ws_products` × billed sqft, and installation from `ws_pricing_rules` + factors; rejects client drift > $0.01).
3. **Admin** edits (`/admin/wall-studio`) write straight back to `ws_products` / `ws_pricing_rules` — changes take effect with no deploy.

Rules: materials = `max(billed_sqft, 25) × price_per_sqft`. Install order of operations = base labor (by material) → % multipliers (height/exterior/condition) + flat fees → per-sqft adders (removal/cleaning) → per-unit adders (obstacles/access/travel) → rush % on the subtotal → $150 floor. **Cutouts never affect price.**

## Admin

**Admin → Catalog → Wall Studio** (`/admin/wall-studio`):
- Designs table: per-sq-ft price, accent, blend mode, pattern type, active toggle.
- Installation pricing variables: base labor rate per material + all surcharges/adders/travel/rush/minimums.

## Key files

```
app/(site)/studio/page.tsx            landing (catalog + visualizer)
app/(site)/studio/look/[id]/page.tsx  public share page for a saved look
app/admin/wall-studio/page.tsx        admin pricing
app/api/wall-studio/products          public catalog + rules (GET)
app/api/wall-studio/bookings          create booking (+ email/notification)
app/api/wall-studio/visualizations    Save this look (Storage + row)
app/api/admin/wall-studio             admin GET/PATCH (products + rules)
app/api/checkout/order                (extended) wall + install server pricing
lib/wall-studio/pricing.ts            pure pricing engine (+ pricing.test.ts)
lib/wall-studio/homography.ts         perspective math (verbatim port)
lib/wall-studio/geometry.ts           quad area / estimated sqft (+ test)
lib/wall-studio/snapshot.ts           textured-triangle PNG export
lib/wall-studio/store.tsx             feature React context
components/wall-studio/*               UI (slider, stage, drawer, dialogs, sheet)
```

## Tests

`npm test` → `lib/wall-studio/pricing.test.ts` (every §5 factor, order of operations, $150 floor, 25 sqft min, rush boundary, cutout price-parity) and `geometry.test.ts`.

## Manual smoke

`/studio` → Preview a design → drag corners (price updates) → Cut Design (price unchanged) → Save this look (shareable `/studio/look/{id}`) → Add to cart → Installation quote → cart → checkout (Square). Book installation → `IN-xxxxxx`.
