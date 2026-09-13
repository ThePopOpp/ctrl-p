// ─── Margin-band tier selection ─────────────────────────────────────────────
//
// controlp.io has two pricing models in play and they answer different
// questions, so both are seeded into `pricing_tiers` (see spec §7.6 open
// question 4 and reference/pricing-strategy.md):
//
//   A / B / C   — markup assigned by CATEGORY. A category's tier is the rule;
//                 cost does not change which tier applies. This is the card
//                 builder's default model.
//   M1 / M2 / M3 — gross-margin bands selected by the RESULTING RETAIL price.
//                 The long-standing controlp.io schedule: 66% under $300,
//                 50% under $1,000, 40% above.
//
// The band model has a circular dependency — the band depends on retail, retail
// depends on the band — resolved by trying bands highest-margin first and
// taking the first one whose own retail lands inside its range.

import type { PricingTier } from "@/lib/pricing/types";
import { roundCents } from "@/lib/pricing/calculate";

export type MarginBand = {
  /** Matches the seeded `pricing_tiers.code`. */
  code: string;
  name: string;
  /** Gross margin as a fraction, e.g. 0.66. */
  margin: number;
  /** Exclusive upper bound on retail. Infinity for the last band. */
  maxRetail: number;
};

export const MARGIN_BANDS: readonly MarginBand[] = [
  { code: "M1", name: "Band 1 — 66% margin", margin: 0.66, maxRetail: 300 },
  { code: "M2", name: "Band 2 — 50% margin", margin: 0.5, maxRetail: 1000 },
  { code: "M3", name: "Band 3 — 40% margin", margin: 0.4, maxRetail: Infinity },
];

/** The band whose resulting retail falls inside its own range. */
export function selectMarginBand(cost: number): MarginBand {
  for (const band of MARGIN_BANDS) {
    if (cost / (1 - band.margin) < band.maxRetail) return band;
  }
  return MARGIN_BANDS[MARGIN_BANDS.length - 1];
}

/** retail = cost / (1 − margin). */
export function retailForMarginBand(cost: number, band: MarginBand): number {
  return roundCents(cost / (1 - band.margin));
}

/** Cost → retail under the margin-band schedule, with the band that produced it. */
export function priceByMarginBand(cost: number): { band: MarginBand; retail: number } {
  const band = selectMarginBand(cost);
  return { band, retail: retailForMarginBand(cost, band) };
}

/**
 * Convert a margin-band tier into the markup the engine consumes, so a category
 * on the band model prices through exactly the same code path as one on the
 * A/B/C model. markup = margin / (1 − margin).
 */
export function bandAsTier(band: MarginBand, seeded: PricingTier[]): PricingTier | null {
  const row = seeded.find((t) => t.code === band.code);
  if (!row) return null;
  return { ...row, default_markup_pct: (band.margin / (1 - band.margin)) * 100 };
}

/** True when this tier row is one of the retail-band tiers rather than A/B/C. */
export function isMarginBandTier(tier: Pick<PricingTier, "code">): boolean {
  return MARGIN_BANDS.some((b) => b.code === tier.code);
}
