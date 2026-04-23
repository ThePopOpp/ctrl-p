# controlp.io — Pricing Strategy

**Owner:** Jeremy Waters
**Last updated:** April 2026
**Applies to:** All products sold on controlp.io — in-house and vendor-fulfilled

This document defines exactly how retail prices are calculated from vendor or internal costs. The `lib/pricing/calculate.ts` module in the codebase implements these rules as a pure function.

---

## Core model: tiered margin by final price threshold

Retail prices are calculated from cost using a three-tier margin schedule. The margin percentage is **gross margin** (profit as a % of the retail price), not markup.

| Tier | Price range (retail) | Gross margin | Markup multiplier on cost |
|------|---------------------|--------------|---------------------------|
| 1    | Under $300          | **66%**      | 2.941× cost               |
| 2    | $300 to $999.99     | **50%**      | 2.0× cost                 |
| 3    | $1,000 and above    | **40%**      | 1.667× cost               |

### Why margin (not markup)

A 66% gross margin on a $100 retail item means $66 of that is profit and $34 is cost. To price it, we divide cost by (1 − margin):

```
retail_price = cost / (1 - margin)
```

| Margin | Divisor     | Example: $34 cost → retail |
|--------|-------------|----------------------------|
| 66%    | 1 − 0.66 = 0.34 | $34 / 0.34 = **$100.00** |
| 50%    | 1 − 0.50 = 0.50 | $100 / 0.50 = **$200.00** |
| 40%    | 1 − 0.40 = 0.60 | $400 / 0.60 = **$666.67** |

---

## The tier-selection problem

There's a circular dependency: the tier depends on the retail price, but the retail price depends on the tier. Solve it by evaluating tiers from highest margin to lowest and picking the first one whose resulting retail price falls inside its own range.

### Algorithm

```
1. Try Tier 1 (66% margin):
   candidate = cost / 0.34
   if candidate < $300 → use Tier 1, DONE
   else continue

2. Try Tier 2 (50% margin):
   candidate = cost / 0.50
   if candidate < $1000 → use Tier 2, DONE
   else continue

3. Fallback to Tier 3 (40% margin):
   candidate = cost / 0.60
   use Tier 3 unconditionally.
```

### Crossover cost thresholds

This algorithm produces two natural "cost crossover" points where the margin tier changes:

- **Cost < $102**: Tier 1 (66% margin) applies. At cost = $102, retail = $102/0.34 = $300.00 → boundary.
- **Cost $102 to $499.99**: Tier 2 (50% margin) applies. At cost = $500, retail = $500/0.50 = $1000.00 → boundary.
- **Cost ≥ $500**: Tier 3 (40% margin) applies.

Examples:

| Vendor cost | Tier selected | Retail price | Margin earned |
|-------------|--------------|--------------|---------------|
| $10         | Tier 1 (66%) | $29.41       | 66.0%         |
| $50         | Tier 1 (66%) | $147.06      | 66.0%         |
| $100        | Tier 1 (66%) | $294.12      | 66.0%         |
| $102        | **Boundary** — Tier 2 kicks in | $204.00 | 50.0% |
| $150        | Tier 2 (50%) | $300.00      | 50.0%         |
| $400        | Tier 2 (50%) | $800.00      | 50.0%         |
| $500        | **Boundary** — Tier 3 kicks in | $833.33 | 40.0% |
| $750        | Tier 3 (40%) | $1,250.00    | 40.0%         |
| $1,800      | Tier 3 (40%) | $3,000.00    | 40.0%         |

### The $102 cliff

At exactly cost = $102, the system shifts from 66% margin to 50% margin, which means:

- Cost $101.99 → retail $299.97 (Tier 1, earning $198 profit)
- Cost $102.01 → retail $204.02 (Tier 2, earning $102 profit)

**This is expected behavior** — high-margin products shouldn't creep past $300 retail, so the system caps them. But it also means you earn *less gross profit* on a $102 item than on a $101 item.

