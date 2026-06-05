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

// ─── Calendar helpers ───────────────────────────────────────────────────────

function toGcalDate(iso: string) {
  return iso.replace(/[:\-]/g, "").replace(/\.\d{3}/, "");
}

function buildGoogleCalUrl(input: { typeName: string; location: string; dateLabel: string; timeLabel: string; startIso: string; endIso: string }) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${input.typeName} with ControlP.io`,
    dates: `${toGcalDate(input.startIso)}/${toGcalDate(input.endIso)}`,
    details: `Appointment: ${input.typeName}\nDate: ${input.dateLabel} at ${input.timeLabel} MST`,
    location: input.location,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(input: { typeName: string; location: string; dateLabel: string; timeLabel: string; startIso: string; endIso: string }) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `${input.typeName} with ControlP.io`,
    startdt: input.startIso,
    enddt: input.endIso,
    location: input.location,
    body: `Appointment: ${input.typeName}\nDate: ${input.dateLabel} at ${input.timeLabel} MST`,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// ─── HTML email ─────────────────────────────────────────────────────────────

function customerEmailHtml(input: {
  firstName: string;
  typeName: string;
  typeDescription: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  appointmentId: string;
  startIso: string;
  endIso: string;
  baseUrl: string;
}) {
  const googleUrl = buildGoogleCalUrl(input);
  const outlookUrl = buildOutlookUrl(input);
  const icsUrl = `${input.baseUrl}/api/booking/ics?id=${encodeURIComponent(input.appointmentId)}`;
  const logoUrl = `${input.baseUrl}/logos/logo-light-lime.svg`;
  const faviconUrl = `${input.baseUrl}/logos/favicon.png`;
  const settingsUrl = `${input.baseUrl}/settings/notifications`;
  const descRow = input.typeDescription
    ? `<tr><td style="padding:6px 0 0;font-size:13px;color:#9ca38f;line-height:1.5;">${input.typeDescription}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>Your appointment is confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f0;font-family:Inter,system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f0;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

  <!-- HEADER -->
  <tr>
    <td style="background:#07130b;padding:22px 32px;">
      <img src="${logoUrl}" alt="ControlP.io" height="42" style="display:block;height:42px;width:auto;border:0;" />
    </td>
  </tr>

  <!-- HERO -->
  <tr>
    <td style="background:#0d1f10;padding:40px 32px 36px;text-align:center;">
      <div style="display:inline-block;background:#a3ff1220;border:1px solid #a3ff1240;border-radius:50%;width:64px;height:64px;margin-bottom:18px;text-align:center;line-height:64px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a3ff12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
      <h1 style="margin:0 0 10px;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.4px;line-height:1.2;">Appointment Confirmed</h1>
      <p style="margin:0;color:#9db89a;font-size:15px;line-height:1.5;">Hi ${input.firstName}, your booking is all set. We look forward to seeing you!</p>
    </td>
  </tr>

  <!-- DATE & TIME CARDS -->
  <tr>
    <td style="padding:28px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="width:50%;padding-right:8px;vertical-align:top;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
              <tr><td style="padding:18px 22px;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#16a34a;margin-bottom:5px;">Date</div>
                <div style="font-size:18px;font-weight:700;color:#111827;line-height:1.2;">${input.dateLabel}</div>
              </td></tr>
            </table>
          </td>
          <td style="width:50%;padding-left:8px;vertical-align:top;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
              <tr><td style="padding:18px 22px;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#16a34a;margin-bottom:5px;">Time</div>
                <div style="font-size:18px;font-weight:700;color:#111827;line-height:1.2;">${input.timeLabel} <span style="font-size:13px;font-weight:500;color:#6b7280;">MST</span></div>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- APPOINTMENT TYPE CARD -->
  <tr>
    <td style="padding:16px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#07130b;border-radius:10px;">
        <tr><td style="padding:22px 26px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#a3ff12;margin-bottom:6px;">Appointment Type</div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="font-size:17px;font-weight:700;color:#ffffff;">${input.typeName}</td></tr>
            ${descRow}
            <tr><td style="padding-top:10px;"><table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="vertical-align:middle;padding-right:5px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7a9a78" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display:block;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></td><td style="font-size:13px;color:#7a9a78;">${input.location}</td></tr></table></td></tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- ADD TO CALENDAR -->
  <tr>
    <td style="padding:24px 32px 0;">
      <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Add to your calendar</p>
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding-right:8px;">
            <a href="${googleUrl}" style="display:inline-block;padding:9px 16px;background:#4285f4;color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;border-radius:6px;">Google</a>
          </td>
          <td style="padding-right:8px;">
            <a href="${outlookUrl}" style="display:inline-block;padding:9px 16px;background:#0078d4;color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;border-radius:6px;">Outlook</a>
          </td>
          <td style="padding-right:8px;">
            <a href="${icsUrl}" style="display:inline-block;padding:9px 16px;background:#555555;color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;border-radius:6px;">Apple</a>
          </td>
          <td>
            <a href="${icsUrl}" style="display:inline-block;padding:9px 16px;background:#f3f4f6;color:#374151;font-size:12px;font-weight:600;text-decoration:none;border-radius:6px;border:1px solid #d1d5db;">Download .ics</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- DIVIDER -->
  <tr><td style="padding:28px 32px 0;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:22px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="vertical-align:top;">
            <img src="${faviconUrl}" alt="" width="75" height="75" style="display:block;width:75px;height:75px;border-radius:10px;margin-bottom:10px;border:0;" />
            <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">ControlP.io</div>
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr><td style="padding-bottom:5px;"><table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="vertical-align:middle;padding-right:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display:block;"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12a19.79 19.79 0 01-3.07-8.67A2 2 0 013.6 1.27h3a2 2 0 012 1.72c.127.96.36 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.96a16 16 0 006.13 6.13l.96-.95a2 2 0 012.11-.45c.907.34 1.85.573 2.81.7a2 2 0 011.72 2.03z"></path></svg></td><td style="font-size:12px;color:#6b7280;">(480) 999-9906</td></tr></table></td></tr>
              <tr><td style="padding-bottom:5px;"><table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="vertical-align:middle;padding-right:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display:block;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></td><td style="font-size:12px;color:#6b7280;">Mon–Fri 9 am – 5 pm MST</td></tr></table></td></tr>
              <tr><td style="padding-bottom:5px;"><table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="vertical-align:middle;padding-right:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display:block;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></path></svg></td><td style="font-size:12px;color:#6b7280;"><a href="https://my.controlp.io" style="color:#16a34a;text-decoration:none;">my.controlp.io</a></td></tr></table></td></tr>
              <tr><td><table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="vertical-align:middle;padding-right:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display:block;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></td><td style="font-size:12px;color:#6b7280;"><a href="mailto:hello@controlp.io" style="color:#16a34a;text-decoration:none;">hello@controlp.io</a></td></tr></table></td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- OPT-OUT -->
  <tr>
    <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;">
      <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.7;">
        You received this email because you booked an appointment with ControlP.io.
        <br />
        <a href="${settingsUrl}" style="color:#6b7280;text-decoration:underline;">Manage email preferences</a>
        &nbsp;&middot;&nbsp;
        <a href="${settingsUrl}" style="color:#6b7280;text-decoration:underline;">SMS opt-out settings</a>
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

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

async function sendEmail(to: string, subject: string, body: string, html?: string) {
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
  await transporter.sendMail({ from, replyTo: serverEnv("EMAIL_REPLY_TO") || from, to, subject, text: body, ...(html ? { html } : {}) });
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
  const baseUrl = serverEnv("NEXT_PUBLIC_APP_URL") || "https://my.controlp.io";
  const customerHtml = customerEmailHtml({
    firstName,
    typeName: typeResult.data.name,
    typeDescription: typeResult.data.description || "",
    dateLabel,
    timeLabel,
    location,
    appointmentId: appointmentResult.data.id,
    startIso: selectedSlot.start,
    endIso: selectedSlot.end,
    baseUrl,
  });
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
    const queued = await db.from("booking_notifications").insert(notifications).select("id, channel, recipient_type, recipient_email, recipient_phone, subject, body");
    if (!queued.error) {
      await Promise.all((queued.data ?? []).map(async (notification) => {
        try {
          if (notification.channel === "email" && notification.recipient_email) {
            const html = notification.recipient_type === "customer" ? customerHtml : undefined;
            await sendEmail(notification.recipient_email, notification.subject || customer.subject, notification.body || "", html);
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
