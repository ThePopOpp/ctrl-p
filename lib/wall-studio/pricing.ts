// ─── Wall Studio pricing engine ─────────────────────────────────────────────
//
// Pure, deterministic, and DB-driven. All rates come in via `PricingRules`
// (loaded from ws_pricing_rules); `DEFAULT_PRICING_RULES` is the v1 seed and the
// tests' source of truth. The `computeInstall` arithmetic and ORDER OF OPERATIONS
// are ported verbatim from the prototype's `computeInstall` — do not "improve".
//
// Cutouts have no representation here by design: they never affect any price.

import type {
  InstallEstimate,
  InstallFactors,
  InstallInputs,
  InstallLine,
  PricingRules,
  WsCartItem,
  WsCategory,
  WsProduct,
} from "@/lib/wall-studio/types";

// ─── Formatting helpers (also used by the UI) ────────────────────────────────

export function money(n: number): string {
  return "$" + n.toFixed(2);
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// ─── v1 seed constants (spec §5) ─────────────────────────────────────────────

export const DEFAULT_PRICING_RULES: PricingRules = {
  minSqft: 25,
  installBaseRates: { wallpaper: 3.25, wall_wrap: 4.0, window_film: 3.0 },
  heightLadderThreshold: 10,
  heightLadderPct: 0.1,
  heightLiftThreshold: 14,
  heightLiftPct: 0.25,
  heightLiftFlat: 150,
  exteriorPct: 0.2,
  texturedPct: 0.15,
  repairPct: 0.1,
  repairFlat: 120,
  removalPerSqft: 1.25,
  cleaningPerSqft: 0.35,
  obstacleEach: 15,
  accessFlat: 75,
  travelFreeMiles: 15,
  travelPerMile: 2.0,
  rushPct: 0.25,
  rushWindowDays: 7,
  serviceFloor: 150,
};

/** Assemble PricingRules from ws_pricing_rules key/value rows, falling back to the seed. */
export function pricingRulesFromRows(rows: Array<{ key: string; value: unknown }>): PricingRules {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (key: string, fallback: number): number => {
    const v = map.get(key);
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const rates = map.get("install_base_rates");
  const base = DEFAULT_PRICING_RULES;
  return {
    minSqft: num("min_sqft", base.minSqft),
    installBaseRates:
      rates && typeof rates === "object"
        ? { ...base.installBaseRates, ...(rates as Partial<Record<WsCategory, number>>) }
        : base.installBaseRates,
    heightLadderThreshold: num("height_ladder_threshold", base.heightLadderThreshold),
    heightLadderPct: num("height_ladder_pct", base.heightLadderPct),
    heightLiftThreshold: num("height_lift_threshold", base.heightLiftThreshold),
    heightLiftPct: num("height_lift_pct", base.heightLiftPct),
    heightLiftFlat: num("height_lift_flat", base.heightLiftFlat),
    exteriorPct: num("exterior_pct", base.exteriorPct),
    texturedPct: num("textured_pct", base.texturedPct),
    repairPct: num("repair_pct", base.repairPct),
    repairFlat: num("repair_flat", base.repairFlat),
    removalPerSqft: num("removal_per_sqft", base.removalPerSqft),
    cleaningPerSqft: num("cleaning_per_sqft", base.cleaningPerSqft),
    obstacleEach: num("obstacle_each", base.obstacleEach),
    accessFlat: num("access_flat", base.accessFlat),
    travelFreeMiles: num("travel_free_miles", base.travelFreeMiles),
    travelPerMile: num("travel_per_mile", base.travelPerMile),
    rushPct: num("rush_pct", base.rushPct),
    rushWindowDays: num("rush_window_days", base.rushWindowDays),
    serviceFloor: num("service_floor", base.serviceFloor),
  };
}

// ─── Materials ───────────────────────────────────────────────────────────────

/** Raw square footage, rounded to 0.1 (matches prototype `Math.round(w*h*10)/10`). */
export function rawSqft(w: number, h: number): number {
  return Math.round(w * h * 10) / 10;
}

/** Billed square footage — raw, floored at the 25 sq ft per-panel minimum. */
export function billedSqft(w: number, h: number, rules: PricingRules): number {
  return Math.max(rules.minSqft, rawSqft(w, h));
}

/** Materials subtotal across the cart: Σ billed_sqft × price_per_sqft. */
export function cartMaterialsTotal(items: WsCartItem[], productsById: Record<string, WsProduct>): number {
  let total = 0;
  for (const it of items) {
    const p = productsById[it.productId];
    if (!p) continue;
    total += it.sqft * p.price_per_sqft;
  }
  return total;
}

// ─── Installation inputs ─────────────────────────────────────────────────────

/**
 * Derive install inputs from the cart: total sqft, tallest wall, and the
 * sqft-weighted blended base labor rate (by material). Returns null for an
 * empty cart. Rates come from `rules.installBaseRates` (DB-driven).
 */
export function cartInstallInputs(
  items: WsCartItem[],
  productsById: Record<string, WsProduct>,
  rules: PricingRules,
  factors: InstallFactors,
): InstallInputs | null {
  if (!items.length) return null;
  let sqft = 0;
  let maxHeightFt = 0;
  let rateWeighted = 0;
  for (const it of items) {
    const p = productsById[it.productId];
    if (!p) continue;
    sqft += it.sqft;
    maxHeightFt = Math.max(maxHeightFt, it.h);
    rateWeighted += it.sqft * rules.installBaseRates[p.category];
  }
  return { sqft, maxHeightFt, blendedBaseRate: sqft ? rateWeighted / sqft : 0, factors };
}

// ─── Installation computation (ported verbatim; order of operations preserved) ─

export function computeInstall(input: InstallInputs, rules: PricingRules): InstallEstimate {
  const { sqft, maxHeightFt, blendedBaseRate: baseRate, factors: f } = input;
  const lines: InstallLine[] = [];

  // 1. base labor
  const labor = sqft * baseRate;
  lines.push({ label: `Base labor — ${sqft} sq ft × ${money(baseRate)}`, amount: labor });

  // 2. percentage multipliers (height, exterior, condition) + their flat fees
  let mult = 1;
  let flats = 0;
  if (maxHeightFt > rules.heightLiftThreshold) {
    mult *= 1 + rules.heightLiftPct;
    flats += rules.heightLiftFlat;
    lines.push({
      label: `Lift / scaffold — walls over ${rules.heightLiftThreshold} ft (+${pct(rules.heightLiftPct)} & ${money(rules.heightLiftFlat)})`,
      amount: labor * rules.heightLiftPct + rules.heightLiftFlat,
    });
  } else if (maxHeightFt > rules.heightLadderThreshold) {
    mult *= 1 + rules.heightLadderPct;
    lines.push({
      label: `Ladder work — walls over ${rules.heightLadderThreshold} ft (+${pct(rules.heightLadderPct)})`,
      amount: labor * rules.heightLadderPct,
    });
  }
  if (f.location === "ext") {
    lines.push({ label: `Exterior conditions (+${pct(rules.exteriorPct)})`, amount: labor * rules.exteriorPct });
    mult *= 1 + rules.exteriorPct;
  }
  if (f.condition === "textured") {
    lines.push({ label: `Textured surface (+${pct(rules.texturedPct)})`, amount: labor * rules.texturedPct });
    mult *= 1 + rules.texturedPct;
  }
  if (f.condition === "damaged") {
    lines.push({
      label: `Surface repair (+${money(rules.repairFlat)} & +${pct(rules.repairPct)})`,
      amount: labor * rules.repairPct + rules.repairFlat,
    });
    mult *= 1 + rules.repairPct;
    flats += rules.repairFlat;
  }
  let sub = labor * mult + flats;

  // 3. per-sqft adders
  if (f.removal) {
    const a = sqft * rules.removalPerSqft;
    lines.push({ label: `Remove existing material — ${money(rules.removalPerSqft)}/sq ft`, amount: a });
    sub += a;
  }
  if (f.cleaning) {
    const a = sqft * rules.cleaningPerSqft;
    lines.push({ label: `Cleaning & prep — ${money(rules.cleaningPerSqft)}/sq ft`, amount: a });
    sub += a;
  }

  // 4. per-unit adders
  if (f.obstacles) {
    const a = f.obstacles * rules.obstacleEach;
    lines.push({ label: `Obstacles × ${f.obstacles} — ${money(rules.obstacleEach)} each`, amount: a });
    sub += a;
  }
  if (f.access) {
    lines.push({ label: `Difficult access`, amount: rules.accessFlat });
    sub += rules.accessFlat;
  }
  const extraMiles = Math.max(0, f.miles - rules.travelFreeMiles);
  if (extraMiles) {
    const a = extraMiles * rules.travelPerMile;
    lines.push({ label: `Travel — ${extraMiles} mi beyond ${rules.travelFreeMiles} free`, amount: a });
    sub += a;
  }

  // 5. rush % on the subtotal
  if (f.rush) {
    const a = sub * rules.rushPct;
    lines.push({ label: `Rush scheduling (+${pct(rules.rushPct)})`, amount: a });
    sub += a;
  }

  // 6. service-call floor
  if (sub < rules.serviceFloor && sqft > 0) {
    lines.push({ label: `Minimum service call`, amount: rules.serviceFloor - sub });
    sub = rules.serviceFloor;
  }

  return { lines, total: Math.round(sub * 100) / 100 };
}

// ─── Rush auto-flag from booking date ────────────────────────────────────────

/**
 * True when an install booked for `bookingDateISO` (yyyy-mm-dd) is inside the
 * rush window from `now` (ms). Ported verbatim: compares midday of the booking
 * date against now. User-overridable in the UI.
 */
export function isRushFromDate(bookingDateISO: string, now: number, rules: PricingRules): boolean {
  const d = new Date(bookingDateISO + "T12:00:00").getTime();
  return d - now < rules.rushWindowDays * 24 * 3600 * 1000;
}
