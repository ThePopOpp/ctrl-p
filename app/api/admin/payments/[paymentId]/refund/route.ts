import { NextResponse } from "next/server";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

type SquareRefundResponse = {
  refund?: {
    id?: string;
    status?: string;
    amount_money?: { amount?: number; currency?: string };
  };
  errors?: Array<{ detail?: string; code?: string }>;
};

function squareConfig() {
  const environment = serverEnv("SQUARE_ENVIRONMENT").toLowerCase() === "production" ? "production" : "sandbox";
  const accessToken = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_ACCESS_TOKEN")
    : serverEnv("SQUARE_SANDBOX_ACCESS_TOKEN");
  const apiVersion = serverEnv("SQUARE_API_VERSION") || "2026-01-22";
  const baseUrl = environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  return { accessToken, apiVersion, baseUrl, environment };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { paymentId } = await params;
  if (!paymentId) return jsonError("Payment ID is required.");

  const body = await request.json().catch(() => null) as {
    amount?: number | string;
    reason?: string;
  } | null;

  const paymentResult = await verified.adminClient
    .from("payments")
    .select("id, order_id, amount, status, provider, provider_payment_id, billing_contact, currency")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentResult.error || !paymentResult.data) return jsonError("Payment not found.", 404);
  const payment = paymentResult.data;

  if (payment.provider !== "square") return jsonError("Refunds are only supported for Square payments.", 400);
  if (!["paid"].includes(payment.status)) return jsonError("Only completed payments can be refunded.", 409);

  const billingContact = (payment.billing_contact && typeof payment.billing_contact === "object")
    ? payment.billing_contact as Record<string, unknown>
    : {};
  const squareMeta = (billingContact.square && typeof billingContact.square === "object")
    ? billingContact.square as Record<string, unknown>
    : {};

  const squarePaymentId = String(squareMeta.square_payment_id || payment.provider_payment_id || "");
  if (!squarePaymentId) return jsonError("No Square payment ID found on this record.", 400);

  const requestedAmount = body?.amount ? Number(body.amount) : Number(payment.amount || 0);
  if (!requestedAmount || requestedAmount <= 0) return jsonError("Refund amount must be greater than zero.");
  if (requestedAmount > Number(payment.amount || 0)) return jsonError("Refund amount cannot exceed the original payment amount.");

  const sq = squareConfig();
  if (!sq.accessToken) return jsonError("Square is not configured.", 501);

  const currency = String(payment.currency || "usd").toUpperCase();
  const amountCents = Math.round(requestedAmount * 100);

  const squareResponse = await fetch(`${sq.baseUrl}/v2/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sq.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": sq.apiVersion,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      payment_id: squarePaymentId,
      amount_money: { amount: amountCents, currency },
      reason: String(body?.reason || "Admin refund").trim().slice(0, 192),
    }),
  });

  const squarePayload = await squareResponse.json().catch(() => ({})) as SquareRefundResponse;
  if (!squareResponse.ok) {
    const msg = squarePayload.errors?.[0]?.detail || "Square could not process the refund.";
    return jsonError(msg, squareResponse.status || 400);
  }

  const squareRefund = squarePayload.refund;
  const refundStatus = squareRefund?.status === "COMPLETED" ? "refunded" : "pending";

  // Record in refunds table
  const refundInsert = await verified.adminClient
    .from("refunds")
    .insert({
      payment_id: paymentId,
      order_id: payment.order_id,
      provider_refund_id: squareRefund?.id || null,
      amount: requestedAmount,
      reason: String(body?.reason || "Admin refund").trim(),
      status: refundStatus,
      created_by: verified.actorId,
    })
    .select("id, status")
    .single();

  if (refundInsert.error) return jsonError(refundInsert.error.message, 400);

  // Update payment and order status
  const isFullRefund = requestedAmount >= Number(payment.amount || 0);
  await verified.adminClient
    .from("payments")
    .update({ status: isFullRefund ? "refunded" : "partially_refunded", balance_due: 0 })
    .eq("id", paymentId);

  await verified.adminClient
    .from("orders")
    .update({ payment_status: isFullRefund ? "refunded" : "partially_refunded" })
    .eq("id", payment.order_id);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "square_refund_initiated",
    entity_type: "payment",
    entity_id: paymentId,
    details: {
      refund_id: refundInsert.data.id,
      square_refund_id: squareRefund?.id,
      amount: requestedAmount,
      reason: body?.reason || "Admin refund",
      square_status: squareRefund?.status,
      environment: sq.environment,
    },
  });

  return NextResponse.json({
    refund: refundInsert.data,
    square_refund_id: squareRefund?.id || null,
    amount: requestedAmount,
    status: refundStatus,
  });
}
