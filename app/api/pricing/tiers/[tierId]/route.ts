import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { ROUNDING_RULES } from "@/lib/pricing/types";
import { recalcCardsForTier } from "@/lib/products/queries";

const ADMIN_ONLY = ["super_admin", "admin"];

// PATCH /api/pricing/tiers/:tierId — only Owner/Admin may move tier defaults
// (spec §14). Changing a tier reprices every card that inherits it, so the
// cached retail columns are rebuilt before the response returns.
export async function PATCH(request: Request, { params }: { params: Promise<{ tierId: string }> }) {
  const verified = await verifyAdminRequest(request, ADMIN_ONLY);
  if (verified.error) return verified.error;

  const { tierId } = await params;
  if (!tierId) return jsonError("Tier ID is required.");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) update.name = String(body.name);
  if (body.description !== undefined) update.description = body.description ? String(body.description) : null;

  if (body.default_markup_pct !== undefined) {
    const pct = Number(body.default_markup_pct);
    if (!Number.isFinite(pct)) return jsonError("default_markup_pct must be a number.");
    update.default_markup_pct = pct;
  }
  if (body.default_markup_flat !== undefined) {
    const flat = Number(body.default_markup_flat);
    if (!Number.isFinite(flat)) return jsonError("default_markup_flat must be a number.");
    update.default_markup_flat = flat;
  }
  if (body.min_margin_pct !== undefined) {
    if (body.min_margin_pct === null) update.min_margin_pct = null;
    else {
      const floor = Number(body.min_margin_pct);
      if (!Number.isFinite(floor) || floor < 0 || floor >= 100) {
        return jsonError("min_margin_pct must be between 0 and 100.");
      }
      update.min_margin_pct = floor;
    }
  }
  if (body.rounding_rule !== undefined) {
    const rule = String(body.rounding_rule);
    if (!(ROUNDING_RULES as readonly string[]).includes(rule)) {
      return jsonError(`rounding_rule must be one of: ${ROUNDING_RULES.join(", ")}.`);
    }
    update.rounding_rule = rule;
  }
  if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);

  if (!Object.keys(update).length) return jsonError("Nothing to update.");

  const result = await verified.adminClient
    .from("pricing_tiers")
    .update(update)
    .eq("id", tierId)
    .select("*")
    .maybeSingle();

  if (result.error) return jsonError(result.error.message, 400);
  if (!result.data) return jsonError("Tier not found.", 404);

  const repricedCards = await recalcCardsForTier(verified.adminClient, tierId);

  return NextResponse.json({ tier: result.data, repricedCards });
}
