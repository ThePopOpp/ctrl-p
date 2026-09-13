import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { ROUNDING_RULES, type RoundingRule } from "@/lib/pricing/types";
import { loadInternalCards, recalcCardPricing, recordCostChange, loadInternalCard } from "@/lib/products/queries";
import { publishChecklist, slugify } from "@/lib/products/shape";
import type { CardStatus } from "@/lib/products/types";

// GET /api/cards — internal shape. Staff only; carries cost and margin.
export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as CardStatus | "all" | null;

  try {
    const cards = await loadInternalCards(verified.adminClient, {
      status: status ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      vendorId: url.searchParams.get("vendorId") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      staleOnly: url.searchParams.get("stale") === "true",
      limit: Number(url.searchParams.get("limit") ?? 100),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });

    return NextResponse.json({
      cards: cards.map((card) => ({ ...card, checklist: publishChecklist(card) })),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load cards.", 500);
  }
}

type VariantInput = {
  label?: string | null;
  quantity?: number;
  spec?: Record<string, string>;
  unit_cost: number;
  markup_pct?: number | null;
  markup_flat?: number | null;
  is_default?: boolean;
  is_available?: boolean;
  sort_order?: number;
};

// POST /api/cards — create from a reviewed capture draft, or from scratch.
export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  let body: {
    title?: string;
    subtitle?: string | null;
    slug?: string | null;
    description?: string | null;
    captured_description?: string | null;
    spec_table?: Record<string, string>;
    category_id?: string | null;
    vendor_id?: string | null;
    vendor_sku?: string | null;
    internal_sku?: string | null;
    capture_id?: string | null;
    source_url?: string | null;
    price_unit?: string;
    lead_time_days?: number | null;
    markup_pct?: number | null;
    markup_flat?: number | null;
    rounding_rule?: RoundingRule | null;
    variants?: VariantInput[];
    images?: Array<{ storage_path: string; alt_text?: string; caption?: string; image_source?: string; is_primary?: boolean }>;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const title = body.title?.trim();
  if (!title) return jsonError("A title is required.");

  if (body.rounding_rule && !(ROUNDING_RULES as readonly string[]).includes(body.rounding_rule)) {
    return jsonError(`rounding_rule must be one of: ${ROUNDING_RULES.join(", ")}.`);
  }

  const db = verified.adminClient;
  const slug = await uniqueSlug(db, body.slug?.trim() || slugify(title));

  const markupOverridden = isNumber(body.markup_pct) || isNumber(body.markup_flat);

  const insert = await db
    .from("product_cards")
    .insert({
      title,
      subtitle: body.subtitle ?? null,
      slug,
      description: body.description ?? null,
      captured_description: body.captured_description ?? null,
      spec_table: body.spec_table ?? {},
      category_id: body.category_id ?? null,
      vendor_id: body.vendor_id ?? null,
      vendor_sku: body.vendor_sku ?? null,
      internal_sku: body.internal_sku ?? null,
      capture_id: body.capture_id ?? null,
      source_url: body.source_url ?? null,
      price_unit: body.price_unit ?? "each",
      lead_time_days: body.lead_time_days ?? null,
      markup_pct: body.markup_pct ?? null,
      markup_flat: body.markup_flat ?? null,
      rounding_rule: body.rounding_rule ?? null,
      markup_source: markupOverridden ? "card_override" : "tier",
      // Capture always produces a Draft. Publishing is a deliberate second pass.
      status: "draft",
      cost_captured_at: body.variants?.length ? new Date().toISOString() : null,
      created_by: verified.actorId,
    })
    .select("*")
    .single();

  if (insert.error) return jsonError(insert.error.message, 400);
  const cardId = insert.data.id as string;

  const variants = (body.variants ?? []).filter((v) => Number.isFinite(Number(v.unit_cost)));
  if (variants.length) {
    // Exactly one default; fall back to the first row if the client sent none.
    const defaultIndex = Math.max(0, variants.findIndex((v) => v.is_default));

    const variantInsert = await db
      .from("product_card_variants")
      .insert(
        variants.map((variant, index) => ({
          card_id: cardId,
          label: variant.label ?? null,
          quantity: Number(variant.quantity ?? 1),
          spec: variant.spec ?? {},
          unit_cost: Number(variant.unit_cost),
          markup_pct: variant.markup_pct ?? null,
          markup_flat: variant.markup_flat ?? null,
          is_default: index === defaultIndex,
          is_available: variant.is_available ?? true,
          sort_order: variant.sort_order ?? index,
        })),
      )
      .select("id, unit_cost");

    if (variantInsert.error) {
      await db.from("product_cards").delete().eq("id", cardId);
      return jsonError(variantInsert.error.message, 400);
    }

    for (const row of variantInsert.data ?? []) {
      await recordCostChange(db, {
        variantId: row.id as string,
        oldCost: null,
        newCost: Number(row.unit_cost),
        changedBy: verified.actorId,
        source: body.capture_id ? "capture" : "manual",
      });
    }
  }

  const images = body.images ?? [];
  if (images.length) {
    const primaryIndex = Math.max(0, images.findIndex((i) => i.is_primary));
    const imageInsert = await db.from("product_card_images").insert(
      images.map((image, index) => ({
        card_id: cardId,
        storage_path: image.storage_path,
        alt_text: image.alt_text ?? null,
        caption: image.caption ?? null,
        // Anything captured from a vendor page is reference-only until staff
        // say otherwise. Defaulting the other way is how a scraped photo ends
        // up on a public storefront.
        image_source: image.image_source ?? "scraped_reference",
        is_primary: index === primaryIndex,
        sort_order: index,
      })),
    );
    if (imageInsert.error) return jsonError(imageInsert.error.message, 400);
  }

  await recalcCardPricing(db, cardId);
  const card = await loadInternalCard(db, cardId);

  return NextResponse.json({ card, checklist: card ? publishChecklist(card) : [] }, { status: 201 });
}

function isNumber(v: unknown): v is number {
  return v !== null && v !== undefined && Number.isFinite(Number(v));
}

/** Slugs are unique in the DB; make the collision a suffix, not a 409. */
async function uniqueSlug(db: SupabaseClient, base: string): Promise<string> {
  const root = base || "product";
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const { data } = await db.from("product_cards").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now()}`;
}
