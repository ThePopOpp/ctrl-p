"use client";

// ─── ImageSourceSelect ──────────────────────────────────────────────────────
//
// Asset provenance (spec §9). Capturing a vendor's page for internal reference
// and republishing that content on a public commercial storefront are different
// things, and the second carries real exposure.
//
// This control turns the compliance rule into a workflow step: the blocking
// state explains itself and points at the fix, rather than just refusing.

import { ExternalLink, ShieldAlert } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { IMAGE_SOURCE_LABELS, PUBLISHABLE_IMAGE_SOURCES, type ImageSource } from "@/lib/products/types";
import { cn } from "@/lib/utils";

const ORDERED: ImageSource[] = ["vendor_licensed", "own_photo", "permission", "scraped_reference"];

const HELP: Record<ImageSource, string> = {
  vendor_licensed:
    "Marketing images the vendor provides explicitly for reseller use. This is the intended path and usually just requires asking your rep.",
  own_photo: "Photography you shot. Best differentiation, and unambiguously yours.",
  permission: "Written permission from the vendor for these specific images. Record who granted it and when.",
  scraped_reference:
    "Pulled from the vendor's page. Fine as internal reference on a draft; cannot be the featured image of a published card.",
};

type Props = {
  value: ImageSource;
  onChange: (value: ImageSource) => void;
  note: string | null;
  onNoteChange: (note: string | null) => void;
  /** Featured images gate publishing; gallery images do not. */
  isPrimary?: boolean;
  vendorName?: string | null;
  vendorPortalUrl?: string | null;
  disabled?: boolean;
  className?: string;
};

export function ImageSourceSelect({
  value,
  onChange,
  note,
  onNoteChange,
  isPrimary = false,
  vendorName,
  vendorPortalUrl,
  disabled = false,
  className,
}: Props) {
  const blocksPublish = isPrimary && !PUBLISHABLE_IMAGE_SOURCES.includes(value);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={(next) => onChange(next as ImageSource)} disabled={disabled}>
          <SelectTrigger className={cn("w-full", blocksPublish && "border-destructive text-destructive")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDERED.map((source) => (
              <SelectItem key={source} value={source}>
                {IMAGE_SOURCE_LABELS[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{HELP[value]}</p>

      {(value === "permission" || value === "vendor_licensed") && (
        <Input
          className="h-8 text-xs"
          placeholder={
            value === "permission" ? "Who granted permission, and when" : "Which asset pack, and where it came from"
          }
          value={note ?? ""}
          onChange={(event) => onNoteChange(event.target.value || null)}
          disabled={disabled}
        />
      )}

      {blocksPublish && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p>
              This card cannot be published while its featured image is a scraped reference — republishing a vendor's
              photo on a public storefront is a copyright exposure.
            </p>
            {vendorPortalUrl ? (
              <a
                href={vendorPortalUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
              >
                Request assets from {vendorName ?? "the vendor"}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="font-medium">
                Ask {vendorName ?? "your vendor rep"} for their dealer asset pack, shoot your own, or get written
                permission.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
