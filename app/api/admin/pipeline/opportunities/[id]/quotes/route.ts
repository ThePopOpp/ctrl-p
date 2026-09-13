import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { cleanDate, cleanNumber, cleanText, loadAccessibleOpportunity, logActivity, readJson, recordEvent, verifyPipelineRequest } from "@/lib/pipeline/server";
import { QUOTE_STATUSES, keysOf } from "@/lib/pipeline/stages";
import type { OpportunityQuote } from "@/lib/pipeline/types";
import { isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

const SETTABLE_STATUSES = new Set([...keysOf(QUOTE_STATUSES)].filter((status) => status !== "superseded"));

type QuoteBody = {
  quote_id?: string;
  order_id?: string | null;
  amount?: number | string | null;
  status?: string;
  sent_at?: string | null;
  expires_at?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
};

async function authorize(request: Request, id: string) {
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return { response: verified.error };
  if (!isUuid(id)) return { response: jsonError("Opportunity not found.", 404) };
  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return { response: loaded.response };
  return { context: verified.context, opportunity: loaded.opportunity };
}

/** Date-only input stored as a timestamp at the start of that day (UTC). */
const sentTimestamp = (value: string | null) => (value ? new Date(`${value}T12:00:00Z`).toISOString() : null);

/**
 * Link a quote (an existing Orders quote) or issue a revised version. A revision
 * supersedes the current version on the same opportunity; it never creates a
 * second opportunity and superseded amounts never count toward value.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;
  const opportunity = auth.opportunity;

  const body = await readJson<QuoteBody>(request);
  if (!body) return jsonError("Quote details are required.");

  let orderTotal: number | null = null;
  let orderNumber: string | null = null;
  if (body.order_id) {
    if (!isUuid(body.order_id)) return jsonError("Unknown quote order.");
    const order = await client.from("orders").select("id, order_number, total").eq("id", body.order_id).maybeSingle();
    if (!order.data) return jsonError("That order no longer exists.", 404);
    orderTotal = Number((order.data as { total: number | null }).total) || 0;
    orderNumber = (order.data as { order_number: string | null }).order_number;
  }

  const amount = cleanNumber(body.amount);
  if (amount === "invalid") return jsonError("Quote amount must be a positive number.");
  const status = body.status ?? "draft";
  if (!SETTABLE_STATUSES.has(status)) return jsonError("Unsupported quote status.");
  const sentDate = cleanDate(body.sent_at);
  const expires = cleanDate(body.expires_at);
  const followUp = cleanDate(body.follow_up_date);
  if (sentDate === "invalid" || expires === "invalid" || followUp === "invalid") return jsonError("Quote dates must be valid dates.");

  const existing = await client.from("pipeline_opportunity_quotes").select("id, version, status, is_current").eq("opportunity_id", id);
  if (existing.error) return jsonError(existing.error.message, 400);
  const rows = (existing.data ?? []) as Pick<OpportunityQuote, "id" | "version" | "status" | "is_current">[];
  const previous = rows.find((row) => row.is_current) ?? null;
  const version = rows.reduce((max, row) => Math.max(max, row.version), 0) + 1;

  if (previous) {
    const superseded = await client
      .from("pipeline_opportunity_quotes")
      .update({ is_current: false, status: "superseded" })
      .eq("id", previous.id)
      .eq("is_current", true);
    if (superseded.error) return jsonError(superseded.error.message, 400);
  }

  const created = await client
    .from("pipeline_opportunity_quotes")
    .insert({
      opportunity_id: id,
      order_id: body.order_id ?? null,
      version,
      amount: amount ?? orderTotal ?? 0,
      status,
      is_current: true,
      sent_at: sentDate ? sentTimestamp(sentDate) : status === "draft" ? null : new Date().toISOString(),
      expires_at: expires ?? null,
      follow_up_date: followUp ?? null,
      notes: cleanText(body.notes, 2000) ?? null,
      created_by: actorId,
    })
    .select("*")
    .single();

  if (created.error || !created.data) {
    // Put the previous version back rather than leave the opportunity with no current quote.
    if (previous) await client.from("pipeline_opportunity_quotes").update({ is_current: true, status: previous.status }).eq("id", previous.id);
    return jsonError(created.error?.message ?? "Could not save the quote.", 400);
  }

  const quote = created.data as OpportunityQuote;
  await recordEvent(client, {
    opportunity_id: id,
    event_type: previous ? "quote_revised" : "quote_linked",
    actor_id: actorId,
    summary: previous
      ? `Quote revised to v${version}${orderNumber ? ` (${orderNumber})` : ""}: $${Number(quote.amount).toFixed(2)}`
      : `Quote v${version} linked${orderNumber ? ` (${orderNumber})` : ""}: $${Number(quote.amount).toFixed(2)}`,
    details: { quote_id: quote.id, version, order_id: quote.order_id, amount: quote.amount, status, superseded_quote_id: previous?.id ?? null },
  });
  await logActivity(client, actorId, previous ? "pipeline_quote_revised" : "pipeline_quote_linked", opportunity.id, { quote_id: quote.id, version, amount: quote.amount });

  return NextResponse.json({ quote }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const body = await readJson<QuoteBody>(request);
  if (!body || !isUuid(body.quote_id)) return jsonError("Quote is required.");

  const current = await client.from("pipeline_opportunity_quotes").select("*").eq("id", body.quote_id).eq("opportunity_id", id).maybeSingle();
  if (!current.data) return jsonError("Quote not found.", 404);
  const quote = current.data as OpportunityQuote;
  if (!quote.is_current) return jsonError("Superseded quote versions can't be changed. Issue a new version instead.", 409);

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!SETTABLE_STATUSES.has(body.status)) return jsonError("Unsupported quote status.");
    updates.status = body.status;
    if (body.status !== "draft" && !quote.sent_at && body.sent_at === undefined && body.status !== "declined") {
      updates.sent_at = new Date().toISOString();
    }
  }
  if (body.amount !== undefined) {
    const amount = cleanNumber(body.amount);
    if (amount === "invalid" || amount === null) return jsonError("Quote amount must be a positive number.");
    updates.amount = amount;
  }
  for (const key of ["sent_at", "expires_at", "follow_up_date"] as const) {
    const value = cleanDate(body[key]);
    if (value === "invalid") return jsonError("Quote dates must be valid dates.");
    if (value !== undefined) updates[key] = key === "sent_at" ? sentTimestamp(value) : value;
  }
  if (body.notes !== undefined) updates.notes = cleanText(body.notes, 2000) ?? null;
  if (body.order_id !== undefined) {
    if (body.order_id !== null && !isUuid(body.order_id)) return jsonError("Unknown quote order.");
    if (body.order_id) {
      const order = await client.from("orders").select("id").eq("id", body.order_id).maybeSingle();
      if (!order.data) return jsonError("That order no longer exists.", 404);
    }
    updates.order_id = body.order_id;
  }
  if (!Object.keys(updates).length) return jsonError("No changes were provided.");

  const saved = await client.from("pipeline_opportunity_quotes").update(updates).eq("id", quote.id).eq("is_current", true).select("*").maybeSingle();
  if (saved.error) return jsonError(saved.error.message, 400);
  if (!saved.data) return jsonError("This quote was superseded while you were editing. Refresh and try again.", 409);

  await recordEvent(client, {
    opportunity_id: id,
    event_type: "quote_updated",
    actor_id: actorId,
    summary: updates.status ? `Quote v${quote.version} marked ${String(updates.status).replace(/_/g, " ")}` : `Quote v${quote.version} updated`,
    details: { quote_id: quote.id, changes: updates, previous_status: quote.status },
  });

  return NextResponse.json({ quote: saved.data });
}
