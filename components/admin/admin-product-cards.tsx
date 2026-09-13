"use client";

// ─── AdminProductCards ──────────────────────────────────────────────────────
//
// The internal management surface (spec §3 steps 8-10): review captures, price
// them, finish the retail-facing content, publish, and place.
//
// Everything on this screen is internal shape — cost, margin and vendor are all
// present. It is gated by verifyAdminRequest server-side on every fetch, not by
// hiding the route.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Link2,
  Loader2,
  Percent,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CardPlacementsTab } from "@/components/placements/card-placements-tab";
import { PlacementManager } from "@/components/placements/placement-manager";
import { BulkMarkupDialog } from "@/components/products/bulk-markup-dialog";
import { ImageSourceSelect } from "@/components/products/image-source-select";
import { MarkupControl, MarkupSummary, type MarkupControlValue } from "@/components/products/markup-control";
import { PricingTierSettings } from "@/components/products/pricing-tier-settings";
import { PublishChecklist } from "@/components/products/publish-checklist";
import { VariantTable, type EditableVariant } from "@/components/products/variant-table";
import { money, roundPct } from "@/lib/pricing/calculate";
import type { PricingTier } from "@/lib/pricing/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { imageUrl } from "@/lib/products/image-url";
import { toPublicCard, type ChecklistItem } from "@/lib/products/shape";
import { MARGIN_DRIFT_ALERT_POINTS, type CardStatus, type InternalCard } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type CardWithChecklist = InternalCard & { checklist: ChecklistItem[] };

type Tab = "cards" | "placements" | "pricing";

const STATUS_STYLES: Record<CardStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  ready: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-900",
};

