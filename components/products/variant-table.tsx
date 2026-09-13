"use client";

// ─── VariantTable ───────────────────────────────────────────────────────────
//
// Editable rows: qty, spec, cost, markup, retail, margin (spec §13).
//
// Print products do not have one price — a business card has a price for every
// combination of quantity, stock, finish and sides. Unit and extended prices
// are shown in separate columns and never mixed, because `price_unit` decides
// what the stored number means.

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Star, Trash2, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeVariantPricing, money, roundPct, type CardPricingInput } from "@/lib/pricing/calculate";
import { PRICE_UNIT_LABELS, type PriceUnit, type PricingTier } from "@/lib/pricing/types";
import type { ExtractionSource } from "@/lib/products/types";
import { cn } from "@/lib/utils";

import { FieldSourceBadge } from "@/components/products/field-source-badge";

export type EditableVariant = {
  id?: string;
  label: string | null;
  quantity: number;
  spec: Record<string, string>;
  unit_cost: number;
  markup_pct: number | null;
  markup_flat: number | null;
  retail_override: number | null;
  retail_override_reason: string | null;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
  /** Which extraction tier supplied this row's cost. */
  source?: ExtractionSource;
};

type Props = {
  variants: EditableVariant[];
  onChange: (variants: EditableVariant[]) => void;
  cardRule: CardPricingInput;
  tier: PricingTier | null;
  priceUnit: PriceUnit;
  readOnly?: boolean;
};

