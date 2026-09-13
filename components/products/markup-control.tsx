"use client";

// ─── MarkupControl ──────────────────────────────────────────────────────────
//
// The widget the whole feature turns on (spec §7.7). One row, four linked
// values:
//
//   Cost        Markup %      Margin %      Retail
//   $42.50   →  [  65  ]  ↔  [ 39.4 ]  →   $70.13  →  rounds to  $70.99
//
// Markup and margin are BOTH editable and drive each other, because staff think
// in whichever one their head is in that day. Confusing the two is the most
// expensive mistake a pricing feature can make, so both are always on screen.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Info, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  computeRetail,
  markupFromMargin,
  marginFromMarkup,
  money,
  resolveMarkupRule,
  roundPct,
} from "@/lib/pricing/calculate";
import { ROUNDING_RULES, ROUNDING_RULE_LABELS, type PricingTier, type RoundingRule } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

export type MarkupControlValue = {
  markup_pct: number | null;
  markup_flat: number | null;
  rounding_rule: RoundingRule | null;
};

type Props = {
  /** Read-only here — it comes from capture. */
  cost: number;
  value: MarkupControlValue;
  onChange: (value: MarkupControlValue) => void;
  tier: PricingTier | null;
  /** Shown when this control edits a variant that can inherit from its card. */
  cardRule?: MarkupControlValue | null;
  scope?: "card" | "variant";
  disabled?: boolean;
  className?: string;
};

