import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

function toIcsDate(iso: string) {
  return iso.replace(/[:\-]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) return jsonError("Appointment ID is required.", 400);

  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await db
    .from("booking_appointments")
    .select("id, title, start_time, end_time, customer_first_name, customer_last_name, customer_notes, location_type, meeting_url, booking_appointment_types(name, description)")
    .eq("id", id)
    .maybeSingle();

  if (result.error) return jsonError(result.error.message, 400);
  if (!result.data) return jsonError("Appointment not found.", 404);

  const appt = result.data;
  const type = Array.isArray(appt.booking_appointment_types)
    ? appt.booking_appointment_types[0]
    : appt.booking_appointment_types as { name?: string; description?: string } | null;

  const dtStart = toIcsDate(appt.start_time);
  const dtEnd = toIcsDate(appt.end_time);
  const dtStamp = toIcsDate(new Date().toISOString());
  const summary = escapeIcs(appt.title || `${type?.name || "Appointment"} with ControlP.io`);
  const description = escapeIcs(
    [type?.description, appt.customer_notes].filter(Boolean).join(" | ") ||
    `Appointment with ControlP.io`,
  );
  const location = escapeIcs(appt.meeting_url || (appt.location_type || "").replace(/_/g, " "));

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ControlP.io//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:appointment-${appt.id}@controlp.io`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointment-${appt.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
