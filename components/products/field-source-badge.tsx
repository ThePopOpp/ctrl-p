// ─── FieldSourceBadge ───────────────────────────────────────────────────────
//
// Every field in the review form shows where its value came from (spec §5):
//   verified   Tier 1–2, read from the page's own markup
//   extracted  Tier 3, inferred by a vision model from a screenshot
//   manual     typed by a person
//
// An `extracted` price is visually distinct on purpose. Acting on a
// vision-inferred cost without checking it is how margin quietly disappears.

import { Eye, PencilLine, ShieldCheck } from "lucide-react";

import { EXTRACTION_BADGES, type ExtractionSource } from "@/lib/products/types";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  extracted: "border-amber-300 bg-amber-50 text-amber-800",
  manual: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

const TONE_ICONS = {
  verified: ShieldCheck,
  extracted: Eye,
  manual: PencilLine,
} as const;

export function FieldSourceBadge({
  source,
  compact = false,
  confidence,
  className,
}: {
  source: ExtractionSource;
  compact?: boolean;
  confidence?: number;
  className?: string;
}) {
  const badge = EXTRACTION_BADGES[source];
  const Icon = TONE_ICONS[badge.tone];

  const title =
    badge.tone === "extracted"
      ? `Read from a screenshot by a vision model${confidence !== undefined ? ` (${Math.round(confidence * 100)}% confidence)` : ""} — check it before saving`
      : badge.tone === "verified"
        ? "Read from the page's own structured data"
        : "Entered by hand";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        TONE_STYLES[badge.tone],
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {!compact && badge.label}
    </span>
  );
}
