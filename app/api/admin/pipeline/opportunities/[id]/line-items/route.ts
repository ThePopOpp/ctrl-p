import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { loadAccessibleOpportunity, readJson, recordEvent, verifyPipelineRequest } from "@/lib/pipeline/server";
import { collectLineItemFields, isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

async function authorize(request: Request, id: string) {
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return { response: verified.error };
  if (!isUuid(id)) return { response: jsonError("Opportunity not found.", 404) };
  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return { response: loaded.response };
  return { context: verified.context, opportunity: loaded.opportunity };
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return jsonError("Line item details are required.");
  const { updates, error } = collectLineItemFields(body, false);
  if (error) return jsonError(error);

  const count = await client.from("pipeline_opportunity_line_items").select("id", { count: "exact", head: true }).eq("opportunity_id", id);
  const created = await client
    .from("pipeline_opportunity_line_items")
    .insert({ ...updates, opportunity_id: id, position: count.count ?? 0 })
    .select("*")
    .single();
  if (created.error) return jsonError(created.error.message, 400);

  await recordEvent(client, { opportunity_id: id, event_type: "fields_updated", actor_id: actorId, summary: `Line item added: ${updates.description}` });
  return NextResponse.json({ lineItem: created.data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const body = await readJson<Record<string, unknown> & { item_id?: string }>(request);
  if (!body || !isUuid(body.item_id)) return jsonError("Line item is required.");
  const { updates, error } = collectLineItemFields(body, true);
  if (error) return jsonError(error);
  if (!Object.keys(updates).length) return jsonError("No changes were provided.");

  const saved = await client
    .from("pipeline_opportunity_line_items")
    .update(updates)
    .eq("id", body.item_id)
    .eq("opportunity_id", id)
    .select("*")
    .maybeSingle();
  if (saved.error) return jsonError(saved.error.message, 400);
  if (!saved.data) return jsonError("Line item not found.", 404);

  await recordEvent(client, {
    opportunity_id: id,
    event_type: "fields_updated",
    actor_id: actorId,
    summary: `Line item updated: ${(saved.data as { description: string }).description}`,
    details: { line_item_id: body.item_id, fields: Object.keys(updates) },
  });
  return NextResponse.json({ lineItem: saved.data });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const itemId = new URL(request.url).searchParams.get("item_id");
  if (!isUuid(itemId)) return jsonError("Line item is required.");

  const removed = await client
    .from("pipeline_opportunity_line_items")
    .delete()
    .eq("id", itemId)
    .eq("opportunity_id", id)
    .select("description")
    .maybeSingle();
  if (removed.error) return jsonError(removed.error.message, 400);
  if (!removed.data) return jsonError("Line item not found.", 404);

  await recordEvent(client, {
    opportunity_id: id,
    event_type: "fields_updated",
    actor_id: actorId,
    summary: `Line item removed: ${(removed.data as { description: string }).description}`,
  });
  return NextResponse.json({ ok: true });
}
