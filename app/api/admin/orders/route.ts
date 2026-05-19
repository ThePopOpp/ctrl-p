import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const ORDER_STATUSES = new Set([
  "new", "proof_pending", "proof_approved", "in_production", "shipped", "delivered", "cancelled", "refunded",
  "draft", "quote_requested", "awaiting_payment", "paid", "file_review", "proofing", "approved", "ready_for_pickup",
  "ready_to_ship", "completed",
]);

const PAYMENT_STATUSES = new Set(["unpaid", "pending", "paid", "partially_paid", "failed", "refunded", "partially_refunded"]);
const PRODUCTION_STATUSES = new Set([
  "new", "file_check", "design_needed", "proof_pending", "proof_approved", "print_ready", "printing", "finishing",
  "install_scheduled", "ready", "completed", "on_hold",
]);

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    order_id?: string;
    status?: string;
    payment_status?: string;
    production_status?: string;
    internal_notes?: string;
    due_at?: string | null;
  } | null;

  if (!body?.order_id) return jsonError("Order is required.");

  const currentResult = await verified.adminClient
    .from("orders")
    .select("id, status, production_status, payment_status")
    .eq("id", body.order_id)
    .single();

  if (currentResult.error || !currentResult.data) {
    return jsonError(currentResult.error?.message || "Order not found.", 404);
  }

  const updates: Record<string, unknown> = {};
  if (body.status) {
    if (!ORDER_STATUSES.has(body.status)) return jsonError("Unsupported order status.");
    updates.status = body.status;
  }
  if (body.payment_status) {
    if (!PAYMENT_STATUSES.has(body.payment_status)) return jsonError("Unsupported payment status.");
    updates.payment_status = body.payment_status;
  }
  if (body.production_status) {
    if (!PRODUCTION_STATUSES.has(body.production_status)) return jsonError("Unsupported production status.");
    updates.production_status = body.production_status;
  }
  if (typeof body.internal_notes === "string") updates.internal_notes = body.internal_notes;
  if (body.due_at !== undefined) updates.due_at = body.due_at || null;

  if (!Object.keys(updates).length) return jsonError("No order updates were provided.");

  const updateResult = await verified.adminClient
    .from("orders")
    .update(updates)
    .eq("id", body.order_id)
    .select("id, order_number, status, payment_status, production_status, internal_notes, due_at")
    .single();

  if (updateResult.error) return jsonError(updateResult.error.message, 400);

  await verified.adminClient.from("order_status_history").insert({
    order_id: body.order_id,
    previous_status: currentResult.data.status,
    new_status: updates.status || currentResult.data.status,
    previous_production_status: currentResult.data.production_status,
    new_production_status: updates.production_status || currentResult.data.production_status,
    actor_id: verified.actorId,
    note: "Updated from admin orders page",
  });

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "order_updated",
    entity_type: "order",
    entity_id: body.order_id,
    details: updates,
  });

  return NextResponse.json({ order: updateResult.data });
}
