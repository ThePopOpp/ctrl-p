import nodemailer from "nodemailer";
import twilio from "twilio";
import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/admin/server-auth";

const TRIGGER_STATUSES = new Set([
  "waiting_on_proof_approval",
  "waiting_on_customer",
  "needs_customer_review",
  "completed",
]);

type StatusTemplate = {
  subject: string;
  body: (orderNumber: string, itemTitle: string) => string;
};

const STATUS_TEMPLATES: Record<string, StatusTemplate> = {
  waiting_on_proof_approval: {
    subject: "Your proof is ready for review",
    body: (num, title) =>
      `Your proof for order #${num} ("${title}") is ready for your review. Please log in to your customer dashboard to approve or request changes.`,
  },
  waiting_on_customer: {
    subject: "Action required — your order needs attention",
    body: (num, title) =>
      `We need your input on order #${num} ("${title}"). Please log in to your customer dashboard to respond.`,
  },
  needs_customer_review: {
    subject: "Your order is ready for your review",
    body: (num, title) =>
      `Your order #${num} ("${title}") is ready for your review. Please log in to your customer dashboard.`,
  },
  completed: {
    subject: "Your order is complete",
    body: (num, title) =>
      `Great news! Your order #${num} ("${title}") is complete and ready for pickup. Please contact us to arrange collection.`,
  },
};

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/[^\d+]/g, "");
}

async function tryEmail(to: string, subject: string, body: string) {
  const host = serverEnv("SMTP_HOST");
  const port = serverEnv("SMTP_PORT");
  const user = serverEnv("SMTP_USER");
  const pass = serverEnv("SMTP_PASSWORD");
  if (!host || !port || !user || !pass) return;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port || 465),
    secure: (serverEnv("SMTP_SECURE") || "true").toLowerCase() === "true",
    auth: { user, pass },
  });

  const from = serverEnv("EMAIL_FROM") || user;
  try {
    await transporter.sendMail({ from, to, subject, text: body });
  } catch {
    // best-effort delivery — don't fail the status update
  }
}

async function trySms(to: string, body: string) {
  const sid = serverEnv("TWILIO_ACCOUNT_SID");
  const token = serverEnv("TWILIO_AUTH_TOKEN");
  const from = serverEnv("TWILIO_PHONE_NUMBER");
  if (!sid || !token || !from) return;

  try {
    const client = twilio(sid, token);
    await client.messages.create({ from, to, body });
  } catch {
    // best-effort delivery — don't fail the status update
  }
}

export type NotifiableItem = {
  id: string;
  title?: string | null;
  order_id?: string | null;
  orders?: {
    order_number?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
  } | null;
  users?: {
    id?: string;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export async function triggerStatusNotification(
  adminClient: SupabaseClient,
  item: NotifiableItem,
  prevStatus: string,
  newStatus: string,
  actorId: string,
) {
  if (prevStatus === newStatus) return;
  if (!TRIGGER_STATUSES.has(newStatus)) return;

  const template = STATUS_TEMPLATES[newStatus];
  if (!template) return;

  const order = item.orders;
  const customerUser = item.users;

  const email = order?.customer_email || customerUser?.email || null;
  const phone = normalizePhone(order?.customer_phone || customerUser?.phone || "");
  const orderNumber = order?.order_number || item.order_id?.slice(0, 8) || "—";
  const itemTitle = item.title || "your order";

  if (!email && !phone) return;

  const subject = template.subject;
  const body = template.body(orderNumber, itemTitle);
  const now = new Date().toISOString();

  // Resolve user_id for the dashboard notification bell
  let userId: string | null = customerUser?.id ?? null;
  if (!userId && email) {
    const userResult = await adminClient
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    userId = userResult.data?.id ?? null;
  }

  // Write dashboard message — surfaces in the customer notification bell
  await adminClient.from("messages").insert({
    user_id: userId,
    order_id: item.order_id || null,
    channel: "dashboard",
    direction: "outbound",
    subject,
    body,
    internal_only: false,
    sent_at: now,
    created_by: actorId,
  });

  // Best-effort external delivery
  const deliveryPromises: Promise<void>[] = [];
  if (email) deliveryPromises.push(tryEmail(email, subject, body));
  if (phone) deliveryPromises.push(trySms(phone, body));
  await Promise.all(deliveryPromises);
}
