import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const category = url.searchParams.get("category");
  const featured = url.searchParams.get("featured");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));

  let query = db
    .from("products")
    .select("id, sku, slug, name, category, tagline, description, base_price, sale_price, status, featured, stock_status, photo_gallery, sizes, materials, print_options, turnaround_times, quantity_tiers, customizer_enabled")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("name", { ascending: true })
    .limit(limit);

  if (slug) query = query.eq("slug", slug);
  if (category) query = query.eq("category", category);
  if (featured === "true") query = query.eq("featured", true);

  const result = await query;
  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ products: result.data ?? [] });
}
