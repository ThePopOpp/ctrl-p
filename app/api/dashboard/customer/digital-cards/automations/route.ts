import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

// Preset automation templates — toggled on/off per card from the UI
export type PresetKey =
  | "lead_email"
  | "lead_sms"
  | "lead_followup"
  | "nfc_alert"
  | "qr_alert"
  | "payment_thankyou"
  | "auto_tag_source"
  | "subscription_welcome";

const PRESETS: Record<PresetKey, {
  name: string;
  description: string;
  trigger_type: string;
  action_type: string;
  action_data: Record<string, unknown>;
  delay_minutes: number;
}> = {
  lead_email: {
    name: "New lead — email me",
    description: "Send you an email whenever someone submits the lead form on your card.",
    trigger_type: "lead_submit",
    action_type: "send_email",
    action_data: { to: "owner", template: "lead_notification" },
    delay_minutes: 0,
  },
  lead_sms: {
    name: "New lead — text me",
    description: "Send you an SMS alert whenever a new lead comes in.",
    trigger_type: "lead_submit",
    action_type: "send_sms",
    action_data: { to: "owner", message: "New lead on {{card_name}}: {{lead_name}} ({{lead_email}})" },
    delay_minutes: 0,
  },
  lead_followup: {
    name: "Lead — 24h follow-up email",
    description: "Automatically email the lead 24 hours after they submit, keeping you top of mind.",
    trigger_type: "lead_submit",
    action_type: "send_email",
    action_data: { to: "lead", template: "lead_followup" },
    delay_minutes: 1440,
  },
  nfc_alert: {
    name: "NFC tap — alert me",
    description: "Get an email notification each time someone taps your NFC card.",
    trigger_type: "nfc_tap",
    action_type: "send_email",
    action_data: { to: "owner", template: "scan_alert" },
    delay_minutes: 0,
  },
  qr_alert: {
    name: "QR scan — alert me",
    description: "Get an email notification each time someone scans your QR code.",
    trigger_type: "qr_scan",
    action_type: "send_email",
    action_data: { to: "owner", template: "scan_alert" },
    delay_minutes: 0,
  },
  payment_thankyou: {
    name: "Payment received — thank-you email",
    description: "Send an automatic thank-you email to the customer after a Square payment is confirmed.",
    trigger_type: "payment_received",
    action_type: "send_email",
    action_data: { to: "lead", template: "payment_automation" },
    delay_minutes: 0,
  },
  auto_tag_source: {
    name: "Auto-tag lead by source",
    description: "Automatically tag new leads with their traffic source (QR scan, NFC tap, direct, etc.).",
    trigger_type: "lead_submit",
    action_type: "tag_lead",
    action_data: { auto_source: true },
    delay_minutes: 0,
  },
  subscription_welcome: {
    name: "Subscription activated — welcome email",
    description: "Send a welcome email when a Square subscription is successfully activated.",
    trigger_type: "subscription_activated",
    action_type: "send_email",
    action_data: { to: "lead", template: "payment_automation" },
    delay_minutes: 0,
  },
};

async function verifyCardOwner(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return { error: config.error };

  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { error: jsonError("Missing auth token.", 401) };

  const userClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const authResult = await userClient.auth.getUser(token);
  const userId = authResult.data.user?.id;
  if (!userId) return { error: jsonError("Invalid session.", 401) };

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { userId, adminClient };
}

