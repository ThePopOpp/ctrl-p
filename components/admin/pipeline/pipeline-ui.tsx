"use client";

import { useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from "react";
import { Check, CircleAlert, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_META, type PipelineStage } from "@/lib/pipeline/stages";
import type { StaffMember } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const usd = (value: number | string | null | undefined) => {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? usdWhole.format(number) : usdCents.format(number);
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function fmtDate(value: string | null | undefined, withYear = true) {
  if (!value) return "—";
  const date = DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export const human = (value: string | null | undefined) =>
  String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const staffName = (staff: StaffMember[], id: string | null | undefined) => {
  if (!id) return "Unassigned";
  const member = staff.find((person) => person.id === id);
  return member ? member.full_name || member.email || "Staff member" : "Former staff member";
};

export const initials = (value: string | null | undefined) =>
  String(value || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

export function StageBadge({ stage, className }: { stage: PipelineStage; className?: string }) {
  return <Badge className={cn("border-transparent font-medium", STAGE_META[stage].tone, className)}>{STAGE_META[stage].label}</Badge>;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-[22px] font-semibold leading-none">{value}</div>
        {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <div className="shrink-0 pt-1 text-xs text-muted-foreground">{label}</div>
      <div className="min-w-0 max-w-[64%] text-right text-sm">{children}</div>
    </div>
  );
}

export function FormLabel({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{message}</div>;
}

export function SelectField({ className, children, ...props }: ComponentPropsWithRef<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </select>
  );
}

export type SaveState = { status: "idle" | "saving" | "saved" | "error"; message?: string };

/** Shows the real outcome of the last write — never "saved" for a request that failed. */
export function SaveIndicator({ state }: { state: SaveState }) {
  if (state.status === "idle") return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
        state.status === "saving" && "text-muted-foreground",
        state.status === "saved" && "text-emerald-700 dark:text-emerald-300",
        state.status === "error" && "bg-red-500/10 text-red-700 dark:text-red-300",
      )}
    >
      {state.status === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {state.status === "saved" && <Check className="h-3.5 w-3.5" />}
      {state.status === "error" && <CircleAlert className="h-3.5 w-3.5" />}
      {state.message ?? (state.status === "saving" ? "Saving…" : state.status === "saved" ? "Saved" : "Save failed")}
    </span>
  );
}

export type Option = { value: string; label: string };
export const toOptions = (list: readonly { key: string; label: string }[]): Option[] => list.map((item) => ({ value: item.key, label: item.label }));

/**
 * Click-to-edit value. The displayed value always comes from the server record,
 * so a failed save leaves the old value visible rather than a false success.
 */
export function EditableField({
  value,
  onSave,
  type = "text",
  options,
  placeholder = "Add",
  display,
  disabled,
  ariaLabel,
  align = "right",
}: {
  value: string | number | null | undefined;
  onSave: (next: string) => void | Promise<unknown>;
  type?: "text" | "number" | "date" | "textarea" | "select";
  options?: Option[];
  placeholder?: string;
  display?: ReactNode;
  disabled?: boolean;
  ariaLabel: string;
  align?: "left" | "right";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  const current = value === null || value === undefined ? "" : String(value);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = (next = draft) => {
    setEditing(false);
    if (next !== current) void onSave(next);
  };

  if (editing && !disabled) {
    const common = {
      "aria-label": ariaLabel,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setEditing(false);
        }
        if (event.key === "Enter" && type !== "textarea") {
          event.preventDefault();
          commit();
        }
      },
    };
    if (type === "select") {
      return (
        <SelectField ref={ref} {...common} value={draft} onChange={(event) => commit(event.target.value)} onBlur={() => setEditing(false)} className="h-8">
          <option value="">Not set</option>
          {(options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
      );
    }
    if (type === "textarea") {
      return <Textarea ref={ref} {...common} rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} className="text-sm" />;
    }
    return (
      <Input
        ref={ref}
        {...common}
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        min={type === "number" ? 0 : undefined}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit()}
        className={cn("h-8 text-sm", align === "right" && "text-right")}
      />
    );
  }

  const empty = current === "";
  const shown = display ?? (type === "select" ? options?.find((option) => option.value === current)?.label ?? current : current);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${ariaLabel}${disabled ? "" : " (click to edit)"}`}
      onClick={() => {
        setDraft(current);
        setEditing(true);
      }}
      className={cn(
        "w-full whitespace-pre-wrap break-words rounded px-1 py-0.5 text-sm transition-colors enabled:hover:bg-muted/60 disabled:cursor-default",
        align === "right" ? "text-right" : "text-left",
        empty ? "text-muted-foreground/70" : "text-foreground",
      )}
    >
      {empty ? (disabled ? "—" : placeholder) : shown}
    </button>
  );
}
