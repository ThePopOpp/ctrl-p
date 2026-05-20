import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

function clean(value: unknown) {
  return String(value || "").trim();
}

function slug(value: string) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function numberValue(value: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function jsonList(value: unknown) {
  if (Array.isArray(value)) return value;
  const text = clean(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return text.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

async function verifyVendor(request: Request) {
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

  if (profileResult.error || !profileResult.data) return { error: jsonError(profileResult.error?.message || "Vendor profile not found.", 404) };
  const profile = profileResult.data;
  if (profile.role !== "vendor" || profile.status !== "active" || profile.deleted_at) return { error: jsonError("Active vendor access required.", 403) };

  return { actorId, profile, adminClient };
}

const productSelect = "id, sku, slug, name, category, tagline, description, short_description, product_type, base_cost, base_price, sale_price, vendor, active, status, stock_status, featured, customizer_enabled, alternate_skus, tags, brands, coupon_code, materials, price_rules, quantity_tiers, shipping_options, template_files, meta, created_at";

function productPayload(body: Record<string, unknown>, actorId: string, vendorName: string | null) {
  const name = clean(body.name);
  const sku = clean(body.sku);
  const productSlug = slug(clean(body.slug) || name || sku);
  const category = clean(body.category) || "Vendor Catalog";
  if (!name) throw new Error("Product name is required.");
  if (!sku) throw new Error("SKU is required.");
  if (!productSlug) throw new Error("Slug is required.");

  return {
    sku,
    slug: productSlug,
    name,
    category,
    tagline: clean(body.tagline) || null,
    description: clean(body.description) || null,
    short_description: clean(body.short_description) || null,
    product_type: clean(body.product_type) || "vendor_product",
    base_cost: numberValue(body.base_cost),
    base_price: numberValue(body.base_price),
    sale_price: body.sale_price === "" || body.sale_price === null || body.sale_price === undefined ? null : numberValue(body.sale_price),
    vendor: "in_house",
    active: clean(body.status || "active") !== "archived",
    status: clean(body.status || "active"),
    stock_status: clean(body.stock_status || "in_stock"),
    customizer_enabled: Boolean(body.customizer_enabled),
    materials: jsonList(body.materials),
    price_rules: jsonList(body.price_rules),
    quantity_tiers: jsonList(body.quantity_tiers),
    tags: jsonList(body.tags),
    coupon_code: clean(body.coupon_code) || null,
    shipping_options: jsonList(body.shipping_options),
    template_files: jsonList(body.template_files),
    meta: {
      ...(typeof body.meta === "object" && body.meta ? body.meta as Record<string, unknown> : {}),
      vendor_user_id: actorId,
      vendor_name: vendorName,
      source: "vendor_dashboard",
    },
  };
}

export async function GET(request: Request) {
  const verified = await verifyVendor(request);
  if (verified.error) return verified.error;

  const productsResult = await verified.adminClient
    .from("products")
    .select(productSelect)
    .contains("meta", { vendor_user_id: verified.actorId })
    .order("created_at", { ascending: false })
    .limit(200);

  if (productsResult.error) return jsonError(productsResult.error.message, 400);

  const productIds = (productsResult.data ?? []).map((product) => product.id);
  const itemQuery = verified.adminClient
    .from("order_items")
    .select("id, order_id, product_id, quantity, unit_price, line_total, proof_required, products!order_items_product_id_fkey(id, name, category), orders!order_items_order_id_fkey(id, order_number, status, production_status, payment_status, total, due_at)")
    .order("created_at", { ascending: false })
    .limit(100);

  const orderItemsResult = productIds.length ? await itemQuery.in("product_id", productIds) : { data: [], error: null };
  if (orderItemsResult.error) return jsonError(orderItemsResult.error.message, 400);

  return NextResponse.json({
    profile: verified.profile,
    products: productsResult.data ?? [],
    orderItems: orderItemsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const verified = await verifyVendor(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Product payload is required.");

  let payload;
  try {
    payload = productPayload(body as Record<string, unknown>, verified.actorId, verified.profile.company || verified.profile.full_name || verified.profile.email);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Product payload is invalid.");
  }

  const result = await verified.adminClient.from("products").insert(payload).select(productSelect).single();
  if (result.error) return jsonError(result.error.message, 400);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "vendor_product_created",
    entity_type: "product",
    entity_id: result.data.id,
    details: { sku: payload.sku, slug: payload.slug },
  });

  return NextResponse.json({ product: result.data });
}

export async function PATCH(request: Request) {
  const verified = await verifyVendor(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const productId = clean(body?.id);
  if (!body || !productId) return jsonError("Product id is required.");

  const existing = await verified.adminClient.from("products").select("id, meta").eq("id", productId).maybeSingle();
  if (existing.error || !existing.data) return jsonError(existing.error?.message || "Product not found.", 404);
  const meta = existing.data.meta as Record<string, unknown> | null;
  if (meta?.vendor_user_id !== verified.actorId) return jsonError("You can only update your own vendor products.", 403);

  let payload;
  try {
    payload = productPayload(body, verified.actorId, verified.profile.company || verified.profile.full_name || verified.profile.email);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Product payload is invalid.");
  }

  const result = await verified.adminClient.from("products").update(payload).eq("id", productId).select(productSelect).single();
  if (result.error) return jsonError(result.error.message, 400);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "vendor_product_updated",
    entity_type: "product",
    entity_id: productId,
    details: { sku: payload.sku, slug: payload.slug },
  });

  return NextResponse.json({ product: result.data });
}
