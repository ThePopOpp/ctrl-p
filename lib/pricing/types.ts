// ─── Product Card Builder — pricing types ───────────────────────────────────
//
// Markup and margin are different numbers and the whole feature turns on not
// confusing them:
//   markup % measures against COST    retail = cost × (1 + markup/100)
//   margin % measures against RETAIL  margin = (retail − cost) / retail × 100
// A 50% markup yields a 33.3% margin. A 50% margin requires a 100% markup.

export const ROUNDING_RULES = [
  "none",
  "nearest_dollar",
  "nearest_five",
  "charm_99",
  "charm_95",
  "round_up_dollar",
] as const;

export type RoundingRule = (typeof ROUNDING_RULES)[number];

export const ROUNDING_RULE_LABELS: Record<RoundingRule, string> = {
  none: "No rounding",
  nearest_dollar: "Nearest dollar",
  nearest_five: "Nearest $5",
  charm_99: "Charm — .99",
  charm_95: "Charm — .95",
  round_up_dollar: "Round up to dollar",
};

export type PriceUnit = "each" | "sq_ft" | "linear_ft" | "set" | "box";

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  each: "each",
  sq_ft: "per sq ft",
  linear_ft: "per linear ft",
  set: "per set",
  box: "per box",
};

/** A tier row from `pricing_tiers`. Defaults are data, never hardcoded. */
export type PricingTier = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_markup_pct: number;
  default_markup_flat: number;
  min_margin_pct: number | null;
  rounding_rule: RoundingRule;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

/** Where the markup currently in effect came from. Always shown in the UI. */
export type MarkupOrigin = "variant_override" | "card_override" | "tier" | "fallback";

export type MarkupRule = {
  markupPct: number;
  markupFlat: number;
  roundingRule: RoundingRule;
  minMarginPct: number | null;
  origin: MarkupOrigin;
  /** Human caption for the widget, e.g. "Tier B default" or "Card override". */
  sourceLabel: string;
};

export type GuardSeverity = "block" | "warn";

export type PricingGuard = {
  code: "below_cost" | "under_margin_floor" | "markup_ceiling";
  severity: GuardSeverity;
  message: string;
};

export type PriceComputation = {
  /** Wholesale cost this calculation started from. */
  unitCost: number;
  /** cost × (1 + markup/100), before flat and rounding. */
  base: number;
  /** base + flat, before rounding — what the UI shows as "pre-rounding". */
  preRounding: number;
  /** Final unit retail after rounding and guards. */
  unitRetail: number;
  /** Gross margin on the final retail, as a percentage. */
  marginPct: number;
  /** Markup that the final retail actually represents, after rounding. */
  effectiveMarkupPct: number;
  rule: MarkupRule;
  guards: PricingGuard[];
  /** True when a guard rejects the price outright. Saves must not proceed. */
  blocked: boolean;
};

export type VariantPriceComputation = PriceComputation & {
  quantity: number;
  extendedCost: number;
  extendedRetail: number;
  /** Set when a manual retail override is in force; the computed price is bypassed. */
  overrideApplied: boolean;
};