export function AdminProductCards() {
  const [token, setToken] = useState<string | null>(null);
  const [cards, setCards] = useState<CardWithChecklist[]>([]);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [tab, setTab] = useState<Tab>("cards");
  const [statusFilter, setStatusFilter] = useState<CardStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [staleOnly, setStaleOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    client.auth
      .getSession()
      .then((result: { data: { session: { access_token: string } | null } }) =>
        setToken(result.data.session?.access_token ?? null),
      );
  }, []);

  const headers = useMemo(
    () => ({ "content-type": "application/json", authorization: `Bearer ${token ?? ""}` }),
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ status: statusFilter, limit: "200" });
      if (search) query.set("search", search);
      if (staleOnly) query.set("stale", "true");

      const [cardsResponse, tiersResponse] = await Promise.all([
        fetch(`/api/cards?${query}`, { headers }),
        fetch("/api/pricing/tiers", { headers }),
      ]);

      const cardsPayload = await cardsResponse.json();
      if (!cardsResponse.ok) throw new Error(cardsPayload.error ?? "Could not load cards.");
      setCards(cardsPayload.cards ?? []);

      if (tiersResponse.ok) {
        const tiersPayload = await tiersResponse.json();
        setTiers(tiersPayload.tiers ?? []);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load cards.");
    } finally {
      setLoading(false);
    }
  }, [token, headers, statusFilter, search, staleOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCard = cards.find((card) => card.id === openCardId) ?? null;

  const driftAlerts = useMemo(
    () =>
      cards.filter(
        (card) =>
          card.tier?.min_margin_pct !== null &&
          card.tier?.min_margin_pct !== undefined &&
          card.blendedMarginPct !== null &&
          card.blendedMarginPct < card.tier.min_margin_pct - MARGIN_DRIFT_ALERT_POINTS,
      ),
    [cards],
  );

  const staleCards = useMemo(() => cards.filter((card) => card.costIsStale), [cards]);

  if (!token) {
    return (
      <p className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your session…
      </p>
    );
  }

  if (openCard) {
    return (
      <CardEditor
        card={openCard}
        tiers={tiers}
        accessToken={token}
        onBack={() => setOpenCardId(null)}
        onSaved={load}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Cards</h1>
          <p className="text-sm text-muted-foreground">
            Capture from a vendor, price it, publish it, place it.
          </p>
        </div>

        <nav className="flex gap-1 rounded-lg border p-1">
          {(
            [
              ["cards", "Cards"],
              ["placements", "Placements"],
              ["pricing", "Pricing tiers"],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {(driftAlerts.length > 0 || staleCards.length > 0) && tab === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {staleCards.length > 0 ? (
            <AlertCard
              icon={<Clock className="h-4 w-4" />}
              tone="amber"
              title={`${staleCards.length} card${staleCards.length === 1 ? "" : "s"} with stale cost`}
              body="Captured more than 30 days ago. Print costs move constantly — paper, freight, seasonal pricing."
              action={{ label: "Show only these", onClick: () => setStaleOnly(true) }}
            />
          ) : null}

          {driftAlerts.length > 0 ? (
            <AlertCard
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="destructive"
              title={`${driftAlerts.length} card${driftAlerts.length === 1 ? "" : "s"} drifted below tier target`}
              body={`Margin is more than ${MARGIN_DRIFT_ALERT_POINTS} points under the tier floor. These are probably selling for less than intended.`}
            />
          ) : null}
        </div>
      ) : null}

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {tab === "pricing" ? (
        <PricingTierSettings accessToken={token} />
      ) : tab === "placements" ? (
        <PlacementManager
          accessToken={token}
          cardLookup={(cardId) => {
            const card = cards.find((c) => c.id === cardId);
            return card ? toPublicCard(card, { imageUrl }) : null;
          }}
          searchCards={(term) =>
            cards
              .filter(
                (card) =>
                  card.status !== "archived" &&
                  (!term || card.title.toLowerCase().includes(term.toLowerCase())),
              )
              .slice(0, 25)
              .map((card) => ({ id: card.id, title: card.title, status: card.status }))
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search title, vendor SKU, internal SKU…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {(["all", "draft", "ready", "published", "archived"] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </Button>
            ))}

            {staleOnly ? (
              <Button variant="secondary" size="sm" onClick={() => setStaleOnly(false)}>
                <Clock className="h-3.5 w-3.5" /> Stale only ×
              </Button>
            ) : null}

            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>

            <Button size="sm" disabled={selected.size === 0} onClick={() => setBulkOpen(true)}>
              <Percent className="h-3.5 w-3.5" /> Reprice {selected.size || ""}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Product</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32">Tier / markup</TableHead>
                  <TableHead className="w-28 text-right">From cost</TableHead>
                  <TableHead className="w-28 text-right">From retail</TableHead>
                  <TableHead className="w-24 text-right">Margin</TableHead>
                  <TableHead className="w-28">Cost age</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => {
                  const missing = card.checklist?.filter((item) => !item.ok).length ?? 0;
                  const underFloor =
                    card.tier?.min_margin_pct != null &&
                    card.blendedMarginPct != null &&
                    card.blendedMarginPct < card.tier.min_margin_pct;

                  return (
                    <TableRow key={card.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={selected.has(card.id)}
                          onChange={(event) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(card.id);
                              else next.delete(card.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${card.title}`}
                        />
                      </TableCell>

                      <TableCell>
                        <button type="button" className="text-left" onClick={() => setOpenCardId(card.id)}>
                          <span className="text-sm font-medium hover:underline">{card.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {card.vendor?.name ?? "No vendor"}
                            {card.category ? ` · ${card.category.name}` : ""}
                            {card.variants.length ? ` · ${card.variants.length} variants` : ""}
                          </span>
                        </button>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={cn("font-normal", STATUS_STYLES[card.status])}>{card.status}</Badge>
                          {missing > 0 && card.status !== "published" ? (
                            <span className="block text-[10px] text-muted-foreground">{missing} to fix</span>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        <MarkupSummary tier={card.tier} pct={card.markup_pct} flat={card.markup_flat} />
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {card.startingAtCost !== null ? money(card.startingAtCost) : "—"}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums">
                        {card.startingAtRetail !== null ? money(card.startingAtRetail) : "—"}
                      </TableCell>

                      <TableCell
                        className={cn("text-right tabular-nums", underFloor && "font-semibold text-amber-600")}
                        title={underFloor ? `Below the ${card.tier?.min_margin_pct}% floor for tier ${card.tier?.code}` : undefined}
                      >
                        {card.blendedMarginPct !== null ? `${roundPct(card.blendedMarginPct)}%` : "—"}
                      </TableCell>

                      <TableCell>
                        {card.costAgeDays === null ? (
                          <span className="text-xs text-muted-foreground">never</span>
                        ) : (
                          <span className={cn("text-xs", card.costIsStale && "font-medium text-amber-600")}>
                            {card.costAgeDays}d{card.costIsStale ? " · stale" : ""}
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setOpenCardId(card.id)}>
                          <Settings2 className="h-3.5 w-3.5" /> Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {!loading && cards.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                No cards yet. Capture one from a vendor page with the CTRL+P extension, or paste a URL from the capture
                panel.
              </p>
            ) : null}
          </div>
        </>
      )}

      <BulkMarkupDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        cardIds={[...selected]}
        accessToken={token}
        onApplied={() => {
          setSelected(new Set());
          void load();
        }}
      />
    </div>
  );
}

// ─── Card editor ────────────────────────────────────────────────────────────

function CardEditor({
  card,
  tiers,
  accessToken,
  onBack,
  onSaved,
}: {
  card: CardWithChecklist;
  tiers: PricingTier[];
  accessToken: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"content" | "pricing" | "images" | "placements">("content");
  const [description, setDescription] = useState(card.description ?? "");
  const [seoTitle, setSeoTitle] = useState(card.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(card.seo_description ?? "");
  const [markup, setMarkup] = useState<MarkupControlValue>({
    markup_pct: card.markup_pct,
    markup_flat: card.markup_flat,
    rounding_rule: card.rounding_rule,
  });
  const [variants, setVariants] = useState<EditableVariant[]>(() =>
    card.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      quantity: Number(variant.quantity),
      spec: variant.spec ?? {},
      unit_cost: Number(variant.unit_cost),
      markup_pct: variant.markup_pct,
      markup_flat: variant.markup_flat,
      retail_override: variant.retail_override,
      retail_override_reason: variant.retail_override_reason,
      is_default: variant.is_default,
      is_available: variant.is_available,
      sort_order: variant.sort_order,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = { "content-type": "application/json", authorization: `Bearer ${accessToken}` };
  const tier = tiers.find((t) => t.id === card.tier?.id) ?? card.tier ?? null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          description,
          seo_title: seoTitle || null,
          seo_description: seoDescription || null,
          ...markup,
          variants,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save.");
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: CardStatus) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/${card.id}/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not change status.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" /> All cards
          </Button>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{card.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge className={cn("font-normal", STATUS_STYLES[card.status])}>{card.status}</Badge>
            {card.vendor ? <span>{card.vendor.name}</span> : null}
            {card.source_url ? (
              <a
                href={card.source_url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                <Link2 className="h-3 w-3" /> source
              </a>
            ) : null}
          </div>
        </div>

        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save changes
        </Button>
      </div>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <nav className="flex gap-1 rounded-lg border p-1">
        {(
          [
            ["content", "Content"],
            ["pricing", "Pricing"],
            ["images", "Images"],
            ["placements", "Placements"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {tab === "content" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium">Vendor's description</label>
                  <Textarea
                    readOnly
                    rows={8}
                    value={card.captured_description ?? "Nothing captured."}
                    className="resize-none bg-muted/40 text-muted-foreground"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Internal reference only — never published.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium">CTRL+P description</label>
                  <Textarea
                    rows={8}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Write this in our own words — republishing vendor copy is both a copyright issue and an SEO problem."
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium">SEO title</label>
                  <Input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder={card.title} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium">SEO description</label>
                  <Input
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                    placeholder="155 characters or so"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {tab === "pricing" ? (
            <div className="space-y-5">
              <MarkupControl cost={card.startingAtCost ?? 0} value={markup} onChange={setMarkup} tier={tier} />
              <VariantTable
                variants={variants}
                onChange={setVariants}
                cardRule={markup}
                tier={tier}
                priceUnit={card.price_unit}
              />
            </div>
          ) : null}

          {tab === "images" ? (
            <CardImages card={card} accessToken={accessToken} onChanged={onSaved} onError={setError} />
          ) : null}

          {tab === "placements" ? (
            <CardPlacementsTab cardId={card.id} card={toPublicCard(card, { imageUrl })} accessToken={accessToken} />
          ) : null}
        </div>

        <aside className="space-y-4">
          <PublishChecklist
            items={card.checklist ?? []}
            status={card.status}
            onPublish={() => setStatus("published")}
            onSetReady={() => setStatus("ready")}
            onUnpublish={() => setStatus("ready")}
            busy={busy}
          />

          <div className="rounded-lg border p-4 text-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal</h3>
            <dl className="space-y-1.5">
              <Row label="Vendor SKU" value={card.vendor_sku ?? "—"} />
              <Row label="Internal SKU" value={card.internal_sku ?? "—"} />
              <Row label="From cost" value={card.startingAtCost !== null ? money(card.startingAtCost) : "—"} />
              <Row
                label="Blended margin"
                value={card.blendedMarginPct !== null ? `${roundPct(card.blendedMarginPct)}%` : "—"}
              />
              <Row
                label="Cost captured"
                value={
                  card.cost_captured_at ? (
                    <span className={cn(card.costIsStale && "text-amber-600")}>
                      {new Date(card.cost_captured_at).toLocaleDateString()}
                      {card.costIsStale ? " · stale" : ""}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Images ─────────────────────────────────────────────────────────────────
//
// Provenance is editable here because it is the step that unblocks publishing.
// A card whose featured image is still `scraped_reference` cannot go live —
// that rule is enforced by a database trigger, not by this form, so the form's
// job is to make the fix obvious rather than to police it.

function CardImages({
  card,
  accessToken,
  onChanged,
  onError,
}: {
  card: CardWithChecklist;
  accessToken: string;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const headers = { "content-type": "application/json", authorization: `Bearer ${accessToken}` };

  const patch = async (imageId: string, body: Record<string, unknown>) => {
    setBusyId(imageId);
    onError(null);
    try {
      const response = await fetch(`/api/cards/${card.id}/images/${imageId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not update that image.");
      onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Could not update that image.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (imageId: string) => {
    setBusyId(imageId);
    try {
      const response = await fetch(`/api/cards/${card.id}/images/${imageId}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Could not remove that image.");
      }
      onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Could not remove that image.");
    } finally {
      setBusyId(null);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    onError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      // Anything staff upload by hand is their own asset unless they say
      // otherwise — the scraped default only applies to captured images.
      form.set("image_source", "own_photo");
      form.set("alt_text", card.title);

      const response = await fetch(`/api/cards/${card.id}/images`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not upload that image.");
      onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Could not upload that image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {card.images.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No images on this card yet. Upload a licensed asset or your own photo below.
        </p>
      ) : (
        card.images.map((image) => (
          <div key={image.id} className="flex gap-4 rounded-lg border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(image.storage_path)}
              alt={image.alt_text ?? ""}
              className="h-24 w-24 shrink-0 rounded object-cover"
            />

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {image.is_primary ? (
                  <Badge>Featured</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === image.id}
                    onClick={() => patch(image.id, { is_primary: true })}
                  >
                    Make featured
                  </Button>
                )}
                <span className="truncate text-xs text-muted-foreground">{image.storage_path}</span>
              </div>

              <ImageSourceSelect
                value={image.image_source}
                onChange={(next) => patch(image.id, { image_source: next, source_note: image.source_note })}
                note={image.source_note}
                onNoteChange={(note) => patch(image.id, { source_note: note })}
                isPrimary={image.is_primary}
                vendorName={card.vendor?.name}
                vendorPortalUrl={card.vendor?.dealer_portal_url}
                disabled={busyId === image.id}
              />

              <div className="flex gap-2">
                <Input
                  className="h-8 text-xs"
                  placeholder="Alt text"
                  defaultValue={image.alt_text ?? ""}
                  onBlur={(event) => {
                    if (event.target.value !== (image.alt_text ?? "")) {
                      void patch(image.id, { alt_text: event.target.value || null });
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={busyId === image.id}
                  onClick={() => remove(image.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))
      )}

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-accent">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {uploading ? "Uploading…" : "Upload a licensed asset or your own photo"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function AlertCard({
  icon,
  tone,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  tone: "amber" | "destructive";
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-destructive/30 bg-destructive/5",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs opacity-90">{body}</p>
        {action ? (
          <button type="button" onClick={action.onClick} className="mt-1.5 text-xs font-medium underline underline-offset-2">
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
