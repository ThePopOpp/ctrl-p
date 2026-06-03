import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

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

  const body = await request.json().catch(() => ({})) as { ids?: string[] };
  const now = new Date().toISOString();

  const hasIds = Array.isArray(body.ids) && body.ids.length > 0;

  const query = hasIds
    ? adminClient.from("messages").update({ read_at: now }).eq("user_id", actorId).in("id", body.ids!).is("read_at", null)
    : adminClient.from("messages").update({ read_at: now }).eq("user_id", actorId).is("read_at", null);

  const result = await query;
  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ ok: true });
}