export function VariantTable({ variants, onChange, cardRule, tier, priceUnit, readOnly = false }: Props) {
  const [overrideEditing, setOverrideEditing] = useState<number | null>(null);

  const priced = useMemo(
    () =>
      variants.map((variant) => ({
        variant,
        pricing: computeVariantPricing(variant, cardRule, tier),
      })),
    [variants, cardRule, tier],
  );

  const update = (index: number, patch: Partial<EditableVariant>) => {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
  };

  const makeDefault = (index: number) => {
    onChange(variants.map((variant, i) => ({ ...variant, is_default: i === index })));
  };

  const addRow = () => {
    const last = variants[variants.length - 1];
    onChange([
      ...variants,
      {
        label: null,
        quantity: last ? last.quantity * 2 : 1,
        spec: last ? { ...last.spec } : {},
        unit_cost: 0,
        markup_pct: null,
        markup_flat: null,
        retail_override: null,
        retail_override_reason: null,
        is_default: variants.length === 0,
        is_available: true,
        sort_order: variants.length,
        source: "manual",
      },
    ]);
  };

  const removeRow = (index: number) => {
    const next = variants.filter((_, i) => i !== index);
    // The card always needs a default, so promote the first survivor.
    if (next.length && !next.some((v) => v.is_default)) next[0] = { ...next[0], is_default: true };
    onChange(next.map((variant, i) => ({ ...variant, sort_order: i })));
  };

  const totals = useMemo(() => {
    const available = priced.filter((row) => row.variant.is_available);
    const cost = available.reduce((sum, row) => sum + row.pricing.extendedCost, 0);
    const retail = available.reduce((sum, row) => sum + row.pricing.extendedRetail, 0);
    return { cost, retail, margin: retail > 0 ? roundPct(((retail - cost) / retail) * 100) : 0 };
  }, [priced]);

  if (!variants.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No variants yet. A print product usually has one row per quantity break.
        </p>
        {!readOnly && (
          <Button variant="outline" size="sm" className="mt-3" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" /> Add a variant
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-28">Qty</TableHead>
              <TableHead className="min-w-[200px]">Spec</TableHead>
              <TableHead className="w-32">Unit cost</TableHead>
              <TableHead className="w-24">Markup</TableHead>
              <TableHead className="w-32">Unit retail</TableHead>
              <TableHead className="w-24">Margin</TableHead>
              <TableHead className="w-32">Extended</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {priced.map(({ variant, pricing }, index) => {
              const blocked = pricing.guards.find((g) => g.severity === "block");
              const warned = pricing.guards.find((g) => g.severity === "warn");

              return (
                <TableRow
                  key={variant.id ?? index}
                  className={cn(
                    blocked && "bg-destructive/5",
                    !variant.is_available && "opacity-50",
                  )}
                >
                  <TableCell className="pr-0">
                    <button
                      type="button"
                      onClick={() => makeDefault(index)}
                      disabled={readOnly}
                      title={variant.is_default ? "Pre-selected on the product page" : "Make this the default variant"}
                      className="text-muted-foreground transition-colors hover:text-amber-500 disabled:cursor-default"
                    >
                      <Star className={cn("h-4 w-4", variant.is_default && "fill-amber-400 text-amber-500")} />
                    </button>
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="h-8 w-24 tabular-nums"
                      value={variant.quantity}
                      onChange={(event) => update(index, { quantity: Number(event.target.value) || 0 })}
                      disabled={readOnly}
                      aria-label={`Quantity for row ${index + 1}`}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      className="h-8"
                      placeholder="500 / 16pt / Gloss"
                      value={variant.label ?? specSummary(variant.spec)}
                      onChange={(event) => update(index, { label: event.target.value })}
                      disabled={readOnly}
                      aria-label={`Label for row ${index + 1}`}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          className="h-8 w-24 pl-5 tabular-nums"
                          value={variant.unit_cost}
                          onChange={(event) => update(index, { unit_cost: Number(event.target.value) || 0 })}
                          disabled={readOnly}
                          aria-label={`Unit cost for row ${index + 1}`}
                        />
                      </div>
                      {variant.source ? <FieldSourceBadge source={variant.source} compact /> : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 w-20 tabular-nums"
                      placeholder={String(roundPct(pricing.rule.markupPct))}
                      value={variant.markup_pct ?? ""}
                      onChange={(event) =>
                        update(index, {
                          markup_pct: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                      disabled={readOnly}
                      aria-label={`Markup override for row ${index + 1}`}
                    />
                  </TableCell>

                  <TableCell className="tabular-nums">
                    {overrideEditing === index ? (
                      <Input
                        type="number"
                        step="0.01"
                        autoFocus
                        className="h-8 w-24 tabular-nums"
                        defaultValue={pricing.unitRetail}
                        onBlur={(event) => {
                          const next = Number(event.target.value);
                          update(index, {
                            retail_override: Number.isFinite(next) ? next : null,
                            retail_override_reason: variant.retail_override_reason ?? "Manual price",
                          });
                          setOverrideEditing(null);
                        }}
                        aria-label={`Retail override for row ${index + 1}`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => !readOnly && setOverrideEditing(index)}
                        className={cn(
                          "font-medium",
                          variant.retail_override !== null && "underline decoration-dotted underline-offset-4",
                        )}
                        title={variant.retail_override !== null ? "Manual override — click to change" : "Click to override"}
                      >
                        {money(pricing.unitRetail)}
                      </button>
                    )}
                    {variant.retail_override !== null && (
                      <button
                        type="button"
                        className="ml-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => update(index, { retail_override: null, retail_override_reason: null })}
                        disabled={readOnly}
                        title="Revert to the calculated price"
                      >
                        <Undo2 className="inline h-3 w-3" />
                      </button>
                    )}
                  </TableCell>

                  <TableCell>
                    <span
                      className={cn(
                        "tabular-nums",
                        blocked && "font-semibold text-destructive",
                        !blocked && warned?.code === "under_margin_floor" && "font-semibold text-amber-600",
                      )}
                      title={blocked?.message ?? warned?.message}
                    >
                      {roundPct(pricing.marginPct)}%
                    </span>
                    {(blocked || warned) && (
                      <AlertTriangle
                        className={cn("ml-1 inline h-3 w-3", blocked ? "text-destructive" : "text-amber-500")}
                        aria-label={blocked?.message ?? warned?.message}
                      />
                    )}
                  </TableCell>

                  <TableCell className="tabular-nums text-muted-foreground">
                    {money(pricing.extendedRetail)}
                    <span className="ml-1 text-[10px]">{PRICE_UNIT_LABELS[priceUnit]}</span>
                  </TableCell>

                  <TableCell className="pl-0">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Remove row ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" /> Add variant
          </Button>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Cost <span className="font-medium tabular-nums text-foreground">{money(totals.cost)}</span>
          </span>
          <span>
            Retail <span className="font-medium tabular-nums text-foreground">{money(totals.retail)}</span>
          </span>
          <Badge variant={totals.margin < (tier?.min_margin_pct ?? 0) ? "destructive" : "outline"}>
            {totals.margin}% blended margin
          </Badge>
        </div>
      </div>

      {priced.some(({ variant }) => variant.retail_override !== null) && (
        <p className="text-xs text-muted-foreground">
          Underlined prices are manual overrides — they bypass the markup rule and will not move when the tier changes.
        </p>
      )}
    </div>
  );
}

function specSummary(spec: Record<string, string>): string {
  return Object.values(spec).filter(Boolean).join(" / ");
}
