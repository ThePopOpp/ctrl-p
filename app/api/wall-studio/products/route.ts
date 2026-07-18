import { NextResponse } from "next/server";

import { loadStudioCatalog } from "@/lib/wall-studio/server";

export const dynamic = "force-dynamic";

// Public: active Wall Studio designs + current pricing rules.
export async function GET() {
  const catalog = await loadStudioCatalog();
  return NextResponse.json(catalog);
}
