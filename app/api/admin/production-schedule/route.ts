import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const ALLOWED_ROLES = ["super_admin", "admin", "employee", "staff", "production_manager", "designer", "installer", "customer_support"];

const ITEM_TYPES = new Set([
  "phase",
  "task",
  "milestone",
  "approval",
  "artwork_review",
  "proof",
  "production_step",
  "qc_check",
  "delivery",
  "installation",
  "customer_action",
]);

const STATUSES = new Set([
  "not_started",
  "in_progress",
  "waiting_on_customer",
  "waiting_on_artwork",
  "waiting_on_proof_approval",
  "waiting_on_materials",
  "waiting_on_vendor",
  "needs_internal_review",
  "needs_customer_review",
  "ready_for_production",
  "in_production",
  "quality_check",
  "completed",
  "approved",
  "reopened",
  "blocked",
  "on_hold",
]);

const PRIORITIES = new Set(["low", "normal", "high", "rush", "critical", "blocking_production", "blocking_delivery_install"]);

type ScheduleBody = {
  id?: string;
  order_id?: string | null;
  order_item_id?: string | null;
  production_job_id?: string | null;
  product_id?: string | null;
  customer_id?: string | null;
  parent_item_id?: string | null;
  title?: string;
  description?: string | null;
  item_type?: string;
  phase?: string | null;
  status?: string;
  priority?: string;
  assigned_to_user_id?: string | null;
  assigned_department?: string | null;
  start_date?: string | null;
  start_offset_minutes?: number | string | null;
  end_date?: string | null;
  due_date?: string | null;
  estimated_duration_days?: number | string | null;
  progress_percent?: number | string | null;
  customer_visible?: boolean;
  internal_only?: boolean;
  is_blocked?: boolean;
  blocker_type?: string | null;
  blocker_reason?: string | null;
  artwork_review_status?: string | null;
  proof_status?: string | null;
  production_status?: string | null;
  sort_order?: number | string | null;
  internal_notes?: string | null;
  customer_notes?: string | null;
  schedule_group_id?: string | null;
  project_name?: string | null;
  workflow_template_slug?: string | null;
  workflow_template_name?: string | null;
  hidden_from_schedule?: boolean;
};

