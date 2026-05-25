import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export const runtime = "nodejs";

function clean(value: unknown) {
  return String(value || "").trim();
}

function safeFilename(value: string) {
  return clean(value)
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

  const form = await request.formData();
  const file = form.get("file");
  const mediaType = clean(form.get("media_type")) || "media";
  if (!(file instanceof File) || !file.size) return jsonError("Choose an image or video file first.", 400);
  if (!/^image\/|^video\//i.test(file.type || "")) return jsonError("Only image and video uploads are supported here.", 400);

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const profileResult = await adminClient
    .from("users")
    .select("id, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return jsonError(profileResult.error?.message || "Customer profile not found.", 404);
  if (profileResult.data.deleted_at || !["active", "pending"].includes(clean(profileResult.data.status))) return jsonError("Your account is not active.", 403);

  const filename = safeFilename(file.name);
  const storagePath = `digital-cards/${actorId}/${mediaType}/${Date.now()}-${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadResult = await adminClient.storage.from("artwork").upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadResult.error) return jsonError(uploadResult.error.message, 400);

  const publicUrl = adminClient.storage.from("artwork").getPublicUrl(storagePath).data.publicUrl;
  return NextResponse.json({ publicUrl, storagePath });
}
