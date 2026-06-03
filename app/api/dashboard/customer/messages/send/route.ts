import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return jsonError("Missing customer session token.", 401);

  const userClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return jsonError("Invalid customer session.", 401);

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const profileResult = await adminClient
    .from("users")
    .select("id, email, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return jsonError("Customer profile not found.", 404);
  if (profileResult.data.deleted_at || !["active", "pending"].includes(clean(profileResult.data.status))) {
    return jsonError("Your account is not active.", 403);
  }

  const body = await request.json().catch(() => null) as { subject?: string; body?: string; order_id?: string } | null;
  const messageBody = clean(body?.body);
  if (!messageBody) return jsonError("Message body is required.");

  const orderId = clean(body?.order_id) || null;

  // Verify the order belongs to this customer if provided
  if (orderId) {
    const orderCheck = await adminClient
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .or(`user_id.eq.${actorId},customer_email.eq.${clean(profileResult.data.email).toLowerCase()}`)
      .maybeSingle();
    if (!orderCheck.data) return jsonError("Order not found.", 404);
  }

  const insertResult = await adminClient.from("messages").insert({
    user_id: actorId,
    order_id: orderId,
    channel: "dashboard",
    direction: "inbound",
    subject: clean(body?.subject) || null,
    body: messageBody,
    internal_only: false,
    sent_at: new Date().toISOString(),
    created_by: actorId,
  }).select("id, user_id, order_id, subject, body, channel, direction, read_at, sent_at, created_at").single();

  if (insertResult.error) return jsonError(insertResult.error.message, 400);

  return NextResponse.json({ message: insertResult.data });
}
