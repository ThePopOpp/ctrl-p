import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

import { isAppRole, ROLES } from "@/lib/rbac/roles";

const userStatuses = new Set(["active", "pending", "inactive", "suspended"]);

function env(name: string) {
  return process.env[name] || "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function boolEnv(name: string) {
  return ["true", "1"].includes(env(name).toLowerCase());
}

function smtpReady() {
  return Boolean(env("SMTP_HOST") && env("SMTP_PORT") && env("SMTP_USER") && env("SMTP_PASSWORD"));
}

async function sendInviteEmail(input: {
  email: string;
  fullName: string | null;
  actionLink: string;
  role: string;
}) {
  if (!smtpReady()) {
    return { error: "SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD are required to send branded invite emails." };
  }

  const from = env("EMAIL_FROM") || env("SMTP_USER");
  const transporter = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") || 465),
    secure: boolEnv("SMTP_SECURE") || Number(env("SMTP_PORT")) === 465,
    auth: {
      user: env("SMTP_USER"),
      pass: env("SMTP_PASSWORD"),
    },
  });

  const name = input.fullName || input.email;
  const subject = "You're invited to ControlP.io";
  const text = [
    `Hi ${name},`,
    "",
    `You've been invited to ControlP.io as ${input.role.replace(/_/g, " ")}.`,
    "Use this secure link to accept the invite and finish setting up your account:",
    input.actionLink,
    "",
    "If you were not expecting this invite, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 12px">You're invited to ControlP.io</h2>
      <p>Hi ${name},</p>
      <p>You've been invited to ControlP.io as <strong>${input.role.replace(/_/g, " ")}</strong>.</p>
      <p><a href="${input.actionLink}" style="display:inline-block;background:#111827;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Accept invite</a></p>
      <p style="font-size:13px;color:#6b7280">If the button does not work, paste this link into your browser:<br>${input.actionLink}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from,
      replyTo: env("EMAIL_REPLY_TO") || from,
      to: input.email,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invite email failed to send." };
  }
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
    send_invite?: boolean;
  } | null;

  const email = body?.email?.trim().toLowerCase();
  const fullName = body?.full_name?.trim() || null;
  const company = body?.company?.trim() || null;
  const role = body?.role || ROLES.CUSTOMER;
  const status = body?.status || "active";
  const sendInvite = Boolean(body?.send_invite);

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

  const appUrl = env("PUBLIC_APP_URL") || "https://my.controlp.io";
  const redirectTo = `${appUrl.replace(/\/$/, "")}/login`;
  let inviteLinkType: "invite" | "recovery" = "invite";
  let created = sendInvite
    ? await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo,
          data: {
            full_name: fullName,
            company,
          },
        },
      })
    : await adminClient.auth.admin.createUser({
        email,
        password: `${crypto.randomUUID()}aA1!`,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          company,
        },
      });

  if (sendInvite && created.error && /already|registered|exists/i.test(created.error.message)) {
    inviteLinkType = "recovery";
    created = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
  }

  if (created.error || !created.data.user) {
    const detail = created.error?.message || "Could not create auth user.";
    return jsonError(sendInvite ? `Could not generate invite link: ${detail}` : detail, 400);
  }

  if (sendInvite) {
    const properties = "properties" in created.data ? created.data.properties as { action_link?: string } : null;
    const actionLink = properties?.action_link || "";
    if (!actionLink) {
      return jsonError("Supabase did not return an invite link.", 400);
    }

    const emailResult = await sendInviteEmail({ email, fullName, actionLink, role });
    if (emailResult.error) {
      return jsonError(`Invite user was created, but the invite email failed: ${emailResult.error}`, 502);
    }
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
    action: sendInvite ? "user_invited" : "user_created",
    entity_type: "user",
    entity_id: userId,
    details: { email, role, status, send_invite: sendInvite, invite_link_type: sendInvite ? inviteLinkType : null },
  });

  return NextResponse.json({ user: profileResult.data, invited: sendInvite, delivery: sendInvite ? "smtp" : "created", invite_link_type: sendInvite ? inviteLinkType : null });
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

export async function DELETE(request: Request) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    user_id?: string;
    hard_delete_auth?: boolean;
  } | null;

  const userId = body?.user_id;
  if (!userId) {
    return jsonError("User id is required.");
  }

  if (verified.actorId === userId) {
    return jsonError("You cannot remove your own admin account.", 400);
  }

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await adminClient
    .from("users")
    .select("id, email, role, status, deleted_at")
    .eq("id", userId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return jsonError(existing.error?.message || "User not found.", 404);
  }

  if (existing.data.role === ROLES.SUPER_ADMIN && verified.actor.role !== ROLES.SUPER_ADMIN) {
    return jsonError("Only a super admin can remove another super admin.", 403);
  }

  const removedAt = new Date().toISOString();
  const result = await adminClient
    .from("users")
    .update({
      status: "suspended",
      deleted_at: removedAt,
    })
    .eq("id", userId)
    .select("id, email, full_name, company, role, status, created_at, last_login_at, deleted_at")
    .single();

  if (result.error) {
    return jsonError(result.error.message, 400);
  }

  let authDeleted = false;
  let authDeleteError: string | null = null;
  if (body?.hard_delete_auth !== false) {
    const authResult = await adminClient.auth.admin.deleteUser(userId);
    authDeleted = !authResult.error;
    authDeleteError = authResult.error?.message || null;
  }

  await adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "user_removed",
    entity_type: "user",
    entity_id: userId,
    details: {
      email: existing.data.email,
      role: existing.data.role,
      removed_at: removedAt,
      auth_deleted: authDeleted,
      auth_delete_error: authDeleteError,
    },
  });

  return NextResponse.json({ user: result.data, auth_deleted: authDeleted, auth_delete_error: authDeleteError });
}
