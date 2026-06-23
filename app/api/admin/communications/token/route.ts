import { NextResponse } from "next/server";
import twilio from "twilio";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

function getOwnedNumbers(): string[] {
  const fromEnv = process.env.TWILIO_PHONE_NUMBERS || "";
  if (fromEnv) return fromEnv.split(",").map((n) => n.trim()).filter(Boolean);
  const single = process.env.TWILIO_PHONE_NUMBER || "";
  return single ? [single] : [];
}

function getSmsNumbers(): string[] {
  const fromEnv = process.env.TWILIO_SMS_NUMBERS || "";
  if (fromEnv) return fromEnv.split(",").map((n) => n.trim()).filter(Boolean);
  const owned = getOwnedNumbers();
  return owned.length ? [owned[0]] : [];
}

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

  const ownedNumbers = getOwnedNumbers();
  const smsNumbers = getSmsNumbers();
  const defaultNumber = process.env.TWILIO_PHONE_NUMBER || ownedNumbers[0] || null;

  return NextResponse.json({
    token: token.toJwt(),
    identity: "ctrl-p-admin",
    twimlAppSid: twimlAppSid || null,
    // All numbers available for voice dialing
    phoneNumbers: ownedNumbers,
    // Default caller ID for outbound calls
    defaultPhoneNumber: defaultNumber,
    // Numbers allowed for SMS (only the two 480s)
    smsPhoneNumbers: smsNumbers,
  });
}
