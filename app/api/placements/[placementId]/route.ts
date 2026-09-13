import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { loadInternalCards, loadSlots } from "@/lib/products/queries";
import { placementSchedule, validateDisplayMode, validateAudienceStatus } from "@/lib/products/shape";
import type { DisplayMode, PlacementRow, SlotRow } from "@/lib/products/types";

const OVERRIDE_FIELDS = [
  "title_override",
  "subtitle_override",
  "image_override_id",
  "variant_id",
  "cta_label",
  "cta_href",
  "badge_text",
  "starts_at",
  "ends_at",
  "is_active",
  "sort_order",
] as const;

// PATCH /api/placements/:placementId — overrides, display mode, schedule.
export async function PATCH(request: Request, { params }: { params: Promise<{ placementId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { placementId } = await params;
  const db = verified.adminClient;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const existing = await db.from("card_placements").select("*").eq("id", placementId).maybeSingle();
  if (existing.error) return jsonError(existing.error.message, 400);
  if (!existing.data) return jsonError("Placement not found.", 404);

  const placement = existing.data as PlacementRow;
  const slots = await loadSlots(db);
  const slot = slots.find((s) => s.id === placement.slot_id) as SlotRow | undefined;
  if (!slot) return jsonError("The slot this placement points at no longer exists.", 409);

  const update: Record<string, unknown> = {};
  for (const field of OVERRIDE_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  if (body.display_mode !== undefined) {
    const violation = validateDisplayMode(slot, body.display_mode as DisplayMode);
    if (violation) return NextResponse.json({ error: violation.message, violations: [violation] }, { status: 422 });
    update.display_mode = body.display_mode;
  }

  if (!slot.supports_scheduling && (update.starts_at || update.ends_at)) {
    return jsonError(`${slot.label} does not support scheduled placements.`);
  }

  if (update.starts_at && update.ends_at && String(update.ends_at) <= String(update.starts_at)) {
    return jsonError("The end of the schedule window must come after its start.");
  }

  // Reactivating is the moment to re-check status — the card may have been
  // unpublished while this placement sat inactive.
  if (update.is_active === true && placement.is_active === false) {
    const [card] = await loadInternalCards(db, { ids: [placement.card_id], status: "all", limit: 1 });
    if (!card) return jsonError("Card not found.", 404);
    const violation = validateAudienceStatus(slot, card.status);
    if (violation) return NextResponse.json({ error: violation.message, violations: [violation] }, { status: 422 });

    const { count } = await db
      .from("card_placements")
      .select("id", { count: "exact", head: true })
      .eq("slot_id", slot.id)
      .eq("is_active", true)
      .filter("context_id", placement.context_id === null ? "is" : "eq", placement.context_id);

    if ((count ?? 0) >= slot.max_items) {
      return NextResponse.json(
        { error: `${slot.label} holds ${slot.max_items} card${slot.max_items === 1 ? "" : "s"} and is full. Remove one before reactivating this placement.` },
        { status: 422 },
      );
    }
  }

  if (!Object.keys(update).length) return jsonError("Nothing to update.");

  update.updated_at = new Date().toISOString();
  const result = await db.from("card_placements").update(update).eq("id", placementId).select("*").maybeSingle();
  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({
    placement: { ...result.data, schedule: placementSchedule(result.data as PlacementRow) },
    slot,
  });
}

// DELETE /api/placements/:placementId — remove a card from a slot. This does
// not touch the card itself; placement and status are separate concepts.
export async function DELETE(request: Request, { params }: { params: Promise<{ placementId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { placementId } = await params;

  const result = await verified.adminClient
    .from("card_placements")
    .delete()
    .eq("id", placementId)
    .select("id, card_id, slot_id")
    .maybeSingle();

  if (result.error) return jsonError(result.error.message, 400);
  if (!result.data) return jsonError("Placement not found.", 404);

  return NextResponse.json({ removed: result.data });
}
