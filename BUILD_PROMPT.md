# controlp.io — Build Prompt

**Project:** controlp.io
**Owner:** Jeremy Waters (Qallus LLC) — jwaters@qallus.co
**Scope:** Full rebuild as a production Next.js ecommerce + operations platform
**Build mode:** Staged, one-page-at-a-time with explicit gating

---

## Non-negotiable rules

**1. Read all mockups before writing any code.**

The HTML mockups in `mockups/` are the authoritative design source. Do not invent UI. Match what's in the mockups exactly. Read them in the order they're numbered.

**2. Tech stack is locked. Do not substitute.**

| Layer | Choice |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Runtime | React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind v4 + Shadcn UI primitives |
| UI primitives | Radix (via Shadcn), Lucide React icons |
| Fonts | Inter (body) + Geist (display, -0.02em tracking) |
| DB | Supabase (self-hosted at supabase.cueallus.com) |
| Auth | NextAuth v5 with Supabase adapter |
| Payments | Stripe (Checkout hosted + webhooks) |
| SMS | Twilio |
| Transactional email | Nodemailer via Hostinger SMTP |
| Marketing email | Resend |
| File storage | Supabase Storage |
| Vendor APIs | 4Over, B2Sign (see `reference/vendors.md`) |
| Deploy | Coolify on Hostinger VPS |

**Do not add libraries without asking.** No Framer Motion, Zustand, TanStack Query, React Hook Form, Redux, or styled-components. Use built-in Next.js + React primitives first.

**3. One page at a time.** Build → verify → confirm → move on. No batch-building multiple routes before checking in.

**4. Self-check step.** Before writing code in each phase, produce a short written summary (template at bottom of this file). I read that summary before giving you the go.

---

# PHASE 1 — Foundation

## 1. Repo setup
- Initialize Next.js 16.1.6 App Router with TypeScript, Tailwind v4, ESLint
- Install Shadcn CLI and initialize with the HSL tokens in `reference/brand.md`
- Install: `lucide-react`, `@supabase/ssr`, `@supabase/supabase-js`, `next-auth@beta`, `stripe`, `twilio`, `nodemailer`, `resend`, `zod`
- Set up `fonts.ts` loading Inter + Geist from `next/font/google` with `--font-display` CSS variable and a `.font-display` utility class with `letter-spacing: -0.02em`

## 2. Supabase schema (v1)
All tables have Row-Level Security enabled.

- **`users`** (extends `auth.users`) — role enum: `customer` | `staff` | `admin`
- **`addresses`** — billing + shipping, linked to user
- **`products`** — sku, slug, category, base_cost, vendor (`in_house` | `4over` | `b2sign`), active
- **`product_variants`** — size/material/finish combinations with cost deltas
- **`product_options`** — grommets, hemming, pole pockets, etc. with pricing rules
- **`pricing_rules`** — stores margin tiers (see `reference/pricing-strategy.md`)
- **`orders`** — status enum: `new` | `proof_pending` | `proof_approved` | `in_production` | `shipped` | `delivered` | `cancelled` | `refunded`
- **`order_items`** — product_id, variant_id, options (jsonb), qty, unit_cost, unit_price, artwork_file_id
- **`artwork_files`** — Supabase storage ref, user_id, filename, mime, size, thumbnail_url
- **`design_drafts`** — in-progress configurator state saved by customer
- **`proofs`** — order_item_id, url, customer_approved_at, revisions (jsonb array)
- **`shipments`** — carrier, tracking_number, status, shipped_at, delivered_at
- **`vendor_jobs`** — order_item_id, vendor, vendor_order_id, vendor_status, sync_state, last_synced_at
- **`sms_messages`**, **`email_messages`** — outbound communication log
- **`coupons`**, **`store_credits`**

Generate TypeScript types with `supabase gen types` into `lib/database.types.ts`.

## 3. Auth foundation
- NextAuth v5 with Supabase adapter
- Providers: Email (magic link via Resend), Google OAuth
- Routes: `/auth/signin`, `/auth/register`, `/auth/callback`, `/auth/forgot-password`, `/auth/reset-password`
- Middleware protecting `/account/*` (customer role) and `/admin/*` (staff + admin roles)
- Session includes user role — checked in middleware

## 4. Shared components
Build Shadcn-based atoms into `components/ui/`:
- Button (primary, outline, ghost, sm/default/lg)
- Card, Badge, Input, Select, Checkbox, Textarea, Radio
- Dropdown menu, Table, Tabs, Dialog, Sheet

