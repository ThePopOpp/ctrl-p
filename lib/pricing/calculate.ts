// ─── Product Card Builder — pricing engine ──────────────────────────────────
//
// Pure and deterministic. Every retail price in the card builder comes from
// here — the admin widget, the bulk repricer, the API, and the storefront cache
// all call `computeRetail`. A second implementation anywhere means fixing every
// pricing bug twice.
//
// Order of operations is fixed and explicit (spec §7.3):
//   base     = cost × (1 + markup_pct / 100)
//   withFlat = base + markup_flat
//   retail   = applyRounding(withFlat, rounding_rule)
//   retail   = applyGuards(retail, cost, min_margin_pct)
//
// This engine is the COST → RETAIL markup layer. It is deliberately separate
// from lib/wall-studio/pricing.ts, which estimates installation labour from a
// rule set and never sees a wholesale cost.

import type {
  MarkupRule,
  PriceComputation,
  PricingGuard,
  PricingTier,
  RoundingRule,
  VariantPriceComputation,
} from "@/lib/pricing/types";

/** Flag a markup this large as a likely data-entry error (spec §7.5). */
export const MARKUP_SANITY_CEILING_PCT = 500;

// ─── Money helpers ───────────────────────────────────────────────────────────

/** Round to cents, correcting the float error that makes 70.125 land on 70.12. */
export function roundCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const scaled = n * 100;
  // Nudge by one ulp so values that are a hair under .5 by float error still
  // round the way a human reading the decimal expects.
  const corrected = scaled >= 0 ? scaled + Number.EPSILON * Math.abs(scaled) : scaled - Number.EPSILON * Math.abs(scaled);
  return Math.round(corrected) / 100;
}

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** Round a percentage to one decimal — the precision the UI displays. */
export function roundPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

// ─── Markup ↔ margin ─────────────────────────────────────────────────────────

/** margin = (retail − cost) / retail × 100. Undefined at retail 0. */
export function marginFromCostRetail(cost: number, retail: number): number {
  if (!retail) return 0;
  return ((retail - cost) / retail) * 100;
}

/** markup = (retail − cost) / cost × 100. Undefined at cost 0. */
export function markupFromCostRetail(cost: number, retail: number): number {
  if (!cost) return 0;
  return ((retail - cost) / cost) * 100;
}

/** markup = margin / (100 − margin) × 100. A 50% margin needs a 100% markup. */
export function markupFromMargin(marginPct: number): number {
  if (marginPct >= 100) return Infinity;
  return (marginPct / (100 - marginPct)) * 100;
}

/** margin = markup / (100 + markup) × 100. A 50% markup yields a 33.3% margin. */
export function marginFromMarkup(markupPct: number): number {
  if (markupPct <= -100) return -Infinity;
  return (markupPct / (100 + markupPct)) * 100;
}

// ─── Rounding ────────────────────────────────────────────────────────────────

/**
 * Round UP to the next charm point. Rounding down silently eats margin on every
 * unit sold, so a value already sitting on its charm point stays put and
 * anything above it climbs to the next dollar's charm point.
 */
function toCharm(value: number, charmCents: number): number {
  const dollars = Math.floor(value);
  const candidate = roundCents(dollars + charmCents / 100);
  // A cent of tolerance keeps float noise from bumping an exact hit upward.
  return candidate >= value - 0.0001 ? candidate : roundCents(candidate + 1);
}

export function applyRounding(value: number, rule: RoundingRule): number {
  switch (rule) {
    case "nearest_dollar":
      return Math.round(value);
    case "nearest_five":
      return Math.round(value / 5) * 5;
    case "charm_99":
      return toCharm(value, 99);
    case "charm_95":
      return toCharm(value, 95);
    case "round_up_dollar":
      return Math.ceil(roundCents(value));
    case "none":
    default:
      return roundCents(value);
  }
}

