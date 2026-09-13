import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import type { ImageSource } from "@/lib/products/types";

const IMAGE_SOURCES: readonly ImageSource[] = [
  "vendor_licensed",
  "own_photo",
  "permission",
  "scraped_reference",
];

// PATCH /api/cards/:cardId/images/:imageId
//
// Reclassifying an image's provenance is the step that unblocks publishing, so
// it needs to be a first-class action rather than a database edit. The DB
// trigger still refuses to leave a published card standing on a scraped photo —
// this route translates that refusal into something a person can act on.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cardId: string; imageId: string }> },
) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId, imageId } = await params;
  const db = verified.adminClient;

  let body: {
    image_source?: string;
    source_note?: string | null;
    alt_text?: string | null;
    caption?: string | null;
    sort_order?: number;
    is_primary?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const update: Record<string, unknown> = {};

  if (body.image_source !== undefined) {
    if (!(IMAGE_SOURCES as readonly string[]).includes(body.image_source)) {
      return jsonError(`image_source must be one of: ${IMAGE_SOURCES.join(", ")}.`);
    }
    update.image_source = body.image_source;
  }
  if (body.source_note !== undefined) update.source_note = body.source_note;
  if (body.alt_text !== undefined) update.alt_text = body.alt_text;
  if (body.caption !== undefined) update.caption = body.caption;
  if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order);

  if (body.image_source === "permission" && !body.source_note) {
    return jsonError("Record who granted permission and when — that note is the whole point of this status.");
  }

  // Promotion has to clear the previous primary first; the single-primary index
  // is partial and would otherwise reject the write.
  if (body.is_primary === true) {
    await db.from("product_card_images").update({ is_primary: false }).eq("card_id", cardId).eq("is_primary", true);
    update.is_primary = true;
  } else if (body.is_primary === false) {
    update.is_primary = false;
  }

  if (!Object.keys(update).length) return jsonError("Nothing to update.");

  const result = await db
    .from("product_card_images")
    .update(update)
    .eq("id", imageId)
    .eq("card_id", cardId)
    .select("*")
    .maybeSingle();

  if (result.error) {
    return jsonError(
      /scraped reference/i.test(result.error.message)
        ? `${result.error.message} Unpublish the card first, or attach a licensed image and make that the featured one.`
        : result.error.message,
      400,
    );
  }
  if (!result.data) return jsonError("Image not found on this card.", 404);

  return NextResponse.json({ image: result.data });
}

// DELETE /api/cards/:cardId/images/:imageId
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ cardId: string; imageId: string }> },
) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { cardId, imageId } = await params;
  const db = verified.adminClient;

  const result = await db
    .from("product_card_images")
    .delete()
    .eq("id", imageId)
    .eq("card_id", cardId)
    .select("id, storage_path, is_primary")
    .maybeSingle();

  if (result.error) return jsonError(result.error.message, 400);
  if (!result.data) return jsonError("Image not found on this card.", 404);

  // Removing the featured image would leave the card with none, so promote the
  // next one rather than leaving the publish checklist mysteriously failing.
  if (result.data.is_primary) {
    const next = await db
      .from("product_card_images")
      .select("id")
      .eq("card_id", cardId)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (next.data) await db.from("product_card_images").update({ is_primary: true }).eq("id", next.data.id);
  }

  // Only clean up storage for files we own; a captured vendor URL is not ours.
  const path = String(result.data.storage_path ?? "");
  if (path && !/^https?:\/\//i.test(path)) {
    await db.storage.from("artwork").remove([path]).catch(() => null);
  }

  return NextResponse.json({ removed: result.data.id });
}
