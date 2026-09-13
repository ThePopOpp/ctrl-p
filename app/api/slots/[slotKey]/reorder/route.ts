import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { loadSlotByKey } from "@/lib/products/queries";

// PATCH /api/slots/:slotKey/reorder — bulk sort_order update behind drag-to-reorder.
// Body: { placement_ids: string[] } in the new render order.
export async function PATCH(request: Request, { params }: { params: Promise<{ slotKey: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { slotKey } = await params;
  const db = verified.adminClient;

  let body: { placement_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const ids = (body.placement_ids ?? []).filter(Boolean);
  if (!ids.length) return jsonError("placement_ids is required.");

  const slot = await loadSlotByKey(db, slotKey);
  if (!slot) return jsonError(`No slot registered under the key "${slotKey}".`, 404);

  // Every id must belong to this slot — a reorder must not be a way to move a
  // placement between slots and skip the capacity and audience checks.
  const { data, error } = await db.from("card_placements").select("id").eq("slot_id", slot.id).in("id", ids);
  if (error) return jsonError(error.message, 400);

  const owned = new Set((data ?? []).map((row) => row.id as string));
  const foreign = ids.filter((id) => !owned.has(id));
  if (foreign.length) return jsonError(`${foreign.length} placement(s) do not belong to ${slot.label}.`, 400);

  for (let index = 0; index < ids.length; index += 1) {
    const { error: updateError } = await db
      .from("card_placements")
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq("id", ids[index]);
    if (updateError) return jsonError(updateError.message, 400);
  }

  return NextResponse.json({ reordered: ids.length });
}
