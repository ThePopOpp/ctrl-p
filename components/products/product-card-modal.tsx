"use client";

// ─── ProductCardModal ───────────────────────────────────────────────────────
//
// Where detail lives (spec §2): image carousel, full description, spec table,
// variant/quantity pricing table, lead time — plus an internal-only section
// that is passed in as a node and is simply absent on public surfaces.

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductImage } from "@/components/products/product-image";
import { PRICE_UNIT_LABELS } from "@/lib/pricing/types";
import type { PublicCard } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  card: PublicCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctaHref?: string;
  ctaLabel?: string;
  /**
   * Staff-only content. Rendered verbatim when supplied and entirely absent
   * otherwise — the internal panel is not a hidden div, it is not sent.
   */
  internalPanel?: React.ReactNode;
};

export function ProductCardModal({ card, open, onOpenChange, ctaHref, ctaLabel, internalPanel }: Props) {
  const [index, setIndex] = useState(0);
  const images = card.images.length ? card.images : card.featuredImage ? [card.featuredImage] : [];
  const active = images[Math.min(index, images.length - 1)] ?? null;
  const specs = Object.entries(card.specTable ?? {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card.title}</DialogTitle>
          {card.subtitle ? <DialogDescription>{card.subtitle}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-6">
          {active ? (
            <div className="space-y-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
                <ProductImage
                  src={active.url}
                  alt={active.alt || card.title}
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                />
                {images.length > 1 && (
                  <>
                    <CarouselButton
                      side="left"
                      onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
                    />
                    <CarouselButton side="right" onClick={() => setIndex((i) => (i + 1) % images.length)} />
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((image, i) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={cn(
                        "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                        i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                      )}
                      aria-label={`Image ${i + 1} of ${images.length}`}
                    >
                      <ProductImage src={image.url} alt="" sizes="56px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {active.caption ? <p className="text-xs text-muted-foreground">{active.caption}</p> : null}
            </div>
          ) : null}

          {card.description ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Description</h4>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{card.description}</p>
            </div>
          ) : null}

          {specs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Specifications</h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {specs.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 border-b py-1.5 text-sm">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {card.variants.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Pricing</h4>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Option</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {card.variants.map((variant) => (
                      <TableRow key={variant.id} className={cn(variant.isDefault && "bg-accent/40")}>
                        <TableCell className="font-medium">
                          {variant.label ?? Object.values(variant.spec).join(" / ") ?? "Standard"}
                          {variant.isDefault ? (
                            <Badge variant="outline" className="ml-2 font-normal">
                              Default
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {variant.quantity.toLocaleString("en-US")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          ${variant.unitRetail.toFixed(2)}
                          <span className="ml-1 text-[10px]">{PRICE_UNIT_LABELS[card.priceUnit]}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          ${variant.extendedRetail.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {card.leadTimeDays ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Typically ready in {card.leadTimeDays} business day{card.leadTimeDays === 1 ? "" : "s"}
            </p>
          ) : null}

          {internalPanel ? (
            <div className="rounded-lg border border-dashed bg-muted/40 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Internal — staff only
              </p>
              {internalPanel}
            </div>
          ) : null}

          {ctaHref ? (
            <Button asChild className="w-full">
              <Link href={ctaHref}>{ctaLabel ?? "View product page"}</Link>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CarouselButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow transition-colors hover:bg-background",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** The internal-only block: vendor, SKU, cost, margin, source URL, capture date. */
export function InternalCardPanel({
  vendorName,
  vendorSku,
  internalSku,
  startingAtCost,
  blendedMarginPct,
  sourceUrl,
  costCapturedAt,
  costIsStale,
}: {
  vendorName?: string | null;
  vendorSku?: string | null;
  internalSku?: string | null;
  startingAtCost?: number | null;
  blendedMarginPct?: number | null;
  sourceUrl?: string | null;
  costCapturedAt?: string | null;
  costIsStale?: boolean;
}) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Vendor", vendorName ?? "—"],
    ["Vendor SKU", vendorSku ?? "—"],
    ["Internal SKU", internalSku ?? "—"],
    ["Cost from", startingAtCost !== null && startingAtCost !== undefined ? `$${startingAtCost.toFixed(2)}` : "—"],
    ["Blended margin", blendedMarginPct !== null && blendedMarginPct !== undefined ? `${blendedMarginPct}%` : "—"],
    [
      "Cost captured",
      costCapturedAt ? (
        <span className={cn(costIsStale && "font-medium text-amber-600")}>
          {new Date(costCapturedAt).toLocaleDateString()}
          {costIsStale ? " · stale" : ""}
        </span>
      ) : (
        "—"
      ),
    ],
    [
      "Source",
      sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noreferrer noopener" className="truncate underline underline-offset-2">
          {new URL(sourceUrl).hostname}
        </a>
      ) : (
        "—"
      ),
    ],
  ];

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 text-right font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
