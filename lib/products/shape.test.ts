import { describe, expect, it } from "vitest";

import type { PricingTier } from "@/lib/pricing/types";
import {
  canPublish,
  findConfidentialLeak,
  isPlacementLive,
  placementSchedule,
  publishChecklist,
  resolvePlacement,
  slugify,
  toInternalCard,
  toPublicCard,
  validateCapacity,
  validateDisplayMode,
  validateAudienceStatus,
  validatePlacement,
  formatStartingAt,
} from "@/lib/products/shape";
import type { CardRow, ImageRow, PlacementRow, SlotRow, VariantRow } from "@/lib/products/types";

const TIER: PricingTier = {
  id: "tier-a",
  code: "A",
  name: "Commodity",
  description: null,
  default_markup_pct: 40,
  default_markup_flat: 0,
  min_margin_pct: 25,
  rounding_rule: "charm_99",
  is_default: true,
  is_active: true,
  sort_order: 10,
};

const CARD: CardRow = {
  id: "card-1",
  capture_id: "capture-1",
  vendor_id: "vendor-1",
  category_id: "cat-1",
  title: "Premium Business Cards",
  subtitle: "16pt, matte, double sided",
  slug: "premium-business-cards",
  description: "Written by CTRL+P.",
  captured_description: "Vendor's original marketing copy.",
  spec_table: { Material: "16pt C2S", Finish: "Matte" },
  vendor_sku: "4O-BC-16PT",
  internal_sku: "CP-BC-016",
  markup_pct: null,
  markup_flat: null,
  rounding_rule: null,
  markup_source: "tier",
  price_unit: "each",
  lead_time_days: 4,
  status: "published",
  published_at: "2026-08-01T00:00:00Z",
  seo_title: null,
  seo_description: null,
  source_url: "https://www.4over.com/product/bc-16pt",
  cost_captured_at: "2026-08-10T00:00:00Z",
  created_by: "user-1",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

const variant = (over: Partial<VariantRow> = {}): VariantRow => ({
  id: "variant-1",
  card_id: "card-1",
  label: "500 / 16pt / Matte",
  quantity: 1,
  spec: { Qty: "500" },
  unit_cost: 24,
  extended_cost: null,
  markup_pct: null,
  markup_flat: null,
  cached_unit_retail: null,
  cached_extended_retail: null,
  cached_margin_pct: null,
  retail_override: null,
  retail_override_reason: null,
  retail_override_by: null,
  is_default: true,
  is_available: true,
  sort_order: 0,
  ...over,
});

const image = (over: Partial<ImageRow> = {}): ImageRow => ({
  id: "image-1",
  card_id: "card-1",
  storage_path: "cards/card-1/front.jpg",
  caption: null,
  alt_text: "Stack of matte business cards",
  image_source: "vendor_licensed",
  source_note: null,
  sort_order: 0,
  is_primary: true,
  ...over,
});

const compose = (over: Partial<Parameters<typeof toInternalCard>[0]> = {}) =>
  toInternalCard({
    card: CARD,
    variants: [variant()],
    images: [image()],
    tier: TIER,
    category: { id: "cat-1", name: "Business Cards", slug: "business-cards" },
    now: new Date("2026-08-15T00:00:00Z").getTime(),
    ...over,
  });

// ─── The test the spec asks for by name (§12) ───────────────────────────────

describe("public shape contains no confidential fields", () => {
  it("strips cost, margin, markup, vendor and captured copy", () => {
    const publicCard = toPublicCard(compose());
    expect(findConfidentialLeak(publicCard)).toBeNull();
  });

  it("catches a leak when one is planted", () => {
    const leaky = { products: [{ title: "x", unit_cost: 24 }] };
    expect(findConfidentialLeak(leaky)).toBe("$.products[0].unit_cost");
  });

  it("serialises without the vendor's original description", () => {
    const json = JSON.stringify(toPublicCard(compose()));
    expect(json).not.toContain("Vendor's original marketing copy");
    expect(json).not.toContain("4over.com");
    expect(json).not.toContain("4O-BC-16PT");
  });

  it("keeps retail and drops cost on every variant", () => {
    const publicCard = toPublicCard(compose({ variants: [variant({ unit_cost: 24 })] }));
    expect(publicCard.variants[0].unitRetail).toBe(33.99);
    expect(publicCard.variants[0]).not.toHaveProperty("unit_cost");
  });

  it("omits unavailable variants entirely", () => {
    const publicCard = toPublicCard(
      compose({ variants: [variant(), variant({ id: "v2", is_available: false, unit_cost: 5, is_default: false })] }),
    );
    expect(publicCard.variants).toHaveLength(1);
  });
});

// ─── Internal composition ───────────────────────────────────────────────────

describe("internal card composition", () => {
  it("prices every variant through the tier", () => {
    const card = compose({
      variants: [
        variant({ id: "v1", unit_cost: 18, sort_order: 0 }),
        variant({ id: "v2", unit_cost: 24, sort_order: 1, is_default: false }),
        variant({ id: "v3", unit_cost: 34, sort_order: 2, is_default: false }),
      ],
    });
    expect(card.variants.map((v) => v.pricing.unitRetail)).toEqual([25.99, 33.99, 47.99]);
    expect(card.startingAtRetail).toBe(25.99);
  });

  it("blends margin weighted by extended retail", () => {
    const card = compose({
      variants: [
        variant({ id: "v1", unit_cost: 10, quantity: 1, sort_order: 0 }),
        variant({ id: "v2", unit_cost: 100, quantity: 10, sort_order: 1, is_default: false }),
      ],
    });
    // The 10-qty line dominates, so the blend sits near its own margin.
    expect(card.blendedMarginPct).toBeGreaterThan(28);
    expect(card.blendedMarginPct).toBeLessThan(30);
  });

  it("flags cost older than 30 days as stale", () => {
    const fresh = compose();
    expect(fresh.costAgeDays).toBe(5);
    expect(fresh.costIsStale).toBe(false);

    const stale = compose({ card: { ...CARD, cost_captured_at: "2026-06-01T00:00:00Z" } });
    expect(stale.costIsStale).toBe(true);
  });

  it("sorts the primary image to the front", () => {
    const card = compose({
      images: [
        image({ id: "b", is_primary: false, sort_order: 0 }),
        image({ id: "a", is_primary: true, sort_order: 5 }),
      ],
    });
    expect(card.images[0].id).toBe("a");
  });

  it("reports pricing guards raised by any variant, deduped", () => {
    const card = compose({
      variants: [
        variant({ id: "v1", unit_cost: 10, markup_pct: -50, sort_order: 0 }),
        variant({ id: "v2", unit_cost: 20, markup_pct: -50, sort_order: 1, is_default: false }),
      ],
    });
    expect(card.guards).toHaveLength(1);
    expect(card.guards[0].code).toBe("below_cost");
  });
});

// ─── Publish checklist ──────────────────────────────────────────────────────

describe("publish checklist (spec §8.6)", () => {
  it("passes a complete card", () => {
    expect(canPublish(compose())).toBe(true);
  });

  it("blocks a scraped featured image and explains why", () => {
    const card = compose({ images: [image({ image_source: "scraped_reference" })] });
    const item = publishChecklist(card).find((i) => i.key === "image_source");
    expect(item?.ok).toBe(false);
    expect(item?.detail).toMatch(/dealer asset pack/i);
    expect(canPublish(card)).toBe(false);
  });

  it("blocks a card with no CTRL+P description", () => {
    const card = compose({ card: { ...CARD, description: null } });
    const item = publishChecklist(card).find((i) => i.key === "description");
    expect(item?.ok).toBe(false);
    expect(item?.detail).toMatch(/verbatim/i);
  });

  it("reports every missing item, not just the first", () => {
    const card = compose({
      card: { ...CARD, description: null, slug: null, category_id: null },
      images: [],
      variants: [],
    });
    const failing = publishChecklist(card).filter((i) => !i.ok);
    expect(failing.map((i) => i.key).sort()).toEqual(
      ["category", "description", "featured_image", "image_source", "slug", "variant_price"].sort(),
    );
  });

  it("blocks when a variant is priced below cost", () => {
    const card = compose({ variants: [variant({ markup_pct: -50 })] });
    const item = publishChecklist(card).find((i) => i.key === "pricing_guards");
    expect(item?.ok).toBe(false);
    expect(item?.detail).toMatch(/below cost/i);
  });
});

// ─── Placement rules ────────────────────────────────────────────────────────

const slot = (over: Partial<SlotRow> = {}): SlotRow => ({
  id: "slot-1",
  key: "home_hero",
  label: "Homepage hero",
  description: null,
  surface: "storefront",
  audience: "public",
  context_type: null,
  max_items: 1,
  allowed_display_modes: ["hero", "cta_banner"],
  supports_scheduling: true,
  is_active: true,
  sort_order: 10,
  ...over,
});

const placement = (over: Partial<PlacementRow> = {}): PlacementRow => ({
  id: "placement-1",
  card_id: "card-1",
  slot_id: "slot-1",
  context_id: null,
  display_mode: "hero",
  sort_order: 0,
  title_override: null,
  subtitle_override: null,
  image_override_id: null,
  variant_id: null,
  cta_label: null,
  cta_href: null,
  badge_text: null,
  starts_at: null,
  ends_at: null,
  is_active: true,
  ...over,
});

describe("placement rules (spec §11)", () => {
  it("rejects a display mode the slot does not allow", () => {
    const violation = validateDisplayMode(slot(), "tile");
    expect(violation?.code).toBe("display_mode_not_allowed");
    expect(violation?.message).toContain("hero");
  });

  it("rejects an over-capacity slot and names what to remove", () => {
    const violation = validateCapacity(slot({ max_items: 2 }), 2, [
      { title: "Banners", sortOrder: 0 },
      { title: "Yard Signs", sortOrder: 1 },
    ]);
    expect(violation?.code).toBe("slot_full");
    expect(violation?.message).toContain('Remove "Yard Signs"');
  });

  it("allows a placement while the slot has room", () => {
    expect(validateCapacity(slot({ max_items: 8 }), 3)).toBeNull();
  });

  it("requires Published for public and customer slots", () => {
    expect(validateAudienceStatus(slot({ audience: "public" }), "ready")?.code).toBe("status_not_published");
    expect(validateAudienceStatus(slot({ audience: "customer" }), "draft")?.code).toBe("status_not_published");
    expect(validateAudienceStatus(slot({ audience: "public" }), "published")).toBeNull();
  });

  it("accepts Ready cards in staff slots", () => {
    expect(validateAudienceStatus(slot({ audience: "staff" }), "ready")).toBeNull();
    expect(validateAudienceStatus(slot({ audience: "staff" }), "draft")?.code).toBe("status_not_ready");
  });

  it("collects every violation at once", () => {
    const violations = validatePlacement({
      slot: slot(),
      status: "draft",
      displayMode: "tile",
      currentFill: 1,
    });
    expect(violations.map((v) => v.code).sort()).toEqual(
      ["display_mode_not_allowed", "slot_full", "status_not_published"].sort(),
    );
  });
});

describe("placement scheduling (spec §8.5)", () => {
  const now = new Date("2026-08-15T12:00:00Z").getTime();

  it("is live inside its window", () => {
    expect(isPlacementLive(placement({ starts_at: "2026-08-01T00:00:00Z", ends_at: "2026-09-01T00:00:00Z" }), now)).toBe(true);
  });

  it("distinguishes scheduled, expired and inactive rather than hiding them", () => {
    expect(placementSchedule(placement({ starts_at: "2026-09-01T00:00:00Z" }), now)).toBe("scheduled");
    expect(placementSchedule(placement({ ends_at: "2026-08-01T00:00:00Z" }), now)).toBe("expired");
    expect(placementSchedule(placement({ is_active: false }), now)).toBe("inactive");
    expect(placementSchedule(placement(), now)).toBe("live");
  });

  it("treats the end boundary as exclusive", () => {
    expect(isPlacementLive(placement({ ends_at: "2026-08-15T12:00:00Z" }), now)).toBe(false);
  });
});

describe("placement overrides (spec §8.4)", () => {
  const publicCard = () =>
    toPublicCard(
      compose({
        variants: [
          variant({ id: "v1", unit_cost: 18, is_default: true, sort_order: 0 }),
          variant({ id: "v2", unit_cost: 34, is_default: false, sort_order: 1 }),
        ],
        images: [image({ id: "img-a", is_primary: true }), image({ id: "img-b", is_primary: false, sort_order: 1 })],
      }),
    );

  it("falls back to the card when every override is null", () => {
    const resolved = resolvePlacement(placement(), publicCard());
    expect(resolved.title).toBe("Premium Business Cards");
    expect(resolved.image?.id).toBe("img-a");
    expect(resolved.price).toBe(25.99);
    expect(resolved.ctaHref).toBe("/shop/premium-business-cards");
    expect(resolved.ctaLabel).toBe("View details");
  });

  it("applies title, image, CTA and badge overrides", () => {
    const resolved = resolvePlacement(
      placement({
        title_override: "Get 500 Cards by Friday",
        image_override_id: "img-b",
        cta_label: "Order now",
        cta_href: "/landing/rush-cards",
        badge_text: "Rush available",
      }),
      publicCard(),
    );
    expect(resolved.title).toBe("Get 500 Cards by Friday");
    expect(resolved.image?.id).toBe("img-b");
    expect(resolved.ctaLabel).toBe("Order now");
    expect(resolved.ctaHref).toBe("/landing/rush-cards");
    expect(resolved.badgeText).toBe("Rush available");
  });

  it("leads with the chosen variant's price rather than the cheapest", () => {
    const resolved = resolvePlacement(placement({ variant_id: "v2" }), publicCard());
    expect(resolved.price).toBe(47.99);
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

describe("helpers", () => {
  it("slugifies titles", () => {
    expect(slugify("Premium Business Cards — 16pt!")).toBe("premium-business-cards-16pt");
    expect(slugify("Café Menus")).toBe("cafe-menus");
  });

  it("shows a from-price only when there is more than one variant", () => {
    const multi = toPublicCard(
      compose({ variants: [variant({ id: "v1", unit_cost: 18 }), variant({ id: "v2", unit_cost: 34, is_default: false })] }),
    );
    expect(formatStartingAt(multi)).toBe("from $25.99");

    const single = toPublicCard(compose());
    expect(formatStartingAt(single)).toBe("$33.99");
  });

  it("asks for a quote when nothing is priced", () => {
    const unpriced = toPublicCard(compose({ variants: [] }));
    expect(formatStartingAt(unpriced)).toBe("Request a quote");
  });
});
