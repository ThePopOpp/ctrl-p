import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError, serverEnv } from "@/lib/admin/server-auth";
import { sendPaymentConfirmed } from "@/lib/email/order-emails";
import { runCardAutomations } from "@/lib/automations/runner";

type SquareEnvironment = "sandbox" | "production";

type SquareWebhookPayload = {
  type?: string;
  event_id?: string;
  created_at?: string;
  data?: {
    id?: string;
    type?: string;
    object?: {
      payment?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount_money?: { amount?: number; currency?: string };
        total_money?: { amount?: number; currency?: string };
        receipt_url?: string;
        created_at?: string;
        updated_at?: string;
      };
      refund?: {
        id?: string;
        payment_id?: string;
        order_id?: string;
        status?: string;
        amount_money?: { amount?: number; currency?: string };
        reason?: string;
        created_at?: string;
        updated_at?: string;
      };
      order?: {
        id?: string;
        state?: string;
        total_money?: { amount?: number; currency?: string };
        updated_at?: string;
      };
    };
  };
};

function webhookConfig(environment: SquareEnvironment) {
  const signatureKey = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY")
    : serverEnv("SQUARE_SANDBOX_WEBHOOK_SIGNATURE_KEY");
  const notificationUrl = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_WEBHOOK_URL")
    : serverEnv("SQUARE_SANDBOX_WEBHOOK_URL");

  return { notificationUrl, signatureKey };
}

function verifySquareSignature(rawBody: string, signature: string, notificationUrl: string, signatureKey: string) {
  if (!signature || !notificationUrl || !signatureKey) return false;

  const hmac = createHmac("sha256", signatureKey);
  hmac.update(`${notificationUrl}${rawBody}`);
  const expected = hmac.digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

function amountFromCents(value: number | undefined) {
  return Number(((value || 0) / 100).toFixed(2));
}

function mapSquarePaymentStatus(status: string | undefined) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "COMPLETED") return "paid";
  if (normalized === "APPROVED" || normalized === "PENDING") return "pending";
  if (normalized === "FAILED" || normalized === "CANCELED") return "failed";
  return "pending";
}

function mapSquareRefundStatus(status: string | undefined) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "COMPLETED") return "refunded";
  if (normalized === "PENDING") return "pending";
  if (normalized === "FAILED" || normalized === "REJECTED") return "failed";
  return String(status || "pending").toLowerCase();
}

async function findPaymentForSquareOrder(adminClient: any, squareOrderId: string | undefined, squarePaymentId: string | undefined) {
  if (squarePaymentId) {
    const byPaymentId = await adminClient
      .from("payments")
      .select("id, order_id, amount, status, provider_payment_id, billing_contact")
      .eq("provider", "square")
      .eq("provider_payment_id", squarePaymentId)
      .maybeSingle();
    if (byPaymentId.data) return byPaymentId;
  }

  if (squareOrderId) {
    const byProviderId = await adminClient
      .from("payments")
      .select("id, order_id, amount, status, provider_payment_id, billing_contact")
      .eq("provider", "square")
      .eq("provider_payment_id", squareOrderId)
      .maybeSingle();
    if (byProviderId.data) return byProviderId;

    return adminClient
      .from("payments")
      .select("id, order_id, amount, status, provider_payment_id, billing_contact")
      .eq("provider", "square")
      .contains("billing_contact", { square: { square_order_id: squareOrderId } })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  }

  return { data: null, error: null };
}

