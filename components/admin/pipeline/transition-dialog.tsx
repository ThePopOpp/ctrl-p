"use client";

import { useCallback, useState } from "react";
import { CircleAlert, ShieldAlert } from "lucide-react";

import { FormLabel, SelectField } from "@/components/admin/pipeline/pipeline-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PipelineApiError, errorMessage, pipelineRequest } from "@/lib/pipeline/client";
import { HOLD_REASONS, LOST_REASONS, STAGE_META, type PipelineStage } from "@/lib/pipeline/stages";
import { transitionNeedsInput } from "@/lib/pipeline/transition";
import type { Opportunity } from "@/lib/pipeline/types";

export type TransitionTarget = { id: string; name: string; stage: PipelineStage };

export type TransitionResponse = {
  opportunity: Opportunity;
  conversion: { orderId: string; orderNumber: string | null; customerCreated: boolean; orderCreated: boolean; alreadyConverted: boolean } | null;
};

type DialogState = { target: TransitionTarget; to: PipelineStage; blocking: string[]; overridable: boolean; error: string | null };

export type Notice = { tone: "success" | "error"; message: string } | null;

function successMessage(to: PipelineStage, result: TransitionResponse) {
  if (to === "closed_won" && result.conversion) {
    const order = result.conversion.orderNumber ?? "order";
    return `Closed Won. ${result.conversion.orderCreated ? "Created" : "Linked"} ${order}; production continues on the order.`;
  }
  return `Moved to ${STAGE_META[to].label}.`;
}

/**
 * The one client entry point for stage changes. Board drops, list menus, the
 * quick view and the workspace all call `request`, which posts to the shared
 * server transition. Inputs (loss reason, hold date, reopen reason) and blocked
 * requirements are collected in the same dialog everywhere.
 */