function scheduleSelect() {
  return [
    "id",
    "order_id",
    "order_item_id",
    "production_job_id",
    "product_id",
    "customer_id",
    "schedule_group_id",
    "project_name",
    "workflow_template_slug",
    "workflow_template_name",
    "hidden_from_schedule",
    "parent_item_id",
    "title",
    "description",
    "item_type",
    "phase",
    "status",
    "priority",
    "assigned_to_user_id",
    "assigned_department",
    "start_date",
    "start_offset_minutes",
    "end_date",
    "due_date",
    "estimated_duration_days",
    "progress_percent",
    "customer_visible",
    "internal_only",
    "is_blocked",
    "blocker_type",
    "blocker_reason",
    "artwork_review_status",
    "proof_status",
    "production_status",
    "sort_order",
    "internal_notes",
    "customer_notes",
    "created_by",
    "created_at",
    "updated_at",
    "orders!production_schedule_items_order_id_fkey(id, order_number, company, customer_email, customer_phone, status, production_status, payment_status, due_at)",
    "order_items!production_schedule_items_order_item_id_fkey(id, quantity, products!order_items_product_id_fkey(id, name, category))",
    "products!production_schedule_items_product_id_fkey(id, name, category, product_type)",
    "users!production_schedule_items_customer_id_fkey(id, full_name, email, phone, company)",
    "assignee:users!production_schedule_items_assigned_to_user_id_fkey(id, full_name, email, role)",
    "production_jobs!production_schedule_items_production_job_id_fkey(id, status, station, due_at)",
  ].join(", ");
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function nullableText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function nullableDate(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function boundedProgress(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function validateChoice(value: unknown, allowed: Set<string>, fallback: string) {
  const text = cleanText(value) || fallback;
  return allowed.has(text) ? text : null;
}

function buildPayload(body: ScheduleBody, actorId: string, mode: "create" | "update") {
  const title = cleanText(body.title);
  if (mode === "create" && !title) return { error: "Schedule item title is required." };

  const itemType = validateChoice(body.item_type, ITEM_TYPES, "task");
  if (!itemType) return { error: "Unsupported schedule item type." };

  const status = validateChoice(body.status, STATUSES, "not_started");
  if (!status) return { error: "Unsupported schedule status." };

  const priority = validateChoice(body.priority, PRIORITIES, "normal");
  if (!priority) return { error: "Unsupported schedule priority." };

  const isBlocked = Boolean(body.is_blocked || status === "blocked");
  const progress = boundedProgress(body.progress_percent);

  const payload: Record<string, unknown> = {
    order_id: nullableText(body.order_id),
    order_item_id: nullableText(body.order_item_id),
    production_job_id: nullableText(body.production_job_id),
    product_id: nullableText(body.product_id),
    customer_id: nullableText(body.customer_id),
    schedule_group_id: nullableText(body.schedule_group_id),
    project_name: nullableText(body.project_name),
    workflow_template_slug: nullableText(body.workflow_template_slug),
    workflow_template_name: nullableText(body.workflow_template_name),
    hidden_from_schedule: Boolean(body.hidden_from_schedule),
    parent_item_id: nullableText(body.parent_item_id),
    description: nullableText(body.description),
    item_type: itemType,
    phase: nullableText(body.phase),
    status,
    priority,
    assigned_to_user_id: nullableText(body.assigned_to_user_id),
    assigned_department: nullableText(body.assigned_department),
    start_date: nullableDate(body.start_date),
    start_offset_minutes: Math.min(1439, Math.max(0, Math.round(Number(body.start_offset_minutes || 0)))),
    end_date: nullableDate(body.end_date),
    due_date: nullableDate(body.due_date),
    estimated_duration_days: nullableNumber(body.estimated_duration_days),
    progress_percent: progress,
    customer_visible: Boolean(body.customer_visible),
    internal_only: !body.customer_visible && body.internal_only !== false,
    is_blocked: isBlocked,
    blocker_type: nullableText(body.blocker_type),
    blocker_reason: nullableText(body.blocker_reason),
    artwork_review_status: nullableText(body.artwork_review_status),
    proof_status: nullableText(body.proof_status),
    production_status: nullableText(body.production_status),
    sort_order: Number(body.sort_order || 100),
    internal_notes: nullableText(body.internal_notes),
    customer_notes: nullableText(body.customer_notes),
  };

  if (title) payload.title = title;
  if (mode === "create") payload.created_by = actorId;

  return { payload };
}

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const orderId = url.searchParams.get("order_id");

  let query = verified.adminClient
    .from("production_schedule_items")
    .select(scheduleSelect())
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("start_offset_minutes", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(300);

  if (status && STATUSES.has(status)) query = query.eq("status", status);
  if (priority && PRIORITIES.has(priority)) query = query.eq("priority", priority);
  if (orderId) query = query.eq("order_id", orderId);

  const result = await query;
  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ items: result.data ?? [] });
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as ScheduleBody | null;
  if (!body) return jsonError("Schedule item payload is required.");

  const built = buildPayload(body, verified.actorId, "create");
  if (built.error) return jsonError(built.error);
  if (!built.payload) return jsonError("Schedule item payload could not be built.");

  const result = await verified.adminClient
    .from("production_schedule_items")
    .insert(built.payload)
    .select(scheduleSelect())
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  const item = result.data as unknown as { id: string; order_id?: string | null; status?: string | null; priority?: string | null };
  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_schedule_item_created",
    entity_type: "production_schedule_item",
    entity_id: item.id,
    details: { order_id: item.order_id || null, status: item.status, priority: item.priority },
  });

  return NextResponse.json({ item: result.data });
}

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as ScheduleBody | null;
  if (!body?.id) return jsonError("Schedule item id is required.");

  const built = buildPayload(body, verified.actorId, "update");
  if (built.error) return jsonError(built.error);
  if (!built.payload) return jsonError("Schedule item payload could not be built.");

  const result = await verified.adminClient
    .from("production_schedule_items")
    .update(built.payload)
    .eq("id", body.id)
    .select(scheduleSelect())
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_schedule_item_updated",
    entity_type: "production_schedule_item",
    entity_id: body.id,
    details: { status: built.payload?.status, priority: built.payload?.priority },
  });

  return NextResponse.json({ item: result.data });
}

export async function DELETE(request: Request) {
  const verified = await verifyAdminRequest(request, ["super_admin", "admin", "employee", "staff", "production_manager"]);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return jsonError("Schedule item id is required.");

  const result = await verified.adminClient
    .from("production_schedule_items")
    .delete()
    .eq("id", body.id)
    .select("id, order_id, title")
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_schedule_item_deleted",
    entity_type: "production_schedule_item",
    entity_id: body.id,
    details: result.data,
  });

  return NextResponse.json({ deleted: result.data });
}
