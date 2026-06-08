import { NextResponse } from "next/server";
import twilio from "twilio";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    return jsonError("Twilio credentials not configured.", 501);
  }

  const url = new URL(request.url);
  const voicemailOnly = url.searchParams.get("voicemail") === "true";
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);

  const client = twilio(accountSid, authToken);

  const [inboundCalls, outboundCalls] = await Promise.all([
    phoneNumber
      ? client.calls.list({ to: phoneNumber, limit })
      : Promise.resolve([]),
    client.calls.list({ from: phoneNumber || undefined, limit }),
  ]);

  const allCalls = [...inboundCalls, ...outboundCalls]
    .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
    .slice(0, limit);

  const calls = allCalls.map((call) => ({
    sid: call.sid,
    to: call.to,
    from: call.from,
    status: call.status,
    direction: call.direction,
    duration: call.duration,
    price: call.price,
    priceUnit: call.priceUnit,
    dateCreated: call.dateCreated,
    startTime: call.startTime,
    endTime: call.endTime,
  }));

  if (voicemailOnly) {
    // Voicemail = inbound calls that went to no-answer but have recordings
    const inbound = calls.filter((c) => c.direction === "inbound" && (c.status === "no-answer" || c.status === "completed"));
    return NextResponse.json({ calls: inbound });
  }

  return NextResponse.json({ calls });
}
