# controlp.io — Vendor Integrations

controlp.io fulfills orders through three paths:
1. **In-house** — vehicle wraps, specialty large format, rush/local jobs
2. **4Over** — business cards, flyers, postcards, apparel, standard print
3. **B2Sign** — large format banners, signs, trade show displays

This document covers the integration strategy for 4Over and B2Sign. In-house fulfillment is managed through the admin production queue and doesn't need external API integration.

---

## Important: Do NOT scrape vendor websites

Both 4Over and B2Sign are reseller partners. Their pricing and product data lives behind authenticated portals, and scraping it violates our reseller agreements. These are critical supply-chain relationships — don't jeopardize them.

**How we get vendor data:**

1. Jeremy logs into the 4Over and B2Sign reseller portals manually and exports their pricing sheets (both offer CSV export).
2. The CSVs get loaded into a `vendor_pricing` Supabase table via an admin upload UI.
3. Cowork builds the table schema, upload UI, and cost lookup logic — **but not the data ingestion itself**. Data entry is Jeremy's responsibility.

---

## Vendor cost data model

### `vendor_pricing` table

```sql
CREATE TABLE vendor_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL CHECK (vendor IN ('4over', 'b2sign')),
  vendor_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  size TEXT,                          -- "3x6", "4x8", custom-per-inch
  material TEXT,                      -- "13oz vinyl", "16pt cardstock", etc.
  finish TEXT,                        -- "gloss", "matte", null
  quantity_tier_min INT NOT NULL,     -- 1, 100, 500, 1000, etc.
  quantity_tier_max INT,              -- null for "unlimited"
  base_cost DECIMAL(10,2) NOT NULL,   -- vendor cost in USD
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  UNIQUE (vendor, vendor_sku, size, material, finish, quantity_tier_min)
);

CREATE INDEX idx_vendor_pricing_lookup
  ON vendor_pricing (vendor, vendor_sku, quantity_tier_min);
```

### Mapping our products to vendor SKUs

Our internal `products` table has a `vendor` column (`in_house`, `4over`, or `b2sign`) and a `vendor_sku` column. When pricing a configured item, the lookup goes:

```
our_product → vendor + vendor_sku → vendor_pricing row → base_cost
```

The base_cost then flows into `lib/pricing/calculate.ts` per `reference/pricing-strategy.md`.

---

## 4Over integration

### API docs
Reseller API docs: https://4over.com/api (requires authenticated reseller account to access)

4Over API notes:
- REST-based, JSON payloads
- Authentication via API key in header (`X-API-Key`)
- Artwork uploads are multi-part to a separate endpoint, returning a file ID that's then referenced in the order submission
- Status polling only — no webhooks

### Module: `lib/vendors/4over.ts`

```typescript
export interface FourOverClient {
  submitOrder(orderItem: OrderItem): Promise<{ vendor_order_id: string }>;
  syncStatus(vendor_order_id: string): Promise<VendorStatus>;
  uploadArtwork(file: Buffer, mime: string): Promise<{ file_id: string }>;
  cancelOrder(vendor_order_id: string): Promise<void>;
}
```

### Submission flow

1. Customer places order → payment succeeds via Stripe webhook
2. For each `order_item` where `product.vendor = '4over'`:
   a. Upload artwork PDF to 4Over via `uploadArtwork()`
   b. Build order submission payload (SKU, size, material, finish, options, shipping address)
   c. Call `submitOrder()`, get back vendor order ID
   d. Create `vendor_jobs` row: `{ order_item_id, vendor: '4over', vendor_order_id, vendor_status: 'submitted', sync_state: 'pending' }`
3. Every 15 minutes, cron runs `syncStatus()` on all open `vendor_jobs` rows
4. When status becomes `shipped`, update `shipments` table with tracking info
5. Notify customer via SMS + email

### Error handling
- Rate limit (429): exponential backoff, max 5 retries
- Artwork rejection: set `vendor_jobs.vendor_status = 'artwork_rejected'`, email customer to re-upload
- Order rejection (any other reason): set status to `failed`, alert admin via dashboard
- Network timeout: retry once, then leave `sync_state = 'pending_retry'` for next cron run

### Testing
4Over has a sandbox environment (`api-sandbox.4over.com`). Use this for all dev + staging. Production URL: `api.4over.com`. Environment-specific base URL set via `VENDOR_4OVER_API_URL` env var.

---

## B2Sign integration

### API docs
Reseller API docs: https://www.b2sign.com/api (requires authenticated reseller account)

B2Sign API notes:
- REST-based, XML or JSON (we use JSON)
- Authentication via OAuth 2.0 — obtain access token, refresh before expiry
- Artwork uploads via their file service — returns a URL that gets referenced in the order
- Supports webhooks for status updates (**prefer webhooks over polling when available**)

### Module: `lib/vendors/b2sign.ts`

