import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import twilio from "twilio";

import {
  buildAvailabilitySlots,
  cleanText,
  makeBookingTitle,
  normalizePhone,
  parseDateKey,
  type AppointmentTypeRecord,
} from "@/lib/booking/availability";
import { getServerSupabaseConfig, jsonError, serverEnv } from "@/lib/admin/server-auth";

const ACTIVE_BUSY_STATUSES = [
  "pending",
  "confirmed",
  "rescheduled",
  "follow_up_needed",
  "awaiting_payment",
  "awaiting_deposit",
  "awaiting_customer_info",
  "awaiting_approval",
];

function asBoolean(value: string) {
  return value.toLowerCase() === "true" || value === "1";
}

async function sendEmail(to: string, subject: string, body: string) {
  if (!serverEnv("SMTP_HOST") || !serverEnv("SMTP_PORT") || !serverEnv("SMTP_USER") || !serverEnv("SMTP_PASSWORD")) {
    throw new Error("SMTP is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: serverEnv("SMTP_HOST"),
    port: Number(serverEnv("SMTP_PORT") || 465),
    secure: asBoolean(serverEnv("SMTP_SECURE") || "true"),
    auth: { user: serverEnv("SMTP_USER"), pass: serverEnv("SMTP_PASSWORD") },
  });

  const from = serverEnv("EMAIL_FROM") || serverEnv("SMTP_USER");
  await transporter.sendMail({ from, replyTo: serverEnv("EMAIL_REPLY_TO") || from, to, subject, text: body });
}

async function sendSms(to: string, body: string) {
  if (!serverEnv("TWILIO_ACCOUNT_SID") || !serverEnv("TWILIO_AUTH_TOKEN") || !serverEnv("TWILIO_PHONE_NUMBER")) {
    throw new Error("Twilio is not configured.");
  }

  const client = twilio(serverEnv("TWILIO_ACCOUNT_SID"), serverEnv("TWILIO_AUTH_TOKEN"));
  await client.messages.create({ from: serverEnv("TWILIO_PHONE_NUMBER"), to, body });
}

function customerMessage(input: { typeName: string; dateLabel: string; timeLabel: string; location: string }) {
  return {
    subject: "Your Controlp.io appointment is confirmed",
    body: [
      `Your ${input.typeName} appointment with Controlp.io is confirmed.`,
      "",
      `Date: ${input.dateLabel}`,
      `Time: ${input.timeLabel}`,
      `Location: ${input.location}`,
      "",
      "Reply to your confirmation message if you need to update anything before the appointment.",
    ].join("\n"),
    sms: `Controlp.io: Your ${input.typeName} is confirmed for ${input.dateLabel} at ${input.timeLabel}. Reply HELP for help or STOP to opt out.`,
  };
}

function adminMessage(input: { typeName: string; customer: string; dateLabel: string; timeLabel: string; email: string; phone: string; notes: string }) {
  return {
    subject: `New Controlp.io booking: ${input.typeName}`,
    body: [
      "A new appointment has been booked.",
      "",
      `Customer: ${input.customer}`,
      `Appointment: ${input.typeName}`,
      `Date/time: ${input.dateLabel} at ${input.timeLabel}`,
      `Email: ${input.email || "Not provided"}`,
      `Phone: ${input.phone || "Not provided"}`,
      "",
      `Notes: ${input.notes || "None"}`,
    ].join("\n"),
  };
}

