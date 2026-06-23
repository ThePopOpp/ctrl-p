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
    return { error: jsonError("Supabase environment variables are not configured.", 500) };
  }
  if (!serviceRoleKey) {
    return { error: jsonError("SUPABASE_SERVICE_ROLE_KEY is required.", 501) };
  }
  return { supabaseUrl, publishableKey, serviceRoleKey };
}

async function verifyAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return { error: jsonError("Missing admin session token.", 401) };

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return { error: jsonError("Invalid admin session.", 401) };

  const actorResult = await userClient
    .from("users")
    .select("id, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (actorResult.error || !actorResult.data) return { error: jsonError("Could not verify admin profile.", 403) };

  const actor = actorResult.data;
  if (
    !["super_admin", "admin", "employee", "staff", "production_manager"].includes(actor.role) ||
    actor.status !== "active" ||
    actor.deleted_at
  ) {
    return { error: jsonError("Only active staff or admins can import products.", 403) };
  }

  return { actorId };
}

function cleanSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function numOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numOrZero(value: unknown): number {
  return numOrNull(value) ?? 0;
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function parseTags(value: unknown): string[] {
  if (!value || value === "") return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    try { return JSON.parse(value) as string[]; } catch {}
    return value.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

function parseGallery(value: unknown): object[] {
  if (!value || value === "") return [];
  if (Array.isArray(value)) return value as object[];
  if (typeof value === "string") {
    try { return JSON.parse(value) as object[]; } catch {}
    // Comma-separated URLs → [{url}] shape
    return value.split(",").map((u) => ({ url: u.trim() })).filter((item) => item.url);
  }
  return [];
}

function parseQuantityTiers(value: unknown): object[] {
  if (!value || value === "") return [];
  if (Array.isArray(value)) return value as object[];
  if (typeof value === "string") {
    try { return JSON.parse(value) as object[]; } catch {}
    // Simple "qty:price,qty:price" shorthand
    return value
      .split(",")
      .map((pair) => {
        const [qty, price] = pair.split(":").map((s) => s.trim());
        const q = Number(qty);
        const p = Number(price);
        if (Number.isFinite(q) && Number.isFinite(p) && q > 0) return { quantity: q, price: p };
        return null;
      })
      .filter(Boolean) as object[];
  }
  return [];
}

function boolField(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return String(value || "").toLowerCase() === "true";
}

type ImportRow = Record<string, unknown>;

function buildPayload(row: ImportRow, rowIndex: number) {
  const name = String(row.name || "").trim();
  const sku = String(row.sku || "").trim();
  const category = String(row.category || "").trim();

  if (!name) throw new Error(`Row ${rowIndex + 1}: "name" is required.`);
  if (!sku) throw new Error(`Row ${rowIndex + 1}: "sku" is required.`);
  if (!category) throw new Error(`Row ${rowIndex + 1}: "category" is required.`);

  const slug = cleanSlug(String(row.slug || name));
  const status = String(row.status || "active");

  return {
    sku,
    slug,
    name,
    category,
    tagline: String(row.tagline || "").trim() || null,
    description: String(row.description || "").trim() || null,
    short_description: String(row.short_description || "").trim() || null,
    product_type: String(row.product_type || "").trim() || null,
    base_cost: numOrZero(row.base_cost),
    base_price: numOrZero(row.base_price),
    sale_price: numOrNull(row.sale_price),
    vendor: String(row.vendor || "in_house").trim(),
    active: status !== "archived",
    status,
    stock_status: String(row.stock_status || "in_stock"),
    featured: boolField(row.featured),
    customizer_enabled: boolField(row.customizer_enabled),
    video_url: String(row.video_url || "").trim() || null,
    weight_lbs: numOrNull(row.weight_lbs),
    dimension_length_in: numOrNull(row.dimension_length_in),
    dimension_width_in: numOrNull(row.dimension_width_in),
    dimension_height_in: numOrNull(row.dimension_height_in),
    shipping_class: String(row.shipping_class || "").trim() || null,
    tax_status: String(row.tax_status || "taxable"),
    tax_class: String(row.tax_class || "").trim() || null,
    coupon_code: String(row.coupon_code || "").trim() || null,
    tags: parseTags(row.tags),
    brands: parseTags(row.brands),
    alternate_skus: parseJson(row.alternate_skus, []),
    accessories: parseJson(row.accessories, []),
    specifications: parseJson(row.specifications, {}),
    photo_gallery: parseGallery(row.photo_gallery),
    gallery: parseGallery(row.gallery),
    faqs: parseJson(row.faqs, []),
    tips: parseJson(row.tips, []),
    attributes: parseJson(row.attributes, []),
    similar_products: parseJson(row.similar_products, []),
    linked_products: parseJson(row.linked_products, []),
    template_files: parseJson(row.template_files, []),
    sizes: parseJson(row.sizes, []),
    materials: parseJson(row.materials, []),
    print_options: parseJson(row.print_options, []),
    finishing_options: parseJson(row.finishing_options, []),
    quantity_tiers: parseQuantityTiers(row.quantity_tiers),
    turnaround_times: parseJson(row.turnaround_times, []),
    shipping_options: parseJson(row.shipping_options, []),
    file_upload_requirements: parseJson(row.file_upload_requirements, {}),
    price_rules: parseJson(row.price_rules, []),
    designer_template: parseJson(row.designer_template, {}),
    designer_surfaces: parseJson(row.designer_surfaces, []),
    designer_constraints: parseJson(row.designer_constraints, {}),
    personalization_schema: parseJson(row.personalization_schema, []),
    proofing_settings: parseJson(row.proofing_settings, {}),
    production_requirements: parseJson(row.production_requirements, {}),
    product_assets: parseJson(row.product_assets, []),
    woo_product_id: String(row.woo_product_id || "").trim() || null,
    woo_permalink: String(row.woo_permalink || "").trim() || null,
    woo_sync_enabled: boolField(row.woo_sync_enabled),
    woo_sync_status: String(row.woo_sync_status || "not_synced"),
    import_sources: parseJson(row.import_sources, []),
    meta: parseJson(row.meta, {}),
  };
}

export async function POST(request: Request) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    rows?: ImportRow[];
    skip_existing?: boolean;
  } | null;

  if (!body || !Array.isArray(body.rows)) return jsonError("rows[] array is required.");
  if (body.rows.length === 0) return jsonError("No rows provided.");
  if (body.rows.length > 500) return jsonError("Maximum 500 products per import.");

  const skipExisting = body.skip_existing !== false;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch existing SKUs once
  const skusInBatch = body.rows.map((r) => String(r.sku || "").trim()).filter(Boolean);
  const existingResult = await adminClient
    .from("products")
    .select("id, sku")
    .in("sku", skusInBatch);

  const existingSkuMap = new Map<string, string>(
    (existingResult.data ?? []).map((p: { id: string; sku: string }) => [p.sku, p.id])
  );

  type RowResult = {
    row: number;
    sku: string;
    name: string;
    success: boolean;
    skipped?: boolean;
    error?: string;
  };

  const results: RowResult[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i];
    const sku = String(row.sku || "").trim();
    const name = String(row.name || "").trim();
    const existingId = existingSkuMap.get(sku);

    if (existingId && skipExisting) {
      results.push({ row: i + 1, sku, name, success: true, skipped: true });
      skipped++;
      continue;
    }

    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload(row, i);
    } catch (err) {
      results.push({ row: i + 1, sku, name, success: false, error: err instanceof Error ? err.message : "Invalid row data." });
      failed++;
      continue;
    }

    if (existingId) {
      const result = await adminClient.from("products").update(payload).eq("id", existingId);
      if (result.error) {
        results.push({ row: i + 1, sku, name, success: false, error: result.error.message });
        failed++;
      } else {
        results.push({ row: i + 1, sku, name, success: true });
        updated++;
      }
    } else {
      const result = await adminClient.from("products").insert(payload);
      if (result.error) {
        results.push({ row: i + 1, sku, name, success: false, error: result.error.message });
        failed++;
      } else {
        results.push({ row: i + 1, sku, name, success: true });
        imported++;
      }
    }
  }

  await adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "products_imported",
    entity_type: "product",
    entity_id: null,
    details: { imported, updated, skipped, failed, total: body.rows.length },
  });

  return NextResponse.json({ imported, updated, skipped, failed, results });
}
