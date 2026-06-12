import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

import { isAppRole } from "@/lib/rbac/roles";

const VALID_STATUSES = new Set(["active", "pending", "suspended", "inactive"]);

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

function getSupabaseEnv() {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey) return { error: jsonError("Supabase public environment variables are not configured.", 500) };
  if (!serviceRoleKey) return { error: jsonError("SUPABASE_SERVICE_ROLE_KEY is required.", 501) };
  return { supabaseUrl, publishableKey, serviceRoleKey };
}

async function verifyAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return { error: jsonError("Missing admin session token.", 401) };

  const userClient = createClient(supabaseUrl, publishableKey, {
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
  if (!["super_admin", "admin"].includes(actor.role) || actor.status !== "active" || actor.deleted_at) {
    return { error: jsonError("Only active admins can import users.", 403) };
  }
  return { actor, actorId };
}

async function sendInviteEmail(input: {
  email: string;
  fullName: string | null;
  actionLink: string;
  role: string;
  appUrl: string;
}) {
  if (!smtpReady()) return { skipped: true };
  const from = env("EMAIL_FROM") || env("SMTP_USER");
  const transporter = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") || 465),
    secure: boolEnv("SMTP_SECURE") || Number(env("SMTP_PORT")) === 465,
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") },
  });
  const name = input.fullName || input.email;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <div style="margin:0 0 24px"><img src="${input.appUrl}/logos/ctrl-p-logo-dark.svg" alt="ControlP.io" width="180" /></div>
      <h2 style="margin:0 0 12px">You're invited to ControlP.io</h2>
      <p>Hi ${name},</p>
      <p>You've been invited to ControlP.io as <strong>${input.role.replace(/_/g, " ")}</strong>.</p>
      <p><a href="${input.actionLink}" style="display:inline-block;background:#111827;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Accept invite</a></p>
      <p style="font-size:13px;color:#6b7280">If the button does not work, paste this link:<br>${input.actionLink}</p>
    </div>`;
  try {
    await transporter.sendMail({
      from,
      replyTo: env("EMAIL_REPLY_TO") || from,
      to: input.email,
      subject: "You're invited to ControlP.io",
      text: `Hi ${name},\n\nYou've been invited to ControlP.io as ${input.role.replace(/_/g, " ")}.\n\nAccept your invite: ${input.actionLink}`,
      html,
    });
    return { sent: true };
  } catch {
    return { sent: false };
  }
}

export type ImportUserRow = {
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone?: string;
  company?: string;
  role?: string;
  status?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  profile_photo_url?: string;
};

export type ImportUserResult = {
  row: number;
  email: string;
  full_name: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
  user_id?: string;
};

export async function POST(request: Request) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    rows?: ImportUserRow[];
    default_role?: string;
    send_invites?: boolean;
    skip_existing?: boolean;
  } | null;

  if (!body?.rows?.length) return jsonError("No rows to import.", 400);
  if (body.rows.length > 500) return jsonError("Maximum 500 rows per import.", 400);

  const defaultRole = isAppRole(body.default_role ?? "") ? (body.default_role as string) : "customer";
  const sendInvites = !!body.send_invites;
  const skipExisting = body.skip_existing !== false;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const appUrl = (() => {
    const configured = env("PUBLIC_APP_URL");
    return configured && !/localhost|127\.0\.0\.1/i.test(configured) ? configured.replace(/\/$/, "") : "https://my.controlp.io";
  })();

  const results: ImportUserResult[] = [];

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i];
    const email = String(row.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ row: i + 1, email: email || "(blank)", full_name: "", success: false, error: "Invalid email address" });
      continue;
    }

    // Compute full_name
    let fullName = String(row.full_name || "").trim();
    if (!fullName) {
      const first = String(row.first_name || "").trim();
      const last = String(row.last_name || "").trim();
      fullName = [first, last].filter(Boolean).join(" ");
    }

    const rowRole = String(row.role || "").trim().toLowerCase();
    const role = isAppRole(rowRole) ? rowRole : defaultRole;
    const rowStatus = String(row.status || "").trim().toLowerCase();
    const status = sendInvites ? "pending" : (VALID_STATUSES.has(rowStatus) ? rowStatus : "active");

    // Address fields collected into metadata for future use
    const addressMeta = {
      address_line1: String(row.address_line1 || "").trim() || null,
      address_line2: String(row.address_line2 || "").trim() || null,
      city: String(row.city || "").trim() || null,
      state: String(row.state || "").trim() || null,
      zip: String(row.zip || "").trim() || null,
      country: String(row.country || "").trim() || null,
    };
    const hasAddress = Object.values(addressMeta).some(Boolean);

    try {
      // Check if user already exists
      const existing = await adminClient
        .from("users")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

      if (existing.data?.id) {
        if (skipExisting) {
          results.push({ row: i + 1, email, full_name: fullName, success: false, skipped: true, error: "Already exists — skipped" });
        } else {
          // Update the existing user's profile
          await adminClient.from("users").update({
            full_name: fullName || null,
            phone: String(row.phone || "").trim().replace(/[^\d+]/g, "") || null,
            company: String(row.company || "").trim() || null,
            role,
            status,
            ...(hasAddress ? { address: addressMeta } : {}),
          }).eq("id", existing.data.id);
          results.push({ row: i + 1, email, full_name: fullName, success: true, user_id: existing.data.id });
        }
        continue;
      }

      // Create new auth user
      let authUserId: string;
      let inviteLink: string | null = null;

      if (sendInvites) {
        const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName, role },
        });
        if (error || !data.user) throw new Error(error?.message || "Could not create auth user");
        authUserId = data.user.id;
        inviteLink = data.user.action_link ?? null;
      } else {
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, role },
        });
        if (error || !data.user) throw new Error(error?.message || "Could not create auth user");
        authUserId = data.user.id;
      }

      // Upsert profile in public.users
      await adminClient.from("users").upsert({
        id: authUserId,
        email,
        full_name: fullName || null,
        phone: String(row.phone || "").trim().replace(/[^\d+]/g, "") || null,
        company: String(row.company || "").trim() || null,
        role,
        status,
        ...(hasAddress ? { address: addressMeta } : {}),
        ...(row.profile_photo_url ? { avatar_url: String(row.profile_photo_url).trim() } : {}),
      });

      // Send invite email if we have an invite link
      if (sendInvites && inviteLink) {
        await sendInviteEmail({ email, fullName, actionLink: inviteLink, role, appUrl });
      }

      // Activity log (non-fatal)
      try {
        await adminClient.from("activity_logs").insert({
          actor_id: verified.actorId,
          action: sendInvites ? "user_invited" : "user_created",
          entity_type: "user",
          entity_id: authUserId,
          details: { email, role, source: "csv_import" },
        });
      } catch { /* non-fatal */ }

      results.push({ row: i + 1, email, full_name: fullName, success: true, user_id: authUserId });
    } catch (err) {
      results.push({
        row: i + 1,
        email,
        full_name: fullName,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success && !r.skipped).length;

  return NextResponse.json({ results, succeeded, skipped, failed });
}
