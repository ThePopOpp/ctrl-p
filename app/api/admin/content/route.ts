import { NextResponse } from "next/server";
import { getServerSupabaseConfig, jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

function cleanSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPayload(body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  if (!title) throw new Error("Title is required.");

  const contentType = String(body.content_type || "blog_post");
  const rawSlug = String(body.slug || title);
  const slug = contentType === "blog_post" ? cleanSlug(rawSlug) || null : null;

  return {
    content_type: contentType,
    source_id: body.source_id ? String(body.source_id) : null,
    title,
    slug,
    subject: String(body.subject || "").trim() || null,
    preheader: String(body.preheader || "").trim() || null,
    content: String(body.content || ""),
    excerpt: String(body.excerpt || "").trim() || null,
    featured_image_url: String(body.featured_image_url || "").trim() || null,
    gallery: Array.isArray(body.gallery) ? body.gallery : [],
    video_url: String(body.video_url || "").trim() || null,
    image_url: String(body.image_url || "").trim() || null,
    hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
    tags: Array.isArray(body.tags) ? body.tags : [],
    categories: Array.isArray(body.categories) ? body.categories : [],
    status: String(body.status || "draft"),
    published_at: body.published_at ? String(body.published_at) : null,
    meta_title: String(body.meta_title || "").trim() || null,
    meta_description: String(body.meta_description || "").trim() || null,
    author_id: body.author_id ? String(body.author_id) : null,
    updated_at: new Date().toISOString(),
  };
}

const SELECT =
  "id,author_id,content_type,source_id,title,slug,subject,preheader,content,excerpt,featured_image_url,gallery,video_url,image_url,hashtags,tags,categories,status,published_at,meta_title,meta_description,created_at,updated_at";

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");

  let query = auth.adminClient.from("content_items").select(SELECT).order("created_at", { ascending: false }).limit(200);
  if (type && type !== "all") query = query.eq("content_type", type);
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonError("Payload required.");

  let payload;
  try { payload = buildPayload(body); } catch (e) { return jsonError(e instanceof Error ? e.message : "Invalid payload."); }

  const { data, error } = await auth.adminClient.from("content_items").insert(payload).select(SELECT).single();
  if (error) return jsonError(error.message, 400);

  await auth.adminClient.from("activity_logs").insert({
    actor_id: auth.actorId, action: "content_created",
    entity_type: "content_item", entity_id: data.id,
    details: { title: payload.title, content_type: payload.content_type },
  });

  return NextResponse.json({ item: data });
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return jsonError("Payload required.");

  const id = String(body.id || "");
  if (!id) return jsonError("id is required.");

  let payload;
  try { payload = buildPayload(body); } catch (e) { return jsonError(e instanceof Error ? e.message : "Invalid payload."); }

  const { data, error } = await auth.adminClient.from("content_items").update(payload).eq("id", id).select(SELECT).single();
  if (error) return jsonError(error.message, 400);

  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if ("error" in auth) return auth.error;

  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return jsonError("id is required.");

  const { error } = await auth.adminClient.from("content_items").delete().eq("id", id);
  if (error) return jsonError(error.message, 400);

  return NextResponse.json({ ok: true });
}
