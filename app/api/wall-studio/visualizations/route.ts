import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// POST: persist a saved visualizer look (snapshot PNG -> Storage, row -> ws_visualizations).
export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if ("error" in config) return config.error;

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("FormData payload required.");

  const png = form.get("png") as File | null;
  if (!png) return jsonError("A snapshot image is required.");
  if (png.type !== "image/png") return jsonError("Snapshot must be a PNG.");
  if (png.size > MAX_BYTES) return jsonError("Snapshot exceeds 8 MB.");

  const productId = String(form.get("product_id") || "") || null;
  const parseJson = (key: string, fallback: unknown) => {
    try {
      return JSON.parse(String(form.get(key) || ""));
    } catch {
      return fallback;
    }
  };
  const corners = parseJson("corners", null);
  if (!corners) return jsonError("corners are required.");
  const cutouts = parseJson("cutouts", []);
  const num = (key: string) => {
    const v = Number(form.get(key));
    return Number.isFinite(v) ? v : null;
  };

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Optional owner association.
  let userId: string | null = null;
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (token) {
    const { data } = await db.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  const path = `wall-studio/${crypto.randomUUID()}.png`;
  const buffer = Buffer.from(await png.arrayBuffer());
  const uploadResult = await db.storage.from("artwork").upload(path, buffer, {
    contentType: "image/png",
    upsert: false,
  });
  if (uploadResult.error) return jsonError(uploadResult.error.message, 400);

  const snapshotUrl = db.storage.from("artwork").getPublicUrl(path).data.publicUrl;

  const insert = await db
    .from("ws_visualizations")
    .insert({
      user_id: userId,
      product_id: productId,
      corners,
      cutouts,
      wall_w_ft: num("wall_w_ft"),
      wall_h_ft: num("wall_h_ft"),
      pattern_scale: num("pattern_scale"),
      opacity: num("opacity"),
      snapshot_url: snapshotUrl,
    })
    .select("id, snapshot_url")
    .single();

  if (insert.error) {
    await db.storage.from("artwork").remove([path]).catch(() => null);
    return jsonError(insert.error.message, 400);
  }

  return NextResponse.json({ id: insert.data.id, snapshot_url: insert.data.snapshot_url });
}
