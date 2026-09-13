// ─── Product Card Builder — shaping, checklist, placement resolution ────────
//
// Pure functions only. No Supabase, no React — so the pricing/publishing rules
// can be asserted in tests and reused by the extension side panel.
//
// The single most important thing in this file is `toPublicCard`. It builds the
// customer-facing shape field by field. It never spreads the internal card, and
// it never will — a spread is how cost reaches a storefront.

import {
  computeVariantPricing,
  marginFromCostRetail,
  roundCents,
  roundPct,
  startingAtPrice,
} from "@/lib/pricing/calculate";
import type { PricingGuard, PricingTier } from "@/lib/pricing/types";
import {
  COST_STALE_AFTER_DAYS,
  PUBLISHABLE_IMAGE_SOURCES,
  type CardRow,
  type CategoryRow,
  type DisplayMode,
  type ImageRow,
  type InternalCard,
  type InternalVariant,
  type PlacementRow,
  type PublicCard,
  type PublicImage,
  type PublicVariant,
  type ResolvedPlacement,
  type SlotRow,
  type VariantRow,
  type VendorRow,
} from "@/lib/products/types";

// ─── Internal shape ─────────────────────────────────────────────────────────

export type ComposeInput = {
  card: CardRow;
  variants: VariantRow[];
  images: ImageRow[];
  vendor?: VendorRow | null;
  category?: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  tier?: PricingTier | null;
  now?: number;
};

export function toInternalCard(input: ComposeInput): InternalCard {
  const { card, vendor = null, category = null, tier = null } = input;
  const now = input.now ?? Date.now();

  const variants: InternalVariant[] = [...input.variants]
    .sort(bySortOrder)
    .map((variant) => ({
      ...variant,
      pricing: computeVariantPricing(variant, card, tier),
    }));

  const images = [...input.images].sort(byPrimaryThenSort);

  const available = variants.filter((v) => v.is_available);
  const startingAtRetail = startingAtPrice(
    available.map((v) => ({ unitRetail: v.pricing.unitRetail, is_available: v.is_available })),
  );
  const cheapest = available.reduce<InternalVariant | null>(
    (min, v) => (!min || v.pricing.unitRetail < min.pricing.unitRetail ? v : min),
    null,
  );

  // Blended margin weighted by extended retail — a $2,500 line should move the
  // number more than a $26 one.
  const totalRetail = available.reduce((sum, v) => sum + v.pricing.extendedRetail, 0);
  const totalCost = available.reduce((sum, v) => sum + v.pricing.extendedCost, 0);
  const blendedMarginPct = totalRetail > 0 ? roundPct(marginFromCostRetail(totalCost, totalRetail)) : null;

  const guards: PricingGuard[] = dedupeGuards(variants.flatMap((v) => v.pricing.guards));

  const costAgeDays = card.cost_captured_at
    ? Math.floor((now - new Date(card.cost_captured_at).getTime()) / 86_400_000)
    : null;

  return {
    ...card,
    vendor,
    category,
    tier,
    variants,
    images,
    startingAtRetail,
    startingAtCost: cheapest ? cheapest.pricing.unitCost : null,
    blendedMarginPct,
    guards,
    costAgeDays,
    costIsStale: costAgeDays !== null && costAgeDays > COST_STALE_AFTER_DAYS,
  };
}

function bySortOrder(a: { sort_order: number }, b: { sort_order: number }) {
  return a.sort_order - b.sort_order;
}

function byPrimaryThenSort(a: ImageRow, b: ImageRow) {
  if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
  return a.sort_order - b.sort_order;
}

function dedupeGuards(guards: PricingGuard[]): PricingGuard[] {
  const seen = new Set<string>();
  return guards.filter((g) => (seen.has(g.code) ? false : (seen.add(g.code), true)));
}

// ─── Public shape ───────────────────────────────────────────────────────────

export type PublicShapeOptions = {
  /** Turns a storage path into a URL. Defaults to passing the path through. */
  imageUrl?: (storagePath: string) => string;
};

/**
 * Build the customer-facing shape. Every field is listed explicitly; nothing is
 * spread. If a new confidential column is added to `product_cards` it does not
 * silently appear here, which is the entire point.
 */
