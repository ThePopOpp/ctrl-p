import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { loadInternalCards, loadSlotByKey } from "@/lib/products/queries";
import { placementSchedule, validatePlacement } from "@/lib/products/shape";
import type { DisplayMode, PlacementRow } from "@/lib/products/types";

// GET /api/slots/:slotKey/placements?contextId=… — the cards in a slot, in
// render order, with scheduled/expired states visible rather than filtered out.
export async function GET(request: Request, { params }: { params: Promise<{ slotKey: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { slotKey } = await params;
  const contextId = new URL(request.url).searchParams.get("contextId");
  const db = verified.adminClient;

  const slot = await loadSlotByKey(db, slotKey);
  if (!slot) return jsonError(`No slot registered under the key "${slotKey}".`, 404);

  let query = db.from("card_placements").select("*").eq("slot_id", slot.id).order("sort_order");
  query = contextId ? query.eq("context_id", contextId) : query.is("context_id", null);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 400);

  const placements = (data ?? []) as PlacementRow[];
  const cards = placements.length
    ? await loadInternalCards(db, { ids: placements.map((p) => p.card_id), status: "all", limit: placements.length })
    : [];

  return NextResponse.json({
    slot,
    placements: placements.map((placement) => ({
      ...placement,
      schedule: placementSchedule(placement),
      card: cards.find((c) => c.id === placement.card_id) ?? null,
    })),
    filled: placements.filter((p) => p.is_active).length,
  });
}

// POST /api/slots/:slotKey/placements — add a card to a slot.
export async function POST(request: Request, { params }: { params: Promise<{ slotKey: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { slotKey } = await params;
  const db = verified.adminClient;

  let body: {
    card_id?: string;
    context_id?: string | null;
    display_mode?: DisplayMode;
    sort_order?: number;
    title_override?: string | null;
    subtitle_override?: string | null;
    image_override_id?: string | null;
    variant_id?: string | null;
    cta_label?: string | null;
    cta_href?: string | null;
    badge_text?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  if (!body.card_id) return jsonError("card_id is required.");

  const slot = await loadSlotByKey(db, slotKey);
  if (!slot) return jsonError(`No slot registered under the key "${slotKey}".`, 404);

  const contextId = body.context_id ?? null;
  if (slot.context_type && !contextId) {
    return jsonError(`${slot.label} is a per-${slot.context_type} slot — contextId is required.`);
  }
  if (!slot.context_type && contextId) {
    return jsonError(`${slot.label} is a global slot and does not take a contextId.`);
  }

  const displayMode = body.display_mode ?? slot.allowed_display_modes[0];

  const [cards, occupantsResult] = await Promise.all([
    loadInternalCards(db, { ids: [body.card_id], status: "all", limit: 1 }),
    db
      .from("card_placements")
      .select("id, card_id, sort_order")
      .eq("slot_id", slot.id)
      .eq("is_active", true)
      .filter("context_id", contextId === null ? "is" : "eq", contextId === null ? null : contextId),
  ]);

  const card = cards[0];
  if (!card) return jsonError("Card not found.", 404);

  const occupantRows = (occupantsResult.data ?? []) as Array<{ id: string; card_id: string; sort_order: number }>;

  if (occupantRows.some((o) => o.card_id === body.card_id)) {
    return jsonError(`"${card.title}" is already in ${slot.label}.`, 409);
  }

  const occupantCards = occupantRows.length
    ? await loadInternalCards(db, { ids: occupantRows.map((o) => o.card_id), status: "all", limit: occupantRows.length })
    : [];

  const violations = validatePlacement({
    slot,
    status: card.status,
    displayMode,
    currentFill: occupantRows.length,
    occupants: occupantRows.map((o) => ({
      title: occupantCards.find((c) => c.id === o.card_id)?.title ?? "an existing card",
      sortOrder: o.sort_order,
    })),
  });

  if (violations.length) {
    return NextResponse.json({ error: violations[0].message, violations }, { status: 422 });
  }

  if (!slot.supports_scheduling && (body.starts_at || body.ends_at)) {
    return jsonError(`${slot.label} does not support scheduled placements.`);
  }

  const nextSort = body.sort_order ?? occupantRows.reduce((max, o) => Math.max(max, o.sort_order + 1), 0);

  const insert = await db
    .from("card_placements")
    .insert({
      card_id: body.card_id,
      slot_id: slot.id,
      context_id: contextId,
      display_mode: displayMode,
      sort_order: nextSort,
      title_override: body.title_override ?? null,
      subtitle_override: body.subtitle_override ?? null,
      image_override_id: body.image_override_id ?? null,
      variant_id: body.variant_id ?? null,
      cta_label: body.cta_label ?? null,
      cta_href: body.cta_href ?? null,
      badge_text: body.badge_text ?? null,
      starts_at: body.starts_at ?? null,
      ends_at: body.ends_at ?? null,
      created_by: verified.actorId,
    })
    .select("*")
    .single();

  if (insert.error) return jsonError(insert.error.message, 400);

  return NextResponse.json({ placement: insert.data, slot }, { status: 201 });
}
