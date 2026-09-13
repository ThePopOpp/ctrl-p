import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { opportunityValue } from "@/lib/pipeline/forecast";
import { stageProbability } from "@/lib/pipeline/guidance";
import {
  isAssignableOwner,
  loadStageConfig,
  loadStaff,
  logActivity,
  readJson,
  recordEvent,
  verifyPipelineRequest,
} from "@/lib/pipeline/server";
import { serviceLabel } from "@/lib/pipeline/stages";
import type { CustomerRecord, Opportunity, OpportunityListRow, OpportunityQuote, SourceSubmission } from "@/lib/pipeline/types";
import { collectOpportunityFields, isUuid } from "@/lib/pipeline/validation";

export async function GET(request: Request) {
  const verified = await verifyPipelineRequest(request, "view");
  if (verified.error) return verified.error;
  const { client, access } = verified.context;

  let query = client.from("pipeline_opportunities").select("*").order("updated_at", { ascending: false }).limit(2000);
  if (!access.canViewAll) query = query.eq("owner_id", access.actorId);
  const result = await query;
  if (result.error) return jsonError(result.error.message, 400);

  const opportunities = (result.data ?? []) as Opportunity[];
  const ids = opportunities.map((opportunity) => opportunity.id);
  const quotes: OpportunityQuote[] = [];
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = await client
      .from("pipeline_opportunity_quotes")
      .select("id, opportunity_id, version, amount, status, order_id, sent_at, expires_at, is_current")
      .in("opportunity_id", ids.slice(index, index + 200))
      .eq("is_current", true);
    if (chunk.error) return jsonError(chunk.error.message, 400);
    quotes.push(...((chunk.data ?? []) as OpportunityQuote[]));
  }
  const quoteByOpportunity = new Map(quotes.map((quote) => [quote.opportunity_id, quote]));

  const [staff, stageConfig] = await Promise.all([loadStaff(client), loadStageConfig(client)]);

  const rows: OpportunityListRow[] = opportunities.map((opportunity) => {
    const quote = quoteByOpportunity.get(opportunity.id) ?? null;
    return {
      ...opportunity,
      estimated_value: Number(opportunity.estimated_value) || 0,
      value: opportunityValue(opportunity.estimated_value, quote),
      current_quote: quote
        ? { id: quote.id, version: quote.version, amount: Number(quote.amount) || 0, status: quote.status, order_id: quote.order_id, sent_at: quote.sent_at, expires_at: quote.expires_at }
        : null,
    };
  });

  return NextResponse.json({ opportunities: rows, staff, stageConfig, access });
}

type CreateBody = Record<string, unknown> & {
  owner_id?: string;
  customer_user_id?: string | null;
  source_submission_id?: string | null;
};