export function toPublicCard(card: InternalCard, options: PublicShapeOptions = {}): PublicCard {
  const url = options.imageUrl ?? ((p: string) => p);

  const images: PublicImage[] = card.images.map((image) => ({
    id: image.id,
    url: url(image.storage_path),
    caption: image.caption,
    alt: image.alt_text || card.title,
    isPrimary: image.is_primary,
  }));

  const variants: PublicVariant[] = card.variants
    .filter((v) => v.is_available)
    .map((v) => ({
      id: v.id,
      label: v.label,
      quantity: v.quantity,
      spec: v.spec,
      unitRetail: v.pricing.unitRetail,
      extendedRetail: v.pricing.extendedRetail,
      isDefault: v.is_default,
    }));

  return {
    id: card.id,
    title: card.title,
    subtitle: card.subtitle,
    slug: card.slug,
    description: card.description,
    specTable: card.spec_table ?? {},
    priceUnit: card.price_unit,
    leadTimeDays: card.lead_time_days,
    category: card.category,
    images,
    featuredImage: images.find((i) => i.isPrimary) ?? images[0] ?? null,
    variants,
    startingAtRetail: startingAtPrice(variants.map((v) => ({ unitRetail: v.unitRetail }))),
    seoTitle: card.seo_title,
    seoDescription: card.seo_description,
  };
}

// The storefront never runs the pricing engine — it reads the cached retail
// columns, which are the only price columns a customer session is granted.
// Keeping the cache correct is the write path's job (see recalcCardPricing).

export type PublicCardColumns = Pick<
  CardRow,
  | "id"
  | "title"
  | "subtitle"
  | "slug"
  | "description"
  | "spec_table"
  | "price_unit"
  | "lead_time_days"
  | "seo_title"
  | "seo_description"
  | "category_id"
>;

export type PublicVariantColumns = Pick<
  VariantRow,
  "id" | "label" | "quantity" | "spec" | "cached_unit_retail" | "cached_extended_retail" | "retail_override" | "is_default" | "is_available" | "sort_order"
>;

export type PublicImageColumns = Pick<ImageRow, "id" | "storage_path" | "caption" | "alt_text" | "sort_order" | "is_primary">;

/**
 * Build the public shape straight from public-granted columns. This is the path
 * the storefront takes; cost is not merely omitted here, it was never fetched.
 */
export function publicCardFromRows(input: {
  card: PublicCardColumns;
  variants: PublicVariantColumns[];
  images: PublicImageColumns[];
  category?: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  imageUrl?: (storagePath: string) => string;
}): PublicCard {
  const url = input.imageUrl ?? ((p: string) => p);

  const images: PublicImage[] = [...input.images]
    .sort((a, b) => (a.is_primary === b.is_primary ? a.sort_order - b.sort_order : a.is_primary ? -1 : 1))
    .map((image) => ({
      id: image.id,
      url: url(image.storage_path),
      caption: image.caption,
      alt: image.alt_text || input.card.title,
      isPrimary: image.is_primary,
    }));

  const variants: PublicVariant[] = [...input.variants]
    .filter((v) => v.is_available && effectiveRetail(v) !== null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => {
      const unitRetail = effectiveRetail(v) as number;
      return {
        id: v.id,
        label: v.label,
        quantity: v.quantity,
        spec: v.spec ?? {},
        unitRetail,
        extendedRetail:
          v.retail_override !== null && v.retail_override !== undefined
            ? roundCents(unitRetail * (v.quantity || 1))
            : (v.cached_extended_retail ?? roundCents(unitRetail * (v.quantity || 1))),
        isDefault: v.is_default,
      };
    });

  return {
    id: input.card.id,
    title: input.card.title,
    subtitle: input.card.subtitle,
    slug: input.card.slug,
    description: input.card.description,
    specTable: input.card.spec_table ?? {},
    priceUnit: input.card.price_unit,
    leadTimeDays: input.card.lead_time_days,
    category: input.category ?? null,
    images,
    featuredImage: images.find((i) => i.isPrimary) ?? images[0] ?? null,
    variants,
    startingAtRetail: startingAtPrice(variants.map((v) => ({ unitRetail: v.unitRetail }))),
    seoTitle: input.card.seo_title,
    seoDescription: input.card.seo_description,
  };
}

/** A manual override wins over the computed cache. */
function effectiveRetail(v: Pick<PublicVariantColumns, "cached_unit_retail" | "retail_override">): number | null {
  if (v.retail_override !== null && v.retail_override !== undefined) return roundCents(v.retail_override);
  if (v.cached_unit_retail !== null && v.cached_unit_retail !== undefined) return roundCents(v.cached_unit_retail);
  return null;
}

