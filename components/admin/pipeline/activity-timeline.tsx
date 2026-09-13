"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  FileSignature,
  FileText,
  FolderKanban,
  GitBranch,
  Mail,
  MessageSquare,
  Mic,
  Phone,
  Plus,
  Receipt,
  ScrollText,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { EmptyState, Panel, fmtDateTime, staffName, usd } from "@/components/admin/pipeline/pipeline-ui";
import { Button } from "@/components/ui/button";
import { buildTimeline, tabCounts, TIMELINE_TABS, type TimelineGroup, type TimelineItem, type TimelineTabKey } from "@/lib/pipeline/timeline";
import type { OpportunityDetail } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

const GROUP_ICON: Record<TimelineGroup, LucideIcon> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: CalendarClock,
  note: StickyNote,
  voice: Mic,
  ai: Bot,
  project: FolderKanban,
  plan: ClipboardList,
  contract: FileSignature,
  sow: ScrollText,
  quote: FileText,
  invoice: Receipt,
  payment: Wallet,
  update: GitBranch,
};

const TONE: Record<TimelineItem["tone"], string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-red-500/15 text-red-700 dark:text-red-300",
  muted: "bg-muted text-muted-foreground",
};

const seenKey = (id: string) => `cp-pipeline-seen:${id}`;

/**
 * One stream, tabbed to match the quick actions. Tab counts show how many
 * entries each tab holds and highlight what arrived since you last opened it
 * (remembered per browser).
 */
export function ActivityTimeline({
  detail,
  canEdit,
  onAdd,
}: {
  detail: OpportunityDetail;
  canEdit: boolean;
  onAdd: (tab: TimelineTabKey) => void;
}) {
  const opportunityId = detail.opportunity.id;
  const [tab, setTab] = useState<TimelineTabKey>("all");
  const [seen, setSeen] = useState<Partial<Record<TimelineTabKey, string>>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSeen(JSON.parse(window.localStorage.getItem(seenKey(opportunityId)) || "{}"));
    } catch {
      setSeen({});
    }
  }, [opportunityId]);

  const items = useMemo(
    () => buildTimeline({ events: detail.events, messages: detail.messages, appointments: detail.appointments, payments: detail.payments }),
    [detail.events, detail.messages, detail.appointments, detail.payments],
  );
  const counts = useMemo(() => tabCounts(items, seen), [items, seen]);
  const shown = tab === "all" ? items : items.filter((item) => item.groups.includes(tab as TimelineGroup));
  const activeTab = TIMELINE_TABS.find((item) => item.key === tab) ?? TIMELINE_TABS[0];

  function openTab(key: TimelineTabKey) {
    setTab(key);
    const now = new Date().toISOString();
    const next = { ...seen, [key]: now };
    if (key === "all") for (const item of TIMELINE_TABS) next[item.key] = now;
    setSeen(next);
    try {
      window.localStorage.setItem(seenKey(opportunityId), JSON.stringify(next));
    } catch {
      /* per-browser convenience only */
    }
  }

  return (
    <Panel
      title="Activity timeline"
      action={canEdit ? (
        <Button size="sm" variant="outline" className="h-8" onClick={() => onAdd(tab)}>
          <Plus className="h-3.5 w-3.5" /> Add{tab !== "all" && tab !== "update" ? ` ${activeTab.label.toLowerCase()}` : ""}
        </Button>
      ) : undefined}
    >
      <div role="tablist" aria-label="Activity type" className="-mx-4 -mt-4 mb-3 flex flex-nowrap gap-0.5 overflow-x-auto border-b px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TIMELINE_TABS.map((item) => {
          const count = counts[item.key];
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => openTab(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs font-medium transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {count.total > 0 && (
                <span
                  aria-label={count.unseen > 0 ? `${count.total}, ${count.unseen} new` : String(count.total)}
                  className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums", count.unseen > 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {count.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState message={tab === "all" ? "No activity yet. Calls, texts, emails, bookings and records you add from the actions above appear here." : `Nothing under ${activeTab.label} yet.`} />
      ) : (
        <ol className="space-y-2">
          {shown.slice(0, 150).map((item) => {
            const Icon = GROUP_ICON[item.groups[0]] ?? GitBranch;
            const open = expanded === item.id;
            const audio = item.eventId ? detail.voiceNoteUrls[item.eventId] : undefined;
            const expandable = Boolean(item.body || audio);
            return (
              <li key={item.id} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => expandable && setExpanded(open ? null : item.id)}
                  aria-expanded={expandable ? open : undefined}
                  className={cn("flex w-full items-start gap-3 p-3 text-left", expandable && "hover:bg-muted/40")}
                >
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15"><Icon className="h-3.5 w-3.5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">{item.title}</span>
                      {item.amount !== null && <span className="text-sm font-semibold tabular-nums">{usd(item.amount)}</span>}
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", TONE[item.tone])}>{item.tag}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {fmtDateTime(item.at)}{item.actorId ? ` · ${staffName(detail.staff, item.actorId)}` : ""}
                    </span>
                    {!open && item.body && <span className="mt-1 block truncate text-xs text-muted-foreground">{item.body}</span>}
                  </span>
                  {expandable && <ChevronDown className={cn("mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />}
                </button>
                {open && (
                  <div className="space-y-2 border-t px-3 py-3 pl-[52px]">
                    {audio && <audio controls preload="none" src={audio} className="w-full" />}
                    {item.body && <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