async function handlePaymentEvent(adminClient: any, payload: SquareWebhookPayload, environment: SquareEnvironment) {
  const squarePayment = payload.data?.object?.payment;
  if (!squarePayment) return { handled: false };

  const status = mapSquarePaymentStatus(squarePayment.status);
  const amount = amountFromCents(squarePayment.total_money?.amount ?? squarePayment.amount_money?.amount);
  const paymentResult = await findPaymentForSquareOrder(adminClient, squarePayment.order_id, squarePayment.id);
  if (paymentResult.error || !paymentResult.data) {
    await adminClient.from("activity_logs").insert({
      action: "square_webhook_unmatched_payment",
      entity_type: "payment",
      entity_id: null,
      details: { environment, event_id: payload.event_id, type: payload.type, square_payment: squarePayment },
    });
    return { handled: false };
  }

  const receivedAt = status === "paid" ? (squarePayment.updated_at || squarePayment.created_at || new Date().toISOString()) : null;
  const currentBillingContact = paymentResult.data.billing_contact && typeof paymentResult.data.billing_contact === "object"
    ? paymentResult.data.billing_contact as Record<string, unknown>
    : {};
  const currentSquare = currentBillingContact.square && typeof currentBillingContact.square === "object"
    ? currentBillingContact.square as Record<string, unknown>
    : {};
  const paymentUpdates: Record<string, unknown> = {
    provider_payment_id: squarePayment.id || paymentResult.data.provider_payment_id,
    status,
    amount: amount || paymentResult.data.amount,
    billing_contact: {
      ...currentBillingContact,
      square: {
        ...currentSquare,
        environment,
        square_payment_id: squarePayment.id || null,
        square_order_id: squarePayment.order_id || currentSquare.square_order_id || null,
        receipt_url: squarePayment.receipt_url || null,
        webhook_event_id: payload.event_id || null,
        webhook_type: payload.type || null,
      },
    },
  };

  if (receivedAt) paymentUpdates.received_at = receivedAt;
  if (status === "paid") {
    paymentUpdates.balance_due = 0;
    paymentUpdates.delivery_status = "paid";
    paymentUpdates.document_status = "generated";
  } else if (status === "failed") {
    paymentUpdates.delivery_status = "failed";
  }

  const updateResult = await adminClient
    .from("payments")
    .update(paymentUpdates)
    .eq("id", paymentResult.data.id)
    .select("id, order_id, amount, status")
    .single();

  if (updateResult.error) throw updateResult.error;

  if (status === "paid") {
    await adminClient
      .from("orders")
      .update({ payment_status: "paid", status: "paid" })
      .eq("id", updateResult.data.order_id);

    // Fire global payment_received automations (non-blocking)
    runCardAutomations(adminClient, "payment_received", {
      order_id: updateResult.data.order_id,
      amount: updateResult.data.amount,
      event_type: "payment_received",
    }).catch(() => { /* non-fatal */ });

    // Send payment confirmed email (non-blocking)
    const orderForEmail = await adminClient
      .from("orders")
      .select("order_number, customer_email, company")
      .eq("id", updateResult.data.order_id)
      .maybeSingle();
    if (orderForEmail.data?.customer_email) {
      sendPaymentConfirmed({
        to: orderForEmail.data.customer_email,
        customerName: orderForEmail.data.company || "",
        orderNumber: orderForEmail.data.order_number || updateResult.data.order_id.slice(0, 8),
        orderId: updateResult.data.order_id,
        amount: updateResult.data.amount,
        receiptUrl: squarePayment.receipt_url || null,
      }).catch(() => { /* email failures are non-fatal */ });
    }
  } else if (status === "failed") {
    await adminClient
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", updateResult.data.order_id);
  }

  await adminClient.from("activity_logs").insert({
    action: "square_payment_webhook_processed",
    entity_type: "payment",
    entity_id: updateResult.data.id,
    details: {
      environment,
      event_id: payload.event_id,
      type: payload.type,
      square_payment_id: squarePayment.id,
      square_order_id: squarePayment.order_id,
      square_status: squarePayment.status,
      mapped_status: status,
      amount,
      receipt_url: squarePayment.receipt_url,
    },
  });

  return { handled: true, payment: updateResult.data };
}

