import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

const TZ = "America/Phoenix";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
// Minimum advance notice in hours
const MIN_NOTICE_HOURS = 24;

type DaySchedule = { enabled: boolean; start: string; end: string };

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function toPhoenixDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD (Phoenix local)
  const durationHours = Math.max(1, Math.min(8, Number(url.searchParams.get("hours") ?? "1")));

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError("date param required (YYYY-MM-DD)", 400);
  }

  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch designer's schedule
  const { data: designer, error: dErr } = await db
    .from("designer_profiles")
    .select("id, weekly_schedule")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (dErr || !designer) return jsonError("Designer not found", 404);

  // Determine day-of-week for the requested date (in Phoenix timezone)
  const requestedDate = new Date(`${date}T12:00:00`); // noon to avoid DST edge cases
  const dayKey = DAY_KEYS[requestedDate.getDay()];
  const schedule = (designer.weekly_schedule as Record<string, DaySchedule>)[dayKey];

  if (!schedule?.enabled) {
    return NextResponse.json({ slots: [] });
  }

  const startMin = parseHHMM(schedule.start);
  const endMin = parseHHMM(schedule.end);
  const durationMin = durationHours * 60;

  // Earliest bookable time: now + MIN_NOTICE_HOURS
  const earliest = new Date(Date.now() + MIN_NOTICE_HOURS * 3600 * 1000);
  const earliestPhoenix = toPhoenixDateString(earliest);
  const isToday = date === earliestPhoenix;

  // Fetch existing confirmed/pending bookings for this designer on this date
  // Use a window: start of day → end of day in Phoenix (UTC-7 always)
  const dayStartUTC = new Date(`${date}T07:00:00Z`); // Phoenix midnight = UTC 07:00
  const dayEndUTC = new Date(`${date}T06:59:59Z`);
  dayEndUTC.setUTCDate(dayEndUTC.getUTCDate() + 1); // next day 06:59 UTC = Phoenix 23:59

  const { data: existingBookings } = await db
    .from("designer_bookings")
    .select("start_time, end_time")
    .eq("designer_id", id)
    .not("status", "in", '("canceled")')
    .gte("start_time", dayStartUTC.toISOString())
    .lte("end_time", dayEndUTC.toISOString());

  const booked = (existingBookings ?? []).map((b) => ({
    start: new Date(b.start_time).getTime(),
    end: new Date(b.end_time).getTime(),
  }));

  // Generate hourly slots
  const slots: { start: string; end: string; label: string }[] = [];

  for (let t = startMin; t + durationMin <= endMin; t += 60) {
    const slotH = Math.floor(t / 60);
    const slotM = t % 60;

    // Build UTC ISO for this slot (Phoenix = UTC-7)
    const slotStartUTC = new Date(`${date}T${String(slotH + 7).padStart(2, "0")}:${String(slotM).padStart(2, "0")}:00Z`);
    const slotEndUTC = new Date(slotStartUTC.getTime() + durationMin * 60 * 1000);

    // Skip past or within notice window
    if (isToday && slotStartUTC < earliest) continue;

    // Skip if overlaps with any existing booking
    const conflicts = booked.some(
      (b) => slotStartUTC.getTime() < b.end && slotEndUTC.getTime() > b.start
    );
    if (conflicts) continue;

    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(slotStartUTC);

    slots.push({ start: slotStartUTC.toISOString(), end: slotEndUTC.toISOString(), label });
  }

  return NextResponse.json({ slots });
}
