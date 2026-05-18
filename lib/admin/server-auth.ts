import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export function serverEnv(name: string) {
  return process.env[name] || "";
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function getServerSupabaseConfig() {
  const supabaseUrl = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = serverEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = serverEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey) {
    return { error: jsonError("Supabase public environment variables are not configured.", 500) };
  }

  if (!serviceRoleKey) {
    return { error: jsonError("SUPABASE_SERVICE_ROLE_KEY is required on the server.", 501) };
  }

  return { supabaseUrl, publishableKey, serviceRoleKey };
}

export async function verifyAdminRequest(request: Request, allowedRoles = ["super_admin", "admin", "employee", "staff", "customer_support"]) {
  const config = getServerSupabaseConfig();
  if (config.error) return { error: config.error };

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return { error: jsonError("Missing admin session token.", 401) };

  const userClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return { error: jsonError("Invalid admin session.", 401) };

  const actorResult = await userClient
    .from("users")
    .select("id, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (actorResult.error || !actorResult.data) return { error: jsonError("Could not verify admin profile.", 403) };

  const actor = actorResult.data;
  if (!allowedRoles.includes(actor.role) || actor.status !== "active" || actor.deleted_at) {
    return { error: jsonError("Only active staff or admins can perform this action.", 403) };
  }

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { actorId, actor, adminClient, config };
}
