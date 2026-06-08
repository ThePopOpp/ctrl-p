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

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    user_id?: string | null;
    product_id?: string;
    quantity?: number | string;
    unit_price?: number | string;
    coupon_code?: string;
    status?: string;
    payment_status?: string;
    production_status?: string;
    company?: string;
    customer_email?: string;
    customer_phone?: string;
    customer_notes?: string;
    internal_notes?: string;
    due_at?: string | null;
    shipping_method?: string;
  } | null;

  if (!body?.product_id) return jsonError("Product is required.");

  const status = body.status || "new";
  const paymentStatus = body.payment_status || "unpaid";
  const productionStatus = body.production_status || "new";
  if (!ORDER_STATUSES.has(status)) return jsonError("Unsupported order status.");
  if (!PAYMENT_STATUSES.has(paymentStatus)) return jsonError("Unsupported payment status.");
  if (!PRODUCTION_STATUSES.has(productionStatus)) return jsonError("Unsupported production status.");

  const productResult = await verified.adminClient
    .from("products")
    .select("id, name, base_cost, base_price, sale_price")
    .eq("id", body.product_id)
    .single();

  if (productResult.error || !productResult.data) {
    return jsonError(productResult.error?.message || "Product not found.", 404);
  }

  const quantity = Math.max(1, Number(body.quantity || 1));
  const unitPrice = Number(body.unit_price || productResult.data.sale_price || productResult.data.base_price || 0);
  const unitCost = Number(productResult.data.base_cost || 0);
  const subtotal = Number((quantity * unitPrice).toFixed(2));

  // Validate coupon if provided
  let couponId: string | null = null;
  let discountAmount = 0;

  if (body.coupon_code) {
    const couponCode = String(body.coupon_code).trim().toUpperCase();
    const couponResult = await verified.adminClient
      .from("coupons")
      .select("id, discount_type, discount_value, min_order_total, max_uses, uses_count, expires_at, active")
      .eq("code", couponCode)
      .eq("active", true)
      .maybeSingle();

    if (!couponResult.data) return jsonError("Coupon code is not valid or inactive.", 422);
    const coupon = couponResult.data;
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return jsonError("This coupon has expired.", 422);
    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) return jsonError("This coupon has reached its usage limit.", 422);
    if (coupon.min_order_total !== null && subtotal < Number(coupon.min_order_total)) {
      return jsonError(`This coupon requires a minimum order total of $${Number(coupon.min_order_total).toFixed(2)}.`, 422);
    }

    discountAmount = coupon.discount_type === "percentage"
      ? Number(((subtotal * Number(coupon.discount_value)) / 100).toFixed(2))
      : Math.min(Number(coupon.discount_value), subtotal);
    couponId = coupon.id;

    // Increment uses_count
    await verified.adminClient.from("coupons").update({ uses_count: coupon.uses_count + 1 }).eq("id", coupon.id);
  }

  const total = Number(Math.max(0, subtotal - discountAmount).toFixed(2));

  const orderResult = await verified.adminClient
    .from("orders")
    .insert({
      user_id: body.user_id || null,
      status,
      payment_status: paymentStatus,
      production_status: productionStatus,
      company: cleanText(body.company) || null,
      customer_email: cleanText(body.customer_email) || null,
      customer_phone: cleanText(body.customer_phone) || null,
      customer_notes: cleanText(body.customer_notes) || null,
      internal_notes: cleanText(body.internal_notes) || null,
      due_at: body.due_at || null,
      shipping_method: cleanText(body.shipping_method) || null,
      pickup_shipping_method: cleanText(body.shipping_method) || null,
      subtotal,
      discount_amount: discountAmount || null,
      coupon_id: couponId,
      total,
    })
    .select("id, order_number, status, payment_status, production_status")
    .single();

  if (orderResult.error) return jsonError(orderResult.error.message, 400);

  const order = orderResult.data as unknown as { id: string; order_number: string; status: string; production_status: string };
  const itemResult = await verified.adminClient
    .from("order_items")
    .insert({
      order_id: order.id,
      product_id: body.product_id,
      quantity,
      unit_cost: unitCost,
      unit_price: unitPrice,
      line_total: subtotal,
      proof_required: true,
    })
    .select("id")
    .single();

  if (itemResult.error) return jsonError(itemResult.error.message, 400);

  const item = itemResult.data as unknown as { id: string };
  await verified.adminClient.from("production_jobs").insert({
    order_id: order.id,
    order_item_id: item.id,
    status: productionStatus,
    priority: 100,
    station: "Prepress",
    due_at: body.due_at || null,
    notes: cleanText(body.internal_notes),
  });

  await verified.adminClient.from("order_status_history").insert({
    order_id: order.id,
    previous_status: null,
    new_status: status,
    previous_production_status: null,
    new_production_status: productionStatus,
    actor_id: verified.actorId,
    note: "Order created from admin orders page",
  });

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "order_created",
    entity_type: "order",
    entity_id: order.id,
    details: { order_number: order.order_number, product_id: body.product_id, quantity, subtotal, discount_amount: discountAmount || undefined, total },
  });

  return NextResponse.json({ order });
}

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
