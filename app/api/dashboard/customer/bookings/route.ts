import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return jsonError("Missing session token.", 401);

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
  if (!email) return NextResponse.json({ bookings: [] });

  // 30 days back so recent past appointments are visible
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const bookingsResult = await adminClient
    .from("booking_appointments")
    .select("id, title, start_time, end_time, status, appointment_type_id, customer_first_name, customer_last_name, customer_email, customer_phone, notes, created_at")
    .gte("start_time", since)
    .eq("customer_email", email)
    .order("start_time", { ascending: false })
    .limit(20);

  if (bookingsResult.error) return jsonError(bookingsResult.error.message, 400);

  return NextResponse.json({ bookings: bookingsResult.data ?? [] });
}
