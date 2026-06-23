import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  return process.env[name] || "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getSupabaseEnv() {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey) {
    return { error: jsonError("Supabase public environment variables are not configured.", 500) };
  }

  if (!serviceRoleKey) {
    return { error: jsonError("SUPABASE_SERVICE_ROLE_KEY is required on the server to manage products.", 501) };
  }

  return { supabaseUrl, publishableKey, serviceRoleKey };
}

async function verifyAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return { error: jsonError("Missing admin session token.", 401) };
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;

  if (authResult.error || !actorId) {
    return { error: jsonError("Invalid admin session.", 401) };
  }

  const actorResult = await userClient
    .from("users")
    .select("id, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (actorResult.error || !actorResult.data) {
    return { error: jsonError("Could not verify admin profile.", 403) };
  }

  const actor = actorResult.data;
  if (!["super_admin", "admin", "employee", "staff", "production_manager"].includes(actor.role) || actor.status !== "active" || actor.deleted_at) {
    return { error: jsonError("Only active staff or admins can manage products.", 403) };
  }

  return { actorId };
}

function cleanSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numberValue(value: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function productPayload(body: Record<string, unknown>) {
  const name = String(body.name || "").trim();
  const sku = String(body.sku || "").trim();
  const slug = cleanSlug(String(body.slug || name || sku));
  const category = String(body.category || "").trim();

  if (!name) throw new Error("Product name is required.");
  if (!sku) throw new Error("SKU is required.");
  if (!slug) throw new Error("Slug is required.");
  if (!category) throw new Error("Category is required.");

  return {
    sku,
    slug,
    name,
    category,
    tagline: String(body.tagline || "").trim() || null,
    description: String(body.description || "").trim() || null,
    short_description: String(body.short_description || "").trim() || null,
    product_type: String(body.product_type || "").trim() || null,
    base_cost: numberValue(body.base_cost),
    base_price: numberValue(body.base_price),
    sale_price: body.sale_price === "" || body.sale_price === null || body.sale_price === undefined ? null : numberValue(body.sale_price),
    vendor: String(body.vendor || "in_house").trim(),
    active: body.status !== "archived",
    status: String(body.status || "active"),
    stock_status: String(body.stock_status || "in_stock"),
    featured: Boolean(body.featured),
    customizer_enabled: Boolean(body.customizer_enabled),
    alternate_skus: body.alternate_skus ?? [],
    tags: body.tags ?? [],
    brands: body.brands ?? [],
    tax_status: String(body.tax_status || "taxable"),
    tax_class: String(body.tax_class || "").trim() || null,
    coupon_code: String(body.coupon_code || "").trim() || null,
    accessories: body.accessories ?? [],
    specifications: body.specifications ?? {},
    image_url: String(body.image_url || "").trim() || null,
    video_url: String(body.video_url || "").trim() || null,
    photo_gallery: body.photo_gallery ?? [],
    faqs: body.faqs ?? [],
    tips: body.tips ?? [],
    attributes: body.attributes ?? [],
    similar_products: body.similar_products ?? [],
    linked_products: body.linked_products ?? [],
    weight_lbs: body.weight_lbs === "" || body.weight_lbs === null || body.weight_lbs === undefined ? null : numberValue(body.weight_lbs),
    dimension_length_in: body.dimension_length_in === "" || body.dimension_length_in === null || body.dimension_length_in === undefined ? null : numberValue(body.dimension_length_in),
    dimension_width_in: body.dimension_width_in === "" || body.dimension_width_in === null || body.dimension_width_in === undefined ? null : numberValue(body.dimension_width_in),
    dimension_height_in: body.dimension_height_in === "" || body.dimension_height_in === null || body.dimension_height_in === undefined ? null : numberValue(body.dimension_height_in),
    shipping_class: String(body.shipping_class || "").trim() || null,
    template_files: body.template_files ?? [],
    import_sources: body.import_sources ?? [],
    woo_product_id: String(body.woo_product_id || "").trim() || null,
    woo_permalink: String(body.woo_permalink || "").trim() || null,
    woo_sync_enabled: Boolean(body.woo_sync_enabled),
    woo_sync_status: String(body.woo_sync_status || "not_synced"),
    gallery: body.gallery ?? [],
    sizes: body.sizes ?? [],
    materials: body.materials ?? [],
    print_options: body.print_options ?? [],
    finishing_options: body.finishing_options ?? [],
    quantity_tiers: body.quantity_tiers ?? [],
    turnaround_times: body.turnaround_times ?? [],
    shipping_options: body.shipping_options ?? [],
    file_upload_requirements: body.file_upload_requirements ?? {},
    price_rules: body.price_rules ?? [],
    designer_template: body.designer_template ?? {},
    designer_surfaces: body.designer_surfaces ?? [],
    designer_constraints: body.designer_constraints ?? {},
    personalization_schema: body.personalization_schema ?? [],
    proofing_settings: body.proofing_settings ?? {},
    production_requirements: body.production_requirements ?? {},
    product_assets: body.product_assets ?? [],
    meta: body.meta ?? {},
  };
}

const productSelect = "id, sku, slug, name, category, tagline, description, short_description, product_type, base_cost, base_price, sale_price, vendor, active, status, stock_status, featured, customizer_enabled, alternate_skus, tags, brands, tax_status, tax_class, coupon_code, accessories, specifications, image_url, video_url, photo_gallery, faqs, tips, attributes, similar_products, linked_products, weight_lbs, dimension_length_in, dimension_width_in, dimension_height_in, shipping_class, template_files, import_sources, woo_product_id, woo_permalink, woo_sync_enabled, woo_sync_status, woo_last_synced_at, gallery, sizes, materials, print_options, finishing_options, quantity_tiers, turnaround_times, shipping_options, file_upload_requirements, price_rules, designer_template, designer_surfaces, designer_constraints, personalization_schema, proofing_settings, production_requirements, product_assets, meta, created_at";

export async function POST(request: Request) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Product payload is required.");

  let payload;
  try {
    payload = productPayload(body as Record<string, unknown>);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Product payload is invalid.");
  }

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await adminClient
    .from("products")
    .insert(payload)
    .select(productSelect)
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  await adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "product_created",
    entity_type: "product",
    entity_id: result.data.id,
    details: { sku: payload.sku, slug: payload.slug, customizer_enabled: payload.customizer_enabled },
  });

  return NextResponse.json({ product: result.data });
}

export async function PATCH(request: Request) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError("Product payload is required.");

  const productId = String(body.id || "");
  if (!productId) return jsonError("Product id is required.");

  let payload;
  try {
    payload = productPayload(body);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Product payload is invalid.");
  }

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await adminClient
    .from("products")
    .update(payload)
    .eq("id", productId)
    .select(productSelect)
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  await adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "product_updated",
    entity_type: "product",
    entity_id: productId,
    details: { sku: payload.sku, slug: payload.slug, customizer_enabled: payload.customizer_enabled },
  });

  return NextResponse.json({ product: result.data });
}
