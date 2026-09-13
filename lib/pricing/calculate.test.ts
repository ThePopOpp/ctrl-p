import { describe, expect, it } from "vitest";

import {
  applyRounding,
  computeRetail,
  computeVariantPricing,
  evaluateGuards,
  marginFromCostRetail,
  marginFromMarkup,
  markupFromMargin,
  resolveMarkupRule,
  roundCents,
  startingAtPrice,
} from "@/lib/pricing/calculate";
import { MARGIN_BANDS, priceByMarginBand, selectMarginBand } from "@/lib/pricing/tiers";
import type { MarkupRule, PricingTier, RoundingRule } from "@/lib/pricing/types";

const tier = (over: Partial<PricingTier> = {}): PricingTier => ({
  id: "tier-1",
  code: "B",
  name: "Standard",
  description: null,
  default_markup_pct: 75,
  default_markup_flat: 0,
  min_margin_pct: 35,
  rounding_rule: "none",
  is_default: false,
  is_active: true,
  sort_order: 20,
  ...over,
});

const rule = (over: Partial<MarkupRule> = {}): MarkupRule => ({
  markupPct: 0,
  markupFlat: 0,
  roundingRule: "none",
  minMarginPct: null,
  origin: "tier",
  sourceLabel: "Tier B default",
  ...over,
});

// ─── Spec §7.2 — the table that must never regress ──────────────────────────

describe("markup and margin (spec §7.2)", () => {
  const cases: Array<{ cost: number; markup: number; retail: number; margin: number }> = [
    { cost: 10.0, markup: 50, retail: 15.0, margin: 33.3 },
    { cost: 10.0, markup: 100, retail: 20.0, margin: 50.0 },
    { cost: 10.0, markup: 150, retail: 25.0, margin: 60.0 },
    { cost: 42.5, markup: 65, retail: 70.13, margin: 39.4 },
  ];

  for (const c of cases) {
    it(`cost ${c.cost} at ${c.markup}% markup → ${c.retail} retail, ${c.margin}% margin`, () => {
      const result = computeRetail(c.cost, rule({ markupPct: c.markup }));
      expect(result.unitRetail).toBe(c.retail);
      expect(result.marginPct).toBe(c.margin);
    });
  }

  it("a 50% markup yields a 33.3% margin", () => {
    expect(Math.round(marginFromMarkup(50) * 10) / 10).toBe(33.3);
  });

  it("a 50% margin requires a 100% markup", () => {
    expect(markupFromMargin(50)).toBe(100);
  });

  it("markup and margin round-trip", () => {
    for (const markup of [10, 40, 65, 75, 125, 194.12]) {
      expect(markupFromMargin(marginFromMarkup(markup))).toBeCloseTo(markup, 6);
    }
  });

  it("margin is measured against retail, not cost", () => {
    expect(marginFromCostRetail(10, 15)).toBeCloseTo(33.333, 3);
  });
});

// ─── Spec §7.4 — rounding ───────────────────────────────────────────────────

describe("rounding rules (spec §7.4)", () => {
  const expected: Array<[RoundingRule, number]> = [
    ["none", 70.13],
    ["nearest_dollar", 70.0],
    ["nearest_five", 70.0],
    ["charm_99", 70.99],
    ["charm_95", 70.95],
    ["round_up_dollar", 71.0],
  ];

  for (const [ruleName, want] of expected) {
    it(`${ruleName}: 70.13 → ${want}`, () => {
      expect(roundCents(applyRounding(70.13, ruleName))).toBe(want);
    });
  }

  it("charm rules round UP — never down, which would eat margin per unit", () => {
    expect(applyRounding(70.0, "charm_99")).toBe(70.99);
    expect(applyRounding(71.0, "charm_99")).toBe(71.99);
    // Already sitting on the charm point: stay put rather than jump a dollar.
    expect(applyRounding(70.99, "charm_99")).toBe(70.99);
    // A cent past it: climb to the next dollar's charm point.
    expect(applyRounding(71.0, "charm_95")).toBe(71.95);
    expect(applyRounding(70.96, "charm_95")).toBe(71.95);
  });

  it("nearest_five is nearest $5, not nearest five cents", () => {
    expect(applyRounding(72.6, "nearest_five")).toBe(75);
    expect(applyRounding(71.9, "nearest_five")).toBe(70);
  });
});

// ─── Spec §7.3 — order of operations ────────────────────────────────────────

