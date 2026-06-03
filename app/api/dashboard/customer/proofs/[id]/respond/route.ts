import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const body = await request.json().catch(() => ({})) as { action?: string; comment?: string };
  const action = String(body.action || "").trim();
  if (!["approve", "revision"].includes(action)) {
    return jsonError("action must be 'approve' or 'revision'.", 400);
  }

  const { id: proofId } = await params;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const profileResult = await adminClient
    .from("users")
    .select("id, email, full_name, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return jsonError("Customer profile not found.", 404);
  const profile = profileResult.data;
  if (profile.deleted_at || !["active", "pending"].includes(String(profile.status || ""))) {
    return jsonError("Your account is not active.", 403);
  }

  const email = String(profile.email || "").toLowerCase().trim();

  const proofResult = await adminClient
    .from("proofs")
    .select("id, order_item_id, status, customer_approved_at, rejected_at")
    .eq("id", proofId)
    .maybeSingle();

  if (proofResult.error || !proofResult.data) return jsonError("Proof not found.", 404);
  const proof = proofResult.data;

  const itemResult = await adminClient
    .from("order_items")
    .select("id, order_id")
    .eq("id", proof.order_item_id)
    .maybeSingle();

  if (itemResult.error || !itemResult.data) return jsonError("Order item not found.", 404);

  const orderResult = await adminClient
    .from("orders")
    .select("id, user_id, customer_email")
    .eq("id", itemResult.data.order_id)
    .maybeSingle();

  if (orderResult.error || !orderResult.data) return jsonError("Order not found.", 404);

  const order = orderResult.data;
  const ownerEmail = String(order.customer_email || "").toLowerCase().trim();
  if (order.user_id !== actorId && ownerEmail !== email) {
    return jsonError("You do not have access to this proof.", 403);
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = action === "approve"
    ? { customer_approved_at: now, status: "approved" }
    : { status: "revision_requested", customer_comments: String(body.comment || "").trim() || null };

  const updateResult = await adminClient
    .from("proofs")
    .update(updates)
    .eq("id", proofId)
    .select("id, status, customer_approved_at, customer_comments")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    return jsonError(updateResult.error?.message || "Could not update proof.", 400);
  }

  const customerName = String(profile.full_name || email || "Customer");
  const actionLabel = action === "approve" ? "approved" : "requested a revision on";

  await adminClient.from("messages").insert({
    user_id: actorId,
    order_id: order.id,
    channel: "internal",
    direction: "inbound",
    subject: `Proof ${action === "approve" ? "approved" : "revision requested"}`,
    body: `${customerName} has ${actionLabel} the proof.${body.comment ? ` Comment: "${body.comment}"` : ""}`,
    internal_only: true,
    sent_at: now,
  });

  return NextResponse.json({ proof: updateResult.data });
}
