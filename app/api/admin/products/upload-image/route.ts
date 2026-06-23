import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const formData = await request.formData().catch(() => null);
  if (!formData) return jsonError("FormData payload required.");

  const file = formData.get("file") as File | null;
  if (!file) return jsonError("No file provided.");
  if (!ALLOWED_TYPES.includes(file.type)) return jsonError(`File type not allowed. Use: ${ALLOWED_TYPES.join(", ")}`);
  if (file.size > MAX_BYTES) return jsonError("File exceeds 10 MB limit.");

  const sku = String(formData.get("sku") || "product").replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${safeFilename(file.name)}`;
  const storagePath = `products/${sku}/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await adminClient.storage
    .from("artwork")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return jsonError(uploadError.message, 400);

  const { data: urlData } = adminClient.storage.from("artwork").getPublicUrl(storagePath);

  return Response.json({ url: urlData.publicUrl, path: storagePath });
}
