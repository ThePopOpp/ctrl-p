import "server-only";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig } from "@/lib/admin/server-auth";
import { DEFAULT_PRICING_RULES, pricingRulesFromRows } from "@/lib/wall-studio/pricing";
import type { PricingRules, WsProduct } from "@/lib/wall-studio/types";

export type StudioCatalog = { products: WsProduct[]; rules: PricingRules };

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
