// Stage guidance and checklists.
//
// Defaults ship here as data. Administrators can change each stage's
// probability, goal, suggested actions, and checklist items (stored in
// pipeline_stage_settings). Items with an `auto` predicate tick themselves from
// the record; the predicate is looked up by item id, so a renamed built-in item
// keeps working as long as it is kept.

import {
  ACTIVE_STAGES,
  PIPELINE_PATH,
  STAGE_META,
  STAGE_ORDER,
  type PipelineStage,
  serviceCategory,
} from "@/lib/pipeline/stages";
import type {
  Opportunity,
  OpportunityLineItem,
  OpportunityQuote,
  StageConfigMap,
  StoredStageConfig,
} from "@/lib/pipeline/types";

export type ChecklistContext = {
  opportunity: Opportunity;
  lineItems: OpportunityLineItem[];
  currentQuote: OpportunityQuote | null;
};

export type ChecklistItem = {
  id: string;
  label: string;
  required?: boolean;
  auto?: (ctx: ChecklistContext) => boolean;
};

export type StageGuide = { goal: string; actions: string[]; items: ChecklistItem[] };

const filled = (value: string | null | undefined) => Boolean(value && value.trim());
const hasNextAction = ({ opportunity: o }: ChecklistContext) => filled(o.next_action) && Boolean(o.next_action_due);
const hasContact = ({ opportunity: o }: ChecklistContext) =>
  Boolean(o.customer_user_id) || filled(o.contact_email) || filled(o.contact_phone);

/**
 * Only the specifications relevant to each line's service are required: a
 * design-only package needs no dimensions, a banner does.
 */
export function missingSpecifications(lineItems: OpportunityLineItem[]): string[] {
  const missing: string[] = [];
  lineItems.forEach((item, index) => {
    const name = item.description?.trim() || `Line ${index + 1}`;
    const category = serviceCategory(item.service_category);
    if (!category) {
      missing.push(`${name}: service category`);
      return;
    }
    if (category.requires.quantity && !(Number(item.quantity) > 0)) missing.push(`${name}: quantity`);
    if (category.requires.dimensions && (!(Number(item.width) > 0) || !(Number(item.height) > 0) || !item.dimension_unit)) {
      missing.push(`${name}: dimensions with units`);
    }
    if (category.requires.material && !filled(item.material)) missing.push(`${name}: material`);
  });
  return missing;
}

const quoteIs = (ctx: ChecklistContext, statuses: string[]) =>
  Boolean(ctx.currentQuote && statuses.includes(ctx.currentQuote.status));