/** Field names that must never appear in a customer-facing payload. */
export const CONFIDENTIAL_FIELDS = [
  "unit_cost",
  "extended_cost",
  "cached_margin_pct",
  "markup_pct",
  "markup_flat",
  "markup_source",
  "captured_description",
  "vendor_id",
  "vendor_sku",
  "vendor",
  "source_url",
  "cost_captured_at",
  "retail_override_reason",
  "internal_sku",
  "capture_id",
  "tier",
  "guards",
  "blendedMarginPct",
  "startingAtCost",
] as const;

/** Deep scan for a leaked confidential key. Used by the API integration test. */
export function findConfidentialLeak(payload: unknown, path = "$"): string | null {
  if (payload === null || typeof payload !== "object") return null;
  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i += 1) {
      const hit = findConfidentialLeak(payload[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if ((CONFIDENTIAL_FIELDS as readonly string[]).includes(key)) return `${path}.${key}`;
    const hit = findConfidentialLeak(value, `${path}.${key}`);
    if (hit) return hit;
  }
  return null;
}

// ─── Publish checklist ──────────────────────────────────────────────────────

export type ChecklistItem = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
};

/**
 * Spec §8.6. Returns every item with its state rather than a first failure, so
 * the UI can show what is missing instead of a generic error.
 */
export function publishChecklist(card: InternalCard): ChecklistItem[] {
  const featured = card.images.find((i) => i.is_primary) ?? card.images[0] ?? null;
  const pricedVariant = card.variants.find(
    (v) => v.is_available && Number.isFinite(v.pricing.unitRetail) && v.pricing.unitRetail > 0,
  );
  const blocking = card.variants.filter((v) => v.pricing.blocked);

  return [
    {
      key: "title",
      label: "Has a title",
      ok: Boolean(card.title?.trim()),
    },
    {
      key: "slug",
      label: "Has a unique slug",
      ok: Boolean(card.slug?.trim()),
      detail: card.slug ? `/shop/${card.slug}` : "Generate one from the title",
    },
    {
      key: "category",
      label: "Assigned to a category",
      ok: Boolean(card.category_id),
      detail: card.tier ? `Prices on tier ${card.tier.code}` : "Category drives the pricing tier",
    },
    {
      key: "description",
      label: "Has a CTRL+P-written description",
      ok: Boolean(card.description?.trim()),
      detail: "Vendor copy cannot be republished verbatim — copyright and duplicate-content risk",
    },
    {
      key: "featured_image",
      label: "Has a featured image",
      ok: Boolean(featured),
    },
    {
      key: "image_source",
      label: "Featured image is licensed for resale",
      ok: Boolean(featured && PUBLISHABLE_IMAGE_SOURCES.includes(featured.image_source)),
      detail: featured
        ? featured.image_source === "scraped_reference"
          ? "Scraped vendor photos are internal reference only. Request a dealer asset pack, shoot your own, or get written permission."
          : undefined
        : "Add an image first",
    },
    {
      key: "variant_price",
      label: "At least one variant has a retail price",
      ok: Boolean(pricedVariant),
    },
    {
      key: "pricing_guards",
      label: "No variant is priced below cost",
      ok: blocking.length === 0,
      detail: blocking.length ? `${blocking.length} variant(s) blocked — ${blocking[0].pricing.guards[0]?.message}` : undefined,
    },
  ];
}

export function canPublish(card: InternalCard): boolean {
  return publishChecklist(card).every((item) => item.ok);
}

export function missingChecklistItems(card: InternalCard): ChecklistItem[] {
  return publishChecklist(card).filter((item) => !item.ok);
}

// ─── Placement rules ────────────────────────────────────────────────────────

export type PlacementViolation = { code: string; message: string };

/** Spec §11 rule 1 — the display mode must be one the slot allows. */
export function validateDisplayMode(slot: SlotRow, mode: DisplayMode): PlacementViolation | null {
  if (slot.allowed_display_modes.includes(mode)) return null;
  return {
    code: "display_mode_not_allowed",
    message: `"${mode}" is not a valid rendering for ${slot.label}. Allowed: ${slot.allowed_display_modes.join(", ")}.`,
  };
}

/**
 * Spec §11 rule 2 — the one that bites in practice. The message names what
 * would have to come out first rather than surfacing a constraint violation.
 */
