import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";
import { processPendingAutomations } from "@/lib/automations/runner";

// Called by an external cron (Vercel Cron, system cron, etc.) every minute.
// Protect with CRON_SECRET env var.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) return jsonError("Unauthorized.", 401);
  }

  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const processed = await processPendingAutomations(adminClient);
  return NextResponse.json({ ok: true, processed });
}

// Allow GET so it can be triggered by simple cron services
export async function GET(request: Request) {
  return POST(request);
}