export function useStageTransition(onChanged: (result: TransitionResponse) => void | Promise<void>) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const submit = useCallback(
    async (target: TransitionTarget, to: PipelineStage, fields: Record<string, string | null>, fromDialog: boolean) => {
      setPendingId(target.id);
      setNotice(null);
      try {
        const result = await pipelineRequest<TransitionResponse>(`/opportunities/${target.id}/transition`, {
          method: "POST",
          body: { to_stage: to, ...fields },
        });
        setDialog(null);
        setNotice({ tone: "success", message: successMessage(to, result) });
        await onChanged(result);
      } catch (error) {
        if (error instanceof PipelineApiError && (error.status === 422 || fromDialog)) {
          setDialog({ target, to, blocking: error.blocking, overridable: error.overridable, error: error.message });
        } else {
          setNotice({ tone: "error", message: errorMessage(error, "The stage was not changed.") });
        }
      } finally {
        setPendingId(null);
      }
    },
    [onChanged],
  );

  const request = useCallback(
    (target: TransitionTarget, to: PipelineStage) => {
      if (target.stage === to) return;
      if (transitionNeedsInput(target.stage, to)) {
        setDialog({ target, to, blocking: [], overridable: false, error: null });
        return;
      }
      void submit(target, to, {}, false);
    },
    [submit],
  );

  const element = (
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && !pendingId && setDialog(null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {dialog && (
          <TransitionForm
            key={`${dialog.target.id}:${dialog.to}`}
            state={dialog}
            pending={pendingId === dialog.target.id}
            onCancel={() => setDialog(null)}
            onSubmit={(fields) => submit(dialog.target, dialog.to, fields, true)}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  return { request, element, pendingId, notice, clearNotice: () => setNotice(null) };
}

function TransitionForm({
  state,
  pending,
  onCancel,
  onSubmit,
}: {
  state: DialogState;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fields: Record<string, string | null>) => void;
}) {
  const { target, to, blocking, overridable, error } = state;
  const need = transitionNeedsInput(target.stage, to);
  const [lostReason, setLostReason] = useState<string>("");
  const [competitor, setCompetitor] = useState("");
  const [notes, setNotes] = useState("");
  const [holdReason, setHoldReason] = useState<string>("");
  const [holdDetail, setHoldDetail] = useState("");
  const [holdDate, setHoldDate] = useState("");
  const [wonSummary, setWonSummary] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const inputsReady =
    need === "lost" ? Boolean(lostReason) :
    need === "hold" ? Boolean(holdReason && holdDate) :
    need === "reopen" ? Boolean(reopenReason.trim()) :
    true;
  const blockedWithoutOverride = blocking.length > 0 && !overridable;
  const needsOverride = blocking.length > 0 && overridable;
  const canSubmit = inputsReady && !blockedWithoutOverride && (!needsOverride || overrideReason.trim().length > 0) && !pending;

  function submit() {
    const fields: Record<string, string | null> = {};
    if (need === "lost") {
      fields.lost_reason = lostReason;
      fields.competitor = competitor.trim() || null;
      fields.lost_notes = notes.trim() || null;
    }
    if (need === "hold") {
      fields.hold_reason = holdDetail.trim() ? `${holdReason} — ${holdDetail.trim()}` : holdReason;
      fields.hold_follow_up_date = holdDate;
    }
    if (need === "won") fields.won_summary = wonSummary.trim() || null;
    if (need === "reopen") fields.reopen_reason = reopenReason.trim();
    if (needsOverride) fields.override_reason = overrideReason.trim();
    onSubmit(fields);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{need === "reopen" ? `Reopen to ${STAGE_META[to].label}` : `Move to ${STAGE_META[to].label}`}</DialogTitle>
        <DialogDescription>{target.name} · currently {STAGE_META[target.stage].label}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {need === "lost" && (
          <>
            <FormLabel label="Loss reason (required)">
              <SelectField value={lostReason} onChange={(event) => setLostReason(event.target.value)}>
                <option value="">Choose a reason</option>
                {LOST_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </SelectField>
            </FormLabel>
            <FormLabel label="Competitor (if any)">
              <Input value={competitor} onChange={(event) => setCompetitor(event.target.value)} />
            </FormLabel>
            <FormLabel label="Notes">
              <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What happened?" />
            </FormLabel>
            <p className="text-xs text-muted-foreground">The opportunity, customer, files and history are kept for reporting. It can be reopened later.</p>
          </>
        )}

        {need === "hold" && (
          <>
            <FormLabel label="Hold reason (required)">
              <SelectField value={holdReason} onChange={(event) => setHoldReason(event.target.value)}>
                <option value="">Choose a reason</option>
                {HOLD_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </SelectField>
            </FormLabel>
            <FormLabel label="Details">
              <Input value={holdDetail} onChange={(event) => setHoldDetail(event.target.value)} placeholder="Optional context" />
            </FormLabel>
            <FormLabel label="Follow-up date (required)">
              <Input type="date" value={holdDate} onChange={(event) => setHoldDate(event.target.value)} />
            </FormLabel>
            <p className="text-xs text-muted-foreground">On Hold is excluded from the active forecast until it is reactivated.</p>
          </>
        )}

        {need === "won" && (
          <>
            <FormLabel label="Won summary">
              <Textarea rows={3} value={wonSummary} onChange={(event) => setWonSummary(event.target.value)} placeholder="What was sold and why they chose us" />
            </FormLabel>
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              Closing as won links the existing customer (or creates one from the contact email) and links the accepted quote&apos;s order,
              or creates an order from this opportunity. It happens once, even if retried. It does <strong>not</strong> approve artwork or
              authorize printing — production continues on the order.
            </div>
          </>
        )}

        {need === "reopen" && (
          <FormLabel label="Why is this being reopened? (required)">
            <Textarea rows={3} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
          </FormLabel>
        )}

        {blocking.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">Requirements not yet met</p>
            <ul className="space-y-1">
              {blocking.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{item}
                </li>
              ))}
            </ul>
            {blockedWithoutOverride && (
              <p className="mt-2 text-xs text-muted-foreground">Complete these in the opportunity workspace, or ask a pipeline administrator to approve an exception.</p>
            )}
          </div>
        )}

        {needsOverride && (
          <FormLabel label="Exception reason (recorded in history)">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-2 h-4 w-4 shrink-0 text-amber-600" />
              <Textarea rows={2} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Why this move is approved without the requirements" />
            </div>
          </FormLabel>
        )}

        {error && blocking.length === 0 && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={pending}>{blockedWithoutOverride ? "Close" : "Cancel"}</Button>
        {!blockedWithoutOverride && (
          <Button onClick={submit} disabled={!canSubmit}>
            {pending ? "Saving…" : needsOverride ? "Move with recorded exception" : need === "reopen" ? "Reopen" : "Confirm"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
