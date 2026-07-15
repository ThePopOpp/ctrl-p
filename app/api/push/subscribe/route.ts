import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

type PushSubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function adminClient(config: { supabaseUrl: string; serviceRoleKey: string }) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function userIdFromToken(
  config: { supabaseUrl: string; serviceRoleKey: string },
  request: Request,
): Promise<string | null> {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await adminClient(config).auth.getUser(token);
  return data.user?.id ?? null;
}

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if ("error" in config) return config.error;

  const body = (await request.json().catch(() => null)) as PushSubscriptionBody | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return jsonError("Invalid push subscription.", 400);
  }

  const userId = await userIdFromToken(config, request);

  const { error } = await adminClient(config)
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_id: userId,
        user_agent: request.headers.get("user-agent") || null,
      },
      { onConflict: "endpoint" },
    );

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const config = getServerSupabaseConfig();
  if ("error" in config) return config.error;

  const body = (await request.json().catch(() => null)) as PushSubscriptionBody | null;
  if (!body?.endpoint) return jsonError("Missing endpoint.", 400);

  const { error } = await adminClient(config).from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
