import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

// GET: all Wall Studio designs + pricing rules (admin management view).
export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const [products, rules] = await Promise.all([
    verified.adminClient
      .from("ws_products")
      .select("id, slug, name, category, price_per_sqft, install_rate_per_sqft, accent_hex, blend_mode, repeat_pattern, active, created_at")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    verified.adminClient.from("ws_pricing_rules").select("key, value, updated_at").order("key", { ascending: true }),
  ]);

  if (products.error) return jsonError(products.error.message, 400);
  if (rules.error) return jsonError(rules.error.message, 400);

  return NextResponse.json({ products: products.data ?? [], rules: rules.data ?? [] });
}

// PATCH: update a design ({target:'product'}) or a pricing rule ({target:'rule'}).
export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = (await request.json().catch(() => null)) as
    | {
        target?: "product" | "rule";
        // product
        id?: string;
        name?: string;
        price_per_sqft?: number | string;
        install_rate_per_sqft?: number | string;
        accent_hex?: string;
        blend_mode?: string;
        repeat_pattern?: boolean;
        active?: boolean;
        // rule
        key?: string;
        value?: unknown;
      }
    | null;

  if (body?.target === "rule") {
    const key = String(body.key || "").trim();
    if (!key) return jsonError("Rule key is required.");
    if (body.value === undefined) return jsonError("Rule value is required.");
    const result = await verified.adminClient
      .from("ws_pricing_rules")
      .update({ value: body.value, updated_at: new Date().toISOString() })
      .eq("key", key)
      .select("key, value, updated_at")
      .single();
    if (result.error) return jsonError(result.error.message, 400);
    return NextResponse.json({ rule: result.data });
  }

  // default: product
  if (!body?.id) return jsonError("Design id is required.");
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body.price_per_sqft !== undefined) {
    const v = Number(body.price_per_sqft);
    if (!(v >= 0)) return jsonError("price_per_sqft must be a non-negative number.");
    updates.price_per_sqft = v;
  }
  if (body.install_rate_per_sqft !== undefined) {
    const v = Number(body.install_rate_per_sqft);
    if (!(v >= 0)) return jsonError("install_rate_per_sqft must be a non-negative number.");
    updates.install_rate_per_sqft = v;
  }
  if (typeof body.accent_hex === "string" && body.accent_hex.trim()) updates.accent_hex = body.accent_hex.trim();
  if (body.blend_mode) {
    if (!["multiply", "normal"].includes(body.blend_mode)) return jsonError("blend_mode must be 'multiply' or 'normal'.");
    updates.blend_mode = body.blend_mode;
  }
  if (typeof body.repeat_pattern === "boolean") updates.repeat_pattern = body.repeat_pattern;
  if (typeof body.active === "boolean") updates.active = body.active;

  if (!Object.keys(updates).length) return jsonError("No updates provided.");

  const result = await verified.adminClient
    .from("ws_products")
    .update(updates)
    .eq("id", body.id)
    .select("id, slug, name, category, price_per_sqft, install_rate_per_sqft, accent_hex, blend_mode, repeat_pattern, active, created_at")
    .single();

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ product: result.data });
}
