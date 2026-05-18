import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { isAppRole, ROLES } from "@/lib/rbac/roles";

const userStatuses = new Set(["active", "pending", "inactive", "suspended"]);

function env(name: string) {
  return process.env[name] || "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getSupabaseEnv() {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey) {
    return { error: jsonError("Supabase public environment variables are not configured.", 500) };
  }

  if (!serviceRoleKey) {
    return { error: jsonError("SUPABASE_SERVICE_ROLE_KEY is required on the server to manage users.", 501) };
  }

  return { supabaseUrl, publishableKey, serviceRoleKey };
}

async function verifyAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return { error: jsonError("Missing admin session token.", 401) };
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;

  if (authResult.error || !actorId) {
    return { error: jsonError("Invalid admin session.", 401) };
  }

  const actorResult = await userClient
    .from("users")
    .select("id, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (actorResult.error || !actorResult.data) {
    return { error: jsonError("Could not verify admin profile.", 403) };
  }

  const actor = actorResult.data;
  if (!["super_admin", "admin"].includes(actor.role) || actor.status !== "active" || actor.deleted_at) {
    return { error: jsonError("Only active admins can manage users.", 403) };
  }

  return { actor, actorId };
}

export async function POST(request: Request) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    email?: string;
    full_name?: string;
    company?: string;
    role?: string;
    status?: string;
  } | null;

  const email = body?.email?.trim().toLowerCase();
  const fullName = body?.full_name?.trim() || null;
  const company = body?.company?.trim() || null;
  const role = body?.role || ROLES.CUSTOMER;
  const status = body?.status || "active";

  if (!email || !email.includes("@")) {
    return jsonError("A valid email address is required.");
  }

  if (!isAppRole(role)) {
    return jsonError("Selected role is not valid.");
  }

  if (role === ROLES.SUPER_ADMIN && verified.actor.role !== ROLES.SUPER_ADMIN) {
    return jsonError("Only a super admin can create another super admin.", 403);
  }

  if (!userStatuses.has(status)) {
    return jsonError("Selected status is not valid.");
  }

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const temporaryPassword = `${crypto.randomUUID()}aA1!`;
  const created = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      company,
    },
  });

  if (created.error || !created.data.user) {
    return jsonError(created.error?.message || "Could not create auth user.", 400);
  }

  const userId = created.data.user.id;
  const profileResult = await adminClient
    .from("users")
    .update({
      email,
      full_name: fullName,
      company,
      role,
      status,
    })
    .eq("id", userId)
    .select("id, email, full_name, company, role, status, created_at, last_login_at, deleted_at")
    .single();

  if (profileResult.error) {
    return jsonError(profileResult.error.message, 400);
  }

  await adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "user_created",
    entity_type: "user",
    entity_id: userId,
    details: { email, role, status },
  });

  return NextResponse.json({ user: profileResult.data });
}

export async function PATCH(request: Request) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    user_id?: string;
    role?: string;
    status?: string;
  } | null;

  const userId = body?.user_id;
  const role = body?.role;
  const status = body?.status;

  if (!userId) {
    return jsonError("User id is required.");
  }

  if (!isAppRole(role)) {
    return jsonError("Selected role is not valid.");
  }

  if (!userStatuses.has(status || "")) {
    return jsonError("Selected status is not valid.");
  }

  if (role === ROLES.SUPER_ADMIN && verified.actor.role !== ROLES.SUPER_ADMIN) {
    return jsonError("Only a super admin can assign the super admin role.", 403);
  }

  if (verified.actorId === userId && status !== "active") {
    return jsonError("You cannot deactivate your own admin account.", 400);
  }

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await adminClient
    .from("users")
    .update({ role, status })
    .eq("id", userId)
    .select("id, email, full_name, company, role, status, created_at, last_login_at, deleted_at")
    .single();

  if (result.error) {
    return jsonError(result.error.message, 400);
  }

  await adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "user_access_updated",
    entity_type: "user",
    entity_id: userId,
    details: { role, status },
  });

  return NextResponse.json({ user: result.data });
}
