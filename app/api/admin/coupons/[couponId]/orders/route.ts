import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request, { params }: { params: Promise<{ couponId: string }> }) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const { couponId } = await params;
  if (!couponId) return jsonError("Coupon ID is required.");

  const result = await verified.adminClient
    .from("orders")
    .select("id, order_number, status, payment_status, total, discount_amount, customer_email, company, created_at")
    .eq("coupon_id", couponId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ orders: result.data ?? [] });
}
