import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

const STATUSES = new Set(["draft", "ready_for_review", "ordered", "in_production", "archived"]);

type DraftBody = {
  id?: string;
  title?: string;
  product_id?: string | null;
  product_key?: string;
  product_label?: string;
  status?: string;
  state?: Record<string, unknown>;
  preview_svg?: string;
  preview_image_url?: string;
  order_id?: string | null;
  order_item_id?: string | null;
  notes?: string;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function nullable(value: unknown) {
  const text = clean(value);
  return text || null;
}

async function verifyCustomerRequest(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return { error: config.error };

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return { error: jsonError("Missing customer session token.", 401) };

  const userClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return { error: jsonError("Invalid customer session.", 401) };

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const profileResult = await adminClient
    .from("users")
    .select("id, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return { error: jsonError("Customer profile not found.", 404) };
  if (profileResult.data.deleted_at || !["active", "pending"].includes(clean(profileResult.data.status))) {
    return { error: jsonError("Your account is not active.", 403) };
  }

  return { actorId, adminClient };
}

const draftSelect = "id, user_id, product_id, product_key, product_label, title, state, artwork_file_id, status, preview_svg, preview_image_url, order_id, order_item_id, notes, last_saved_at, created_at, updated_at, products(id, name, slug, category)";

export async function GET(request: Request) {
  const verified = await verifyCustomerRequest(request);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  let query = verified.adminClient
    .from("design_drafts")
    .select(draftSelect)
    .eq("user_id", verified.actorId)
    .order("last_saved_at", { ascending: false })
    .limit(100);

  if (id) query = query.eq("id", id).limit(1);

  const result = await query;
  if (result.error) return jsonError(result.error.message, 400);

  if (id) {
    const draft = (result.data || [])[0] || null;
    if (!draft) return jsonError("Design draft not found.", 404);
    return NextResponse.json({ draft });
  }

  return NextResponse.json({ drafts: result.data ?? [] });
}

export async function POST(request: Request) {
  const verified = await verifyCustomerRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as DraftBody | null;
  if (!body) return jsonError("Design draft payload is required.");

  const status = STATUSES.has(clean(body.status)) ? clean(body.status) : "draft";
  const payload = {
    user_id: verified.actorId,
    product_id: nullable(body.product_id),
    product_key: nullable(body.product_key),
    product_label: nullable(body.product_label),
    title: clean(body.title) || "Untitled design",
    state: body.state && typeof body.state === "object" ? body.state : {},
    status,
    preview_svg: nullable(body.preview_svg),
    preview_image_url: nullable(body.preview_image_url),
    order_id: nullable(body.order_id),
    order_item_id: nullable(body.order_item_id),
    notes: nullable(body.notes),
    last_saved_at: new Date().toISOString(),
  };

  const result = body.id
    ? await verified.adminClient
        .from("design_drafts")
        .update(payload)
        .eq("id", body.id)
        .eq("user_id", verified.actorId)
        .select(draftSelect)
        .single()
    : await verified.adminClient
        .from("design_drafts")
        .insert(payload)
        .select(draftSelect)
        .single();

  if (result.error) return jsonError(result.error.message, 400);

  // Notify admin on new design or when customer marks ready for review (non-blocking)
  const isNew = !body.id;
  const isReadyForReview = status === "ready_for_review";
  if (isNew || isReadyForReview) {
    const notifType = isReadyForReview ? "custom_design_request" : "design_submitted";
    const notifTitle = isReadyForReview
      ? `Design ready for review: "${payload.title}"`
      : `New design saved: "${payload.title}"`;
    try {
      await verified.adminClient.from("admin_notifications").insert({
        type: notifType,
        title: notifTitle,
        body: `Product: ${nullable(body.product_label) || nullable(body.product_key) || "Custom design"}`,
        design_draft_id: result.data.id,
        user_id: verified.actorId,
        meta: { product_key: body.product_key, title: payload.title, status },
      });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ draft: result.data });
}

export async function DELETE(request: Request) {
  const verified = await verifyCustomerRequest(request);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonError("Design draft id is required.");

  const result = await verified.adminClient
    .from("design_drafts")
    .delete()
    .eq("id", id)
    .eq("user_id", verified.actorId);

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ ok: true });
}
