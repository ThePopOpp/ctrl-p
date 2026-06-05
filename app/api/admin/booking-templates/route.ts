import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) return auth.error;

  const result = await auth.adminClient
    .from("booking_notification_templates")
    .select("id, name, channel, notification_type, subject, body, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ templates: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null) as {
    name?: string;
    channel?: string;
    notification_type?: string;
    subject?: string;
    body?: string;
    is_active?: boolean;
  } | null;

  const name = body?.name?.trim();
  const channel = body?.channel?.trim();
  const notificationType = body?.notification_type?.trim();
  const templateBody = body?.body?.trim();

  if (!name) return jsonError("Template name is required.");
  if (!channel || !["email", "sms"].includes(channel)) return jsonError("Channel must be email or sms.");
  if (!notificationType) return jsonError("Notification type is required.");
  if (!templateBody) return jsonError("Template body is required.");
  if (channel === "email" && !body?.subject?.trim()) return jsonError("Subject is required for email templates.");

  const result = await auth.adminClient
    .from("booking_notification_templates")
    .insert({
      name,
      channel,
      notification_type: notificationType,
      subject: channel === "email" ? body?.subject?.trim() || null : null,
      body: templateBody,
      is_active: body?.is_active !== false,
    })
    .select("id, name, channel, notification_type, subject, body, is_active, created_at, updated_at")
    .single();

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ template: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null) as {
    id?: string;
    name?: string;
    channel?: string;
    notification_type?: string;
    subject?: string;
    body?: string;
    is_active?: boolean;
  } | null;

  const id = body?.id?.trim();
  if (!id) return jsonError("Template ID is required.");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.name?.trim()) patch.name = body.name.trim();
  if (body?.channel?.trim()) patch.channel = body.channel.trim();
  if (body?.notification_type?.trim()) patch.notification_type = body.notification_type.trim();
  if (body?.subject !== undefined) patch.subject = body.subject?.trim() || null;
  if (body?.body?.trim()) patch.body = body.body.trim();
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  const result = await auth.adminClient
    .from("booking_notification_templates")
    .update(patch)
    .eq("id", id)
    .select("id, name, channel, notification_type, subject, body, is_active, created_at, updated_at")
    .single();

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ template: result.data });
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) return jsonError("Template ID is required.");

  const result = await auth.adminClient
    .from("booking_notification_templates")
    .delete()
    .eq("id", id);

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ success: true });
}
