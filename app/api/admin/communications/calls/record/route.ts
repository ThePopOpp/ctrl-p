import { NextResponse } from "next/server";
import twilio from "twilio";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null);
  const callSid = String(body?.callSid || "").trim();
  if (!callSid) return jsonError("callSid is required.");

  const accountSid = serverEnv("TWILIO_ACCOUNT_SID");
  const authToken = serverEnv("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) return jsonError("Twilio credentials not configured.", 501);

  const publicUrl = serverEnv("PUBLIC_APP_URL") || "https://my.controlp.io";

  try {
    const client = twilio(accountSid, authToken);
    const recording = await client.calls(callSid).recordings.create({
      recordingStatusCallback: `${publicUrl}/api/webhooks/twilio/recording-status`,
      recordingStatusCallbackMethod: "POST",
    });
    return NextResponse.json({ recordingSid: recording.sid, status: recording.status });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not start recording.", 400);
  }
}
