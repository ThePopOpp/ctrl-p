import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { cleanDate, cleanNumber, cleanText, loadAccessibleOpportunity, readJson, recordEvent, verifyPipelineRequest } from "@/lib/pipeline/server";
import type { DocumentKind, OpportunityDocument } from "@/lib/pipeline/types";
import { isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

const KINDS = new Set<DocumentKind>(["plan", "contract", "sow"]);
const STATUSES = new Set(["draft", "sent", "accepted", "signed", "declined", "archived"]);
const KIND_LABEL: Record<DocumentKind, string> = { plan: "Plan", contract: "Contract", sow: "SOW" };

type DocumentBody = {
  document_id?: string;
  kind?: string;
  title?: string;
  status?: string;
  amount?: number | string | null;
  effective_date?: string | null;
  due_date?: string | null;
  body?: string | null;
  file_url?: string | null;
};

function collect(body: DocumentBody, partial: boolean): { updates: Record<string, unknown>; error: string | null } {
  const updates: Record<string, unknown> = {};
  if (!partial || body.title !== undefined) {
    const title = cleanText(body.title, 200);
    if (!title) return { updates, error: "Give the document a title." };
    updates.title = title;
  }
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) return { updates, error: "Unsupported status." };
    updates.status = body.status;
  }
  if (body.amount !== undefined) {
    const amount = cleanNumber(body.amount);
    if (amount === "invalid") return { updates, error: "Amount must be a positive number." };
    updates.amount = amount ?? null;
  }
  for (const key of ["effective_date", "due_date"] as const) {
    const value = cleanDate(body[key]);
    if (value === "invalid") return { updates, error: "Dates must be valid dates." };
    if (value !== undefined) updates[key] = value;
  }
  if (body.body !== undefined) updates.body = cleanText(body.body, 50000) ?? null;
  if (body.file_url !== undefined) {
    const url = cleanText(body.file_url, 2000) ?? null;
    if (url && !/^https?:\/\//i.test(url)) return { updates, error: "The file link must start with http:// or https://." };
    updates.file_url = url;
  }
  return { updates, error: null };
}

async function authorize(request: Request, id: string) {
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return { response: verified.error };
  if (!isUuid(id)) return { response: jsonError("Opportunity not found.", 404) };
  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return { response: loaded.response };
  return { context: verified.context };
}

/** Plans, contracts and SOWs kept on the opportunity. Status is recorded by staff — no e-signature. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const body = await readJson<DocumentBody>(request);
  if (!body || !KINDS.has(body.kind as DocumentKind)) return jsonError("Choose a plan, contract or SOW.");
  const kind = body.kind as DocumentKind;
  const { updates, error } = collect(body, false);
  if (error) return jsonError(error);

  const created = await client
    .from("pipeline_opportunity_documents")
    .insert({ ...updates, opportunity_id: id, kind, created_by: actorId })
    .select("*")
    .single();
  if (created.error || !created.data) return jsonError(created.error?.message ?? "Couldn't save the document.", 400);
  const doc = created.data as OpportunityDocument;

  await recordEvent(client, {
    opportunity_id: id, event_type: "document_updated", actor_id: actorId, log_kind: kind,
    summary: `${KIND_LABEL[kind]} created: ${doc.title}`,
    details: { document_id: doc.id, status: doc.status, amount: doc.amount === null ? null : Number(doc.amount) },
  });
  return NextResponse.json({ document: doc }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const body = await readJson<DocumentBody>(request);
  if (!body || !isUuid(body.document_id)) return jsonError("Document is required.");
  const existing = await client.from("pipeline_opportunity_documents").select("*").eq("id", body.document_id).eq("opportunity_id", id).maybeSingle();
  if (!existing.data) return jsonError("Document not found.", 404);
  const before = existing.data as OpportunityDocument;

  const { updates, error } = collect(body, true);
  if (error) return jsonError(error);
  if (!Object.keys(updates).length) return jsonError("No changes were provided.");

  const saved = await client.from("pipeline_opportunity_documents").update(updates).eq("id", before.id).select("*").single();
  if (saved.error || !saved.data) return jsonError(saved.error?.message ?? "Couldn't save the document.", 400);
  const doc = saved.data as OpportunityDocument;

  await recordEvent(client, {
    opportunity_id: id, event_type: "document_updated", actor_id: actorId, log_kind: doc.kind,
    summary: updates.status && updates.status !== before.status
      ? `${KIND_LABEL[doc.kind]} marked ${doc.status}: ${doc.title}`
      : `${KIND_LABEL[doc.kind]} updated: ${doc.title}`,
    details: { document_id: doc.id, status: doc.status, previous_status: before.status, fields: Object.keys(updates), amount: doc.amount === null ? null : Number(doc.amount) },
  });
  return NextResponse.json({ document: doc });
}
