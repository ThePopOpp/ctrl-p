import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const PRODUCTION_STATUSES = new Set([
  "new",
  "file_check",
  "design_needed",
  "proof_pending",
  "proof_approved",
  "print_ready",
  "printing",
  "finishing",
  "install_scheduled",
  "ready",
  "completed",
  "on_hold",
]);

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function validateStatus(value: unknown) {
  const status = cleanText(value) || "new";
  if (!PRODUCTION_STATUSES.has(status)) return null;
  return status;
}

function jobSelect() {
  return "id, order_id, order_item_id, status, priority, assigned_staff_id, station, due_at, started_at, completed_at, notes, created_at, updated_at, orders!production_jobs_order_id_fkey(order_number), order_items!production_jobs_order_item_id_fkey(quantity, products!order_items_product_id_fkey(id, name, category))";
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request, ["super_admin", "admin", "employee", "staff", "production_manager"]);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    order_id?: string;
    order_item_id?: string | null;
    status?: string;
    priority?: number | string;
    assigned_staff_id?: string | null;
    station?: string;
    due_at?: string | null;
    notes?: string;
  } | null;

  if (!body?.order_id) return jsonError("Order is required.");
  const status = validateStatus(body.status);
  if (!status) return jsonError("Unsupported production status.");

  const orderResult = await verified.adminClient
    .from("orders")
    .select("id, status, production_status")
    .eq("id", body.order_id)
    .single();

  if (orderResult.error || !orderResult.data) {
    return jsonError(orderResult.error?.message || "Order not found.", 404);
  }

  if (body.order_item_id) {
    const itemResult = await verified.adminClient
      .from("order_items")
      .select("id, order_id")
      .eq("id", body.order_item_id)
      .eq("order_id", body.order_id)
      .single();

    if (itemResult.error || !itemResult.data) {
      return jsonError(itemResult.error?.message || "Order item not found for this order.", 404);
    }
  }

  const jobResult = await verified.adminClient
    .from("production_jobs")
    .insert({
      order_id: body.order_id,
      order_item_id: body.order_item_id || null,
      status,
      priority: Number(body.priority || 100),
      assigned_staff_id: body.assigned_staff_id || null,
      station: cleanText(body.station) || "Prepress",
      due_at: body.due_at || null,
      notes: cleanText(body.notes),
    })
    .select(jobSelect())
    .single();

  if (jobResult.error) return jsonError(jobResult.error.message, 400);

  await verified.adminClient
    .from("orders")
    .update({ production_status: status })
    .eq("id", body.order_id);

  await verified.adminClient.from("order_status_history").insert({
    order_id: body.order_id,
    previous_status: orderResult.data.status,
    new_status: orderResult.data.status,
    previous_production_status: orderResult.data.production_status,
    new_production_status: status,
    actor_id: verified.actorId,
    note: "Production job created from admin production page",
  });

  const job = jobResult.data as unknown as { id: string };

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_job_created",
    entity_type: "production_job",
    entity_id: job.id,
    details: {
      order_id: body.order_id,
      order_item_id: body.order_item_id || null,
      status,
      priority: Number(body.priority || 100),
      station: cleanText(body.station) || "Prepress",
    },
  });

  return NextResponse.json({ job: jobResult.data });
}

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request, ["super_admin", "admin", "employee", "staff", "production_manager"]);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    job_id?: string;
    order_id?: string;
    status?: string;
    priority?: number | string;
    assigned_staff_id?: string | null;
    station?: string;
    due_at?: string | null;
    notes?: string;
  } | null;

  if (!body?.job_id) return jsonError("Production job is required.");
  const status = validateStatus(body.status);
  if (!status) return jsonError("Unsupported production status.");

  const currentResult = await verified.adminClient
    .from("production_jobs")
    .select("id, order_id, status")
    .eq("id", body.job_id)
    .single();

  if (currentResult.error || !currentResult.data) {
    return jsonError(currentResult.error?.message || "Production job not found.", 404);
  }

  const orderId = body.order_id || currentResult.data.order_id;
  const orderResult = await verified.adminClient
    .from("orders")
    .select("id, status, production_status")
    .eq("id", orderId)
    .single();

  if (orderResult.error || !orderResult.data) {
    return jsonError(orderResult.error?.message || "Order not found.", 404);
  }

  const jobResult = await verified.adminClient
    .from("production_jobs")
    .update({
      status,
      priority: Number(body.priority || 100),
      assigned_staff_id: body.assigned_staff_id || null,
      station: cleanText(body.station) || null,
      due_at: body.due_at || null,
      notes: cleanText(body.notes),
      started_at: ["printing", "finishing", "install_scheduled"].includes(status) ? new Date().toISOString() : undefined,
      completed_at: ["ready", "completed"].includes(status) ? new Date().toISOString() : undefined,
    })
    .eq("id", body.job_id)
    .select(jobSelect())
    .single();

  if (jobResult.error) return jsonError(jobResult.error.message, 400);

  await verified.adminClient
    .from("orders")
    .update({ production_status: status })
    .eq("id", orderId);

  await verified.adminClient.from("order_status_history").insert({
    order_id: orderId,
    previous_status: orderResult.data.status,
    new_status: orderResult.data.status,
    previous_production_status: orderResult.data.production_status,
    new_production_status: status,
    actor_id: verified.actorId,
    note: "Production job updated from admin production page",
  });

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_job_updated",
    entity_type: "production_job",
    entity_id: body.job_id,
    details: { order_id: orderId, status, priority: Number(body.priority || 100), station: cleanText(body.station) },
  });

  return NextResponse.json({ job: jobResult.data });
}
