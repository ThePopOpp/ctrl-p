// ─── Product Card Builder — data access ─────────────────────────────────────
//
// Two clients, deliberately:
//   adminDb()  — service role. Bypasses RLS. Staff surfaces and write paths.
//   publicDb() — publishable key. RLS and the column-level GRANTs from the
//                migration both apply, so a storefront query physically cannot
//                return unit_cost even if someone asks for it.
//
// The storefront always goes through publicDb(). That is not a convention, it
// is the enforcement.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { imageUrl } from "@/lib/products/image-url";

import { computeVariantPricing } from "@/lib/pricing/calculate";
import type { PricingTier } from "@/lib/pricing/types";
import {
  cachedPricingColumns,
  publicCardFromRows,
  resolvePlacement,
  toInternalCard,
  type PublicCardColumns,
  type PublicImageColumns,
  type PublicVariantColumns,
} from "@/lib/products/shape";
import type {
  CardRow,
  CardStatus,
  CategoryRow,
  ImageRow,
  InternalCard,
  PlacementRow,
  PublicCard,
  ResolvedPlacement,
  SlotRow,
  VariantRow,
  VendorRow,
} from "@/lib/products/types";

// ─── Clients ────────────────────────────────────────────────────────────────

export function adminDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service-role environment is not configured.");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function publicDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase public environment is not configured.");
  return createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export { imageUrl };

// ─── Column lists ───────────────────────────────────────────────────────────

const PUBLIC_CARD_COLUMNS =
  "id, title, subtitle, slug, description, spec_table, price_unit, lead_time_days, seo_title, seo_description, category_id";
const PUBLIC_VARIANT_COLUMNS =
  "id, card_id, label, quantity, spec, cached_unit_retail, cached_extended_retail, retail_override, is_default, is_available, sort_order";
const PUBLIC_IMAGE_COLUMNS = "id, card_id, storage_path, caption, alt_text, sort_order, is_primary";

// ─── Tiers and categories ───────────────────────────────────────────────────

export async function loadTiers(db: SupabaseClient): Promise<PricingTier[]> {
  const { data, error } = await db.from("pricing_tiers").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as PricingTier[];
}

export async function loadCategories(db: SupabaseClient): Promise<CategoryRow[]> {
  const { data, error } = await db
    .from("product_categories")
    .select("id, name, slug, parent_id, description, tier_id, sort_order, active")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryRow[];
}

export async function loadVendors(db: SupabaseClient): Promise<VendorRow[]> {
  const { data, error } = await db.from("vendors").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as VendorRow[];
}

/**
 * The tier a card prices on: its category's tier, or the tier flagged
 * `is_default` when the category has none.
 */
export function tierForCard(
  card: Pick<CardRow, "category_id">,
  categories: CategoryRow[],
  tiers: PricingTier[],
): PricingTier | null {
  const category = categories.find((c) => c.id === card.category_id);
  const assigned = category?.tier_id ? tiers.find((t) => t.id === category.tier_id) : null;
  return assigned ?? tiers.find((t) => t.is_default) ?? null;
}

// ─── Internal (staff) reads ─────────────────────────────────────────────────

export type CardFilters = {
  status?: CardStatus | "all";
  categoryId?: string;
  vendorId?: string;
  search?: string;
  staleOnly?: boolean;
  /** Explicit id set — used by bulk operations on a multi-select. */
  ids?: string[];
  limit?: number;
  offset?: number;
};

