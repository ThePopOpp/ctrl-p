import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const ALLOWED_ROLES = ["super_admin", "admin", "employee", "staff", "production_manager", "designer", "installer", "customer_support"];
const RELATION_TYPES = new Set(["participant", "vendor", "attachment", "material", "event"]);
type VerifiedAdminClient = NonNullable<Awaited<ReturnType<typeof verifyAdminRequest>>["adminClient"]>;

type ScheduleItemContext = {
  id: string | null;
  schedule_group_id?: string | null;
  project_name?: string | null;
  order_id?: string | null;
  order_item_id?: string | null;
  product_id?: string | null;
  customer_id?: string | null;
  title?: string | null;
};

type RelationBody = {
  relation_type?: string;
  schedule_item_id?: string;
  schedule_group_id?: string | null;
  project_name?: string | null;
  order_id?: string | null;
  order_item_id?: string | null;
  customer_id?: string | null;
  participant_type?: string;
  user_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  role_type?: string | null;
  permission_level?: string | null;
  notification_preference?: string | null;
  vendor_name?: string | null;
  contact_name?: string | null;
  service_scope?: string | null;
  status?: string | null;
  estimated_cost?: number | string | null;
  quoted_cost?: number | string | null;
  actual_cost?: number | string | null;
  file_type?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  storage_path?: string | null;
  bucket?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | string | null;
  artwork_file_id?: string | null;
  proof_id?: string | null;
  title?: string | null;
  description?: string | null;
  approval_status?: string | null;
  material_relation_type?: string | null;
  product_id?: string | null;
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_cost?: number | string | null;
  unit_price?: number | string | null;
  estimated_total?: number | string | null;
  production_status?: string | null;
  event_type?: string | null;
  event_title?: string | null;
  event_description?: string | null;
  previous_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  visibility?: string | null;
  notes?: string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function nullableText(value: unknown) {
  return cleanText(value) || null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function visibility(value: unknown) {
  const next = cleanText(value) || "internal";
  if (next === "customer") return "customer_visible";
  if (next === "vendor") return "vendor_visible";
  if (next === "public") return "public_link";
  return ["internal", "customer_visible", "vendor_visible", "public_link", "approval_required", "archived"].includes(next) ? next : "internal";
}

function eventVisibility(value: unknown) {
  const next = visibility(value);
  if (next === "public_link") return "public";
  if (next === "approval_required" || next === "archived") return "internal";
  return next;
}

function participantType(value: unknown) {
  const next = cleanText(value) || "staff";
  if (next === "contact") return "customer_contact";
  if (next === "approver") return "role";
  return ["staff", "customer", "customer_contact", "vendor", "subcontractor", "role", "viewer", "ai_agent"].includes(next) ? next : "staff";
}

function permissionLevel(value: unknown) {
  const next = cleanText(value) || "task_context";
  if (next === "customer") return "customer_visible";
  if (next === "vendor") return "vendor_visible";
  return ["owner", "editor", "contributor", "viewer", "task_context", "customer_visible", "vendor_visible"].includes(next) ? next : "task_context";
}

function notificationPreference(value: unknown) {
  const next = cleanText(value) || "default";
  if (next === "both") return "email_sms";
  return ["default", "none", "dashboard", "email", "sms", "email_sms"].includes(next) ? next : "default";
}

function fileType(value: unknown) {
  const next = cleanText(value) || "file";
  if (next === "document") return "file";
  if (next === "other") return "file";
  return ["photo", "video", "artwork", "proof", "file", "pdf", "design_file", "install_photo", "completion_photo", "customer_upload", "vendor_upload"].includes(next) ? next : "file";
}

function attachmentApprovalStatus(value: unknown) {
  const next = cleanText(value) || "not_required";
  if (next === "pending_review") return "ready_for_review";
  if (next === "sent" || next === "proof_sent") return "sent_to_customer";
  if (next === "needs_changes") return "changes_requested";
  if (next === "waiting_for_file_review") return "ready_for_review";
  return ["not_required", "draft", "ready_for_review", "sent_to_customer", "approved", "rejected", "changes_requested"].includes(next) ? next : "not_required";
}

function basePayload(item: ScheduleItemContext, actorId: string, body: RelationBody) {
  return {
    schedule_item_id: item.id || null,
    schedule_group_id: item.schedule_group_id || body.schedule_group_id || null,
    project_name: item.project_name || body.project_name || null,
    notes: nullableText(body.notes),
    created_by: actorId,
  };
}

async function getScheduleItem(adminClient: VerifiedAdminClient, id: string) {
  const result = await adminClient
    .from("production_schedule_items")
    .select("id, schedule_group_id, project_name, order_id, order_item_id, product_id, customer_id, title")
    .eq("id", id)
    .single();

  if (result.error || !result.data) return { error: result.error?.message || "Schedule item not found." };
  return { item: result.data as ScheduleItemContext };
}

async function logRelation(adminClient: VerifiedAdminClient, actorId: string, relationType: string, relation: { id?: string }, details: Record<string, unknown>) {
  await adminClient.from("activity_logs").insert({
    actor_id: actorId,
    action: `production_schedule_${relationType}_created`,
    entity_type: `production_schedule_${relationType}`,
    entity_id: relation.id || null,
    details,
  });
}

function relationSelect(table: string) {
  if (table === "production_schedule_participants") return "*, user:users(id, full_name, email, role)";
  if (table === "production_schedule_materials") return "*, product:products(id, name, category, sku)";
  return "*";
}

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;
  const adminClient = verified.adminClient;

  const url = new URL(request.url);
  const itemId = url.searchParams.get("item_id");
  const groupId = url.searchParams.get("schedule_group_id");

  function applyScope(table: string) {
    let query = adminClient.from(table).select(relationSelect(table)).order("created_at", { ascending: false }).limit(500);
    if (itemId) query = query.eq("schedule_item_id", itemId);
    if (groupId) query = query.eq("schedule_group_id", groupId);
    return query;
  }

  const [participants, vendors, attachments, materials, events] = await Promise.all([
    applyScope("production_schedule_participants"),
    applyScope("production_schedule_vendors"),
    applyScope("production_schedule_attachments"),
    applyScope("production_schedule_materials"),
    applyScope("production_schedule_activity_events"),
  ]);

  const firstError = [participants, vendors, attachments, materials, events].find((result) => result.error)?.error;
  if (firstError) return jsonError(firstError.message, 400);

  return NextResponse.json({
    participants: participants.data ?? [],
    vendors: vendors.data ?? [],
    attachments: attachments.data ?? [],
    materials: materials.data ?? [],
    events: events.data ?? [],
  });
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;
  const adminClient = verified.adminClient;

  const body = await request.json().catch(() => null) as RelationBody | null;
  if (!body?.schedule_item_id && !body?.schedule_group_id) return jsonError("schedule_item_id or schedule_group_id is required.");
  const relationType = cleanText(body.relation_type);
  if (!RELATION_TYPES.has(relationType)) return jsonError("Unsupported production schedule relation type.");

  const scheduleItem = body.schedule_item_id ? await getScheduleItem(adminClient, body.schedule_item_id) : null;
  if (scheduleItem?.error || (body.schedule_item_id && !scheduleItem?.item)) return jsonError(scheduleItem?.error || "Schedule item not found.", 404);
  const item: ScheduleItemContext = scheduleItem?.item || {
    id: null,
    schedule_group_id: body.schedule_group_id || null,
    project_name: body.project_name || null,
    order_id: body.order_id || null,
    order_item_id: body.order_item_id || null,
    product_id: body.product_id || null,
    customer_id: body.customer_id || null,
    title: body.title || body.project_name || "Project relation",
  };

  if (relationType === "participant") {
    const payload = {
      ...basePayload(item, verified.actorId, body),
      participant_type: participantType(body.participant_type),
      user_id: body.user_id || null,
      display_name: nullableText(body.display_name),
      email: nullableText(body.email),
      phone: nullableText(body.phone),
      company: nullableText(body.company),
      role_type: nullableText(body.role_type),
      permission_level: permissionLevel(body.permission_level),
      notification_preference: notificationPreference(body.notification_preference),
    };
    const result = await adminClient.from("production_schedule_participants").insert(payload).select(relationSelect("production_schedule_participants")).single();
    if (result.error) return jsonError(result.error.message, 400);
    await logRelation(adminClient, verified.actorId, relationType, result.data as { id?: string }, { schedule_item_id: item.id, participant_type: payload.participant_type, user_id: payload.user_id });
    return NextResponse.json({ relation: result.data });
  }

  if (relationType === "vendor") {
    const vendorName = cleanText(body.vendor_name || body.display_name || body.name);
    if (!vendorName) return jsonError("Vendor name is required.");
    const payload = {
      ...basePayload(item, verified.actorId, body),
      vendor_name: vendorName,
      contact_name: nullableText(body.contact_name),
      email: nullableText(body.email),
      phone: nullableText(body.phone),
      role_type: nullableText(body.role_type),
      status: cleanText(body.status) || "planned",
    };
    const result = await adminClient.from("production_schedule_vendors").insert(payload).select("*").single();
    if (result.error) return jsonError(result.error.message, 400);
    await logRelation(adminClient, verified.actorId, relationType, result.data as { id?: string }, { schedule_item_id: item.id, vendor_name: payload.vendor_name });
    return NextResponse.json({ relation: result.data });
  }

  if (relationType === "attachment") {
    const payload = {
      ...basePayload(item, verified.actorId, body),
      order_id: body.title === "__none__" ? null : item.order_id || null,
      order_item_id: item.order_item_id || null,
      artwork_file_id: body.artwork_file_id || null,
      proof_id: body.proof_id || null,
      file_type: fileType(body.file_type),
      file_name: nullableText(body.file_name),
      file_url: nullableText(body.file_url),
      storage_path: nullableText(body.storage_path),
      bucket: nullableText(body.bucket),
      mime_type: nullableText(body.mime_type),
      file_size_bytes: nullableNumber(body.file_size_bytes),
      visibility: visibility(body.visibility),
      approval_status: attachmentApprovalStatus(body.approval_status),
    };
    const result = await adminClient.from("production_schedule_attachments").insert(payload).select("*").single();
    if (result.error) return jsonError(result.error.message, 400);
    await logRelation(adminClient, verified.actorId, relationType, result.data as { id?: string }, { schedule_item_id: item.id, file_type: payload.file_type, file_name: payload.file_name });
    return NextResponse.json({ relation: result.data });
  }

  if (relationType === "material") {
    const name = cleanText(body.name || body.title);
    if (!name) return jsonError("Material or product name is required.");
    const payload = {
      ...basePayload(item, verified.actorId, body),
      order_id: item.order_id || null,
      order_item_id: item.order_item_id || null,
      product_id: body.product_id || item.product_id || null,
      name,
      sku: nullableText(body.sku),
      category: nullableText(body.category),
      vendor_name: nullableText(body.vendor_name),
      quantity: nullableNumber(body.quantity) || 1,
      unit_cost: nullableNumber(body.unit_cost),
      unit_price: nullableNumber(body.unit_price),
      material_type: nullableText(body.material_relation_type),
    };
    const result = await adminClient.from("production_schedule_materials").insert(payload).select(relationSelect("production_schedule_materials")).single();
    if (result.error) return jsonError(result.error.message, 400);
    await logRelation(adminClient, verified.actorId, relationType, result.data as { id?: string }, { schedule_item_id: item.id, product_id: payload.product_id, name: payload.name });
    return NextResponse.json({ relation: result.data });
  }

  const payload = {
    schedule_item_id: item.id,
    schedule_group_id: item.schedule_group_id || null,
    project_name: item.project_name || null,
    order_id: item.order_id || null,
    actor_id: verified.actorId,
    actor_type: "user",
    event_type: cleanText(body.event_type) || "note.added",
    event_title: cleanText(body.event_title || body.title) || "Schedule activity",
    event_description: nullableText(body.event_description || body.description || body.notes),
    previous_value: body.previous_value || {},
    new_value: body.new_value || {},
    metadata: body.metadata || {},
    visibility: eventVisibility(body.visibility),
  };
  const result = await adminClient.from("production_schedule_activity_events").insert(payload).select("*").single();
  if (result.error) return jsonError(result.error.message, 400);
  await logRelation(adminClient, verified.actorId, relationType, result.data as { id?: string }, { schedule_item_id: item.id, event_type: payload.event_type });
  return NextResponse.json({ relation: result.data });
}
