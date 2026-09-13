"use client";

// ─── PlacementManager ───────────────────────────────────────────────────────
//
// The "from a slot" view (spec §8.8): all slots, open one to see its current
// cards in render order, drag to reorder, add or remove. This is the view for
// "what's on the homepage right now".

import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlacementEditor, ScheduleBadge, type PlacementDraft } from "@/components/placements/placement-editor";
import { SlotFillIndicator } from "@/components/placements/slot-fill-indicator";
import { placementSchedule } from "@/lib/products/shape";
import type { DisplayMode, PlacementRow, PublicCard, SlotRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type SlotWithFill = SlotRow & { filled: number; overCapacity: boolean };

type PlacementWithCard = PlacementRow & {
  schedule?: ReturnType<typeof placementSchedule>;
  card: { id: string; title: string; status: string; slug: string | null } | null;
};

type Props = {
  accessToken: string;
  /** Cards available to place, in public shape so the preview can render them. */
  cardLookup: (cardId: string) => PublicCard | null;
  searchCards: (term: string) => Array<{ id: string; title: string; status: string }>;
};

export function PlacementManager({ accessToken, cardLookup, searchCards }: Props) {
  const [slots, setSlots] = useState<SlotWithFill[]>([]);
  const [openSlot, setOpenSlot] = useState<SlotWithFill | null>(null);
  const [contextId, setContextId] = useState("");
  const [placements, setPlacements] = useState<PlacementWithCard[]>([]);
  const [editing, setEditing] = useState<PlacementWithCard | null>(null);
  const [draft, setDraft] = useState<PlacementDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => ({ "content-type": "application/json", authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  useEffect(() => {
    fetch("/api/slots", { headers: authHeaders })
      .then((response) => response.json())
      .then((payload) => setSlots(payload.slots ?? []))
      .catch(() => setError("Could not load the slot registry."));
  }, [authHeaders]);

  const loadPlacements = useCallback(
    async (slot: SlotWithFill, ctx: string) => {
      setBusy(true);
      setError(null);
      try {
        const query = ctx ? `?contextId=${encodeURIComponent(ctx)}` : "";
        const response = await fetch(`/api/slots/${slot.key}/placements${query}`, { headers: authHeaders });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load placements.");
        setPlacements(payload.placements ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load placements.");
      } finally {
        setBusy(false);
      }
    },
    [authHeaders],
  );

  const open = (slot: SlotWithFill) => {
    setOpenSlot(slot);
    setEditing(null);
    setContextId("");
    if (!slot.context_type) void loadPlacements(slot, "");
    else setPlacements([]);
  };

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor));

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !openSlot) return;

    const from = placements.findIndex((p) => p.id === active.id);
    const to = placements.findIndex((p) => p.id === over.id);
    if (from === -1 || to === -1) return;

    const next = [...placements];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setPlacements(next);

    const response = await fetch(`/api/slots/${openSlot.key}/reorder`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ placement_ids: next.map((p) => p.id) }),
    });
    if (!response.ok) {
      setError("The new order did not save. Reloading.");
      void loadPlacements(openSlot, contextId);
    }
  };

  const addCard = async (cardId: string) => {
    if (!openSlot) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/slots/${openSlot.key}/placements`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          card_id: cardId,
          context_id: openSlot.context_type ? contextId : null,
          display_mode: openSlot.allowed_display_modes[0],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not add that card.");
      setAdding(false);
      setSearch("");
      await loadPlacements(openSlot, contextId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that card.");
    } finally {
      setBusy(false);
    }
  };

  const savePlacement = async () => {
    if (!editing || !draft) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/placements/${editing.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save.");
      setEditing(null);
      if (openSlot) await loadPlacements(openSlot, contextId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const removePlacement = async (placementId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/placements/${placementId}`, { method: "DELETE", headers: authHeaders });
      setEditing(null);
      if (openSlot) await loadPlacements(openSlot, contextId);
    } finally {
      setBusy(false);
    }
  };

  // ─── Slot registry list ───
  if (!openSlot) {
    const bySurface = groupBy(slots, (slot) => slot.surface);

    return (
      <div className="space-y-6">
        {error ? <ErrorNote message={error} /> : null}

        {Object.entries(bySurface).map(([surface, group]) => (
          <section key={surface} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{surface}</h3>
            <div className="divide-y rounded-lg border">
              {group.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => open(slot)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{slot.label}</span>
                      <Badge variant="outline" className="font-normal">
                        {slot.audience}
                      </Badge>
                      {slot.context_type ? (
                        <Badge variant="secondary" className="font-normal">
                          per {slot.context_type}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {slot.description} · <code className="text-[10px]">{slot.key}</code>
                    </p>
                  </div>
                  <SlotFillIndicator filled={slot.filled} max={slot.max_items} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ─── One slot ───
  const card = editing?.card ? cardLookup(editing.card.id) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setOpenSlot(null)}>
            ← All slots
          </Button>
          <h3 className="mt-1 text-lg font-semibold">{openSlot.label}</h3>
          <p className="text-xs text-muted-foreground">{openSlot.description}</p>
        </div>
        <SlotFillIndicator filled={placements.filter((p) => p.is_active).length} max={openSlot.max_items} />
      </div>

      {openSlot.context_type ? (
        <div className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium" htmlFor="context-id">
              {openSlot.context_type === "page" ? "Page key" : `${openSlot.context_type} ID`}
            </label>
            <Input
              id="context-id"
              value={contextId}
              onChange={(event) => setContextId(event.target.value)}
              placeholder={
                openSlot.context_type === "page" ? "e.g. landing-rush-cards" : "Paste the id this slot repeats over"
              }
            />
          </div>
          <Button variant="outline" onClick={() => loadPlacements(openSlot, contextId)} disabled={!contextId || busy}>
            Load
          </Button>
        </div>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      {editing && card && draft ? (
        <div className="rounded-lg border p-4">
          <PlacementEditor
            slot={openSlot}
            card={card}
            value={draft}
            onChange={setDraft}
            onSave={savePlacement}
            onRemove={() => removePlacement(editing.id)}
            saving={busy}
          />
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setEditing(null)}>
            Close editor
          </Button>
        </div>
      ) : null}

      {busy && !placements.length ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : placements.length ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <SortableContext items={placements.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y rounded-lg border">
              {placements.map((placement, index) => (
                <SortableRow
                  key={placement.id}
                  placement={placement}
                  index={index}
                  overCapacity={index >= openSlot.max_items}
                  onEdit={() => {
                    setEditing(placement);
                    setDraft(toDraft(placement));
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing placed here. This slot renders nothing on the page until you add a card.
        </p>
      )}

      <div className="space-y-2">
        {adding ? (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-8"
                placeholder="Search published cards…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <ul className="max-h-56 divide-y overflow-y-auto rounded border">
              {searchCards(search).map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => addCard(result.id)}
                    disabled={busy}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span>{result.title}</span>
                    <Badge variant="outline" className="font-normal">
                      {result.status}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            disabled={Boolean(openSlot.context_type) && !contextId}
          >
            <Plus className="h-3.5 w-3.5" /> Add a card
          </Button>
        )}
      </div>
    </div>
  );
}

function SortableRow({
  placement,
  index,
  overCapacity,
  onEdit,
}: {
  placement: PlacementWithCard;
  index: number;
  overCapacity: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: placement.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 bg-card px-3 py-2.5",
        isDragging && "relative z-10 shadow-lg",
        overCapacity && "bg-destructive/5",
      )}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="w-5 text-xs tabular-nums text-muted-foreground">{index + 1}</span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{placement.card?.title ?? "Missing card"}</p>
        <p className="text-xs text-muted-foreground">{placement.display_mode}</p>
      </div>

      {overCapacity ? (
        <Badge variant="destructive" className="font-normal">
          not rendering
        </Badge>
      ) : null}
      <ScheduleBadge state={placement.schedule ?? placementSchedule(placement)} />

      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </li>
  );
}

function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>;
}

function toDraft(placement: PlacementRow): PlacementDraft {
  return {
    display_mode: placement.display_mode as DisplayMode,
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

function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce(
    (groups, item) => {
      const group = key(item);
      (groups[group] ??= []).push(item);
      return groups;
    },
    {} as Record<K, T[]>,
  );
}
