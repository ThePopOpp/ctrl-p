import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { cleanText, loadAccessibleOpportunity, readJson, recordEvent, verifyPipelineRequest } from "@/lib/pipeline/server";
import { FILE_KINDS, keysOf } from "@/lib/pipeline/stages";
import type { OpportunityFile } from "@/lib/pipeline/types";
import { isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

const KINDS = keysOf(FILE_KINDS);

async function authorize(request: Request, id: string) {
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return { response: verified.error };
  if (!isUuid(id)) return { response: jsonError("Opportunity not found.", 404) };
  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return { response: loaded.response };
  return { context: verified.context };
}

/** Link a file stored elsewhere (Drive, Dropbox, the artwork bucket, a customer's link). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const body = await readJson<{ label?: string; url?: string; kind?: string; artwork_file_id?: string | null }>(request);
  const label = cleanText(body?.label, 200);
  const url = cleanText(body?.url, 2000);
  if (!label) return jsonError("Name the file.");
  if (!url || !/^https?:\/\//i.test(url)) return jsonError("Enter a full link starting with http:// or https://.");
  const kind = body?.kind && KINDS.has(body.kind) ? body.kind : "reference";
  if (body?.artwork_file_id && !isUuid(body.artwork_file_id)) return jsonError("Unknown artwork file.");

  const created = await client
    .from("pipeline_opportunity_files")
    .insert({ opportunity_id: id, label, url, kind, artwork_file_id: body?.artwork_file_id ?? null, created_by: actorId })
    .select("*")
    .single();
  if (created.error) return jsonError(created.error.message, 400);

  await recordEvent(client, { opportunity_id: id, event_type: "file_linked", actor_id: actorId, summary: `File linked: ${label}`, details: { file_id: (created.data as OpportunityFile).id, kind, url } });
  return NextResponse.json({ file: created.data }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const fileId = new URL(request.url).searchParams.get("file_id");
  if (!isUuid(fileId)) return jsonError("File is required.");
  const removed = await client.from("pipeline_opportunity_files").delete().eq("id", fileId).eq("opportunity_id", id).select("label, url").maybeSingle();
  if (removed.error) return jsonError(removed.error.message, 400);
  if (!removed.data) return jsonError("File not found.", 404);

  const file = removed.data as { label: string; url: string };
  await recordEvent(client, { opportunity_id: id, event_type: "fields_updated", actor_id: actorId, summary: `File link removed: ${file.label}`, details: { url: file.url } });
  return NextResponse.json({ ok: true });
}
