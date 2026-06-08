import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as { recordingSid?: string } | null;
  if (!body?.recordingSid) return jsonError("recordingSid is required.", 400);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!accountSid || !authToken) return jsonError("Twilio credentials not configured.", 501);
  if (!openaiKey) return jsonError("OPENAI_API_KEY not configured. Add it to enable AI transcription.", 501);

  // Fetch recording audio from Twilio
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${body.recordingSid}.mp3`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const audioResponse = await fetch(twilioUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!audioResponse.ok) return jsonError("Could not fetch recording from Twilio.", 404);

  const audioBuffer = await audioResponse.arrayBuffer();
  const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

  // Transcribe with OpenAI Whisper
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.mp3");
  formData.append("model", "whisper-1");
  formData.append("response_format", "text");

  const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!whisperResponse.ok) {
    const error = await whisperResponse.text();
    return jsonError(`OpenAI transcription failed: ${error}`, 500);
  }

  const transcript = await whisperResponse.text();
  return NextResponse.json({ transcript: transcript.trim() });
}
