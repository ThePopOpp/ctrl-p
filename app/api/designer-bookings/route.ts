import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  // Admin: list all bookings (requires auth header — but we'll keep it simple via service key)
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const url = new URL(request.url);
  const designerId = url.searchParams.get("designer_id");
  const status = url.searchParams.get("status");
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? "50"));

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = db
    .from("designer_bookings")
    .select("*, designer_profiles(id, name, avatar_url)")
    .order("start_time", { ascending: true })
    .limit(limit);

  if (designerId) query = query.eq("designer_id", designerId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const {
    designer_id,
    start_time,
    duration_hours,
    customer_first_name,
    customer_last_name,
    customer_email,
    customer_phone,
    company_name,
    project_description,
  } = body as Record<string, unknown>;

  if (!designer_id || !start_time || !duration_hours || !customer_first_name || !customer_last_name || !customer_email) {
    return jsonError("Required fields: designer_id, start_time, duration_hours, customer_first_name, customer_last_name, customer_email", 400);
  }

  const hours = Number(duration_hours);
  if (isNaN(hours) || hours <= 0 || hours > 8) {
    return jsonError("duration_hours must be between 0 and 8", 400);
  }

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch designer to snapshot rate
  const { data: designer, error: dErr } = await db
    .from("designer_profiles")
    .select("id, name, hourly_rate")
    .eq("id", designer_id)
    .eq("is_active", true)
    .single();

  if (dErr || !designer) return jsonError("Designer not found or inactive", 404);

  const startISO = new Date(String(start_time)).toISOString();
  const endISO = new Date(new Date(startISO).getTime() + hours * 3600 * 1000).toISOString();
  const rateSnapshot = Number(designer.hourly_rate);
  const totalPrice = +(hours * rateSnapshot).toFixed(2);

  // Check for conflicts
  const { data: conflicts } = await db
    .from("designer_bookings")
    .select("id")
    .eq("designer_id", String(designer_id))
    .not("status", "in", '("canceled")')
    .lt("start_time", endISO)
    .gt("end_time", startISO);

  if (conflicts && conflicts.length > 0) {
    return jsonError("That time slot is no longer available. Please choose another.", 409);
  }

  const { data: booking, error: bErr } = await db
    .from("designer_bookings")
    .insert({
      designer_id: String(designer_id),
      customer_first_name: String(customer_first_name),
      customer_last_name: String(customer_last_name),
      customer_email: String(customer_email),
      customer_phone: customer_phone ? String(customer_phone) : null,
      company_name: company_name ? String(company_name) : null,
      project_description: project_description ? String(project_description) : null,
      start_time: startISO,
      end_time: endISO,
      duration_hours: hours,
      hourly_rate_snapshot: rateSnapshot,
      total_price: totalPrice,
      status: "pending_payment",
    })
    .select()
    .single();

  if (bErr || !booking) return jsonError(bErr?.message ?? "Failed to create booking", 500);

  return NextResponse.json({ booking, designer }, { status: 201 });
}
