import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";
import { runCardAutomations } from "@/lib/automations/runner";

const EVENT_TYPES = new Set(["view", "share", "like", "qr_scan", "nfc_tap", "link_click", "copy_link", "save_contact", "lead_submit"]);

function clean(value: unknown) {
  return String(value || "").trim();
}

function deviceType(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (/ipad|tablet/.test(value)) return "tablet";
  if (/mobi|iphone|android/.test(value)) return "mobile";
  return "desktop";
}

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const body = await request.json().catch(() => null) as {
    card_id?: string;
    slug?: string;
    link_id?: string;
    event_type?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  } | null;

  const eventType = clean(body?.event_type);
  if (!EVENT_TYPES.has(eventType)) return jsonError("Unsupported digital card event type.", 400);

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let cardId = clean(body?.card_id);
  let ownerId: string | null = null;

  if (!cardId && body?.slug) {
    const cardResult = await adminClient
      .from("digital_cards")
      .select("id, user_id")
      .eq("slug", clean(body.slug))
      .eq("is_public", true)
      .eq("status", "published")
      .maybeSingle();

    if (cardResult.error) return jsonError(cardResult.error.message, 400);
    cardId = cardResult.data?.id || "";
    ownerId = cardResult.data?.user_id || null;
  } else if (cardId) {
    const cardResult = await adminClient
      .from("digital_cards")
      .select("id, user_id")
      .eq("id", cardId)
      .eq("is_public", true)
      .eq("status", "published")
      .maybeSingle();

    if (cardResult.error) return jsonError(cardResult.error.message, 400);
    ownerId = cardResult.data?.user_id || null;
  }

  if (!cardId) return jsonError("Published digital card not found.", 404);

  const userAgent = request.headers.get("user-agent") || "";
  const insertResult = await adminClient.from("digital_card_events").insert({
    digital_card_id: cardId,
    user_id: ownerId,
    link_id: clean(body?.link_id) || null,
    event_type: eventType,
    source: clean(body?.source) || "public_card",
    device_type: deviceType(userAgent),
    referrer: request.headers.get("referer") || null,
    user_agent: userAgent || null,
    metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
  });

  if (insertResult.error) return jsonError(insertResult.error.message, 400);

  // Fire automations for scan events (non-blocking)
  if (eventType === "nfc_tap" || eventType === "qr_scan") {
    const slugResult = await adminClient.from("digital_cards").select("slug").eq("id", cardId).maybeSingle();
    runCardAutomations(adminClient, eventType, {
      card_id: cardId,
      card_owner_id: ownerId || undefined,
      card_slug: slugResult.data?.slug,
      event_type: eventType,
      device_type: deviceType(userAgent),
      lead_source: eventType,
    }).catch(() => { /* non-fatal */ });
  }

  return NextResponse.json({ ok: true });
}
