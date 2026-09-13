// The opportunity activity timeline: one ordered stream built from pipeline
// events plus the real records in Messages, Bookings and Payments, grouped into
// tabs that line up with the workspace's quick-action menu.

import type { OpportunityEvent, RelatedAppointment, RelatedMessage, RelatedPayment } from "@/lib/pipeline/types";

export type TimelineGroup =
  | "call" | "email" | "sms" | "meeting" | "note" | "voice" | "ai"
  | "project" | "plan" | "contract" | "sow" | "quote" | "invoice" | "payment" | "update";

export type TimelineTabKey = "all" | TimelineGroup;

/** `log` is the manual-log kind the tab's "Add" button records; `tool` is the quick action it opens. */
export const TIMELINE_TABS: { key: TimelineTabKey; label: string; log: "note" | "call" | "email" | "sms" | "meeting" | null }[] = [
  { key: "all", label: "All", log: null },
  { key: "call", label: "Calls", log: "call" },
  { key: "email", label: "Email", log: "email" },
  { key: "sms", label: "Text", log: "sms" },
  { key: "meeting", label: "Appointments", log: "meeting" },
  { key: "note", label: "Notes", log: "note" },
  { key: "voice", label: "Voice notes", log: null },
  { key: "ai", label: "AI Agent", log: null },
  { key: "project", label: "Projects", log: null },
  { key: "plan", label: "Plans", log: null },
  { key: "contract", label: "Contracts", log: null },
  { key: "sow", label: "SOW", log: null },
  { key: "quote", label: "Quotes", log: null },
  { key: "invoice", label: "Invoices", log: null },
  { key: "payment", label: "Payments", log: null },
  { key: "update", label: "Updates", log: null },
];

export type TimelineItem = {
  id: string;
  at: string;
  groups: TimelineGroup[];
  title: string;
  body: string | null;
  /** Where the entry came from and what state it is in, e.g. "Twilio · delivered" or "Logged manually". */
  tag: string;
  tone: "default" | "success" | "warning" | "danger" | "muted";
  actorId: string | null;
  eventId: string | null;
  kind: string;
  amount: number | null;
  details: Record<string, unknown>;
};

const CHANNEL_GROUP: Record<string, TimelineGroup> = {
  call: "call",
  email: "email",
  sms: "sms",
  meeting: "meeting",
  note: "note",
  voice_note: "voice",
  ai_agent: "ai",
  project: "project",
  plan: "plan",
  contract: "contract",
  sow: "sow",
  quote: "quote",
  invoice: "invoice",
  payment: "payment",
};

const PAID = new Set(["paid", "partially_paid", "refunded", "partially_refunded"]);
const FAILED = new Set(["failed", "undelivered", "canceled", "busy", "no-answer"]);

const str = (value: unknown) => (typeof value === "string" ? value : null);
const human = (value: string | null | undefined) => (value ? value.replace(/[_-]/g, " ") : "");

function toneFor(status: string | null): TimelineItem["tone"] {
  if (!status) return "default";
  if (FAILED.has(status)) return "danger";
  if (["delivered", "completed", "sent", "paid", "signed", "accepted", "confirmed"].includes(status)) return "success";
  if (["queued", "accepted", "sending", "ringing", "in-progress", "pending", "draft", "unverified"].includes(status)) return "warning";
  return "default";
}

function fromEvent(event: OpportunityEvent): TimelineItem {
  const details = event.details ?? {};
  const status = str(details.status);
  const base = {
    id: event.id,
    at: event.occurred_at,
    body: event.body,
    actorId: event.actor_id,
    eventId: event.id,
    kind: event.log_kind || event.event_type,
    amount: typeof details.amount === "number" ? details.amount : null,
    details,
  };

  if (event.event_type === "communication") {
    const group = CHANNEL_GROUP[event.log_kind ?? ""] ?? "update";
    const source = event.log_kind === "call" || event.log_kind === "sms" ? "Twilio" : event.log_kind === "email" ? "Email" : event.log_kind === "meeting" ? "Booking" : event.log_kind === "ai_agent" ? "AI draft · not sent" : "Ctrl+P";
    return { ...base, groups: [group], title: event.summary || human(event.log_kind), tag: status && event.log_kind !== "ai_agent" ? `${source} · ${human(status)}` : source, tone: event.log_kind === "ai_agent" ? "muted" : toneFor(status) };
  }
  if (event.event_type === "manual_log") {
    const group = CHANNEL_GROUP[event.log_kind ?? ""] ?? "note";
    const note = event.log_kind === "note";
    return { ...base, groups: [group], title: event.summary || (note ? "Note" : human(event.log_kind)), tag: note ? "Note" : "Logged manually", tone: note ? "default" : "muted" };
  }
  if (event.event_type === "record_linked" || event.event_type === "document_updated") {
    const group = CHANNEL_GROUP[event.log_kind ?? ""] ?? "update";
    return { ...base, groups: [group], title: event.summary || human(event.log_kind), tag: status ? human(status) : "Record", tone: toneFor(status) };
  }
  if (event.event_type === "quote_linked" || event.event_type === "quote_revised" || event.event_type === "quote_updated") {
    return { ...base, groups: ["quote"], title: event.summary || "Quote updated", tag: "Quote", tone: "default" };
  }
  return { ...base, groups: ["update"], title: event.summary || human(event.event_type), tag: "Pipeline", tone: "muted" };
}

