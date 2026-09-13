import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { loadPublicCards, loadPublicCategories, publicDb } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

// GET /api/shop/products — PUBLIC. Retail only, published only.
//
// This route runs on the publishable key, so Supabase RLS and the column-level
// GRANTs from the migration both apply: the cost columns are not merely omitted
// from the response, they are not fetchable by this connection at all.
// See lib/products/shape.test.ts for the assertion that the shape stays clean.
export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const db = publicDb();
    const [products, categories] = await Promise.all([
      loadPublicCards(db, {
        categorySlug: url.searchParams.get("category") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 48),
        offset: Number(url.searchParams.get("offset") ?? 0),
      }),
      loadPublicCategories(db),
    ]);

    return NextResponse.json({ products, categories });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load products.", 500);
  }
}
