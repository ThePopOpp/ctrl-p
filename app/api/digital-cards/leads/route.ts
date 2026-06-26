import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";
import { runCardAutomations } from "@/lib/automations/runner";

function clean(value: unknown) {
  return String(value || "").trim();
}

function nullable(value: unknown) {
  const text = clean(value);
  return text || null;
}

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const body = await request.json().catch(() => null) as {
    card_id?: string;
    slug?: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    message?: string;
    preferred_contact?: string;
    fields?: Record<string, unknown>;
  } | null;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let card = null as { id: string; user_id: string | null; display_name?: string | null; card_name?: string | null } | null;

  if (body?.card_id) {
    const result = await adminClient
      .from("digital_cards")
      .select("id, user_id, display_name, card_name")
      .eq("id", clean(body.card_id))
      .eq("is_public", true)
      .eq("status", "published")
      .maybeSingle();
    if (result.error) return jsonError(result.error.message, 400);
    card = result.data;
  } else if (body?.slug) {
    const result = await adminClient
      .from("digital_cards")
      .select("id, user_id, display_name, card_name")
      .eq("slug", clean(body.slug))
      .eq("is_public", true)
      .eq("status", "published")
      .maybeSingle();
    if (result.error) return jsonError(result.error.message, 400);
    card = result.data;
  }

  if (!card) return jsonError("Published digital card not found.", 404);

  const name = nullable(body?.name);
  const email = nullable(body?.email);
  const phone = nullable(body?.phone);
  const message = nullable(body?.message);
  if (!name && !email && !phone && !message) return jsonError("Add at least one lead field before submitting.", 400);

  const source = nullable(body?.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>).source : null) || "public_card";

  const leadResult = await adminClient.from("digital_card_leads").insert({
    digital_card_id: card.id,
    owner_user_id: card.user_id,
    name,
    email,
    phone,
    company: nullable(body?.company),
    message,
    preferred_contact: nullable(body?.preferred_contact),
    source,
    utm_source: nullable(body?.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>).utm_source : null),
    utm_medium: nullable(body?.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>).utm_medium : null),
    utm_campaign: nullable(body?.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>).utm_campaign : null),
    payload: body?.fields && typeof body.fields === "object" ? body.fields : {},
  }).select("id").single();

  if (leadResult.error) return jsonError(leadResult.error.message, 400);

  await adminClient.from("digital_card_events").insert({
    digital_card_id: card.id,
    user_id: card.user_id,
    event_type: "lead_submit",
    source,
    device_type: "unknown",
    metadata: { card_name: card.display_name || card.card_name },
  });

  // Fire card automations (non-blocking — failures don't affect the lead submission)
  const slug = await adminClient.from("digital_cards").select("slug").eq("id", card.id).maybeSingle();
  runCardAutomations(adminClient, "lead_submit", {
    card_id: card.id,
    card_name: card.display_name || card.card_name || "",
    card_owner_id: card.user_id || undefined,
    card_slug: slug.data?.slug,
    lead_id: leadResult.data.id,
    lead_name: name,
    lead_email: email,
    lead_phone: phone,
    lead_message: message,
    lead_company: nullable(body?.company),
    lead_source: source,
  }).catch(() => { /* non-fatal */ });

  return NextResponse.json({ ok: true });
}
