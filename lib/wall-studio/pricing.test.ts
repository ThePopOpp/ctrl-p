import { describe, expect, it } from "vitest";

import {
  billedSqft,
  cartInstallInputs,
  cartMaterialsTotal,
  computeInstall,
  DEFAULT_PRICING_RULES as R,
  isRushFromDate,
  pricingRulesFromRows,
  rawSqft,
} from "@/lib/wall-studio/pricing";
import type { InstallFactors, WsCartItem, WsProduct } from "@/lib/wall-studio/types";

const factors = (over: Partial<InstallFactors> = {}): InstallFactors => ({
  location: "int",
  condition: "good",
  obstacles: 0,
  miles: 0,
  removal: false,
  cleaning: false,
  access: false,
  rush: false,
  ...over,
});

const install = (over: Partial<{ sqft: number; maxHeightFt: number; rate: number; f: Partial<InstallFactors> }> = {}) =>
  computeInstall(
    {
      sqft: over.sqft ?? 100,
      maxHeightFt: over.maxHeightFt ?? 8,
      blendedBaseRate: over.rate ?? R.installBaseRates.wallpaper,
      factors: factors(over.f),
    },
    R,
  );

function product(id: string, over: Partial<WsProduct> = {}): WsProduct {
  return {
    id,
    slug: id,
    name: id,
    category: "wallpaper",
    price_per_sqft: 6.5,
    install_rate_per_sqft: 3.25,
    accent_hex: "#2f6b4f",
    blend_mode: "multiply",
    repeat_pattern: true,
    tile_url: null,
    tile_svg: null,
    active: true,
    ...over,
  };
}

// ─── Materials & the 25 sq ft minimum ────────────────────────────────────────

describe("materials & minimum", () => {
  it("rounds raw sqft to 0.1", () => {
    expect(rawSqft(3.33, 3)).toBe(10); // 9.99 -> 10.0
    expect(rawSqft(10, 8)).toBe(80);
  });

  it("floors billed sqft at the 25 sq ft minimum", () => {
    expect(billedSqft(3, 3, R)).toBe(25); // raw 9 -> 25
    expect(billedSqft(6, 6, R)).toBe(36); // raw 36 -> 36
    expect(billedSqft(5, 5, R)).toBe(25); // raw 25 -> 25 (boundary)
  });

  it("materials total = Σ billed_sqft × price_per_sqft", () => {
    const items: WsCartItem[] = [
      { productId: "a", w: 3, h: 3, sqft: 25 },
      { productId: "b", w: 10, h: 8, sqft: 80 },
    ];
    const byId = { a: product("a", { price_per_sqft: 6.5 }), b: product("b", { price_per_sqft: 8 }) };
    expect(cartMaterialsTotal(items, byId)).toBeCloseTo(25 * 6.5 + 80 * 8, 2); // 162.5 + 640
  });
});

// ─── Base labor per material ─────────────────────────────────────────────────

describe("base labor by material", () => {
  it("uses the per-material rate × sqft", () => {
    expect(install({ rate: R.installBaseRates.wallpaper }).total).toBe(325); // 100 × 3.25
    expect(install({ rate: R.installBaseRates.wall_wrap }).total).toBe(400); // 100 × 4.00
    expect(install({ rate: R.installBaseRates.window_film }).total).toBe(300); // 100 × 3.00
  });

  it("blends the base rate sqft-weighted across a mixed cart", () => {
    const items: WsCartItem[] = [
      { productId: "wp", w: 10, h: 8, sqft: 100 },
      { productId: "ww", w: 10, h: 9, sqft: 100 },
    ];
    const byId = {
      wp: product("wp", { category: "wallpaper" }),
      ww: product("ww", { category: "wall_wrap" }),
    };
    const input = cartInstallInputs(items, byId, R, factors())!;
    expect(input.sqft).toBe(200);
    expect(input.maxHeightFt).toBe(9);
    expect(input.blendedBaseRate).toBeCloseTo((100 * 3.25 + 100 * 4.0) / 200, 5); // 3.625
    expect(cartInstallInputs([], byId, R, factors())).toBeNull();
  });
});

// ─── Height ──────────────────────────────────────────────────────────────────

describe("height factor", () => {
  it("adds +10% ladder over 10 ft (strict)", () => {
    expect(install({ rate: 4, maxHeightFt: 10 }).total).toBe(400); // not > 10
    expect(install({ rate: 4, maxHeightFt: 12 }).total).toBe(440); // 400 × 1.10
  });

  it("adds +25% and +$150 lift over 14 ft (strict), not ladder", () => {
    expect(install({ rate: 4, maxHeightFt: 14 }).total).toBe(440); // ladder tier only
    const est = install({ rate: 4, maxHeightFt: 15 });
    expect(est.total).toBe(650); // 400 × 1.25 + 150
    const lift = est.lines.find((l) => l.label.includes("Lift"));
    expect(lift?.amount).toBeCloseTo(400 * 0.25 + 150, 2); // 250
  });
});

// ─── Location / condition ────────────────────────────────────────────────────

