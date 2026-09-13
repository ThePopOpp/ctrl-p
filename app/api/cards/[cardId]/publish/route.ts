import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { loadInternalCard, recalcCardPricing } from "@/lib/products/queries";
import { canPublish, missingChecklistItems, publishChecklist } from "@/lib/products/shape";
import type { CardStatus } from "@/lib/products/types";

// POST /api/cards/:cardId/publish
// Body: { status?: 'ready' | 'published' | 'draft' }
//
// Validates the checklist and reports WHICH items are missing rather than a
// generic error. The matching DB trigger is the backstop for direct SQL writes.
export async function POST(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId } = await params;
  const db = verified.adminClient;

  let target: CardStatus = "published";
  try {
    const body = await request.json();
    if (body?.status) target = body.status as CardStatus;
  } catch {
    // An empty body means "publish" — the common case from the dashboard toggle.
  }

  if (!["draft", "ready", "published"].includes(target)) {
    return jsonError("status must be draft, ready or published.");
  }

  // Prices are cached; publish against a stale cache would ship a wrong number.
  await recalcCardPricing(db, cardId);

  const card = await loadInternalCard(db, cardId);
  if (!card) return jsonError("Card not found.", 404);

  const checklist = publishChecklist(card);

  if (target === "published" && !canPublish(card)) {
    const missing = missingChecklistItems(card);
    return NextResponse.json(
      {
        error: `Cannot publish "${card.title}" yet — ${missing.length} item${missing.length === 1 ? "" : "s"} outstanding.`,
        missing,
        checklist,
      },
      { status: 422 },
    );
  }

  const update: Record<string, unknown> = { status: target, updated_at: new Date().toISOString() };
  if (target === "published") update.published_at = card.published_at ?? new Date().toISOString();

  const result = await db.from("product_cards").update(update).eq("id", cardId).select("id, status, published_at").maybeSingle();
  if (result.error) return jsonError(result.error.message, 400);

  // Dropping out of Published pulls the card from public placements; leaving
  // them active would render a card the storefront query no longer returns.
  let placementsRemoved = 0;
  if (target !== "published") {
    const { data } = await db
      .from("card_placements")
      .update({ is_active: false })
      .eq("card_id", cardId)
      .eq("is_active", true)
      .select("id");
    placementsRemoved = data?.length ?? 0;
  }

  const updated = await loadInternalCard(db, cardId);
  return NextResponse.json({
    card: updated,
    checklist: updated ? publishChecklist(updated) : checklist,
    placementsRemoved,
  });
}
