import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import type { ImageSource } from "@/lib/products/types";

const IMAGE_SOURCES: readonly ImageSource[] = [
  "vendor_licensed",
  "own_photo",
  "permission",
  "scraped_reference",
];

const MAX_BYTES = 10 * 1024 * 1024;

// GET /api/cards/:cardId/images
export async function GET(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId } = await params;
  const result = await verified.adminClient
    .from("product_card_images")
    .select("*")
    .eq("card_id", cardId)
    .order("sort_order");

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ images: result.data ?? [] });
}

// POST /api/cards/:cardId/images
//
// Two modes:
//   multipart/form-data with `file` → uploads to storage
//   application/json with `storage_path` → registers an existing path or URL
//
// `image_source` defaults to scraped_reference. Defaulting the other way is
// exactly how an unlicensed vendor photo ends up on a public storefront.
export async function POST(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId } = await params;
  const db = verified.adminClient;

  const card = await db.from("product_cards").select("id").eq("id", cardId).maybeSingle();
  if (card.error) return jsonError(card.error.message, 400);
  if (!card.data) return jsonError("Card not found.", 404);

  const contentType = request.headers.get("content-type") ?? "";
  let storagePath: string;
  let imageSource: ImageSource = "scraped_reference";
  let altText: string | null = null;
  let caption: string | null = null;
  let sourceNote: string | null = null;
  let makePrimary = false;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("A file is required.");
    if (file.size > MAX_BYTES) return jsonError("Images are limited to 10 MB.");
    if (!file.type.startsWith("image/")) return jsonError("That file is not an image.");

    const extension = file.type.split("/")[1]?.replace("+xml", "") ?? "jpg";
    const path = `product-cards/${cardId}/${Date.now()}.${extension}`;

    const upload = await db.storage
      .from("artwork")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (upload.error) return jsonError(upload.error.message, 400);

    storagePath = path;
    imageSource = readSource(form.get("image_source"));
    altText = readText(form.get("alt_text"));
    caption = readText(form.get("caption"));
    sourceNote = readText(form.get("source_note"));
    makePrimary = form.get("is_primary") === "true";
  } else {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.");
    }
    const path = readText(body.storage_path);
    if (!path) return jsonError("storage_path is required.");

    storagePath = path;
    imageSource = readSource(body.image_source);
    altText = readText(body.alt_text);
    caption = readText(body.caption);
    sourceNote = readText(body.source_note);
    makePrimary = body.is_primary === true;
  }

  const existing = await db.from("product_card_images").select("id, is_primary").eq("card_id", cardId);
  if (existing.error) return jsonError(existing.error.message, 400);

  const rows = existing.data ?? [];
  const primary = makePrimary || rows.length === 0;

  // The single-primary index is partial, so clear the old flag before setting a
  // new one rather than letting the unique index reject the insert.
  if (primary && rows.some((row) => row.is_primary)) {
    await db.from("product_card_images").update({ is_primary: false }).eq("card_id", cardId).eq("is_primary", true);
  }

  const insert = await db
    .from("product_card_images")
    .insert({
      card_id: cardId,
      storage_path: storagePath,
      alt_text: altText,
      caption,
      image_source: imageSource,
      source_note: sourceNote,
      is_primary: primary,
      sort_order: rows.length,
    })
    .select("*")
    .single();

  if (insert.error) return jsonError(explain(insert.error.message), 400);
  return NextResponse.json({ image: insert.data }, { status: 201 });
}

/** The DB guard's message is accurate but terse; give staff the way out. */
function explain(message: string): string {
  if (/scraped reference/i.test(message)) {
    return `${message} Request a dealer asset pack from the vendor, shoot your own photo, or record written permission.`;
  }
  return message;
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readSource(value: unknown): ImageSource {
  const text = typeof value === "string" ? value : "";
  return (IMAGE_SOURCES as readonly string[]).includes(text) ? (text as ImageSource) : "scraped_reference";
}

