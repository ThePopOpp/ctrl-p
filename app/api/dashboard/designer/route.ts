import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

const REVIEW_STATUSES = new Set(["waiting_for_file_review", "needs_changes", "proof_sent", "approved", "rejected", "in_production"]);
const DESIGN_STATUSES = new Set(["design_needed", "proof_pending", "proof_approved", "file_check", "print_ready", "on_hold", "completed"]);

function clean(value: unknown) {
  return String(value || "").trim();
}

async function verifyDesigner(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return { error: config.error };

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return { error: jsonError("Missing session token.", 401) };

  const userClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return { error: jsonError("Invalid session.", 401) };

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const profileResult = await adminClient
    .from("users")
    .select("id, email, full_name, phone, company, role, status, deleted_at, created_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return { error: jsonError(profileResult.error?.message || "Designer profile not found.", 404) };
  const profile = profileResult.data;
  if (profile.role !== "designer" || profile.status !== "active" || profile.deleted_at) return { error: jsonError("Active designer access required.", 403) };

  return { actorId, profile, adminClient };
}

function jobSelect() {
  return "id, order_id, order_item_id, status, priority, assigned_staff_id, station, due_at, notes, created_at, updated_at, orders!production_jobs_order_id_fkey(order_number, status, production_status, payment_status, due_at), order_items!production_jobs_order_item_id_fkey(id, quantity, products!order_items_product_id_fkey(id, name, category))";
}

function artworkSelect() {
  return "id, user_id, order_id, order_item_id, filename, mime_type, file_size_bytes, thumbnail_url, review_status, proof_version, uploaded_by, admin_comments, customer_comments, created_at";
}

function proofSelect() {
  return "id, order_item_id, proof_url, revision_number, status, uploaded_by, customer_comments, admin_comments, sent_at, customer_approved_at, rejected_at, created_at";
}

export async function GET(request: Request) {
  const verified = await verifyDesigner(request);
  if (verified.error) return verified.error;

  const [assignedJobs, designJobs, uploadedArtwork, uploadedProofs] = await Promise.all([
    verified.adminClient.from("production_jobs").select(jobSelect()).eq("assigned_staff_id", verified.actorId).order("priority", { ascending: true }).limit(100),
    verified.adminClient.from("production_jobs").select(jobSelect()).in("status", ["design_needed", "proof_pending", "file_check"]).is("assigned_staff_id", null).order("priority", { ascending: true }).limit(100),
    verified.adminClient.from("artwork_files").select(artworkSelect()).eq("uploaded_by", verified.actorId).order("created_at", { ascending: false }).limit(100),
    verified.adminClient.from("proofs").select(proofSelect()).eq("uploaded_by", verified.actorId).order("created_at", { ascending: false }).limit(100),
  ]);

  const failed = [assignedJobs, designJobs, uploadedArtwork, uploadedProofs].find((result) => result.error);
  if (failed?.error) return jsonError(failed.error.message, 400);

  const jobs = ([...(assignedJobs.data ?? []), ...(designJobs.data ?? [])] as Array<Record<string, any>>).filter((job, index, all) => all.findIndex((item) => item.id === job.id) === index);
  const itemIds = jobs.map((job) => job.order_item_id).filter(Boolean);
  const orderIds = jobs.map((job) => job.order_id).filter(Boolean);

  const [queueArtwork, queueProofs, messages] = await Promise.all([
    orderIds.length
      ? verified.adminClient.from("artwork_files").select(artworkSelect()).in("order_id", orderIds).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? verified.adminClient.from("proofs").select(proofSelect()).in("order_item_id", itemIds).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    verified.adminClient.from("messages").select("id, order_id, subject, body, channel, direction, read_at, created_at").eq("user_id", verified.actorId).eq("internal_only", false).order("created_at", { ascending: false }).limit(50),
  ]);

  const secondFailed = [queueArtwork, queueProofs, messages].find((result) => result.error);
  if (secondFailed?.error) return jsonError(secondFailed.error.message, 400);

  return NextResponse.json({
    profile: verified.profile,
    jobs,
    artworkFiles: ([...(queueArtwork.data ?? []), ...(uploadedArtwork.data ?? [])] as Array<Record<string, any>>).filter((item, index, all) => all.findIndex((row) => row.id === item.id) === index),
    proofs: ([...(queueProofs.data ?? []), ...(uploadedProofs.data ?? [])] as Array<Record<string, any>>).filter((item, index, all) => all.findIndex((row) => row.id === item.id) === index),
    messages: messages.data ?? [],
  });
}

export async function PATCH(request: Request) {
  const verified = await verifyDesigner(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    type?: "job" | "artwork" | "proof";
    id?: string;
    status?: string;
    comments?: string;
  } | null;

  if (!body?.id) return jsonError("Record id is required.");
  const type = body.type || "job";
  const status = clean(body.status);

  if (type === "job") {
    if (!DESIGN_STATUSES.has(status)) return jsonError("Unsupported design job status.");
    const result = await verified.adminClient.from("production_jobs").update({ status, notes: clean(body.comments) }).eq("id", body.id).select(jobSelect()).single();
    if (result.error) return jsonError(result.error.message, 400);
    await verified.adminClient.from("activity_logs").insert({ actor_id: verified.actorId, action: "designer_job_updated", entity_type: "production_job", entity_id: body.id, details: { status } });
    return NextResponse.json({ job: result.data });
  }

  if (!REVIEW_STATUSES.has(status)) return jsonError("Unsupported review status.");
  if (type === "proof") {
    const result = await verified.adminClient.from("proofs").update({
      status,
      admin_comments: clean(body.comments),
      customer_approved_at: status === "approved" ? new Date().toISOString() : null,
      rejected_at: status === "rejected" || status === "needs_changes" ? new Date().toISOString() : null,
    }).eq("id", body.id).select(proofSelect()).single();
    if (result.error) return jsonError(result.error.message, 400);
    await verified.adminClient.from("activity_logs").insert({ actor_id: verified.actorId, action: "designer_proof_updated", entity_type: "proof", entity_id: body.id, details: { status } });
    return NextResponse.json({ proof: result.data });
  }

  const result = await verified.adminClient.from("artwork_files").update({ review_status: status, admin_comments: clean(body.comments) }).eq("id", body.id).select(artworkSelect()).single();
  if (result.error) return jsonError(result.error.message, 400);
  await verified.adminClient.from("activity_logs").insert({ actor_id: verified.actorId, action: "designer_artwork_updated", entity_type: "artwork_file", entity_id: body.id, details: { status } });
  return NextResponse.json({ artwork: result.data });
}
