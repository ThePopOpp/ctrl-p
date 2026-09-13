import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { computeRetail, resolveMarkupRule } from "@/lib/pricing/calculate";
import { ROUNDING_RULES, type RoundingRule } from "@/lib/pricing/types";
import { loadTiers } from "@/lib/products/queries";

// POST /api/pricing/calculate
// The live calculation behind MarkupControl. Staff-only — the request and the
// response both carry cost, so this must never be reachable by a customer.
export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  let body: {
    cost?: number;
    markup_pct?: number | null;
    markup_flat?: number | null;
    rounding_rule?: RoundingRule | null;
    tier_id?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const cost = Number(body.cost);
  if (!Number.isFinite(cost) || cost < 0) return jsonError("cost must be a non-negative number.");

  if (body.rounding_rule && !(ROUNDING_RULES as readonly string[]).includes(body.rounding_rule)) {
    return jsonError(`rounding_rule must be one of: ${ROUNDING_RULES.join(", ")}.`);
  }

  try {
    const tiers = await loadTiers(verified.adminClient);
    const tier = body.tier_id ? tiers.find((t) => t.id === body.tier_id) ?? null : tiers.find((t) => t.is_default) ?? null;

    const rule = resolveMarkupRule({
      card: {
        markup_pct: body.markup_pct ?? null,
        markup_flat: body.markup_flat ?? null,
        rounding_rule: body.rounding_rule ?? null,
      },
      tier,
    });

    return NextResponse.json({ pricing: computeRetail(cost, rule) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not calculate.", 500);
  }
}
