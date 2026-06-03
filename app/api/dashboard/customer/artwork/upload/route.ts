import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/postscript", "application/eps", "image/x-eps",
  "application/octet-stream",
]);

const MAX_BYTES = 50 * 1024 * 1024;

function safeFilename(value: string) {
  return String(value || "upload")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "upload";
}

export async function POST(request: Request) {
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
    .select("id, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (!profileResult.data) return jsonError("Customer profile not found.", 404);
  if (profileResult.data.deleted_at || !["active", "pending"].includes(String(profileResult.data.status ?? ""))) {
    return jsonError("Your account is not active.", 403);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("No form data received.", 400);

  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return jsonError("No file provided.", 400);
  if (file.size > MAX_BYTES) return jsonError("File too large. Maximum 50 MB.", 400);

  const mimeType = file.type || "application/octet-stream";
  const baseType = mimeType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(baseType) && !baseType.startsWith("image/")) {
    return jsonError("Unsupported file type. Accepted: PDF, PNG, JPEG, SVG, AI, EPS, PSD.", 400);
  }

  const rawOrderId = String(form.get("order_id") || "").trim();
  const orderId = rawOrderId || null;

  if (orderId) {
    const orderCheck = await adminClient
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .or(`user_id.eq.${actorId},customer_email.eq.${String(profileResult.data).toLowerCase()}`)
      .maybeSingle();
    if (!orderCheck.data) return jsonError("Order not found or not yours.", 404);
  }

  const filename = safeFilename(file.name);
  const storagePath = `artwork/${actorId}/${Date.now()}-${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploadResult = await adminClient.storage.from("artwork").upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadResult.error) return jsonError(uploadResult.error.message, 400);

  const insertResult = await adminClient
    .from("artwork_files")
    .insert({
      user_id: actorId,
      order_id: orderId,
      filename: file.name,
      mime_type: mimeType,
      file_size_bytes: file.size,
      review_status: "pending",
      created_by: actorId,
    })
    .select("id, user_id, order_id, filename, mime_type, file_size_bytes, thumbnail_url, review_status, proof_version, admin_comments, customer_comments, created_at")
    .single();

  if (insertResult.error) {
    await adminClient.storage.from("artwork").remove([storagePath]).catch(() => null);
    return jsonError(insertResult.error.message, 400);
  }

  return NextResponse.json({ artworkFile: insertResult.data });
}