export function MarkupControl({
  cost,
  value,
  onChange,
  tier,
  cardRule = null,
  scope = "card",
  disabled = false,
  className,
}: Props) {
  const [flatMode, setFlatMode] = useState(value.markup_flat !== null && value.markup_pct === null);

  const rule = useMemo(
    () =>
      resolveMarkupRule(
        scope === "variant"
          ? { variant: value, card: cardRule, tier }
          : { card: { ...value, rounding_rule: value.rounding_rule }, tier },
      ),
    [value, cardRule, tier, scope],
  );

  const pricing = useMemo(() => computeRetail(cost, rule), [cost, rule]);

  // Local strings so a half-typed "1." does not get normalised out from under
  // the cursor. They resync whenever the resolved rule changes underneath.
  const [markupText, setMarkupText] = useState(String(roundPct(rule.markupPct)));
  const [marginText, setMarginText] = useState(String(roundPct(marginFromMarkup(rule.markupPct))));

  useEffect(() => {
    setMarkupText(String(roundPct(rule.markupPct)));
    setMarginText(String(roundPct(marginFromMarkup(rule.markupPct))));
  }, [rule.markupPct]);

  const commitMarkup = (raw: string) => {
    setMarkupText(raw);
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return;
    setMarginText(String(roundPct(marginFromMarkup(parsed))));
    onChange({ ...value, markup_pct: parsed });
  };

  const commitMargin = (raw: string) => {
    setMarginText(raw);
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed >= 100) return;
    const markup = roundPct(markupFromMargin(parsed));
    setMarkupText(String(markup));
    onChange({ ...value, markup_pct: markup });
  };

  const commitFlat = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    onChange({ ...value, markup_flat: Number.isFinite(parsed) ? parsed : null });
  };

  const underFloor = pricing.guards.find((g) => g.code === "under_margin_floor");
  const blocked = pricing.guards.find((g) => g.severity === "block");
  const ceiling = pricing.guards.find((g) => g.code === "markup_ceiling");
  const rounded = pricing.unitRetail !== pricing.preRounding;

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex flex-wrap items-end gap-4">
        <Figure label="Cost" hint="From capture">
          <div className="flex h-9 items-center gap-1.5 rounded-md border border-dashed bg-muted/40 px-3 text-sm font-medium tabular-nums">
            <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
            {money(cost)}
          </div>
        </Figure>

        <ArrowRight className="mb-2.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />

        {flatMode ? (
          <Figure label="Flat markup" hint="Added to cost">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="w-32 pl-6 tabular-nums"
                value={value.markup_flat ?? ""}
                onChange={(event) => commitFlat(event.target.value)}
                disabled={disabled}
                aria-label="Flat markup in dollars"
              />
            </div>
          </Figure>
        ) : (
          <>
            <Figure label="Markup %" hint="Against cost">
              <Input
                type="number"
                step="0.1"
                inputMode="decimal"
                className="w-28 tabular-nums"
                value={markupText}
                onChange={(event) => commitMarkup(event.target.value)}
                disabled={disabled}
                aria-label="Markup percentage"
              />
            </Figure>

            <span className="mb-2.5 shrink-0 text-muted-foreground" aria-hidden>
              ↔
            </span>

            <Figure label="Margin %" hint="Against retail">
              <Input
                type="number"
                step="0.1"
                inputMode="decimal"
                className={cn(
                  "w-28 tabular-nums",
                  underFloor && "border-amber-500 bg-amber-50 text-amber-900 focus-visible:ring-amber-500",
                )}
                value={marginText}
                onChange={(event) => commitMargin(event.target.value)}
                disabled={disabled}
                aria-label="Margin percentage"
              />
            </Figure>
          </>
        )}

        {!flatMode && value.markup_flat ? (
          <Figure label="+ Flat" hint="Added after %">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                className="w-28 pl-6 tabular-nums"
                value={value.markup_flat ?? ""}
                onChange={(event) => commitFlat(event.target.value)}
                disabled={disabled}
                aria-label="Flat markup in dollars"
              />
            </div>
          </Figure>
        ) : null}

        <ArrowRight className="mb-2.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />

        <Figure label="Retail" hint={rounded ? "After rounding" : undefined}>
          <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-semibold tabular-nums">
            {rounded ? (
              <>
                <span className="text-muted-foreground line-through">{money(pricing.preRounding)}</span>
                <span>{money(pricing.unitRetail)}</span>
              </>
            ) : (
              <span>{money(pricing.unitRetail)}</span>
            )}
          </div>
        </Figure>

        <Figure label="Rounding">
          <Select
            value={value.rounding_rule ?? rule.roundingRule}
            onValueChange={(next) => onChange({ ...value, rounding_rule: next as RoundingRule })}
            disabled={disabled}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUNDING_RULES.map((option) => (
                <SelectItem key={option} value={option}>
                  {ROUNDING_RULE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Figure>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {/* Nobody should have to wonder why two similar products priced differently. */}
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Info className="h-3 w-3" aria-hidden />
          {rule.sourceLabel}
          {rule.minMarginPct !== null ? ` · floor ${roundPct(rule.minMarginPct)}%` : ""}
        </span>

        <button
          type="button"
          className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => {
            setFlatMode((mode) => !mode);
            onChange(flatMode ? { ...value, markup_flat: null } : { ...value, markup_pct: null });
          }}
          disabled={disabled}
        >
          {flatMode ? "Use percentage markup" : "Use flat dollar markup"}
        </button>

        {(value.markup_pct !== null || value.markup_flat !== null) && (
          <button
            type="button"
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => onChange({ markup_pct: null, markup_flat: null, rounding_rule: null })}
            disabled={disabled}
          >
            Revert to {tier ? `tier ${tier.code}` : "the tier default"}
          </button>
        )}
      </div>

      {(blocked || underFloor || ceiling) && (
        <div className="mt-3 space-y-1.5">
          {[blocked, underFloor, ceiling].filter(Boolean).map((guard) => (
            <p
              key={guard!.code}
              className={cn(
                "flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs",
                guard!.severity === "block" ? "bg-destructive/10 text-destructive" : "bg-amber-50 text-amber-900",
              )}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {guard!.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Figure({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {hint ? <span className="text-[10px] text-muted-foreground/70">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Compact read-only rendering for list rows and previews. */
export function MarkupSummary({ tier, pct, flat }: { tier: PricingTier | null; pct: number | null; flat: number | null }) {
  const overridden = pct !== null || flat !== null;
  return (
    <Badge variant={overridden ? "secondary" : "outline"} className="font-normal">
      {overridden
        ? `Override ${pct !== null ? `${roundPct(pct)}%` : ""}${flat ? ` +${money(flat)}` : ""}`.trim()
        : tier
          ? `Tier ${tier.code} · ${roundPct(tier.default_markup_pct)}%`
          : "No tier"}
    </Badge>
  );
}
