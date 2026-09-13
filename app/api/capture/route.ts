import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { buildDraft, mergeVisionExtraction } from "@/lib/capture/extract";
import type { CaptureDraft, RawHarvest, VisionExtraction } from "@/lib/capture/types";
import { runVisionExtraction } from "@/lib/capture/vision";
import { loadVendors } from "@/lib/products/queries";

export const maxDuration = 60;

// POST /api/capture
// The extension posts a harvest plus (optionally) a screenshot. We run the
// pipeline, persist the capture for audit and later search, and return the
// draft for staff to review.
//
// Nothing here creates a card. Extraction output is a draft, never final —
// staff review is mandatory (spec §5).
export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  let body: {
    harvest?: RawHarvest;
    screenshot?: string;
    useVision?: boolean;
    capture_method?: "extension" | "manual";
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const harvest = body.harvest;
  if (!harvest?.url) return jsonError("A harvest with a url is required.");

  const db = verified.adminClient;

  try {
    let draft: CaptureDraft = buildDraft(harvest);
    let vision: VisionExtraction | null = null;

    // Tier 3 only runs when tiers 1-2 left something behind and we have a
    // picture to look at. Spending a vision call on a complete draft is waste.
    if (body.useVision !== false && body.screenshot && draft.unresolved.length) {
      vision = await runVisionExtraction(body.screenshot, draft.unresolved);
      if (vision) draft = mergeVisionExtraction(draft, vision);
    }

    const screenshotPath = body.screenshot
      ? await storeScreenshot(db, body.screenshot, harvest.url)
      : null;

    const vendorId = await matchVendor(db, harvest.url);

    const capture = await db
      .from("product_captures")
      .insert({
        captured_by: verified.actorId,
        source_url: harvest.url,
        vendor_id: vendorId,
        capture_method: body.capture_method ?? "extension",
        status: "complete",
        screenshot_path: screenshotPath,
        raw_structured_data: { jsonLd: harvest.jsonLd, openGraph: harvest.openGraph, microdata: harvest.microdata },
        detected_price_table: draft.variants.length ? { variants: draft.variants } : null,
        extracted_text: harvest.text?.slice(0, 200_000) ?? null,
        extraction_sources: draft.extractionSources,
        draft,
      })
      .select("id, created_at")
      .single();

    if (capture.error) return jsonError(capture.error.message, 400);

    return NextResponse.json(
      {
        capture: { id: capture.data.id, created_at: capture.data.created_at, screenshot_path: screenshotPath },
        draft,
        visionUsed: Boolean(vision),
        vendorId,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Capture failed.", 500);
  }
}

/** Match the captured URL to a known vendor by domain. */
async function matchVendor(db: SupabaseClient, url: string): Promise<string | null> {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const vendors = await loadVendors(db);
    const match = vendors.find((vendor) => vendor.domain && host.endsWith(vendor.domain.replace(/^www\./, "")));
    return match?.id ?? null;
  } catch {
    return null;
  }
}

async function storeScreenshot(db: SupabaseClient, dataUrl: string, sourceUrl: string): Promise<string | null> {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;

  const [, mime, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength > 8 * 1024 * 1024) return null;

  const extension = mime.split("/")[1].replace("+xml", "");
  const host = safeHost(sourceUrl);
  const path = `captures/${host}/${Date.now()}.${extension}`;

  const upload = await db.storage.from("artwork").upload(path, bytes, { contentType: mime, upsert: false });
  return upload.error ? null : path;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "");
  } catch {
    return "unknown";
  }
}
