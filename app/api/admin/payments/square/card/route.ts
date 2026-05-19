import { NextResponse } from "next/server";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

type SquarePaymentResponse = {
  payment?: {
    id?: string;
    order_id?: string;
    status?: string;
    receipt_url?: string;
    amount_money?: { amount?: number; currency?: string };
  };
  errors?: Array<{ detail?: string; code?: string }>;
};

function squareConfig() {
  const environment = serverEnv("SQUARE_ENVIRONMENT").toLowerCase() === "production" ? "production" : "sandbox";
  const accessToken = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_ACCESS_TOKEN")
    : serverEnv("SQUARE_SANDBOX_ACCESS_TOKEN");
  const applicationId = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_APPLICATION_ID")
    : serverEnv("SQUARE_SANDBOX_APPLICATION_ID");
  const locationId = environment === "production"
    ? serverEnv("SQUARE_PRODUCTION_LOCATION_ID") || serverEnv("SQUARE_LOCATION_ID")
    : serverEnv("SQUARE_SANDBOX_LOCATION_ID") || serverEnv("SQUARE_LOCATION_ID");
  const currency = (serverEnv("SQUARE_CURRENCY") || "USD").toUpperCase();
  const apiVersion = serverEnv("SQUARE_API_VERSION") || "2026-01-22";
  const baseUrl = environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";

  return { accessToken, apiVersion, applicationId, baseUrl, currency, environment, locationId };
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function mapSquarePaymentStatus(status: string | undefined) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "COMPLETED") return "paid";
  if (normalized === "APPROVED" || normalized === "PENDING") return "pending";
  if (normalized === "FAILED" || normalized === "CANCELED") return "failed";
  return "pending";
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const config = squareConfig();
  if (!config.accessToken || !config.locationId) {
    return jsonError("Square is not configured. Add the matching Square access token and location ID for the selected environment.", 501);
  }

  const body = await request.json().catch(() => null) as {
    source_id?: string;
    verification_token?: string;
    order_id?: string;
    amount?: number | string;
    description?: string;
    customer_email?: string;
    customer_phone?: string;
    cardholder_name?: string;
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    administrative_district_level_1?: string;
    postal_code?: string;
    country?: string;
    notes?: string;
    product_id?: string;
    product_name?: string;
    quantity?: number | string;
    unit_price?: number | string;
  } | null;

  const sourceId = body?.source_id?.trim();
  const providedOrderId = body?.order_id;
  const isManualPayment = !providedOrderId || providedOrderId === "__manual__";
  const amount = Number(body?.amount || 0);
  const quantity = Math.max(1, Number(body?.quantity || 1));
  const unitPrice = Number(body?.unit_price || amount);
  const description = body?.description?.trim() || "ControlP.io card payment";

  if (!sourceId) return jsonError("Square payment token is required.");
  if (!Number.isFinite(amount) || amount <= 0) return jsonError("Payment amount must be greater than zero.");
  if (isManualPayment && !body?.customer_email && !body?.customer_phone) {
    return jsonError("Customer email or phone is required for a manual payment.");
  }

  const orderResult = isManualPayment
    ? await verified.adminClient
      .from("orders")
      .insert({
        status: "awaiting_payment",
        payment_status: "pending",
        production_status: "new",
        subtotal: amount,
        total: amount,
        customer_email: body?.customer_email || null,
        customer_phone: body?.customer_phone || null,
        company: body?.customer_email || body?.customer_phone || "Manual card payment",
        internal_notes: body?.notes?.trim() || "Created from admin Square card payment.",
      })
      .select("id, user_id, order_number, total, company, customer_email, customer_phone, payment_status")
      .single()
    : await verified.adminClient
      .from("orders")
      .select("id, user_id, order_number, total, company, customer_email, customer_phone, payment_status")
      .eq("id", providedOrderId)
      .single();

  if (orderResult.error || !orderResult.data) {
    return jsonError(orderResult.error?.message || "Order not found.", 404);
  }

  const orderId = orderResult.data.id;
  let productLine: { sku?: string | null; description: string; quantity: number; unit_price: number; line_total: number } | null = null;

  if (body?.product_id) {
    const productResult = await verified.adminClient
      .from("products")
      .select("id, sku, name, category, base_cost, base_price, sale_price")
      .eq("id", body.product_id)
      .single();

    if (productResult.error || !productResult.data) {
      return jsonError(productResult.error?.message || "Product not found.", 404);
    }

    const product = productResult.data;
    const resolvedUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0
      ? unitPrice
      : Number(product.sale_price || product.base_price || product.base_cost || amount);
    productLine = {
      sku: product.sku,
      description: product.name || description,
      quantity,
      unit_price: resolvedUnitPrice,
      line_total: quantity * resolvedUnitPrice,
    };

    await verified.adminClient.from("order_items").insert({
      order_id: orderId,
      product_id: product.id,
      quantity,
      unit_cost: Number(product.base_cost || 0),
      unit_price: resolvedUnitPrice,
      line_total: quantity * resolvedUnitPrice,
      proof_required: true,
    });
  } else {
    productLine = {
      description: body?.product_name?.trim() || description,
      quantity,
      unit_price: amount,
      line_total: amount,
    };
  }

  const squareResponse = await fetch(`${config.baseUrl}/v2/payments`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": config.apiVersion,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      source_id: sourceId,
      verification_token: body?.verification_token || undefined,
      location_id: config.locationId,
      amount_money: {
        amount: toCents(amount),
        currency: config.currency,
      },
      note: description,
      buyer_email_address: body?.customer_email || orderResult.data.customer_email || undefined,
      billing_address: {
        address_line_1: body?.address_line_1 || undefined,
        address_line_2: body?.address_line_2 || undefined,
        locality: body?.locality || undefined,
        administrative_district_level_1: body?.administrative_district_level_1 || undefined,
        postal_code: body?.postal_code || undefined,
        country: body?.country || "US",
      },
    }),
  });

  const squarePayload = await squareResponse.json().catch(() => ({})) as SquarePaymentResponse;
  if (!squareResponse.ok || !squarePayload.payment?.id) {
    const errorMessage = squarePayload.errors?.[0]?.detail || squarePayload.errors?.[0]?.code || "Square could not process the card payment.";
    return jsonError(errorMessage, squareResponse.status || 400);
  }

  const squarePayment = squarePayload.payment;
  const status = mapSquarePaymentStatus(squarePayment.status);
  const paymentResult = await verified.adminClient
    .from("payments")
    .insert({
      order_id: orderId,
      user_id: orderResult.data.user_id,
      provider: "square",
      provider_payment_id: squarePayment.id,
      method: "card",
      status,
      amount,
      currency: config.currency.toLowerCase(),
      notes: body?.notes?.trim() || `Square card payment for ${orderResult.data.order_number || orderId}`,
      billing_contact: {
        customer: {
          name: body?.cardholder_name || "",
          email: body?.customer_email || orderResult.data.customer_email || "",
          phone: body?.customer_phone || orderResult.data.customer_phone || "",
          company: orderResult.data.company || "",
          address_line_1: body?.address_line_1 || "",
          address_line_2: body?.address_line_2 || "",
          locality: body?.locality || "",
          administrative_district_level_1: body?.administrative_district_level_1 || "",
          postal_code: body?.postal_code || "",
          country: body?.country || "US",
        },
        square: {
          environment: config.environment,
          application_id: config.applicationId || null,
          square_payment_id: squarePayment.id || null,
          square_order_id: squarePayment.order_id || null,
          receipt_url: squarePayment.receipt_url || null,
        },
      },
      line_items: productLine ? [productLine] : [],
      subtotal: amount,
      tax_amount: 0,
      discount_amount: 0,
      balance_due: status === "paid" ? 0 : amount,
      document_status: status === "paid" ? "generated" : "not_generated",
      delivery_status: status === "paid" ? "paid" : "created",
      received_at: status === "paid" ? new Date().toISOString() : null,
      created_by: verified.actorId,
    })
    .select("id, order_id, user_id, amount, status, provider, method, currency, notes, invoice_number, invoice_due_at, invoice_terms, billing_contact, line_items, subtotal, tax_amount, discount_amount, balance_due, payment_link_url, document_status, delivery_status, received_at, created_at")
    .single();

  if (paymentResult.error) return jsonError(paymentResult.error.message, 400);

  await verified.adminClient
    .from("orders")
    .update({ payment_status: status, status: status === "paid" ? "paid" : "awaiting_payment" })
    .eq("id", orderId);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "square_card_payment_processed",
    entity_type: "payment",
    entity_id: paymentResult.data.id,
    details: {
      order_id: orderId,
      order_number: orderResult.data.order_number,
      amount,
      square_payment_id: squarePayment.id,
      square_order_id: squarePayment.order_id,
      square_status: squarePayment.status,
      square_environment: config.environment,
    },
  });

  return NextResponse.json({
    payment: paymentResult.data,
    square: {
      environment: config.environment,
      payment_id: squarePayment.id || null,
      order_id: squarePayment.order_id || null,
      status: squarePayment.status || null,
      receipt_url: squarePayment.receipt_url || null,
    },
  });
}