describe("calculation order (spec §7.3)", () => {
  it("applies percentage to cost first, then flat dollars, then rounding", () => {
    // 100 × 1.50 = 150, + 10 flat = 160, charm_99 → 160.99.
    const result = computeRetail(100, rule({ markupPct: 50, markupFlat: 10, roundingRule: "charm_99" }));
    expect(result.base).toBe(150);
    expect(result.preRounding).toBe(160);
    expect(result.unitRetail).toBe(160.99);
  });

  it("does not apply the percentage to the flat amount", () => {
    const withFlat = computeRetail(100, rule({ markupPct: 50, markupFlat: 10 }));
    const flatFirst = computeRetail(110, rule({ markupPct: 50 }));
    expect(withFlat.unitRetail).toBe(160);
    expect(flatFirst.unitRetail).toBe(165);
  });

  it("accepts negative flat amounts as a discount off the marked-up price", () => {
    const result = computeRetail(100, rule({ markupPct: 100, markupFlat: -25 }));
    expect(result.unitRetail).toBe(175);
    expect(result.blocked).toBe(false);
  });

  it("reports the markup the rounded price actually represents", () => {
    const result = computeRetail(42.5, rule({ markupPct: 65, roundingRule: "charm_99" }));
    expect(result.preRounding).toBe(70.13);
    expect(result.unitRetail).toBe(70.99);
    // 70.99 against 42.50 is more than the 65% asked for — the widget shows this.
    expect(result.effectiveMarkupPct).toBe(67);
  });
});

// ─── Spec §7.5 — guards ─────────────────────────────────────────────────────

describe("guards (spec §7.5)", () => {
  it("blocks retail below cost", () => {
    const result = computeRetail(100, rule({ markupPct: -20 }));
    expect(result.unitRetail).toBe(80);
    expect(result.blocked).toBe(true);
    expect(result.guards[0].code).toBe("below_cost");
  });

  it("warns below the tier margin floor without blocking", () => {
    // 25% markup on $100 → $125 retail → 20% margin, under a 35% floor.
    const result = computeRetail(100, rule({ markupPct: 25, minMarginPct: 35 }));
    expect(result.blocked).toBe(false);
    expect(result.guards.map((g) => g.code)).toContain("under_margin_floor");
    expect(result.guards[0].severity).toBe("warn");
  });

  it("does not warn when margin sits exactly on the floor", () => {
    // 100% markup → 50% margin, floor 50%.
    const result = computeRetail(100, rule({ markupPct: 100, minMarginPct: 50 }));
    expect(result.guards).toHaveLength(0);
  });

  it("warns above the 500% sanity ceiling without blocking", () => {
    const result = computeRetail(10, rule({ markupPct: 900 }));
    expect(result.blocked).toBe(false);
    expect(result.guards.map((g) => g.code)).toContain("markup_ceiling");
  });

  it("names the numbers in the block message so staff can act on it", () => {
    const [guard] = evaluateGuards(50, 40, null);
    expect(guard.message).toContain("$40.00");
    expect(guard.message).toContain("$50.00");
  });
});

// ─── Rule resolution ────────────────────────────────────────────────────────

describe("markup rule resolution", () => {
  it("inherits from the category tier when nothing overrides", () => {
    const resolved = resolveMarkupRule({ tier: tier({ code: "B", default_markup_pct: 75 }) });
    expect(resolved.markupPct).toBe(75);
    expect(resolved.origin).toBe("tier");
    expect(resolved.sourceLabel).toBe("Tier B default");
  });

  it("card override beats the tier", () => {
    const resolved = resolveMarkupRule({ card: { markup_pct: 90 }, tier: tier() });
    expect(resolved.markupPct).toBe(90);
    expect(resolved.origin).toBe("card_override");
  });

  it("variant override beats the card", () => {
    const resolved = resolveMarkupRule({
      variant: { markup_pct: 40 },
      card: { markup_pct: 90 },
      tier: tier(),
    });
    expect(resolved.markupPct).toBe(40);
    expect(resolved.origin).toBe("variant_override");
  });

  it("a partial override still inherits the other half of the rule", () => {
    const resolved = resolveMarkupRule({
      card: { markup_flat: 5 },
      tier: tier({ default_markup_pct: 75 }),
    });
    expect(resolved.markupPct).toBe(75);
    expect(resolved.markupFlat).toBe(5);
    expect(resolved.origin).toBe("card_override");
  });

  it("treats an explicit 0 as an override, not as absent", () => {
    const resolved = resolveMarkupRule({ card: { markup_pct: 0 }, tier: tier() });
    expect(resolved.markupPct).toBe(0);
    expect(resolved.origin).toBe("card_override");
  });

  it("falls back to cost with a visible explanation when no tier is assigned", () => {
    const resolved = resolveMarkupRule({});
    expect(resolved.origin).toBe("fallback");
    expect(resolved.sourceLabel).toMatch(/no tier/i);
  });

  it("card rounding rule beats the tier's", () => {
    const resolved = resolveMarkupRule({
      card: { rounding_rule: "charm_95" },
      tier: tier({ rounding_rule: "charm_99" }),
    });
    expect(resolved.roundingRule).toBe("charm_95");
  });
});