export function validateCapacity(
  slot: SlotRow,
  currentFill: number,
  occupants: Array<{ title: string; sortOrder: number }> = [],
): PlacementViolation | null {
  if (currentFill < slot.max_items) return null;
  const last = [...occupants].sort((a, b) => b.sortOrder - a.sortOrder)[0];
  const suggestion = last ? ` Remove "${last.title}" to make room.` : "";
  return {
    code: "slot_full",
    message: `${slot.label} holds ${slot.max_items} card${slot.max_items === 1 ? "" : "s"} and is full.${suggestion}`,
  };
}

/** Spec §11 rule 3 — audience gates status. Staff slots accept Ready cards. */
export function validateAudienceStatus(slot: SlotRow, status: CardRow["status"]): PlacementViolation | null {
  if (slot.audience === "staff") {
    if (status === "published" || status === "ready") return null;
    return {
      code: "status_not_ready",
      message: `${slot.label} accepts Published or Ready cards. This card is ${status}.`,
    };
  }
  if (status === "published") return null;
  return {
    code: "status_not_published",
    message: `${slot.label} is a ${slot.audience} surface, so the card must be Published first. This card is ${status}.`,
  };
}

export function validatePlacement(args: {
  slot: SlotRow;
  status: CardRow["status"];
  displayMode: DisplayMode;
  currentFill: number;
  occupants?: Array<{ title: string; sortOrder: number }>;
}): PlacementViolation[] {
  return [
    validateDisplayMode(args.slot, args.displayMode),
    validateAudienceStatus(args.slot, args.status),
    validateCapacity(args.slot, args.currentFill, args.occupants),
  ].filter((v): v is PlacementViolation => v !== null);
}

/** Is this placement live right now? Spec §8.5. */
export function isPlacementLive(placement: Pick<PlacementRow, "is_active" | "starts_at" | "ends_at">, now = Date.now()): boolean {
  if (!placement.is_active) return false;
  if (placement.starts_at && new Date(placement.starts_at).getTime() > now) return false;
  if (placement.ends_at && new Date(placement.ends_at).getTime() <= now) return false;
  return true;
}

export type PlacementSchedule = "live" | "scheduled" | "expired" | "inactive";

/** A placement that quietly stopped rendering should be visible, not invisible. */
export function placementSchedule(
  placement: Pick<PlacementRow, "is_active" | "starts_at" | "ends_at">,
  now = Date.now(),
): PlacementSchedule {
  if (!placement.is_active) return "inactive";
  if (placement.starts_at && new Date(placement.starts_at).getTime() > now) return "scheduled";
  if (placement.ends_at && new Date(placement.ends_at).getTime() <= now) return "expired";
  return "live";
}

/**
 * Apply per-placement overrides on top of a card. Overrides are null by
 * default and fall back to the card's own values.
 */
export function resolvePlacement(placement: PlacementRow, card: PublicCard): ResolvedPlacement {
  const featuredVariant =
    (placement.variant_id ? card.variants.find((v) => v.id === placement.variant_id) : null) ??
    card.variants.find((v) => v.isDefault) ??
    null;

  const image =
    (placement.image_override_id ? card.images.find((i) => i.id === placement.image_override_id) : null) ??
    card.featuredImage;

  return {
    placementId: placement.id,
    displayMode: placement.display_mode,
    sortOrder: placement.sort_order,
    card,
    title: placement.title_override || card.title,
    subtitle: placement.subtitle_override ?? card.subtitle,
    image,
    price: featuredVariant ? featuredVariant.unitRetail : card.startingAtRetail,
    featuredVariant,
    ctaLabel: placement.cta_label || "View details",
    ctaHref: placement.cta_href || (card.slug ? `/shop/${card.slug}` : "#"),
    badgeText: placement.badge_text,
  };
}

// ─── Misc helpers ───────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // drop combining marks so "café" slugs to "cafe", not "caf-e"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "from $25.99" for a tile, or the flat price when there is only one variant. */
export function formatStartingAt(card: Pick<PublicCard, "startingAtRetail" | "variants" | "priceUnit">): string {
  if (card.startingAtRetail === null) return "Request a quote";
  const price = `$${card.startingAtRetail.toFixed(2)}`;
  return card.variants.length > 1 ? `from ${price}` : price;
}

/** Recompute the cached retail columns for a variant row. */
export function cachedPricingColumns(pricing: {
  unitRetail: number;
  extendedRetail: number;
  marginPct: number;
  extendedCost: number;
}) {
  return {
    cached_unit_retail: roundCents(pricing.unitRetail),
    cached_extended_retail: roundCents(pricing.extendedRetail),
    cached_margin_pct: roundPct(pricing.marginPct),
    extended_cost: roundCents(pricing.extendedCost),
  };
}
