import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

// Proxy Twilio recording audio — avoids exposing credentials to browser
export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) return jsonError("Twilio credentials not configured.", 501);

  const url = new URL(request.url);
  const recordingSid = url.searchParams.get("sid");
  if (!recordingSid) return jsonError("sid is required.", 400);

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const upstream = await fetch(twilioUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!upstream.ok) return jsonError("Recording not found.", 404);

  const audioBuffer = await upstream.arrayBuffer();
  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
