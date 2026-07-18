import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError, serverEnv } from "@/lib/admin/server-auth";
import { sendOrderConfirmation } from "@/lib/email/order-emails";
import { billedSqft, computeInstall, pricingRulesFromRows } from "@/lib/wall-studio/pricing";
import type { InstallFactors, WsCategory } from "@/lib/wall-studio/types";

type SquarePaymentLinkResponse = {
  payment_link?: { id?: string; url?: string; order_id?: string };
  errors?: Array<{ detail?: string; code?: string }>;
};

function squareConfig() {
  const environment = serverEnv("SQUARE_ENVIRONMENT").toLowerCase() === "production" ? "production" : "sandbox";
  const accessToken = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_ACCESS_TOKEN")
    : serverEnv("SQUARE_SANDBOX_ACCESS_TOKEN");
  const locationId = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_LOCATION_ID") || serverEnv("SQUARE_LOCATION_ID")
    : serverEnv("SQUARE_SANDBOX_LOCATION_ID") || serverEnv("SQUARE_LOCATION_ID");
  const applicationId = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_APPLICATION_ID")
    : serverEnv("SQUARE_SANDBOX_APPLICATION_ID");
  const currency = (serverEnv("SQUARE_CURRENCY") || "USD").toUpperCase();
  const apiVersion = serverEnv("SQUARE_API_VERSION") || "2026-01-22";
  const baseUrl = environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  return { accessToken, locationId, applicationId, currency, apiVersion, baseUrl, environment };
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const body = await request.json().catch(() => null) as {
    items?: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      name: string;
      wallStudio?:
        | { kind: "wall_design"; wsProductId: string; category: WsCategory; w: number; h: number; sqft: number }
        | { kind: "wall_install"; factors: InstallFactors };
    }>;
    coupon_code?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    company?: string;
    shipping_method?: string;
    customer_notes?: string;
  } | null;

  if (!body?.items?.length) return jsonError("At least one item is required.");

  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return jsonError("Email address is required.");

  const firstName = String(body.first_name || "").trim();
  const lastName = String(body.last_name || "").trim();
  if (!firstName || !lastName) return jsonError("First and last name are required.");

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Split into normal catalog lines and Wall Studio lines (designs / installation).
  const normalItems = body.items.filter((i) => !i.wallStudio);
  const wallDesignItems = body.items.filter((i) => i.wallStudio?.kind === "wall_design");
  const wallInstallItems = body.items.filter((i) => i.wallStudio?.kind === "wall_install");

  const lineItems: {
    product_id: string | null;
    name: string;
    sku?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    options?: Record<string, unknown>;
  }[] = [];
  let subtotal = 0;

  // ── Normal catalog items (priced from the products table) ──
  if (normalItems.length) {
    const productIds = normalItems.map((item) => item.product_id);
    const productsResult = await db
      .from("products")
      .select("id, name, sku, base_price, sale_price, status, stock_status")
      .in("id", productIds)
      .eq("status", "active");
    if (productsResult.error) return jsonError(productsResult.error.message, 400);
    const productMap = new Map((productsResult.data ?? []).map((p) => [p.id, p]));

    for (const item of normalItems) {
      const product = productMap.get(item.product_id);
      if (!product) return jsonError(`Product not found: ${item.product_id}`, 404);
      if (product.stock_status === "out_of_stock") return jsonError(`${product.name} is out of stock.`, 409);

      const quantity = Math.max(1, Math.round(Number(item.quantity || 1)));
      const unitPrice = Number(product.sale_price || product.base_price || 0);
      if (!unitPrice) return jsonError(`${product.name} has no price set.`, 400);

      const lineTotal = Number((quantity * unitPrice).toFixed(2));
      lineItems.push({ product_id: product.id, name: product.name, sku: product.sku, quantity, unit_price: unitPrice, line_total: lineTotal });
      subtotal += lineTotal;
    }
  }

  // ── Wall Studio lines (recomputed from ws_products + ws_pricing_rules) ──
  if (wallDesignItems.length || wallInstallItems.length) {
    const rulesResult = await db.from("ws_pricing_rules").select("key, value");
    const rules = pricingRulesFromRows(rulesResult.data ?? []);

    const wsIds = wallDesignItems.map((i) => (i.wallStudio as { wsProductId: string }).wsProductId);
    const wsResult = await db.from("ws_products").select("id, name, slug, price_per_sqft, category").in("id", wsIds);
    if (wsResult.error) return jsonError(wsResult.error.message, 400);
    const wsMap = new Map((wsResult.data ?? []).map((p) => [p.id, p]));

    const wallForInstall: { category: WsCategory; sqft: number; h: number }[] = [];

    for (const item of wallDesignItems) {
      const meta = item.wallStudio as { wsProductId: string; w: number; h: number };
      const p = wsMap.get(meta.wsProductId);
      if (!p) return jsonError(`Wall design not found: ${meta.wsProductId}`, 404);

      const billed = billedSqft(meta.w, meta.h, rules);
      const materials = Number((billed * Number(p.price_per_sqft)).toFixed(2));
      if (Math.abs(materials - Number(item.unit_price)) > 0.01) {
        return jsonError("Wall pricing changed — please review your cart.", 409);
      }
      lineItems.push({
        product_id: null,
        name: item.name || p.name,
        sku: `WS-${String(p.slug).toUpperCase()}`,
        quantity: 1,
        unit_price: materials,
        line_total: materials,
        options: { kind: "wall_design", ws_product_id: p.id, w: meta.w, h: meta.h, sqft: billed, category: p.category },
      });
      subtotal += materials;
      wallForInstall.push({ category: p.category as WsCategory, sqft: billed, h: meta.h });
    }

    for (const item of wallInstallItems) {
      if (!wallForInstall.length) return jsonError("Installation requires at least one wall design.", 400);
      let sqft = 0;
      let maxHeightFt = 0;
      let rateWeighted = 0;
      for (const w of wallForInstall) {
        sqft += w.sqft;
        maxHeightFt = Math.max(maxHeightFt, w.h);
        rateWeighted += w.sqft * rules.installBaseRates[w.category];
      }
      const factors = (item.wallStudio as { factors: InstallFactors }).factors;
      const est = computeInstall({ sqft, maxHeightFt, blendedBaseRate: sqft ? rateWeighted / sqft : 0, factors }, rules);
      if (Math.abs(est.total - Number(item.unit_price)) > 0.01) {
        return jsonError("Installation total changed — please reopen the Installation quote.", 409);
      }
      lineItems.push({
        product_id: null,
        name: "Professional installation",
        sku: "WS-INSTALL",
        quantity: 1,
        unit_price: est.total,
        line_total: est.total,
        options: { kind: "wall_install", factors, lines: est.lines },
      });
      subtotal += est.total;
    }
  }

  if (!lineItems.length) return jsonError("At least one item is required.");
  subtotal = Number(subtotal.toFixed(2));

  // Validate and apply coupon
  let couponId: string | null = null;
  let discountAmount = 0;

  if (body.coupon_code) {
    const couponCode = String(body.coupon_code).trim().toUpperCase();
    const couponResult = await db
      .from("coupons")
      .select("id, discount_type, discount_value, min_order_total, max_uses, uses_count, expires_at, active")
      .eq("code", couponCode)
      .eq("active", true)
      .maybeSingle();

    if (!couponResult.data) return jsonError("Coupon code is not valid or expired.", 422);

    const coupon = couponResult.data;
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return jsonError("This coupon has expired.", 422);
    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) return jsonError("This coupon has reached its usage limit.", 422);
    if (coupon.min_order_total !== null && subtotal < Number(coupon.min_order_total)) {
      return jsonError(`This coupon requires a minimum order total of $${Number(coupon.min_order_total).toFixed(2)}.`, 422);
    }

    discountAmount = coupon.discount_type === "percentage"
      ? Number(((subtotal * Number(coupon.discount_value)) / 100).toFixed(2))
      : Math.min(Number(coupon.discount_value), subtotal);

    couponId = coupon.id;
  }

  const total = Number(Math.max(0, subtotal - discountAmount).toFixed(2));

  // Look up existing user by email
  const userResult = await db.from("users").select("id").eq("email", email).maybeSingle();
  const userId = userResult.data?.id || null;

  // Create order
  const orderResult = await db
    .from("orders")
    .insert({
      user_id: userId,
      status: "awaiting_payment",
      payment_status: "pending",
      production_status: "new",
      company: body.company?.trim() || null,
      customer_email: email,
      customer_phone: String(body.phone || "").trim() || null,
      customer_notes: String(body.customer_notes || "").trim() || null,
      shipping_method: body.shipping_method || "pickup",
      pickup_shipping_method: body.shipping_method || "pickup",
      subtotal,
      discount_amount: discountAmount || null,
      coupon_id: couponId,
      total,
    })
    .select("id, order_number, status, payment_status, total")
    .single();

  if (orderResult.error) return jsonError(orderResult.error.message, 400);
  const order = orderResult.data as { id: string; order_number: string; status: string; payment_status: string; total: number | string };

  // Create order items
  const orderItemInserts = lineItems.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_cost: 0,
    unit_price: item.unit_price,
    line_total: item.line_total,
    options: item.options ?? {},
    proof_required: true,
  }));

  const itemsResult = await db.from("order_items").insert(orderItemInserts).select("id");
  if (itemsResult.error) return jsonError(itemsResult.error.message, 400);

  // Create production job for the first item
  if (itemsResult.data?.[0]) {
    await db.from("production_jobs").insert({
      order_id: order.id,
      order_item_id: itemsResult.data[0].id,
      status: "new",
      priority: 100,
      station: "Prepress",
    });
  }

  // Increment coupon uses_count
  if (couponId) {
    const currentCoupon = await db.from("coupons").select("uses_count").eq("id", couponId).single();
    if (currentCoupon.data) {
      await db.from("coupons").update({ uses_count: (currentCoupon.data.uses_count || 0) + 1 }).eq("id", couponId);
    }
  }

  // Create Square payment link
  const sq = squareConfig();
  if (!sq.accessToken || !sq.locationId) {
    return jsonError("Square is not configured.", 501);
  }

  const appUrl = serverEnv("PUBLIC_APP_URL") || "https://my.controlp.io";
  const redirectUrl = `${appUrl.replace(/\/$/, "")}/checkout/confirmation?order_id=${order.id}`;

  const squareLineItems = lineItems.map((item) => ({
    name: item.name,
    quantity: String(item.quantity),
    base_price_money: { amount: toCents(item.unit_price), currency: sq.currency },
  }));

  // Add discount line item if applicable
  if (discountAmount > 0) {
    squareLineItems.push({
      name: "Discount",
      quantity: "1",
      base_price_money: { amount: -toCents(discountAmount), currency: sq.currency },
    });
  }

  const squareResponse = await fetch(`${sq.baseUrl}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sq.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": sq.apiVersion,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: sq.locationId,
        line_items: squareLineItems,
      },
      checkout_options: {
        redirect_url: redirectUrl,
        accepted_payment_methods: { card: true, apple_pay: true, google_pay: true, cash_app_pay: true },
      },
      pre_populated_data: {
        buyer_email: email,
        buyer_phone_number: body.phone?.trim() || undefined,
      },
    }),
  });

  const squarePayload = await squareResponse.json().catch(() => ({})) as SquarePaymentLinkResponse;
  if (!squareResponse.ok || !squarePayload.payment_link?.url) {
    const msg = squarePayload.errors?.[0]?.detail || "Square could not create a payment link.";
    return jsonError(msg, squareResponse.status || 400);
  }

  const squareLink = squarePayload.payment_link;

  // Create payment record
  await db.from("payments").insert({
    order_id: order.id,
    user_id: userId,
    provider: "square",
    provider_payment_id: squareLink.id || squareLink.order_id || null,
    method: "payment_link",
    status: "pending",
    amount: total,
    currency: sq.currency.toLowerCase(),
    notes: `Online checkout order ${order.order_number}`,
    payment_link_url: squareLink.url,
    billing_contact: {
      customer: { first_name: firstName, last_name: lastName, email, phone: body.phone?.trim() || "" },
      square: { environment: sq.environment, payment_link_id: squareLink.id || null, square_order_id: squareLink.order_id || null },
    },
    line_items: lineItems,
    subtotal,
    tax_amount: 0,
    discount_amount: discountAmount || 0,
    balance_due: total,
    document_status: "not_generated",
    delivery_status: "created",
  });

  // Create admin notification (non-blocking)
  try {
    await db.from("admin_notifications").insert({
      type: "new_order",
      title: `New order #${order.order_number}`,
      body: `${firstName} ${lastName} · ${lineItems.length} item${lineItems.length !== 1 ? "s" : ""} · $${total.toFixed(2)}`,
      order_id: order.id,
      user_id: userId,
      meta: { customer_email: email, total, items_count: lineItems.length },
    });
  } catch { /* non-fatal */ }

  // Send order confirmation email (non-blocking)
  sendOrderConfirmation({
    to: email,
    customerName: `${firstName} ${lastName}`.trim(),
    orderNumber: order.order_number,
    orderId: order.id,
    items: lineItems.map((item) => ({ name: item.name, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total })),
    subtotal,
    discountAmount: discountAmount || null,
    total,
    paymentLinkUrl: squareLink.url,
    shippingMethod: body.shipping_method || "pickup",
  }).catch(() => { /* email failures are non-fatal */ });

  return NextResponse.json({
    order_id: order.id,
    order_number: order.order_number,
    payment_link_url: squareLink.url,
    total,
  });
}
