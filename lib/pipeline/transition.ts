// The single stage-transition rule set.
//
// Every stage change — board drag, list menu, workspace path, API call — goes
// through POST /api/admin/pipeline/opportunities/:id/transition, which calls
// evaluateTransition. The client may call it too for a preview, but only the
// server's result is applied.

import { blockingItems, stageProbability, type ChecklistContext } from "@/lib/pipeline/guidance";
import {
  ACTIVE_STAGES,
  PIPELINE_PATH,
  SKIPPABLE_STAGES,
  STAGE_META,
  isActiveStage,
  type PipelineStage,
} from "@/lib/pipeline/stages";
import type { Opportunity, StageConfigMap } from "@/lib/pipeline/types";

export type TransitionInput = {
  to: PipelineStage;
  lostReason?: string | null;
  lostNotes?: string | null;
  competitor?: string | null;
  holdReason?: string | null;
  holdFollowUpDate?: string | null;
  wonSummary?: string | null;
  reopenReason?: string | null;
  /** An authorized exception: bypasses checklist and entry requirements, recorded with the change. */
  overrideReason?: string | null;
};

export type TransitionContext = ChecklistContext & {
  config: StageConfigMap | null;
  canOverride: boolean;
  now: Date;
};

export type TransitionPatch = Partial<
  Pick<
    Opportunity,
    | "stage"
    | "probability"
    | "stage_entered_at"
    | "closed_at"
    | "won_summary"
    | "lost_reason"
    | "lost_notes"
    | "competitor"
    | "hold_reason"
    | "hold_follow_up_date"
    | "hold_from_stage"
    | "reopened_at"
  >
>;

export type TransitionResult =
  | {
      ok: true;
      patch: TransitionPatch;
      usedOverride: boolean;
      /** Requirements that were bypassed by an authorized exception. */
      bypassed: string[];
      /** Closed Won must link or create the customer and order before the stage is saved. */
      requiresConversion: boolean;
      isReopen: boolean;
      note: string | null;
    }
  | {
      ok: false;
      status: 400 | 409 | 422;
      error: string;
      blocking: string[];
      /** True when the actor may retry with an override reason. */
      overridable: boolean;
    };