// ─── Variants ───────────────────────────────────────────────────────────────

describe("variant pricing", () => {
  it("prices the spec §6 business card table", () => {
    const card = { rounding_rule: "charm_99" as RoundingRule };
    const t = tier({ code: "A", default_markup_pct: 40, min_margin_pct: 25, rounding_rule: "charm_99" });
    const rows = [18.0, 24.0, 34.0, 31.0].map((unit_cost) =>
      computeVariantPricing({ unit_cost, quantity: 1 }, card, t),
    );
    expect(rows.map((r) => r.unitRetail)).toEqual([25.99, 33.99, 47.99, 43.99]);
  });

  it("keeps unit and extended prices separate", () => {
    const result = computeVariantPricing({ unit_cost: 2.5, quantity: 500 }, null, tier({ default_markup_pct: 100 }));
    expect(result.unitRetail).toBe(5);
    expect(result.extendedRetail).toBe(2500);
    expect(result.extendedCost).toBe(1250);
  });

  it("treats a missing or zero quantity as 1 rather than zeroing the line", () => {
    const result = computeVariantPricing({ unit_cost: 10, quantity: 0 }, null, tier({ default_markup_pct: 100 }));
    expect(result.quantity).toBe(1);
    expect(result.extendedRetail).toBe(20);
  });

  it("a retail override bypasses the computation but still reports margin", () => {
    const result = computeVariantPricing(
      { unit_cost: 10, quantity: 1, retail_override: 12 },
      null,
      tier({ default_markup_pct: 100 }),
    );
    expect(result.overrideApplied).toBe(true);
    expect(result.unitRetail).toBe(12);
    expect(result.marginPct).toBe(16.7);
  });

  it("a below-cost override warns rather than blocks — it is a deliberate act", () => {
    const result = computeVariantPricing(
      { unit_cost: 10, quantity: 1, retail_override: 8 },
      null,
      tier({ default_markup_pct: 100 }),
    );
    expect(result.blocked).toBe(false);
    expect(result.guards.map((g) => g.code)).toContain("below_cost");
  });

  it("starting-at price is the lowest available variant retail", () => {
    expect(
      startingAtPrice([
        { unitRetail: 47.99 },
        { unitRetail: 25.99 },
        { unitRetail: 33.99 },
      ]),
    ).toBe(25.99);
  });

  it("starting-at price ignores unavailable variants", () => {
    expect(
      startingAtPrice([
        { unitRetail: 19.99, is_available: false },
        { unitRetail: 25.99 },
      ]),
    ).toBe(25.99);
  });

  it("starting-at price is null when nothing is priced", () => {
    expect(startingAtPrice([])).toBeNull();
  });
});

// ─── Margin bands (reference/pricing-strategy.md) ───────────────────────────

describe("margin-band schedule", () => {
  const cases: Array<[cost: number, code: string, retail: number]> = [
    [10, "M1", 29.41],
    [50, "M1", 147.06],
    [101.99, "M1", 299.97],
    [102, "M2", 204.0],
    [250, "M2", 500.0],
    [499.99, "M2", 999.98],
    [500, "M3", 833.33],
    [1800, "M3", 3000.0],
  ];

  for (const [cost, code, retail] of cases) {
    it(`cost ${cost} → ${code} at ${retail}`, () => {
      const result = priceByMarginBand(cost);
      expect(result.band.code).toBe(code);
      expect(result.retail).toBe(retail);
    });
  }

  it("falls through to the last band when nothing else fits", () => {
    expect(selectMarginBand(1_000_000).code).toBe(MARGIN_BANDS[MARGIN_BANDS.length - 1].code);
  });

  it("band markups match what the engine computes", () => {
    // M2 is a 50% margin, seeded as a 100% markup — same retail either way.
    const viaEngine = computeRetail(250, rule({ markupPct: 100 }));
    expect(viaEngine.unitRetail).toBe(priceByMarginBand(250).retail);
  });
});

// ─── Float behaviour ────────────────────────────────────────────────────────

describe("money rounding", () => {
  it("rounds half up rather than inheriting binary float error", () => {
    expect(roundCents(70.125)).toBe(70.13);
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(0.615)).toBe(0.62);
  });

  it("handles negatives symmetrically", () => {
    expect(roundCents(-70.125)).toBe(-70.13);
  });
});
