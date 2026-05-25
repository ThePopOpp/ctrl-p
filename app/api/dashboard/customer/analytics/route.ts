import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

function clean(value: unknown) {
  return String(value || "").trim();
}

async function verifyCustomerRequest(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return { error: config.error };

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return { error: jsonError("Missing customer session token.", 401) };

  const userClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return { error: jsonError("Invalid customer session.", 401) };

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const profileResult = await adminClient
    .from("users")
    .select("id, email, full_name, phone, company, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return { error: jsonError("Customer profile not found.", 404) };
  if (profileResult.data.deleted_at || !["active", "pending"].includes(clean(profileResult.data.status))) {
    return { error: jsonError("Your account is not active.", 403) };
  }

  return { actorId, profile: profileResult.data, adminClient };
}

export async function GET(request: Request) {
  const verified = await verifyCustomerRequest(request);
  if (verified.error) return verified.error;

  const cardsResult = await verified.adminClient
    .from("digital_cards")
    .select("id, card_name, slug, status, is_public, view_count, click_count, updated_at")
    .eq("user_id", verified.actorId)
    .order("updated_at", { ascending: false });

  if (cardsResult.error) return jsonError(cardsResult.error.message, 400);

  const cards = cardsResult.data ?? [];
  const cardIds = cards.map((card) => card.id);

  const [eventsResult, leadsResult] = cardIds.length
    ? await Promise.all([
        verified.adminClient
          .from("digital_card_events")
          .select("id, digital_card_id, event_type, device_type, source, created_at")
          .in("digital_card_id", cardIds)
          .order("created_at", { ascending: false })
          .limit(1000),
        verified.adminClient
          .from("digital_card_leads")
          .select("id, digital_card_id, name, email, phone, company, message, status, created_at")
          .in("digital_card_id", cardIds)
          .order("created_at", { ascending: false })
          .limit(100),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (eventsResult.error) return jsonError(eventsResult.error.message, 400);
  if (leadsResult.error) return jsonError(leadsResult.error.message, 400);

  const events = eventsResult.data ?? [];
  const totals = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {});
  const devices = events.reduce<Record<string, number>>((acc, event) => {
    const key = event.device_type || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    profile: verified.profile,
    cards,
    events,
    leads: leadsResult.data ?? [],
    totals: {
      views: cards.reduce((sum, card) => sum + Number(card.view_count || 0), 0) + Number(totals.view || 0),
      shares: Number(totals.share || 0),
      likes: Number(totals.like || 0),
      qrScans: Number(totals.qr_scan || 0),
      linkClicks: Number(totals.link_click || 0),
      copyLinks: Number(totals.copy_link || 0),
      savedContacts: Number(totals.save_contact || 0),
      leads: (leadsResult.data ?? []).length,
    },
    devices,
  });
}
