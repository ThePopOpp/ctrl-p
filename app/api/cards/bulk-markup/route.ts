import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { computeVariantPricing } from "@/lib/pricing/calculate";
import { ROUNDING_RULES, type RoundingRule } from "@/lib/pricing/types";
import { loadCategories, loadInternalCards, loadTiers, recalcCardPricing, tierForCard } from "@/lib/products/queries";

// POST /api/cards/bulk-markup
//
// Preview is not optional in the UI, so it is the default here too: a request
// without `apply: true` never writes. Repricing a whole category without seeing
// the result first is how products quietly go out wrong (spec §7.7).
export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  let body: {
    card_ids?: string[];
    markup_pct?: number | null;
    markup_flat?: number | null;
    rounding_rule?: RoundingRule | null;
    /** 'card_override' writes the rule onto each card; 'clear' reverts to tier. */
    mode?: "card_override" | "clear";
    apply?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const cardIds = (body.card_ids ?? []).filter(Boolean);
  if (!cardIds.length) return jsonError("Select at least one card.");
  if (cardIds.length > 250) return jsonError("Bulk markup is limited to 250 cards per pass.");

  if (body.rounding_rule && !(ROUNDING_RULES as readonly string[]).includes(body.rounding_rule)) {
    return jsonError(`rounding_rule must be one of: ${ROUNDING_RULES.join(", ")}.`);
  }

  const db = verified.adminClient;
  const clearing = body.mode === "clear";

  if (!clearing && body.markup_pct === undefined && body.markup_flat === undefined && !body.rounding_rule) {
    return jsonError("Nothing to change — send markup_pct, markup_flat, rounding_rule, or mode: 'clear'.");
  }

  try {
    const [tiers, categories] = await Promise.all([loadTiers(db), loadCategories(db)]);

    const selected = await loadInternalCards(db, { ids: cardIds, status: "all", limit: cardIds.length });
    if (!selected.length) return jsonError("None of those cards were found.", 404);

    const nextRule = (card: (typeof selected)[number]) => ({
      markup_pct: clearing ? null : body.markup_pct !== undefined ? body.markup_pct : card.markup_pct,
      markup_flat: clearing ? null : body.markup_flat !== undefined ? body.markup_flat : card.markup_flat,
      rounding_rule: clearing ? null : body.rounding_rule ?? card.rounding_rule,
    });

    // Before/after for EVERY affected variant, not a per-card summary — a card
    // can hold eight quantity breaks and only one of them cross a floor.
    const preview = selected.map((card) => {
      const rule = nextRule(card);
      const tier = tierForCard(card, categories, tiers);

      const variants = card.variants.map((variant) => {
        const after = computeVariantPricing(variant, { ...card, ...rule }, tier);
        return {
          variantId: variant.id,
          label: variant.label ?? `Qty ${variant.quantity}`,
          unitCost: variant.unit_cost,
          before: { retail: variant.pricing.unitRetail, margin: variant.pricing.marginPct },
          after: { retail: after.unitRetail, margin: after.marginPct },
          retailDelta: Number((after.unitRetail - variant.pricing.unitRetail).toFixed(2)),
          marginDelta: Number((after.marginPct - variant.pricing.marginPct).toFixed(1)),
          guards: after.guards,
          blocked: after.blocked,
          overrideApplied: after.overrideApplied,
        };
      });

      return {
        cardId: card.id,
        title: card.title,
        status: card.status,
        tier: tier ? { code: tier.code, name: tier.name } : null,
        rule,
        variants,
        blocked: variants.some((v) => v.blocked),
      };
    });

    const blocked = preview.filter((p) => p.blocked);
    const warnings = preview.flatMap((p) => p.variants.flatMap((v) => v.guards.filter((g) => g.severity === "warn")));

    if (!body.apply) {
      return NextResponse.json({
        preview: true,
        cards: preview,
        summary: {
          cards: preview.length,
          variants: preview.reduce((n, p) => n + p.variants.length, 0),
          blocked: blocked.length,
          warnings: warnings.length,
        },
      });
    }

    if (blocked.length) {
      return NextResponse.json(
        {
          error: `${blocked.length} card${blocked.length === 1 ? "" : "s"} would be priced below cost. Nothing was changed.`,
          blocked: blocked.map((b) => ({ cardId: b.cardId, title: b.title })),
          cards: preview,
        },
        { status: 422 },
      );
    }

    for (const card of preview) {
      const { error: updateError } = await db
        .from("product_cards")
        .update({
          ...card.rule,
          markup_source: clearing ? "tier" : "card_override",
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.cardId);
      if (updateError) return jsonError(updateError.message, 400);
      await recalcCardPricing(db, card.cardId);
    }

    return NextResponse.json({
      applied: true,
      cards: preview,
      summary: { cards: preview.length, variants: preview.reduce((n, p) => n + p.variants.length, 0) },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Bulk markup failed.", 500);
  }
}
