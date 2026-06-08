import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError } from "@/lib/admin/server-auth";

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const body = await request.json().catch(() => null) as {
    code?: string;
    order_total?: number | string;
  } | null;

  const code = String(body?.code || "").trim().toUpperCase();
  if (!code) return jsonError("Coupon code is required.");

  const orderTotal = Number(body?.order_total || 0);

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await db
    .from("coupons")
    .select("id, code, description, discount_type, discount_value, min_order_total, max_uses, uses_count, expires_at, active")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (result.error) return jsonError(result.error.message, 400);
  if (!result.data) return jsonError("This coupon code is not valid.", 404);

  const coupon = result.data;

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return jsonError("This coupon has expired.", 410);
  }

  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return jsonError("This coupon has reached its usage limit.", 410);
  }

  if (coupon.min_order_total !== null && orderTotal < Number(coupon.min_order_total)) {
    return jsonError(`This coupon requires a minimum order total of $${Number(coupon.min_order_total).toFixed(2)}.`, 422);
  }

  const discountAmount = coupon.discount_type === "percentage"
    ? Number(((orderTotal * Number(coupon.discount_value)) / 100).toFixed(2))
    : Math.min(Number(coupon.discount_value), orderTotal);

  return NextResponse.json({
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
    },
    discount_amount: discountAmount,
    discounted_total: Number(Math.max(0, orderTotal - discountAmount).toFixed(2)),
  });
}
