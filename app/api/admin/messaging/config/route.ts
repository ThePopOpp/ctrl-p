import { NextResponse } from "next/server";

import { serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

function configured(...names: string[]) {
  return names.every((name) => Boolean(serverEnv(name)));
}

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  return NextResponse.json({
    twilio: {
      configured: configured("TWILIO_PHONE_NUMBER", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"),
      phoneNumber: serverEnv("TWILIO_PHONE_NUMBER"),
      hasAccountSid: Boolean(serverEnv("TWILIO_ACCOUNT_SID")),
      hasAuthToken: Boolean(serverEnv("TWILIO_AUTH_TOKEN")),
      validateWebhook: ["true", "1"].includes(serverEnv("TWILIO_VALIDATE_WEBHOOK").toLowerCase()),
      webhookUrl: `${serverEnv("PUBLIC_APP_URL").replace(/\/$/, "") || "https://your-domain.com"}/api/webhooks/twilio/sms`,
    },
    smtp: {
      configured: configured("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"),
      host: serverEnv("SMTP_HOST"),
      port: serverEnv("SMTP_PORT"),
      secure: serverEnv("SMTP_SECURE"),
      user: serverEnv("SMTP_USER"),
      from: serverEnv("EMAIL_FROM"),
      replyTo: serverEnv("EMAIL_REPLY_TO"),
      hasPassword: Boolean(serverEnv("SMTP_PASSWORD")),
    },
    imap: {
      configured: configured("IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD"),
      host: serverEnv("IMAP_HOST"),
      port: serverEnv("IMAP_PORT"),
      secure: serverEnv("IMAP_SECURE"),
      user: serverEnv("IMAP_USER"),
      mailbox: serverEnv("IMAP_MAILBOX") || "INBOX",
      hasPassword: Boolean(serverEnv("IMAP_PASSWORD")),
    },
    pop: {
      configured: configured("POP_HOST", "POP_PORT", "POP_USER", "POP_PASSWORD"),
      host: serverEnv("POP_HOST"),
      port: serverEnv("POP_PORT"),
      secure: serverEnv("POP_SECURE"),
      user: serverEnv("POP_USER"),
      hasPassword: Boolean(serverEnv("POP_PASSWORD")),
    },
  });
}