App-specific components into `components/`:
- `<SiteHeader />`, `<SiteFooter />`, `<AnnouncementBar />`
- `<ProductCard />`, `<ProductImagePlaceholder />`
- `<RatingStars />`, `<EmptyState />`
- `<PriceBreakdown />` — reusable for cart/checkout/configurator

## 5. File structure
```
app/
  (marketing)/
    page.tsx                    # homepage
    shop/
      page.tsx
      [category]/page.tsx
    products/[slug]/page.tsx
    about/page.tsx
    contact/page.tsx
    faq/page.tsx
    blog/
      page.tsx
      [slug]/page.tsx
    templates/page.tsx
  (auth)/
    signin/page.tsx
    register/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    logout/page.tsx
  account/
    layout.tsx
    page.tsx
    orders/, drafts/, artwork/, addresses/, settings/
  admin/
    layout.tsx
    page.tsx
    orders/, production/, customers/, products/, vendors/, pricing/, analytics/
  cart/page.tsx
  checkout/page.tsx
  thank-you/[order_id]/page.tsx
  api/
    webhooks/
      stripe/route.ts
      4over/route.ts
      b2sign/route.ts
      twilio/route.ts
    orders/, artwork/, pricing/
lib/
  supabase/ (server.ts, client.ts)
  auth/ (config.ts, middleware.ts)
  pricing/
    calculate.ts
    tiers.ts
    __tests__/calculate.test.ts
  vendors/
    4over.ts
    b2sign.ts
    shared.ts
  email/ (templates/, send.ts)
  sms/ (send.ts)
components/
  ui/
emails/
```

**GATE 1:** Before Phase 2, show me:
- Schema migration files
- Route tree (`tree app/`)
- Bare `<SiteHeader />` running locally
- `lib/pricing/calculate.ts` with passing unit tests for the 3 margin tiers

I confirm. Only then proceed.

---

# PHASE 2 — Storefront + Customer Account

## 6. Homepage (`app/(marketing)/page.tsx`)
Mirror `mockups/01-home.html` exactly. Products and categories load from Supabase. Tesla model cards link to `/shop/vehicle-wraps?model=<slug>`.

## 7. Shop/Collection (`app/(marketing)/shop/page.tsx`)
Mirror `mockups/02-shop.html`. URL state for filters via `useSearchParams`. Server-rendered initial list for SEO, client hydration for filter interactions. Sort and pagination via URL params. Mobile filters collapse into a Sheet.

## 8. Product Detail + Configurator (`app/(marketing)/products/[slug]/page.tsx`)
Mirror `mockups/03-product.html`. Critical piece is the **configurator engine**:
- Size picker (presets + custom W×H)
- Material selector with cost deltas
- Finish, Sides, Grommets, Finishing checkboxes
- Quantity stepper
- Turnaround selector (standard/rush/same-day)
- Artwork upload to Supabase Storage
- **Live price calculation** on every option change using `lib/pricing/calculate.ts` per `reference/pricing-strategy.md`
- Sticky price + CTA card
- "Estimated ships by" date derived from turnaround + now
- Save-as-draft creates `design_drafts` row
- Tabs: Description, Specifications, Shipping & Returns, Reviews

## 9. Templates (`app/(marketing)/templates/page.tsx`)
Mirror `mockups/04-templates.html`. Click routes to product configurator with template pre-loaded.

## 10. Marketing pages
- About (`mockups/05-about.html`), Contact (`mockups/06-contact.html`), FAQ (`mockups/07-faq.html`), Blog (`mockups/08-*` + `09-*`)

## 11. Cart + Checkout
- Cart (`mockups/10-cart.html`) with promo codes, Affirm split indicator
- Checkout (`mockups/11-checkout.html`) 4-step flow via Stripe Checkout (hosted)
- Webhook creates orders, dispatches `vendor_jobs`, sends confirmation email + SMS
- Thank-you (`mockups/12-thankyou.html`) shows order number, timeline, artwork reminder

## 12. Customer account (`/account`)
Mirror `mockups/13-customer-dashboard.html`. Overview, Orders, Design drafts, Artwork library, Addresses, Payment methods.

## 13. Auth pages
Mirror `mockups/auth/*`:
- Login (split-screen with OAuth + magic link)
- Register (flipped split-screen)
- Forgot password, Reset password, Logout

**GATE 2:** Ship Phase 2 to staging. I test end-to-end:
- Add product → configure → cart → checkout → confirmation
- Sign up → sign in → password reset
- Customer dashboard shows the test order

Only then proceed.

---

# PHASE 3 — Admin / Super-Admin

