import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { cleanText, loadAccessibleOpportunity, readJson, recordEvent, verifyPipelineRequest } from "@/lib/pipeline/server";
import { MANUAL_LOG_KINDS, keysOf } from "@/lib/pipeline/stages";
import type { OpportunityEvent } from "@/lib/pipeline/types";
import { isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

const KINDS = keysOf(MANUAL_LOG_KINDS);

/**
 * Log something that happened outside Ctrl+P — a phone call, an email from a
 * personal inbox, an in-person meeting. These are recorded as manual logs and
 * are shown that way; nothing here sends a message.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return verified.error;
  if (!isUuid(id)) return jsonError("Opportunity not found.", 404);
  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return loaded.response;
  const { client, actorId } = verified.context;

  const body = await readJson<{ kind?: string; subject?: string; body?: string; occurred_at?: string; direction?: string }>(request);
  if (!body || !body.kind || !KINDS.has(body.kind)) return jsonError("Choose what kind of activity to log.");

  const subject = cleanText(body.subject, 300) ?? null;
  const text = cleanText(body.body, 8000) ?? null;
  if (!subject && !text) return jsonError("Add a subject or details.");

  let occurredAt = new Date();
  if (body.occurred_at) {
    const parsed = new Date(body.occurred_at);
    if (Number.isNaN(parsed.getTime())) return jsonError("Enter a valid date and time.");
    if (parsed.getTime() > Date.now() + 5 * 60 * 1000) return jsonError("A logged activity can't be in the future. Use a task for upcoming work.");
    occurredAt = parsed;
  }
  const direction = body.direction === "inbound" || body.direction === "outbound" ? body.direction : null;

  const error = await recordEvent(client, {
    opportunity_id: id,
    event_type: "manual_log",
    actor_id: actorId,
    log_kind: body.kind,
    summary: subject,
    body: text,
    is_manual_log: true,
    occurred_at: occurredAt.toISOString(),
    details: { direction, customer_id: loaded.opportunity.customer_user_id },
  });
  if (error) return jsonError(error.message, 400);

  const latest = await client
    .from("pipeline_opportunity_events")
    .select("*")
    .eq("opportunity_id", id)
    .eq("event_type", "manual_log")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ event: (latest.data ?? null) as OpportunityEvent | null }, { status: 201 });
}