export const DEFAULT_GUIDES: Record<PipelineStage, StageGuide> = {
  new_inquiry: {
    goal: "Capture the request, get it owned, and schedule the first response.",
    actions: [
      "Confirm who is asking and how to reach them.",
      "Write a one-line project summary (what, roughly how many, by when).",
      "Record where the inquiry came from.",
      "Schedule the next action.",
    ],
    items: [
      { id: "owner", label: "Salesperson assigned", required: true, auto: ({ opportunity: o }) => Boolean(o.owner_id) },
      { id: "contact", label: "Contact details captured", required: true, auto: hasContact },
      {
        id: "summary",
        label: "Project summary or service selected",
        required: true,
        auto: ({ opportunity: o }) => filled(o.description) || Boolean(o.service_category),
      },
      { id: "source", label: "Request source recorded", auto: ({ opportunity: o }) => filled(o.source) },
      { id: "next", label: "Next action scheduled", required: true, auto: hasNextAction },
    ],
  },
  discovery: {
    goal: "Confirm exactly what the customer needs before anyone prices it.",
    actions: [
      "Add a line item per product or service (cards, banners, shirts are separate lines).",
      "Capture quantity, dimensions with units, material, and finishing where they apply.",
      "Confirm whether artwork is supplied or design services are needed.",
      "Confirm budget, requested completion date, and pickup, shipping, delivery, or installation.",
    ],
    items: [
      { id: "line_items", label: "At least one line item added", required: true, auto: ({ lineItems }) => lineItems.length > 0 },
      {
        id: "specs",
        label: "Relevant specifications captured for every line",
        required: true,
        auto: ({ lineItems }) => lineItems.length > 0 && missingSpecifications(lineItems).length === 0,
      },
      { id: "artwork", label: "Artwork supplied vs. design services confirmed", required: true, auto: ({ opportunity: o }) => Boolean(o.artwork_source) },
      { id: "fulfillment", label: "Pickup, shipping, delivery, or installation confirmed", required: true, auto: ({ opportunity: o }) => Boolean(o.fulfillment_method) },
      { id: "completion", label: "Requested completion date captured", auto: ({ opportunity: o }) => Boolean(o.requested_completion_date) },
      { id: "budget", label: "Budget discussed", auto: ({ opportunity: o }) => Number(o.budget) > 0 },
      { id: "next", label: "Next action scheduled", auto: hasNextAction },
    ],
  },
  estimating: {
    goal: "Price the job in the existing quoting workflow and link the quote here.",
    actions: [
      "Create the quote in Orders (status: Quote requested) — do not price outside it.",
      "Account for printing, materials, design labor, finishing, vendor costs, shipping, and installation.",
      "Link the quote to this opportunity so its amount drives the forecast.",
    ],
    items: [
      { id: "quote_linked", label: "Quote linked to this opportunity", required: true, auto: (ctx) => Boolean(ctx.currentQuote) },
      { id: "costs", label: "Materials, labor, finishing, vendor, shipping, and install costs accounted for", required: true },
      { id: "value", label: "Quote amount recorded", auto: (ctx) => Number(ctx.currentQuote?.amount) > 0 },
    ],
  },
  quote_sent: {
    goal: "Make sure the customer has the quote and a follow-up is on the calendar.",
    actions: [
      "Record when the quote was sent and when it expires.",
      "Schedule the follow-up before moving on.",
      "A revised quote is a new version on this opportunity, never a new opportunity.",
    ],
    items: [
      { id: "sent", label: "Quote marked sent with a sent date", required: true, auto: (ctx) => Boolean(ctx.currentQuote?.sent_at) && !quoteIs(ctx, ["draft"]) },
      { id: "expiry", label: "Expiration date recorded", auto: (ctx) => Boolean(ctx.currentQuote?.expires_at) },
      { id: "follow_up", label: "Follow-up scheduled", required: true, auto: hasNextAction },
    ],
  },
  follow_up: {
    goal: "Answer questions, handle revisions, and get to a decision.",
    actions: [
      "Capture questions and requested changes to quantities or specifications.",
      "Issue a new quote version for any pricing change.",
      "Identify who makes the final decision.",
      "Agree the next action required to move forward.",
    ],
    items: [
      { id: "decision_makers", label: "Decision-makers identified", auto: ({ opportunity: o }) => filled(o.decision_makers) },
      { id: "questions", label: "Questions and revision requests captured" },
      { id: "revision_current", label: "Latest requested revision is quoted", auto: (ctx) => Boolean(ctx.currentQuote) && !quoteIs(ctx, ["revision_requested"]) },
      { id: "next", label: "Next action scheduled", required: true, auto: hasNextAction },
    ],
  },
  approved: {
    goal: "Complete order setup: accepted quote, billing, PO, and deposit or approved terms.",
    actions: [
      "Mark the accepted quote version as accepted.",
      "Confirm billing contact and details.",
      "Capture the purchase order number when the customer uses one.",
      "Confirm a deposit is received, or that approved payment terms make one unnecessary.",
    ],
    items: [
      { id: "accepted_quote", label: "Accepted quote recorded", required: true, auto: (ctx) => quoteIs(ctx, ["accepted"]) },
      { id: "billing", label: "Billing details confirmed", required: true, auto: ({ opportunity: o }) => o.billing_confirmed },
      {
        id: "deposit_or_terms",
        label: "Deposit received or approved terms recorded",
        required: true,
        auto: ({ opportunity: o }) => o.deposit_status === "received" || o.deposit_status === "not_required" || filled(o.payment_terms),
      },
      { id: "po", label: "Purchase order captured (when applicable)", auto: ({ opportunity: o }) => filled(o.po_number) },
      { id: "customer", label: "Customer record linked", auto: ({ opportunity: o }) => Boolean(o.customer_user_id) },
    ],
  },
  closed_won: {
    goal: "The sale is confirmed. Fulfillment continues on the linked order.",
    actions: [
      "Open the linked order to continue design, proofing, prepress, production, and delivery.",
      "Closed Won does not approve artwork or authorize printing.",
    ],
    items: [
      { id: "order", label: "Order linked", auto: ({ opportunity: o }) => Boolean(o.won_order_id) },
      { id: "summary", label: "Won summary recorded", auto: ({ opportunity: o }) => filled(o.won_summary) },
    ],
  },
  closed_lost: {
    goal: "Record why, so the pattern is reportable and the customer can be approached again.",
    actions: ["Record the loss reason.", "Note the competitor if there was one."],
    items: [{ id: "reason", label: "Loss reason recorded", required: true, auto: ({ opportunity: o }) => filled(o.lost_reason) }],
  },
  on_hold: {
    goal: "Park the job with a reason and a date to revisit it.",
    actions: ["Record why it is on hold.", "Set the follow-up date.", "Reactivate it when the customer is ready."],
    items: [
      { id: "reason", label: "Hold reason recorded", required: true, auto: ({ opportunity: o }) => filled(o.hold_reason) },
      { id: "follow_up", label: "Follow-up date set", required: true, auto: ({ opportunity: o }) => Boolean(o.hold_follow_up_date) },
    ],
  },
};

