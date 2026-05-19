import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const REVIEW_STATUSES = new Set([
  "waiting_for_file_review",
  "needs_changes",
  "proof_sent",
  "approved",
  "rejected",
  "in_production",
]);

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function validateStatus(value: unknown, fallback = "waiting_for_file_review") {
  const status = cleanText(value) || fallback;
  return REVIEW_STATUSES.has(status) ? status : null;
}

function artworkSelect() {
  return "id, user_id, order_id, order_item_id, storage_path, bucket, filename, mime_type, file_size_bytes, thumbnail_url, width_px, height_px, dpi, color_mode, review_status, proof_version, uploaded_by, admin_comments, customer_comments, final_approved_file_id, created_at";
}

function proofSelect() {
  return "id, order_item_id, storage_path, proof_url, revision_number, status, uploaded_by, customer_comments, admin_comments, sent_at, customer_approved_at, rejected_at, revisions, created_at";
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "artwork-file";
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request, ["super_admin", "admin", "employee", "staff", "production_manager", "designer"]);
  if (verified.error) return verified.error;

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Upload form is required.");

  const mode = cleanText(form.get("mode")) || "artwork";
  const file = form.get("file");
  const orderId = cleanText(form.get("order_id"));
  const orderItemId = cleanText(form.get("order_item_id"));
  const userId = cleanText(form.get("user_id"));
  const status = validateStatus(form.get("status"), mode === "proof" ? "proof_sent" : "waiting_for_file_review");
  const adminComments = cleanText(form.get("admin_comments"));
  const customerComments = cleanText(form.get("customer_comments"));
  const dpi = cleanText(form.get("dpi"));
  const colorMode = cleanText(form.get("color_mode"));
  const manualProofUrl = cleanText(form.get("proof_url"));

  if (mode !== "artwork" && mode !== "proof") return jsonError("Upload type must be artwork or proof.");
  if (!orderId) return jsonError("Order is required.");
  if (!orderItemId) return jsonError("Order line item is required.");
  if (!status) return jsonError("Unsupported artwork status.");
  if (!(file instanceof File) || !file.size) return jsonError("A file is required.");

  const itemResult = await verified.adminClient
    .from("order_items")
    .select("id, order_id")
    .eq("id", orderItemId)
    .eq("order_id", orderId)
    .single();

  if (itemResult.error || !itemResult.data) {
    return jsonError(itemResult.error?.message || "Order item not found for this order.", 404);
  }

  const filename = safeFilename(file.name);
  const storagePath = `orders/${orderId}/${Date.now()}-${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadResult = await verified.adminClient.storage
    .from("artwork")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadResult.error) return jsonError(uploadResult.error.message, 400);

  const publicUrl = verified.adminClient.storage.from("artwork").getPublicUrl(storagePath).data.publicUrl;

  if (mode === "proof") {
    const latestProof = await verified.adminClient
      .from("proofs")
      .select("revision_number")
      .eq("order_item_id", orderItemId)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const revisionNumber = Number(latestProof.data?.revision_number || 0) + 1;
    const proofResult = await verified.adminClient
      .from("proofs")
      .insert({
        order_item_id: orderItemId,
        storage_path: storagePath,
        proof_url: manualProofUrl || publicUrl,
        revision_number: revisionNumber,
        status,
        uploaded_by: verified.actorId,
        admin_comments: adminComments,
        customer_comments: customerComments || null,
        sent_at: status === "proof_sent" ? new Date().toISOString() : null,
      })
      .select(proofSelect())
      .single();

    if (proofResult.error) return jsonError(proofResult.error.message, 400);

    await Promise.all([
      verified.adminClient.from("orders").update({ status: "proofing", production_status: "proof_pending" }).eq("id", orderId),
      verified.adminClient.from("production_jobs").update({ status: "proof_pending" }).eq("order_item_id", orderItemId),
      verified.adminClient.from("messages").insert({
        user_id: userId || null,
        order_id: orderId,
        channel: "dashboard",
        direction: "outbound",
        subject: "Proof ready for review",
        body: `A proof is ready for ${filename}. ${adminComments || "Please review and approve or request changes."}`,
        internal_only: false,
        created_by: verified.actorId,
      }),
      verified.adminClient.from("activity_logs").insert({
        actor_id: verified.actorId,
        action: "proof_uploaded",
        entity_type: "proof",
        entity_id: (proofResult.data as unknown as { id: string }).id,
        details: { order_id: orderId, order_item_id: orderItemId, status, revision_number: revisionNumber },
      }),
    ]);

    return NextResponse.json({ proof: proofResult.data });
  }

  const artworkResult = await verified.adminClient
    .from("artwork_files")
    .insert({
      user_id: userId || null,
      order_id: orderId,
      order_item_id: orderItemId,
      storage_path: storagePath,
      bucket: "artwork",
      filename,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      dpi: dpi ? Number(dpi) : null,
      color_mode: colorMode || null,
      review_status: status,
      uploaded_by: verified.actorId,
      admin_comments: adminComments,
      customer_comments: customerComments || null,
    })
    .select(artworkSelect())
    .single();

  if (artworkResult.error) return jsonError(artworkResult.error.message, 400);

  await Promise.all([
    verified.adminClient.from("orders").update({ status: "file_review", production_status: "file_check" }).eq("id", orderId),
    verified.adminClient.from("production_jobs").update({ status: "file_check" }).eq("order_item_id", orderItemId),
    verified.adminClient.from("activity_logs").insert({
      actor_id: verified.actorId,
      action: "artwork_uploaded",
      entity_type: "artwork_file",
      entity_id: (artworkResult.data as unknown as { id: string }).id,
      details: { order_id: orderId, order_item_id: orderItemId, status, filename },
    }),
  ]);

  return NextResponse.json({ artwork: artworkResult.data });
}

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request, ["super_admin", "admin", "employee", "staff", "production_manager", "designer"]);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    type?: "artwork" | "proof";
    id?: string;
    status?: string;
    admin_comments?: string;
    customer_comments?: string;
  } | null;

  if (!body?.id) return jsonError("Artwork or proof id is required.");
  const type = body.type || "artwork";
  const status = validateStatus(body.status);
  if (!status) return jsonError("Unsupported artwork status.");

  if (type === "proof") {
    const proofResult = await verified.adminClient
      .from("proofs")
      .update({
        status,
        admin_comments: cleanText(body.admin_comments),
        customer_comments: cleanText(body.customer_comments) || null,
        customer_approved_at: status === "approved" ? new Date().toISOString() : null,
        rejected_at: status === "rejected" || status === "needs_changes" ? new Date().toISOString() : null,
      })
      .eq("id", body.id)
      .select(proofSelect())
      .single();

    if (proofResult.error) return jsonError(proofResult.error.message, 400);

    const proof = proofResult.data as unknown as { id: string; order_item_id: string };
    const orderItem = await verified.adminClient.from("order_items").select("order_id").eq("id", proof.order_item_id).single();
    const orderId = orderItem.data?.order_id;
    if (orderId) {
      await verified.adminClient
        .from("orders")
        .update({ production_status: status === "approved" ? "proof_approved" : status === "needs_changes" ? "design_needed" : "proof_pending" })
        .eq("id", orderId);
    }
    await verified.adminClient.from("production_jobs").update({ status: status === "approved" ? "proof_approved" : status === "needs_changes" ? "design_needed" : "proof_pending" }).eq("order_item_id", proof.order_item_id);
    await verified.adminClient.from("activity_logs").insert({
      actor_id: verified.actorId,
      action: "proof_review_updated",
      entity_type: "proof",
      entity_id: proof.id,
      details: { status, order_item_id: proof.order_item_id, order_id: orderId || null },
    });

    return NextResponse.json({ proof: proofResult.data });
  }

  const artworkResult = await verified.adminClient
    .from("artwork_files")
    .update({
      review_status: status,
      admin_comments: cleanText(body.admin_comments),
      customer_comments: cleanText(body.customer_comments) || null,
    })
    .eq("id", body.id)
    .select(artworkSelect())
    .single();

  if (artworkResult.error) return jsonError(artworkResult.error.message, 400);

  const artwork = artworkResult.data as unknown as { id: string; order_id: string | null; order_item_id: string | null };
  if (artwork.order_id) {
    await verified.adminClient
      .from("orders")
      .update({ production_status: status === "approved" ? "print_ready" : status === "needs_changes" ? "design_needed" : "file_check" })
      .eq("id", artwork.order_id);
  }
  if (artwork.order_item_id) {
    await verified.adminClient.from("production_jobs").update({ status: status === "approved" ? "print_ready" : status === "needs_changes" ? "design_needed" : "file_check" }).eq("order_item_id", artwork.order_item_id);
  }
  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "artwork_review_updated",
    entity_type: "artwork_file",
    entity_id: artwork.id,
    details: { status, order_id: artwork.order_id, order_item_id: artwork.order_item_id },
  });

  return NextResponse.json({ artwork: artworkResult.data });
}