async function handleRefundEvent(adminClient: any, payload: SquareWebhookPayload, environment: SquareEnvironment) {
  const squareRefund = payload.data?.object?.refund;
  if (!squareRefund) return { handled: false };

  const paymentResult = await findPaymentForSquareOrder(adminClient, squareRefund.order_id, squareRefund.payment_id);
  if (paymentResult.error || !paymentResult.data) {
    await adminClient.from("activity_logs").insert({
      action: "square_webhook_unmatched_refund",
      entity_type: "refund",
      entity_id: null,
      details: { environment, event_id: payload.event_id, type: payload.type, square_refund: squareRefund },
    });
    return { handled: false };
  }

  const amount = amountFromCents(squareRefund.amount_money?.amount);
  const refundStatus = mapSquareRefundStatus(squareRefund.status);
  const insertResult = await adminClient
    .from("refunds")
    .insert({
      payment_id: paymentResult.data.id,
      order_id: paymentResult.data.order_id,
      provider_refund_id: squareRefund.id || null,
      amount,
      reason: squareRefund.reason || "Square refund",
      status: refundStatus,
    })
    .select("id")
    .single();

  if (insertResult.error && !/duplicate/i.test(insertResult.error.message)) throw insertResult.error;

  if (refundStatus === "refunded") {
    await adminClient.from("payments").update({ status: "refunded", balance_due: 0 }).eq("id", paymentResult.data.id);
    await adminClient.from("orders").update({ payment_status: "refunded" }).eq("id", paymentResult.data.order_id);
  }

  await adminClient.from("activity_logs").insert({
    action: "square_refund_webhook_processed",
    entity_type: "payment",
    entity_id: paymentResult.data.id,
    details: { environment, event_id: payload.event_id, type: payload.type, square_refund: squareRefund, mapped_status: refundStatus },
  });

  return { handled: true };
}

async function handleOrderEvent(adminClient: any, payload: SquareWebhookPayload, environment: SquareEnvironment) {
  const squareOrder = payload.data?.object?.order;
  if (!squareOrder?.id) return { handled: false };

  const paymentResult = await findPaymentForSquareOrder(adminClient, squareOrder.id, undefined);
  if (paymentResult.error || !paymentResult.data) return { handled: false };

  await adminClient.from("activity_logs").insert({
    action: "square_order_webhook_received",
    entity_type: "payment",
    entity_id: paymentResult.data.id,
    details: { environment, event_id: payload.event_id, type: payload.type, square_order: squareOrder },
  });

  return { handled: true };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ environment: string }> },
) {
  const { environment: rawEnvironment } = await context.params;
  if (rawEnvironment !== "sandbox" && rawEnvironment !== "production") {
    return jsonError("Unsupported Square webhook environment.", 404);
  }
  const environment = rawEnvironment as SquareEnvironment;
  const { notificationUrl, signatureKey } = webhookConfig(environment);
  if (!notificationUrl || !signatureKey) {
    return jsonError(`Square ${environment} webhook signature key is not configured.`, 501);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";
  if (!verifySquareSignature(rawBody, signature, notificationUrl, signatureKey)) {
    return jsonError("Invalid Square webhook signature.", 401);
  }

  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const payload = JSON.parse(rawBody) as SquareWebhookPayload;
  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (payload.type?.startsWith("payment.")) {
    const result = await handlePaymentEvent(adminClient, payload, environment);
    return NextResponse.json({ ok: true, handled: result.handled });
  }

  if (payload.type?.startsWith("refund.")) {
    const result = await handleRefundEvent(adminClient, payload, environment);
    return NextResponse.json({ ok: true, handled: result.handled });
  }

  if (payload.type?.startsWith("order.")) {
    const result = await handleOrderEvent(adminClient, payload, environment);
    return NextResponse.json({ ok: true, handled: result.handled });
  }

  await adminClient.from("activity_logs").insert({
    action: "square_webhook_ignored",
    entity_type: "payment",
    entity_id: null,
    details: { environment, event_id: payload.event_id, type: payload.type },
  });

  return NextResponse.json({ ok: true, handled: false });
}