A future optimization is to apply a "smart smoothing" window around the boundaries: for costs within $5 of a crossover, round the retail price down to the tier boundary and keep it in the higher margin tier. This is documented but **not implemented in v1** — get pricing working cleanly first, then optimize.

---

## Reference implementation

```typescript
// lib/pricing/tiers.ts

export type MarginTier = {
  name: string;
  margin: number;      // e.g. 0.66
  maxRetail: number;   // e.g. 300 (exclusive upper bound)
};

export const MARGIN_TIERS: MarginTier[] = [
  { name: 'tier-1', margin: 0.66, maxRetail: 300 },
  { name: 'tier-2', margin: 0.50, maxRetail: 1000 },
  { name: 'tier-3', margin: 0.40, maxRetail: Infinity },
];

export function selectTier(cost: number): MarginTier {
  for (const tier of MARGIN_TIERS) {
    const candidate = cost / (1 - tier.margin);
    if (candidate < tier.maxRetail) return tier;
  }
  return MARGIN_TIERS[MARGIN_TIERS.length - 1];
}
```

```typescript
// lib/pricing/calculate.ts

import { selectTier } from './tiers';

export type PricingInput = {
  baseCost: number;           // vendor cost or internal cost for the item
  optionCosts: number[];      // each upsell adds its own cost
  quantity: number;
  turnaround: 'standard' | 'rush' | 'sameday';
};

export type PricingOutput = {
  unitCost: number;
  unitPrice: number;
  tier: string;
  marginApplied: number;
  turnaroundFee: number;
  subtotal: number;           // unitPrice × quantity
  total: number;              // subtotal + turnaround fee
  profit: number;             // total - (unitCost × qty) - vendor turnaround surcharge
};

const TURNAROUND_FEES = {
  standard: 0,
  rush: 15,
  sameday: 35,
};

export function calculatePrice(input: PricingInput): PricingOutput {
  const unitCost = input.baseCost + input.optionCosts.reduce((a, b) => a + b, 0);
  const tier = selectTier(unitCost);
  const unitPrice = +(unitCost / (1 - tier.margin)).toFixed(2);
  const subtotal = +(unitPrice * input.quantity).toFixed(2);
  const turnaroundFee = TURNAROUND_FEES[input.turnaround];
  const total = +(subtotal + turnaroundFee).toFixed(2);
  const profit = +(total - (unitCost * input.quantity)).toFixed(2);

  return {
    unitCost: +unitCost.toFixed(2),
    unitPrice,
    tier: tier.name,
    marginApplied: tier.margin,
    turnaroundFee,
    subtotal,
    total,
    profit,
  };
}
```

---

## Required unit tests

`lib/pricing/__tests__/calculate.test.ts` must cover every case in the table below. All tests must pass before Gate 1 is cleared.

| Test case              | Input (cost) | Expected tier | Expected unit price |
|------------------------|--------------|---------------|---------------------|
| Cheap item             | $10          | tier-1 (66%)  | $29.41              |
| Mid-tier-1             | $50          | tier-1 (66%)  | $147.06             |
| Right below crossover  | $101.99      | tier-1 (66%)  | $299.97             |
| At crossover           | $102.00      | tier-2 (50%)  | $204.00             |
| Mid-tier-2             | $250         | tier-2 (50%)  | $500.00             |
| Right below T3 crossover | $499.99    | tier-2 (50%)  | $999.98             |
| At T3 crossover        | $500.00      | tier-3 (40%)  | $833.33             |
| Vehicle wrap            | $1,800       | tier-3 (40%)  | $3,000.00           |

Plus separate test coverage for:
- Option costs compound correctly (base cost + all selected options)
- Quantity multiplies subtotal (no quantity discount in v1)
- Turnaround fees apply after subtotal, not per unit
- Profit calculation is accurate to the cent

---

## Quantity break tiers (v2 — not in initial launch)

In v1, unit price is constant regardless of quantity. In v2, we'll introduce quantity discounts that **reduce the unit price** for larger orders. This is noted here so the schema is designed to support it on day one.

