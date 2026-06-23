import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseConfig } from "@/lib/admin/server-auth";

function xmlOk() {
  return new Response("<Response></Response>", {
    status: 200,
    headers: { "content-type": "text/xml" },
  });
}

// Twilio POSTs here when a call recording changes status (completed, failed, etc.)
export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, String(v)]));

  const recordingSid = params.RecordingSid ?? "";
  const callSid = params.CallSid ?? "";
  const recordingUrl = params.RecordingUrl ?? "";
  const recordingStatus = params.RecordingStatus ?? "";
  const recordingDuration = params.RecordingDuration ?? "";

  const config = getServerSupabaseConfig();
  if (config.error) return xmlOk();

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await adminClient.from("activity_logs").insert({
    actor_id: null,
    action: "twilio_recording_status",
    entity_type: "recording",
    entity_id: recordingSid || null,
    details: {
      call_sid: callSid,
      recording_sid: recordingSid,
      recording_url: recordingUrl ? `${recordingUrl}.mp3` : null,
      recording_status: recordingStatus,
      recording_duration_seconds: recordingDuration ? Number(recordingDuration) : null,
    },
  });

  return xmlOk();
}
