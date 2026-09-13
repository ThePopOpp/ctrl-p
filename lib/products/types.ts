// ─── Product Card Builder — domain types ────────────────────────────────────

import type { PriceUnit, PricingGuard, PricingTier, RoundingRule, VariantPriceComputation } from "@/lib/pricing/types";

export type CardStatus = "draft" | "ready" | "published" | "archived";
export const CARD_STATUSES: readonly CardStatus[] = ["draft", "ready", "published", "archived"];

export type ImageSource = "vendor_licensed" | "own_photo" | "permission" | "scraped_reference";

export const IMAGE_SOURCE_LABELS: Record<ImageSource, string> = {
  vendor_licensed: "Vendor dealer asset",
  own_photo: "Our own photography",
  permission: "Written permission",
  scraped_reference: "Scraped — internal reference only",
};

/** Only these may back a published card's featured image. */
export const PUBLISHABLE_IMAGE_SOURCES: readonly ImageSource[] = ["vendor_licensed", "own_photo", "permission"];

export type DisplayMode = "tile" | "compact" | "hero" | "cta_banner" | "list_row" | "spec_highlight";
export const DISPLAY_MODES: readonly DisplayMode[] = [
  "tile",
  "compact",
  "hero",
  "cta_banner",
  "list_row",
  "spec_highlight",
];

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  tile: "Tile — standard grid card",
  compact: "Compact — thumbnail row",
  hero: "Hero — full width",
  cta_banner: "CTA banner — copy-led band",
  list_row: "List row — dense text",
  spec_highlight: "Spec highlight — specs on the face",
};

export type SlotSurface = "storefront" | "landing" | "dashboard";
export type SlotAudience = "public" | "customer" | "staff";
export type CaptureMethod = "extension" | "headless" | "manual";
export type ExtractionSource = "structured" | "dom" | "vision" | "manual";

/** The badge shown next to every field in the review form (spec §5). */
export const EXTRACTION_BADGES: Record<ExtractionSource, { label: string; tone: "verified" | "extracted" | "manual" }> = {
  structured: { label: "Verified", tone: "verified" },
  dom: { label: "Verified", tone: "verified" },
  vision: { label: "Extracted", tone: "extracted" },
  manual: { label: "Manual", tone: "manual" },
};

// ─── Raw table rows ─────────────────────────────────────────────────────────

export type VendorRow = {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  dealer_portal_url: string | null;
  requires_login: boolean;
  provides_marketing_assets: boolean;
  default_lead_time_days: number | null;
  notes: string | null;
};

export type CardRow = {
  id: string;
  capture_id: string | null;
  vendor_id: string | null;
  category_id: string | null;
  title: string;
  subtitle: string | null;
  slug: string | null;
  description: string | null;
  captured_description: string | null;
  spec_table: Record<string, string>;
  vendor_sku: string | null;
  internal_sku: string | null;
  markup_pct: number | null;
  markup_flat: number | null;
  rounding_rule: RoundingRule | null;
  markup_source: "tier" | "card_override";
  price_unit: PriceUnit;
  lead_time_days: number | null;
  status: CardStatus;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  source_url: string | null;
  cost_captured_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VariantRow = {
  id: string;
  card_id: string;
  label: string | null;
  quantity: number;
  spec: Record<string, string>;
  unit_cost: number;
  extended_cost: number | null;
  markup_pct: number | null;
  markup_flat: number | null;
  cached_unit_retail: number | null;
  cached_extended_retail: number | null;
  cached_margin_pct: number | null;
  retail_override: number | null;
  retail_override_reason: string | null;
  retail_override_by: string | null;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
};

export type ImageRow = {
  id: string;
  card_id: string;
  storage_path: string;
  caption: string | null;
  alt_text: string | null;
  image_source: ImageSource;
  source_note: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type SlotRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  surface: SlotSurface;
  audience: SlotAudience;
  context_type: "category" | "card" | "page" | null;
  max_items: number;
  allowed_display_modes: DisplayMode[];
  supports_scheduling: boolean;
  is_active: boolean;
  sort_order: number;
};

export type PlacementRow = {
  id: string;
  card_id: string;
  slot_id: string;
  context_id: string | null;
  display_mode: DisplayMode;
  sort_order: number;
  title_override: string | null;
  subtitle_override: string | null;
  image_override_id: string | null;
  variant_id: string | null;
  cta_label: string | null;
  cta_href: string | null;
  badge_text: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  tier_id: string | null;
  sort_order: number;
  active: boolean;
};

// ─── Composed shapes ────────────────────────────────────────────────────────

/**
 * INTERNAL shape — staff only. Carries cost, margin, markup, vendor and the
 * captured vendor copy. Never hand this to a customer-facing surface; the
 * public shape below is a separate type on purpose, so a mistaken pass-through
 * fails to compile rather than leaking at runtime.
 */
export type InternalVariant = VariantRow & {
  pricing: VariantPriceComputation;
};

export type InternalCard = CardRow & {
  vendor: VendorRow | null;
  category: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  tier: PricingTier | null;
  variants: InternalVariant[];
  images: ImageRow[];
  startingAtRetail: number | null;
  startingAtCost: number | null;
  /** Blended margin across available variants — the number the drift widget watches. */
  blendedMarginPct: number | null;
  guards: PricingGuard[];
  costAgeDays: number | null;
  costIsStale: boolean;
};

/**
 * PUBLIC shape — retail only. There is no cost, margin, markup, vendor,
 * captured_description or source_url field on this type, and `toPublicCard` is
 * the only way to build one.
 */
export type PublicVariant = {
  id: string;
  label: string | null;
  quantity: number;
  spec: Record<string, string>;
  unitRetail: number;
  extendedRetail: number;
  isDefault: boolean;
};

export type PublicImage = {
  id: string;
  url: string;
  caption: string | null;
  alt: string;
  isPrimary: boolean;
};

export type PublicCard = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  description: string | null;
  specTable: Record<string, string>;
  priceUnit: PriceUnit;
  leadTimeDays: number | null;
  category: { id: string; name: string; slug: string } | null;
  images: PublicImage[];
  featuredImage: PublicImage | null;
  variants: PublicVariant[];
  startingAtRetail: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

/** A public card as it renders in one specific slot, overrides applied. */
export type ResolvedPlacement = {
  placementId: string;
  displayMode: DisplayMode;
  sortOrder: number;
  card: PublicCard;
  title: string;
  subtitle: string | null;
  image: PublicImage | null;
  price: number | null;
  featuredVariant: PublicVariant | null;
  ctaLabel: string;
  ctaHref: string;
  badgeText: string | null;
};

/** Number of days after which a captured cost is treated as stale (spec §10). */
export const COST_STALE_AFTER_DAYS = 30;

/** Margin drift below tier target that lands a card on the attention list. */
export const MARGIN_DRIFT_ALERT_POINTS = 10;
