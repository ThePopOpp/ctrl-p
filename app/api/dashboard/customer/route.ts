import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

function text(value: unknown) {
  return String(value || "").trim();
}

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
    .select("id, email, full_name, phone, company, profile_photo_url, role, status, deleted_at, created_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) {
    return jsonError(profileResult.error?.message || "Customer profile not found.", 404);
  }

  const profile = profileResult.data;
  if (profile.deleted_at || !["active", "pending"].includes(text(profile.status))) {
    return jsonError("Your account is not active.", 403);
  }

  const email = text(profile.email).toLowerCase();
  const ordersResult = await adminClient
    .from("orders")
    .select("id, order_number, user_id, status, production_status, payment_status, total, company, customer_email, customer_phone, customer_notes, due_at, created_at")
    .or(`user_id.eq.${actorId}${email ? `,customer_email.eq.${email}` : ""}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (ordersResult.error) return jsonError(ordersResult.error.message, 400);

  const orders = ordersResult.data ?? [];
  const orderIds = orders.map((order) => order.id);

  const [itemsResult, paymentsResult, messagesResult, artworkResult, shipmentsResult, designDraftsResult] = await Promise.all([
    orderIds.length
      ? adminClient
          .from("order_items")
          .select("id, order_id, quantity, unit_price, line_total, proof_required, products!order_items_product_id_fkey(id, name, category)")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? adminClient
          .from("payments")
          .select("id, order_id, user_id, amount, status, provider, method, currency, invoice_number, invoice_due_at, payment_link_url, received_at, created_at")
          .or(`user_id.eq.${actorId},order_id.in.(${orderIds.join(",")})`)
          .order("created_at", { ascending: false })
          .limit(100)
      : adminClient
          .from("payments")
          .select("id, order_id, user_id, amount, status, provider, method, currency, invoice_number, invoice_due_at, payment_link_url, received_at, created_at")
          .eq("user_id", actorId)
          .order("created_at", { ascending: false })
          .limit(100),
    adminClient
      .from("messages")
      .select("id, user_id, order_id, subject, body, channel, direction, read_at, sent_at, created_at")
      .eq("user_id", actorId)
      .eq("internal_only", false)
      .order("created_at", { ascending: false })
      .limit(50),
    orderIds.length
      ? adminClient
          .from("artwork_files")
          .select("id, user_id, order_id, order_item_id, filename, mime_type, file_size_bytes, thumbnail_url, review_status, proof_version, admin_comments, customer_comments, created_at")
          .or(`user_id.eq.${actorId},order_id.in.(${orderIds.join(",")})`)
          .order("created_at", { ascending: false })
          .limit(100)
      : adminClient
          .from("artwork_files")
          .select("id, user_id, order_id, order_item_id, filename, mime_type, file_size_bytes, thumbnail_url, review_status, proof_version, admin_comments, customer_comments, created_at")
          .eq("user_id", actorId)
          .order("created_at", { ascending: false })
          .limit(100),
    orderIds.length
      ? adminClient
          .from("shipments")
          .select("id, order_id, carrier, tracking_number, tracking_url, status, shipped_at, estimated_delivery_at, delivered_at, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    adminClient
      .from("design_drafts")
      .select("id, user_id, product_id, product_key, product_label, title, state, status, preview_svg, preview_image_url, order_id, order_item_id, notes, last_saved_at, created_at, updated_at, products(id, name, slug, category)")
      .eq("user_id", actorId)
      .order("last_saved_at", { ascending: false })
      .limit(50),
  ]);

  const results = [itemsResult, paymentsResult, messagesResult, artworkResult, shipmentsResult, designDraftsResult];
  const failed = results.find((result) => result.error);
  if (failed?.error) return jsonError(failed.error.message, 400);

  const itemIds = (itemsResult.data ?? []).map((item) => item.id);
  const proofsResult = itemIds.length
    ? await adminClient
        .from("proofs")
        .select("id, order_item_id, proof_url, revision_number, status, customer_comments, admin_comments, sent_at, customer_approved_at, rejected_at, created_at")
        .in("order_item_id", itemIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };

  if (proofsResult.error) return jsonError(proofsResult.error.message, 400);

  return NextResponse.json({
    profile,
    orders,
    orderItems: itemsResult.data ?? [],
    payments: paymentsResult.data ?? [],
    messages: messagesResult.data ?? [],
    artworkFiles: artworkResult.data ?? [],
    designDrafts: designDraftsResult.data ?? [],
    proofs: proofsResult.data ?? [],
    shipments: shipmentsResult.data ?? [],
  });
}

export async function PATCH(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const updates = {
    full_name: text(body.full_name) || null,
    phone: text(body.phone) || null,
    company: text(body.company) || null,
    profile_photo_url: text(body.profile_photo_url) || null,
  };

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const currentResult = await adminClient
    .from("users")
    .select("id, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (currentResult.error || !currentResult.data) return jsonError(currentResult.error?.message || "Customer profile not found.", 404);
  if (currentResult.data.deleted_at || !["active", "pending"].includes(text(currentResult.data.status))) {
    return jsonError("Your account is not active.", 403);
  }

  const profileResult = await adminClient
    .from("users")
    .update(updates)
    .eq("id", actorId)
    .select("id, email, full_name, phone, company, profile_photo_url, role, status, created_at")
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return jsonError(profileResult.error?.message || "Could not update profile.", 400);

  return NextResponse.json({ profile: profileResult.data });
}
