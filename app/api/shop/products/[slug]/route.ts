import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { loadPublicCardBySlug, publicDb, resolveSlotForRender } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

// GET /api/shop/products/:slug — PUBLIC product detail, plus the related and
// upsell slots for that product resolved in the same round trip.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const db = publicDb();
    const product = await loadPublicCardBySlug(db, slug);
    if (!product) return jsonError("Product not found.", 404);

    const [related, upsell] = await Promise.all([
      resolveSlotForRender("product_related", product.id, db),
      resolveSlotForRender("product_upsell", product.id, db),
    ]);

    return NextResponse.json({ product, related, upsell });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load product.", 500);
  }
}
