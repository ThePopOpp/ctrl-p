"use client";

// ─── PricingTierSettings ────────────────────────────────────────────────────
//
// Admin-only (spec §14). Tier defaults are DATA, not code — changing one here
// reprices every card that inherits it, which is exactly why the save button
// says how many cards that is.
//
// Two tier families are seeded and both are editable:
//   A/B/C    markup assigned by category (the card builder's model)
//   M1/M2/M3 the margin bands from reference/pricing-strategy.md

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeRetail, marginFromMarkup, money, roundPct } from "@/lib/pricing/calculate";
import { isMarginBandTier } from "@/lib/pricing/tiers";
import { ROUNDING_RULES, ROUNDING_RULE_LABELS, type PricingTier, type RoundingRule } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type TierWithCategories = PricingTier & { categories: Array<{ id: string; name: string }> };

/** Sample costs the preview column prices, so a change is never abstract. */
const SAMPLE_COSTS = [10, 42.5, 250];

export function PricingTierSettings({ accessToken }: { accessToken: string }) {
  const [tiers, setTiers] = useState<TierWithCategories[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<PricingTier>>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = { "content-type": "application/json", authorization: `Bearer ${accessToken}` };

  useEffect(() => {
    fetch("/api/pricing/tiers", { headers })
      .then((response) => response.json())
      .then((payload) => setTiers(payload.tiers ?? []))
      .catch(() => setError("Could not load pricing tiers."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const merged = useMemo(
    () => tiers.map((tier) => ({ ...tier, ...(edits[tier.id] ?? {}) })),
    [tiers, edits],
  );

  const edit = (id: string, patch: Partial<PricingTier>) =>
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const save = async (tier: TierWithCategories & Partial<PricingTier>) => {
    setSavingId(tier.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/pricing/tiers/${tier.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          default_markup_pct: tier.default_markup_pct,
          default_markup_flat: tier.default_markup_flat,
          min_margin_pct: tier.min_margin_pct,
          rounding_rule: tier.rounding_rule,
          is_active: tier.is_active,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save.");

      setTiers((current) => current.map((t) => (t.id === tier.id ? { ...t, ...payload.tier } : t)));
      setEdits((current) => {
        const next = { ...current };
        delete next[tier.id];
        return next;
      });
      setMessage(
        payload.repricedCards > 0
          ? `Saved. ${payload.repricedCards} card${payload.repricedCards === 1 ? "" : "s"} repriced.`
          : "Saved. No cards inherit this tier yet.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading tiers…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Pricing tiers</h3>
        <p className="text-xs text-muted-foreground">
          Every category maps to a tier, every card inherits its category's tier, and any card or variant can override.
          Changes apply to future pricing — existing orders keep the price they were placed at.
        </p>
      </div>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-56">Tier</TableHead>
              <TableHead className="w-28">Markup %</TableHead>
              <TableHead className="w-24">= Margin</TableHead>
              <TableHead className="w-28">Flat $</TableHead>
              <TableHead className="w-28">Margin floor</TableHead>
              <TableHead className="w-44">Rounding</TableHead>
              <TableHead>$42.50 cost →</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {merged.map((tier) => {
              const dirty = Boolean(edits[tier.id]);
              const preview = computeRetail(SAMPLE_COSTS[1], {
                markupPct: tier.default_markup_pct,
                markupFlat: tier.default_markup_flat,
                roundingRule: tier.rounding_rule,
                minMarginPct: tier.min_margin_pct,
                origin: "tier",
                sourceLabel: "",
              });

              return (
                <TableRow key={tier.id} className={cn(dirty && "bg-amber-50/60")}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={isMarginBandTier(tier) ? "secondary" : "default"}>{tier.code}</Badge>
                        <span className="text-sm font-medium">{tier.name}</span>
                        {tier.is_default ? (
                          <Badge variant="outline" className="font-normal">
                            fallback
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tier.categories.length
                          ? tier.categories.map((c) => c.name).join(", ")
                          : "No categories assigned"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-24 tabular-nums"
                      value={tier.default_markup_pct}
                      onChange={(event) => edit(tier.id, { default_markup_pct: Number(event.target.value) })}
                    />
                  </TableCell>

                  <TableCell className="tabular-nums text-muted-foreground">
                    {roundPct(marginFromMarkup(tier.default_markup_pct))}%
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-24 tabular-nums"
                      value={tier.default_markup_flat}
                      onChange={(event) => edit(tier.id, { default_markup_flat: Number(event.target.value) })}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 w-24 tabular-nums"
                      placeholder="none"
                      value={tier.min_margin_pct ?? ""}
                      onChange={(event) =>
                        edit(tier.id, {
                          min_margin_pct: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                    />
                  </TableCell>

                  <TableCell>
                    <Select
                      value={tier.rounding_rule}
                      onValueChange={(next) => edit(tier.id, { rounding_rule: next as RoundingRule })}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROUNDING_RULES.map((rule) => (
                          <SelectItem key={rule} value={rule}>
                            {ROUNDING_RULE_LABELS[rule]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="tabular-nums">
                    <span className="font-medium">{money(preview.unitRetail)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{preview.marginPct}% margin</span>
                  </TableCell>

                  <TableCell>
                    <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty || savingId === tier.id} onClick={() => save(tier)}>
                      {savingId === tier.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Tiers A/B/C apply markup by category. Tiers M1–M3 mirror the margin bands in{" "}
        <code className="text-[11px]">reference/pricing-strategy.md</code>, expressed as their equivalent markup — assign
        a category to one family or the other, not both.
      </p>
    </div>
  );
}
