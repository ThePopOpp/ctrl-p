import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { loadSlotFillCounts, loadSlots } from "@/lib/products/queries";

// GET /api/slots — the registry with current fill counts, for "3 of 8 filled".
export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  try {
    const [slots, fill] = await Promise.all([
      loadSlots(verified.adminClient),
      loadSlotFillCounts(verified.adminClient),
    ]);

    return NextResponse.json({
      slots: slots.map((slot) => ({
        ...slot,
        filled: fill[slot.id] ?? 0,
        // A slot can exceed capacity if max_items was lowered after the fact;
        // surface it rather than silently truncating on render.
        overCapacity: (fill[slot.id] ?? 0) > slot.max_items,
      })),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load slots.", 500);
  }
}
