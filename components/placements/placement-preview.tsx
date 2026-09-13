"use client";

// ─── PlacementPreview ───────────────────────────────────────────────────────
//
// A live render of the card in the chosen display mode, with the placement's
// overrides applied. Placement without preview is guesswork (spec §8.8).

import { ProductCard } from "@/components/products/product-card";
import type { DisplayMode, PublicCard, PublicImage } from "@/lib/products/types";
import { DISPLAY_MODE_LABELS } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  card: PublicCard;
  displayMode: DisplayMode;
  titleOverride?: string | null;
  subtitleOverride?: string | null;
  imageOverrideId?: string | null;
  variantId?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  badgeText?: string | null;
  className?: string;
};

export function PlacementPreview({
  card,
  displayMode,
  titleOverride,
  subtitleOverride,
  imageOverrideId,
  variantId,
  ctaLabel,
  ctaHref,
  badgeText,
  className,
}: Props) {
  const image: PublicImage | null =
    (imageOverrideId ? card.images.find((i) => i.id === imageOverrideId) : null) ?? card.featuredImage;

  const variant =
    (variantId ? card.variants.find((v) => v.id === variantId) : null) ??
    card.variants.find((v) => v.isDefault) ??
    null;

  // Wide modes need room; constraining them to a card-sized box would preview a
  // layout the page will never produce.
  const wide = displayMode === "hero" || displayMode === "cta_banner";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
        <span className="text-[10px] text-muted-foreground">{DISPLAY_MODE_LABELS[displayMode]}</span>
      </div>

      <div
        className={cn(
          "rounded-lg border border-dashed bg-[linear-gradient(45deg,transparent_46%,hsl(var(--muted))_46%,hsl(var(--muted))_54%,transparent_54%)] bg-[length:8px_8px] p-4",
        )}
      >
        <div className={cn("mx-auto", wide ? "max-w-3xl" : displayMode === "list_row" ? "max-w-xl" : "max-w-xs")}>
          <ProductCard
            card={card}
            displayMode={displayMode}
            title={titleOverride || card.title}
            subtitle={subtitleOverride ?? card.subtitle}
            image={image}
            price={variant ? variant.unitRetail : card.startingAtRetail}
            ctaLabel={ctaLabel ?? undefined}
            ctaHref={ctaHref ?? undefined}
            badgeText={badgeText}
          />
        </div>
      </div>
    </div>
  );
}
