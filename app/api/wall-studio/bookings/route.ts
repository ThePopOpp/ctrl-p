import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";
import { sendBookingConfirmation } from "@/lib/email/wall-studio-emails";

const TIME_WINDOWS = ["8–11 AM", "11–2 PM", "2–5 PM"];

function newRef(): string {
  return "IN-" + String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if ("error" in config) return config.error;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    project_type?: string;
    notes?: string;
    preferred_date?: string;
    time_window?: string;
    order_id?: string;
  } | null;

  const name = String(body?.name || "").trim();
  const phone = String(body?.phone || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const address = String(body?.address || "").trim();
  const projectType = String(body?.project_type || "").trim();
  const preferredDate = String(body?.preferred_date || "").trim();
  const timeWindow = String(body?.time_window || "").trim();

  if (!name || !phone || !address) return jsonError("Name, phone, and address are required.", 400);
  if (!TIME_WINDOWS.includes(timeWindow)) return jsonError("Pick a valid time window.", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) return jsonError("A valid preferred date is required.", 400);

  // Block dates fewer than 2 days out.
  const minDate = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (preferredDate < minDate) return jsonError("Please choose a date at least 2 days out.", 400);

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Associate with the signed-in user if a token is present.
  let userId: string | null = null;
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (token) {
    const { data } = await db.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  // Insert with a unique IN-xxxxxx ref, retrying on the rare collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = newRef();
    const { data, error } = await db
      .from("ws_bookings")
      .insert({
        ref,
        user_id: userId,
        order_id: body?.order_id || null,
        name,
        phone,
        email: email || null,
        address,
        project_type: projectType || "Wall Studio install",
        notes: String(body?.notes || "").trim() || null,
        preferred_date: preferredDate,
        time_window: timeWindow,
      })
      .select("ref")
      .single();

    if (!error && data) {
      const bookingRef = data.ref;
      const projectLabel = projectType || "Wall Studio install";

      // Admin notification (non-blocking).
      db.from("admin_notifications")
        .insert({
          type: "ws_booking",
          title: `New install request ${bookingRef}`,
          body: `${name} · ${projectLabel} · ${preferredDate}, ${timeWindow}`,
          user_id: userId,
          meta: { ref: bookingRef, phone, email: email || null, address },
        })
        .then(() => {}, () => {});

      // Customer confirmation email (non-blocking; only if an email was given).
      if (email) {
        sendBookingConfirmation({
          to: email,
          name,
          ref: bookingRef,
          projectType: projectLabel,
          preferredDate,
          timeWindow,
          phone,
        }).catch(() => {});
      }

      return NextResponse.json({ ref: bookingRef });
    }
    if (error && error.code !== "23505") return jsonError(error.message, 500);
  }
  return jsonError("Could not create booking, please try again.", 500);
}
