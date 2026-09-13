"use client";

// ─── PublishChecklist ───────────────────────────────────────────────────────
//
// Shows WHICH items are missing, not a generic error (spec §8.6). Every failing
// row carries the reason, because "cannot publish" without a cause is a support
// ticket waiting to happen.

import { AlertCircle, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChecklistItem } from "@/lib/products/shape";
import { cn } from "@/lib/utils";

type Props = {
  items: ChecklistItem[];
  status: string;
  onPublish?: () => void;
  onSetReady?: () => void;
  onUnpublish?: () => void;
  busy?: boolean;
};

export function PublishChecklist({ items, status, onPublish, onSetReady, onUnpublish, busy = false }: Props) {
  const missing = items.filter((item) => !item.ok);
  const ready = missing.length === 0;
  const published = status === "published";

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Publish checklist</h3>
          <p className="text-xs text-muted-foreground">
            {published
              ? "Live on the storefront."
              : ready
                ? "Everything checks out — this card can go live."
                : `${missing.length} item${missing.length === 1 ? "" : "s"} outstanding.`}
          </p>
        </div>

        <div className="flex gap-2">
          {published ? (
            <Button variant="outline" size="sm" onClick={onUnpublish} disabled={busy}>
              Unpublish
            </Button>
          ) : (
            <>
              {status === "draft" && onSetReady && (
                <Button variant="outline" size="sm" onClick={onSetReady} disabled={busy}>
                  Mark ready
                </Button>
              )}
              <Button size="sm" onClick={onPublish} disabled={busy || !ready}>
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 px-4 py-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                item.ok ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive",
              )}
            >
              {item.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            </span>

            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", !item.ok && "font-medium")}>{item.label}</p>
              {item.detail ? (
                <p className={cn("mt-0.5 text-xs", item.ok ? "text-muted-foreground" : "text-destructive")}>
                  {item.detail}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {missing.some((item) => item.key === "image_source") && (
        <div className="flex items-start gap-2 border-t bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Why this is blocked</p>
            <p className="mt-1">
              Scraped vendor photos are fine as internal reference on a draft. Publishing them to a public storefront
              without a licence is a risk that is easy to avoid — most wholesale printers hand out dealer asset packs
              explicitly licensed for reseller use, and it usually just takes asking your rep.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
