"use client";

import { cn } from "@/lib/utils";
import { money } from "@/lib/wall-studio/pricing";
import { tileBackgroundImage } from "@/lib/wall-studio/tiles";
import { WS_CATEGORY_LABEL, type WsProduct } from "@/lib/wall-studio/types";

export function DesignCard({
  product,
  selected,
  onPreview,
}: {
  product: WsProduct;
  selected: boolean;
  onPreview: () => void;
}) {
  return (
    <div
      className={cn(
        "ws-card flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900",
        selected && "outline outline-2 -outline-offset-2",
      )}
      style={selected ? { outlineColor: "var(--ws-accent)" } : undefined}
    >
      <button
        type="button"
        onClick={onPreview}
        className="block text-left"
        aria-label={`Preview ${product.name}`}
      >
        <div
          className="h-[150px] w-full"
          style={{
            backgroundImage: tileBackgroundImage(product),
            backgroundSize: product.repeat_pattern ? "110px" : "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="flex flex-col gap-1 px-4 pb-2 pt-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            {WS_CATEGORY_LABEL[product.category]}
          </span>
          <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">{product.name}</h3>
          <span className="text-[13px] text-zinc-500">{money(product.price_per_sqft)} / sq ft</span>
        </div>
      </button>
      <div className="mt-auto px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={onPreview}
          className="w-full rounded-md border border-zinc-200 px-3 py-2 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Preview design
        </button>
      </div>
    </div>
  );
}
