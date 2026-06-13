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
  if (!supabaseUrl || !publishableKey) return { error: jsonError("Supabase public environment variables are not configured.", 500) };
  if (!serviceRoleKey) return { error: jsonError("SUPABASE_SERVICE_ROLE_KEY is required.", 501) };
  return { supabaseUrl, publishableKey, serviceRoleKey };
}

async function verifyAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return { error: jsonError("Missing admin session token.", 401) };

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return { error: jsonError("Invalid admin session.", 401) };

  const actorResult = await userClient
    .from("users")
    .select("id, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (actorResult.error || !actorResult.data) return { error: jsonError("Could not verify admin profile.", 403) };
  const actor = actorResult.data;
  if (!["super_admin", "admin", "employee", "staff", "customer_support"].includes(actor.role) || actor.status !== "active" || actor.deleted_at) {
    return { error: jsonError("Only active staff or admins can edit payments.", 403) };
  }
  return { actorId };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const config = getSupabaseEnv();
  if (config.error) return config.error;

  const verified = await verifyAdmin(request, config.supabaseUrl, config.publishableKey);
  if (verified.error) return verified.error;

  const { paymentId } = await context.params;

  const body = await request.json().catch(() => null) as {
    amount?: number | string;
    notes?: string;
    invoice_number?: string;
    invoice_due_at?: string;
    invoice_terms?: string;
    billing_contact?: unknown;
    sender_profile?: unknown;
    line_items?: unknown;
    subtotal?: number | string;
    tax_amount?: number | string;
    discount_amount?: number | string;
    payment_link_url?: string | null;
    delivery_status?: string;
    status?: string;
  } | null;

  if (!body) return jsonError("No update fields provided.");

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await adminClient
    .from("payments")
    .select("id, billing_contact")
    .eq("id", paymentId)
    .single();

  if (existing.error || !existing.data) return jsonError("Payment not found.", 404);

  const updates: Record<string, unknown> = {};
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return jsonError("Amount must be greater than zero.");
    updates.amount = amount;
    updates.balance_due = amount;
  }
  if (body.notes !== undefined) updates.notes = body.notes.trim() || null;
  if (body.invoice_number !== undefined) updates.invoice_number = body.invoice_number.trim() || null;
  if (body.invoice_due_at !== undefined) updates.invoice_due_at = body.invoice_due_at || null;
  if (body.invoice_terms !== undefined) updates.invoice_terms = body.invoice_terms.trim() || "Due on receipt";
  if (body.line_items !== undefined) updates.line_items = body.line_items;
  if (body.subtotal !== undefined) updates.subtotal = Number(body.subtotal || 0);
  if (body.tax_amount !== undefined) updates.tax_amount = Number(body.tax_amount || 0);
  if (body.discount_amount !== undefined) updates.discount_amount = Number(body.discount_amount || 0);
  if (body.payment_link_url !== undefined) updates.payment_link_url = body.payment_link_url || null;
  if (body.delivery_status !== undefined) updates.delivery_status = body.delivery_status;
  if (body.status !== undefined) updates.status = body.status;

  if (body.billing_contact !== undefined || body.sender_profile !== undefined) {
    const existingContact = (existing.data.billing_contact as Record<string, unknown>) || {};
    updates.billing_contact = {
      ...existingContact,
      ...(body.billing_contact !== undefined ? { customer: body.billing_contact } : {}),
      ...(body.sender_profile !== undefined ? { sender: body.sender_profile } : {}),
    };
  }

  if (Object.keys(updates).length === 0) return jsonError("No recognised update fields.");

  const { data, error } = await adminClient
    .from("payments")
    .update(updates)
    .eq("id", paymentId)
    .select("id, order_id, amount, status, provider, method, notes, invoice_number, invoice_due_at, invoice_terms, billing_contact, line_items, subtotal, tax_amount, discount_amount, balance_due, payment_link_url, document_status, delivery_status, received_at, created_at")
    .single();

  if (error) return jsonError(error.message, 400);

  return NextResponse.json({ payment: data });
}
