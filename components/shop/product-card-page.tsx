// ─── ProductCardPage ────────────────────────────────────────────────────────
//
// The public product page for a Product Card. Server component — it receives an
// already-public shape, so there is no cost in this tree to leak.
//
// Related and upsell slots render through <Slot> rather than a hardcoded query,
// so merchandising them is a dashboard action, not a code change.

import Link from "next/link";
import { Clock, Package } from "lucide-react";

import { Slot } from "@/components/placements/slot";
import { ProductImage } from "@/components/products/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRICE_UNIT_LABELS } from "@/lib/pricing/types";
import { formatStartingAt } from "@/lib/products/shape";
import type { PublicCard } from "@/lib/products/types";
import { cn } from "@/lib/utils";

export function ProductCardPage({ card }: { card: PublicCard }) {
  const specs = Object.entries(card.specTable ?? {});
  const defaultVariant = card.variants.find((v) => v.isDefault) ?? card.variants[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/shop" className="hover:underline">
          Shop
        </Link>
        {card.category ? (
          <>
            <span aria-hidden>/</span>
            <Link href={`/shop/category/${card.category.slug}`} className="hover:underline">
              {card.category.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden>/</span>
        <span className="text-foreground">{card.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <Gallery card={card} />

        <div className="space-y-6">
          <header className="space-y-2">
            {card.category ? <Badge variant="outline">{card.category.name}</Badge> : null}
            <h1 className="text-3xl font-bold tracking-tight">{card.title}</h1>
            {card.subtitle ? <p className="text-base text-muted-foreground">{card.subtitle}</p> : null}
          </header>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-semibold tabular-nums">{formatStartingAt(card)}</span>
            {card.variants.length > 1 ? (
              <span className="text-sm text-muted-foreground">
                {card.variants.length} options · {PRICE_UNIT_LABELS[card.priceUnit]}
              </span>
            ) : null}
          </div>

          {card.description ? (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{card.description}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {card.leadTimeDays ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Ready in {card.leadTimeDays} business day{card.leadTimeDays === 1 ? "" : "s"}
              </span>
            ) : null}
            {defaultVariant ? (
              <span className="inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" aria-hidden />
                Default: {defaultVariant.label ?? `Qty ${defaultVariant.quantity}`}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="default">
              <Link href={`/contact?product=${encodeURIComponent(card.slug ?? card.id)}`}>Request a quote</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </div>

      {card.variants.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Pricing</h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Option</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {card.variants.map((variant) => (
                  <TableRow key={variant.id} className={cn(variant.isDefault && "bg-accent/40")}>
                    <TableCell className="font-medium">
                      {variant.label ?? Object.values(variant.spec).join(" / ") ?? "Standard"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {variant.quantity.toLocaleString("en-US")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      ${variant.unitRetail.toFixed(2)} {PRICE_UNIT_LABELS[card.priceUnit]}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      ${variant.extendedRetail.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {specs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Specifications</h2>
          <dl className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
            {specs.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-b py-2 text-sm">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <Slot slotKey="product_upsell" contextId={card.id} heading="Worth adding" />
      <Slot slotKey="product_related" contextId={card.id} heading="Related products" />
    </div>
  );
}

function Gallery({ card }: { card: PublicCard }) {
  const [featured, ...rest] = card.images.length ? card.images : card.featuredImage ? [card.featuredImage] : [];

  if (!featured) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">No image</div>;
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        <ProductImage
          src={featured.url}
          alt={featured.alt || card.title}
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {rest.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {rest.slice(0, 4).map((image) => (
            <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              <ProductImage src={image.url} alt={image.alt || card.title} sizes="15vw" className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
