import { describe, expect, it } from "vitest";

import { aiPrompt, buildOpportunityBrief, splitEmailDraft } from "@/lib/pipeline/ai-brief";
import { toE164 } from "@/lib/pipeline/comm-server";
import { buildTimeline, tabCounts } from "@/lib/pipeline/timeline";
import type { Opportunity, OpportunityEvent } from "@/lib/pipeline/types";

const event = (over: Partial<OpportunityEvent>): OpportunityEvent => ({
  id: "e1", opportunity_id: "o1", event_type: "manual_log", from_stage: null, to_stage: null, from_owner_id: null, to_owner_id: null,
  log_kind: null, summary: null, body: null, details: {}, is_manual_log: false, occurred_at: "2026-09-10T10:00:00Z", actor_id: "u1", created_at: "",
  ...over,
});

describe("buildTimeline", () => {
  const events = [
    event({ id: "sms", event_type: "communication", log_kind: "sms", summary: "Text to +14805550142", details: { status: "delivered", message_id: "m1" }, occurred_at: "2026-09-12T10:00:00Z" }),
    event({ id: "note", event_type: "manual_log", log_kind: "note", is_manual_log: true, summary: "Called about sizes", occurred_at: "2026-09-11T10:00:00Z" }),
    event({ id: "call", event_type: "manual_log", log_kind: "call", is_manual_log: true, occurred_at: "2026-09-09T10:00:00Z" }),
    event({ id: "inv", event_type: "record_linked", log_kind: "invoice", summary: "Invoice created", details: { payment_id: "p1", status: "pending" } }),
    event({ id: "sow", event_type: "document_updated", log_kind: "sow", summary: "SOW created", details: { status: "draft" } }),
    event({ id: "stage", event_type: "stage_changed", summary: "Moved to Discovery" }),
    event({ id: "fields", event_type: "fields_updated", summary: "Updated budget" }),
  ];

  const items = buildTimeline({
    events,
    messages: [
      { id: "m1", channel: "sms", direction: "outbound", subject: null, body: "dupe", sent_at: "2026-09-12T10:00:00Z", created_at: "2026-09-12T10:00:00Z", order_id: null },
      { id: "m2", channel: "email", direction: "inbound", subject: "Re: banners", body: "yes", sent_at: "2026-09-13T10:00:00Z", created_at: "2026-09-13T10:00:00Z", order_id: null },
    ],
    appointments: [{ id: "a1", title: "Design consult", start_time: "2026-09-20T17:00:00Z", status: "confirmed", location_type: "phone_call" }],
    payments: [
      { id: "p1", order_id: "o", status: "paid", amount: 500, invoice_number: "INV-1", balance_due: 0, created_at: "2026-09-12T12:00:00Z" },
      { id: "p2", order_id: "o", status: "pending", amount: 200, invoice_number: "INV-2", balance_due: 200, created_at: "2026-09-12T13:00:00Z" },
    ],
  });

  it("does not show a workspace-sent message twice", () => {
    expect(items.filter((item) => item.groups.includes("sms"))).toHaveLength(1);
    expect(items.some((item) => item.id === "message-m2")).toBe(true);
  });

  it("labels manual logs honestly and keeps notes as notes", () => {
    expect(items.find((item) => item.id === "call")?.tag).toBe("Logged manually");
    expect(items.find((item) => item.id === "note")?.tag).toBe("Note");
    expect(items.find((item) => item.id === "sms")?.tag).toBe("Twilio · delivered");
  });

  it("groups records under their quick-action tabs and hides field edits", () => {
    expect(items.find((item) => item.id === "sow")?.groups).toEqual(["sow"]);
    expect(items.find((item) => item.id === "stage")?.groups).toEqual(["update"]);
    expect(items.some((item) => item.id === "fields")).toBe(false);
  });

  it("shows a paid invoice under Payments without repeating it under Invoices", () => {
    expect(items.find((item) => item.id === "payment-p1")?.groups).toEqual(["payment"]);
    expect(items.find((item) => item.id === "payment-p2")?.groups).toEqual(["invoice"]);
  });

  it("orders newest first", () => {
    expect(items[0].id).toBe("appointment-a1");
  });

  it("counts totals and unseen per tab", () => {
    const counts = tabCounts(items, { sms: "2026-09-12T11:00:00Z" });
    expect(counts.sms).toEqual({ total: 1, unseen: 0 });
    expect(counts.email).toEqual({ total: 1, unseen: 1 });
    expect(counts.all.total).toBe(items.length);
  });
});

describe("AI brief", () => {
  const opportunity = {
    id: "o1", opportunity_number: "OPP-1", name: "Fleet wrap", stage: "quote_sent", probability: 60, estimated_value: 0,
    service_category: "vehicle_wraps", description: "Three vans", source: null, customer_user_id: null, contact_name: "Dana", contact_email: null,
    contact_phone: null, company: "Oasis", source_submission_id: null, owner_id: "u1", expected_close_date: null, requested_completion_date: "2026-10-01",
    is_rush: true, fulfillment_method: "installation", fulfillment_notes: null, artwork_source: "design_services", artwork_status: null, budget: 9000,
    decision_makers: null, next_action: null, next_action_type: null, next_action_due: null, po_number: null, payment_terms: null, deposit_status: null,
    billing_confirmed: false, checklist: {}, extra_items: [], stage_entered_at: "", closed_at: null, won_summary: null, lost_reason: null, lost_notes: null,
    competitor: null, hold_reason: null, hold_follow_up_date: null, hold_from_stage: null, reopened_at: null, won_order_id: null, won_project_id: null,
    conversion_token: null, conversion_started_at: null, notes: null, created_by: null, created_at: "", updated_at: "",
  } as Opportunity;

  it("includes only facts from the record", () => {
    const brief = buildOpportunityBrief({ opportunity, lineItems: [], currentQuote: null, events: [], ownerName: "Jeremy", customerName: null });
    expect(brief).toContain("Stage: Quote Sent");
    expect(brief).toContain("(rush)");
    expect(brief).toContain("Current quote: none linked");
    const { system } = aiPrompt("summary", brief, null);
    expect(system).toContain("Never state or imply that a message was sent");
  });

  it("splits an email draft", () => {
    expect(splitEmailDraft("Subject: Your wrap quote\n\nHi Dana,\nThanks")).toEqual({ subject: "Your wrap quote", body: "Hi Dana,\nThanks" });
    expect(splitEmailDraft("Hi Dana")).toEqual({ subject: "", body: "Hi Dana" });
  });
});

describe("toE164", () => {
  it("normalizes US numbers for Twilio", () => {
    expect(toE164("(480) 555-0142")).toBe("+14805550142");
    expect(toE164("+1 480 555 0142")).toBe("+14805550142");
    expect(toE164("")).toBe("");
  });
});
