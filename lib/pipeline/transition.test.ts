import { describe, expect, it } from "vitest";

import { blockingItems, checklistFor, missingSpecifications, sanitizeStageConfig, stageProbability } from "@/lib/pipeline/guidance";
import { evaluateTransition, transitionNeedsInput, type TransitionContext } from "@/lib/pipeline/transition";
import { normalizeStage } from "@/lib/pipeline/stages";
import type { Opportunity, OpportunityLineItem, OpportunityQuote } from "@/lib/pipeline/types";

const NOW = new Date("2026-09-13T12:00:00Z");

function opp(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp1", opportunity_number: "OPP-TEST", name: "Storefront sign", stage: "new_inquiry", probability: 10,
    estimated_value: 0, service_category: "signage", description: "Illuminated storefront sign", source: "Website",
    customer_user_id: null, contact_name: "Dana", contact_email: "dana@example.com", contact_phone: null, company: "Dana's Deli",
    source_submission_id: null, owner_id: "rep1", expected_close_date: null, requested_completion_date: null, is_rush: false,
    fulfillment_method: null, fulfillment_notes: null, artwork_source: null, artwork_status: null, budget: null,
    decision_makers: null, next_action: "Call back", next_action_type: "call", next_action_due: "2026-09-15",
    po_number: null, payment_terms: null, deposit_status: null, billing_confirmed: false, checklist: {}, extra_items: [],
    stage_entered_at: NOW.toISOString(), closed_at: null, won_summary: null, lost_reason: null, lost_notes: null,
    competitor: null, hold_reason: null, hold_follow_up_date: null, hold_from_stage: null, reopened_at: null,
    won_order_id: null, won_project_id: null, conversion_token: null, conversion_started_at: null, notes: null,
    created_by: "rep1", created_at: NOW.toISOString(), updated_at: NOW.toISOString(),
    ...over,
  };
}

function line(over: Partial<OpportunityLineItem> = {}): OpportunityLineItem {
  return {
    id: "li1", opportunity_id: "opp1", position: 0, service_category: "signage", product_id: null, description: "Sign",
    quantity: 1, width: 96, height: 24, dimension_unit: "in", material: "Aluminum composite", finishing: null,
    artwork_source: null, unit_price_estimate: null, notes: null, created_at: "", updated_at: "",
    ...over,
  };
}

function quote(over: Partial<OpportunityQuote> = {}): OpportunityQuote {
  return {
    id: "q1", opportunity_id: "opp1", order_id: "ord1", version: 1, amount: 2400, status: "sent", is_current: true,
    sent_at: "2026-09-10T00:00:00Z", expires_at: "2026-10-10", follow_up_date: null, notes: null, created_by: null,
    created_at: "", updated_at: "",
    ...over,
  };
}

function ctx(o: Opportunity, extra: Partial<TransitionContext> = {}): TransitionContext {
  return { opportunity: o, lineItems: [], currentQuote: null, config: null, canOverride: false, now: NOW, ...extra };
}