Planned v2 tiers (not active yet):

| Quantity     | Unit price adjustment |
|--------------|-----------------------|
| 1–9          | 0% (base price)       |
| 10–49        | −5%                   |
| 50–99        | −10%                  |
| 100–499      | −15%                  |
| 500+         | −20% (but not below cost + 20%) |

Note: the floor clause — *never below cost + 20%* — protects against the quantity discount compounding with the low-margin tier and eating all profit.

Schema support: the `pricing_rules` table should already include a `quantity_break_tiers` JSONB column that's NULL in v1. Admin UI for editing these comes in Phase 3.

---

## Rush and turnaround modifiers

Turnaround is a flat per-order fee, not a per-unit percentage:

| Turnaround   | Fee     | Impact on delivery |
|--------------|---------|--------------------|
| Standard     | $0      | Vendor/internal standard (3–5 days) |
| Rush         | +$15    | 1–2 business days |
| Same-day     | +$35    | Local pickup only, order before 2pm MST |

Rush fees are flat regardless of order size. This is intentional — the operational cost of rushing is roughly constant per job, not proportional to order value.

---

## Category overrides (v2 — not in initial launch)

Some categories will eventually need to override the default 3-tier schedule:

- **Vehicle wraps**: cost + $1,200 fixed labor + 30% markup on parts (not a margin calc)
- **Design services**: flat $85/hr billable, no markup tier
- **Rush-only services** (same-day banner): 80% margin floor

These are documented for Phase 3 when the admin pricing UI is built. The `pricing_rules` table schema includes a `category_override` JSONB column for per-category rule sets. In v1, this is NULL everywhere and the 3-tier default applies globally.

---

## Shipping

Shipping is handled separately from product pricing:

- **Free shipping** on all orders ≥ $75 subtotal
- **Flat $8.95** on orders < $75 (covers most small-parcel shipments)
- **Freight quote required** (manual) for:
  - Banners > 10 ft in any dimension
  - Rigid signs > 4 ft
  - Orders weighing > 50 lbs total
  - Vehicle wrap installations (not applicable — on-site service)

Shipping does not factor into the margin tier selection. Tier is based on product cost only.

---

## Tax

Tax is calculated at checkout based on ship-to state:

- **Arizona orders**: 8.6% state + local sales tax (combined)
- **Other states**: no tax collected in v1 (nexus-dependent — revisit at $100k annual out-of-state revenue)
- **Tax-exempt customers**: upload resale certificate to their account; flag applies to all future orders automatically

Tax does not affect margin calculations.

---

## Where pricing is computed

The `calculatePrice()` function is called from exactly these places — never inlined or reimplemented:

1. **Product configurator** (`app/(marketing)/products/[slug]/page.tsx`) — live update on every option change
2. **Cart page** (`app/cart/page.tsx`) — re-verify on load
3. **Checkout** (`app/checkout/page.tsx`) — re-verify before Stripe session creation
4. **Admin order creation** (`app/admin/orders/new/page.tsx`) — manual order entry
5. **Stripe webhook** (`app/api/webhooks/stripe/route.ts`) — re-verify server-side as final check

All five call sites must produce identical results for identical inputs. A pricing mismatch between configurator and checkout is a P0 bug.

---

## Storing prices on orders

When an order is created, the line items store both `unit_cost` and `unit_price` as frozen snapshots. Future margin tier changes do not retroactively alter past orders. This is why:

1. Historical reporting stays accurate even after pricing changes
2. Disputes over "but the price was different yesterday" are unambiguous
3. Tax and refund calculations remain stable

The `orders` table should never recalculate pricing after creation. The `admin/pricing` UI explicitly warns: *"Changes apply to future quotes only."*

---

## Changelog

- **v1 (launch)**: Three-tier margin schedule (66 / 50 / 40), flat turnaround fees, no quantity breaks
- **v2 (planned Q3 2026)**: Quantity break tiers, category overrides for vehicle wraps + design services, smart smoothing at tier boundaries
