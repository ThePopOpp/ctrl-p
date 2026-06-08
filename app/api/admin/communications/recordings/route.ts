import { NextResponse } from "next/server";
import twilio from "twilio";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return jsonError("Twilio credentials not configured.", 501);
  }

  const url = new URL(request.url);
  const callSid = url.searchParams.get("callSid");

  if (!callSid) return jsonError("callSid is required.", 400);

  const client = twilio(accountSid, authToken);
  const recordings = await client.recordings.list({ callSid, limit: 20 });

  const result = recordings.map((rec) => ({
    sid: rec.sid,
    callSid: rec.callSid,
    duration: rec.duration,
    status: rec.status,
    source: rec.source,
    dateCreated: rec.dateCreated,
    audioUrl: `/api/admin/communications/recordings/audio?sid=${encodeURIComponent(rec.sid)}`,
  }));

  return NextResponse.json({ recordings: result });
}