## 14. Admin layout
Dark theme using CSS variables in `reference/brand.md`. Sidebar nav matches `mockups/14-admin.html`. Role-gated to `staff` or `admin`.

## 15. Admin → Dashboard
Mirror `mockups/14-admin.html` — KPIs, revenue chart, pipeline, vendor sync, recent orders, production queue.

## 16. Admin → Orders
Full-featured data table with filters, bulk actions, CSV export. Order detail drawer with line items, customer, artwork, proof history, manual status override, refund.

Proof approval workflow: admin uploads proof PDF → customer gets SMS + email → customer approves/requests changes.

## 17. Admin → Production Queue
Sortable list: Queued → On Press → Finishing → QC → Ready to Ship. Drag to reorder priority. Press utilization %.

## 18. Admin → Customers / Products / Vendors / Pricing
- Customers, Products CRUD, Vendor sync dashboards
- **Pricing admin:** UI to edit margin tiers, quantity break rules, rush modifiers per `reference/pricing-strategy.md`. Changes apply to future quotes only, not existing orders.

**GATE 3:** Demo admin dashboard end-to-end. Walk through a sample order from creation to delivery, including a vendor-fulfilled item. Only then proceed.

---

# PHASE 4 — Integrations + Polish

## 19. 4Over integration (`lib/vendors/4over.ts`)
See `reference/vendors.md` for full spec.
- `submitOrder(orderItem)` — transforms our order, uploads artwork, returns vendor order ID
- `syncStatus(vendor_order_id)` — pulls status, updates `vendor_jobs`
- Background cron syncs every 15 minutes

## 20. B2Sign integration (`lib/vendors/b2sign.ts`)
Same pattern as 4Over. Separate module so they can diverge freely. See `reference/vendors.md`.

## 21. Twilio SMS
- Order placed → customer SMS with order number + tracking link
- Proof ready → SMS with approval link
- Shipped → SMS with carrier + tracking
- Delivered → SMS with review request
- Inbound SMS webhook routes to admin Messages inbox
- Opt-out handling (STOP keyword)

## 22. Email
- Transactional via Nodemailer + Hostinger SMTP (order confirmation, proof ready, shipped, delivered, password reset)
- Marketing via Resend (newsletter, abandoned cart)
- React Email templates in `emails/`

## 23. Stripe webhooks
`checkout.session.completed`, `charge.refunded`, `invoice.paid` — handle idempotently with event ID dedup table.

## 24. Cron jobs
- Vendor status sync (every 15 min)
- Abandoned cart email (hourly for carts > 4h old)
- Daily summary email to admin (9am)
- Proof-pending-too-long alerts (every 2h)

## 25. Analytics
- PostHog or Plausible (self-hosted) for frontend
- Custom admin analytics page: revenue by product, conversion funnel, vendor margin, customer LTV cohorts

## 26. Performance
- All images via `next/image` with explicit width/height
- Product pages statically generated at build, ISR 1h
- Cart/account pages dynamic
- Lighthouse 95+ on marketing pages

## 27. SEO
- Dynamic Open Graph images per product
- JSON-LD product schema with price, availability, rating
- Sitemap, robots.txt

## 28. Deployment
Deploy to Coolify VPS. Environment variables from `reference/env.example`. Stripe webhook verified. Domain: controlp.io. SSL via Let's Encrypt. Staging: staging.controlp.io.

**GATE 4:** Full production launch checklist:
- All 4 gates passed
- Stripe in live mode
- Vendor API keys live
- Twilio number live, A2P 10DLC registered
- Transactional emails deliver (not spam)
- Backups: Supabase daily, Coolify volume snapshots
- Monitoring: Sentry for errors, Uptime Kuma for uptime
- ToS + Privacy Policy live

---

## Self-check format (every phase kickoff)

Before writing any code in a new phase, paste this back filled in:

```
PHASE: [number + name]
MOCKUP REFERENCE: [which mockups/*.html file(s)]
WHAT I'M BUILDING: [1-2 sentence summary]
DATA TABLES TOUCHED: [list]
NEW DEPENDENCIES (if any): [must be approved]
OPEN QUESTIONS: [things you need clarified before starting]
DONE LOOKS LIKE: [the visible outcome I can verify]
```

Wait for my "go" before touching code.

---

## Definition of Done

A page is done when:
1. It matches the mockup visually (spacing, typography, color tokens, icon styling)
2. It works on mobile + desktop (no horizontal scroll, tap-sized targets)
3. Data flows through Supabase (no hardcoded mocks in final build)
4. TypeScript has no errors, no `any`, no `@ts-ignore`
5. No console errors in browser
6. I've looked at it and said "ship it"
