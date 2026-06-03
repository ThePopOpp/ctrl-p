import { NextResponse } from "next/server";

import { cleanText } from "@/lib/booking/availability";
import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const ALLOWED_ROLES = ["super_admin", "admin", "employee", "staff", "customer_support", "production_manager"];
const APPOINTMENT_STATUSES = new Set([
  "pending",
  "confirmed",
  "rescheduled",
  "canceled",
  "completed",
  "no_show",
  "follow_up_needed",
  "awaiting_payment",
  "awaiting_deposit",
  "awaiting_customer_info",
  "awaiting_approval",
]);
const LOCATION_TYPES = new Set(["phone_call", "video_meeting", "in_person", "onsite_installation", "vehicle_dropoff", "pickup", "delivery", "custom_location"]);

function nullableText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function numberValue(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function dateTimeValue(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  let appointmentsQuery = verified.adminClient
    .from("booking_appointments")
    .select("*")
    .order("start_time", { ascending: true })
    .limit(250);

  if (status && APPOINTMENT_STATUSES.has(status)) appointmentsQuery = appointmentsQuery.eq("status", status);

  const [appointments, appointmentTypes, availabilityRules, blockedTimes, calendarConnections, notifications, users, orders, productionJobs] = await Promise.all([
    appointmentsQuery,
    verified.adminClient.from("booking_appointment_types").select("*").order("display_order", { ascending: true }).order("name", { ascending: true }),
    verified.adminClient.from("booking_availability_rules").select("*").order("day_of_week", { ascending: true }).order("start_time", { ascending: true }),
    verified.adminClient.from("booking_blocked_times").select("*").order("start_time", { ascending: false }).limit(100),
    verified.adminClient.from("booking_calendar_connections").select("*").order("created_at", { ascending: false }).limit(50),
    verified.adminClient.from("booking_notifications").select("*").order("created_at", { ascending: false }).limit(100),
    verified.adminClient.from("users").select("id, full_name, email, phone, company, role").is("deleted_at", null).order("full_name", { ascending: true }).limit(200),
    verified.adminClient.from("orders").select("id, order_number, company, customer_email, customer_phone, status").order("created_at", { ascending: false }).limit(100),
    verified.adminClient.from("production_jobs").select("id, order_id, status, station, due_at").order("created_at", { ascending: false }).limit(100),
  ]);

  const error = appointments.error || appointmentTypes.error || availabilityRules.error || blockedTimes.error || calendarConnections.error || notifications.error || users.error || orders.error || productionJobs.error;
  if (error) return jsonError(error.message, 400);

  return NextResponse.json({
    appointments: appointments.data ?? [],
    appointmentTypes: appointmentTypes.data ?? [],
    availabilityRules: availabilityRules.data ?? [],
    blockedTimes: blockedTimes.data ?? [],
    calendarConnections: calendarConnections.data ?? [],
    notifications: notifications.data ?? [],
    users: users.data ?? [],
    orders: orders.data ?? [],
    productionJobs: productionJobs.data ?? [],
  });
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const resource = cleanText(body?.resource);
  if (!resource) return jsonError("Booking resource is required.");

  if (resource === "appointment_type") {
    const name = cleanText(body?.name);
    const slug = cleanText(body?.slug).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!name || !slug) return jsonError("Appointment type name and slug are required.");
    const locationType = cleanText(body?.location_type) || "phone_call";
    if (!LOCATION_TYPES.has(locationType)) return jsonError("Unsupported appointment location type.");

    const result = await verified.adminClient
      .from("booking_appointment_types")
      .insert({
        name,
        slug,
        description: nullableText(body?.description),
        duration_minutes: numberValue(body?.duration_minutes, 30),
        buffer_before_minutes: numberValue(body?.buffer_before_minutes, 0),
        buffer_after_minutes: numberValue(body?.buffer_after_minutes, 0),
        min_notice_minutes: numberValue(body?.min_notice_minutes, 120),
        max_days_in_advance: numberValue(body?.max_days_in_advance, 30),
        location_type: locationType,
        meeting_url: nullableText(body?.meeting_url),
        color: cleanText(body?.color) || "#a3ff12",
        display_order: numberValue(body?.display_order, 100),
        created_by: verified.actorId,
      })
      .select("*")
      .single();

    if (result.error) return jsonError(result.error.message, 400);
    return NextResponse.json({ appointmentType: result.data });
  }

  if (resource === "availability_rule") {
    const day = numberValue(body?.day_of_week, -1);
    if (day < 0 || day > 6) return jsonError("Day of week must be between 0 and 6.");
    const start = cleanText(body?.start_time);
    const end = cleanText(body?.end_time);
    if (!start || !end) return jsonError("Availability start and end times are required.");

    const result = await verified.adminClient
      .from("booking_availability_rules")
      .insert({
        user_id: nullableText(body?.user_id),
        appointment_type_id: nullableText(body?.appointment_type_id),
        day_of_week: day,
        start_time: start,
        end_time: end,
        timezone: cleanText(body?.timezone) || "America/Phoenix",
        is_available: body?.is_available !== false,
        created_by: verified.actorId,
      })
      .select("*")
      .single();

    if (result.error) return jsonError(result.error.message, 400);
    return NextResponse.json({ availabilityRule: result.data });
  }

  if (resource === "blocked_time") {
    const title = cleanText(body?.title) || "Blocked time";
    const start = dateTimeValue(body?.start_time);
    const end = dateTimeValue(body?.end_time);
    if (!start || !end) return jsonError("Blocked time start and end are required.");

    const result = await verified.adminClient
      .from("booking_blocked_times")
      .insert({
        user_id: nullableText(body?.user_id),
        title,
        start_time: start,
        end_time: end,
        timezone: cleanText(body?.timezone) || "America/Phoenix",
        reason: nullableText(body?.reason),
        blocks_public_booking: body?.blocks_public_booking !== false,
        created_by: verified.actorId,
      })
      .select("*")
      .single();

    if (result.error) return jsonError(result.error.message, 400);
    return NextResponse.json({ blockedTime: result.data });
  }

  return jsonError("Unsupported booking resource.");
}

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const resource = cleanText(body?.resource || "appointment");
  const id = cleanText(body?.id);
  if (!id) return jsonError("Record id is required.");

  if (resource === "appointment") {
    const status = cleanText(body?.status);
    if (status && !APPOINTMENT_STATUSES.has(status)) return jsonError("Unsupported appointment status.");
    const updates: Record<string, unknown> = {
      internal_notes: nullableText(body?.internal_notes),
      assigned_staff_id: nullableText(body?.assigned_staff_id),
      related_order_id: nullableText(body?.related_order_id),
      related_job_id: nullableText(body?.related_job_id),
    };
    if (status) updates.status = status;
    if (status === "completed") updates.completed_at = new Date().toISOString();
    if (status === "canceled") {
      updates.canceled_at = new Date().toISOString();
      updates.cancellation_reason = nullableText(body?.cancellation_reason);
    }

    const result = await verified.adminClient
      .from("booking_appointments")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (result.error) return jsonError(result.error.message, 400);

    await verified.adminClient.from("activity_logs").insert({
      actor_id: verified.actorId,
      action: "booking_appointment_updated",
      entity_type: "booking_appointment",
      entity_id: id,
      details: { status: updates.status || null },
    });

    return NextResponse.json({ appointment: result.data });
  }

  if (resource === "appointment_type") {
    const locationType = cleanText(body?.location_type) || "phone_call";
    if (!LOCATION_TYPES.has(locationType)) return jsonError("Unsupported appointment location type.");
    const result = await verified.adminClient
      .from("booking_appointment_types")
      .update({
        name: cleanText(body?.name),
        description: nullableText(body?.description),
        duration_minutes: numberValue(body?.duration_minutes, 30),
        buffer_before_minutes: numberValue(body?.buffer_before_minutes, 0),
        buffer_after_minutes: numberValue(body?.buffer_after_minutes, 0),
        min_notice_minutes: numberValue(body?.min_notice_minutes, 120),
        max_days_in_advance: numberValue(body?.max_days_in_advance, 30),
        location_type: locationType,
        meeting_url: nullableText(body?.meeting_url),
        color: cleanText(body?.color) || "#a3ff12",
        is_active: body?.is_active !== false,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (result.error) return jsonError(result.error.message, 400);
    return NextResponse.json({ appointmentType: result.data });
  }

  return jsonError("Unsupported booking resource.");
}

export async function DELETE(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const resource = cleanText(url.searchParams.get("resource"));
  const id = cleanText(url.searchParams.get("id"));
  if (!resource || !id) return jsonError("Resource and id are required.");

  const table = resource === "blocked_time"
    ? "booking_blocked_times"
    : resource === "availability_rule"
      ? "booking_availability_rules"
      : resource === "appointment_type"
        ? "booking_appointment_types"
        : "";
  if (!table) return jsonError("Unsupported delete resource.");

  const result = await verified.adminClient.from(table).delete().eq("id", id).select("id").single();
  if (result.error) return jsonError(result.error.message, 400);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: `booking_${resource}_deleted`,
    entity_type: resource,
    entity_id: id,
    details: {},
  });

  return NextResponse.json({ deleted: result.data });
}
