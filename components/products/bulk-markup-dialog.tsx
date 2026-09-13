"use client";

// ─── BulkMarkupDialog ───────────────────────────────────────────────────────
//
// Multi-select repricing with a mandatory before/after preview (spec §7.7).
// You cannot reach the Apply button without having seen the table — repricing a
// whole category without seeing the result first is how products quietly go out
// wrong.

import { useState } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUNDING_RULES, ROUNDING_RULE_LABELS, type RoundingRule } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type PreviewVariant = {
  variantId: string;
  label: string;
  unitCost: number;
  before: { retail: number; margin: number };
  after: { retail: number; margin: number };
  retailDelta: number;
  marginDelta: number;
  blocked: boolean;
  overrideApplied: boolean;
  guards: Array<{ code: string; severity: string; message: string }>;
};

type PreviewCard = {
  cardId: string;
  title: string;
  status: string;
  tier: { code: string; name: string } | null;
  variants: PreviewVariant[];
  blocked: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardIds: string[];
  accessToken: string;
  onApplied: () => void;
};

export function BulkMarkupDialog({ open, onOpenChange, cardIds, accessToken, onApplied }: Props) {
  const [markupPct, setMarkupPct] = useState<string>("");
  const [markupFlat, setMarkupFlat] = useState<string>("");
  const [roundingRule, setRoundingRule] = useState<RoundingRule | "">("");
  const [mode, setMode] = useState<"card_override" | "clear">("card_override");

  const [preview, setPreview] = useState<PreviewCard[] | null>(null);
  const [summary, setSummary] = useState<{ cards: number; variants: number; blocked: number; warnings: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (apply: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/cards/bulk-markup", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          card_ids: cardIds,
          mode,
          apply,
          ...(mode === "clear"
            ? {}
            : {
                ...(markupPct !== "" ? { markup_pct: Number(markupPct) } : {}),
                ...(markupFlat !== "" ? { markup_flat: Number(markupFlat) } : {}),
                ...(roundingRule ? { rounding_rule: roundingRule } : {}),
              }),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "That did not work.");
        if (payload.cards) setPreview(payload.cards);
        return;
      }

      setPreview(payload.cards ?? null);
      setSummary(payload.summary ?? null);
      if (apply) {
        onApplied();
        onOpenChange(false);
        reset();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setSummary(null);
    setError(null);
    setMarkupPct("");
    setMarkupFlat("");
    setRoundingRule("");
    setMode("card_override");
  };

  const blockedCount = preview?.filter((card) => card.blocked).length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reprice {cardIds.length} card{cardIds.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Preview every affected variant before anything is written. Nothing changes until you apply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-mode">
                Change
              </label>
              <Select value={mode} onValueChange={(next) => setMode(next as typeof mode)}>
                <SelectTrigger id="bulk-mode" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card_override">Set a card-level override</SelectItem>
                  <SelectItem value="clear">Clear overrides — revert to tier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "card_override" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-markup">
                    Markup %
                  </label>
                  <Input
                    id="bulk-markup"
                    type="number"
                    step="0.1"
                    className="w-28 tabular-nums"
                    placeholder="unchanged"
                    value={markupPct}
                    onChange={(event) => setMarkupPct(event.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-flat">
                    Flat $
                  </label>
                  <Input
                    id="bulk-flat"
                    type="number"
                    step="0.01"
                    className="w-28 tabular-nums"
                    placeholder="unchanged"
                    value={markupFlat}
                    onChange={(event) => setMarkupFlat(event.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-rounding">
                    Rounding
                  </label>
                  <Select value={roundingRule} onValueChange={(next) => setRoundingRule(next as RoundingRule)}>
                    <SelectTrigger id="bulk-rounding" className="w-44">
                      <SelectValue placeholder="unchanged" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUNDING_RULES.map((rule) => (
                        <SelectItem key={rule} value={rule}>
                          {ROUNDING_RULE_LABELS[rule]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button variant="outline" onClick={() => request(false)} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Preview
            </Button>
          </div>

          {error ? (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          {summary ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{summary.cards} cards</Badge>
              <Badge variant="outline">{summary.variants} variants</Badge>
              {summary.blocked > 0 ? <Badge variant="destructive">{summary.blocked} blocked</Badge> : null}
              {summary.warnings > 0 ? (
                <Badge className="bg-amber-100 text-amber-900">{summary.warnings} warnings</Badge>
              ) : null}
            </div>
          ) : null}

          {preview ? (
            <div className="space-y-4">
              {preview.map((card) => (
                <div key={card.cardId} className={cn("rounded-lg border", card.blocked && "border-destructive")}>
                  <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                    <span className="text-sm font-medium">{card.title}</span>
                    <div className="flex items-center gap-2 text-xs">
                      {card.tier ? <Badge variant="outline">Tier {card.tier.code}</Badge> : null}
                      <Badge variant="secondary">{card.status}</Badge>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variant</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Retail</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {card.variants.map((variant) => (
                        <TableRow key={variant.variantId} className={cn(variant.blocked && "bg-destructive/5")}>
                          <TableCell className="text-sm">
                            {variant.label}
                            {variant.overrideApplied ? (
                              <Badge variant="outline" className="ml-2 font-normal">
                                manual price
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            ${variant.unitCost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="text-muted-foreground">${variant.before.retail.toFixed(2)}</span>
                            <ArrowRight className="mx-1 inline h-3 w-3 text-muted-foreground" aria-hidden />
                            <span className={cn("font-medium", deltaClass(variant.retailDelta))}>
                              ${variant.after.retail.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="text-muted-foreground">{variant.before.margin}%</span>
                            <ArrowRight className="mx-1 inline h-3 w-3 text-muted-foreground" aria-hidden />
                            <span className={cn("font-medium", deltaClass(variant.marginDelta))}>
                              {variant.after.margin}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {card.variants.some((v) => v.guards.length) && (
                    <ul className="space-y-1 border-t px-3 py-2">
                      {card.variants
                        .flatMap((v) => v.guards)
                        .map((guard, i) => (
                          <li
                            key={`${guard.code}-${i}`}
                            className={cn(
                              "text-xs",
                              guard.severity === "block" ? "text-destructive" : "text-amber-700",
                            )}
                          >
                            {guard.message}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Set a change above and preview it. Apply stays disabled until you have.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => request(true)} disabled={busy || !preview || blockedCount > 0}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {blockedCount > 0
              ? `${blockedCount} card${blockedCount === 1 ? "" : "s"} below cost`
              : `Apply to ${preview?.length ?? 0} card${preview?.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function deltaClass(delta: number): string {
  if (delta > 0) return "text-emerald-600";
  if (delta < 0) return "text-destructive";
  return "";
}