export async function POST(request: Request) {
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return verified.error;
  const { client, access, actorId } = verified.context;

  const body = await readJson<CreateBody>(request);
  if (!body) return jsonError("Opportunity details are required.");

  // An owner is required on every opportunity, and assigned-only staff can only own their own.
  const ownerId = body.owner_id;
  if (!isUuid(ownerId)) return jsonError("Assign a salesperson.");
  if (!access.canViewAll && ownerId !== actorId) return jsonError("You can only create opportunities assigned to yourself.", 403);
  if (!(await isAssignableOwner(client, ownerId))) return jsonError("The assigned salesperson must be an active staff member.");

  // A website inquiry is added to the Pipeline once. Clicking again returns the same opportunity.
  let submission: SourceSubmission | null = null;
  if (body.source_submission_id) {
    if (!isUuid(body.source_submission_id)) return jsonError("Unknown inquiry.");
    const existing = await client.from("pipeline_opportunities").select("*").eq("source_submission_id", body.source_submission_id).maybeSingle();
    if (existing.data) {
      const found = existing.data as Opportunity;
      if (!access.canViewAll && found.owner_id !== actorId) {
        return jsonError("This inquiry is already in the Pipeline and assigned to someone else.", 409);
      }
      return NextResponse.json({ opportunity: found, existing: true });
    }
    const loaded = await client
      .from("contact_submissions")
      .select("id, first_name, last_name, email, phone, company, subject, message, status, created_at")
      .eq("id", body.source_submission_id)
      .maybeSingle();
    if (!loaded.data) return jsonError("That inquiry no longer exists.", 404);
    submission = loaded.data as SourceSubmission;
  }

  const { updates, error } = collectOpportunityFields(body);
  if (error) return jsonError(error);

  // Link an existing customer rather than copying them. Only customer accounts are
  // linked automatically by email; nobody's role is changed here.
  let customer: CustomerRecord | null = null;
  if (body.customer_user_id) {
    if (!isUuid(body.customer_user_id)) return jsonError("Unknown customer.");
    const loaded = await client
      .from("users")
      .select("id, full_name, email, phone, company, role")
      .eq("id", body.customer_user_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!loaded.data) return jsonError("That customer no longer exists.", 404);
    customer = loaded.data as CustomerRecord;
  }

  const submissionName = submission ? [submission.first_name, submission.last_name].filter(Boolean).join(" ") : null;
  const contactEmail = (updates.contact_email as string | null | undefined) ?? submission?.email?.toLowerCase() ?? customer?.email ?? null;
  if (!customer && contactEmail) {
    const match = await client
      .from("users")
      .select("id, full_name, email, phone, company, role")
      .eq("email", contactEmail)
      .eq("role", "customer")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (match.data) customer = match.data as CustomerRecord;
  }

  const contactName = (updates.contact_name as string | null | undefined) ?? submissionName ?? customer?.full_name ?? null;
  const company = (updates.company as string | null | undefined) ?? submission?.company ?? customer?.company ?? null;
  const serviceCategory = (updates.service_category as string | null | undefined) ?? null;
  const name = (updates.name as string | undefined)
    ?? [company || contactName, serviceCategory ? serviceLabel(serviceCategory) : submission?.subject].filter(Boolean).join(" — ");
  if (!name) return jsonError("Give the opportunity a name.");

  const stageConfig = await loadStageConfig(client);
  const now = new Date().toISOString();
  const insert = {
    ...updates,
    name,
    stage: "new_inquiry",
    probability: stageProbability("new_inquiry", stageConfig),
    owner_id: ownerId,
    customer_user_id: customer?.id ?? null,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: (updates.contact_phone as string | null | undefined) ?? submission?.phone ?? customer?.phone ?? null,
    company,
    source: (updates.source as string | null | undefined) ?? (submission ? "Website contact form" : null),
    description: (updates.description as string | null | undefined) ?? submission?.message ?? null,
    source_submission_id: submission?.id ?? null,
    stage_entered_at: now,
    checklist: {},
    extra_items: [],
    created_by: actorId,
  };

  const created = await client.from("pipeline_opportunities").insert(insert).select("*").single();
  if (created.error || !created.data) {
    // Two clicks racing on the same inquiry: the unique index lets one win; return it.
    if (created.error?.code === "23505" && submission) {
      const existing = await client.from("pipeline_opportunities").select("*").eq("source_submission_id", submission.id).maybeSingle();
      if (existing.data) return NextResponse.json({ opportunity: existing.data, existing: true });
    }
    return jsonError(created.error?.message ?? "Could not create the opportunity.", 400);
  }
  const opportunity = created.data as Opportunity;

  await recordEvent(client, {
    opportunity_id: opportunity.id,
    event_type: "created",
    actor_id: actorId,
    to_stage: "new_inquiry",
    summary: submission ? "Added to Pipeline from a website inquiry" : customer ? "Created for an existing customer" : "Opportunity created",
    details: { source: opportunity.source, submission_id: submission?.id ?? null, customer_id: customer?.id ?? null },
  });
  await recordEvent(client, {
    opportunity_id: opportunity.id,
    event_type: "owner_changed",
    actor_id: actorId,
    to_owner_id: ownerId,
    summary: "Salesperson assigned",
  });

  if (submission) {
    // Keep the inquiry's own record in step without overwriting a choice someone already made.
    await client.from("contact_submissions").update({ assigned_to: ownerId }).eq("id", submission.id).is("assigned_to", null);
    await client.from("contact_submissions").update({ status: "read" }).eq("id", submission.id).eq("status", "new");
  }

  await logActivity(client, actorId, "pipeline_opportunity_created", opportunity.id, {
    opportunity_number: opportunity.opportunity_number,
    owner_id: ownerId,
    submission_id: submission?.id ?? null,
    customer_id: customer?.id ?? null,
  });

  return NextResponse.json({ opportunity, existing: false }, { status: 201 });
}
