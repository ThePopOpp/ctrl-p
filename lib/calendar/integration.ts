import { SupabaseClient } from "@supabase/supabase-js";
import { CalendarIntegration, GoogleTokens, freshAccessToken } from "./google";

export async function getActiveCalendarIntegration(
  db: SupabaseClient
): Promise<CalendarIntegration | null> {
  const result = await db
    .from("calendar_integrations")
    .select("id, provider, account_email, calendar_id, calendar_name, access_token, refresh_token, token_expires_at, is_active")
    .eq("is_active", true)
    .eq("provider", "google")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return result.data ?? null;
}

export async function getFreshToken(
  db: SupabaseClient,
  integration: CalendarIntegration
): Promise<string | null> {
  try {
    return await freshAccessToken(integration, async (tokens: GoogleTokens) => {
      await db
        .from("calendar_integrations")
        .update({
          access_token: tokens.access_token,
          token_expires_at: tokens.expires_at,
          ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        })
        .eq("id", integration.id);
    });
  } catch {
    return null;
  }
}
