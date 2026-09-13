"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  CircleAlert,
  ExternalLink,
  Link2,
  Mail,
  MessageSquare,
  Pause,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";

import { ActivityTimeline } from "@/components/admin/pipeline/activity-timeline";
import { PipelineShell, usePipelineSidebar } from "@/components/admin/pipeline/pipeline-shell";
import { ActionRail, QuickActionModal, type QuickActionId, type ToolRequest } from "@/components/admin/pipeline/quick-actions";
import {
  EditableField,
  EmptyState,
  FieldRow,
  FormLabel,
  Panel,
  SaveIndicator,
  SelectField,
  StageBadge,
  fmtDate,
  fmtDateTime,
  human,
  staffName,
  toOptions,
  usd,
  type SaveState,
} from "@/components/admin/pipeline/pipeline-ui";
import { StageConfigDialog } from "@/components/admin/pipeline/stage-config-dialog";
import { useStageTransition, type TransitionTarget } from "@/components/admin/pipeline/transition-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, pipelineRequest } from "@/lib/pipeline/client";
import { isOverdue } from "@/lib/pipeline/forecast";
import { checklistFor, missingSpecifications, nextPathStage, resolveGuide } from "@/lib/pipeline/guidance";
import { TIMELINE_TABS, type TimelineTabKey } from "@/lib/pipeline/timeline";
import {
  ARTWORK_SOURCES,
  ARTWORK_STATUSES,
  DEPOSIT_STATUSES,
  DIMENSION_UNITS,
  FILE_KINDS,
  FULFILLMENT_METHODS,
  MANUAL_LOG_KINDS,
  NEXT_ACTION_TYPES,
  PIPELINE_PATH,
  QUOTE_STATUSES,
  SERVICE_CATEGORIES,
  STAGE_META,
  isActiveStage,
  labelFor,
  serviceLabel,
  type PipelineStage,
} from "@/lib/pipeline/stages";
import type { CustomerRecord, OpportunityDetail, OpportunityEvent, OpportunityLineItem, OpportunityQuote } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

const SERVICE_OPTIONS = SERVICE_CATEGORIES.map((category) => ({ value: category.key, label: category.label }));
const YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

export function OpportunityWorkspace({ id }: { id: string }) {
  return <PipelineShell crumb={["Pipeline", "Opportunity"]}>{() => <Workspace id={id} />}</PipelineShell>;
}

