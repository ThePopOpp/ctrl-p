"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  GitBranchPlus,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Table as TableIcon,
  Zap,
} from "lucide-react";

import { OpportunityCreateDialog } from "@/components/admin/pipeline/opportunity-create-dialog";
import { PipelineShell } from "@/components/admin/pipeline/pipeline-shell";
import { EmptyState, FieldRow, SelectField, StageBadge, Stat, fmtDate, staffName, usd } from "@/components/admin/pipeline/pipeline-ui";
import { StageConfigDialog } from "@/components/admin/pipeline/stage-config-dialog";
import { useStageTransition, type TransitionTarget } from "@/components/admin/pipeline/transition-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, pipelineRequest } from "@/lib/pipeline/client";
import { computePipelineStats, isOverdue, periodFor, type PeriodKey } from "@/lib/pipeline/forecast";
import { stageProbability } from "@/lib/pipeline/guidance";
import { ACTIVE_STAGES, SERVICE_CATEGORIES, STAGE_META, STAGE_ORDER, isActiveStage, serviceLabel, type PipelineStage } from "@/lib/pipeline/stages";
import type { OpportunityListRow, PipelineAccess, StaffMember, StageConfigMap } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

type View = "board" | "list" | "table" | "cards" | "calendar";
const VIEWS: { id: View; label: string; icon: typeof List }[] = [
  { id: "board", label: "Board", icon: GitBranchPlus },
  { id: "list", label: "List", icon: List },
  { id: "table", label: "Table", icon: TableIcon },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

type DateField = "expected_close_date" | "requested_completion_date" | "next_action_due" | "created_at";
const DATE_FIELDS: { key: DateField; label: string }[] = [
  { key: "expected_close_date", label: "Expected close date" },
  { key: "requested_completion_date", label: "Requested completion date" },
  { key: "next_action_due", label: "Next follow-up" },
  { key: "created_at", label: "Created date" },
];

type ListPayload = { opportunities: OpportunityListRow[]; staff: StaffMember[]; stageConfig: StageConfigMap; access: PipelineAccess };

const VIEW_KEY = "cp-pipeline-view";
const dayOf = (value: string | null) => (value ? value.slice(0, 10) : null);

export function AdminPipeline() {
  return <PipelineShell crumb={["Pipeline"]}>{() => <PipelineBoardPage />}</PipelineShell>;
}

function PipelineBoardPage() {
  const router = useRouter();
  const [data, setData] = useState<ListPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState<"all" | "active" | PipelineStage>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateField, setDateField] = useState<DateField>("expected_close_date");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("quarter");
  const [calendarField, setCalendarField] = useState<Exclude<DateField, "created_at">>("expected_close_date");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [quickId, setQuickId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<PipelineStage | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await pipelineRequest<ListPayload>("/opportunities"));
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error, "Could not load the Pipeline."));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const saved = window.localStorage.getItem(VIEW_KEY) as View | null;
      if (saved && VIEWS.some((item) => item.id === saved)) setView(saved);
    } catch {
      /* view preference is a convenience only */
    }
    const params = new URLSearchParams(window.location.search);
    const fromSubmission = params.get("from_submission");
    if (fromSubmission) {
      setSubmissionId(fromSubmission);
      setCreateOpen(true);
    }
  }, [load]);

  const changeView = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const transition = useStageTransition(async () => {
    await load();
  });

  const rows = useMemo(() => data?.opportunities ?? [], [data]);
  const staff = data?.staff ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (ownerFilter !== "all" && row.owner_id !== ownerFilter) return false;
      if (stageFilter === "active" && !isActiveStage(row.stage)) return false;
      if (stageFilter !== "all" && stageFilter !== "active" && row.stage !== stageFilter) return false;
      if (serviceFilter !== "all" && row.service_category !== serviceFilter) return false;
      const date = dayOf(row[dateField]);
      if (dateFrom && (!date || date < dateFrom)) return false;
      if (dateTo && (!date || date > dateTo)) return false;
      if (!needle) return true;
      return [row.name, row.company, row.contact_name, row.contact_email, row.opportunity_number, staffName(staff, row.owner_id), serviceLabel(row.service_category)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, search, ownerFilter, stageFilter, serviceFilter, dateField, dateFrom, dateTo, staff]);

  const stats = useMemo(() => computePipelineStats(filtered, periodFor(period)), [filtered, period]);
  const overdueCount = filtered.filter((row) => isActiveStage(row.stage) && (isOverdue(row.next_action_due) || !row.next_action_due)).length;
  const quick = rows.find((row) => row.id === quickId) ?? null;
  const canEdit = Boolean(data?.access.canEdit);
  const target = (row: OpportunityListRow): TransitionTarget => ({ id: row.id, name: row.name, stage: row.stage });
  const openWorkspace = (id: string) => router.push(`/admin/pipeline/${id}`);
  const clearSubmissionParam = () => {
    setSubmissionId(null);
    if (window.location.search.includes("from_submission")) window.history.replaceState(null, "", "/admin/pipeline");
  };

  if (!data) {
    return loadError ? (
      <Card className="border-red-500/30">
        <CardContent className="p-5">
          <div className="font-semibold text-red-600 dark:text-red-300">The Pipeline couldn&apos;t load</div>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <Button className="mt-4" variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Try again</Button>
        </CardContent>
      </Card>
    ) : (
      <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading the Pipeline…</CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[25px] font-semibold tracking-tight">Sales pipeline</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
            Potential print, signage, apparel, wrap and design jobs from first inquiry to a confirmed order. Production continues on the linked order.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.access.canManage && (
            <Button variant="outline" onClick={() => setConfigOpen(true)}><Settings2 className="h-4 w-4" /> Stage settings</Button>
          )}
          <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          {canEdit && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New opportunity</Button>}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Open pipeline" value={usd(stats.openValue)} hint={`${stats.openCount} active opportunities`} />
        <Stat label="Weighted forecast" value={usd(Math.round(stats.weightedForecast))} hint="Value × stage probability" />
        <Stat label="Won" value={usd(stats.wonValue)} hint={`${stats.wonCount} closed won this period`} />
        <Stat label="Win rate" value={stats.winRate === null ? "—" : `${stats.winRate}%`} hint={`Won ÷ (won + lost): ${stats.wonCount}/${stats.wonCount + stats.lostCount}`} />
        <Stat label="Needs follow-up" value={String(overdueCount)} hint={`${stats.onHoldCount} on hold (${usd(stats.onHoldValue)}) excluded from forecast`} />
      </section>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search opportunities" className="h-9 pl-9" placeholder="Search project, customer, company, number…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <SelectField aria-label="Salesperson" className="w-auto min-w-[150px]" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
            <option value="all">All salespeople</option>
            {staff.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
          </SelectField>
          <SelectField aria-label="Stage" className="w-auto min-w-[150px]" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as typeof stageFilter)}>
            <option value="all">All stages</option>
            <option value="active">Active stages only</option>
            {STAGE_ORDER.map((stage) => <option key={stage} value={stage}>{STAGE_META[stage].label}</option>)}
          </SelectField>
          <SelectField aria-label="Service type" className="w-auto min-w-[150px]" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
            <option value="all">All services</option>
            {SERVICE_CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </SelectField>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <SelectField aria-label="Date filter field" className="h-8 w-auto" value={dateField} onChange={(event) => setDateField(event.target.value as DateField)}>
              {DATE_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
            </SelectField>
            <Input aria-label="From date" type="date" className="h-8 w-[150px]" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <span>to</span>
            <Input aria-label="To date" type="date" className="h-8 w-[150px]" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <SelectField aria-label="Reporting period" className="h-8 w-auto" value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)}>
              <option value="month">Won/win rate: this month</option>
              <option value="quarter">Won/win rate: this quarter</option>
              <option value="year">Won/win rate: this year</option>
              <option value="all">Won/win rate: all time</option>
            </SelectField>
            {(search || ownerFilter !== "all" || stageFilter !== "all" || serviceFilter !== "all" || dateFrom || dateTo) && (
              <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setOwnerFilter("all"); setStageFilter("all"); setServiceFilter("all"); setDateFrom(""); setDateTo(""); }}>Clear filters</Button>
            )}
          </div>
          <div role="tablist" aria-label="View" className="flex rounded-lg border bg-background p-0.5">
            {VIEWS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => changeView(item.id)}
                className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", view === item.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
                <item.icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {transition.notice && (
        <div role="status" className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", transition.notice.tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200")}>
          <span>{transition.notice.message}</span>
          <button type="button" className="text-xs underline" onClick={transition.clearNotice}>Dismiss</button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState message={canEdit ? "No opportunities yet. Add one from a website inquiry, an existing customer, or a new contact." : "No opportunities are assigned to you yet."} />
      ) : filtered.length === 0 && view !== "board" ? (
        <EmptyState message="No opportunities match these filters." />
      ) : view === "board" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {STAGE_ORDER.filter((stage) => stageFilter === "all" || stageFilter === stage || (stageFilter === "active" && ACTIVE_STAGES.includes(stage))).map((stage) => {
              const column = filtered.filter((row) => row.stage === stage);
              const total = column.reduce((sum, row) => sum + row.value, 0);
              const weighted = ACTIVE_STAGES.includes(stage) ? column.reduce((sum, row) => sum + (row.value * row.probability) / 100, 0) : null;
              return (
                <section
                  key={stage}
                  aria-label={`${STAGE_META[stage].label}: ${column.length} opportunities`}
                  className={cn("flex w-[272px] shrink-0 flex-col rounded-xl border bg-muted/20 transition-colors", dragOver === stage && "border-primary bg-primary/5")}
                  onDragOver={(event) => { if (canEdit) { event.preventDefault(); setDragOver(stage); } }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null); }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(null);
                    const row = rows.find((item) => item.id === dragId);
                    setDragId(null);
                    if (row && row.stage !== stage) transition.request(target(row), stage);
                  }}
                >
                  <div className="border-b p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <StageBadge stage={stage} />
                      <span className="text-xs tabular-nums text-muted-foreground">{column.length}</span>
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                      <span>{usd(total)}</span>
                      {weighted !== null && <span title="Weighted forecast (value × probability)">{usd(Math.round(weighted))} weighted · {stageProbability(stage, data.stageConfig)}%</span>}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {column.map((row) => (
                      <OpportunityCard
                        key={row.id}
                        row={row}
                        staff={staff}
                        canEdit={canEdit}
                        pending={transition.pendingId === row.id}
                        dragging={dragId === row.id}
                        onDragStart={() => setDragId(row.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        onOpen={() => setQuickId(row.id)}
                        onMove={(to) => transition.request(target(row), to)}
                      />
                    ))}
                    {column.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground/70">No opportunities</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {filtered.map((row) => (
            <Card key={row.id} className="transition-colors hover:border-primary/40">
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openWorkspace(row.id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{row.name}</span>
                    <StageBadge stage={row.stage} />
                    <FollowUpBadge row={row} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.company || row.contact_name || "No contact"} · {serviceLabel(row.service_category)} · {staffName(staff, row.owner_id)} · closes {fmtDate(row.expected_close_date, false)}
                  </div>
                </button>
                <span className="whitespace-nowrap text-sm font-semibold">{usd(row.value)}</span>
                <StageSelect row={row} disabled={!canEdit || transition.pendingId === row.id} onMove={(to) => transition.request(target(row), to)} />
                <Button size="sm" variant="ghost" onClick={() => setQuickId(row.id)}>Quick view</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : view === "table" ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Project</TableHead>
                  <TableHead>Customer / company</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Prob.</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Expected close</TableHead>
                  <TableHead>Next follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4">
                      <Link href={`/admin/pipeline/${row.id}`} className="font-medium hover:underline">{row.name}</Link>
                      <div className="text-[11px] text-muted-foreground">{row.opportunity_number}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.company || row.contact_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{serviceLabel(row.service_category)}</TableCell>
                    <TableCell><StageSelect row={row} disabled={!canEdit || transition.pendingId === row.id} onMove={(to) => transition.request(target(row), to)} /></TableCell>
                    <TableCell className="text-right">{usd(row.value)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{isActiveStage(row.stage) ? `${row.probability}%` : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{staffName(staff, row.owner_id)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(row.expected_close_date)}</TableCell>
                    <TableCell className="whitespace-nowrap"><FollowUpText row={row} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : view === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <Card key={row.id} className="transition-colors hover:border-primary/40">
              <CardContent className="space-y-3 p-4">
                <button type="button" className="block w-full text-left" onClick={() => openWorkspace(row.id)}>
                  <div className="truncate font-medium">{row.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.company || row.contact_name || "No contact"} · {serviceLabel(row.service_category)}</div>
                </button>
                <div className="flex flex-wrap items-center gap-2"><StageBadge stage={row.stage} /><FollowUpBadge row={row} /></div>
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Value</span><span className="text-right font-semibold">{usd(row.value)}</span>
                  <span className="text-muted-foreground">Owner</span><span className="truncate text-right">{staffName(staff, row.owner_id)}</span>
                  <span className="text-muted-foreground">Expected close</span><span className="text-right">{fmtDate(row.expected_close_date)}</span>
                  <span className="text-muted-foreground">Next follow-up</span><span className="text-right"><FollowUpText row={row} /></span>
                </div>
                <div className="flex items-center gap-2">
                  <StageSelect row={row} disabled={!canEdit || transition.pendingId === row.id} onMove={(to) => transition.request(target(row), to)} />
                  <Button size="sm" variant="ghost" onClick={() => setQuickId(row.id)}>Quick view</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <PipelineCalendar rows={filtered} field={calendarField} onField={setCalendarField} month={month} onMonth={setMonth} onOpen={(id) => setQuickId(id)} />
      )}

      <Sheet open={Boolean(quick)} onOpenChange={(open) => !open && setQuickId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {quick && (
            <div className="space-y-5">
              <SheetHeader>
                <SheetTitle>{quick.name}</SheetTitle>
                <SheetDescription>{quick.opportunity_number} · {quick.company || quick.contact_name || "No contact"}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={quick.stage} />
                <span className="text-lg font-semibold">{usd(quick.value)}</span>
                {isActiveStage(quick.stage) && <span className="text-sm text-muted-foreground">· {quick.probability}% · {usd(Math.round((quick.value * quick.probability) / 100))} weighted</span>}
              </div>
              <div>
                <FieldRow label="Service">{serviceLabel(quick.service_category)}</FieldRow>
                <FieldRow label="Contact">{quick.contact_name || "—"}</FieldRow>
                <FieldRow label="Email">{quick.contact_email || "—"}</FieldRow>
                <FieldRow label="Owner">{staffName(staff, quick.owner_id)}</FieldRow>
                <FieldRow label="Expected close">{fmtDate(quick.expected_close_date)}</FieldRow>
                <FieldRow label="Requested completion">{fmtDate(quick.requested_completion_date)}{quick.is_rush ? " · Rush" : ""}</FieldRow>
                <FieldRow label="Next action">{quick.next_action ? `${quick.next_action} (${fmtDate(quick.next_action_due)})` : "—"}</FieldRow>
                <FieldRow label="Current quote">{quick.current_quote ? `v${quick.current_quote.version} · ${usd(quick.current_quote.amount)} · ${quick.current_quote.status.replace(/_/g, " ")}` : "None linked"}</FieldRow>
                {quick.lost_reason && <FieldRow label="Loss reason">{quick.lost_reason}</FieldRow>}
                {quick.hold_reason && <FieldRow label="On hold">{quick.hold_reason} · follow up {fmtDate(quick.hold_follow_up_date)}</FieldRow>}
              </div>
              {canEdit && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Change stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGE_ORDER.map((stage) => (
                      <Button key={stage} size="sm" variant={stage === quick.stage ? "default" : "outline"} disabled={stage === quick.stage || transition.pendingId === quick.id}
                        onClick={() => transition.request(target(quick), stage)}>
                        {STAGE_META[stage].short}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={() => openWorkspace(quick.id)}><ExternalLink className="h-4 w-4" /> Open workspace</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {transition.element}

      <OpportunityCreateDialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); clearSubmissionParam(); }}
        staff={staff}
        access={data.access}
        initialSubmissionId={submissionId}
        onCreated={(opportunity) => {
          setCreateOpen(false);
          clearSubmissionParam();
          router.push(`/admin/pipeline/${opportunity.id}`);
        }}
      />

      <StageConfigDialog
        open={configOpen}
        initial={data.stageConfig}
        onClose={() => setConfigOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}

function FollowUpText({ row }: { row: OpportunityListRow }) {
  if (row.stage === "on_hold") {
    return <span className={cn(isOverdue(row.hold_follow_up_date) && "font-medium text-red-600 dark:text-red-300")}>{fmtDate(row.hold_follow_up_date)}</span>;
  }
  if (!isActiveStage(row.stage)) return <span className="text-muted-foreground">—</span>;
  if (!row.next_action_due) return <span className="text-amber-700 dark:text-amber-300">Not scheduled</span>;
  return <span className={cn(isOverdue(row.next_action_due) ? "font-medium text-red-600 dark:text-red-300" : "text-muted-foreground")}>{fmtDate(row.next_action_due)}</span>;
}

function FollowUpBadge({ row }: { row: OpportunityListRow }) {
  const due = row.stage === "on_hold" ? row.hold_follow_up_date : row.next_action_due;
  if (row.stage !== "on_hold" && !isActiveStage(row.stage)) return null;
  if (!due) return <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300"><CircleAlert className="mr-1 h-3 w-3" />No next action</Badge>;
  if (isOverdue(due)) return <Badge className="border-transparent bg-red-500/15 text-red-700 dark:text-red-300"><CircleAlert className="mr-1 h-3 w-3" />Overdue</Badge>;
  return null;
}

function StageSelect({ row, disabled, onMove }: { row: OpportunityListRow; disabled: boolean; onMove: (to: PipelineStage) => void }) {
  return (
    <SelectField
      aria-label={`Stage for ${row.name}`}
      className="h-8 w-auto min-w-[140px] text-xs"
      value={row.stage}
      disabled={disabled}
      onChange={(event) => onMove(event.target.value as PipelineStage)}
    >
      {STAGE_ORDER.map((stage) => <option key={stage} value={stage}>{STAGE_META[stage].label}</option>)}
    </SelectField>
  );
}

function OpportunityCard({
  row,
  staff,
  canEdit,
  pending,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onMove,
}: {
  row: OpportunityListRow;
  staff: StaffMember[];
  canEdit: boolean;
  pending: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onMove: (to: PipelineStage) => void;
}) {
  return (
    <article
      draggable={canEdit && !pending}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn("rounded-lg border bg-card p-2.5 shadow-sm", canEdit && "cursor-grab active:cursor-grabbing", dragging && "opacity-50", pending && "opacity-60")}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium">{row.name}</p>
          {row.is_rush && <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Rush" />}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{row.company || row.contact_name || "No contact"}</p>
        <p className="truncate text-[11px] text-muted-foreground">{serviceLabel(row.service_category)}</p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-semibold">{usd(row.value)}</span>
          <span className="truncate pl-2 text-muted-foreground">{staffName(staff, row.owner_id)}</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
          <span>Close {fmtDate(row.expected_close_date, false)}</span>
          <span className="text-right">Follow-up <FollowUpText row={row} /></span>
        </div>
        <div className="mt-1.5"><FollowUpBadge row={row} /></div>
      </button>
      {canEdit && (
        <div className="mt-2 border-t pt-2">
          <StageSelect row={row} disabled={pending} onMove={onMove} />
        </div>
      )}
    </article>
  );
}

function PipelineCalendar({
  rows,
  field,
  onField,
  month,
  onMonth,
  onOpen,
}: {
  rows: OpportunityListRow[];
  field: "expected_close_date" | "requested_completion_date" | "next_action_due";
  onField: (field: "expected_close_date" | "requested_completion_date" | "next_action_due") => void;
  month: Date;
  onMonth: (month: Date) => void;
  onOpen: (id: string) => void;
}) {
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => (index < firstDay ? null : index - firstDay + 1));
  const byDay = new Map<number, OpportunityListRow[]>();
  for (const row of rows) {
    const value = row[field];
    if (!value) continue;
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    if (y === year && m - 1 === mon) byDay.set(d, [...(byDay.get(d) ?? []), row]);
  }
  const today = new Date();
  const label = DATE_FIELDS.find((item) => item.key === field)?.label ?? "";
  const undated = rows.filter((row) => !row[field]).length;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous month" onClick={() => onMonth(new Date(year, mon - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[140px] text-sm font-medium">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next month" onClick={() => onMonth(new Date(year, mon + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Showing opportunities by</span>
            <SelectField aria-label="Calendar date" className="h-8 w-auto" value={field} onChange={(event) => onField(event.target.value as typeof field)}>
              {DATE_FIELDS.filter((item) => item.key !== "created_at").map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </SelectField>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="bg-card px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">{day}</div>
            ))}
            {cells.map((day, index) => {
              const items = day ? byDay.get(day) ?? [] : [];
              const isToday = day !== null && today.getDate() === day && today.getMonth() === mon && today.getFullYear() === year;
              return (
                <div key={index} className={cn("min-h-[92px] bg-card p-1.5", !day && "bg-muted/30")}>
                  {day && (
                    <>
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[12px]", isToday && "bg-primary font-semibold text-primary-foreground")}>{day}</span>
                      <div className="mt-1 space-y-0.5">
                        {items.slice(0, 3).map((row) => (
                          <button key={row.id} type="button" onClick={() => onOpen(row.id)} title={`${row.name} · ${STAGE_META[row.stage].label}`}
                            className={cn("block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium", STAGE_META[row.stage].tone)}>
                            {row.name}
                          </button>
                        ))}
                        {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Calendar placed by <strong>{label}</strong>. Expected close is when the sale should close; requested completion is when the customer needs the job.
          {undated ? ` ${undated} filtered opportunities have no ${label.toLowerCase()} and are not shown.` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
