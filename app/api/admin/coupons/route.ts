import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const active = url.searchParams.get("active");

  let query = verified.adminClient
    .from("coupons")
    .select("id, code, description, discount_type, discount_value, min_order_total, max_uses, uses_count, expires_at, active, created_at")
    .order("created_at", { ascending: false });

  if (active === "true") query = query.eq("active", true);
  if (active === "false") query = query.eq("active", false);

  const result = await query;
  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ coupons: result.data ?? [] });
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    code?: string;
    description?: string;
    discount_type?: string;
    discount_value?: number | string;
    min_order_total?: number | string | null;
    max_uses?: number | string | null;
    expires_at?: string | null;
    active?: boolean;
  } | null;

  const code = String(body?.code || "").trim().toUpperCase();
  if (!code) return jsonError("Coupon code is required.");

  const discountType = body?.discount_type || "percentage";
  if (!["percentage", "fixed"].includes(discountType)) return jsonError("discount_type must be 'percentage' or 'fixed'.");

  const discountValue = Number(body?.discount_value || 0);
  if (!discountValue || discountValue <= 0) return jsonError("discount_value must be greater than zero.");
  if (discountType === "percentage" && discountValue > 100) return jsonError("Percentage discount cannot exceed 100.");

  const existing = await verified.adminClient.from("coupons").select("id").eq("code", code).maybeSingle();
  if (existing.data) return jsonError("A coupon with this code already exists.", 409);

  const result = await verified.adminClient
    .from("coupons")
    .insert({
      code,
      description: String(body?.description || "").trim() || null,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_total: body?.min_order_total ? Number(body.min_order_total) : null,
      max_uses: body?.max_uses ? Number(body.max_uses) : null,
      uses_count: 0,
      expires_at: body?.expires_at || null,
      active: body?.active !== false,
    })
    .select("id, code, description, discount_type, discount_value, min_order_total, max_uses, uses_count, expires_at, active, created_at")
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ coupon: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    id?: string;
    description?: string;
    discount_type?: string;
    discount_value?: number | string;
    min_order_total?: number | string | null;
    max_uses?: number | string | null;
    expires_at?: string | null;
    active?: boolean;
  } | null;

  if (!body?.id) return jsonError("Coupon id is required.");

  const updates: Record<string, unknown> = {};
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (body.discount_type) {
    if (!["percentage", "fixed"].includes(body.discount_type)) return jsonError("discount_type must be 'percentage' or 'fixed'.");
    updates.discount_type = body.discount_type;
  }
  if (body.discount_value !== undefined) {
    const v = Number(body.discount_value);
    if (!v || v <= 0) return jsonError("discount_value must be greater than zero.");
    updates.discount_value = v;
  }
  if (body.min_order_total !== undefined) updates.min_order_total = body.min_order_total ? Number(body.min_order_total) : null;
  if (body.max_uses !== undefined) updates.max_uses = body.max_uses ? Number(body.max_uses) : null;
  if (body.expires_at !== undefined) updates.expires_at = body.expires_at || null;
  if (typeof body.active === "boolean") updates.active = body.active;

  if (!Object.keys(updates).length) return jsonError("No updates provided.");

  const result = await verified.adminClient
    .from("coupons")
    .update(updates)
    .eq("id", body.id)
    .select("id, code, description, discount_type, discount_value, min_order_total, max_uses, uses_count, expires_at, active, created_at")
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ coupon: result.data });
}

export async function DELETE(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonError("Coupon id is required.");

  const result = await verified.adminClient.from("coupons").delete().eq("id", id).select("id").single();
  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ deleted: true });
}
