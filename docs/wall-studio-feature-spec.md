# Wall Studio — Feature Spec

**Feature:** Wall wrap / wallpaper / window film visualizer with dynamic pricing, cut-design tool, ecommerce cart, installation quoting, and install booking.
**Target app:** Existing Next.js (App Router) + React + Tailwind + shadcn/ui + Supabase project.
**Source of truth for UX & math:** `docs/features/wall-studio-prototype.html` (working single-file prototype — port its behavior, not its styling; restyle with the app's existing Tailwind/shadcn design system).

---

## 1. Problem Statement

Customers ordering wall wraps, wallpaper, and window film can't judge how a design will look in their space, and pricing (materials + installation) is opaque until a manual quote. This feature lets a customer preview any design on their own wall via camera or photo with true perspective, see the price change in real time as they size the wall, exclude objects (windows, couches, plants) from the design, get an itemized installation quote, pay, and book an install crew — end to end, self-serve.

## 2. Goals

1. Customer can go from "browse design" → "see it on my wall" → "paid order + booked install" without contacting the shop.
2. Material price updates in **real time** (< 100ms perceived) while the customer resizes the wall or drags visualizer corners.
3. Installation quotes are itemized and reproducible from stored factor inputs (auditable line items, not a black-box number).
4. Cutouts are purely visual — they never change the material price (full panels are printed, trimmed on site).

## 3. Non-Goals (v1)

- No AI wall-segmentation/auto-masking (manual corner fitting + manual cutout drawing only; P2).
- No multi-wall scenes in one visualizer session (one quad per session; multiple walls = multiple cart items).
- No live payment capture in phase 1–3 (checkout writes a `pending_payment` order; Square/Stripe integration is phase 4).
- No installer-side scheduling/dispatch UI (bookings land in a table + notification; back-office comes later).
- No user-uploaded custom designs (catalog designs only; P2).

## 4. Existing Prototype Behavior to Port (verified working)

The prototype implements all of the following — reuse its logic verbatim where noted:

| Area | Behavior | Port strategy |
|---|---|---|
| Perspective overlay | 4 draggable corner handles; pattern div mapped with a `matrix3d` homography (Franklin Ta adjugate method: `adj`, `multmm`, `multmv`, `basisToPoints`, `projection`) | Copy math functions into `lib/wall-studio/homography.ts` as pure TS |
| Blend realism | `mix-blend-mode: multiply` for wallpaper/wraps (keeps wall shadows), `normal` for window film | Per-product `blend` field |
| Live pricing | Entered wall W×H (ft) calibrates the current quad area; dragging corners scales est. sqft by area ratio; tooltip follows the dragged handle; linked cart line + totals update live (rAF-throttled) | Port `quadArea`, `estimatedSqft`, `estimatedDims`, calibration-on-dims-change |
| Cut Design tool | Click-to-place polygon points around objects; click first point (or "Done") closes; Escape cancels; shapes are draggable, deletable; holes punched via SVG evenodd alpha mask (`mask-image`), and via `destination-out` in the canvas snapshot | Port as `useCutouts` hook + `CutoutLayer` component |
| Snapshot export | Canvas composite: backdrop frame + pattern surface projected through the homography as a 20×20 textured-triangle mesh, multiply blend, cutout holes respected; downloads PNG | Port `drawTexturedTriangle` + snapshot pipeline to `lib/wall-studio/snapshot.ts` |
| Camera / upload | `getUserMedia({facingMode:'environment'})` with graceful fallback to file upload; demo room SVG as default backdrop | Same; camera requires HTTPS in prod |
| Catalog slider | Single-row snap slider: 3.5 cards desktop / 2.5 tablet / 1.5 mobile, arrow buttons, mouse drag-to-scroll with click suppression + momentum | Rebuild with the same breakpoints; `embla-carousel-react` is acceptable if it reproduces the half-card peek |
| Layout shells | Visualizer = bottom drawer (slides up); Installation Quote = right slide-out; Booking = modal; cart = right drawer with icon + badge trigger | Map to shadcn: `Drawer`/`Sheet` (bottom), `Sheet` (right ×2), `Dialog` (booking + size + checkout) |
| Accent theming | Selecting a design retints `--accent` across the UI to the design's accent color | CSS variable on a wrapper; keep it scoped to the feature |

## 5. Pricing Engine (exact v1 constants — make DB-driven)

**Materials:** `price_per_sqft × max(billed_sqft, 25)` per line item. 25 sq ft minimum per panel.

**Installation** (computed over cart totals; itemized lines stored with the order):

| Factor | Rule |
|---|---|
| Base labor | sqft × rate by material: Wallpaper **$3.25**, Wall wrap **$4.00**, Window film **$3.00** /sqft (sqft-weighted blend across mixed carts) |
| Height | tallest wall > 10 ft: **+10%** (ladder); > 14 ft: **+25% and +$150** (lift/scaffold) |
| Location | Exterior: **+20%** |
| Surface condition | Textured: **+15%**; Needs repair: **+$120 and +10%** |
| Removal of existing material | **+$1.25/sqft** |
| Cleaning & prep | **+$0.35/sqft** |
| Obstacles (outlets, fixtures, furniture moves) | **$15 each** |
| Difficult access (stairs, lifts, tight spaces) | **+$75** |
| Distance | first 15 miles free, then **$2.00/mile** |
| Rush (install < 7 days out) | **+25%** applied to subtotal; auto-flagged from the chosen booking date, user-overridable |
| Minimum | **$150** service call floor |

Order of operations (match prototype `computeInstall`): base labor → percentage multipliers (height, exterior, condition) + flat fees → per-sqft adders (removal, cleaning) → per-unit adders (obstacles, access, travel) → rush % on the subtotal → apply $150 floor. **Cutouts never appear in pricing.**

Store rates in a `ws_pricing_rules` table (key/value JSONB) so rates are editable without deploys; hardcode the v1 seed to the values above.

## 6. Data Model (Supabase)

Prefix all tables `ws_`. RLS on all tables.

```sql
-- Catalog
create table ws_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null check (category in ('wallpaper','wall_wrap','window_film')),
  price_per_sqft numeric(8,2) not null,
  install_rate_per_sqft numeric(8,2) not null,
  accent_hex text not null,
  blend_mode text not null default 'multiply',   -- 'multiply' | 'normal'
  repeat_pattern boolean not null default true,  -- false = mural (cover)
  tile_url text,          -- Supabase Storage path to pattern tile (SVG/PNG)
  tile_svg text,          -- inline SVG fallback (v1 seeds from prototype)
  active boolean not null default true,
  created_at timestamptz default now()
);

create table ws_pricing_rules (
  key text primary key,          -- e.g. 'min_sqft', 'rush_pct', 'travel_free_miles'
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Saved visualizer sessions (optional persistence of a preview)
create table ws_visualizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  product_id uuid references ws_products,
  corners jsonb not null,        -- [{x,y}×4] fractions
  cutouts jsonb not null default '[]',  -- [{pts:[{x,y},...]}]
  wall_w_ft numeric(6,1),
  wall_h_ft numeric(6,1),
  pattern_scale int,
  opacity numeric(3,2),
  snapshot_url text,             -- Storage path to exported PNG
  created_at timestamptz default now()
);

-- Commerce
create table ws_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','cancelled','refunded')),
  contact jsonb not null,               -- {name,email,phone,address}
  materials_total numeric(10,2) not null,
  install_included boolean not null default true,
  install_factors jsonb,                -- raw factor inputs at time of order
  install_lines jsonb,                  -- itemized [{label,amount}]
  install_total numeric(10,2) not null default 0,
  grand_total numeric(10,2) not null,
  payment_ref text,                     -- Square/Stripe id (phase 4)
  created_at timestamptz default now()
);

create table ws_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references ws_orders on delete cascade,
  product_id uuid references ws_products,
  wall_w_ft numeric(6,1) not null,
  wall_h_ft numeric(6,1) not null,
  billed_sqft numeric(8,1) not null,    -- max(raw, 25)
  unit_price numeric(8,2) not null,     -- price_per_sqft snapshot
  line_total numeric(10,2) not null,
  visualization_id uuid references ws_visualizations,
  created_at timestamptz default now()
);

-- Booking
create table ws_bookings (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,             -- e.g. 'IN-482913'
  user_id uuid references auth.users,
  order_id uuid references ws_orders,
  name text not null, phone text not null, address text not null,
  project_type text not null,
  notes text,
  preferred_date date not null,
  time_window text not null,            -- '8–11 AM' | '11–2 PM' | '2–5 PM'
  status text not null default 'requested'
    check (status in ('requested','confirmed','completed','cancelled')),
  created_at timestamptz default now()
);
```

**RLS:** `ws_products` / `ws_pricing_rules` — public read, service-role write. All other tables — owner (`user_id = auth.uid()`) read/write insert; anonymous checkout allowed via a `guest_token` cookie column if the app supports guest flows (follow the app's existing auth pattern; ask before inventing one).

Cart itself stays **client state** (Zustand or React context) with `localStorage` persistence — no cart table in v1.

## 7. Architecture / File Plan

```
app/
  studio/page.tsx                      # feature landing: hero + design slider
components/wall-studio/
  DesignSlider.tsx                     # 3.5 / 2.5 / 1.5 snap slider + drag scroll
  DesignCard.tsx
  VisualizerDrawer.tsx                 # bottom drawer shell (shadcn Drawer/Sheet side="bottom")
  VisualizerStage.tsx                  # backdrop (img/video) + overlay + handles + cutout layers
  PatternSurface.tsx                   # matrix3d-transformed pattern div + mask
  CornerHandles.tsx
  CutoutLayer.tsx                      # SVG polygons, drawing mode, drag/delete
  PreviewControls.tsx                  # dims inputs, live price card, scale/blend sliders, actions
  DragPriceTooltip.tsx
  InstallQuoteSheet.tsx                # right slide-out: factors form + live breakdown
  BookingDialog.tsx
  CartSheet.tsx                        # right drawer, icon+badge trigger in navbar
  SizeDialog.tsx                       # W×H → sqft on add-to-cart
  CheckoutDialog.tsx
lib/wall-studio/
  homography.ts                        # adj/multmm/multmv/basisToPoints/projection/projectPoint
  snapshot.ts                          # textured-triangle canvas export
  pricing.ts                           # materials + computeInstall (pure, unit-tested)
  types.ts
stores/wall-studio.ts                  # Zustand: selection, corners, dims, calibArea, cutouts,
                                       # cart[], liveIdx, install factors
app/api/wall-studio/
  orders/route.ts                      # POST create order + items (server-side price re-check)
  bookings/route.ts                    # POST create booking
supabase/migrations/xxxx_wall_studio.sql
supabase/seed/wall_studio_products.ts  # 9 designs from prototype
docs/features/wall-studio-prototype.html
```

Conventions: TypeScript strict, server components by default, `"use client"` only where interaction requires it (stage, drawers, cart). Use the app's existing shadcn theme tokens; the design accent maps to a scoped CSS variable, not a global theme mutation.

**Server-side price verification is P0:** the orders API must recompute materials + install from product rows and `ws_pricing_rules` and reject mismatched client totals (>$0.01 drift).

## 8. Requirements & Acceptance Criteria

### P0 — must ship
- [ ] Catalog slider shows active `ws_products` with category filter chips; 3.5/2.5/1.5 visible cards at ≥901px / 601–900px / ≤600px, half-card peek on the right; arrows advance one card; mouse drag scrolls without triggering card buttons.
- [ ] "Try the visualizer", nav Visualizer link, and card Preview open the bottom drawer; overlay renders correctly after open (recalibrate on visible — the stage has zero size while hidden).
- [ ] Camera works over HTTPS with environment-facing preference; failure falls back to upload with an inline message; demo backdrop present on first open.
- [ ] Dragging any corner updates the perspective overlay at 60fps and shows a tooltip with `≈ N sqft · $X materials`; entered W×H recalibrates; a visualizer-added cart line updates live while dragging.
- [ ] Cut Design: ≥3 clicked points close into a polygon (click-first-point or Done); holes render in the live overlay **and** the exported PNG; cutouts are draggable/deletable; pricing is provably unchanged by any number of cutouts.
- [ ] Install quote sheet reproduces the exact factor table in §5 with a live itemized breakdown; changing any factor updates cart totals instantly; booking date < 7 days auto-checks Rush.
- [ ] Checkout creates `ws_orders` + `ws_order_items` with server-recomputed totals and a stored copy of factor inputs + itemized lines; UI shows an order ref.
- [ ] Booking dialog creates `ws_bookings` with a `IN-xxxxxx` ref; date picker blocks < 2 days out; three time windows.
- [ ] Download preview exports a PNG composite matching the on-screen state (backdrop, perspective, blend, opacity, cutouts).

### P1 — fast follow
- [ ] Persist visualizer sessions to `ws_visualizations` + snapshot upload to Storage ("Save this look", shareable link).
- [ ] Auth-aware cart merge (guest → signed-in).
- [ ] Admin CRUD for products and pricing rules (protected route).
- [ ] Email confirmations for orders/bookings via the app's existing transactional email (Resend).

### P2 — future
- [ ] Square (preferred) or Stripe payment capture on checkout; order status transitions.
- [ ] AI wall segmentation for auto corner/cutout suggestions.
- [ ] Customer-uploaded artwork with print-DPI validation.
- [ ] Installer back-office: booking calendar, route/day view, status updates → SMS via Twilio.

## 9. Phased Build Plan

1. **Phase 1 — Foundation:** migration + seed, `pricing.ts` with unit tests (every §5 factor + order of operations + $150 floor + 25 sqft minimum), types, Zustand store, `/studio` route with catalog slider.
2. **Phase 2 — Visualizer:** homography lib, stage + handles + pattern surface, camera/upload, dims + calibration + live tooltip pricing, Cut Design polygon tool + masks, snapshot export.
3. **Phase 3 — Commerce & booking:** size dialog, cart sheet with live-linked line, install quote sheet, checkout API (server price re-check, `pending_payment`), booking dialog + API.
4. **Phase 4 — Payments & polish:** Square integration, session persistence, emails, admin CRUD.

Each phase must leave the app deployable and existing routes untouched.

## 10. Open Questions (answer before Phase 3)

1. Guest checkout allowed, or require the app's existing auth? (affects RLS + cart merge)
2. Square vs. Stripe for phase 4? (Square already in the ecosystem)
3. Should design tiles live in Storage from day one, or ship v1 with inline SVG seeds and migrate later?
4. Does `/studio` sit inside the existing marketing site nav, or is it a standalone route group with its own header?