const isDate = (value: string | null | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
const text = (value: string | null | undefined) => (value ?? "").trim();

/** Hard entry rules for a target stage, independent of editable checklists. */
export function entryRequirements(ctx: ChecklistContext, to: PipelineStage): string[] {
  const { opportunity: o, currentQuote: q } = ctx;
  const missing: string[] = [];
  if (!o.owner_id && to !== "closed_lost") missing.push("An assigned salesperson");
  switch (to) {
    case "quote_sent":
    case "follow_up":
      if (!q) missing.push("A linked quote");
      else if (!q.sent_at || q.status === "draft") missing.push("The current quote marked as sent");
      break;
    case "approved":
      if (!q || q.status !== "accepted") missing.push("The accepted quote version marked as accepted");
      break;
    case "closed_won":
      if (!q || q.status !== "accepted") missing.push("The accepted quote version marked as accepted");
      if (!o.billing_confirmed) missing.push("Billing details confirmed");
      if (!(o.deposit_status === "received" || o.deposit_status === "not_required" || text(o.payment_terms))) {
        missing.push("Deposit received or approved payment terms recorded");
      }
      if (!o.customer_user_id && !text(o.contact_email)) missing.push("A linked customer or a contact email to create one");
      break;
    default:
      break;
  }
  return missing;
}

export function evaluateTransition(ctx: TransitionContext, input: TransitionInput): TransitionResult {
  const from = ctx.opportunity.stage;
  const to = input.to;
  const nowIso = ctx.now.toISOString();

  if (!(to in STAGE_META)) return { ok: false, status: 400, error: "Unknown stage.", blocking: [], overridable: false };
  if (from === to) return { ok: false, status: 409, error: `Already in ${STAGE_META[to].label}.`, blocking: [], overridable: false };

  const leavingOutcome = !isActiveStage(from);
  const isReopen = leavingOutcome && isActiveStage(to);
  const overrideReason = text(input.overrideReason);

  // Outcomes carry their own required data and never require unrelated checklists.
  if (to === "closed_lost") {
    if (!text(input.lostReason)) return { ok: false, status: 422, error: "Choose a loss reason.", blocking: ["Loss reason"], overridable: false };
    return {
      ok: true,
      usedOverride: false,
      bypassed: [],
      requiresConversion: false,
      isReopen: false,
      note: text(input.lostNotes) || null,
      patch: {
        stage: to,
        probability: 0,
        stage_entered_at: nowIso,
        closed_at: nowIso,
        lost_reason: text(input.lostReason),
        lost_notes: text(input.lostNotes) || null,
        competitor: text(input.competitor) || null,
        hold_reason: null,
        hold_follow_up_date: null,
      },
    };
  }

  if (to === "on_hold") {
    const blocking: string[] = [];
    if (!text(input.holdReason)) blocking.push("Hold reason");
    if (!isDate(input.holdFollowUpDate)) blocking.push("Follow-up date");
    if (blocking.length) return { ok: false, status: 422, error: "On Hold needs a reason and a follow-up date.", blocking, overridable: false };
    return {
      ok: true,
      usedOverride: false,
      bypassed: [],
      requiresConversion: false,
      isReopen: false,
      note: text(input.holdReason),
      patch: {
        stage: to,
        probability: 0,
        stage_entered_at: nowIso,
        closed_at: null,
        hold_reason: text(input.holdReason),
        hold_follow_up_date: input.holdFollowUpDate ?? null,
        hold_from_stage: isActiveStage(from) ? from : ctx.opportunity.hold_from_stage,
      },
    };
  }

  // Reopening a closed record is deliberate and must say why. Reactivating a hold does not.
  if ((from === "closed_won" || from === "closed_lost") && !text(input.reopenReason)) {
    return { ok: false, status: 422, error: "Give a reason for reopening this opportunity.", blocking: ["Reopen reason"], overridable: false };
  }

  // Checklist requirements for a forward move: the current stage (when it is on the
  // path) and every stage jumped over, except stages that may be skipped.
  const blocking: string[] = [];
  const fromIndex = PIPELINE_PATH.indexOf(from);
  const toIndex = PIPELINE_PATH.indexOf(to);
  const forward = toIndex > fromIndex;
  if (forward && fromIndex >= 0) {
    for (let i = fromIndex; i < toIndex; i += 1) {
      const stage = PIPELINE_PATH[i];
      if (i > fromIndex && SKIPPABLE_STAGES.includes(stage)) continue;
      for (const item of blockingItems(ctx, ctx.config, stage)) {
        blocking.push(i === fromIndex ? item.label : `${STAGE_META[stage].short}: ${item.label}`);
      }
    }
  }
  // Entry rules apply to any move into the target, including reopening and moving back.
  if (forward || isReopen || to === "closed_won") {
    blocking.push(...entryRequirements(ctx, to));
  }
  const unique = Array.from(new Set(blocking));

  let usedOverride = false;
  if (unique.length) {
    if (!ctx.canOverride) {
      return { ok: false, status: 422, error: `Finish ${STAGE_META[from].label} before moving to ${STAGE_META[to].label}.`, blocking: unique, overridable: false };
    }
    if (!overrideReason) {
      return { ok: false, status: 422, error: `Requirements for ${STAGE_META[to].label} are incomplete.`, blocking: unique, overridable: true };
    }
    usedOverride = true;
  }

  const patch: TransitionPatch = {
    stage: to,
    probability: stageProbability(to, ctx.config),
    stage_entered_at: nowIso,
    closed_at: to === "closed_won" ? nowIso : null,
  };
  if (to === "closed_won") patch.won_summary = text(input.wonSummary) || ctx.opportunity.won_summary || null;
  if (isReopen) {
    patch.reopened_at = nowIso;
    patch.hold_reason = null;
    patch.hold_follow_up_date = null;
    patch.hold_from_stage = null;
    // Outcome fields are cleared on the live record; the event log keeps what they were.
    patch.lost_reason = null;
    patch.lost_notes = null;
    patch.competitor = null;
  }

  return {
    ok: true,
    patch,
    usedOverride,
    bypassed: usedOverride ? unique : [],
    requiresConversion: to === "closed_won",
    isReopen,
    note: text(input.reopenReason) || text(input.wonSummary) || null,
  };
}

/** Which inputs the UI must collect before submitting a move to this stage. */
export function transitionNeedsInput(from: PipelineStage, to: PipelineStage): "lost" | "hold" | "reopen" | "won" | null {
  if (to === "closed_lost") return "lost";
  if (to === "on_hold") return "hold";
  if (to === "closed_won") return "won";
  if ((from === "closed_won" || from === "closed_lost") && ACTIVE_STAGES.includes(to)) return "reopen";
  return null;
}
