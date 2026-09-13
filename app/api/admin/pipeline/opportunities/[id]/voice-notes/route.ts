import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { transcribeAudio } from "@/lib/pipeline/comm-server";
import { cleanText, loadAccessibleOpportunity, recordEvent, verifyPipelineRequest } from "@/lib/pipeline/server";
import { isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

const BUCKET = "pipeline-voice-notes";
const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** Save a recorded voice note to private storage and attach it to the opportunity. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return verified.error;
  if (!isUuid(id)) return jsonError("Opportunity not found.", 404);
  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return loaded.response;
  const { client, actorId } = verified.context;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return jsonError("Record a voice note first.");
  if (file.size > MAX_BYTES) return jsonError("Voice notes can be up to 10 MB.");
  const mime = file.type.split(";")[0].trim().toLowerCase();
  const extension = EXTENSIONS[mime];
  if (!extension) return jsonError("That audio format isn't supported.");

  const title = cleanText(form?.get("title"), 200) ?? null;
  const duration = Math.max(0, Math.round(Number(form?.get("duration_seconds")) || 0));
  const wantsTranscript = form?.get("transcribe") === "true";

  const path = `${id}/${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await client.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (upload.error) {
    return jsonError(`Couldn't store the voice note: ${upload.error.message}. The ${BUCKET} bucket is created by migration 20260914000001_pipeline_quick_actions.sql.`, 500);
  }

  let transcript: string | null = null;
  let transcriptStatus: "not_requested" | "transcribed" | "unavailable" | "failed" = "not_requested";
  let transcriptError: string | null = null;
  if (wantsTranscript) {
    const result = await transcribeAudio(new Blob([bytes], { type: mime }), `voice-note.${extension}`);
    if (result.ok) {
      transcript = result.text || null;
      transcriptStatus = "transcribed";
    } else {
      transcriptStatus = result.status === 501 ? "unavailable" : "failed";
      transcriptError = result.error;
    }
  }

  const minutes = duration ? ` (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")})` : "";
  const error = await recordEvent(client, {
    opportunity_id: id, event_type: "communication", actor_id: actorId, log_kind: "voice_note",
    summary: `${title || "Voice note"}${minutes}`,
    body: transcript,
    details: { status: "saved", storage_path: path, mime, size: file.size, duration_seconds: duration, transcript_status: transcriptStatus, transcript_error: transcriptError },
  });
  if (error) {
    await client.storage.from(BUCKET).remove([path]).catch(() => null);
    return jsonError(error.message, 400);
  }

  return NextResponse.json({ saved: true, transcriptStatus, transcriptError }, { status: 201 });
}