describe("location & surface condition", () => {
  it("exterior adds +20% to labor", () => {
    expect(install({ f: { location: "ext" } }).total).toBe(390); // 325 × 1.20
  });
  it("textured adds +15%", () => {
    expect(install({ f: { condition: "textured" } }).total).toBe(373.75); // 325 × 1.15
  });
  it("needs-repair adds +$120 and +10%", () => {
    expect(install({ f: { condition: "damaged" } }).total).toBe(477.5); // 325 × 1.10 + 120
  });
});

// ─── Per-sqft, per-unit, travel adders ───────────────────────────────────────

describe("adders", () => {
  it("removal +$1.25/sqft", () => expect(install({ f: { removal: true } }).total).toBe(450)); // 325 + 125
  it("cleaning +$0.35/sqft", () => expect(install({ f: { cleaning: true } }).total).toBe(360)); // 325 + 35
  it("obstacles $15 each", () => expect(install({ f: { obstacles: 2 } }).total).toBe(355)); // 325 + 30
  it("difficult access +$75", () => expect(install({ f: { access: true } }).total).toBe(400)); // 325 + 75

  it("travel is free for 15 miles, then $2/mi", () => {
    expect(install({ f: { miles: 8 } }).total).toBe(325);
    expect(install({ f: { miles: 15 } }).total).toBe(325); // boundary, still free
    expect(install({ f: { miles: 20 } }).total).toBe(335); // 5 × $2
  });
});

// ─── Rush + order of operations ──────────────────────────────────────────────

describe("rush & order of operations", () => {
  it("rush applies +25% to the subtotal AFTER all adders", () => {
    // sub = 325 + cleaning 35 + obstacles 30 = 390; rush = 97.5
    expect(install({ f: { cleaning: true, obstacles: 2, rush: true } }).total).toBe(487.5);
  });

  it("labor multipliers apply to labor only; a fully-loaded job matches the ported order", () => {
    const est = install({
      sqft: 100,
      maxHeightFt: 15,
      rate: 4,
      f: {
        location: "ext",
        condition: "textured",
        removal: true,
        cleaning: true,
        obstacles: 3,
        access: true,
        miles: 25,
        rush: true,
      },
    });
    // labor 400 × (1.25·1.20·1.15) + 150 = 840; +125 +35 +45 +75 +20 = 1140; ×1.25 = 1425
    expect(est.total).toBe(1425);
  });
});

// ─── Service floor ───────────────────────────────────────────────────────────

describe("service-call floor", () => {
  it("floors a small job at $150 with a make-up line", () => {
    const est = install({ sqft: 25, rate: R.installBaseRates.window_film, f: { cleaning: true } });
    // labor 75 + cleaning 8.75 = 83.75 -> floored to 150
    expect(est.total).toBe(150);
    const floorLine = est.lines.find((l) => l.label === "Minimum service call");
    expect(floorLine?.amount).toBeCloseTo(150 - 83.75, 2); // 66.25
  });

  it("does NOT apply the floor when sqft is 0", () => {
    expect(install({ sqft: 0 }).total).toBe(0);
  });
});

// ─── Cutouts never affect price ──────────────────────────────────────────────

describe("cutouts never affect price", () => {
  it("pricing has no cutout input — totals are identical for 0 vs N cutouts", () => {
    // Cutouts live entirely outside the pricing module (they aren't part of
    // InstallInputs or WsCartItem). Same wall + factors => same price, whatever
    // the number of cutouts drawn in the visualizer.
    const items: WsCartItem[] = [{ productId: "a", w: 10, h: 8, sqft: 80 }];
    const byId = { a: product("a") };

    const priceFor = (_cutoutCount: number) => {
      const materials = cartMaterialsTotal(items, byId);
      const install = computeInstall(cartInstallInputs(items, byId, R, factors())!, R).total;
      return materials + install;
    };

    expect(priceFor(0)).toBe(priceFor(5));
    expect(priceFor(0)).toBe(priceFor(25));
  });
});

// ─── Rush auto-flag from booking date ────────────────────────────────────────

describe("isRushFromDate", () => {
  const now = new Date("2026-07-17T12:00:00").getTime();
  it("flags rush strictly inside the 7-day window", () => {
    expect(isRushFromDate("2026-07-23", now, R)).toBe(true); // 6 days
    expect(isRushFromDate("2026-07-24", now, R)).toBe(false); // exactly 7 days (not <)
    expect(isRushFromDate("2026-07-25", now, R)).toBe(false); // 8 days
    expect(isRushFromDate("2026-07-18", now, R)).toBe(true); // next day
  });
});

// ─── DB-driven rules assembly ────────────────────────────────────────────────

describe("pricingRulesFromRows", () => {
  it("overrides seed values and falls back for missing keys", () => {
    const rules = pricingRulesFromRows([
      { key: "min_sqft", value: 30 },
      { key: "rush_pct", value: 0.5 },
      { key: "install_base_rates", value: { wallpaper: 4 } },
    ]);
    expect(rules.minSqft).toBe(30);
    expect(rules.rushPct).toBe(0.5);
    expect(rules.installBaseRates.wallpaper).toBe(4); // overridden
    expect(rules.installBaseRates.wall_wrap).toBe(4.0); // fallback from seed
    expect(rules.serviceFloor).toBe(150); // untouched fallback
  });
});
