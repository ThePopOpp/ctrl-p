import "server-only";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig } from "@/lib/admin/server-auth";
import { DEFAULT_PRICING_RULES, pricingRulesFromRows } from "@/lib/wall-studio/pricing";
import type { PricingRules, WsCategory, WsProduct } from "@/lib/wall-studio/types";

export type StudioCatalog = { products: WsProduct[]; rules: PricingRules };

export type SavedLook = {
  id: string;
  snapshot_url: string | null;
  wall_w_ft: number | null;
  wall_h_ft: number | null;
  created_at: string;
  product: { name: string; category: WsCategory; slug: string } | null;
};

// Postgres `numeric` comes back as a string via PostgREST — coerce to number.
function toProduct(row: Record<string, unknown>): WsProduct {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: row.category as WsProduct["category"],
    price_per_sqft: Number(row.price_per_sqft),
    install_rate_per_sqft: Number(row.install_rate_per_sqft),
    accent_hex: String(row.accent_hex),
    blend_mode: row.blend_mode as WsProduct["blend_mode"],
    repeat_pattern: Boolean(row.repeat_pattern),
    tile_url: (row.tile_url as string | null) ?? null,
    tile_svg: (row.tile_svg as string | null) ?? null,
    active: Boolean(row.active),
  };
}

/** Loads active designs + pricing rules. Falls back to an empty catalog and the
 *  seed rules if Supabase isn't configured, so pages still render. */
export async function loadStudioCatalog(): Promise<StudioCatalog> {
  const config = getServerSupabaseConfig();
  if ("error" in config) return { products: [], rules: DEFAULT_PRICING_RULES };

  try {
    const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const [prod, rules] = await Promise.all([
      db.from("ws_products").select("*").eq("active", true).order("created_at", { ascending: true }),
      db.from("ws_pricing_rules").select("key, value"),
    ]);
    const products = (prod.data ?? []).map(toProduct);
    const pricing = rules.data?.length ? pricingRulesFromRows(rules.data) : DEFAULT_PRICING_RULES;
    return { products, rules: pricing };
  } catch {
    return { products: [], rules: DEFAULT_PRICING_RULES };
  }
}

/** Loads a saved visualizer look by id (for the public share page). */
export async function loadVisualization(id: string): Promise<SavedLook | null> {
  const config = getServerSupabaseConfig();
  if ("error" in config) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  try {
    const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await db
      .from("ws_visualizations")
      .select("id, snapshot_url, wall_w_ft, wall_h_ft, created_at, ws_products(name, category, slug)")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;

    const rel = (data as Record<string, unknown>).ws_products;
    const p = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: String(data.id),
      snapshot_url: (data.snapshot_url as string | null) ?? null,
      wall_w_ft: data.wall_w_ft != null ? Number(data.wall_w_ft) : null,
      wall_h_ft: data.wall_h_ft != null ? Number(data.wall_h_ft) : null,
      created_at: String(data.created_at),
      product: p ? { name: String(p.name), category: p.category as WsCategory, slug: String(p.slug) } : null,
    };
  } catch {
    return null;
  }
}