export async function POST(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const body = await request.json().catch(() => null) as {
    appointment_type_id?: string;
    start_time?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    company_name?: string;
    notes?: string;
    sms_consent?: boolean;
    email_consent?: boolean;
    answers?: Record<string, string>;
  } | null;

  const appointmentTypeId = cleanText(body?.appointment_type_id);
  const requestedStart = cleanText(body?.start_time);
  const firstName = cleanText(body?.first_name);
  const lastName = cleanText(body?.last_name);
  const email = cleanText(body?.email).toLowerCase();
  const phone = normalizePhone(body?.phone);
  if (!appointmentTypeId) return jsonError("Appointment type is required.");
  if (!requestedStart) return jsonError("Appointment time is required.");
  if (!firstName || !lastName) return jsonError("First and last name are required.");
  if (!email.includes("@")) return jsonError("A valid email is required.");

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const typeResult = await db
    .from("booking_appointment_types")
    .select("id, name, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_in_advance, location_type, meeting_url, color")
    .eq("id", appointmentTypeId)
    .eq("is_active", true)
    .maybeSingle();

  if (typeResult.error) return jsonError(typeResult.error.message, 400);
  if (!typeResult.data) return jsonError("Appointment type was not found.", 404);

  const requestedDate = new Date(requestedStart);
  if (Number.isNaN(requestedDate.getTime())) return jsonError("Appointment time is invalid.");
  const dateKey = parseDateKey(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(requestedDate));
  if (!dateKey) return jsonError("Appointment date is invalid.");

  const rangeStart = new Date(`${dateKey}T00:00:00-07:00`);
  const rangeEnd = new Date(`${dateKey}T23:59:59-07:00`);
  const [rules, appointments, blockedTimes] = await Promise.all([
    db
      .from("booking_availability_rules")
      .select("id, user_id, appointment_type_id, day_of_week, start_time, end_time, timezone, is_available")
      .or(`appointment_type_id.is.null,appointment_type_id.eq.${appointmentTypeId}`)
      .order("start_time", { ascending: true }),
    db
      .from("booking_appointments")
      .select("start_time, end_time")
      .in("status", ACTIVE_BUSY_STATUSES)
      .lt("start_time", rangeEnd.toISOString())
      .gt("end_time", rangeStart.toISOString()),
    db
      .from("booking_blocked_times")
      .select("start_time, end_time")
      .eq("blocks_public_booking", true)
      .lt("start_time", rangeEnd.toISOString())
      .gt("end_time", rangeStart.toISOString()),
  ]);

  const availabilityError = rules.error || appointments.error || blockedTimes.error;
  if (availabilityError) return jsonError(availabilityError.message, 400);

  const slots = buildAvailabilitySlots({
    appointmentType: typeResult.data as AppointmentTypeRecord,
    dateKey,
    rules: rules.data ?? [],
    appointments: appointments.data ?? [],
    blockedTimes: blockedTimes.data ?? [],
  });
  const selectedSlot = slots.find((slot) => slot.start === requestedDate.toISOString());
  if (!selectedSlot) return jsonError("That appointment time is no longer available. Please choose another time.", 409);

  const existingCustomer = await db
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  const customerId = existingCustomer.data?.id ?? null;
  const appointmentPayload = {
    appointment_type_id: appointmentTypeId,
    customer_id: customerId,
    user_id: customerId,
    title: makeBookingTitle(typeResult.data.name, firstName, lastName),
    customer_first_name: firstName,
    customer_last_name: lastName,
    customer_email: email,
    customer_phone: phone || null,
    company_name: cleanText(body?.company_name) || null,
    start_time: selectedSlot.start,
    end_time: selectedSlot.end,
    timezone: "America/Phoenix",
    status: "confirmed",
    location_type: typeResult.data.location_type,
    meeting_url: typeResult.data.meeting_url,
    phone_number: phone || null,
    customer_notes: cleanText(body?.notes) || null,
    sms_consent: Boolean(body?.sms_consent),
    email_consent: body?.email_consent !== false,
  };

  const appointmentResult = await db
    .from("booking_appointments")
    .insert(appointmentPayload)
    .select("id, title, start_time, end_time, status")
    .single();

  if (appointmentResult.error) return jsonError(appointmentResult.error.message, 400);

  const answers = Object.entries(body?.answers ?? {})
    .filter(([key, value]) => cleanText(key) && cleanText(value))
    .map(([key, value]) => ({
      appointment_id: appointmentResult.data.id,
      field_key: key,
      answer: cleanText(value),
    }));
  if (answers.length) await db.from("booking_question_answers").insert(answers);

  const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/Phoenix", weekday: "short", month: "short", day: "numeric" }).format(requestedDate);
  const timeLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" }).format(requestedDate);
  const location = typeResult.data.meeting_url || typeResult.data.location_type.replace(/_/g, " ");
  const customer = customerMessage({ typeName: typeResult.data.name, dateLabel, timeLabel, location });
  const admin = adminMessage({
    typeName: typeResult.data.name,
    customer: `${firstName} ${lastName}`,
    dateLabel,
    timeLabel,
    email,
    phone,
    notes: cleanText(body?.notes),
  });

  const notifications: Record<string, unknown>[] = [];
  if (body?.email_consent !== false) {
    notifications.push({
      appointment_id: appointmentResult.data.id,
      recipient_type: "customer",
      recipient_email: email,
      channel: "email",
      notification_type: "booking_confirmation",
      subject: customer.subject,
      body: customer.body,
      status: "queued",
    });
  }
  if (body?.sms_consent && phone) {
    notifications.push({
      appointment_id: appointmentResult.data.id,
      recipient_type: "customer",
      recipient_phone: phone,
      channel: "sms",
      notification_type: "booking_confirmation",
      body: customer.sms,
      status: "queued",
    });
  }
  const adminEmail = serverEnv("ADMIN_NOTIFICATION_EMAIL") || serverEnv("EMAIL_FROM");
  if (adminEmail) {
    notifications.push({
      appointment_id: appointmentResult.data.id,
      recipient_type: "admin",
      recipient_email: adminEmail,
      channel: "email",
      notification_type: "admin_new_booking",
      subject: admin.subject,
      body: admin.body,
      status: "queued",
    });
  }

  if (notifications.length) {
    const queued = await db.from("booking_notifications").insert(notifications).select("id, channel, recipient_email, recipient_phone, subject, body");
    if (!queued.error) {
      await Promise.all((queued.data ?? []).map(async (notification) => {
        try {
          if (notification.channel === "email" && notification.recipient_email) {
            await sendEmail(notification.recipient_email, notification.subject || customer.subject, notification.body || "");
          }
          if (notification.channel === "sms" && notification.recipient_phone) {
            await sendSms(notification.recipient_phone, notification.body || "");
          }
          await db.from("booking_notifications").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", notification.id);
        } catch (error) {
          await db.from("booking_notifications").update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Notification failed.",
          }).eq("id", notification.id);
        }
      }));
    }
  }

  await db.from("activity_logs").insert({
    actor_id: null,
    action: "booking_appointment_created",
    entity_type: "booking_appointment",
    entity_id: appointmentResult.data.id,
    details: { appointment_type: typeResult.data.slug, customer_email: email, start_time: selectedSlot.start },
  });

  return NextResponse.json({ appointment: appointmentResult.data });
}