export async function loadInternalCards(db: SupabaseClient, filters: CardFilters = {}): Promise<InternalCard[]> {
  const limit = Math.min(500, Math.max(1, filters.limit ?? 100));

  let query = db
    .from("product_cards")
    .select("*")
    .order("updated_at", { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + limit - 1);

  if (filters.ids?.length) query = query.in("id", filters.ids);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  else if (!filters.status) query = query.neq("status", "archived");
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.vendorId) query = query.eq("vendor_id", filters.vendorId);
  if (filters.search) {
    const term = `%${filters.search.replace(/[%_]/g, "")}%`;
    query = query.or(`title.ilike.${term},vendor_sku.ilike.${term},internal_sku.ilike.${term},subtitle.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const cards = (data ?? []) as CardRow[];
  if (!cards.length) return [];

  const composed = await composeInternal(db, cards);
  return filters.staleOnly ? composed.filter((c) => c.costIsStale) : composed;
}

export async function loadInternalCard(db: SupabaseClient, idOrSlug: string): Promise<InternalCard | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const { data, error } = await db
    .from("product_cards")
    .select("*")
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [card] = await composeInternal(db, [data as CardRow]);
  return card ?? null;
}

/** Batch-load the children of a card set — one query each, never N+1. */
async function composeInternal(db: SupabaseClient, cards: CardRow[]): Promise<InternalCard[]> {
  const ids = cards.map((c) => c.id);

  const [variantsResult, imagesResult, tiers, categories, vendorsResult] = await Promise.all([
    db.from("product_card_variants").select("*").in("card_id", ids).order("sort_order"),
    db.from("product_card_images").select("*").in("card_id", ids).order("sort_order"),
    loadTiers(db),
    loadCategories(db),
    db.from("vendors").select("*"),
  ]);

  if (variantsResult.error) throw new Error(variantsResult.error.message);
  if (imagesResult.error) throw new Error(imagesResult.error.message);
  if (vendorsResult.error) throw new Error(vendorsResult.error.message);

  const variants = (variantsResult.data ?? []) as VariantRow[];
  const images = (imagesResult.data ?? []) as ImageRow[];
  const vendors = (vendorsResult.data ?? []) as VendorRow[];

  return cards.map((card) => {
    const category = categories.find((c) => c.id === card.category_id) ?? null;
    return toInternalCard({
      card,
      variants: variants.filter((v) => v.card_id === card.id),
      images: images.filter((i) => i.card_id === card.id),
      vendor: vendors.find((v) => v.id === card.vendor_id) ?? null,
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
      tier: tierForCard(card, categories, tiers),
    });
  });
}

// ─── Public (storefront) reads ──────────────────────────────────────────────

export type PublicCardFilters = {
  categorySlug?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function loadPublicCards(db: SupabaseClient, filters: PublicCardFilters = {}): Promise<PublicCard[]> {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 48));

  const categories = await loadPublicCategories(db);
  let categoryId: string | undefined;
  if (filters.categorySlug) {
    categoryId = categories.find((c) => c.slug === filters.categorySlug)?.id;
    if (!categoryId) return [];
  }

  let query = db
    .from("product_cards")
    .select(PUBLIC_CARD_COLUMNS)
    .order("title")
    .range(filters.offset ?? 0, (filters.offset ?? 0) + limit - 1);

  if (categoryId) query = query.eq("category_id", categoryId);
  if (filters.search) {
    const term = `%${filters.search.replace(/[%_]/g, "")}%`;
    query = query.or(`title.ilike.${term},subtitle.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return composePublic(db, (data ?? []) as unknown as PublicCardColumns[], categories);
}

export async function loadPublicCardBySlug(db: SupabaseClient, slug: string): Promise<PublicCard | null> {
  const { data, error } = await db.from("product_cards").select(PUBLIC_CARD_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const categories = await loadPublicCategories(db);
  const [card] = await composePublic(db, [data as unknown as PublicCardColumns], categories);
  return card ?? null;
}

export async function loadPublicCategories(db: SupabaseClient): Promise<Array<Pick<CategoryRow, "id" | "name" | "slug">>> {
  const { data, error } = await db
    .from("product_categories")
    .select("id, name, slug")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Pick<CategoryRow, "id" | "name" | "slug">>;
}

async function composePublic(
  db: SupabaseClient,
  cards: PublicCardColumns[],
  categories: Array<Pick<CategoryRow, "id" | "name" | "slug">>,
): Promise<PublicCard[]> {
  if (!cards.length) return [];
  const ids = cards.map((c) => c.id);

  const [variantsResult, imagesResult] = await Promise.all([
    db.from("product_card_variants").select(PUBLIC_VARIANT_COLUMNS).in("card_id", ids).order("sort_order"),
    db.from("product_card_images").select(PUBLIC_IMAGE_COLUMNS).in("card_id", ids).order("sort_order"),
  ]);
  if (variantsResult.error) throw new Error(variantsResult.error.message);
  if (imagesResult.error) throw new Error(imagesResult.error.message);

  const variants = (variantsResult.data ?? []) as Array<PublicVariantColumns & { card_id: string }>;
  const images = (imagesResult.data ?? []) as Array<PublicImageColumns & { card_id: string }>;

  return cards.map((card) =>
    publicCardFromRows({
      card,
      variants: variants.filter((v) => v.card_id === card.id),
      images: images.filter((i) => i.card_id === card.id),
      category: categories.find((c) => c.id === card.category_id) ?? null,
      imageUrl,
    }),
  );
}

// ─── Slots and placements ───────────────────────────────────────────────────

export async function loadSlots(db: SupabaseClient): Promise<SlotRow[]> {
  const { data, error } = await db.from("placement_slots").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as SlotRow[];
}

export async function loadSlotByKey(db: SupabaseClient, key: string): Promise<SlotRow | null> {
  const { data, error } = await db.from("placement_slots").select("*").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SlotRow) ?? null;
}

/**
 * Resolve a slot for the storefront: active placements inside their date
 * window, whose cards are published, with overrides applied. Empty slots come
 * back empty and render nothing.
 */
export async function resolveSlotForRender(
  slotKey: string,
  contextId?: string | null,
  client?: SupabaseClient,
): Promise<ResolvedPlacement[]> {
  const db = client ?? publicDb();

  const slot = await loadSlotByKey(db, slotKey);
  if (!slot || !slot.is_active) return [];

  let query = db
    .from("card_placements")
    .select("*")
    .eq("slot_id", slot.id)
    .eq("is_active", true)
    .order("sort_order");

  query = contextId ? query.eq("context_id", contextId) : query.is("context_id", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const nowIso = new Date().toISOString();
  const placements = ((data ?? []) as PlacementRow[])
    .filter((p) => (!p.starts_at || p.starts_at <= nowIso) && (!p.ends_at || p.ends_at > nowIso))
    .slice(0, slot.max_items);

  if (!placements.length) return [];

  const categories = await loadPublicCategories(db);
  const { data: cardData, error: cardError } = await db
    .from("product_cards")
    .select(PUBLIC_CARD_COLUMNS)
    .in("id", placements.map((p) => p.card_id));
  if (cardError) throw new Error(cardError.message);

  const cards = await composePublic(db, (cardData ?? []) as unknown as PublicCardColumns[], categories);
  const byId = new Map(cards.map((c) => [c.id, c]));

  return placements
    .map((placement) => {
      const card = byId.get(placement.card_id);
      return card ? resolvePlacement(placement, card) : null;
    })
    .filter((p): p is ResolvedPlacement => p !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Every slot a card appears in — the "from a card" management view. */
export async function loadPlacementsForCard(db: SupabaseClient, cardId: string) {
  const [{ data, error }, slots] = await Promise.all([
    db.from("card_placements").select("*").eq("card_id", cardId),
    loadSlots(db),
  ]);
  if (error) throw new Error(error.message);
  const placements = (data ?? []) as PlacementRow[];
  return { placements, slots };
}

/** Current fill of every slot, for the registry view's "3 of 8 filled". */
export async function loadSlotFillCounts(db: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await db.from("card_placements").select("slot_id").eq("is_active", true);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ slot_id: string }>) {
    counts[row.slot_id] = (counts[row.slot_id] ?? 0) + 1;
  }
  return counts;
}

// ─── Write helpers ──────────────────────────────────────────────────────────

/**
 * Recompute and persist the cached retail columns for one card's variants.
 * Call this after ANY change to cost, markup, rounding rule, category or tier —
 * the storefront reads only the cache, so a stale cache is a wrong price.
 */
export async function recalcCardPricing(db: SupabaseClient, cardId: string): Promise<void> {
  const [{ data: cardData, error: cardError }, tiers, categories] = await Promise.all([
    db.from("product_cards").select("*").eq("id", cardId).maybeSingle(),
    loadTiers(db),
    loadCategories(db),
  ]);
  if (cardError) throw new Error(cardError.message);
  if (!cardData) return;

  const card = cardData as CardRow;
  const tier = tierForCard(card, categories, tiers);

  const { data: variantData, error: variantError } = await db
    .from("product_card_variants")
    .select("*")
    .eq("card_id", cardId);
  if (variantError) throw new Error(variantError.message);

  const updates = ((variantData ?? []) as VariantRow[]).map((variant) => {
    const pricing = computeVariantPricing(variant, card, tier);
    return { id: variant.id, ...cachedPricingColumns(pricing) };
  });

  await Promise.all(
    updates.map((update) =>
      db.from("product_card_variants").update(stripId(update)).eq("id", update.id),
    ),
  );
}

function stripId<T extends { id: string }>(row: T) {
  const { id: _id, ...rest } = row;
  return rest;
}

/** Recompute every card on a tier — used after tier defaults change. */
export async function recalcCardsForTier(db: SupabaseClient, tierId: string): Promise<number> {
  const { data: categoryData } = await db.from("product_categories").select("id").eq("tier_id", tierId);
  const categoryIds = ((categoryData ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (!categoryIds.length) return 0;

  const { data: cardData } = await db.from("product_cards").select("id").in("category_id", categoryIds);
  const cardIds = ((cardData ?? []) as Array<{ id: string }>).map((c) => c.id);

  for (const id of cardIds) await recalcCardPricing(db, id);
  return cardIds.length;
}

/** Append a cost-history row whenever a variant's cost moves. */
export async function recordCostChange(
  db: SupabaseClient,
  args: {
    variantId: string;
    oldCost: number | null;
    newCost: number;
    changedBy: string | null;
    source: "capture" | "refresh" | "manual" | "import";
    note?: string;
  },
): Promise<void> {
  if (args.oldCost !== null && Math.abs(args.oldCost - args.newCost) < 0.00005) return;
  await db.from("product_cost_history").insert({
    variant_id: args.variantId,
    old_unit_cost: args.oldCost,
    new_unit_cost: args.newCost,
    changed_by: args.changedBy,
    change_source: args.source,
    note: args.note ?? null,
  });
}