function Workspace({ id }: { id: string }) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [configOpen, setConfigOpen] = useState(false);
  const [lineDialog, setLineDialog] = useState<{ item: OpportunityLineItem | null } | null>(null);
  const [quoteDialog, setQuoteDialog] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [tool, setTool] = useState<ToolRequest | null>(null);
  const [logKind, setLogKind] = useState("call");
  const { collapsed } = usePipelineSidebar();

  const load = useCallback(async () => {
    try {
      setDetail(await pipelineRequest<OpportunityDetail>(`/opportunities/${id}`));
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error, "Could not load this opportunity."));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const transition = useStageTransition(async () => {
    await load();
  });

  /** Every write goes through here: the save state reflects what the server actually accepted. */
  const run = useCallback(
    async (action: () => Promise<unknown>, success = "Saved") => {
      setSave({ status: "saving" });
      try {
        await action();
        await load();
        setSave({ status: "saved", message: success });
        return true;
      } catch (error) {
        setSave({ status: "error", message: errorMessage(error, "Save failed — nothing was changed.") });
        return false;
      }
    },
    [load],
  );

  const patch = useCallback(
    (body: Record<string, unknown>, success?: string) => run(() => pipelineRequest(`/opportunities/${id}`, { method: "PATCH", body }), success),
    [id, run],
  );

  const previousActiveStage = useMemo<PipelineStage>(() => {
    if (!detail) return "new_inquiry";
    const o = detail.opportunity;
    if (o.stage === "on_hold" && o.hold_from_stage) return o.hold_from_stage;
    if (o.stage === "closed_won") return "approved";
    const entered = detail.events.find((event) => event.event_type === "stage_changed" && event.to_stage === o.stage);
    const from = entered?.from_stage;
    return from && isActiveStage(from) ? from : "new_inquiry";
  }, [detail]);

  if (!detail) {
    return loadError ? (
      <div className="space-y-4">
        <BackLink />
        <Card className="border-red-500/30">
          <CardContent className="p-5">
            <div className="font-semibold text-red-600 dark:text-red-300">This opportunity couldn&apos;t load</div>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            <Button className="mt-4" variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Try again</Button>
          </CardContent>
        </Card>
      </div>
    ) : (
      <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading opportunity…</CardContent></Card>
    );
  }

  const { opportunity: o, lineItems, quotes, events, tasks, files, customer, submission, orders, payments, messages, appointments, staff, stageConfig, access } = detail;
  const canEdit = access.canEdit;
  const currentQuote = quotes.find((quote) => quote.is_current) ?? null;
  const ctx = { opportunity: o, lineItems, currentQuote };
  const guide = resolveGuide(o.stage, stageConfig, o);
  const checklist = checklistFor(ctx, stageConfig);
  const active = isActiveStage(o.stage);
  const nextStage = active ? nextPathStage(o.stage) : null;
  const weighted = active ? Math.round((detail.value * o.probability) / 100) : null;
  const target: TransitionTarget = { id: o.id, name: o.name, stage: o.stage };
  const wonOrder = o.won_order_id ? orders.find((order) => order.id === o.won_order_id) ?? null : null;
  const specGaps = missingSpecifications(lineItems);
  const dueFollowUp = o.stage === "on_hold" ? o.hold_follow_up_date : o.next_action_due;

  const runTool = (toolId: QuickActionId) => {
    if (toolId === "quote") setQuoteDialog(true);
    else setTool({ id: toolId });
  };

  /** "Add" on a timeline tab: log that kind by hand, or open the matching quick action. */
  const addToTimeline = (tab: TimelineTabKey) => {
    const log = TIMELINE_TABS.find((item) => item.key === tab)?.log;
    const toolFor: Partial<Record<TimelineTabKey, QuickActionId>> = {
      voice: "voice", ai: "agent", project: "project", plan: "plan", contract: "contract", sow: "sow", quote: "quote", invoice: "invoice", payment: "invoice",
    };
    if (log) {
      setLogKind(log);
      setLogOpen(true);
    } else if (toolFor[tab]) {
      runTool(toolFor[tab]!);
    } else {
      setLogKind("note");
      setLogOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <BackLink />

      {/* Header */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Opportunity · {o.opportunity_number}</p>
            <h1 className="mt-0.5 break-words text-xl font-semibold">
              <EditableField ariaLabel="Opportunity name" align="left" value={o.name} disabled={!canEdit} onSave={(name) => patch({ name })} />
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StageBadge stage={o.stage} />
              <span className="text-lg font-semibold">{usd(detail.value)}</span>
              <span className="text-xs text-muted-foreground">
                {currentQuote ? `from quote v${currentQuote.version}` : "estimated"}
                {weighted !== null ? ` · ${o.probability}% · ${usd(weighted)} weighted` : ""}
              </span>
              {o.is_rush && <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300"><Zap className="mr-1 h-3 w-3" />Rush</Badge>}
              {(active || o.stage === "on_hold") && !dueFollowUp && <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300"><CircleAlert className="mr-1 h-3 w-3" />No next action</Badge>}
              {(active || o.stage === "on_hold") && isOverdue(dueFollowUp) && <Badge className="border-transparent bg-red-500/15 text-red-700 dark:text-red-300"><CircleAlert className="mr-1 h-3 w-3" />Follow-up overdue</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SaveIndicator state={save} />
            {canEdit && active && (
              <>
                <Button size="sm" variant="outline" onClick={() => transition.request(target, "closed_won")}><Trophy className="h-3.5 w-3.5" /> Closed Won</Button>
                <Button size="sm" variant="outline" onClick={() => transition.request(target, "closed_lost")}><Ban className="h-3.5 w-3.5" /> Closed Lost</Button>
                <Button size="sm" variant="outline" onClick={() => transition.request(target, "on_hold")}><Pause className="h-3.5 w-3.5" /> On Hold</Button>
              </>
            )}
            {canEdit && !active && (
              <Button size="sm" variant="outline" onClick={() => transition.request(target, previousActiveStage)}>
                <RotateCcw className="h-3.5 w-3.5" /> {o.stage === "on_hold" ? `Reactivate to ${STAGE_META[previousActiveStage].short}` : `Reopen to ${STAGE_META[previousActiveStage].short}`}
              </Button>
            )}
          </div>
        </div>

        {/* Quick actions sit here while the sidebar is open; collapsed, they move to a rail beside the content. */}
        {!collapsed && <div className="mt-3"><ActionRail vertical={false} disabled={!canEdit} onRun={runTool} /></div>}

        <div className="mt-4 grid gap-x-6 gap-y-1 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldRow label="Customer / company">{o.company || customer?.company || o.contact_name || customer?.full_name || "—"}</FieldRow>
          <FieldRow label="Salesperson">
            <EditableField
              ariaLabel="Salesperson"
              type="select"
              value={o.owner_id}
              options={staff.map((member) => ({ value: member.id, label: member.full_name || member.email || "Staff" }))}
              display={staffName(staff, o.owner_id)}
              disabled={!canEdit || !(access.canViewAll || access.canManage)}
              onSave={(owner_id) => (owner_id ? patch({ owner_id }, "Salesperson reassigned") : undefined)}
            />
          </FieldRow>
          <FieldRow label="Expected close">
            <EditableField ariaLabel="Expected close date" type="date" value={o.expected_close_date} display={fmtDate(o.expected_close_date)} disabled={!canEdit} onSave={(value) => patch({ expected_close_date: value || null })} />
          </FieldRow>
          <FieldRow label="Requested completion">
            <EditableField ariaLabel="Requested completion date" type="date" value={o.requested_completion_date} display={fmtDate(o.requested_completion_date)} disabled={!canEdit} onSave={(value) => patch({ requested_completion_date: value || null })} />
          </FieldRow>
        </div>
        {transition.notice && (
          <p role="status" className={cn("mt-3 text-sm", transition.notice.tone === "error" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")}>{transition.notice.message}</p>
        )}
      </div>

      {/* Stage path */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Sales stage">
            {PIPELINE_PATH.map((stage, index) => {
              const currentIndex = PIPELINE_PATH.indexOf(o.stage);
              const done = currentIndex >= 0 && index < currentIndex;
              const isCurrent = stage === o.stage;
              return (
                <button
                  key={stage}
                  type="button"
                  disabled={!canEdit || isCurrent || transition.pendingId === o.id}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => transition.request(target, stage)}
                  title={`Move to ${STAGE_META[stage].label}`}
                  className={cn(
                    "flex min-w-[112px] flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-default",
                    isCurrent ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-foreground enabled:hover:bg-primary/25" : "bg-muted text-muted-foreground enabled:hover:text-foreground",
                  )}
                >
                  {done && <Check className="h-3.5 w-3.5" />}
                  <span className="truncate">{STAGE_META[stage].short}</span>
                </button>
              );
            })}
            {(o.stage === "closed_lost" || o.stage === "on_hold") && (
              <span className={cn("flex shrink-0 items-center rounded-md px-3 py-2 text-xs font-semibold", STAGE_META[o.stage].tone)}>{STAGE_META[o.stage].label}</span>
            )}
          </div>
          {canEdit && nextStage && (
            <Button size="sm" onClick={() => transition.request(target, nextStage)} disabled={transition.pendingId === o.id}>
              <Check className="h-3.5 w-3.5" /> Advance to {STAGE_META[nextStage].short}
            </Button>
          )}
        </div>
      </div>

      <div className={cn(
        "grid gap-4",
        collapsed
          ? "xl:grid-cols-[minmax(0,170px)_minmax(0,300px)_minmax(0,1fr)_minmax(0,300px)]"
          : "xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,320px)]",
      )}>
        {collapsed && <div><ActionRail vertical disabled={!canEdit} onRun={runTool} /></div>}
        {/* Left: who and what */}
        <div className="space-y-4">
          <Panel
            title={customer ? "Customer" : "Contact (prospect)"}
            action={canEdit && !customer ? <Button size="sm" variant="ghost" onClick={() => setCustomerDialog(true)}><Link2 className="h-3.5 w-3.5" /> Link customer</Button> : undefined}
          >
            {customer ? (
              <div>
                <FieldRow label="Name">{customer.full_name || "—"}</FieldRow>
                <FieldRow label="Email">{customer.email || "—"}</FieldRow>
                <FieldRow label="Phone">{customer.phone || "—"}</FieldRow>
                <FieldRow label="Company">{customer.company || "—"}</FieldRow>
                <FieldRow label="Account">{customer.role === "customer" ? "Customer account" : human(customer.role)}</FieldRow>
                <ContactActions phone={customer.phone} email={customer.email} disabled={!canEdit} onRun={runTool} />
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <Link href="/admin/customers" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">Open Customers <ExternalLink className="h-3 w-3" /></Link>
                  {canEdit && o.stage !== "closed_won" && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => patch({ customer_user_id: null }, "Customer unlinked")}>Unlink</button>}
                </div>
              </div>
            ) : (
              <div>
                <FieldRow label="Name"><EditableField ariaLabel="Contact name" value={o.contact_name} disabled={!canEdit} onSave={(value) => patch({ contact_name: value })} /></FieldRow>
                <FieldRow label="Email"><EditableField ariaLabel="Contact email" value={o.contact_email} disabled={!canEdit} onSave={(value) => patch({ contact_email: value })} /></FieldRow>
                <FieldRow label="Phone"><EditableField ariaLabel="Contact phone" value={o.contact_phone} disabled={!canEdit} onSave={(value) => patch({ contact_phone: value })} /></FieldRow>
                <FieldRow label="Company"><EditableField ariaLabel="Company" value={o.company} disabled={!canEdit} onSave={(value) => patch({ company: value })} /></FieldRow>
                <ContactActions phone={o.contact_phone} email={o.contact_email} disabled={!canEdit} onRun={runTool} />
                <p className="mt-3 text-[11px] text-muted-foreground">No customer account yet. At Closed Won the matching customer is linked by email, or one is created once.</p>
              </div>
            )}
          </Panel>

          {submission && (
            <Panel title="Originating inquiry">
              <FieldRow label="From">{[submission.first_name, submission.last_name].filter(Boolean).join(" ")}</FieldRow>
              <FieldRow label="Received">{fmtDate(submission.created_at)}</FieldRow>
              <FieldRow label="Subject">{submission.subject || "—"}</FieldRow>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{submission.message}</p>
            </Panel>
          )}

          <Panel title="Project details">
            <FieldRow label="Service type"><EditableField ariaLabel="Service type" type="select" options={SERVICE_OPTIONS} value={o.service_category} display={serviceLabel(o.service_category)} disabled={!canEdit} onSave={(value) => patch({ service_category: value || null })} /></FieldRow>
            <FieldRow label="Summary"><EditableField ariaLabel="Project summary" type="textarea" value={o.description} disabled={!canEdit} onSave={(value) => patch({ description: value })} /></FieldRow>
            <FieldRow label="Request source"><EditableField ariaLabel="Request source" value={o.source} disabled={!canEdit} onSave={(value) => patch({ source: value })} /></FieldRow>
            <FieldRow label="Rush"><EditableField ariaLabel="Rush" type="select" options={YES_NO} value={o.is_rush ? "yes" : "no"} disabled={!canEdit} onSave={(value) => patch({ is_rush: value === "yes" })} /></FieldRow>
            <FieldRow label="Fulfillment"><EditableField ariaLabel="Fulfillment method" type="select" options={toOptions(FULFILLMENT_METHODS)} value={o.fulfillment_method} disabled={!canEdit} onSave={(value) => patch({ fulfillment_method: value || null })} /></FieldRow>
            <FieldRow label="Delivery / install notes"><EditableField ariaLabel="Fulfillment notes" type="textarea" value={o.fulfillment_notes} disabled={!canEdit} onSave={(value) => patch({ fulfillment_notes: value })} /></FieldRow>
            <FieldRow label="Artwork"><EditableField ariaLabel="Artwork source" type="select" options={toOptions(ARTWORK_SOURCES)} value={o.artwork_source} disabled={!canEdit} onSave={(value) => patch({ artwork_source: value || null })} /></FieldRow>
            <FieldRow label="Artwork progress"><EditableField ariaLabel="Artwork progress" type="select" options={toOptions(ARTWORK_STATUSES)} value={o.artwork_status} disabled={!canEdit} onSave={(value) => patch({ artwork_status: value || null })} /></FieldRow>
            <FieldRow label="Budget"><EditableField ariaLabel="Budget" type="number" value={o.budget} display={o.budget !== null ? usd(o.budget) : undefined} disabled={!canEdit} onSave={(value) => patch({ budget: value || null })} /></FieldRow>
            <FieldRow label="Decision-makers"><EditableField ariaLabel="Decision-makers" value={o.decision_makers} disabled={!canEdit} onSave={(value) => patch({ decision_makers: value })} /></FieldRow>
            <FieldRow label="Estimated value"><EditableField ariaLabel="Estimated value" type="number" value={o.estimated_value} display={usd(o.estimated_value)} disabled={!canEdit} onSave={(value) => patch({ estimated_value: value || 0 })} /></FieldRow>
            {active && <FieldRow label="Probability"><EditableField ariaLabel="Probability percent" type="number" value={o.probability} display={`${o.probability}%`} disabled={!canEdit} onSave={(value) => patch({ probability: value })} /></FieldRow>}
            <FieldRow label="Internal notes"><EditableField ariaLabel="Internal notes" type="textarea" value={o.notes} disabled={!canEdit} onSave={(value) => patch({ notes: value })} /></FieldRow>
            <p className="mt-2 text-[11px] text-muted-foreground">Estimated value is used until a quote is linked; then the current quote amount is the value.</p>
          </Panel>

          <Panel title="Order setup">
            <FieldRow label="Billing confirmed"><EditableField ariaLabel="Billing confirmed" type="select" options={YES_NO} value={o.billing_confirmed ? "yes" : "no"} disabled={!canEdit} onSave={(value) => patch({ billing_confirmed: value === "yes" })} /></FieldRow>
            <FieldRow label="Deposit"><EditableField ariaLabel="Deposit status" type="select" options={toOptions(DEPOSIT_STATUSES)} value={o.deposit_status} disabled={!canEdit} onSave={(value) => patch({ deposit_status: value || null })} /></FieldRow>
            <FieldRow label="Payment terms"><EditableField ariaLabel="Payment terms" value={o.payment_terms} placeholder="e.g. Net 30" disabled={!canEdit} onSave={(value) => patch({ payment_terms: value })} /></FieldRow>
            <FieldRow label="PO number"><EditableField ariaLabel="Purchase order number" value={o.po_number} disabled={!canEdit} onSave={(value) => patch({ po_number: value })} /></FieldRow>
            <p className="mt-2 text-[11px] text-muted-foreground">A deposit isn&apos;t required when approved payment terms apply. These are recorded by staff — payment status of record lives on Payments.</p>
          </Panel>
        </div>

        {/* Center: working the sale */}
        <div className="space-y-4">
          <Panel
            title={`${STAGE_META[o.stage].label} · ${checklist.filter((state) => state.done).length}/${checklist.length}`}
            action={access.canManage ? <Button size="sm" variant="ghost" onClick={() => setConfigOpen(true)}><Settings2 className="h-3.5 w-3.5" /> Stage settings</Button> : undefined}
          >
            <p className="text-sm font-medium">{guide.goal}</p>
            {guide.actions.length > 0 && (
              <ul className="mt-2 space-y-1">
                {guide.actions.map((action, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{action}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 space-y-1 border-t pt-3">
              {checklist.length === 0 && <p className="text-sm text-muted-foreground">No checklist items for this stage.</p>}
              {checklist.map(({ item, done, automatic, custom }) => (
                <div key={item.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    disabled={automatic || !canEdit}
                    title={automatic ? "Completed automatically from the record" : undefined}
                    onClick={() => patch({ checklist_toggle: { key: `${o.stage}:${item.id}`, done: !done } })}
                    className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-sm", !automatic && canEdit && "hover:bg-muted/50")}
                  >
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", done ? "border-primary bg-primary/20" : "border-border")}>{done && <Check className="h-3 w-3" />}</span>
                    <span className={cn("min-w-0", done ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                    {automatic && <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">auto</span>}
                    {item.required && !done && <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-600">Required</span>}
                  </button>
                  {custom && canEdit && (
                    <button type="button" aria-label={`Remove step ${item.label}`} onClick={() => patch({ extra_item_remove: item.id })} className="rounded p-1 text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {canEdit && <AddStep onAdd={(label) => patch({ extra_item_add: { label } }, "Step added")} stageLabel={STAGE_META[o.stage].short} />}
            </div>
          </Panel>

          {(active || o.stage === "on_hold") && (
            <NextActionPanel key={`${o.next_action}|${o.next_action_due}|${o.next_action_type}`} detail={detail} canEdit={canEdit} onSave={(body) => patch(body, "Next action saved")} />
          )}

          <Panel
            title={`Line items (${lineItems.length})`}
            action={canEdit ? <Button size="sm" variant="ghost" onClick={() => setLineDialog({ item: null })}><Plus className="h-3.5 w-3.5" /> Add item</Button> : undefined}
          >
            {lineItems.length === 0 ? (
              <EmptyState message="Add one line per product or service — business cards, banners and shirts are separate lines with their own specifications." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-2 font-medium">Item</th>
                      <th className="py-1.5 pr-2 font-medium">Qty</th>
                      <th className="py-1.5 pr-2 font-medium">Size</th>
                      <th className="py-1.5 pr-2 font-medium">Material / finishing</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Est. unit</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{item.description}</div>
                          <div className="text-[11px] text-muted-foreground">{serviceLabel(item.service_category)}{item.artwork_source ? ` · ${labelFor(ARTWORK_SOURCES, item.artwork_source)}` : ""}</div>
                        </td>
                        <td className="py-2 pr-2">{item.quantity ?? "—"}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">{item.width && item.height ? `${item.width} × ${item.height} ${item.dimension_unit ?? ""}` : "—"}</td>
                        <td className="py-2 pr-2 text-muted-foreground">{[item.material, item.finishing].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="py-2 pr-2 text-right">{item.unit_price_estimate !== null ? usd(item.unit_price_estimate) : "—"}</td>
                        <td className="py-2 text-right">
                          {canEdit && (
                            <span className="inline-flex gap-1">
                              <button type="button" aria-label={`Edit ${item.description}`} className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => setLineDialog({ item })}><Pencil className="h-3.5 w-3.5" /></button>
                              <button type="button" aria-label={`Remove ${item.description}`} className="rounded p-1 text-muted-foreground hover:text-red-600"
                                onClick={() => run(() => pipelineRequest(`/opportunities/${id}/line-items?item_id=${item.id}`, { method: "DELETE" }), "Line item removed")}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {specGaps.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
                <p className="font-medium text-amber-800 dark:text-amber-200">Specifications still needed for this kind of work:</p>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">{specGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
              </div>
            )}
          </Panel>

          <QuotePanel detail={detail} currentQuote={currentQuote} canEdit={canEdit} onNew={() => setQuoteDialog(true)}
            onUpdate={(body, message) => run(() => pipelineRequest(`/opportunities/${id}/quotes`, { method: "PATCH", body: { quote_id: currentQuote?.id, ...body } }), message)} />

          <ActivityTimeline detail={detail} canEdit={canEdit} onAdd={addToTimeline} />

          <TasksPanel detail={detail} canEdit={canEdit}
            onCreate={(body) => run(() => pipelineRequest(`/opportunities/${id}/tasks`, { method: "POST", body }), "Task added")}
            onUpdate={(body) => run(() => pipelineRequest(`/opportunities/${id}/tasks`, { method: "PATCH", body }), "Task updated")} />
        </div>

        {/* Right: related records and history */}
        <div className="space-y-4">
          {o.stage === "closed_won" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <p className="font-medium text-emerald-800 dark:text-emerald-200">Sale confirmed — fulfillment continues on the order</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {wonOrder ? `${wonOrder.order_number ?? "Order"} is ${human(wonOrder.status)}, payment ${human(wonOrder.payment_status)}, production ${human(wonOrder.production_status)}.` : "Linked order not found."}
                {" "}Closed Won does not approve artwork or authorize printing.
              </p>
              {wonOrder && <Link href="/admin/orders" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline">Open Orders <ExternalLink className="h-3 w-3" /></Link>}
            </div>
          )}

          {(o.stage === "closed_lost" || o.stage === "on_hold" || o.reopened_at || o.won_summary) && (
            <Panel title="Outcome">
              {o.lost_reason && <FieldRow label="Loss reason">{o.lost_reason}</FieldRow>}
              {o.competitor && <FieldRow label="Competitor">{o.competitor}</FieldRow>}
              {o.lost_notes && <FieldRow label="Notes">{o.lost_notes}</FieldRow>}
              {o.stage === "on_hold" && <FieldRow label="Hold reason">{o.hold_reason || "—"}</FieldRow>}
              {o.stage === "on_hold" && <FieldRow label="Follow up"><span className={cn(isOverdue(o.hold_follow_up_date) && "text-red-600 dark:text-red-300")}>{fmtDate(o.hold_follow_up_date)}</span></FieldRow>}
              {o.won_summary && <FieldRow label="Won summary">{o.won_summary}</FieldRow>}
              {o.closed_at && <FieldRow label="Closed">{fmtDateTime(o.closed_at)}</FieldRow>}
              {o.reopened_at && <FieldRow label="Last reopened">{fmtDateTime(o.reopened_at)}</FieldRow>}
            </Panel>
          )}

          <Panel title="Related records">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Orders & quotes</p>
                {orders.length === 0 ? <p className="text-xs text-muted-foreground">No orders linked yet.</p> : orders.map((order) => (
                  <div key={order.id} className="mb-1.5 rounded-md border p-2 text-xs">
                    <div className="flex justify-between gap-2"><span className="font-medium">{order.order_number ?? order.id.slice(0, 8)}</span><span>{usd(order.total)}</span></div>
                    <div className="text-muted-foreground">{order.id === o.won_order_id ? "Won order · " : "Quote · "}{human(order.status)} · payment {human(order.payment_status)} · production {human(order.production_status)}</div>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payments & invoices</p>
                {payments.length === 0 ? <p className="text-xs text-muted-foreground">No payment records on linked orders.</p> : payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between gap-2 text-xs">
                    <span>{payment.invoice_number ?? "Payment"} · {human(payment.status)}</span>
                    <span>{usd(payment.amount)}{payment.balance_due ? ` (due ${usd(payment.balance_due)})` : ""}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Appointments</p>
                {appointments.length === 0 ? <p className="text-xs text-muted-foreground">None found for this customer or order.</p> : appointments.slice(0, 6).map((appointment) => (
                  <div key={appointment.id} className="flex justify-between gap-2 text-xs"><span className="truncate">{appointment.title}</span><span className="shrink-0 text-muted-foreground">{fmtDate(appointment.start_time, false)} · {human(appointment.status)}</span></div>
                ))}
                <Link href="/admin/bookings" className="mt-1 inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">Book in Bookings <ExternalLink className="h-3 w-3" /></Link>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Projects</p>
                {detail.projects.length === 0 ? <p className="text-xs text-muted-foreground">No projects linked.</p> : detail.projects.map((project) => (
                  <div key={project.id} className="flex justify-between gap-2 text-xs"><span className="truncate">{project.title}</span><span className="shrink-0 text-muted-foreground">{human(project.status)}{project.due_date ? ` · ${fmtDate(project.due_date, false)}` : ""}</span></div>
                ))}
                <Link href="/admin/production-schedule" className="mt-1 inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">Open Projects <ExternalLink className="h-3 w-3" /></Link>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plans, contracts & SOWs</p>
                {detail.documents.length === 0 ? <p className="text-xs text-muted-foreground">None yet.</p> : detail.documents.map((doc) => (
                  <button key={doc.id} type="button" disabled={!canEdit} onClick={() => runTool(doc.kind)} className="flex w-full justify-between gap-2 rounded text-left text-xs enabled:hover:bg-muted/50">
                    <span className="truncate">{doc.title}</span>
                    <span className="shrink-0 text-muted-foreground">{doc.kind === "sow" ? "SOW" : human(doc.kind)} · {human(doc.status)}</span>
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <FilesPanel detail={detail} canEdit={canEdit}
            onAdd={(body) => run(() => pipelineRequest(`/opportunities/${id}/files`, { method: "POST", body }), "File linked")}
            onRemove={(fileId) => run(() => pipelineRequest(`/opportunities/${id}/files?file_id=${fileId}`, { method: "DELETE" }), "File link removed")} />

          <Panel title="Stage history">
            <History events={events.filter((event) => event.event_type === "stage_changed" || event.event_type === "created" || event.event_type === "converted")} staff={staff} />
          </Panel>

          <Panel title="Assignment history">
            <History events={events.filter((event) => event.event_type === "owner_changed")} staff={staff} owners />
          </Panel>
        </div>
      </div>

      {transition.element}

      <QuickActionModal
        request={tool}
        detail={detail}
        onClose={() => setTool(null)}
        onSwitch={(next) => setTool(next)}
        onDone={async (message) => {
          await load();
          setSave({ status: "saved", message });
        }}
      />

      <StageConfigDialog open={configOpen} initial={stageConfig} startStage={o.stage} onClose={() => setConfigOpen(false)} onSaved={() => void load()} />

      <LineItemDialog
        state={lineDialog}
        onClose={() => setLineDialog(null)}
        onSave={async (body, itemId) => {
          const ok = await run(
            () => pipelineRequest(`/opportunities/${id}/line-items`, { method: itemId ? "PATCH" : "POST", body: itemId ? { item_id: itemId, ...body } : body }),
            itemId ? "Line item updated" : "Line item added",
          );
          if (ok) setLineDialog(null);
          return ok;
        }}
      />

      <QuoteDialog
        open={quoteDialog}
        detail={detail}
        currentQuote={currentQuote}
        onClose={() => setQuoteDialog(false)}
        onSave={async (body) => {
          const ok = await run(() => pipelineRequest(`/opportunities/${id}/quotes`, { method: "POST", body }), currentQuote ? "New quote version saved" : "Quote linked");
          if (ok) setQuoteDialog(false);
          return ok;
        }}
      />

      <LogDialog
        open={logOpen}
        initialKind={logKind}
        onClose={() => setLogOpen(false)}
        onSave={async (body) => {
          const ok = await run(() => pipelineRequest(`/opportunities/${id}/activities`, { method: "POST", body }), "Activity logged");
          if (ok) setLogOpen(false);
          return ok;
        }}
      />

      <LinkCustomerDialog
        open={customerDialog}
        onClose={() => setCustomerDialog(false)}
        onLink={async (customerId) => {
          const ok = await patch({ customer_user_id: customerId }, "Customer linked");
          if (ok) setCustomerDialog(false);
          return ok;
        }}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to Pipeline
    </Link>
  );
}

function ContactActions({ phone, email, disabled, onRun }: { phone: string | null; email: string | null; disabled: boolean; onRun: (id: QuickActionId) => void }) {
  const realEmail = email && !/@import\.controlp\.io$/i.test(email);
  if (!phone && !realEmail) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {phone && <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={disabled} onClick={() => onRun("call")}><Phone className="h-3.5 w-3.5" /> Call</Button>}
      {phone && <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={disabled} onClick={() => onRun("sms")}><MessageSquare className="h-3.5 w-3.5" /> Text</Button>}
      {realEmail && <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={disabled} onClick={() => onRun("email")}><Mail className="h-3.5 w-3.5" /> Email</Button>}
    </div>
  );
}

function AddStep({ onAdd, stageLabel }: { onAdd: (label: string) => Promise<boolean>; stageLabel: string }) {
  const [label, setLabel] = useState("");
  const submit = async () => {
    if (!label.trim()) return;
    if (await onAdd(label.trim())) setLabel("");
  };
  return (
    <div className="flex items-center gap-1.5 pt-2">
      <Input aria-label="New step" className="h-8 text-sm" value={label} placeholder={`Add a step for ${stageLabel}…`} onChange={(event) => setLabel(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submit(); } }} />
      <Button size="sm" variant="outline" disabled={!label.trim()} onClick={() => void submit()}><Plus className="h-3.5 w-3.5" /> Add</Button>
    </div>
  );
}

function NextActionPanel({ detail, canEdit, onSave }: { detail: OpportunityDetail; canEdit: boolean; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const o = detail.opportunity;
  const [action, setAction] = useState(o.next_action ?? "");
  const [type, setType] = useState(o.next_action_type ?? "call");
  const [due, setDue] = useState(o.next_action_due ?? "");
  const dirty = action !== (o.next_action ?? "") || type !== (o.next_action_type ?? "call") || due !== (o.next_action_due ?? "");
  const overdue = isOverdue(o.next_action_due);
  return (
    <Panel title="Next action" action={o.next_action_due ? <span className={cn("text-xs", overdue ? "font-medium text-red-600 dark:text-red-300" : "text-muted-foreground")}><CalendarClock className="mr-1 inline h-3.5 w-3.5" />{overdue ? "Overdue · " : "Due "}{fmtDate(o.next_action_due)}</span> : undefined}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px_auto]">
        <Input aria-label="Next action" value={action} disabled={!canEdit} placeholder="What happens next?" onChange={(event) => setAction(event.target.value)} />
        <SelectField aria-label="Next action type" value={type} disabled={!canEdit} onChange={(event) => setType(event.target.value)}>
          {NEXT_ACTION_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </SelectField>
        <Input aria-label="Next action due date" type="date" value={due} disabled={!canEdit} onChange={(event) => setDue(event.target.value)} />
        {canEdit && (
          <Button disabled={!dirty || Boolean(action.trim()) !== Boolean(due)} onClick={() => void onSave({ next_action: action.trim() || null, next_action_type: action.trim() ? type : null, next_action_due: action.trim() ? due || null : null })}>
            Save
          </Button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Owner: {staffName(detail.staff, o.owner_id)}. Active opportunities without a dated next action are flagged on the board.</p>
    </Panel>
  );
}

function QuotePanel({
  detail,
  currentQuote,
  canEdit,
  onNew,
  onUpdate,
}: {
  detail: OpportunityDetail;
  currentQuote: OpportunityQuote | null;
  canEdit: boolean;
  onNew: () => void;
  onUpdate: (body: Record<string, unknown>, message: string) => Promise<boolean>;
}) {
  const order = currentQuote?.order_id ? detail.orders.find((item) => item.id === currentQuote.order_id) ?? null : null;
  const history = detail.quotes.filter((quote) => !quote.is_current);
  const sentDay = currentQuote?.sent_at ? currentQuote.sent_at.slice(0, 10) : null;
  return (
    <Panel
      title="Quote"
      action={canEdit ? <Button size="sm" variant="ghost" onClick={onNew}><Plus className="h-3.5 w-3.5" /> {currentQuote ? "New version" : "Link quote"}</Button> : undefined}
    >
      {!currentQuote ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>No quote linked. Price the job in <Link href="/admin/orders" className="underline">Orders</Link> (status: Quote requested), then link it here. The current quote amount becomes this opportunity&apos;s value.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-x-6 sm:grid-cols-2">
            <FieldRow label="Version">v{currentQuote.version}{order ? ` · ${order.order_number ?? "order"}` : " · no order linked"}</FieldRow>
            <FieldRow label="Status">
              <EditableField ariaLabel="Quote status" type="select" options={toOptions(QUOTE_STATUSES.filter((status) => status.key !== "superseded"))} value={currentQuote.status} disabled={!canEdit}
                onSave={(status) => (status ? onUpdate({ status }, `Quote marked ${status.replace(/_/g, " ")}`) : undefined)} />
            </FieldRow>
            <FieldRow label="Amount">
              <EditableField ariaLabel="Quote amount" type="number" value={currentQuote.amount} display={usd(currentQuote.amount)} disabled={!canEdit} onSave={(amount) => onUpdate({ amount }, "Quote amount updated")} />
            </FieldRow>
            <FieldRow label="Sent">
              <EditableField ariaLabel="Quote sent date" type="date" value={sentDay} display={fmtDate(sentDay)} disabled={!canEdit} onSave={(sent_at) => onUpdate({ sent_at: sent_at || null }, "Sent date updated")} />
            </FieldRow>
            <FieldRow label="Expires">
              <EditableField ariaLabel="Quote expiration date" type="date" value={currentQuote.expires_at} display={fmtDate(currentQuote.expires_at)} disabled={!canEdit} onSave={(expires_at) => onUpdate({ expires_at: expires_at || null }, "Expiration updated")} />
            </FieldRow>
            <FieldRow label="Follow up">
              <EditableField ariaLabel="Quote follow-up date" type="date" value={currentQuote.follow_up_date} display={fmtDate(currentQuote.follow_up_date)} disabled={!canEdit} onSave={(follow_up_date) => onUpdate({ follow_up_date: follow_up_date || null }, "Follow-up updated")} />
            </FieldRow>
          </div>
          {isOverdue(currentQuote.expires_at) && currentQuote.status === "sent" && <p className="text-xs text-red-600 dark:text-red-300">This quote&apos;s expiration date has passed.</p>}
          {currentQuote.notes && <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{currentQuote.notes}</p>}
          {history.length > 0 && (
            <div className="border-t pt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Earlier versions (not counted in value)</p>
              {history.map((quote) => (
                <div key={quote.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>v{quote.version} · {human(quote.status)}</span>
                  <span className="line-through">{usd(quote.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Status here records what the customer told you. Sending the quote itself happens from Orders or Messages.</p>
        </div>
      )}
    </Panel>
  );
}

function TasksPanel({
  detail,
  canEdit,
  onCreate,
  onUpdate,
}: {
  detail: OpportunityDetail;
  canEdit: boolean;
  onCreate: (body: Record<string, unknown>) => Promise<boolean>;
  onUpdate: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState(detail.opportunity.owner_id ?? "");
  const open = detail.tasks.filter((task) => task.status === "open");
  const done = detail.tasks.filter((task) => task.status === "done");
  return (
    <Panel title={`Tasks (${open.length} open)`}>
      <div className="space-y-1.5">
        {[...open, ...done].map((task) => (
          <div key={task.id} className="flex items-center gap-2 text-sm">
            <button type="button" role="checkbox" aria-checked={task.status === "done"} aria-label={`Complete ${task.title}`} disabled={!canEdit}
              onClick={() => onUpdate({ task_id: task.id, status: task.status === "done" ? "open" : "done" })}
              className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", task.status === "done" ? "border-primary bg-primary/20" : "border-border")}>
              {task.status === "done" && <Check className="h-3 w-3" />}
            </button>
            <span className={cn("min-w-0 flex-1 truncate", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{staffName(detail.staff, task.assigned_to)}</span>
            {task.due_date && <span className={cn("shrink-0 text-xs", task.status === "open" && isOverdue(task.due_date) ? "text-red-600 dark:text-red-300" : "text-muted-foreground")}>{fmtDate(task.due_date, false)}</span>}
          </div>
        ))}
        {detail.tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks for this opportunity.</p>}
      </div>
      {canEdit && (
        <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
          <Input aria-label="Task title" value={title} placeholder="Add a task" onChange={(event) => setTitle(event.target.value)} />
          <Input aria-label="Task due date" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
          <SelectField aria-label="Task assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            {detail.staff.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
          </SelectField>
          <Button variant="outline" disabled={!title.trim()} onClick={async () => { if (await onCreate({ title, due_date: due || null, assigned_to: assignee || null })) { setTitle(""); setDue(""); } }}>Add</Button>
        </div>
      )}
    </Panel>
  );
}

function FilesPanel({
  detail,
  canEdit,
  onAdd,
  onRemove,
}: {
  detail: OpportunityDetail;
  canEdit: boolean;
  onAdd: (body: Record<string, unknown>) => Promise<boolean>;
  onRemove: (fileId: string) => Promise<boolean>;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("artwork");
  return (
    <Panel title={`Files (${detail.files.length})`}>
      <div className="space-y-1.5">
        {detail.files.map((file) => (
          <div key={file.id} className="flex items-center gap-2 text-sm">
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">{file.label}</a>
            <span className="shrink-0 text-[11px] text-muted-foreground">{labelFor(FILE_KINDS, file.kind)}</span>
            {canEdit && <button type="button" aria-label={`Remove ${file.label}`} className="rounded p-1 text-muted-foreground hover:text-red-600" onClick={() => onRemove(file.id)}><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        {detail.files.length === 0 && <p className="text-sm text-muted-foreground">No files linked.</p>}
      </div>
      {canEdit && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <Input aria-label="File name" value={label} placeholder="File name" onChange={(event) => setLabel(event.target.value)} />
          <Input aria-label="File link" value={url} placeholder="https://…" onChange={(event) => setUrl(event.target.value)} />
          <div className="flex gap-2">
            <SelectField aria-label="File type" value={kind} onChange={(event) => setKind(event.target.value)}>
              {FILE_KINDS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </SelectField>
            <Button variant="outline" disabled={!label.trim() || !url.trim()} onClick={async () => { if (await onAdd({ label, url, kind })) { setLabel(""); setUrl(""); } }}>Link</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Links a file stored elsewhere. Proofs of record are uploaded on the order in Artwork.</p>
        </div>
      )}
    </Panel>
  );
}

function History({ events, staff, owners }: { events: OpportunityEvent[]; staff: OpportunityDetail["staff"]; owners?: boolean }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">{owners ? "No assignment changes." : "No stage changes recorded."}</p>;
  return (
    <ol className="space-y-2">
      {events.map((event, index) => {
        const override = typeof event.details?.override_reason === "string" && event.details.override_reason ? String(event.details.override_reason) : null;
        return (
          <li key={event.id} className="flex items-start gap-2 text-xs">
            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", index === 0 ? "bg-primary" : "bg-muted-foreground/40")} />
            <span className="min-w-0">
              <span className="block font-medium">
                {owners ? `${event.from_owner_id ? `${staffName(staff, event.from_owner_id)} → ` : ""}${staffName(staff, event.to_owner_id)}` : event.summary || human(event.event_type)}
              </span>
              <span className="block text-muted-foreground">{fmtDateTime(event.occurred_at)} · {staffName(staff, event.actor_id)}</span>
              {event.body && <span className="block text-muted-foreground">{event.body}</span>}
              {override && <span className="block text-amber-700 dark:text-amber-300">Exception: {override}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function LineItemDialog({
  state,
  onClose,
  onSave,
}: {
  state: { item: OpportunityLineItem | null } | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>, itemId: string | null) => Promise<boolean>;
}) {
  const item = state?.item ?? null;
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state) return;
    setForm({
      description: item?.description ?? "",
      service_category: item?.service_category ?? "",
      quantity: item?.quantity?.toString() ?? "",
      width: item?.width?.toString() ?? "",
      height: item?.height?.toString() ?? "",
      dimension_unit: item?.dimension_unit ?? "in",
      material: item?.material ?? "",
      finishing: item?.finishing ?? "",
      artwork_source: item?.artwork_source ?? "",
      unit_price_estimate: item?.unit_price_estimate?.toString() ?? "",
      notes: item?.notes ?? "",
    });
  }, [state, item]);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const category = SERVICE_CATEGORIES.find((entry) => entry.key === form.service_category);

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit line item" : "Add line item"}</DialogTitle>
          <DialogDescription>Capture the specifications that matter for this kind of work.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormLabel label="Description (required)" className="sm:col-span-2"><Input value={form.description ?? ""} onChange={(event) => set("description", event.target.value)} placeholder="13oz vinyl banner with grommets" /></FormLabel>
          <FormLabel label="Service type">
            <SelectField value={form.service_category ?? ""} onChange={(event) => set("service_category", event.target.value)}>
              <option value="">Choose a service</option>
              {SERVICE_CATEGORIES.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
            </SelectField>
          </FormLabel>
          <FormLabel label={`Quantity${category?.requires.quantity ? " (required)" : ""}`}><Input type="number" min={0} value={form.quantity ?? ""} onChange={(event) => set("quantity", event.target.value)} /></FormLabel>
          <div className="grid grid-cols-[1fr_1fr_80px] gap-2 sm:col-span-2">
            <FormLabel label={`Width${category?.requires.dimensions ? " (required)" : ""}`}><Input type="number" min={0} value={form.width ?? ""} onChange={(event) => set("width", event.target.value)} /></FormLabel>
            <FormLabel label="Height"><Input type="number" min={0} value={form.height ?? ""} onChange={(event) => set("height", event.target.value)} /></FormLabel>
            <FormLabel label="Unit">
              <SelectField value={form.dimension_unit ?? "in"} onChange={(event) => set("dimension_unit", event.target.value)}>
                {DIMENSION_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </SelectField>
            </FormLabel>
          </div>
          <FormLabel label={`Material${category?.requires.material ? " (required)" : ""}`}><Input value={form.material ?? ""} onChange={(event) => set("material", event.target.value)} placeholder="16pt matte, 3M IJ180, Gildan 5000…" /></FormLabel>
          <FormLabel label="Finishing"><Input value={form.finishing ?? ""} onChange={(event) => set("finishing", event.target.value)} placeholder="Laminate, hems, grommets…" /></FormLabel>
          <FormLabel label="Artwork">
            <SelectField value={form.artwork_source ?? ""} onChange={(event) => set("artwork_source", event.target.value)}>
              <option value="">Same as opportunity</option>
              {ARTWORK_SOURCES.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
            </SelectField>
          </FormLabel>
          <FormLabel label="Estimated unit price" hint="Planning only. Pricing of record is the quote."><Input type="number" min={0} value={form.unit_price_estimate ?? ""} onChange={(event) => set("unit_price_estimate", event.target.value)} /></FormLabel>
          <FormLabel label="Notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes ?? ""} onChange={(event) => set("notes", event.target.value)} /></FormLabel>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={!form.description?.trim() || saving} onClick={async () => {
            setSaving(true);
            const body: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(form)) body[key] = value === "" ? null : value;
            if (!body.width && !body.height) body.dimension_unit = null;
            await onSave(body, item?.id ?? null);
            setSaving(false);
          }}>{saving ? "Saving…" : "Save line item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuoteDialog({
  open,
  detail,
  currentQuote,
  onClose,
  onSave,
}: {
  open: boolean;
  detail: OpportunityDetail;
  currentQuote: OpportunityQuote | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("draft");
  const [sentAt, setSentAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrderId(currentQuote?.order_id ?? "");
    setAmount("");
    setStatus("draft");
    setSentAt("");
    setExpiresAt("");
    setFollowUp("");
    setNotes("");
  }, [open, currentQuote]);

  const candidates = [...detail.orders, ...detail.quoteOrderCandidates.filter((order) => !detail.orders.some((linked) => linked.id === order.id))];
  const chosen = candidates.find((order) => order.id === orderId);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{currentQuote ? `New quote version (v${currentQuote.version + 1})` : "Link a quote"}</DialogTitle>
          <DialogDescription>
            {currentQuote ? `v${currentQuote.version} will be marked superseded and no longer counts toward value. This stays one opportunity.` : "Choose the quote you built in Orders. Its amount becomes this opportunity's value."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormLabel label="Quote order" className="sm:col-span-2" hint="Orders with status Quote requested or Draft, plus orders already linked.">
            <SelectField value={orderId} onChange={(event) => setOrderId(event.target.value)}>
              <option value="">No order (record amount only)</option>
              {candidates.map((order) => (
                <option key={order.id} value={order.id}>{order.order_number ?? order.id.slice(0, 8)} · {order.company || order.customer_email || "—"} · {usd(order.total)} · {human(order.status)}</option>
              ))}
            </SelectField>
          </FormLabel>
          <FormLabel label="Amount" hint={chosen ? `Leave blank to use the order total (${usd(chosen.total)}).` : undefined}>
            <Input type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} />
          </FormLabel>
          <FormLabel label="Status">
            <SelectField value={status} onChange={(event) => setStatus(event.target.value)}>
              {QUOTE_STATUSES.filter((item) => item.key !== "superseded").map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </SelectField>
          </FormLabel>
          <FormLabel label="Sent date" hint="Defaults to today when the status is beyond draft."><Input type="date" value={sentAt} onChange={(event) => setSentAt(event.target.value)} /></FormLabel>
          <FormLabel label="Expires"><Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></FormLabel>
          <FormLabel label="Follow-up date"><Input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></FormLabel>
          <FormLabel label="Notes" className="sm:col-span-2"><Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What changed in this version" /></FormLabel>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving || (!orderId && !amount)} onClick={async () => {
            setSaving(true);
            await onSave({ order_id: orderId || null, amount: amount || null, status, sent_at: sentAt || null, expires_at: expiresAt || null, follow_up_date: followUp || null, notes: notes || null });
            setSaving(false);
          }}>{saving ? "Saving…" : currentQuote ? "Save new version" : "Link quote"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogDialog({ open, initialKind, onClose, onSave }: { open: boolean; initialKind: string; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [kind, setKind] = useState(initialKind);
  const [direction, setDirection] = useState("outbound");
  const [when, setWhen] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setWhen(now.toISOString().slice(0, 16));
    setKind(initialKind);
    setSubject("");
    setBody("");
  }, [open, initialKind]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
          <DialogDescription>Record something that already happened outside Ctrl+P. This does not send an email or text, or place a call.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormLabel label="Type">
            <SelectField value={kind} onChange={(event) => setKind(event.target.value)}>
              {MANUAL_LOG_KINDS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </SelectField>
          </FormLabel>
          <FormLabel label="Direction">
            <SelectField value={direction} onChange={(event) => setDirection(event.target.value)} disabled={kind === "note"}>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </SelectField>
          </FormLabel>
          <FormLabel label="When" className="sm:col-span-2"><Input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></FormLabel>
          <FormLabel label="Subject" className="sm:col-span-2"><Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Discussed banner sizes" /></FormLabel>
          <FormLabel label="Details" className="sm:col-span-2"><Textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} /></FormLabel>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving || (!subject.trim() && !body.trim())} onClick={async () => {
            setSaving(true);
            await onSave({ kind, direction: kind === "note" ? null : direction, occurred_at: when ? new Date(when).toISOString() : null, subject, body });
            setSaving(false);
          }}>{saving ? "Saving…" : "Save log entry"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkCustomerDialog({ open, onClose, onLink }: { open: boolean; onClose: () => void; onLink: (customerId: string) => Promise<boolean> }) {
  const [customers, setCustomers] = useState<CustomerRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setSelected("");
    pipelineRequest<{ customers: CustomerRecord[] }>("/sources")
      .then((result) => alive && setCustomers(result.customers))
      .catch((loadError) => alive && setError(errorMessage(loadError, "Could not load customers.")));
    return () => {
      alive = false;
    };
  }, [open]);

  const visible = (customers ?? []).filter((customer) => {
    const needle = query.trim().toLowerCase();
    return !needle || [customer.full_name, customer.email, customer.company].some((value) => String(value || "").toLowerCase().includes(needle));
  }).slice(0, 100);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link an existing customer</DialogTitle>
          <DialogDescription>The customer&apos;s account and role stay as they are; this opportunity is added to their history.</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        <Input placeholder="Search customers" value={query} onChange={(event) => setQuery(event.target.value)} />
        <SelectField aria-label="Customer" size={8} className="h-auto" value={selected} onChange={(event) => setSelected(event.target.value)}>
          {visible.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || customer.email}{customer.company ? ` · ${customer.company}` : ""}</option>)}
        </SelectField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={!selected || saving} onClick={async () => { setSaving(true); await onLink(selected); setSaving(false); }}>{saving ? "Linking…" : "Link customer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
