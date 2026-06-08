import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");
  if (!orderId) return jsonError("order_id is required.", 400);

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orderResult = await db
    .from("orders")
    .select("id, order_number, status, payment_status, production_status, customer_email, customer_phone, company, subtotal, discount_amount, total, coupon_id, shipping_method, customer_notes, created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderResult.error) return jsonError(orderResult.error.message, 400);
  if (!orderResult.data) return jsonError("Order not found.", 404);

  const order = orderResult.data;

  const [itemsResult, paymentsResult] = await Promise.all([
    db
      .from("order_items")
      .select("id, quantity, unit_price, line_total, products(id, name, sku, category)")
      .eq("order_id", orderId),
    db
      .from("payments")
      .select("id, status, amount, provider, method, payment_link_url, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return NextResponse.json({
    order: {
      ...order,
      items: itemsResult.data ?? [],
      payment: paymentsResult.data?.[0] ?? null,
    },
  });
}
