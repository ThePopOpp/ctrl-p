import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { computeVariantPricing, marginFromCostRetail, roundPct } from "@/lib/pricing/calculate";
import {
  loadCategories,
  loadInternalCard,
  loadTiers,
  recalcCardPricing,
  recordCostChange,
  tierForCard,
} from "@/lib/products/queries";
import type { VariantRow } from "@/lib/products/types";

type CostUpdate = { variant_id: string; unit_cost: number };

// POST /api/cards/:cardId/refresh-cost
//
// Two modes:
//   { costs: [...] }            → apply new costs
//   { costs: [...], preview: true } → return the diff without writing
//
// The preview is the point. Staff need to see old cost, new cost, and what
// happens to margin at the CURRENT retail before deciding whether to absorb the
// change or reprice (spec §10).
export async function POST(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId } = await params;
  const db = verified.adminClient;

  let body: { costs?: CostUpdate[]; preview?: boolean; hold_retail?: boolean; capture_id?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const costs = (body.costs ?? []).filter((c) => c.variant_id && Number.isFinite(Number(c.unit_cost)));
  if (!costs.length) return jsonError("Send at least one { variant_id, unit_cost }.");

  const card = await loadInternalCard(db, cardId);
  if (!card) return jsonError("Card not found.", 404);

  const [tiers, categories] = await Promise.all([loadTiers(db), loadCategories(db)]);
  const tier = tierForCard(card, categories, tiers);

  const diff = costs
    .map((update) => {
      const variant = card.variants.find((v) => v.id === update.variant_id);
      if (!variant) return null;

      const newCost = Number(update.unit_cost);
      const currentRetail = variant.pricing.unitRetail;
      const repriced = computeVariantPricing({ ...variant, unit_cost: newCost, retail_override: null }, card, tier);

      return {
        variantId: variant.id,
        label: variant.label ?? `Qty ${variant.quantity}`,
        oldCost: variant.unit_cost,
        newCost,
        costDelta: Number((newCost - variant.unit_cost).toFixed(4)),
        currentRetail,
        // Hold retail: what does the margin become if the price does not move?
        marginIfHeld: roundPct(marginFromCostRetail(newCost, currentRetail)),
        oldMargin: variant.pricing.marginPct,
        // Reprice: what would the rule produce at the new cost?
        repricedRetail: repriced.unitRetail,
        marginIfRepriced: repriced.marginPct,
        guards: repriced.guards,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (!diff.length) return jsonError("None of those variants belong to this card.", 404);

  if (body.preview) {
    return NextResponse.json({ preview: true, diff, tier: tier ? { code: tier.code, name: tier.name } : null });
  }

  // Apply. `hold_retail` pins the current retail as an explicit override so the
  // customer-facing price does not move; otherwise the rule reprices it.
  for (const row of diff) {
    const variantRow = card.variants.find((v) => v.id === row.variantId) as VariantRow;

    const update: Record<string, unknown> = { unit_cost: row.newCost };
    if (body.hold_retail) {
      update.retail_override = row.currentRetail;
      update.retail_override_reason = `Held through a cost change of ${row.costDelta >= 0 ? "+" : ""}${row.costDelta.toFixed(2)} on ${new Date().toISOString().slice(0, 10)}`;
      update.retail_override_by = verified.actorId;
    }

    const { error } = await db.from("product_card_variants").update(update).eq("id", row.variantId);
    if (error) return jsonError(error.message, 400);

    await recordCostChange(db, {
      variantId: row.variantId,
      oldCost: variantRow.unit_cost,
      newCost: row.newCost,
      changedBy: verified.actorId,
      source: "refresh",
      note: body.hold_retail ? "Retail held" : "Repriced from rule",
    });
  }

  await db
    .from("product_cards")
    .update({ cost_captured_at: new Date().toISOString(), capture_id: body.capture_id ?? card.capture_id })
    .eq("id", cardId);

  await recalcCardPricing(db, cardId);

  return NextResponse.json({ applied: true, diff, card: await loadInternalCard(db, cardId) });
}