export function defaultStageConfig(stage: PipelineStage): StoredStageConfig {
  const guide = DEFAULT_GUIDES[stage];
  return {
    probability: STAGE_META[stage].probability,
    goal: guide.goal,
    actions: [...guide.actions],
    items: guide.items.map((item) => ({ id: item.id, label: item.label, required: item.required })),
  };
}

export function isAutoItem(stage: PipelineStage, itemId: string) {
  return Boolean(DEFAULT_GUIDES[stage].items.find((item) => item.id === itemId)?.auto);
}

/** Probability for a stage: the configured value for active stages; fixed for outcomes. */
export function stageProbability(stage: PipelineStage, config: StageConfigMap | null | undefined) {
  if (stage === "closed_won") return 100;
  if (stage === "closed_lost" || stage === "on_hold") return 0;
  const configured = config?.[stage]?.probability;
  return typeof configured === "number" && configured >= 0 && configured <= 100 ? configured : STAGE_META[stage].probability;
}

/** The guide for a stage: the stored version when edited, the default otherwise, plus this opportunity's own steps. */
export function resolveGuide(stage: PipelineStage, config: StageConfigMap | null | undefined, opportunity?: Opportunity | null): StageGuide {
  const stored = config?.[stage] ?? defaultStageConfig(stage);
  const defaults = DEFAULT_GUIDES[stage].items;
  const extras = (opportunity?.extra_items ?? []).filter((item) => item.stage === stage);
  return {
    goal: stored.goal,
    actions: stored.actions,
    items: [
      ...stored.items.map((item) => ({ ...item, auto: defaults.find((d) => d.id === item.id)?.auto })),
      ...extras.map((item) => ({ id: item.id, label: item.label, required: item.required })),
    ],
  };
}

export type ChecklistState = { item: ChecklistItem; done: boolean; automatic: boolean; custom: boolean };

export function checklistFor(ctx: ChecklistContext, config: StageConfigMap | null | undefined, stage: PipelineStage = ctx.opportunity.stage): ChecklistState[] {
  const custom = new Set((ctx.opportunity.extra_items ?? []).map((item) => item.id));
  return resolveGuide(stage, config, ctx.opportunity).items.map((item) => {
    const automatic = Boolean(item.auto?.(ctx));
    return {
      item,
      automatic,
      done: automatic || Boolean(ctx.opportunity.checklist?.[`${stage}:${item.id}`]),
      custom: custom.has(item.id),
    };
  });
}

export function blockingItems(ctx: ChecklistContext, config: StageConfigMap | null | undefined, stage: PipelineStage = ctx.opportunity.stage) {
  return checklistFor(ctx, config, stage).filter((state) => state.item.required && !state.done).map((state) => state.item);
}

/** Sanitise an administrator's stage configuration before it is stored. */
export function sanitizeStageConfig(input: unknown): StageConfigMap {
  const out: StageConfigMap = {};
  if (!input || typeof input !== "object") return out;
  const record = input as Record<string, unknown>;
  for (const stage of STAGE_ORDER) {
    const raw = record[stage] as Partial<StoredStageConfig> | undefined;
    if (!raw || typeof raw !== "object") continue;
    const base = defaultStageConfig(stage);
    const probability = Number(raw.probability);
    const seen = new Set<string>();
    out[stage] = {
      probability: ACTIVE_STAGES.includes(stage) && Number.isFinite(probability)
        ? Math.max(0, Math.min(100, Math.round(probability)))
        : base.probability,
      goal: typeof raw.goal === "string" ? raw.goal.trim().slice(0, 500) : base.goal,
      actions: Array.isArray(raw.actions)
        ? raw.actions.map((a) => String(a ?? "").trim().slice(0, 300)).filter(Boolean).slice(0, 20)
        : base.actions,
      items: Array.isArray(raw.items)
        ? raw.items
            .map((item) => ({
              id: String(item?.id ?? "").trim().slice(0, 60),
              label: String(item?.label ?? "").trim().slice(0, 200),
              required: Boolean(item?.required),
            }))
            .filter((item) => item.id && item.label && !seen.has(item.id) && seen.add(item.id))
            .slice(0, 30)
        : base.items,
    };
  }
  return out;
}

export const nextPathStage = (stage: PipelineStage): PipelineStage | null => {
  const index = PIPELINE_PATH.indexOf(stage);
  return index >= 0 && index < PIPELINE_PATH.length - 1 ? PIPELINE_PATH[index + 1] : null;
};