export function buildTimeline(input: {
  events: OpportunityEvent[];
  messages: RelatedMessage[];
  appointments: RelatedAppointment[];
  payments: RelatedPayment[];
}): TimelineItem[] {
  const items: TimelineItem[] = [];
  const messageIds = new Set<string>();
  const appointmentIds = new Set<string>();
  const invoiceIds = new Set<string>();

  for (const event of input.events) {
    if (event.event_type === "fields_updated") continue;
    const details = event.details ?? {};
    const messageId = str(details.message_id);
    const appointmentId = str(details.appointment_id);
    const paymentId = str(details.payment_id);
    if (messageId) messageIds.add(messageId);
    if (appointmentId) appointmentIds.add(appointmentId);
    if (paymentId && event.log_kind === "invoice") invoiceIds.add(paymentId);
    items.push(fromEvent(event));
  }

  for (const message of input.messages) {
    // Sent from the workspace: the pipeline event already represents it.
    if (messageIds.has(message.id)) continue;
    const group: TimelineGroup = message.channel === "sms" ? "sms" : message.channel === "email" ? "email" : "update";
    items.push({
      id: `message-${message.id}`,
      at: message.sent_at || message.created_at,
      groups: [group],
      title: `${human(message.direction)} ${message.channel}${message.subject ? `: ${message.subject}` : ""}`,
      body: message.body,
      tag: message.sent_at ? "Messages" : "Messages · not sent",
      tone: message.sent_at ? "default" : "warning",
      actorId: null,
      eventId: null,
      kind: message.channel,
      amount: null,
      details: { order_id: message.order_id },
    });
  }

  for (const appointment of input.appointments) {
    if (appointmentIds.has(appointment.id)) continue;
    items.push({
      id: `appointment-${appointment.id}`,
      at: appointment.start_time,
      groups: ["meeting"],
      title: appointment.title,
      body: null,
      tag: `Booking · ${human(appointment.status)}`,
      tone: toneFor(appointment.status),
      actorId: null,
      eventId: null,
      kind: "meeting",
      amount: null,
      details: { location_type: appointment.location_type },
    });
  }

  for (const payment of input.payments) {
    const paid = PAID.has(payment.status);
    const groups: TimelineGroup[] = [];
    if (!invoiceIds.has(payment.id)) groups.push("invoice");
    if (paid) groups.push("payment");
    if (!groups.length) continue;
    items.push({
      id: `payment-${payment.id}`,
      at: payment.created_at || new Date(0).toISOString(),
      groups,
      title: `${paid ? "Payment" : "Invoice"}${payment.invoice_number ? ` ${payment.invoice_number}` : ""}`,
      body: payment.balance_due ? `Balance due ${payment.balance_due}` : null,
      tag: `Payments · ${human(payment.status)}`,
      tone: toneFor(payment.status),
      actorId: null,
      eventId: null,
      kind: paid ? "payment" : "invoice",
      amount: payment.amount === null ? null : Number(payment.amount),
      details: { order_id: payment.order_id },
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export type TabCount = { total: number; unseen: number };

/** Per-tab totals and "new since you last looked" counts. `seen` maps tab key to an ISO time. */
export function tabCounts(items: TimelineItem[], seen: Partial<Record<TimelineTabKey, string>>): Record<TimelineTabKey, TabCount> {
  const out = {} as Record<TimelineTabKey, TabCount>;
  for (const tab of TIMELINE_TABS) {
    const rows = tab.key === "all" ? items : items.filter((item) => item.groups.includes(tab.key as TimelineGroup));
    const mark = seen[tab.key];
    const markTime = mark ? new Date(mark).getTime() : null;
    out[tab.key] = {
      total: rows.length,
      unseen: markTime === null ? rows.length : rows.filter((item) => new Date(item.at).getTime() > markTime).length,
    };
  }
  return out;
}
