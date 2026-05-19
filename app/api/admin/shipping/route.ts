import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import twilio from "twilio";

import { jsonError, serverEnv, verifyAdminRequest } from "@/lib/admin/server-auth";

const STATUSES = new Set(["label_created", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "delivered", "exception", "returned"]);

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function asBoolean(value: string) {
  return value.toLowerCase() === "true" || value === "1";
}

function trackingUrl(carrier: string, trackingNumber: string, provided: string) {
  if (provided) return provided;
  const encoded = encodeURIComponent(trackingNumber);
  if (carrier === "ups") return `https://www.ups.com/track?tracknum=${encoded}`;
  if (carrier === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
  return "";
}

function shipmentSelect() {
  return "id, order_id, carrier, tracking_number, tracking_url, status, shipped_at, estimated_delivery_at, delivered_at, created_at, updated_at";
}

async function notifyCustomer(input: {
  email?: string | null;
  phone?: string | null;
  orderNumber?: string | null;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  notifyEmail: boolean;
  notifySms: boolean;
}) {
  const sent: string[] = [];
  const subject = `Tracking for order ${input.orderNumber ? `#${input.orderNumber}` : ""}`.trim();
  const body = `Your ControlP.io order ${input.orderNumber ? `#${input.orderNumber}` : ""} has tracking with ${input.carrier.toUpperCase()}.\n\nTracking number: ${input.trackingNumber}\nTrack here: ${input.trackingUrl}`;

  if (input.notifyEmail && input.email && serverEnv("SMTP_HOST") && serverEnv("SMTP_USER") && serverEnv("SMTP_PASSWORD")) {
    const transporter = nodemailer.createTransport({
      host: serverEnv("SMTP_HOST"),
      port: Number(serverEnv("SMTP_PORT") || 465),
      secure: asBoolean(serverEnv("SMTP_SECURE") || "true"),
      auth: { user: serverEnv("SMTP_USER"), pass: serverEnv("SMTP_PASSWORD") },
    });
    await transporter.sendMail({
      from: serverEnv("EMAIL_FROM") || serverEnv("SMTP_USER"),
      replyTo: serverEnv("EMAIL_REPLY_TO") || serverEnv("EMAIL_FROM") || serverEnv("SMTP_USER"),
      to: input.email,
      subject,
      text: body,
    });
    sent.push("email");
  }

  if (input.notifySms && input.phone && serverEnv("TWILIO_ACCOUNT_SID") && serverEnv("TWILIO_AUTH_TOKEN") && serverEnv("TWILIO_PHONE_NUMBER")) {
    const client = twilio(serverEnv("TWILIO_ACCOUNT_SID"), serverEnv("TWILIO_AUTH_TOKEN"));
    await client.messages.create({
      from: serverEnv("TWILIO_PHONE_NUMBER"),
      to: input.phone.replace(/[^\d+]/g, ""),
      body: `${subject}: ${input.trackingNumber} ${input.trackingUrl}`,
    });
    sent.push("sms");
  }

  return sent;
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    order_id?: string;
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    status?: string;
    shipped_at?: string | null;
    estimated_delivery_at?: string | null;
    delivered_at?: string | null;
    notify_email?: boolean;
    notify_sms?: boolean;
  } | null;

  if (!body?.order_id) return jsonError("Order is required.");
  const carrier = cleanText(body.carrier).toLowerCase();
  const trackingNumber = cleanText(body.tracking_number);
  const status = cleanText(body.status) || "label_created";
  if (!["ups", "usps", "other"].includes(carrier)) return jsonError("Carrier must be UPS, USPS, or Other.");
  if (!trackingNumber) return jsonError("Tracking number is required.");
  if (!STATUSES.has(status)) return jsonError("Unsupported shipment status.");

  const orderResult = await verified.adminClient
    .from("orders")
    .select("id, order_number, status, payment_status, production_status, customer_email, customer_phone, user_id, users!orders_user_id_fkey(email, phone)")
    .eq("id", body.order_id)
    .single();

  if (orderResult.error || !orderResult.data) return jsonError(orderResult.error?.message || "Order not found.", 404);

  const url = trackingUrl(carrier, trackingNumber, cleanText(body.tracking_url));
  const shipmentResult = await verified.adminClient
    .from("shipments")
    .insert({
      order_id: body.order_id,
      carrier,
      tracking_number: trackingNumber,
      tracking_url: url,
      status,
      shipped_at: body.shipped_at || (["shipped", "in_transit", "out_for_delivery", "delivered"].includes(status) ? new Date().toISOString() : null),
      estimated_delivery_at: body.estimated_delivery_at || null,
      delivered_at: body.delivered_at || (status === "delivered" ? new Date().toISOString() : null),
    })
    .select(shipmentSelect())
    .single();

  if (shipmentResult.error) return jsonError(shipmentResult.error.message, 400);

  const order = orderResult.data as unknown as {
    order_number: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    users?: { email?: string | null; phone?: string | null } | null;
  };
  const email = order.customer_email || order.users?.email || null;
  const phone = order.customer_phone || order.users?.phone || null;
  const sent = await notifyCustomer({
    email,
    phone,
    orderNumber: order.order_number,
    carrier,
    trackingNumber,
    trackingUrl: url,
    notifyEmail: Boolean(body.notify_email),
    notifySms: Boolean(body.notify_sms),
  });

  await Promise.all([
    verified.adminClient.from("orders").update({
      status: status === "delivered" ? "delivered" : "shipped",
      production_status: status === "delivered" ? "completed" : "ready",
    }).eq("id", body.order_id),
    verified.adminClient.from("messages").insert({
      user_id: (orderResult.data as { user_id?: string | null }).user_id || null,
      order_id: body.order_id,
      channel: "dashboard",
      direction: "outbound",
      subject: "Tracking added",
      body: `Tracking added with ${carrier.toUpperCase()}: ${trackingNumber}. ${url}`,
      internal_only: false,
      sent_at: new Date().toISOString(),
      created_by: verified.actorId,
    }),
    verified.adminClient.from("activity_logs").insert({
      actor_id: verified.actorId,
      action: "shipment_created",
      entity_type: "shipment",
      entity_id: (shipmentResult.data as unknown as { id: string }).id,
      details: { order_id: body.order_id, carrier, tracking_number: trackingNumber, notified: sent },
    }),
  ]);

  return NextResponse.json({ shipment: shipmentResult.data, notified: sent });
}

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as {
    shipment_id?: string;
    order_id?: string;
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    status?: string;
    shipped_at?: string | null;
    estimated_delivery_at?: string | null;
    delivered_at?: string | null;
    notify_email?: boolean;
    notify_sms?: boolean;
  } | null;

  if (!body?.shipment_id) return jsonError("Shipment is required.");
  const status = cleanText(body.status) || "label_created";
  if (!STATUSES.has(status)) return jsonError("Unsupported shipment status.");
  const carrier = cleanText(body.carrier).toLowerCase();
  const trackingNumber = cleanText(body.tracking_number);
  const url = trackingUrl(carrier, trackingNumber, cleanText(body.tracking_url));

  const shipmentResult = await verified.adminClient
    .from("shipments")
    .update({
      carrier,
      tracking_number: trackingNumber,
      tracking_url: url,
      status,
      shipped_at: body.shipped_at || null,
      estimated_delivery_at: body.estimated_delivery_at || null,
      delivered_at: body.delivered_at || (status === "delivered" ? new Date().toISOString() : null),
    })
    .eq("id", body.shipment_id)
    .select(shipmentSelect())
    .single();

  if (shipmentResult.error) return jsonError(shipmentResult.error.message, 400);

  const shipment = shipmentResult.data as unknown as { order_id: string };
  await verified.adminClient.from("orders").update({
    status: status === "delivered" ? "delivered" : "shipped",
    production_status: status === "delivered" ? "completed" : "ready",
  }).eq("id", shipment.order_id);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "shipment_updated",
    entity_type: "shipment",
    entity_id: body.shipment_id,
    details: { order_id: shipment.order_id, status, carrier, tracking_number: trackingNumber },
  });

  return NextResponse.json({ shipment: shipmentResult.data, notified: [] });
}
