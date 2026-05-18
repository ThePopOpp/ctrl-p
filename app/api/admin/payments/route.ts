import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  return process.env[name] || "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getSupabaseEnv() {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey) {
    return { error: jsonError("Supabase public environment variables are not configured.", 500) };
  }

  if (!serviceRoleKey) {
    return { error: jsonError("SUPABASE_SERVICE_ROLE_KEY is required on the server to manage billing.", 501) };
  }

  return { supabaseUrl, publishableKey, serviceRoleKey };
}

async function verifyAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return { error: jsonError("Missing admin session token.", 401) };
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;

  if (authResult.error || !actorId) {
    return { error: jsonError("Invalid admin session.", 401) };
  }

  const actorResult = await userClient
    .from("users")
    .select("id, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (actorResult.error || !actorResult.data) {
    return { error: jsonError("Could not verify admin profile.", 403) };
  }

  const actor = actorResult.data;
  if (!["super_admin", "admin", "employee", "staff", "customer_support"].includes(actor.role) || actor.status !== "active" || actor.deleted_at) {
    return { error: jsonError("Only active staff or admins can manage billing.", 403) };
  }

  return { actorId };
}

export async function POST(request: Request) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    order_id?: string;
    amount?: number | string;
    notes?: string;
    invoice_number?: string;
    invoice_due_at?: string;
    invoice_terms?: string;
    billing_contact?: unknown;
    sender_profile?: unknown;
    delivery_method?: string;
    delivery_recipient?: string;
    invoice_message?: string;
    line_items?: unknown;
    subtotal?: number | string;
    tax_amount?: number | string;
    discount_amount?: number | string;
    processor?: string;
    delivery_status?: string;
  } | null;

  const orderId = body?.order_id;
  const amount = Number(body?.amount || 0);
  const notes = body?.notes?.trim() || "Invoice created from admin payments.";
  const subtotal = Number(body?.subtotal || amount);
  const taxAmount = Number(body?.tax_amount || 0);
  const discountAmount = Number(body?.discount_amount || 0);
  const invoiceNumber = body?.invoice_number?.trim() || null;
  const invoiceDueAt = body?.invoice_due_at || null;
  const invoiceTerms = body?.invoice_terms?.trim() || "Due on receipt";
  const processor = body?.processor?.trim() || "manual";
  const deliveryStatus = body?.delivery_status?.trim() || "draft";
  const deliveryMethod = body?.delivery_method?.trim() || "none";
  const deliveryRecipient = body?.delivery_recipient?.trim() || "";
  const invoiceMessage = body?.invoice_message?.trim() || "";

  if (!orderId) {
    return jsonError("Order is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonError("Invoice amount must be greater than zero.");
  }

  if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(taxAmount) || taxAmount < 0 || !Number.isFinite(discountAmount) || discountAmount < 0) {
    return jsonError("Subtotal, tax, and discount must be valid positive numbers.");
  }

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orderResult = await adminClient
    .from("orders")
    .select("id, user_id, order_number, total, payment_status")
    .eq("id", orderId)
    .single();

  if (orderResult.error || !orderResult.data) {
    return jsonError(orderResult.error?.message || "Order not found.", 404);
  }

  const paymentResult = await adminClient
    .from("payments")
    .insert({
      order_id: orderId,
      user_id: orderResult.data.user_id,
      provider: "invoice",
      provider_payment_id: invoiceNumber,
      method: processor,
      status: "pending",
      amount,
      currency: "usd",
      notes,
      invoice_number: invoiceNumber,
      invoice_due_at: invoiceDueAt,
      invoice_terms: invoiceTerms,
      billing_contact: {
        customer: body?.billing_contact || {},
        sender: body?.sender_profile || {},
        delivery: {
          method: deliveryMethod,
          recipient: deliveryRecipient,
          message: invoiceMessage,
        },
      },
      line_items: body?.line_items || [],
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      balance_due: amount,
      document_status: "not_generated",
      delivery_status: deliveryStatus,
      created_by: verified.actorId,
    })
    .select("id, order_id, user_id, amount, status, provider, method, currency, notes, invoice_number, invoice_due_at, invoice_terms, billing_contact, line_items, subtotal, tax_amount, discount_amount, balance_due, payment_link_url, document_status, delivery_status, received_at, created_at")
    .single();

  if (paymentResult.error) {
    return jsonError(paymentResult.error.message, 400);
  }

  await adminClient
    .from("orders")
    .update({ payment_status: "pending" })
    .eq("id", orderId);

  await adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "invoice_created",
    entity_type: "payment",
    entity_id: paymentResult.data.id,
    details: {
      order_id: orderId,
      order_number: orderResult.data.order_number,
      amount,
      invoice_number: invoiceNumber,
      invoice_due_at: invoiceDueAt,
      delivery_method: deliveryMethod,
      delivery_recipient: deliveryRecipient,
    },
  });

  return NextResponse.json({ payment: paymentResult.data });
}
