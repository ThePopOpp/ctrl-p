import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { loadCategories, loadTiers } from "@/lib/products/queries";

// GET /api/pricing/tiers — tier settings plus the categories on each tier.
export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  try {
    const [tiers, categories] = await Promise.all([
      loadTiers(verified.adminClient),
      loadCategories(verified.adminClient),
    ]);

    return NextResponse.json({
      tiers: tiers.map((tier) => ({
        ...tier,
        categories: categories.filter((c) => c.tier_id === tier.id).map((c) => ({ id: c.id, name: c.name })),
      })),
      categories,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load pricing tiers.", 500);
  }
}
