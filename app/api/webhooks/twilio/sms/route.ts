import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

import { getServerSupabaseConfig, serverEnv } from "@/lib/admin/server-auth";

function xmlResponse(status = 200) {
  return new Response("<Response></Response>", {
    status,
    headers: { "content-type": "text/xml" },
  });
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function shouldValidateWebhook() {
  return ["true", "1"].includes(serverEnv("TWILIO_VALIDATE_WEBHOOK").toLowerCase());
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));

  if (shouldValidateWebhook()) {
    const signature = request.headers.get("x-twilio-signature") || "";
    const publicUrl = serverEnv("PUBLIC_APP_URL");
    const url = publicUrl ? `${publicUrl.replace(/\/$/, "")}/api/webhooks/twilio/sms` : request.url;
    const valid = twilio.validateRequest(serverEnv("TWILIO_AUTH_TOKEN"), signature, url, params);
    if (!valid) return xmlResponse(403);
  }

  const config = getServerSupabaseConfig();
  if (config.error) return xmlResponse(500);

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const from = normalizePhone(params.From);
  const body = String(params.Body || "").trim() || "Inbound SMS message.";
  const providerId = String(params.MessageSid || "").trim() || null;

  let userId: string | null = null;
  if (from) {
    const userResult = await adminClient
      .from("users")
      .select("id")
      .eq("phone", from)
      .maybeSingle();
    userId = userResult.data?.id ?? null;
  }

  await adminClient.from("messages").insert({
    user_id: userId,
    order_id: null,
    channel: "sms",
    direction: "inbound",
    subject: from ? `SMS from ${from}` : "Inbound SMS",
    body,
    internal_only: false,
    sent_at: new Date().toISOString(),
    created_by: null,
  });

  if (providerId) {
    await adminClient.from("notifications").insert({
      user_id: userId,
      order_id: null,
      event_key: "twilio.sms.inbound",
      channel: "sms",
      status: "received",
      provider_id: providerId,
      payload: params,
      sent_at: new Date().toISOString(),
    });
  }

  return xmlResponse();
}
