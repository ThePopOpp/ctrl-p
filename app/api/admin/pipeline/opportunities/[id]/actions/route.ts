import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { AI_MODES, aiPrompt, buildOpportunityBrief, isAiMode } from "@/lib/pipeline/ai-brief";
import { draftWithAi, fetchCallOutcome, sendEmailMessage, sendSmsMessage } from "@/lib/pipeline/comm-server";
import {
  cleanText,
  loadAccessibleOpportunity,
  loadCurrentQuote,
  loadLineItems,
  logActivity,
  readJson,
  recordEvent,
  verifyPipelineRequest,
  type PipelineContext,
} from "@/lib/pipeline/server";
import type { Opportunity, OpportunityEvent } from "@/lib/pipeline/types";
import { isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

type ActionBody = {
  type?: string;
  to?: string;
  from?: string | null;
  subject?: string;
  body?: string;
  call_sid?: string;
  appointment_id?: string;
  project_id?: string;
  payment_id?: string;
  delivery_channel?: string | null;
  mode?: string;
  instructions?: string;
  text?: string;
  model?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Quick actions from the opportunity workspace. Texts and emails are sent
 * here through the real providers; calls, bookings, projects and invoices are
 * created in their own modules and verified here before they are attached.
 * Only what the provider or database actually confirms is recorded.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return verified.error;
  if (!isUuid(id)) return jsonError("Opportunity not found.", 404);
  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return loaded.response;

  const body = await readJson<ActionBody>(request);
  if (!body?.type) return jsonError("Choose an action.");
  const ctx = verified.context;
  const opportunity = loaded.opportunity;

  switch (body.type) {
    case "sms":
      return sendText(ctx, opportunity, body);
    case "email":
      return sendEmail(ctx, opportunity, body);
    case "call":
      return attachCall(ctx, opportunity, body);
    case "appointment":
      return attachAppointment(ctx, opportunity, body);
    case "project":
      return attachProject(ctx, opportunity, body);
    case "invoice":
      return attachInvoice(ctx, opportunity, body);
    case "ai_draft":
      return aiDraft(ctx, opportunity, body);
    case "ai_save":
      return aiSave(ctx, opportunity, body);
    default:
      return jsonError("Unsupported action.");
  }
}

async function outboundMessage(ctx: PipelineContext, opportunity: Opportunity, row: { channel: "sms" | "email"; subject: string | null; body: string }) {
  const inserted = await ctx.client
    .from("messages")
    .insert({
      user_id: opportunity.customer_user_id,
      order_id: opportunity.won_order_id,
      channel: row.channel,
      direction: "outbound",
      subject: row.subject,
      body: row.body,
      internal_only: false,
      sent_at: new Date().toISOString(),
      created_by: ctx.actorId,
    })
    .select("id")
    .single();
  return (inserted.data as { id: string } | null)?.id ?? null;
}

async function sendText(ctx: PipelineContext, opportunity: Opportunity, body: ActionBody) {
  const text = cleanText(body.body, 1600);
  const to = cleanText(body.to, 40);
  if (!to) return jsonError("Enter the mobile number to text.");
  if (!text) return jsonError("Write a message.");

  const result = await sendSmsMessage({ to, from: body.from, body: text });
  if (!result.ok) {
    if (result.status === 502) {
      await recordEvent(ctx.client, {
        opportunity_id: opportunity.id, event_type: "communication", actor_id: ctx.actorId, log_kind: "sms",
        summary: `Text to ${to} failed`, body: text, details: { status: "failed", error: result.error, to },
      });
    }
    return jsonError(result.error, result.status);
  }

  const messageId = await outboundMessage(ctx, opportunity, { channel: "sms", subject: null, body: text });
  await recordEvent(ctx.client, {
    opportunity_id: opportunity.id, event_type: "communication", actor_id: ctx.actorId, log_kind: "sms",
    summary: `Text to ${result.to}`, body: text,
    details: { status: result.status, sid: result.sid, to: result.to, from: result.from, message_id: messageId },
  });
  await logActivity(ctx.client, ctx.actorId, "pipeline_sms_sent", opportunity.id, { sid: result.sid, to: result.to });
  return NextResponse.json({ sent: true, sid: result.sid, status: result.status });
}

async function sendEmail(ctx: PipelineContext, opportunity: Opportunity, body: ActionBody) {
  const to = (cleanText(body.to, 320) ?? "").toLowerCase();
  const subject = cleanText(body.subject, 300);
  const text = cleanText(body.body, 20000);
  if (!EMAIL_RE.test(to)) return jsonError("Enter a valid email address.");
  if (!subject) return jsonError("Add a subject.");
  if (!text) return jsonError("Write a message.");

  const result = await sendEmailMessage({ to, subject, body: text });
  if (!result.ok) {
    if (result.status === 502) {
      await recordEvent(ctx.client, {
        opportunity_id: opportunity.id, event_type: "communication", actor_id: ctx.actorId, log_kind: "email",
        summary: `Email to ${to} failed: ${subject}`, body: text, details: { status: "failed", error: result.error, to, subject },
      });
    }
    return jsonError(result.error, result.status);
  }

  const messageId = await outboundMessage(ctx, opportunity, { channel: "email", subject, body: text });
  await recordEvent(ctx.client, {
    opportunity_id: opportunity.id, event_type: "communication", actor_id: ctx.actorId, log_kind: "email",
    summary: `Email to ${to}: ${subject}`, body: text,
    details: { status: "sent", to, subject, from: result.from, smtp_message_id: result.messageId, message_id: messageId },
  });
  await logActivity(ctx.client, ctx.actorId, "pipeline_email_sent", opportunity.id, { to, subject });
  return NextResponse.json({ sent: true });
}

async function alreadyRecorded(ctx: PipelineContext, opportunityId: string, key: string, value: string) {
  const existing = await ctx.client
    .from("pipeline_opportunity_events")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .eq(`details->>${key}`, value)
    .limit(1)
    .maybeSingle();
  return Boolean(existing.data);
}

async function attachCall(ctx: PipelineContext, opportunity: Opportunity, body: ActionBody) {
  const callSid = cleanText(body.call_sid, 64) ?? "";
  if (!/^CA[0-9a-f]{32}$/i.test(callSid)) return jsonError("Unknown call.");
  if (await alreadyRecorded(ctx, opportunity.id, "call_sid", callSid)) return NextResponse.json({ recorded: false, duplicate: true });

  const outcome = await fetchCallOutcome(callSid);
  if (!outcome.ok && outcome.status === 501) return jsonError(outcome.error, 501);
  const to = outcome.ok ? outcome.to : cleanText(body.to, 40) ?? null;
  const status = outcome.ok ? outcome.status : "unverified";
  const minutes = outcome.ok && outcome.durationSeconds ? ` · ${Math.floor(outcome.durationSeconds / 60)}m ${outcome.durationSeconds % 60}s` : "";

  const error = await recordEvent(ctx.client, {
    opportunity_id: opportunity.id, event_type: "communication", actor_id: ctx.actorId, log_kind: "call",
    summary: `Call to ${to ?? "customer"}${minutes}`,
    occurred_at: outcome.ok && outcome.startTime ? outcome.startTime : new Date().toISOString(),
    details: {
      status,
      call_sid: callSid,
      child_call_sid: outcome.ok ? outcome.childSid : null,
      duration_seconds: outcome.ok ? outcome.durationSeconds : null,
      to,
      from: outcome.ok ? outcome.from : cleanText(body.from, 40) ?? null,
      lookup_error: outcome.ok ? null : outcome.error,
    },
  });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ recorded: true, status });
}

