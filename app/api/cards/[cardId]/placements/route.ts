import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { loadInternalCard, loadPlacementsForCard, loadSlotFillCounts } from "@/lib/products/queries";
import { placementSchedule, validateAudienceStatus, validateDisplayMode } from "@/lib/products/shape";

// GET /api/cards/:cardId/placements
// The "from a card" view: every slot the card could go into, grouped by
// surface, with the current placement (if any) and why a slot is unavailable.
export async function GET(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId } = await params;
  const db = verified.adminClient;

  try {
    const card = await loadInternalCard(db, cardId);
    if (!card) return jsonError("Card not found.", 404);

    const [{ placements, slots }, fill] = await Promise.all([
      loadPlacementsForCard(db, cardId),
      loadSlotFillCounts(db),
    ]);

    const rows = slots
      .filter((slot) => slot.is_active)
      .map((slot) => {
        const placed = placements.filter((p) => p.slot_id === slot.id);
        const statusViolation = validateAudienceStatus(slot, card.status);
        const filled = fill[slot.id] ?? 0;

        return {
          slot,
          filled,
          full: filled >= slot.max_items && !placed.some((p) => p.is_active),
          // A slot the card cannot enter is shown with the reason rather than
          // hidden — "why can't I feature this" should not need a support ticket.
          unavailableReason: statusViolation?.message ?? null,
          allowedDisplayModes: slot.allowed_display_modes.filter((mode) => !validateDisplayMode(slot, mode)),
          placements: placed.map((placement) => ({ ...placement, schedule: placementSchedule(placement) })),
        };
      });

    const bySurface = {
      storefront: rows.filter((r) => r.slot.surface === "storefront"),
      landing: rows.filter((r) => r.slot.surface === "landing"),
      dashboard: rows.filter((r) => r.slot.surface === "dashboard"),
    };

    return NextResponse.json({
      card: { id: card.id, title: card.title, status: card.status, slug: card.slug },
      slots: rows,
      bySurface,
      activeCount: placements.filter((p) => p.is_active).length,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load placements.", 500);
  }
}
