import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { ROUNDING_RULES, type RoundingRule } from "@/lib/pricing/types";
import { loadInternalCard, recalcCardPricing, recordCostChange } from "@/lib/products/queries";
import { publishChecklist } from "@/lib/products/shape";

export async function GET(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId } = await params;
  try {
    const card = await loadInternalCard(verified.adminClient, cardId);
    if (!card) return jsonError("Card not found.", 404);
    return NextResponse.json({ card, checklist: publishChecklist(card) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load card.", 500);
  }
}

const CARD_FIELDS = [
  "title",
  "subtitle",
  "slug",
  "description",
  "captured_description",
  "spec_table",
  "category_id",
  "vendor_id",
  "vendor_sku",
  "internal_sku",
  "price_unit",
  "lead_time_days",
  "seo_title",
  "seo_description",
  "markup_pct",
  "markup_flat",
  "rounding_rule",
  "status",
] as const;

type VariantPatch = {
  id?: string;
  label?: string | null;
  quantity?: number;
  spec?: Record<string, string>;
  unit_cost?: number;
  markup_pct?: number | null;
  markup_flat?: number | null;
  retail_override?: number | null;
  retail_override_reason?: string | null;
  is_default?: boolean;
  is_available?: boolean;
  sort_order?: number;
  _delete?: boolean;
};

// PATCH /api/cards/:cardId — edit the card and, optionally, its variants in the
// same request. Any change that can move a price triggers a cache rebuild.
export async function PATCH(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId } = await params;
  if (!cardId) return jsonError("Card ID is required.");

  let body: Record<string, unknown> & { variants?: VariantPatch[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const db = verified.adminClient;

  const update: Record<string, unknown> = {};
  for (const field of CARD_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  if (update.rounding_rule && !(ROUNDING_RULES as readonly string[]).includes(String(update.rounding_rule))) {
    return jsonError(`rounding_rule must be one of: ${ROUNDING_RULES.join(", ")}.`);
  }

  // Publishing has its own route so the checklist can be reported properly.
  if (update.status === "published") {
    return jsonError("Use POST /api/cards/:cardId/publish to publish — it reports the checklist.", 400);
  }

  if (body.markup_pct !== undefined || body.markup_flat !== undefined) {
    update.markup_source =
      body.markup_pct === null && body.markup_flat === null ? "tier" : "card_override";
  }

  if (Object.keys(update).length) {
    update.updated_at = new Date().toISOString();
    const result = await db.from("product_cards").update(update).eq("id", cardId).select("id").maybeSingle();
    if (result.error) return jsonError(result.error.message, 400);
    if (!result.data) return jsonError("Card not found.", 404);
  }

  // ─── Variants ───
  const variants = body.variants ?? [];
  for (const patch of variants) {
    if (patch._delete && patch.id) {
      const { error } = await db.from("product_card_variants").delete().eq("id", patch.id).eq("card_id", cardId);
      if (error) return jsonError(error.message, 400);
      continue;
    }

    const row: Record<string, unknown> = {};
    for (const key of [
      "label",
      "quantity",
      "spec",
      "unit_cost",
      "markup_pct",
      "markup_flat",
      "retail_override",
      "retail_override_reason",
      "is_available",
      "sort_order",
    ] as const) {
      if (patch[key] !== undefined) row[key] = patch[key];
    }

    if (patch.retail_override !== undefined && patch.retail_override !== null && !patch.retail_override_reason) {
      return jsonError("A retail override needs a reason — it is bypassing the pricing rule.");
    }
    if (patch.retail_override !== undefined) row.retail_override_by = patch.retail_override === null ? null : verified.actorId;

    if (patch.id) {
      const existing = await db
        .from("product_card_variants")
        .select("unit_cost")
        .eq("id", patch.id)
        .eq("card_id", cardId)
        .maybeSingle();
      if (existing.error) return jsonError(existing.error.message, 400);
      if (!existing.data) return jsonError("Variant not found on this card.", 404);

      if (Object.keys(row).length) {
        const { error } = await db.from("product_card_variants").update(row).eq("id", patch.id);
        if (error) return jsonError(error.message, 400);
      }

      if (patch.unit_cost !== undefined) {
        await recordCostChange(db, {
          variantId: patch.id,
          oldCost: Number(existing.data.unit_cost),
          newCost: Number(patch.unit_cost),
          changedBy: verified.actorId,
          source: "manual",
        });
      }
    } else if (patch.unit_cost !== undefined) {
      const inserted = await db
        .from("product_card_variants")
        .insert({ ...row, card_id: cardId, unit_cost: patch.unit_cost })
        .select("id")
        .single();
      if (inserted.error) return jsonError(inserted.error.message, 400);
      await recordCostChange(db, {
        variantId: inserted.data.id as string,
        oldCost: null,
        newCost: Number(patch.unit_cost),
        changedBy: verified.actorId,
        source: "manual",
      });
    }
  }

  // The single-default index is partial, so clear the old flag before setting
  // the new one rather than letting the unique index reject the write.
  const newDefault = variants.find((v) => v.is_default && v.id);
  if (newDefault?.id) {
    await db.from("product_card_variants").update({ is_default: false }).eq("card_id", cardId).eq("is_default", true);
    const { error } = await db.from("product_card_variants").update({ is_default: true }).eq("id", newDefault.id);
    if (error) return jsonError(error.message, 400);
  }

  await recalcCardPricing(db, cardId);
  const card = await loadInternalCard(db, cardId);
  if (!card) return jsonError("Card not found.", 404);

  return NextResponse.json({ card, checklist: publishChecklist(card) });
}

// DELETE /api/cards/:cardId — archive, never destroy. Archiving pulls the card
// from every public placement immediately but keeps its history and any quote
// that references it.
export async function DELETE(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId } = await params;
  const db = verified.adminClient;

  const result = await db
    .from("product_cards")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .select("id, title")
    .maybeSingle();

  if (result.error) return jsonError(result.error.message, 400);
  if (!result.data) return jsonError("Card not found.", 404);

  const deactivated = await db
    .from("card_placements")
    .update({ is_active: false })
    .eq("card_id", cardId)
    .eq("is_active", true)
    .select("id");

  return NextResponse.json({
    archived: result.data,
    placementsRemoved: deactivated.data?.length ?? 0,
  });
}
