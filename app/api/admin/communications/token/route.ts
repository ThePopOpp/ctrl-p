import { NextResponse } from "next/server";
import twilio from "twilio";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !authToken) {
    return jsonError("Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).", 501);
  }

  // Use API Key if available, otherwise fall back to Account SID/Auth Token
  const keySid = apiKeySid || accountSid;
  const keySecret = apiKeySecret || authToken;

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid || undefined,
    incomingAllow: true,
  });

  const token = new AccessToken(accountSid, keySid, keySecret, {
    identity: "ctrl-p-admin",
    ttl: 3600,
  });
  token.addGrant(voiceGrant);

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/voice`
    : null;

  return NextResponse.json({
    token: token.toJwt(),
    identity: "ctrl-p-admin",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || null,
    twimlAppSid: twimlAppSid || null,
    webhookUrl,
  });
}
