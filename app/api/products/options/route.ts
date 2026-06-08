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
  const productId = url.searchParams.get("product_id");
  const group = url.searchParams.get("group");

  if (!productId) return jsonError("product_id is required.", 400);

  let query = db
    .from("product_options")
    .select("id, option_group, option_key, label, cost_delta, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (group) query = query.eq("option_group", group);

  const result = await query;
  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ options: result.data ?? [] });
}
