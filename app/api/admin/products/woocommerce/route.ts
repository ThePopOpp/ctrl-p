import { NextResponse } from "next/server";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

type WooProduct = {
  id: number;
  name?: string;
  slug?: string;
  sku?: string;
  permalink?: string;
  type?: string;
  status?: string;
  stock_status?: string;
  short_description?: string;
  description?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  tax_status?: string;
  tax_class?: string;
  weight?: string;
  dimensions?: { length?: string; width?: string; height?: string };
  shipping_class?: string;
  categories?: { id: number; name: string; slug: string }[];
  tags?: { id: number; name: string; slug: string }[];
  brands?: { id: number; name: string; slug: string }[];
  images?: { id: number; src: string; name?: string; alt?: string }[];
  attributes?: unknown[];
  related_ids?: number[];
  upsell_ids?: number[];
  cross_sell_ids?: number[];
};

function cleanSiteUrl() {
  return serverEnv("WORDPRESS_SITE_URL").replace(/\/$/, "");
}

function numberValue(value: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function configured() {
  return Boolean(cleanSiteUrl() && serverEnv("WORDPRESS_USERNAME") && serverEnv("WORDPRESS_APP_PASSWORD"));
}

function authHeaders() {
  const token = Buffer.from(`${serverEnv("WORDPRESS_USERNAME")}:${serverEnv("WORDPRESS_APP_PASSWORD")}`).toString("base64");
  return { authorization: `Basic ${token}` };
}

function wooProductsUrl() {
  const url = new URL(`${cleanSiteUrl()}/wp-json/wc/v3/products`);
  url.searchParams.set("per_page", "50");
  if (serverEnv("WOOCOMMERCE_CONSUMER_KEY") && serverEnv("WOOCOMMERCE_CONSUMER_SECRET")) {
    url.searchParams.set("consumer_key", serverEnv("WOOCOMMERCE_CONSUMER_KEY"));
    url.searchParams.set("consumer_secret", serverEnv("WOOCOMMERCE_CONSUMER_SECRET"));
  }
  return url;
}

function mapWooProduct(product: WooProduct) {
  const firstCategory = product.categories?.[0];
  const images = product.images ?? [];

  return {
    sku: product.sku || `woo-${product.id}`,
    slug: product.slug || `woo-${product.id}`,
    name: product.name || `WooCommerce product ${product.id}`,
    category: firstCategory?.name || "WooCommerce",
    tagline: null,
    description: product.description || null,
    short_description: product.short_description || null,
    product_type: product.type || null,
    base_cost: 0,
    base_price: numberValue(product.regular_price || product.price),
    sale_price: product.sale_price ? numberValue(product.sale_price) : null,
    vendor: "woocommerce",
    active: product.status === "publish",
    status: product.status === "publish" ? "active" : "draft",
    stock_status: product.stock_status || "in_stock",
    featured: false,
    customizer_enabled: false,
    alternate_skus: product.sku ? [product.sku] : [],
    tags: product.tags ?? [],
    brands: product.brands ?? [],
    tax_status: product.tax_status || "taxable",
    tax_class: product.tax_class || null,
    accessories: [],
    specifications: {},
    video_url: null,
    photo_gallery: images,
    gallery: images,
    faqs: [],
    tips: [],
    attributes: product.attributes ?? [],
    similar_products: product.related_ids ?? [],
    linked_products: {
      upsell_ids: product.upsell_ids ?? [],
      cross_sell_ids: product.cross_sell_ids ?? [],
    },
    weight_lbs: product.weight ? numberValue(product.weight) : null,
    dimension_length_in: product.dimensions?.length ? numberValue(product.dimensions.length) : null,
    dimension_width_in: product.dimensions?.width ? numberValue(product.dimensions.width) : null,
    dimension_height_in: product.dimensions?.height ? numberValue(product.dimensions.height) : null,
    shipping_class: product.shipping_class || null,
    template_files: [],
    import_sources: [{
      source: "woocommerce",
      imported_at: new Date().toISOString(),
      product_id: product.id,
      permalink: product.permalink,
    }],
    woo_product_id: String(product.id),
    woo_permalink: product.permalink || null,
    woo_sync_enabled: true,
    woo_sync_status: "imported",
    woo_last_synced_at: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  return NextResponse.json({
    configured: configured(),
    siteUrl: cleanSiteUrl(),
    hasUsername: Boolean(serverEnv("WORDPRESS_USERNAME")),
    hasAppPassword: Boolean(serverEnv("WORDPRESS_APP_PASSWORD")),
    hasConsumerKey: Boolean(serverEnv("WOOCOMMERCE_CONSUMER_KEY")),
    hasConsumerSecret: Boolean(serverEnv("WOOCOMMERCE_CONSUMER_SECRET")),
    syncEnabled: ["true", "1"].includes(serverEnv("WOOCOMMERCE_SYNC_ENABLED").toLowerCase()),
  });
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request, ["super_admin", "admin", "employee", "staff", "production_manager"]);
  if (verified.error) return verified.error;
  if (!configured()) return jsonError("WordPress/WooCommerce environment variables are not configured.", 501);

  const response = await fetch(wooProductsUrl(), { headers: authHeaders(), cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return jsonError(`WooCommerce import failed: ${response.status} ${detail.slice(0, 240)}`, 502);
  }

  const products = (await response.json()) as WooProduct[];
  const imported: string[] = [];
  const updated: string[] = [];

  for (const product of products) {
    const payload = mapWooProduct(product);
    const existing = await verified.adminClient
      .from("products")
      .select("id")
      .eq("woo_product_id", String(product.id))
      .maybeSingle();

    if (existing.data?.id) {
      const result = await verified.adminClient
        .from("products")
        .update(payload)
        .eq("id", existing.data.id)
        .select("id")
        .single();
      if (!result.error) updated.push(result.data.id);
      continue;
    }

    const result = await verified.adminClient
      .from("products")
      .insert(payload)
      .select("id")
      .single();
    if (!result.error) imported.push(result.data.id);
  }

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "woocommerce_products_imported",
    entity_type: "product",
    entity_id: imported[0] || updated[0] || null,
    details: { imported: imported.length, updated: updated.length, site_url: cleanSiteUrl() },
  });

  return NextResponse.json({ imported: imported.length, updated: updated.length });
}
