import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import twilio from "twilio";
import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

type SendChannel = "email" | "sms" | "email_sms" | "dashboard" | "internal";
type SendMode = "single" | "bulk";

type SendMessagePayload = {
  channel?: SendChannel;
  mode?: SendMode;
  recipient?: string;
  userIds?: string[];
  role?: string;
  subject?: string;
  body?: string;
  orderId?: string | null;
};

type Recipient = {
  user_id: string | null;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: string | null;
};

const VALID_CHANNELS = new Set(["email", "sms", "email_sms", "dashboard", "internal"]);
const VALID_MODES = new Set(["single", "bulk"]);

function asBoolean(value: string) {
  return value.toLowerCase() === "true" || value === "1";
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function cleanRecipient(value: string | null | undefined) {
  return String(value || "").trim();
}

function missing(...names: string[]) {
  return names.filter((name) => !serverEnv(name));
}

async function resolveRecipients(
  adminClient: SupabaseClient,
  payload: SendMessagePayload,
) {
  const channel = payload.channel || "email";
  const mode = payload.mode || "single";

  if (mode === "single") {
    const direct = cleanRecipient(payload.recipient);
    if (!direct) return { recipients: [] as Recipient[] };

    const column = channel === "sms" ? "phone" : "email";
    const matchValue = channel === "sms" ? normalizePhone(direct) : direct.toLowerCase();
    const usersResult = await adminClient
      .from("users")
      .select("id, email, phone, full_name, role, status, deleted_at")
      .eq(column, matchValue)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(1);

    const user = usersResult.data?.[0];
    return {
      recipients: [{
        user_id: user?.id ?? null,
        email: channel === "sms" ? user?.email ?? null : direct,
        phone: channel === "sms" ? direct : user?.phone ?? null,
        full_name: user?.full_name ?? null,
        role: user?.role ?? null,
      }],
    };
  }

  let query = adminClient
    .from("users")
    .select("id, email, phone, full_name, role")
    .eq("status", "active")
    .is("deleted_at", null);

  if (payload.userIds?.length) {
    query = query.in("id", payload.userIds);
  } else if (payload.role && payload.role !== "all") {
    query = query.eq("role", payload.role);
  }

  const usersResult = await query.limit(500);
  if (usersResult.error) return { error: jsonError(usersResult.error.message, 400) };

  const recipients = (usersResult.data ?? []).map((user) => ({
    user_id: user.id,
    email: user.email,
    phone: user.phone,
    full_name: user.full_name,
    role: user.role,
  }));

  return { recipients };
}

async function sendEmail(recipients: Recipient[], subject: string, body: string) {
  const missingEnv = missing("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD");
  if (missingEnv.length) return { error: jsonError(`Missing SMTP environment variables: ${missingEnv.join(", ")}`, 501) };

  const transporter = nodemailer.createTransport({
    host: serverEnv("SMTP_HOST"),
    port: Number(serverEnv("SMTP_PORT") || 465),
    secure: asBoolean(serverEnv("SMTP_SECURE") || "true"),
    auth: {
      user: serverEnv("SMTP_USER"),
      pass: serverEnv("SMTP_PASSWORD"),
    },
  });

  const from = serverEnv("EMAIL_FROM") || serverEnv("SMTP_USER");
  const replyTo = serverEnv("EMAIL_REPLY_TO") || from;
  const sent: string[] = [];
  const failed: { recipient: string; error: string }[] = [];

  for (const recipient of recipients) {
    const to = cleanRecipient(recipient.email);
    if (!to) {
      failed.push({ recipient: recipient.user_id || "unknown", error: "Missing email address." });
      continue;
    }

    try {
      await transporter.sendMail({ from, replyTo, to, subject, text: body });
      sent.push(to);
    } catch (error) {
      failed.push({ recipient: to, error: error instanceof Error ? error.message : "Email send failed." });
    }
  }

  return { sent, failed };
}

async function sendSms(recipients: Recipient[], body: string) {
  const missingEnv = missing("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER");
  if (missingEnv.length) return { error: jsonError(`Missing Twilio environment variables: ${missingEnv.join(", ")}`, 501) };

  const client = twilio(serverEnv("TWILIO_ACCOUNT_SID"), serverEnv("TWILIO_AUTH_TOKEN"));
  const from = serverEnv("TWILIO_PHONE_NUMBER");
  const sent: string[] = [];
  const failed: { recipient: string; error: string }[] = [];

  for (const recipient of recipients) {
    const to = normalizePhone(recipient.phone);
    if (!to) {
      failed.push({ recipient: recipient.user_id || "unknown", error: "Missing phone number." });
      continue;
    }

    try {
      await client.messages.create({ from, to, body });
      sent.push(to);
    } catch (error) {
      failed.push({ recipient: to, error: error instanceof Error ? error.message : "SMS send failed." });
    }
  }

  return { sent, failed };
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const payload = (await request.json().catch(() => null)) as SendMessagePayload | null;
  if (!payload) return jsonError("Invalid message payload.");

  const channel = payload.channel || "email";
  const mode = payload.mode || "single";
  const body = String(payload.body || "").trim();
  const subject = String(payload.subject || "").trim();

  if (!VALID_CHANNELS.has(channel)) return jsonError("Unsupported message channel.");
  if (!VALID_MODES.has(mode)) return jsonError("Unsupported send mode.");
  if (!body) return jsonError("Message body is required.");
  if ((channel === "email" || channel === "email_sms") && !subject) return jsonError("Email subject is required.");

  const resolved = await resolveRecipients(verified.adminClient, { ...payload, channel, mode });
  if (resolved.error) return resolved.error;

  const recipients = resolved.recipients.filter((recipient) => {
    if (channel === "sms") return Boolean(normalizePhone(recipient.phone));
    if (channel === "email") return Boolean(cleanRecipient(recipient.email));
    if (channel === "email_sms") return Boolean(cleanRecipient(recipient.email) || normalizePhone(recipient.phone));
    return Boolean(recipient.user_id || cleanRecipient(recipient.email) || cleanRecipient(recipient.phone));
  });

  if (!recipients.length) return jsonError("No reachable recipients were found.");

  let delivery: { sent?: string[]; failed?: { recipient: string; error: string }[]; error?: NextResponse } = {};
  let messageRows: {
    user_id: string | null;
    order_id: string | null;
    channel: string;
    direction: string;
    subject: string | null;
    body: string;
    internal_only: boolean;
    sent_at: string;
    created_by: string;
  }[] = [];
  const now = new Date().toISOString();

  if (channel === "email") {
    delivery = await sendEmail(recipients, subject, body);
  } else if (channel === "sms") {
    delivery = await sendSms(recipients, body);
  } else if (channel === "email_sms") {
    const emailRecipients = recipients.filter((recipient) => cleanRecipient(recipient.email));
    const smsRecipients = recipients.filter((recipient) => normalizePhone(recipient.phone));
    const emailDelivery = emailRecipients.length ? await sendEmail(emailRecipients, subject, body) : { sent: [], failed: [] };
    if (emailDelivery.error) return emailDelivery.error;
    const smsDelivery = smsRecipients.length ? await sendSms(smsRecipients, body) : { sent: [], failed: [] };
    if (smsDelivery.error) return smsDelivery.error;
    delivery = {
      sent: [...(emailDelivery.sent ?? []), ...(smsDelivery.sent ?? [])],
      failed: [...(emailDelivery.failed ?? []), ...(smsDelivery.failed ?? [])],
    };
    messageRows = [
      ...emailRecipients.map((recipient) => ({
        user_id: recipient.user_id,
        order_id: payload.orderId && payload.orderId !== "none" ? payload.orderId : null,
        channel: "email",
        direction: "outbound",
        subject: subject || null,
        body,
        internal_only: false,
        sent_at: now,
        created_by: verified.actorId,
      })),
      ...smsRecipients.map((recipient) => ({
        user_id: recipient.user_id,
        order_id: payload.orderId && payload.orderId !== "none" ? payload.orderId : null,
        channel: "sms",
        direction: "outbound",
        subject: subject || null,
        body,
        internal_only: false,
        sent_at: now,
        created_by: verified.actorId,
      })),
    ];
  } else {
    delivery = { sent: recipients.map((recipient) => recipient.user_id || recipient.email || recipient.phone || "recipient"), failed: [] };
  }

  if (delivery.error) return delivery.error;

  const rows = messageRows.length ? messageRows : recipients.map((recipient) => ({
    user_id: recipient.user_id,
    order_id: payload.orderId && payload.orderId !== "none" ? payload.orderId : null,
    channel,
    direction: "outbound",
    subject: subject || null,
    body,
    internal_only: channel === "internal",
    sent_at: now,
    created_by: verified.actorId,
  }));

  const insertResult = await verified.adminClient.from("messages").insert(rows).select("id");
  if (insertResult.error) return jsonError(insertResult.error.message, 400);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "messages_sent",
    entity_type: "message",
    entity_id: insertResult.data?.[0]?.id ?? null,
    details: {
      channel,
      mode,
      requested: recipients.length,
      sent: delivery.sent?.length ?? 0,
      failed: delivery.failed ?? [],
    },
  });

  return NextResponse.json({
    messageIds: insertResult.data?.map((row) => row.id) ?? [],
    requested: recipients.length,
    sent: delivery.sent?.length ?? 0,
    failed: delivery.failed ?? [],
  });
}