// ─── Rule resolution ─────────────────────────────────────────────────────────

type RuleSource = {
  /** Variant-level overrides — the narrowest scope, wins outright. */
  variant?: { markup_pct?: number | null; markup_flat?: number | null } | null;
  /** Card-level overrides. */
  card?: {
    markup_pct?: number | null;
    markup_flat?: number | null;
    rounding_rule?: RoundingRule | null;
  } | null;
  /** The tier inherited from the card's category. */
  tier?: PricingTier | null;
};

/** Fallback when a card has no category, and its category has no tier. */
const FALLBACK_RULE: Omit<MarkupRule, "origin" | "sourceLabel"> = {
  markupPct: 0,
  markupFlat: 0,
  roundingRule: "none",
  minMarginPct: null,
};

/**
 * Resolve which markup rule is in force: variant → card → tier → fallback.
 * The origin travels with the rule so the UI can always answer "why is this
 * priced the way it is" without a second lookup.
 */
export function resolveMarkupRule(source: RuleSource): MarkupRule {
  const { variant, card, tier } = source;

  const tierPct = tier?.default_markup_pct ?? FALLBACK_RULE.markupPct;
  const tierFlat = tier?.default_markup_flat ?? FALLBACK_RULE.markupFlat;
  const rounding = card?.rounding_rule ?? tier?.rounding_rule ?? FALLBACK_RULE.roundingRule;
  const minMargin = tier?.min_margin_pct ?? null;

  const variantHasOverride = isSet(variant?.markup_pct) || isSet(variant?.markup_flat);
  if (variantHasOverride) {
    return {
      markupPct: variant?.markup_pct ?? card?.markup_pct ?? tierPct,
      markupFlat: variant?.markup_flat ?? card?.markup_flat ?? tierFlat,
      roundingRule: rounding,
      minMarginPct: minMargin,
      origin: "variant_override",
      sourceLabel: "Variant override",
    };
  }

  const cardHasOverride = isSet(card?.markup_pct) || isSet(card?.markup_flat);
  if (cardHasOverride) {
    return {
      markupPct: card?.markup_pct ?? tierPct,
      markupFlat: card?.markup_flat ?? tierFlat,
      roundingRule: rounding,
      minMarginPct: minMargin,
      origin: "card_override",
      sourceLabel: "Card override",
    };
  }

  if (tier) {
    return {
      markupPct: tierPct,
      markupFlat: tierFlat,
      roundingRule: rounding,
      minMarginPct: minMargin,
      origin: "tier",
      sourceLabel: `Tier ${tier.code} default`,
    };
  }

  return {
    ...FALLBACK_RULE,
    roundingRule: rounding,
    origin: "fallback",
    sourceLabel: "No tier assigned — priced at cost",
  };
}

function isSet(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && Number.isFinite(v);
}

// ─── Guards ──────────────────────────────────────────────────────────────────

/**
 * Guards never mutate the price — they annotate it. A `block` guard means the
 * save must be rejected with the message shown; a `warn` guard means show it and
 * let staff proceed.
 *
 * Note on loss leaders: spec §7.3 allows negative markup values and §7.5 blocks
 * pricing below cost. Both hold — a negative value is a legitimate way to
 * express a discount off a marked-up price, but landing under cost is blocked
 * here and only reachable through an explicit variant `retail_override` that
 * records who did it and why.
 */
