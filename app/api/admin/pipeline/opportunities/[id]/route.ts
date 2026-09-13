import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { opportunityValue } from "@/lib/pipeline/forecast";
import {
  isAssignableOwner,
  loadAccessibleOpportunity,
  loadStageConfig,
  loadStaff,
  logActivity,
  readJson,
  recordEvent,
  verifyPipelineRequest,
} from "@/lib/pipeline/server";
import { STAGE_ORDER, isActiveStage } from "@/lib/pipeline/stages";
import type {
  CustomerRecord,
  ExtraChecklistItem,
  LinkedProject,
  OpportunityDetail,
  OpportunityDocument,
  OpportunityEvent,
  OpportunityFile,
  OpportunityLineItem,
  OpportunityQuote,
  OpportunityTask,
  RelatedAppointment,
  RelatedMessage,
  RelatedOrder,
  RelatedPayment,
  SourceSubmission,
} from "@/lib/pipeline/types";
import { collectOpportunityFields, isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

const ORDER_FIELDS = "id, order_number, status, payment_status, production_status, total, due_at, created_at, customer_email, company";

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const verified = await verifyPipelineRequest(request, "view");
  if (verified.error) return verified.error;
  const { client, access } = verified.context;
  if (!isUuid(id)) return jsonError("Opportunity not found.", 404);

  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return loaded.response;
  const opportunity = loaded.opportunity;

  const [lineItems, quotes, events, tasks, files, staff, stageConfig, customer, submission, candidates] = await Promise.all([
    client.from("pipeline_opportunity_line_items").select("*").eq("opportunity_id", id).order("position").order("created_at"),
    client.from("pipeline_opportunity_quotes").select("*").eq("opportunity_id", id).order("version", { ascending: false }),
    client.from("pipeline_opportunity_events").select("*").eq("opportunity_id", id).order("occurred_at", { ascending: false }).limit(500),
    client.from("pipeline_opportunity_tasks").select("*").eq("opportunity_id", id).order("status").order("due_date", { ascending: true, nullsFirst: false }),
    client.from("pipeline_opportunity_files").select("*").eq("opportunity_id", id).order("created_at", { ascending: false }),
    loadStaff(client),
    loadStageConfig(client),
    opportunity.customer_user_id
      ? client.from("users").select("id, full_name, email, phone, company, role").eq("id", opportunity.customer_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    opportunity.source_submission_id
      ? client.from("contact_submissions").select("id, first_name, last_name, email, phone, company, subject, message, status, created_at").eq("id", opportunity.source_submission_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("orders").select(ORDER_FIELDS).in("status", ["quote_requested", "draft"]).order("created_at", { ascending: false }).limit(50),
  ]);

  const quoteRows = ((quotes.data ?? []) as OpportunityQuote[]).map((quote) => ({ ...quote, amount: Number(quote.amount) || 0 }));
  const currentQuote = quoteRows.find((quote) => quote.is_current) ?? null;
  const orderIds = Array.from(new Set([opportunity.won_order_id, ...quoteRows.map((quote) => quote.order_id)].filter((value): value is string => Boolean(value))));

  const [orders, payments, messagesByOrder, messagesByCustomer, apptByCustomer, apptByOrder, apptByEmail] = await Promise.all([
    orderIds.length ? client.from("orders").select(ORDER_FIELDS).in("id", orderIds) : Promise.resolve({ data: [] }),
    orderIds.length
      ? client.from("payments").select("id, order_id, status, amount, invoice_number, balance_due, created_at").in("order_id", orderIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? client.from("messages").select("id, channel, direction, subject, body, sent_at, created_at, order_id").in("order_id", orderIds).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    opportunity.customer_user_id
      ? client.from("messages").select("id, channel, direction, subject, body, sent_at, created_at, order_id").eq("user_id", opportunity.customer_user_id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    opportunity.customer_user_id
      ? client.from("booking_appointments").select("id, title, start_time, status, location_type").eq("customer_id", opportunity.customer_user_id).order("start_time", { ascending: false }).limit(25)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? client.from("booking_appointments").select("id, title, start_time, status, location_type").in("related_order_id", orderIds).order("start_time", { ascending: false }).limit(25)
      : Promise.resolve({ data: [] }),
    opportunity.contact_email
      ? client.from("booking_appointments").select("id, title, start_time, status, location_type").eq("customer_email", opportunity.contact_email).order("start_time", { ascending: false }).limit(25)
      : Promise.resolve({ data: [] }),
  ]);

  const eventRows = (events.data ?? []) as OpportunityEvent[];
  const projectIds = Array.from(new Set([
    opportunity.won_project_id,
    ...eventRows.filter((event) => event.log_kind === "project").map((event) => (typeof event.details?.project_id === "string" ? event.details.project_id : null)),
  ].filter((value): value is string => Boolean(value))));
  const voiceEvents = eventRows.filter((event) => event.log_kind === "voice_note" && typeof event.details?.storage_path === "string");

  const [documents, projects, voiceUrls] = await Promise.all([
    client.from("pipeline_opportunity_documents").select("*").eq("opportunity_id", id).order("updated_at", { ascending: false }),
    projectIds.length
      ? client.from("production_schedule_items").select("id, title, status, due_date, project_name").in("id", projectIds)
      : Promise.resolve({ data: [] }),
    voiceEvents.length
      ? client.storage.from("pipeline-voice-notes").createSignedUrls(voiceEvents.map((event) => String(event.details.storage_path)), 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  const urlByPath = new Map(((voiceUrls.data ?? []) as { path: string | null; signedUrl: string }[]).map((row) => [row.path, row.signedUrl]));
  const voiceNoteUrls: Record<string, string> = {};
  for (const event of voiceEvents) {
    const url = urlByPath.get(String(event.details.storage_path));
    if (url) voiceNoteUrls[event.id] = url;
  }

  const dedupe = <T extends { id: string }>(rows: T[]) => Array.from(new Map(rows.map((row) => [row.id, row])).values());
  const messages = dedupe([...((messagesByOrder.data ?? []) as RelatedMessage[]), ...((messagesByCustomer.data ?? []) as RelatedMessage[])])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const appointments = dedupe([
    ...((apptByCustomer.data ?? []) as RelatedAppointment[]),
    ...((apptByOrder.data ?? []) as RelatedAppointment[]),
    ...((apptByEmail.data ?? []) as RelatedAppointment[]),
  ]).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const detail: OpportunityDetail = {
    opportunity: { ...opportunity, estimated_value: Number(opportunity.estimated_value) || 0, budget: opportunity.budget === null ? null : Number(opportunity.budget) },
    value: opportunityValue(opportunity.estimated_value, currentQuote),
    lineItems: (lineItems.data ?? []) as OpportunityLineItem[],
    quotes: quoteRows,
    events: eventRows,
    tasks: (tasks.data ?? []) as OpportunityTask[],
    files: (files.data ?? []) as OpportunityFile[],
    customer: (customer.data ?? null) as CustomerRecord | null,
    submission: (submission.data ?? null) as SourceSubmission | null,
    orders: (orders.data ?? []) as RelatedOrder[],
    quoteOrderCandidates: (candidates.data ?? []) as RelatedOrder[],
    payments: (payments.data ?? []) as RelatedPayment[],
    messages,
    appointments,
    documents: ((documents.data ?? []) as OpportunityDocument[]).map((doc) => ({ ...doc, amount: doc.amount === null ? null : Number(doc.amount) })),
    projects: (projects.data ?? []) as LinkedProject[],
    voiceNoteUrls,
    staff,
    stageConfig,
    access,
  };
  return NextResponse.json(detail);
}

type PatchBody = Record<string, unknown> & {
  owner_id?: string;
  customer_user_id?: string | null;
  won_project_id?: string | null;
  checklist_toggle?: { key?: string; done?: boolean };
  extra_item_add?: { label?: string; required?: boolean };
  extra_item_remove?: string;
};

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return verified.error;
  const { client, access, actorId } = verified.context;
  if (!isUuid(id)) return jsonError("Opportunity not found.", 404);

  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return loaded.response;
  const opportunity = loaded.opportunity;

  const body = await readJson<PatchBody>(request);
  if (!body) return jsonError("No changes were provided.");
  if ("stage" in body) return jsonError("Change the stage with the stage control so its requirements are checked.");

  const { updates, error } = collectOpportunityFields(body);
  if (error) return jsonError(error);
  if ("probability" in updates && !isActiveStage(opportunity.stage)) {
    return jsonError("Probability is fixed for closed and on-hold opportunities.");
  }

  let ownerChange: { from: string | null; to: string } | null = null;
  if ("owner_id" in body) {
    const next = body.owner_id;
    if (!isUuid(next)) return jsonError("An opportunity must have an assigned salesperson.");
    if (next !== opportunity.owner_id) {
      if (!access.canViewAll && !access.canManage) return jsonError("Ask a manager to reassign this opportunity.", 403);
      if (!(await isAssignableOwner(client, next))) return jsonError("The assigned salesperson must be an active staff member.");
      updates.owner_id = next;
      ownerChange = { from: opportunity.owner_id, to: next };
    }
  }

  if ("customer_user_id" in body) {
    const next = body.customer_user_id;
    if (next === null) {
      if (opportunity.stage === "closed_won") return jsonError("A won opportunity stays linked to its customer.");
      updates.customer_user_id = null;
    } else {
      if (!isUuid(next)) return jsonError("Unknown customer.");
      const user = await client.from("users").select("id, full_name, email, phone, company").eq("id", next).is("deleted_at", null).maybeSingle();
      if (!user.data) return jsonError("That customer no longer exists.", 404);
      const record = user.data as CustomerRecord;
      updates.customer_user_id = record.id;
      // Keep the snapshot in step with the linked record where it was empty.
      if (!opportunity.contact_email && record.email) updates.contact_email = record.email;
      if (!opportunity.contact_name && record.full_name) updates.contact_name = record.full_name;
      if (!opportunity.contact_phone && record.phone) updates.contact_phone = record.phone;
      if (!opportunity.company && record.company) updates.company = record.company;
    }
  }

  if ("won_project_id" in body) {
    const next = body.won_project_id;
    if (next === null) updates.won_project_id = null;
    else {
      if (!isUuid(next)) return jsonError("Unknown project.");
      const project = await client.from("production_schedule_items").select("id").eq("id", next).maybeSingle();
      if (!project.data) return jsonError("That project no longer exists.", 404);
      updates.won_project_id = next;
    }
  }

  const details: Record<string, unknown> = {};

  if (body.checklist_toggle) {
    const key = String(body.checklist_toggle.key ?? "");
    const [stage, itemId] = key.split(":");
    if (!STAGE_ORDER.includes(stage as (typeof STAGE_ORDER)[number]) || !itemId) return jsonError("Unknown checklist item.");
    updates.checklist = { ...(opportunity.checklist ?? {}), [key]: Boolean(body.checklist_toggle.done) };
    details.checklist = { key, done: Boolean(body.checklist_toggle.done) };
  }

  if (body.extra_item_add) {
    const label = String(body.extra_item_add.label ?? "").trim().slice(0, 200);
    if (!label) return jsonError("Name the step.");
    const item: ExtraChecklistItem = {
      id: `step_${crypto.randomUUID().slice(0, 8)}`,
      label,
      stage: opportunity.stage,
      required: Boolean(body.extra_item_add.required),
    };
    updates.extra_items = [...(opportunity.extra_items ?? []), item];
    details.step_added = label;
  }

  if (typeof body.extra_item_remove === "string") {
    const target = (opportunity.extra_items ?? []).find((item) => item.id === body.extra_item_remove);
    if (!target) return jsonError("Unknown step.");
    updates.extra_items = (opportunity.extra_items ?? []).filter((item) => item.id !== target.id);
    const checklist = { ...(opportunity.checklist ?? {}) };
    delete checklist[`${target.stage}:${target.id}`];
    updates.checklist = checklist;
    details.step_removed = target.label;
  }

  if (!Object.keys(updates).length) return jsonError("No changes were provided.");

  const saved = await client.from("pipeline_opportunities").update(updates).eq("id", id).select("*").single();
  if (saved.error || !saved.data) return jsonError(saved.error?.message ?? "Could not save the opportunity.", 400);

  if (ownerChange) {
    await recordEvent(client, {
      opportunity_id: id,
      event_type: "owner_changed",
      actor_id: actorId,
      from_owner_id: ownerChange.from,
      to_owner_id: ownerChange.to,
      summary: "Salesperson reassigned",
    });
    await logActivity(client, actorId, "pipeline_owner_changed", id, { from: ownerChange.from, to: ownerChange.to });
  }

  const fieldKeys = Object.keys(updates).filter((key) => !["owner_id", "checklist", "extra_items"].includes(key));
  if (fieldKeys.length || Object.keys(details).length) {
    await recordEvent(client, {
      opportunity_id: id,
      event_type: "fields_updated",
      actor_id: actorId,
      summary: fieldKeys.length ? `Updated ${fieldKeys.map((key) => key.replace(/_/g, " ")).join(", ")}` : details.checklist ? "Checklist updated" : "Steps updated",
      details: { fields: fieldKeys, ...details },
    });
  }

  return NextResponse.json({ opportunity: saved.data });
}
