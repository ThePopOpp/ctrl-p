import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { ensureWonRecords } from "@/lib/pipeline/conversion";
import {
  loadAccessibleOpportunity,
  loadCurrentQuote,
  loadLineItems,
  loadStageConfig,
  logActivity,
  readJson,
  recordEvent,
  verifyPipelineRequest,
} from "@/lib/pipeline/server";
import { STAGE_META, isPipelineStage } from "@/lib/pipeline/stages";
import { evaluateTransition } from "@/lib/pipeline/transition";
import { isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

type TransitionBody = {
  to_stage?: string;
  lost_reason?: string | null;
  lost_notes?: string | null;
  competitor?: string | null;
  hold_reason?: string | null;
  hold_follow_up_date?: string | null;
  won_summary?: string | null;
  reopen_reason?: string | null;
  override_reason?: string | null;
};

/**
 * The only way an opportunity changes stage. The board, list menus, quick view,
 * and workspace all call this endpoint, so the rules are identical everywhere.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return verified.error;
  const { client, access, actorId } = verified.context;
  if (!isUuid(id)) return jsonError("Opportunity not found.", 404);

  const body = await readJson<TransitionBody>(request);
  if (!body || !isPipelineStage(body.to_stage)) return jsonError("Choose a valid stage.");
  const to = body.to_stage;

  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return loaded.response;
  const opportunity = loaded.opportunity;

  const [lineItems, currentQuote, config] = await Promise.all([
    loadLineItems(client, id),
    loadCurrentQuote(client, id),
    loadStageConfig(client),
  ]);

  const result = evaluateTransition(
    { opportunity, lineItems, currentQuote, config, canOverride: access.canManage, now: new Date() },
    {
      to,
      lostReason: body.lost_reason,
      lostNotes: body.lost_notes,
      competitor: body.competitor,
      holdReason: body.hold_reason,
      holdFollowUpDate: body.hold_follow_up_date,
      wonSummary: body.won_summary,
      reopenReason: body.reopen_reason,
      overrideReason: body.override_reason,
    },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error, blocking: result.blocking, overridable: result.overridable }, { status: result.status });
  }

  // Closed Won links or creates the customer and order first. If that fails the
  // stage does not change, so the board never shows a win without its order.
  let conversion: Awaited<ReturnType<typeof ensureWonRecords>> | null = null;
  if (result.requiresConversion) {
    conversion = await ensureWonRecords({ client, actorId, opportunity, currentQuote, lineItems });
    if (!conversion.ok) return jsonError(conversion.error, conversion.status);
  }

  // Guard on the stage we evaluated, so two people moving the same card can't both win.
  const saved = await client
    .from("pipeline_opportunities")
    .update(result.patch)
    .eq("id", id)
    .eq("stage", opportunity.stage)
    .select("*")
    .maybeSingle();
  if (saved.error) return jsonError(saved.error.message, 400);
  if (!saved.data) return jsonError("Someone else changed this opportunity's stage. Refresh and try again.", 409);

  await recordEvent(client, {
    opportunity_id: id,
    event_type: "stage_changed",
    actor_id: actorId,
    from_stage: opportunity.stage,
    to_stage: to,
    summary: result.isReopen
      ? `Reopened from ${STAGE_META[opportunity.stage].label} to ${STAGE_META[to].label}`
      : `Moved from ${STAGE_META[opportunity.stage].label} to ${STAGE_META[to].label}`,
    body: result.note,
    details: {
      reopen: result.isReopen,
      override_reason: result.usedOverride ? String(body.override_reason ?? "").trim() : null,
      bypassed_requirements: result.bypassed,
      lost_reason: result.patch.lost_reason ?? null,
      competitor: result.patch.competitor ?? null,
      hold_reason: to === "on_hold" ? result.patch.hold_reason : null,
      hold_follow_up_date: to === "on_hold" ? result.patch.hold_follow_up_date : null,
      previous_outcome: result.isReopen
        ? { lost_reason: opportunity.lost_reason, hold_reason: opportunity.hold_reason, closed_at: opportunity.closed_at }
        : null,
      conversion: conversion && conversion.ok
        ? { customer_id: conversion.customerId, order_id: conversion.orderId, order_number: conversion.orderNumber }
        : null,
    },
  });

  await logActivity(client, actorId, result.usedOverride ? "pipeline_stage_override" : "pipeline_stage_changed", id, {
    from: opportunity.stage,
    to,
    override_reason: result.usedOverride ? body.override_reason : undefined,
  });

  return NextResponse.json({ opportunity: saved.data, conversion: conversion && conversion.ok ? conversion : null });
}
