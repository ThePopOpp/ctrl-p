import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";
import { getActiveCalendarIntegration, getFreshToken } from "@/lib/calendar/integration";
import { cancelGoogleCalendarEvent } from "@/lib/calendar/google";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const { id } = await params;
  if (!id) return jsonError("Appointment ID is required.", 400);

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

  const apptResult = await adminClient
    .from("booking_appointments")
    .select("id, status, start_time, customer_email, external_event_id, external_calendar_id, external_calendar_provider")
    .eq("id", id)
    .maybeSingle();

  if (apptResult.error || !apptResult.data) return jsonError("Appointment not found.", 404);
  const appt = apptResult.data;

  if (String(appt.customer_email || "").toLowerCase().trim() !== email) {
    return jsonError("You do not have permission to cancel this appointment.", 403);
  }

  const nonCancelable = ["canceled", "completed", "no_show"];
  if (nonCancelable.includes(String(appt.status || ""))) {
    return jsonError("This appointment cannot be canceled.", 409);
  }

  if (new Date(appt.start_time) < new Date()) {
    return jsonError("Past appointments cannot be canceled.", 409);
  }

  const updateResult = await adminClient
    .from("booking_appointments")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status")
    .single();

  if (updateResult.error) return jsonError(updateResult.error.message, 400);

  // Cancel Google Calendar event (non-blocking)
  if (appt.external_calendar_provider === "google" && appt.external_event_id) {
    try {
      const integration = await getActiveCalendarIntegration(adminClient);
      if (integration) {
        const token = await getFreshToken(adminClient, integration);
        if (token) {
          await cancelGoogleCalendarEvent(token, appt.external_calendar_id || integration.calendar_id, appt.external_event_id);
        }
      }
    } catch {
      // Calendar update failed silently
    }
  }

  return NextResponse.json({ appointment: updateResult.data });
}
