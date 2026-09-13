"use client";

// ─── CardPlacementsTab ──────────────────────────────────────────────────────
//
// The "from a card" view (spec §8.8): every slot the card could go into,
// grouped by surface, with a toggle each. Turning one on reveals the display
// mode picker, override fields and schedule.
//
// Slots the card cannot enter stay visible with the reason attached. "Why can't
// I feature this product" should not need a support ticket.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlacementEditor, ScheduleBadge, type PlacementDraft } from "@/components/placements/placement-editor";
import { SlotFillIndicator } from "@/components/placements/slot-fill-indicator";
import { placementSchedule } from "@/lib/products/shape";
import type { DisplayMode, PlacementRow, PublicCard, SlotRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type SlotRowState = {
  slot: SlotRow;
  filled: number;
  full: boolean;
  unavailableReason: string | null;
  allowedDisplayModes: DisplayMode[];
  placements: Array<PlacementRow & { schedule: ReturnType<typeof placementSchedule> }>;
};

type Props = {
  cardId: string;
  /** Public shape of this card, so the preview renders exactly what ships. */
  card: PublicCard;
  accessToken: string;
};

const SURFACE_LABELS = {
  storefront: "Storefront",
  landing: "Landing pages",
  dashboard: "Dashboards",
} as const;

export function CardPlacementsTab({ cardId, card, accessToken }: Props) {
  const [rows, setRows] = useState<SlotRowState[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlacementDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = { "content-type": "application/json", authorization: `Bearer ${accessToken}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cards/${cardId}/placements`, { headers });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not load placements.");
      setRows(payload.slots ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load placements.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (row: SlotRowState) => {
    const existing = row.placements[0];
    setBusy(true);
    setError(null);

    try {
      if (existing) {
        await fetch(`/api/placements/${existing.id}`, { method: "DELETE", headers });
        if (expanded === row.slot.id) setExpanded(null);
      } else {
        const response = await fetch(`/api/slots/${row.slot.key}/placements`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            card_id: cardId,
            display_mode: row.allowedDisplayModes[0],
            // Per-context slots repeat over a category, card or page, so they
            // are managed from the slot view where that context is chosen.
            context_id: null,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not add to that slot.");
        setExpanded(row.slot.id);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that placement.");
    } finally {
      setBusy(false);
    }
  };

  const save = async (placementId: string) => {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/placements/${placementId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
      </p>
    );
  }

  const surfaces = ["storefront", "landing", "dashboard"] as const;
  const activeCount = rows.reduce((n, row) => n + row.placements.filter((p) => p.is_active).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {activeCount === 0
            ? "This card is not placed anywhere. Publishing does not imply placement — a published card can appear nowhere until you put it somewhere."
            : `Appearing in ${activeCount} place${activeCount === 1 ? "" : "s"}.`}
        </p>
      </div>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {surfaces.map((surface) => {
        const group = rows.filter((row) => row.slot.surface === surface);
        if (!group.length) return null;

        return (
          <section key={surface} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {SURFACE_LABELS[surface]}
            </h4>

            <div className="divide-y rounded-lg border">
              {group.map((row) => {
                const placement = row.placements[0];
                const placed = Boolean(placement);
                const locked = Boolean(row.unavailableReason) || (row.full && !placed);
                const isOpen = expanded === row.slot.id;
                const contextual = Boolean(row.slot.context_type);

                return (
                  <div key={row.slot.id} className={cn(locked && "bg-muted/30")}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={placed}
                        disabled={busy || locked || contextual}
                        onChange={() => toggle(row)}
                        className="h-4 w-4 rounded border-input"
                        aria-label={`Place in ${row.slot.label}`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{row.slot.label}</span>
                          {contextual ? (
                            <Badge variant="secondary" className="font-normal">
                              per {row.slot.context_type} — manage from the slot view
                            </Badge>
                          ) : null}
                          {placement ? <ScheduleBadge state={placement.schedule} /> : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{row.slot.description}</p>

                        {locked && row.unavailableReason ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                            <Lock className="h-3 w-3" aria-hidden />
                            {row.unavailableReason}
                          </p>
                        ) : null}
                        {row.full && !placed && !row.unavailableReason ? (
                          <p className="mt-1 text-xs text-amber-700">
                            Full — remove a card from this slot before adding another.
                          </p>
                        ) : null}
                      </div>

                      <SlotFillIndicator filled={row.filled} max={row.slot.max_items} showBar={false} />

                      {placed ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setExpanded(isOpen ? null : row.slot.id);
                            setDraft(isOpen ? null : toDraft(placement));
                          }}
                        >
                          {isOpen ? "Close" : "Configure"}
                        </Button>
                      ) : null}
                    </div>

                    {isOpen && placement && draft ? (
                      <div className="border-t bg-muted/20 px-4 py-4">
                        <PlacementEditor
                          slot={row.slot}
                          card={card}
                          value={draft}
                          onChange={setDraft}
                          onSave={() => save(placement.id)}
                          saving={busy}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function toDraft(placement: PlacementRow): PlacementDraft {
  return {
    display_mode: placement.display_mode,
    title_override: placement.title_override,
    subtitle_override: placement.subtitle_override,
    image_override_id: placement.image_override_id,
    variant_id: placement.variant_id,
    cta_label: placement.cta_label,
    cta_href: placement.cta_href,
    badge_text: placement.badge_text,
    starts_at: placement.starts_at,
    ends_at: placement.ends_at,
    is_active: placement.is_active,
  };
}
