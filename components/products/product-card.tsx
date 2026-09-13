"use client";

// ─── ProductCard ────────────────────────────────────────────────────────────
//
// ONE component driven by the display mode (spec §8.3, §13). Two separate card
// implementations drift apart within a month, so every surface — shop grid,
// hero, CTA band, dashboard list — renders through this.
//
// The tile stays lean: image, title, subtitle, from-price, More. Detail lives
// in the modal. Nothing else earns its place in a grid.

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductCardModal } from "@/components/products/product-card-modal";
import { ProductImage } from "@/components/products/product-image";
import { formatStartingAt } from "@/lib/products/shape";
import type { DisplayMode, PublicCard, PublicImage } from "@/lib/products/types";
import { cn } from "@/lib/utils";

export type ProductCardProps = {
  card: PublicCard;
  displayMode?: DisplayMode;
  /** Per-placement overrides, already resolved. */
  title?: string;
  subtitle?: string | null;
  image?: PublicImage | null;
  price?: number | null;
  ctaLabel?: string;
  ctaHref?: string;
  badgeText?: string | null;
  /** Staff-only detail inside the modal. Never pass this on a public surface. */
  internalPanel?: React.ReactNode;
  className?: string;
};

export function ProductCard(props: ProductCardProps) {
  const mode = props.displayMode ?? "tile";
  switch (mode) {
    case "hero":
      return <HeroCard {...props} />;
    case "cta_banner":
      return <CtaBannerCard {...props} />;
    case "compact":
      return <CompactCard {...props} />;
    case "list_row":
      return <ListRowCard {...props} />;
    case "spec_highlight":
      return <TileCard {...props} showSpecs />;
    case "tile":
    default:
      return <TileCard {...props} />;
  }
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function useResolved(props: ProductCardProps) {
  const title = props.title ?? props.card.title;
  const subtitle = props.subtitle !== undefined ? props.subtitle : props.card.subtitle;
  const image = props.image !== undefined ? props.image : props.card.featuredImage;
  const href = props.ctaHref ?? (props.card.slug ? `/shop/${props.card.slug}` : "#");
  const price =
    props.price !== undefined && props.price !== null
      ? `$${props.price.toFixed(2)}`
      : formatStartingAt(props.card);
  return { title, subtitle, image, href, price };
}

function CardImage({
  image,
  alt,
  className,
  sizes,
  priority = false,
}: {
  image: PublicImage | null;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  if (!image?.url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-xs text-muted-foreground", className)}>
        No image
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <ProductImage
        src={image.url}
        alt={image.alt || alt}
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
}

function PlacementBadge({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <Badge className="absolute left-3 top-3 z-10 shadow-sm" variant="default">
      {text}
    </Badge>
  );
}

// ─── tile ───────────────────────────────────────────────────────────────────

function TileCard(props: ProductCardProps & { showSpecs?: boolean }) {
  const { title, subtitle, image, href, price } = useResolved(props);
  const [open, setOpen] = useState(false);
  const specs = Object.entries(props.card.specTable ?? {}).slice(0, 4);

  return (
    <>
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md",
          props.className,
        )}
      >
        <PlacementBadge text={props.badgeText} />

        <Link href={href} className="block" aria-label={title}>
          <CardImage image={image} alt={title} className="aspect-[4/3] w-full" sizes="(max-width: 768px) 100vw, 33vw" />
        </Link>

        <div className="flex flex-1 flex-col gap-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug">
              <Link href={href} className="hover:underline">
                {title}
              </Link>
            </h3>
            {props.card.category ? (
              <Badge variant="outline" className="shrink-0 font-normal">
                {props.card.category.name}
              </Badge>
            ) : null}
          </div>

          {subtitle ? <p className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</p> : null}

          {props.showSpecs && specs.length > 0 && (
            <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
              {specs.map(([key, value]) => (
                <div key={key} className="flex min-w-0 gap-1">
                  <dt className="shrink-0 text-muted-foreground">{key}</dt>
                  <dd className="truncate font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="text-sm font-semibold tabular-nums">{price}</span>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              More
            </Button>
          </div>
        </div>
      </article>

      <ProductCardModal
        card={props.card}
        open={open}
        onOpenChange={setOpen}
        ctaHref={href}
        ctaLabel={props.ctaLabel}
        internalPanel={props.internalPanel}
      />
    </>
  );
}

// ─── hero ───────────────────────────────────────────────────────────────────

function HeroCard(props: ProductCardProps) {
  const { title, subtitle, image, href, price } = useResolved(props);

  return (
    <section
      className={cn(
        "relative grid overflow-hidden rounded-2xl border bg-card md:grid-cols-2",
        props.className,
      )}
    >
      <PlacementBadge text={props.badgeText} />
      <CardImage
        image={image}
        alt={title}
        className="aspect-[16/10] w-full md:aspect-auto md:h-full"
        sizes="(max-width: 768px) 100vw, 50vw"
        priority
      />

      <div className="flex flex-col justify-center gap-4 p-8 md:p-12">
        {props.card.category ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {props.card.category.name}
          </span>
        ) : null}

        <h2 className="text-3xl font-bold leading-tight md:text-4xl">{title}</h2>
        {subtitle ? <p className="text-base text-muted-foreground">{subtitle}</p> : null}

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <span className="text-2xl font-semibold tabular-nums">{price}</span>
          {props.card.leadTimeDays ? (
            <span className="text-sm text-muted-foreground">Ready in {props.card.leadTimeDays} days</span>
          ) : null}
        </div>

        <Button asChild size="default" className="mt-2 w-fit">
          <Link href={href}>
            {props.ctaLabel ?? "View details"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

// ─── cta_banner ─────────────────────────────────────────────────────────────

function CtaBannerCard(props: ProductCardProps) {
  const { title, subtitle, image, href, price } = useResolved(props);

  return (
    <section
      className={cn(
        "flex flex-col items-center gap-6 rounded-xl border bg-muted/30 p-6 sm:flex-row sm:p-8",
        props.className,
      )}
    >
      <CardImage image={image} alt={title} className="h-32 w-32 shrink-0 rounded-lg" sizes="128px" />

      <div className="flex-1 space-y-1.5 text-center sm:text-left">
        {props.badgeText ? <Badge className="mb-1">{props.badgeText}</Badge> : null}
        <h3 className="text-xl font-semibold">{title}</h3>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        <p className="pt-1 text-sm font-semibold tabular-nums">{price}</p>
      </div>

      <Button asChild className="shrink-0">
        <Link href={href}>
          {props.ctaLabel ?? "Order now"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}

// ─── compact ────────────────────────────────────────────────────────────────

function CompactCard(props: ProductCardProps) {
  const { title, image, href, price } = useResolved(props);

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-colors hover:bg-accent",
        props.className,
      )}
    >
      <CardImage image={image} alt={title} className="h-14 w-14 shrink-0 rounded-md" sizes="56px" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{price}</p>
      </div>
      {props.badgeText ? (
        <Badge variant="secondary" className="shrink-0">
          {props.badgeText}
        </Badge>
      ) : null}
    </Link>
  );
}

// ─── list_row ───────────────────────────────────────────────────────────────

function ListRowCard(props: ProductCardProps) {
  const { title, subtitle, href, price } = useResolved(props);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-4 border-b px-3 py-2 text-sm transition-colors last:border-0 hover:bg-accent",
        props.className,
      )}
    >
      <div className="min-w-0">
        <span className="font-medium">{title}</span>
        {subtitle ? <span className="ml-2 truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {props.badgeText ? <Badge variant="outline">{props.badgeText}</Badge> : null}
        <span className="font-semibold tabular-nums">{price}</span>
      </div>
    </Link>
  );
}