async function attachAppointment(ctx: PipelineContext, opportunity: Opportunity, body: ActionBody) {
  if (!isUuid(body.appointment_id)) return jsonError("Unknown appointment.");
  const appointment = await ctx.client
    .from("booking_appointments")
    .select("id, title, start_time, end_time, status, customer_email")
    .eq("id", body.appointment_id)
    .maybeSingle();
  const row = appointment.data as { id: string; title: string; start_time: string; end_time: string; status: string; customer_email: string | null } | null;
  if (!row) return jsonError("That appointment doesn't exist.", 404);
  if (await alreadyRecorded(ctx, opportunity.id, "appointment_id", row.id)) return NextResponse.json({ recorded: false, duplicate: true });

  const error = await recordEvent(ctx.client, {
    opportunity_id: opportunity.id, event_type: "communication", actor_id: ctx.actorId, log_kind: "meeting",
    summary: `Booked: ${row.title}`,
    details: { status: row.status, appointment_id: row.id, start_time: row.start_time, end_time: row.end_time, email: row.customer_email },
  });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ recorded: true });
}

async function attachProject(ctx: PipelineContext, opportunity: Opportunity, body: ActionBody) {
  if (!isUuid(body.project_id)) return jsonError("Unknown project.");
  const project = await ctx.client.from("production_schedule_items").select("id, title, status").eq("id", body.project_id).maybeSingle();
  const row = project.data as { id: string; title: string; status: string | null } | null;
  if (!row) return jsonError("That project doesn't exist.", 404);
  if (await alreadyRecorded(ctx, opportunity.id, "project_id", row.id)) return NextResponse.json({ recorded: false, duplicate: true });

  if (!opportunity.won_project_id) await ctx.client.from("pipeline_opportunities").update({ won_project_id: row.id }).eq("id", opportunity.id);
  const error = await recordEvent(ctx.client, {
    opportunity_id: opportunity.id, event_type: "record_linked", actor_id: ctx.actorId, log_kind: "project",
    summary: `Project linked: ${row.title}`, details: { project_id: row.id, status: row.status },
  });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ recorded: true });
}

