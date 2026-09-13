// ─── SlotFillIndicator ──────────────────────────────────────────────────────
//
// "3 of 8 filled", with an over-capacity warning. A slot can exceed its cap if
// max_items was lowered after cards were already placed — that state has to be
// visible, because the renderer silently truncates and the page would quietly
// stop showing a card nobody removed.

import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

export function SlotFillIndicator({
  filled,
  max,
  className,
  showBar = true,
}: {
  filled: number;
  max: number;
  className?: string;
  showBar?: boolean;
}) {
  const over = filled > max;
  const full = filled === max;
  const ratio = max > 0 ? Math.min(1, filled / max) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showBar ? (
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full transition-all",
              over ? "bg-destructive" : full ? "bg-amber-500" : "bg-emerald-500",
            )}
            style={{ width: `${Math.max(ratio * 100, filled > 0 ? 8 : 0)}%` }}
          />
        </div>
      ) : null}

      <span
        className={cn(
          "text-xs tabular-nums",
          over ? "font-medium text-destructive" : full ? "text-amber-600" : "text-muted-foreground",
        )}
      >
        {filled} of {max} filled
      </span>

      {over ? (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium text-destructive"
          title={`${filled - max} card(s) beyond this slot's capacity will not render. Remove some, or raise max_items in the slot registry.`}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          over capacity
        </span>
      ) : null}
    </div>
  );
}