describe("forward stage rules", () => {
  it("advances a complete New Inquiry to Discovery", () => {
    const result = evaluateTransition(ctx(opp()), { to: "discovery" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.stage).toBe("discovery");
      expect(result.patch.probability).toBe(25);
    }
  });

  it("blocks leaving New Inquiry without an owner or next action", () => {
    const result = evaluateTransition(ctx(opp({ owner_id: null, next_action: null })), { to: "discovery" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocking).toContain("Salesperson assigned");
      expect(result.blocking).toContain("Next action scheduled");
      expect(result.overridable).toBe(false);
    }
  });

  it("only requires the specifications relevant to each service", () => {
    expect(missingSpecifications([line({ service_category: "graphic_design", quantity: null, width: null, height: null, material: null })])).toEqual([]);
    expect(missingSpecifications([line({ service_category: "banners_large_format", width: null })])).toEqual(["Sign: dimensions with units"]);
    expect(missingSpecifications([line({ service_category: "apparel", quantity: 0, width: null, height: null, material: "Cotton tee" })])).toEqual(["Sign: quantity"]);
  });

  it("requires a sent quote to enter Quote Sent", () => {
    const o = opp({ stage: "estimating", checklist: { "estimating:costs": true } });
    const draft = evaluateTransition(ctx(o, { currentQuote: quote({ status: "draft", sent_at: null }) }), { to: "quote_sent" });
    expect(draft.ok).toBe(false);
    const sent = evaluateTransition(ctx(o, { currentQuote: quote() }), { to: "quote_sent" });
    expect(sent.ok).toBe(true);
  });

  it("lets a straightforward approval skip Follow-Up & Revisions", () => {
    const o = opp({ stage: "quote_sent" });
    const result = evaluateTransition(ctx(o, { currentQuote: quote({ status: "accepted" }) }), { to: "approved" });
    expect(result.ok).toBe(true);
  });

  it("requires accepted quote, billing and deposit-or-terms for Closed Won", () => {
    const o = opp({ stage: "approved" });
    const blocked = evaluateTransition(ctx(o, { currentQuote: quote({ status: "accepted" }) }), { to: "closed_won", wonSummary: "Signed" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.blocking).toEqual(expect.arrayContaining(["Billing details confirmed"]));

    // Approved terms satisfy the requirement without a deposit.
    const onTerms = opp({ stage: "approved", billing_confirmed: true, payment_terms: "Net 30" });
    const won = evaluateTransition(ctx(onTerms, { currentQuote: quote({ status: "accepted" }) }), { to: "closed_won" });
    expect(won.ok).toBe(true);
    if (won.ok) {
      expect(won.requiresConversion).toBe(true);
      expect(won.patch.probability).toBe(100);
      expect(won.patch.closed_at).toBe(NOW.toISOString());
    }
  });

  it("moving backward between active stages needs no checklist", () => {
    const result = evaluateTransition(ctx(opp({ stage: "estimating", owner_id: null })), { to: "discovery" });
    expect(result.ok).toBe(true);
  });
});

describe("authorized exceptions", () => {
  const incomplete = opp({ next_action: null });

  it("offers an override only to users who may grant one", () => {
    const denied = evaluateTransition(ctx(incomplete), { to: "discovery", overrideReason: "Customer called in" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.overridable).toBe(false);

    const needsReason = evaluateTransition(ctx(incomplete, { canOverride: true }), { to: "discovery" });
    expect(needsReason.ok).toBe(false);
    if (!needsReason.ok) expect(needsReason.overridable).toBe(true);

    const granted = evaluateTransition(ctx(incomplete, { canOverride: true }), { to: "discovery", overrideReason: "Walk-in customer" });
    expect(granted.ok).toBe(true);
    if (granted.ok) {
      expect(granted.usedOverride).toBe(true);
      expect(granted.bypassed).toContain("Next action scheduled");
    }
  });
});

describe("outcomes and reopening", () => {
  it("Closed Lost needs a reason but no unrelated checklist", () => {
    const o = opp({ stage: "discovery", owner_id: null, next_action: null });
    expect(evaluateTransition(ctx(o), { to: "closed_lost" }).ok).toBe(false);
    const lost = evaluateTransition(ctx(o), { to: "closed_lost", lostReason: "Price", competitor: "SignCo" });
    expect(lost.ok).toBe(true);
    if (lost.ok) expect(lost.patch).toMatchObject({ stage: "closed_lost", probability: 0, lost_reason: "Price", competitor: "SignCo" });
  });

  it("On Hold needs a reason and follow-up date, and remembers where it came from", () => {
    const o = opp({ stage: "quote_sent" });
    const missing = evaluateTransition(ctx(o), { to: "on_hold", holdReason: "Budget cycle" });
    expect(missing.ok).toBe(false);
    const held = evaluateTransition(ctx(o), { to: "on_hold", holdReason: "Budget cycle", holdFollowUpDate: "2026-11-01" });
    expect(held.ok).toBe(true);
    if (held.ok) expect(held.patch).toMatchObject({ hold_from_stage: "quote_sent", probability: 0, hold_follow_up_date: "2026-11-01" });
  });

  it("reopening Closed Lost requires a reason and clears the live outcome", () => {
    const o = opp({ stage: "closed_lost", lost_reason: "Timing", closed_at: NOW.toISOString() });
    expect(evaluateTransition(ctx(o), { to: "discovery" }).ok).toBe(false);
    const reopened = evaluateTransition(ctx(o), { to: "discovery", reopenReason: "Budget approved" });
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      expect(reopened.isReopen).toBe(true);
      expect(reopened.patch).toMatchObject({ stage: "discovery", closed_at: null, lost_reason: null, reopened_at: NOW.toISOString() });
    }
  });

  it("reactivating On Hold needs no reopen reason", () => {
    const o = opp({ stage: "on_hold", hold_reason: "Budget", hold_follow_up_date: "2026-10-01", hold_from_stage: "discovery" });
    const result = evaluateTransition(ctx(o), { to: "discovery" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch.hold_reason).toBeNull();
  });

  it("reports which dialog input a move needs", () => {
    expect(transitionNeedsInput("discovery", "closed_lost")).toBe("lost");
    expect(transitionNeedsInput("discovery", "on_hold")).toBe("hold");
    expect(transitionNeedsInput("closed_won", "approved")).toBe("reopen");
    expect(transitionNeedsInput("on_hold", "discovery")).toBeNull();
  });
});

describe("stage configuration", () => {
  it("uses configured probabilities for active stages only", () => {
    const config = sanitizeStageConfig({ estimating: { probability: 55, goal: "g", actions: [], items: [] }, closed_won: { probability: 20 } });
    expect(stageProbability("estimating", config)).toBe(55);
    expect(stageProbability("closed_won", config)).toBe(100);
    expect(stageProbability("on_hold", config)).toBe(0);
  });

  it("keeps automatic ticks for built-in items and supports admin-required items", () => {
    const config = sanitizeStageConfig({
      new_inquiry: { probability: 10, goal: "g", actions: [], items: [{ id: "owner", label: "Rep assigned", required: true }, { id: "credit", label: "Credit check", required: true }] },
    });
    const o = opp();
    const states = checklistFor({ opportunity: o, lineItems: [], currentQuote: null }, config);
    expect(states.find((s) => s.item.id === "owner")?.automatic).toBe(true);
    expect(blockingItems({ opportunity: o, lineItems: [], currentQuote: null }, config).map((i) => i.label)).toEqual(["Credit check"]);
    const ticked = opp({ checklist: { "new_inquiry:credit": true } });
    expect(evaluateTransition(ctx(ticked, { config }), { to: "discovery" }).ok).toBe(true);
  });

  it("maps imported stage keys and defaults unknown ones to New Inquiry", () => {
    expect(normalizeStage("proposal")).toBe("quote_sent");
    expect(normalizeStage("nurture")).toBe("on_hold");
    expect(normalizeStage("mystery")).toBe("new_inquiry");
  });
});