Same interface as 4Over module, but with OAuth token management:

```typescript
export interface B2SignClient {
  submitOrder(orderItem: OrderItem): Promise<{ vendor_order_id: string }>;
  syncStatus(vendor_order_id: string): Promise<VendorStatus>;
  uploadArtwork(file: Buffer, mime: string): Promise<{ file_url: string }>;
  cancelOrder(vendor_order_id: string): Promise<void>;

  // OAuth
  getAccessToken(): Promise<string>;
  refreshToken(): Promise<void>;
}
```

### Webhooks

B2Sign supports webhook callbacks on status changes. Register the webhook URL during setup:

```
POST https://controlp.io/api/webhooks/b2sign
```

Webhook handler in `app/api/webhooks/b2sign/route.ts`:
1. Verify signature (HMAC-SHA256 with shared secret)
2. Parse status update payload
3. Update matching `vendor_jobs` row
4. Trigger downstream notifications (SMS, email)

### Polling fallback
Even with webhooks, poll every 60 minutes as a safety net. Missed webhooks happen.

---

## Shared module: `lib/vendors/shared.ts`

Both 4Over and B2Sign clients share common types and utilities:

```typescript
export type VendorStatus =
  | 'submitted'
  | 'in_production'
  | 'artwork_rejected'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type VendorName = '4over' | 'b2sign';

export type VendorOrderItem = {
  vendor_sku: string;
  size: string;
  material: string;
  finish: string;
  options: Record<string, string | boolean>;
  quantity: number;
  artwork_file_ref: string;
  shipping_address: Address;
  turnaround: 'standard' | 'rush' | 'sameday';
};

export function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; backoffMs: number }
): Promise<T> {
  /* exponential backoff wrapper */
}
```

---

## Vendor sync dashboard

The admin dashboard (`mockups/14-admin.html`) has a vendor sync panel showing:

- **4Over:** Last synced timestamp, count of pending orders, count of errors
- **B2Sign:** Last synced timestamp, count of pending orders, count of errors
- **Max Pro:** "Manual" (in-house fulfillment, no API)

Each card has a "Sync now" button that triggers an immediate poll, bypassing the cron schedule.

Failed syncs show in a separate "Attention needed" list with:
- Order item reference
- Error message from vendor
- Retry button
- "Mark as manual" button (removes from auto-sync, assumes admin will handle externally)

---

## Admin UI for vendor pricing

Located at `app/admin/vendors/pricing/page.tsx`:

1. **Upload CSV** dropzone — Jeremy uploads 4Over or B2Sign price sheet
2. **Preview table** shows parsed rows with validation errors highlighted
3. **Import** button writes to `vendor_pricing` table with `last_updated = NOW()`
4. **Search/filter** to find specific SKUs, sizes, quantities
5. **Manual edit** for one-off overrides (with audit log)

CSV format expected (column headers must match):
```csv
vendor_sku,product_name,size,material,finish,quantity_tier_min,quantity_tier_max,base_cost,notes
4O-BC-14PT-4x6,Standard Business Card,4x6,14pt C2S,gloss,100,499,8.50,
4O-BC-14PT-4x6,Standard Business Card,4x6,14pt C2S,gloss,500,999,12.00,
...
```

---

## Product catalog: first-pass mapping

For initial launch, map these controlp.io products to their vendor equivalents:

| controlp.io product       | Vendor  | Approx vendor SKU prefix |
|---------------------------|---------|--------------------------|
| Business cards (standard) | 4Over   | 4O-BC-*                  |
| Business cards (premium)  | 4Over   | 4O-BC-PREM-*             |
| Flyers                    | 4Over   | 4O-FL-*                  |
| Postcards                 | 4Over   | 4O-PC-*                  |
| Custom apparel (t-shirts) | 4Over   | 4O-APP-*                 |
| Yard signs                | 4Over   | 4O-YS-*                  |
| Vinyl banners             | B2Sign  | B2-BAN-VINYL-*           |
| Mesh banners              | B2Sign  | B2-BAN-MESH-*            |
| Retractable stands        | B2Sign  | B2-STAND-*               |
| Pole banners              | B2Sign  | B2-POLE-*                |
| A-frame signs             | In-house | n/a                     |
| Vehicle wraps             | In-house | n/a                     |
| Large format (custom)     | In-house | n/a                     |

The exact vendor SKUs come from the CSV imports — Cowork does not need to hardcode them.

---

## Environment variables

See `reference/env.example` for the full list. Vendor-specific:

```
VENDOR_4OVER_API_URL=https://api-sandbox.4over.com
VENDOR_4OVER_API_KEY=
VENDOR_B2SIGN_API_URL=https://api.b2sign.com
VENDOR_B2SIGN_CLIENT_ID=
VENDOR_B2SIGN_CLIENT_SECRET=
VENDOR_B2SIGN_WEBHOOK_SECRET=
```