async function attachInvoice(ctx: PipelineContext, opportunity: Opportunity, body: ActionBody) {
  if (!isUuid(body.payment_id)) return jsonError("Unknown invoice.");
  const payment = await ctx.client
    .from("payments")
    .select("id, order_id, amount, status, invoice_number, delivery_status, document_status")
    .eq("id", body.payment_id)
    .maybeSingle();
  const row = payment.data as { id: string; order_id: string; amount: number; status: string; invoice_number: string | null; delivery_status: string | null } | null;
  if (!row) return jsonError("That invoice doesn't exist.", 404);

  const quotes = await ctx.client.from("pipeline_opportunity_quotes").select("order_id").eq("opportunity_id", opportunity.id);
  const orderIds = new Set([opportunity.won_order_id, ...((quotes.data ?? []) as { order_id: string | null }[]).map((quote) => quote.order_id)].filter(Boolean));
  if (!orderIds.has(row.order_id)) return jsonError("That invoice isn't on one of this opportunity's orders.", 403);

  const channel = body.delivery_channel === "email" || body.delivery_channel === "sms" || body.delivery_channel === "both" ? body.delivery_channel : null;
  const label = row.invoice_number ? `Invoice ${row.invoice_number}` : "Invoice";
  const error = await recordEvent(ctx.client, {
    opportunity_id: opportunity.id, event_type: "record_linked", actor_id: ctx.actorId, log_kind: "invoice",
    summary: channel ? `${label} sent by ${channel === "both" ? "email and text" : channel}` : `${label} created`,
    details: { payment_id: row.id, order_id: row.order_id, amount: Number(row.amount), status: row.status, delivery_status: row.delivery_status, delivery_channel: channel },
  });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ recorded: true });
}

async function aiDraft(ctx: PipelineContext, opportunity: Opportunity, body: ActionBody) {
  if (!isAiMode(body.mode)) return jsonError("Choose what the AI should do.");
  const instructions = cleanText(body.instructions, 1000) ?? null;
  if (body.mode === "question" && !instructions) return jsonError("Ask a question.");

  const [lineItems, currentQuote, events, owner, customer] = await Promise.all([
    loadLineItems(ctx.client, opportunity.id),
    loadCurrentQuote(ctx.client, opportunity.id),
    ctx.client.from("pipeline_opportunity_events").select("*").eq("opportunity_id", opportunity.id).order("occurred_at", { ascending: false }).limit(30),
    opportunity.owner_id ? ctx.client.from("users").select("full_name").eq("id", opportunity.owner_id).maybeSingle() : Promise.resolve({ data: null }),
    opportunity.customer_user_id ? ctx.client.from("users").select("full_name").eq("id", opportunity.customer_user_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const brief = buildOpportunityBrief({
    opportunity,
    lineItems,
    currentQuote,
    events: (events.data ?? []) as OpportunityEvent[],
    ownerName: (owner.data as { full_name: string | null } | null)?.full_name || "the salesperson",
    customerName: (customer.data as { full_name: string | null } | null)?.full_name ?? null,
  });
  const { system, prompt } = aiPrompt(body.mode, brief, instructions);
  const result = await draftWithAi(system, prompt);
  if (!result.ok) return jsonError(result.error, result.status);
  return NextResponse.json({ text: result.text, model: result.model });
}

async function aiSave(ctx: PipelineContext, opportunity: Opportunity, body: ActionBody) {
  const text = cleanText(body.text, 8000);
  if (!text) return jsonError("Nothing to save.");
  const mode = isAiMode(body.mode) ? body.mode : "question";
  const label = AI_MODES.find((item) => item.key === mode)?.label ?? "AI draft";
  const error = await recordEvent(ctx.client, {
    opportunity_id: opportunity.id, event_type: "communication", actor_id: ctx.actorId, log_kind: "ai_agent",
    summary: `${label}${cleanText(body.instructions, 200) ? `: ${cleanText(body.instructions, 200)}` : ""}`,
    body: text, details: { mode, model: cleanText(body.model, 60) ?? null, sent: false },
  });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ recorded: true });
}
