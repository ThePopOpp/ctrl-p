import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { googleOAuthUrl } from "@/lib/calendar/google";
import { getServerSupabaseConfig, verifyAdminRequest } from "@/lib/admin/server-auth";

// GET  — return current integration status + OAuth URL
// DELETE — disconnect (mark inactive)

export async function GET(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;
  const session = await verifyAdminRequest(request);
  if (session.error) return session.error;

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await db
    .from("calendar_integrations")
    .select("id, provider, account_email, calendar_id, calendar_name, is_active, token_expires_at, created_at")
    .eq("provider", "google")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const connectUrl = googleOAuthUrl();

  return NextResponse.json({
    integration: result.data ?? null,
    connectUrl,
    configured: !!(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
  });
}

export async function DELETE(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;
  const session = await verifyAdminRequest(request);
  if (session.error) return session.error;

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await db
    .from("calendar_integrations")
    .update({ is_active: false, access_token: "", refresh_token: null })
    .eq("provider", "google")
    .eq("is_active", true);

  return NextResponse.json({ ok: true });
}