// GET /api/dashboard/customer/digital-cards/automations?card_id=xxx
export async function GET(request: Request) {
  const { error, userId, adminClient } = await verifyCardOwner(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("card_id");
  if (!cardId) return jsonError("card_id required", 400);

  // Verify ownership
  const cardResult = await adminClient!
    .from("digital_cards")
    .select("id")
    .eq("id", cardId)
    .eq("user_id", userId!)
    .maybeSingle();
  if (!cardResult.data) return jsonError("Card not found.", 404);

  const [automationsResult, logsResult, leadsResult] = await Promise.all([
    adminClient!
      .from("automations")
      .select("id, name, preset_key, trigger_type, action_type, action_data, delay_minutes, enabled, last_run_at, run_count")
      .eq("digital_card_id", cardId)
      .order("created_at", { ascending: true }),
    adminClient!
      .from("automation_logs")
      .select("id, automation_id, status, error_message, executed_at, automations(name)")
      .in(
        "automation_id",
        (await adminClient!.from("automations").select("id").eq("digital_card_id", cardId)).data?.map((a) => a.id) ?? []
      )
      .order("executed_at", { ascending: false })
      .limit(20),
    adminClient!
      .from("digital_card_leads")
      .select("id, name, email, phone, company, message, status, source, tags, utm_source, utm_medium, utm_campaign, created_at, preferred_contact, notes, assigned_to")
      .eq("digital_card_id", cardId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    automations: automationsResult.data ?? [],
    logs: logsResult.data ?? [],
    leads: leadsResult.data ?? [],
    presets: PRESETS,
  });
}

// POST — toggle a preset on (creates or re-enables the automation record)
export async function POST(request: Request) {
  const { error, userId, adminClient } = await verifyCardOwner(request);
  if (error) return error;

  const body = await request.json().catch(() => null) as { card_id?: string; preset_key?: PresetKey } | null;
  const cardId = body?.card_id;
  const presetKey = body?.preset_key;
  if (!cardId || !presetKey || !PRESETS[presetKey]) return jsonError("card_id and preset_key required.", 400);

  const cardResult = await adminClient!
    .from("digital_cards")
    .select("id, user_id")
    .eq("id", cardId)
    .eq("user_id", userId!)
    .maybeSingle();
  if (!cardResult.data) return jsonError("Card not found.", 404);

  const preset = PRESETS[presetKey];

  // Upsert by digital_card_id + preset_key
  const existing = await adminClient!
    .from("automations")
    .select("id")
    .eq("digital_card_id", cardId)
    .eq("preset_key", presetKey)
    .maybeSingle();

  if (existing.data) {
    await adminClient!.from("automations").update({ enabled: true }).eq("id", existing.data.id);
    return NextResponse.json({ ok: true, id: existing.data.id });
  }

  const insertResult = await adminClient!.from("automations").insert({
    digital_card_id: cardId,
    preset_key: presetKey,
    name: preset.name,
    description: preset.description,
    trigger_type: preset.trigger_type,
    action_type: preset.action_type,
    action_data: preset.action_data,
    delay_minutes: preset.delay_minutes,
    trigger_conditions: {},
    enabled: true,
    created_by: userId,
  }).select("id").single();

  if (insertResult.error) return jsonError(insertResult.error.message, 400);
  return NextResponse.json({ ok: true, id: insertResult.data.id });
}

// PATCH — update a specific automation (toggle, message, delay)
export async function PATCH(request: Request) {
  const { error, userId, adminClient } = await verifyCardOwner(request);
  if (error) return error;

  const body = await request.json().catch(() => null) as {
    id?: string;
    card_id?: string;
    enabled?: boolean;
    action_data?: Record<string, unknown>;
    delay_minutes?: number;
    lead_id?: string;
    lead_patch?: { status?: string; notes?: string; tags?: string[]; assigned_to?: string | null };
  } | null;

  // Lead CRM patch
  if (body?.lead_id && body.lead_patch) {
    const patch: Record<string, unknown> = {};
    if (body.lead_patch.status    !== undefined) patch.status      = body.lead_patch.status;
    if (body.lead_patch.notes     !== undefined) patch.notes       = body.lead_patch.notes;
    if (body.lead_patch.tags      !== undefined) patch.tags        = body.lead_patch.tags;
    if (body.lead_patch.assigned_to !== undefined) patch.assigned_to = body.lead_patch.assigned_to;
    await adminClient!.from("digital_card_leads").update(patch).eq("id", body.lead_id);
    return NextResponse.json({ ok: true });
  }

  if (!body?.id || !body.card_id) return jsonError("id and card_id required.", 400);

  // Verify the automation belongs to this user's card
  const check = await adminClient!
    .from("automations")
    .select("id")
    .eq("id", body.id)
    .eq("digital_card_id", body.card_id)
    .maybeSingle();

  // Cross-check card ownership
  const cardCheck = await adminClient!
    .from("digital_cards")
    .select("id")
    .eq("id", body.card_id)
    .eq("user_id", userId!)
    .maybeSingle();

  if (!check.data || !cardCheck.data) return jsonError("Automation not found.", 404);

  const patch: Record<string, unknown> = {};
  if (body.enabled !== undefined) patch.enabled = body.enabled;
  if (body.action_data) patch.action_data = body.action_data;
  if (body.delay_minutes !== undefined) patch.delay_minutes = body.delay_minutes;

  await adminClient!.from("automations").update(patch).eq("id", body.id);
  return NextResponse.json({ ok: true });
}

// DELETE — disable (not delete) a preset automation
export async function DELETE(request: Request) {
  const { error, userId, adminClient } = await verifyCardOwner(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const automationId = searchParams.get("id");
  const cardId = searchParams.get("card_id");
  if (!automationId || !cardId) return jsonError("id and card_id required.", 400);

  const cardCheck = await adminClient!
    .from("digital_cards")
    .select("id")
    .eq("id", cardId)
    .eq("user_id", userId!)
    .maybeSingle();
  if (!cardCheck.data) return jsonError("Card not found.", 404);

  await adminClient!
    .from("automations")
    .update({ enabled: false })
    .eq("id", automationId)
    .eq("digital_card_id", cardId);

  return NextResponse.json({ ok: true });
}
