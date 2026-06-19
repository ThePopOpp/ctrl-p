import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function GET() {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await db
    .from("designer_profiles")
    .select("id, name, title, bio, avatar_url, hourly_rate, specialties, weekly_schedule, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ designers: data ?? [] });
}
