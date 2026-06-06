import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildAvailabilitySlots, parseDateKey, type AppointmentTypeRecord } from "@/lib/booking/availability";
import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";
import { getActiveCalendarIntegration, getFreshToken } from "@/lib/calendar/integration";
import { getGoogleFreeBusy } from "@/lib/calendar/google";

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

export async function GET(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const url = new URL(request.url);
  const appointmentTypeId = url.searchParams.get("appointment_type_id") || "";
  const dateKey = parseDateKey(url.searchParams.get("date") || "");
  if (!appointmentTypeId) return jsonError("Appointment type is required.");
  if (!dateKey) return jsonError("A valid date is required.");

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const typeResult = await db
    .from("booking_appointment_types")
    .select("id, name, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_in_advance, location_type, meeting_url, color")
    .eq("id", appointmentTypeId)
    .eq("is_active", true)
    .maybeSingle();

  if (typeResult.error) return jsonError(typeResult.error.message, 400);
  if (!typeResult.data) return jsonError("Appointment type was not found.", 404);

  const rangeStart = new Date(`${dateKey}T00:00:00-07:00`);
  const rangeEnd = new Date(`${dateKey}T23:59:59-07:00`);

  const [rules, appointments, blockedTimes] = await Promise.all([
    db
      .from("booking_availability_rules")
      .select("id, user_id, appointment_type_id, day_of_week, start_time, end_time, timezone, is_available")
      .or(`appointment_type_id.is.null,appointment_type_id.eq.${appointmentTypeId}`)
      .order("start_time", { ascending: true }),
    db
      .from("booking_appointments")
      .select("start_time, end_time")
      .in("status", ACTIVE_BUSY_STATUSES)
      .lt("start_time", rangeEnd.toISOString())
      .gt("end_time", rangeStart.toISOString()),
    db
      .from("booking_blocked_times")
      .select("start_time, end_time")
      .eq("blocks_public_booking", true)
      .lt("start_time", rangeEnd.toISOString())
      .gt("end_time", rangeStart.toISOString()),
  ]);

  const error = rules.error || appointments.error || blockedTimes.error;
  if (error) return jsonError(error.message, 400);

  // Fetch Google Calendar busy windows and merge with blocked times
  const calendarBusy: { start: string; end: string }[] = [];
  try {
    const integration = await getActiveCalendarIntegration(db);
    if (integration) {
      const token = await getFreshToken(db, integration);
      if (token) {
        const busy = await getGoogleFreeBusy(token, integration.calendar_id, rangeStart.toISOString(), rangeEnd.toISOString());
        calendarBusy.push(...busy);
      }
    }
  } catch {
    // Calendar unavailable — don't fail the whole request, just skip
  }

  const allBlockedTimes = [
    ...(blockedTimes.data ?? []),
    ...calendarBusy.map((w) => ({ start_time: w.start, end_time: w.end })),
  ];

  const slots = buildAvailabilitySlots({
    appointmentType: typeResult.data as AppointmentTypeRecord,
    dateKey,
    rules: rules.data ?? [],
    appointments: appointments.data ?? [],
    blockedTimes: allBlockedTimes,
  });

  return NextResponse.json({ date: dateKey, slots });
}