export function evaluateGuards(cost: number, retail: number, minMarginPct: number | null): PricingGuard[] {
  const guards: PricingGuard[] = [];
  const margin = marginFromCostRetail(cost, retail);
  const markup = markupFromCostRetail(cost, retail);

  if (retail < cost) {
    guards.push({
      code: "below_cost",
      severity: "block",
      message: `Retail ${money(retail)} is below cost ${money(cost)}. Raise the markup, or set an explicit retail override with a reason if this is a deliberate loss leader.`,
    });
  } else if (minMarginPct !== null && margin < minMarginPct - 0.05) {
    guards.push({
      code: "under_margin_floor",
      severity: "warn",
      message: `Margin ${roundPct(margin)}% is below the ${roundPct(minMarginPct)}% floor for this tier. Add an override note to proceed.`,
    });
  }

  if (markup > MARKUP_SANITY_CEILING_PCT) {
    guards.push({
      code: "markup_ceiling",
      severity: "warn",
      message: `Markup of ${roundPct(markup)}% looks like a data entry error. Check the captured cost.`,
    });
  }

  return guards;
}

// ─── The calculation ─────────────────────────────────────────────────────────

/**
 * Cost → retail, in the fixed order from spec §7.3. This is the single
 * entry point; nothing reimplements it.
 */
export function computeRetail(unitCost: number, rule: MarkupRule): PriceComputation {
  const cost = Number.isFinite(unitCost) ? unitCost : 0;

  const base = roundCents(cost * (1 + rule.markupPct / 100));
  const preRounding = roundCents(base + rule.markupFlat);
  const unitRetail = roundCents(applyRounding(preRounding, rule.roundingRule));

  const guards = evaluateGuards(cost, unitRetail, rule.minMarginPct);

  return {
    unitCost: roundCents(cost),
    base,
    preRounding,
    unitRetail,
    marginPct: roundPct(marginFromCostRetail(cost, unitRetail)),
    effectiveMarkupPct: roundPct(markupFromCostRetail(cost, unitRetail)),
    rule,
    guards,
    blocked: guards.some((g) => g.severity === "block"),
  };
}

export type VariantPricingInput = {
  unit_cost: number;
  quantity?: number | null;
  markup_pct?: number | null;
  markup_flat?: number | null;
  retail_override?: number | null;
};

export type CardPricingInput = {
  markup_pct?: number | null;
  markup_flat?: number | null;
  rounding_rule?: RoundingRule | null;
};

/**
 * Price one variant. `retail_override` bypasses the computation entirely — that
 * is its purpose — but guards still run against the override so a deliberate
 * below-cost price is visible rather than silent.
 */
export function computeVariantPricing(
  variant: VariantPricingInput,
  card: CardPricingInput | null,
  tier: PricingTier | null,
): VariantPriceComputation {
  const rule = resolveMarkupRule({ variant, card, tier });
  const computed = computeRetail(variant.unit_cost, rule);
  const quantity = variant.quantity && variant.quantity > 0 ? variant.quantity : 1;

  const overrideApplied = isSet(variant.retail_override);
  const unitRetail = overrideApplied ? roundCents(variant.retail_override as number) : computed.unitRetail;

  const guards = overrideApplied ? evaluateGuards(variant.unit_cost, unitRetail, rule.minMarginPct) : computed.guards;

  return {
    ...computed,
    unitRetail,
    marginPct: roundPct(marginFromCostRetail(variant.unit_cost, unitRetail)),
    effectiveMarkupPct: roundPct(markupFromCostRetail(variant.unit_cost, unitRetail)),
    guards,
    // An override is a deliberate act, so a below-cost override warns rather
    // than blocks — the reason and the author are already recorded on the row.
    blocked: overrideApplied ? false : computed.blocked,
    quantity,
    extendedCost: roundCents(variant.unit_cost * quantity),
    extendedRetail: roundCents(unitRetail * quantity),
    overrideApplied,
  };
}

/**
 * The "from $X" price on a shop tile: the lowest retail across available
 * variants. Returns null when a card has no priced variant yet.
 */
export function startingAtPrice(variants: Array<{ unitRetail: number; is_available?: boolean }>): number | null {
  const available = variants.filter((v) => v.is_available !== false && Number.isFinite(v.unitRetail));
  if (!available.length) return null;
  return available.reduce((min, v) => (v.unitRetail < min ? v.unitRetail : min), available[0].unitRetail);
}
