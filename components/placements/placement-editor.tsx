"use client";

// ─── PlacementEditor ────────────────────────────────────────────────────────
//
// Display mode, per-placement overrides and schedule for one placement
// (spec §8.4, §8.5). Overrides are null by default; when null, the card's own
// values render — so the editor shows the card's value as the placeholder
// rather than pre-filling it, keeping "inherited" and "overridden" distinct.

import { useState } from "react";
import { CalendarClock, Loader2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlacementPreview } from "@/components/placements/placement-preview";
import { DISPLAY_MODE_LABELS, type DisplayMode, type PlacementRow, type PublicCard, type SlotRow } from "@/lib/products/types";
import { placementSchedule } from "@/lib/products/shape";
import { cn } from "@/lib/utils";

export type PlacementDraft = Pick<
  PlacementRow,
  | "display_mode"
  | "title_override"
  | "subtitle_override"
  | "image_override_id"
  | "variant_id"
  | "cta_label"
  | "cta_href"
  | "badge_text"
  | "starts_at"
  | "ends_at"
  | "is_active"
>;

type Props = {
  slot: SlotRow;
  card: PublicCard;
  value: PlacementDraft;
  onChange: (value: PlacementDraft) => void;
  onSave?: () => void;
  onRemove?: () => void;
  saving?: boolean;
  className?: string;
};

export function PlacementEditor({ slot, card, value, onChange, onSave, onRemove, saving = false, className }: Props) {
  const [showSchedule, setShowSchedule] = useState(Boolean(value.starts_at || value.ends_at));
  const schedule = placementSchedule(value as PlacementRow);

  const set = <K extends keyof PlacementDraft>(key: K, next: PlacementDraft[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[1fr_320px]", className)}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{slot.label}</Badge>
          <ScheduleBadge state={schedule} />
        </div>

        <Row label="Display mode" hint="Only the renderings this slot allows">
          <Select value={value.display_mode} onValueChange={(next) => set("display_mode", next as DisplayMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {slot.allowed_display_modes.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {DISPLAY_MODE_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Title override" hint={`Falls back to "${card.title}"`}>
          <Input
            placeholder={card.title}
            value={value.title_override ?? ""}
            onChange={(event) => set("title_override", event.target.value || null)}
          />
        </Row>

        <Row label="Subtitle override" hint={card.subtitle ? `Falls back to "${card.subtitle}"` : "No card subtitle"}>
          <Input
            placeholder={card.subtitle ?? ""}
            value={value.subtitle_override ?? ""}
            onChange={(event) => set("subtitle_override", event.target.value || null)}
          />
        </Row>

        <Row label="Image" hint="Pick a different image from the card's gallery">
          <Select
            value={value.image_override_id ?? "__default"}
            onValueChange={(next) => set("image_override_id", next === "__default" ? null : next)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">Card's featured image</SelectItem>
              {card.images.map((image, index) => (
                <SelectItem key={image.id} value={image.id}>
                  {image.caption || image.alt || `Image ${index + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Featured variant" hint="Which variant's price leads — a hero might lead with the 1000-qty price">
          <Select
            value={value.variant_id ?? "__default"}
            onValueChange={(next) => set("variant_id", next === "__default" ? null : next)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">Lowest price (from $…)</SelectItem>
              {card.variants.map((variant) => (
                <SelectItem key={variant.id} value={variant.id}>
                  {variant.label ?? `Qty ${variant.quantity}`} — ${variant.unitRetail.toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <div className="grid gap-4 sm:grid-cols-2">
          <Row label="CTA label" hint='e.g. "Order now" or "Request a quote"'>
            <Input
              placeholder="View details"
              value={value.cta_label ?? ""}
              onChange={(event) => set("cta_label", event.target.value || null)}
            />
          </Row>

          <Row label="CTA link" hint={card.slug ? `Falls back to /shop/${card.slug}` : undefined}>
            <Input
              placeholder={card.slug ? `/shop/${card.slug}` : "/shop"}
              value={value.cta_href ?? ""}
              onChange={(event) => set("cta_href", event.target.value || null)}
            />
          </Row>
        </div>

        <Row label="Badge" hint='e.g. "New", "Best seller", "Rush available"'>
          <Input
            placeholder="None"
            value={value.badge_text ?? ""}
            onChange={(event) => set("badge_text", event.target.value || null)}
          />
        </Row>

        {slot.supports_scheduling ? (
          <div className="space-y-3 rounded-lg border p-3">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowSchedule((open) => !open)}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {showSchedule ? "Hide schedule" : "Schedule this placement"}
            </button>

            {showSchedule && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="Starts" hint="Leave empty to start now">
                  <Input
                    type="datetime-local"
                    value={toLocalInput(value.starts_at)}
                    onChange={(event) => set("starts_at", fromLocalInput(event.target.value))}
                  />
                </Row>
                <Row label="Ends" hint="Expires on its own — nothing to pull down">
                  <Input
                    type="datetime-local"
                    value={toLocalInput(value.ends_at)}
                    onChange={(event) => set("ends_at", fromLocalInput(event.target.value))}
                  />
                </Row>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          {onRemove ? (
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={saving} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Remove from slot
            </Button>
          ) : (
            <span />
          )}
          {onSave ? (
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save placement
            </Button>
          ) : null}
        </div>
      </div>

      <PlacementPreview
        card={card}
        displayMode={value.display_mode}
        titleOverride={value.title_override}
        subtitleOverride={value.subtitle_override}
        imageOverrideId={value.image_override_id}
        variantId={value.variant_id}
        ctaLabel={value.cta_label}
        ctaHref={value.cta_href}
        badgeText={value.badge_text}
      />
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-xs font-medium">{label}</label>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function ScheduleBadge({ state }: { state: ReturnType<typeof placementSchedule> }) {
  const styles = {
    live: "bg-emerald-100 text-emerald-800",
    scheduled: "bg-sky-100 text-sky-800",
    expired: "bg-amber-100 text-amber-900",
    inactive: "bg-slate-100 text-slate-600",
  } as const;

  const labels = {
    live: "Live",
    scheduled: "Scheduled",
    expired: "Expired",
    inactive: "Inactive",
  } as const;

  return <Badge className={cn("font-normal", styles[state])}>{labels[state]}</Badge>;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
