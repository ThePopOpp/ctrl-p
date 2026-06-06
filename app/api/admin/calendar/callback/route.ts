import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  exchangeGoogleCode,
  getGoogleAccountEmail,
} from "@/lib/calendar/google";
import { getServerSupabaseConfig } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://my.controlp.io";
  const settingsUrl = `${appUrl}/admin/settings?tab=calendar`;

  if (error || !code) {
    return NextResponse.redirect(`${settingsUrl}&calendar_error=${encodeURIComponent(error || "access_denied")}`);
  }

  let tokens;
  try {
    tokens = await exchangeGoogleCode(code);
  } catch {
    return NextResponse.redirect(`${settingsUrl}&calendar_error=token_exchange_failed`);
  }

  const accountEmail = await getGoogleAccountEmail(tokens.access_token);

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Deactivate any existing Google integration
  await db
    .from("calendar_integrations")
    .update({ is_active: false })
    .eq("provider", "google");

  // Insert new integration
  const { error: insertError } = await db.from("calendar_integrations").insert({
    provider: "google",
    account_email: accountEmail,
    calendar_id: "primary",
    calendar_name: accountEmail ? `${accountEmail} (primary)` : "Primary calendar",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: tokens.expires_at,
    is_active: true,
  });

  if (insertError) {
    return NextResponse.redirect(`${settingsUrl}&calendar_error=save_failed`);
  }

  return NextResponse.redirect(`${settingsUrl}&calendar_connected=1`);
}
