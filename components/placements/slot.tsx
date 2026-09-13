// ─── <Slot> ─────────────────────────────────────────────────────────────────
//
// One server component resolves everything (spec §8.7):
//
//   <Slot slotKey="home_hero" />
//   <Slot slotKey="category_spotlight" contextId={category.id} />
//   <Slot slotKey="product_related" contextId={card.id} />
//
// It queries active placements for that key and context, filters by date window
// and status, applies overrides, and renders each card in its assigned display
// mode. Adding a slot to a page is a registry row plus one of these — no schema
// change.
//
// Empty slots render nothing. Not a placeholder, not an empty grid — nothing.

import { ProductCard } from "@/components/products/product-card";
import { resolveSlotForRender } from "@/lib/products/queries";
import type { DisplayMode, ResolvedPlacement } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  slotKey: string;
  contextId?: string | null;
  /** Optional heading, rendered only when the slot has something in it. */
  heading?: string;
  description?: string;
  className?: string;
  /** Overrides the layout inferred from the first placement's display mode. */
  layout?: "grid" | "row" | "stack" | "list";
};

export async function Slot({ slotKey, contextId, heading, description, className, layout }: Props) {
  let placements: ResolvedPlacement[] = [];

  try {
    placements = await resolveSlotForRender(slotKey, contextId ?? null);
  } catch {
    // A slot that cannot resolve renders nothing rather than breaking the page
    // around it. The dashboard is where slot problems get surfaced.
    return null;
  }

  if (!placements.length) return null;

  const resolvedLayout = layout ?? layoutFor(placements[0].displayMode);

  return (
    <section className={cn("space-y-4", className)}>
      {heading ? (
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}

      <div className={LAYOUT_CLASSES[resolvedLayout]}>
        {placements.map((placement) => (
          <ProductCard
            key={placement.placementId}
            card={placement.card}
            displayMode={placement.displayMode}
            title={placement.title}
            subtitle={placement.subtitle}
            image={placement.image}
            price={placement.price}
            ctaLabel={placement.ctaLabel}
            ctaHref={placement.ctaHref}
            badgeText={placement.badgeText}
          />
        ))}
      </div>
    </section>
  );
}

const LAYOUT_CLASSES = {
  grid: "grid gap-5 sm:grid-cols-2 lg:grid-cols-4",
  row: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  stack: "space-y-6",
  list: "divide-y rounded-lg border",
} as const;

function layoutFor(mode: DisplayMode): keyof typeof LAYOUT_CLASSES {
  switch (mode) {
    case "hero":
    case "cta_banner":
      return "stack";
    case "compact":
      return "row";
    case "list_row":
      return "list";
    default:
      return "grid";
  }
}
