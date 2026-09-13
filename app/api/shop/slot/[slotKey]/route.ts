import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { publicDb, resolveSlotForRender } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

// GET /api/shop/slot/:slotKey?contextId=… — PUBLIC. Resolved placements with
// overrides applied. Used by client components; server components call
// resolveSlotForRender directly through <Slot>.
export async function GET(request: Request, { params }: { params: Promise<{ slotKey: string }> }) {
  const { slotKey } = await params;
  const contextId = new URL(request.url).searchParams.get("contextId");

  try {
    const placements = await resolveSlotForRender(slotKey, contextId, publicDb());
    return NextResponse.json({ slotKey, contextId, placements });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not resolve slot.", 500);
  }
}
