"use client";

import type { AdminDashboardData, AdminProfile } from "@/lib/admin/types";
import type { Product } from "@/lib/admin/types";
import type { AppRole } from "@/lib/rbac/roles";
import { mockAdminData } from "@/lib/admin/mock-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { hasRole } from "@/lib/rbac/can";
import { ADMIN_CONSOLE_ROLES } from "@/lib/rbac/roles";

function requireClient() {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase is not configured.");
  return db;
}

export async function getCurrentAdminProfile(): Promise<AdminProfile | null> {
  const db = getSupabaseBrowserClient();
  if (!db) return null;

  const sessionResult = await db.auth.getSession();
  const session = sessionResult.data.session;
  if (!session) return null;

  const profile = await db
    .from("users")
    .select("id, email, full_name, role, status, deleted_at")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profile.error || !profile.data) return null;

  const data = profile.data as AdminProfile;
  if (!hasRole(data, ADMIN_CONSOLE_ROLES)) return null;

  return data;
}

export async function loadAdminDashboardData(): Promise<AdminDashboardData> {
  const db = getSupabaseBrowserClient();
  if (!db) return mockAdminData;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [orders, orderItems, productionJobs, payments, messages, users, activityLogs, products] = await Promise.all([
    db
      .from("orders")
      .select("id, order_number, user_id, status, production_status, payment_status, total, company, customer_email, customer_phone, customer_notes, internal_notes, due_at, users!orders_user_id_fkey(full_name, company)")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("order_items")
      .select("id, order_id, quantity, unit_price, line_total, proof_required, products!order_items_product_id_fkey(id, name, category)")
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("production_jobs")
      .select("id, order_id, order_item_id, status, priority, assigned_staff_id, station, due_at, started_at, completed_at, notes, created_at, updated_at, orders!production_jobs_order_id_fkey(order_number), order_items!production_jobs_order_item_id_fkey(quantity, products!order_items_product_id_fkey(id, name, category))")
      .order("priority", { ascending: true })
      .limit(100),
    db
      .from("payments")
      .select("id, order_id, user_id, amount, status, provider, method, currency, notes, invoice_number, invoice_due_at, invoice_terms, billing_contact, line_items, subtotal, tax_amount, discount_amount, balance_due, payment_link_url, document_status, delivery_status, received_at, created_at")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("messages")
      .select("id, user_id, order_id, subject, body, channel, direction, internal_only, read_at, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("users")
      .select("id, email, full_name, phone, company, role, status, created_at, last_login_at, deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("activity_logs")
      .select("id, actor_id, action, entity_type, entity_id, details, created_at")
      .in("action", ["user_created", "user_access_updated"])
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("products")
      .select("id, sku, slug, name, category, tagline, description, short_description, product_type, base_cost, base_price, sale_price, vendor, active, status, stock_status, featured, customizer_enabled, alternate_skus, tags, brands, tax_status, tax_class, coupon_code, accessories, specifications, video_url, photo_gallery, faqs, tips, attributes, similar_products, linked_products, weight_lbs, dimension_length_in, dimension_width_in, dimension_height_in, shipping_class, template_files, import_sources, woo_product_id, woo_permalink, woo_sync_enabled, woo_sync_status, woo_last_synced_at, gallery, sizes, materials, print_options, finishing_options, quantity_tiers, turnaround_times, shipping_options, file_upload_requirements, price_rules, designer_template, designer_surfaces, designer_constraints, personalization_schema, proofing_settings, production_requirements, product_assets, meta, created_at")
      .order("sort_order", { ascending: true })
      .limit(200),
  ]);

  const hasError = [orders, orderItems, productionJobs, payments, messages, users, activityLogs, products].some((result) => result.error);
  if (hasError) return mockAdminData;

  return {
    orders: orders.data ?? [],
    orderItems: orderItems.data ?? [],
    productionJobs: productionJobs.data ?? [],
    payments: payments.data ?? [],
    messages: messages.data ?? [],
    users: users.data ?? [],
    activityLogs: activityLogs.data ?? [],
    products: products.data ?? [],
  } as AdminDashboardData;
}

async function currentUserId() {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  return sessionResult.data.session?.user.id ?? null;
}

async function logActivity(action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  const db = requireClient();
  const result = await db.from("activity_logs").insert({
    actor_id: await currentUserId(),
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
  if (result.error) throw result.error;
}

export async function updateProductionJobStatus(jobId: string, status: string, orderId: string) {
  const db = requireClient();
  const jobResult = await db
    .from("production_jobs")
    .update({ status })
    .eq("id", jobId)
    .select("id, order_id, status")
    .single();

  if (jobResult.error) throw jobResult.error;

  const orderResult = await db
    .from("orders")
    .update({ production_status: status })
    .eq("id", orderId || jobResult.data.order_id);

  if (orderResult.error) throw orderResult.error;

  await logActivity("production_status_updated", "production_job", jobId, {
    order_id: orderId || jobResult.data.order_id,
    status,
  });

  return jobResult.data;
}

export async function createProductionJob(input: {
  orderId: string;
  orderItemId?: string;
  status: string;
  priority: number;
  station: string;
  dueAt: string;
  assignedStaffId?: string;
  notes: string;
}) {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before creating a production job.");

  const response = await fetch("/api/admin/production", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: input.orderId,
      order_item_id: input.orderItemId || null,
      status: input.status,
      priority: input.priority,
      station: input.station,
      due_at: input.dueAt ? new Date(`${input.dueAt}T12:00:00`).toISOString() : null,
      assigned_staff_id: input.assignedStaffId || null,
      notes: input.notes,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not create production job.");
  }

  return payload.job;
}

export async function updateProductionJob(input: {
  jobId: string;
  orderId: string;
  status: string;
  priority: number;
  station: string;
  dueAt: string;
  assignedStaffId?: string;
  notes: string;
}) {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before updating a production job.");

  const response = await fetch("/api/admin/production", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      job_id: input.jobId,
      order_id: input.orderId,
      status: input.status,
      priority: input.priority,
      station: input.station,
      due_at: input.dueAt ? new Date(`${input.dueAt}T12:00:00`).toISOString() : null,
      assigned_staff_id: input.assignedStaffId || null,
      notes: input.notes,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not update production job.");
  }

  return payload.job;
}

export async function updateAdminOrder(input: {
  orderId: string;
  status: string;
  paymentStatus: string;
  productionStatus: string;
  internalNotes: string;
  dueAt: string;
}) {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before updating an order.");

  const response = await fetch("/api/admin/orders", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: input.orderId,
      status: input.status,
      payment_status: input.paymentStatus,
      production_status: input.productionStatus,
      internal_notes: input.internalNotes,
      due_at: input.dueAt ? new Date(`${input.dueAt}T12:00:00`).toISOString() : null,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not update order.");
  }

  return payload.order;
}

export async function markMessageRead(messageId: string, orderId: string | null) {
  const db = requireClient();
  const result = await db
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .select("id, order_id, read_at")
    .single();

  if (result.error) throw result.error;

  await logActivity("message_marked_read", "message", messageId, {
    order_id: orderId || result.data.order_id,
  });

  return result.data;
}

export async function updateAdminUser(userId: string, updates: { role: AppRole; status: string }) {
  const db = requireClient();
  const currentId = await currentUserId();

  if (mockAdminData.users.some((user) => user.id === userId)) {
    throw new Error("This is demo data because live users did not load. Refresh after the users query is fixed, then save a real Supabase user.");
  }

  if (currentId === userId && updates.status !== "active") {
    throw new Error("You cannot deactivate your own admin account.");
  }

  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before updating user access.");

  const response = await fetch(`/api/admin/users`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id: userId,
      role: updates.role,
      status: updates.status,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not update user access.");
  }

  return payload.user;
}

export async function removeAdminUser(userId: string) {
  const db = requireClient();
  const currentId = await currentUserId();

  if (currentId === userId) {
    throw new Error("You cannot remove your own admin account.");
  }

  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before removing a user.");

  const response = await fetch("/api/admin/users", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not remove user.");
  }

  return payload;
}

export async function createAdminInvoice(input: {
  orderId: string;
  amount: number;
  notes: string;
  invoiceNumber: string;
  dueAt: string;
  terms: string;
  billingContact: unknown;
  senderProfile: unknown;
  deliveryMethod: string;
  deliveryRecipient: string;
  invoiceMessage: string;
  lineItems: unknown;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  processor: string;
  deliveryStatus: string;
}) {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before creating an invoice.");

  const response = await fetch("/api/admin/payments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: input.orderId,
      amount: input.amount,
      notes: input.notes,
      invoice_number: input.invoiceNumber,
      invoice_due_at: input.dueAt,
      invoice_terms: input.terms,
      billing_contact: input.billingContact,
      sender_profile: input.senderProfile,
      delivery_method: input.deliveryMethod,
      delivery_recipient: input.deliveryRecipient,
      invoice_message: input.invoiceMessage,
      line_items: input.lineItems,
      subtotal: input.subtotal,
      tax_amount: input.taxAmount,
      discount_amount: input.discountAmount,
      processor: input.processor,
      delivery_status: input.deliveryStatus,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not create invoice.");
  }

  return payload.payment;
}

export async function createSquarePaymentLink(input: {
  orderId?: string;
  amount: number;
  description: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  deliveryMethod: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
}) {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before processing a payment.");

  const response = await fetch("/api/admin/payments/square", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: input.orderId,
      amount: input.amount,
      description: input.description,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
      notes: input.notes,
      delivery_method: input.deliveryMethod,
      product_id: input.productId,
      product_name: input.productName,
      quantity: input.quantity,
      unit_price: input.unitPrice,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not create Square payment link.");
  }

  return payload as {
    payment: import("@/lib/admin/types").Payment;
    square: {
      environment: string;
      payment_link_id: string | null;
      order_id: string | null;
      url: string;
    };
  };
}

export async function loadSquarePaymentConfig() {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before loading Square payment settings.");

  const response = await fetch("/api/admin/payments/square/config", {
    headers: { authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not load Square payment settings.");
  }

  return payload as {
    applicationId: string;
    currency: string;
    environment: "sandbox" | "production";
    locationId: string;
    scriptUrl: string;
  };
}

export async function createSquareCardPayment(input: {
  sourceId: string;
  verificationToken?: string;
  orderId?: string;
  amount: number;
  description: string;
  customerEmail: string;
  customerPhone: string;
  cardholderName: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  administrativeDistrictLevel1: string;
  postalCode: string;
  country: string;
  notes: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
}) {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before processing a card payment.");

  const response = await fetch("/api/admin/payments/square/card", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      source_id: input.sourceId,
      verification_token: input.verificationToken,
      order_id: input.orderId,
      amount: input.amount,
      description: input.description,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
      cardholder_name: input.cardholderName,
      address_line_1: input.addressLine1,
      address_line_2: input.addressLine2,
      locality: input.locality,
      administrative_district_level_1: input.administrativeDistrictLevel1,
      postal_code: input.postalCode,
      country: input.country,
      notes: input.notes,
      product_id: input.productId,
      product_name: input.productName,
      quantity: input.quantity,
      unit_price: input.unitPrice,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not process Square card payment.");
  }

  return payload as {
    payment: import("@/lib/admin/types").Payment;
    square: {
      environment: string;
      payment_id: string | null;
      order_id: string | null;
      status: string | null;
      receipt_url: string | null;
    };
  };
}

export async function deliverPaymentDocument(input: {
  paymentId: string;
  kind: "invoice" | "receipt";
  channel: "email" | "sms" | "both";
  recipientEmail?: string;
  recipientPhone?: string;
}) {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before sending a payment document.");

  const response = await fetch(`/api/admin/payments/${input.paymentId}/deliver`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      kind: input.kind,
      channel: input.channel,
      recipient_email: input.recipientEmail,
      recipient_phone: input.recipientPhone,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not send payment document.");
  }

  return payload as { sent: string[]; documentUrl: string };
}

export type ProductPayload = {
  id?: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  short_description: string;
  product_type: string;
  base_cost: number;
  base_price: number;
  sale_price: number;
  vendor: string;
  active: boolean;
  status: string;
  stock_status: string;
  featured: boolean;
  customizer_enabled: boolean;
  alternate_skus: unknown;
  tags: unknown;
  brands: unknown;
  tax_status: string;
  tax_class: string;
  coupon_code: string;
  accessories: unknown;
  specifications: unknown;
  video_url: string;
  photo_gallery: unknown;
  faqs: unknown;
  tips: unknown;
  attributes: unknown;
  similar_products: unknown;
  linked_products: unknown;
  weight_lbs: number;
  dimension_length_in: number;
  dimension_width_in: number;
  dimension_height_in: number;
  shipping_class: string;
  template_files: unknown;
  import_sources: unknown;
  woo_product_id: string;
  woo_permalink: string;
  woo_sync_enabled: boolean;
  woo_sync_status: string;
  gallery: unknown;
  sizes: unknown;
  materials: unknown;
  print_options: unknown;
  finishing_options: unknown;
  quantity_tiers: unknown;
  turnaround_times: unknown;
  shipping_options: unknown;
  file_upload_requirements: unknown;
  price_rules: unknown;
  designer_template: unknown;
  designer_surfaces: unknown;
  designer_constraints: unknown;
  personalization_schema: unknown;
  proofing_settings: unknown;
  production_requirements: unknown;
  product_assets: unknown;
  meta: unknown;
};

export async function saveAdminProduct(input: ProductPayload): Promise<Product> {
  const db = requireClient();
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before saving a product.");

  const response = await fetch("/api/admin/products", {
    method: input.id ? "PATCH" : "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not save product.");
  }

  return payload.product;
}
