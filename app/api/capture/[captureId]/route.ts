import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

// GET /api/capture/:captureId — poll a queued headless capture, or re-open a
// draft the panel was working on.
export async function GET(request: Request, { params }: { params: Promise<{ captureId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { captureId } = await params;

  const result = await verified.adminClient
    .from("product_captures")
    .select("id, source_url, vendor_id, capture_method, status, error_message, screenshot_path, detected_price_table, extraction_sources, draft, created_at")
    .eq("id", captureId)
    .maybeSingle();

  if (result.error) return jsonError(result.error.message, 400);
  if (!result.data) return jsonError("Capture not found.", 404);

  return NextResponse.json({ capture: result.data, draft: result.data.draft ?? null });
}
