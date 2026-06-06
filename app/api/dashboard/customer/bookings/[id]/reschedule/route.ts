import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  buildAvailabilitySlots,
  parseDateKey,
  type AppointmentTypeRecord,
} from "@/lib/booking/availability";
import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";
import { getActiveCalendarIntegration, getFreshToken } from "@/lib/calendar/integration";
import { createGoogleCalendarEvent, updateGoogleCalendarEvent } from "@/lib/calendar/google";

const ACTIVE_BUSY_STATUSES = [
  "pending",
  "confirmed",
  "rescheduled",
  "follow_up_needed",
  "awaiting_payment",
  "awaiting_deposit",
  "awaiting_customer_info",
  "awaiting_approval",
];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const { id } = await params;
  if (!id) return jsonError("Appointment ID is required.", 400);

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return jsonError("Missing session token.", 401);

  const body = await request.json().catch(() => null) as {
    new_start_time?: string;
    reason?: string;
  } | null;

  const newStart = body?.new_start_time;
  if (!newStart) return jsonError("new_start_time is required.", 400);

  const newStartDate = new Date(newStart);
  if (Number.isNaN(newStartDate.getTime())) return jsonError("new_start_time is invalid.", 400);
  if (newStartDate <= new Date()) return jsonError("New appointment time must be in the future.", 400);

  const userClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return jsonError("Invalid session.", 401);

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const profileResult = await adminClient
    .from("users")
    .select("id, email, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return jsonError("Customer profile not found.", 404);
  const profile = profileResult.data;
  if (profile.deleted_at || !["active", "pending"].includes(String(profile.status || ""))) {
    return jsonError("Your account is not active.", 403);
  }

  const email = String(profile.email || "").toLowerCase().trim();

  const apptResult = await adminClient
    .from("booking_appointments")
    .select("id, status, start_time, end_time, customer_email, appointment_type_id, external_event_id, external_calendar_id, external_calendar_provider")
    .eq("id", id)
    .maybeSingle();

  if (apptResult.error || !apptResult.data) return jsonError("Appointment not found.", 404);
  const appt = apptResult.data;

  if (String(appt.customer_email || "").toLowerCase().trim() !== email) {
    return jsonError("You do not have permission to reschedule this appointment.", 403);
  }

  const nonReschedulable = ["canceled", "completed", "no_show"];
  if (nonReschedulable.includes(String(appt.status || ""))) {
    return jsonError("This appointment cannot be rescheduled.", 409);
  }

  if (new Date(appt.start_time) < new Date()) {
    return jsonError("Past appointments cannot be rescheduled.", 409);
  }

  // Validate the new slot is available
  const dateKey = parseDateKey(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Phoenix",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(newStartDate)
  );
  if (!dateKey) return jsonError("Could not determine the date for the new time.", 400);

  const typeResult = await adminClient
    .from("booking_appointment_types")
    .select("id, name, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_in_advance, location_type, meeting_url, color")
    .eq("id", appt.appointment_type_id)
    .eq("is_active", true)
    .maybeSingle();

  if (typeResult.error || !typeResult.data) return jsonError("Appointment type not found.", 404);
  const apptType = typeResult.data as AppointmentTypeRecord;

  const rangeStart = new Date(`${dateKey}T00:00:00-07:00`);
  const rangeEnd = new Date(`${dateKey}T23:59:59-07:00`);

  const [rules, appointments, blockedTimes] = await Promise.all([
    adminClient
      .from("booking_availability_rules")
      .select("id, user_id, appointment_type_id, day_of_week, start_time, end_time, timezone, is_available")
      .or(`appointment_type_id.is.null,appointment_type_id.eq.${appt.appointment_type_id}`)
      .order("start_time", { ascending: true }),
    adminClient
      .from("booking_appointments")
      .select("start_time, end_time")
      .in("status", ACTIVE_BUSY_STATUSES)
      .neq("id", id) // exclude the current appointment being rescheduled
      .lt("start_time", rangeEnd.toISOString())
      .gt("end_time", rangeStart.toISOString()),
    adminClient
      .from("booking_blocked_times")
      .select("start_time, end_time")
      .eq("blocks_public_booking", true)
      .lt("start_time", rangeEnd.toISOString())
      .gt("end_time", rangeStart.toISOString()),
  ]);

  const availabilityError = rules.error || appointments.error || blockedTimes.error;
  if (availabilityError) return jsonError(availabilityError.message, 400);

  const slots = buildAvailabilitySlots({
    appointmentType: apptType,
    dateKey,
    rules: rules.data ?? [],
    appointments: appointments.data ?? [],
    blockedTimes: blockedTimes.data ?? [],
  });

  const selectedSlot = slots.find((slot) => slot.start === newStartDate.toISOString());
  if (!selectedSlot) return jsonError("That time slot is no longer available. Please choose another.", 409);

  const updateResult = await adminClient
    .from("booking_appointments")
    .update({
      start_time: selectedSlot.start,
      end_time: selectedSlot.end,
      status: "rescheduled",
      reschedule_reason: body?.reason?.trim() || null,
    })
    .eq("id", id)
    .select("id, title, start_time, end_time, status")
    .single();

  if (updateResult.error) return jsonError(updateResult.error.message, 400);

  // Update or create Google Calendar event (non-blocking)
  try {
    const integration = await getActiveCalendarIntegration(adminClient);
    if (integration) {
      const token = await getFreshToken(adminClient, integration);
      if (token) {
        if (appt.external_calendar_provider === "google" && appt.external_event_id) {
          await updateGoogleCalendarEvent(token, appt.external_calendar_id || integration.calendar_id, appt.external_event_id, {
            start: selectedSlot.start,
            end: selectedSlot.end,
          });
        } else {
          const eventId = await createGoogleCalendarEvent(token, integration.calendar_id, {
            summary: updateResult.data.title || apptType.name,
            start: selectedSlot.start,
            end: selectedSlot.end,
          });
          if (eventId) {
            await adminClient
              .from("booking_appointments")
              .update({ external_calendar_provider: "google", external_event_id: eventId, external_calendar_id: integration.calendar_id })
              .eq("id", id);
          }
        }
      }
    }
  } catch {
    // Calendar update failed silently
  }

  return NextResponse.json({ appointment: updateResult.data });
}
