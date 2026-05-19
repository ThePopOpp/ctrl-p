import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import twilio from "twilio";

import { buildPaymentMessage, getPaymentDocumentUrl, loadPaymentDocument, type PaymentDocumentKind } from "@/lib/admin/payment-documents";
import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

type DeliveryChannel = "email" | "sms" | "both";

function asBoolean(value: string) {
  return value.toLowerCase() === "true" || value === "1";
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return String(value || "").trim();
}

async function sendEmail(to: string, subject: string, body: string) {
  if (!serverEnv("SMTP_HOST") || !serverEnv("SMTP_PORT") || !serverEnv("SMTP_USER") || !serverEnv("SMTP_PASSWORD")) {
    throw new Error("SMTP environment variables are required to send invoice or receipt emails.");
  }

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
  await transporter.sendMail({ from, replyTo, to, subject, text: body });
}

async function sendSms(to: string, body: string) {
  if (!serverEnv("TWILIO_ACCOUNT_SID") || !serverEnv("TWILIO_AUTH_TOKEN") || !serverEnv("TWILIO_PHONE_NUMBER")) {
    throw new Error("Twilio environment variables are required to send invoice or receipt SMS messages.");
  }

  const client = twilio(serverEnv("TWILIO_ACCOUNT_SID"), serverEnv("TWILIO_AUTH_TOKEN"));
  await client.messages.create({ from: serverEnv("TWILIO_PHONE_NUMBER"), to, body });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { paymentId } = await context.params;
  const body = await request.json().catch(() => null) as {
    kind?: PaymentDocumentKind;
    channel?: DeliveryChannel;
    recipient_email?: string;
    recipient_phone?: string;
  } | null;

  const kind = body?.kind === "receipt" ? "receipt" : "invoice";
  const channel = body?.channel === "both" || body?.channel === "sms" ? body.channel : "email";
  const paymentResult = await loadPaymentDocument(verified.adminClient, paymentId);
  if (paymentResult.error || !paymentResult.data) {
    return jsonError(paymentResult.error?.message || "Payment not found.", 404);
  }
  const payment = paymentResult.data as any;

  const billingContact = asRecord(payment.billing_contact);
  const customer = asRecord(billingContact.customer);
  const appUrl = serverEnv("PUBLIC_APP_URL") || "https://my.controlp.io";
  const documentUrl = getPaymentDocumentUrl(appUrl, paymentId, kind).replace("/api/admin/payments/", "/api/payments/");
  const message = buildPaymentMessage({ kind, payment, documentUrl });
  const order = Array.isArray(payment.orders) ? payment.orders[0] : payment.orders;
  const recipientEmail = text(body?.recipient_email) || text(customer.email) || text(order?.customer_email);
  const recipientPhone = normalizePhone(text(body?.recipient_phone) || text(customer.phone) || text(order?.customer_phone));
  const sent: string[] = [];

  try {
    if (channel === "email" || channel === "both") {
      if (!recipientEmail) throw new Error("Customer email is required for email delivery.");
      await sendEmail(recipientEmail, message.subject, message.body);
      sent.push(recipientEmail);
    }

    if (channel === "sms" || channel === "both") {
      if (!recipientPhone) throw new Error("Customer phone is required for SMS delivery.");
      await sendSms(recipientPhone, message.sms);
      sent.push(recipientPhone);
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Document delivery failed.", 502);
  }

  await verified.adminClient.from("messages").insert(sent.map((recipient) => ({
    user_id: payment.user_id,
    order_id: payment.order_id,
    channel: recipient.includes("@") ? "email" : "sms",
    direction: "outbound",
    subject: recipient.includes("@") ? message.subject : null,
    body: recipient.includes("@") ? message.body : message.sms,
    sent_at: new Date().toISOString(),
    created_by: verified.actorId,
  })));

  await verified.adminClient
    .from("payments")
    .update({ delivery_status: kind === "receipt" ? "receipt_sent" : "sent", document_status: "sent" })
    .eq("id", paymentId);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: kind === "receipt" ? "receipt_sent" : "invoice_sent",
    entity_type: "payment",
    entity_id: paymentId,
    details: { channel, sent, document_url: documentUrl },
  });

  return NextResponse.json({ sent, documentUrl });
}
