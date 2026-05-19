import { NextResponse } from "next/server";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

type SquarePaymentLinkResponse = {
  payment_link?: {
    id?: string;
    url?: string;
    order_id?: string;
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

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const config = squareConfig();
  if (!config.accessToken || !config.locationId) {
    return jsonError("Square is not configured. Add the matching Square access token and location ID for the selected environment.", 501);
  }

  const body = await request.json().catch(() => null) as {
    order_id?: string;
    amount?: number | string;
    description?: string;
    customer_email?: string;
    customer_phone?: string;
    notes?: string;
    delivery_method?: string;
  } | null;

  const providedOrderId = body?.order_id;
  const isManualPayment = !providedOrderId || providedOrderId === "__manual__";
  const amount = Number(body?.amount || 0);
  const description = body?.description?.trim() || "ControlP.io payment";
  const deliveryMethod = body?.delivery_method?.trim() || "link_only";

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
        company: body?.customer_email || body?.customer_phone || "Manual customer payment",
        internal_notes: body?.notes?.trim() || "Created from admin Square payment link.",
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

  const appUrl = serverEnv("PUBLIC_APP_URL") || "https://my.controlp.io";
  const squareResponse = await fetch(`${config.baseUrl}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": config.apiVersion,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: config.locationId,
        line_items: [
          {
            name: description,
            quantity: "1",
            base_price_money: {
              amount: toCents(amount),
              currency: config.currency,
            },
          },
        ],
      },
      checkout_options: {
        redirect_url: `${appUrl.replace(/\/$/, "")}/dashboard`,
        accepted_payment_methods: {
          card: true,
          apple_pay: true,
          google_pay: true,
          cash_app_pay: true,
        },
      },
      pre_populated_data: {
        buyer_email: body?.customer_email || orderResult.data.customer_email || undefined,
        buyer_phone_number: body?.customer_phone || orderResult.data.customer_phone || undefined,
      },
    }),
  });

  const squarePayload = await squareResponse.json().catch(() => ({})) as SquarePaymentLinkResponse;
  if (!squareResponse.ok || !squarePayload.payment_link?.url) {
    const errorMessage = squarePayload.errors?.[0]?.detail || squarePayload.errors?.[0]?.code || "Square could not create a payment link.";
    return jsonError(errorMessage, squareResponse.status || 400);
  }

  const squareLink = squarePayload.payment_link;
  const paymentResult = await verified.adminClient
    .from("payments")
    .insert({
      order_id: orderId,
      user_id: orderResult.data.user_id,
      provider: "square",
      provider_payment_id: squareLink.id || squareLink.order_id || null,
      method: "payment_link",
      status: "pending",
      amount,
      currency: config.currency.toLowerCase(),
      notes: body?.notes?.trim() || `Square payment link for ${orderResult.data.order_number || orderId}`,
      payment_link_url: squareLink.url,
      billing_contact: {
        customer: {
          email: body?.customer_email || orderResult.data.customer_email || "",
          phone: body?.customer_phone || orderResult.data.customer_phone || "",
          company: orderResult.data.company || "",
        },
        square: {
          environment: config.environment,
          application_id: config.applicationId || null,
          payment_link_id: squareLink.id || null,
          square_order_id: squareLink.order_id || null,
        },
        delivery: {
          method: deliveryMethod,
        },
      },
      subtotal: amount,
      tax_amount: 0,
      discount_amount: 0,
      balance_due: amount,
      document_status: "not_generated",
      delivery_status: deliveryMethod === "link_only" ? "created" : "ready_to_send",
      created_by: verified.actorId,
    })
    .select("id, order_id, user_id, amount, status, provider, method, currency, notes, invoice_number, invoice_due_at, invoice_terms, billing_contact, line_items, subtotal, tax_amount, discount_amount, balance_due, payment_link_url, document_status, delivery_status, received_at, created_at")
    .single();

  if (paymentResult.error) return jsonError(paymentResult.error.message, 400);

  await verified.adminClient
    .from("orders")
    .update({ payment_status: "pending" })
    .eq("id", orderId);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "square_payment_link_created",
    entity_type: "payment",
    entity_id: paymentResult.data.id,
    details: {
      order_id: orderId,
      order_number: orderResult.data.order_number,
      amount,
      payment_link_url: squareLink.url,
      square_payment_link_id: squareLink.id,
      square_order_id: squareLink.order_id,
      square_environment: config.environment,
    },
  });

  return NextResponse.json({
    payment: paymentResult.data,
    square: {
      environment: config.environment,
      payment_link_id: squareLink.id || null,
      order_id: squareLink.order_id || null,
      url: squareLink.url,
    },
  });
}
