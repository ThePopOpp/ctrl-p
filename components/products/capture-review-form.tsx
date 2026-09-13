"use client";

// ─── CaptureReviewForm ──────────────────────────────────────────────────────
//
// Draft review with field source badges and variant import (spec §13). Shared
// by the dashboard and the extension side panel — this is the form that turns a
// capture into a Draft card.
//
// Two rules the layout enforces rather than merely mentions:
//   · Every field is correctable. Extraction output is a draft, never final.
//   · The vendor's own copy sits in a read-only reference field. The
//     customer-facing description is a separate box you have to write yourself.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldSourceBadge } from "@/components/products/field-source-badge";
import { MarkupControl, type MarkupControlValue } from "@/components/products/markup-control";
import { VariantTable, type EditableVariant } from "@/components/products/variant-table";
import type { CaptureDraft } from "@/lib/capture/types";
import { PRICE_UNIT_LABELS, type PriceUnit, type PricingTier } from "@/lib/pricing/types";
import { slugify } from "@/lib/products/shape";
import type { CategoryRow, ExtractionSource } from "@/lib/products/types";

export type CaptureReviewValue = {
  title: string;
  subtitle: string;
  slug: string;
  description: string;
  captured_description: string;
  category_id: string | null;
  vendor_sku: string;
  price_unit: PriceUnit;
  lead_time_days: number | null;
  spec_table: Record<string, string>;
  markup: MarkupControlValue;
  variants: EditableVariant[];
};

type Props = {
  draft: CaptureDraft;
  captureId?: string | null;
  categories: CategoryRow[];
  tiers: PricingTier[];
  onSave: (value: CaptureReviewValue) => Promise<void> | void;
  saving?: boolean;
  /** Rendered under the description field — hook for AI-assisted rewriting. */
  descriptionAssist?: React.ReactNode;
};

export function CaptureReviewForm({
  draft,
  categories,
  tiers,
  onSave,
  saving = false,
  descriptionAssist,
}: Props) {
  const [value, setValue] = useState<CaptureReviewValue>(() => fromDraft(draft));

  useEffect(() => {
    setValue(fromDraft(draft));
  }, [draft]);

  const tier = useMemo(() => {
    const category = categories.find((c) => c.id === value.category_id);
    return (
      (category?.tier_id ? tiers.find((t) => t.id === category.tier_id) : null) ??
      tiers.find((t) => t.is_default) ??
      null
    );
  }, [value.category_id, categories, tiers]);

  const set = <K extends keyof CaptureReviewValue>(key: K, next: CaptureReviewValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  const sourceOf = (field: string): ExtractionSource => draft.extractionSources[field] ?? "manual";
  const visionPriced = value.variants.some((variant) => variant.source === "vision");

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Captured from</p>
          <a
            href={draft.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full items-center gap-1 truncate text-sm underline underline-offset-2"
          >
            {draft.sourceUrl}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>

        {draft.unresolved.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Needs your input:</span>
            {draft.unresolved.map((field) => (
              <Badge key={field} variant="destructive" className="font-normal">
                {field}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {visionPriced && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          At least one cost was read from a screenshot rather than the page's own data. Check it against the vendor's
          price table before saving — an inferred cost that is wrong quietly eats the margin on every unit.
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" source={sourceOf("title")} className="sm:col-span-2">
          <Input
            value={value.title}
            onChange={(event) => {
              const title = event.target.value;
              setValue((current) => ({
                ...current,
                title,
                slug: current.slug === slugify(current.title) || !current.slug ? slugify(title) : current.slug,
              }));
            }}
            required
          />
        </Field>

        <Field label="Subtitle" source={sourceOf("subtitle")} hint="Size, stock, or key spec">
          <Input value={value.subtitle} onChange={(event) => set("subtitle", event.target.value)} />
        </Field>

        <Field label="Slug" source="manual" hint={value.slug ? `/shop/${value.slug}` : undefined}>
          <Input value={value.slug} onChange={(event) => set("slug", slugify(event.target.value))} />
        </Field>

        <Field label="Category" source="manual" hint="Drives the pricing tier">
          <Select
            value={value.category_id ?? ""}
            onValueChange={(next) => set("category_id", next || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Vendor SKU" source={sourceOf("vendor_sku")}>
          <Input value={value.vendor_sku} onChange={(event) => set("vendor_sku", event.target.value)} />
        </Field>

        <Field label="Price unit" source="manual" hint="What the stored number means">
          <Select value={value.price_unit} onValueChange={(next) => set("price_unit", next as PriceUnit)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRICE_UNIT_LABELS) as PriceUnit[]).map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {PRICE_UNIT_LABELS[unit]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Lead time (days)" source={sourceOf("lead_time_days")}>
          <Input
            type="number"
            min="0"
            value={value.lead_time_days ?? ""}
            onChange={(event) => set("lead_time_days", event.target.value === "" ? null : Number(event.target.value))}
          />
        </Field>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Field label="Vendor's description" source={sourceOf("captured_description")} hint="Reference only — never published">
          <Textarea
            value={value.captured_description}
            readOnly
            rows={6}
            className="resize-none bg-muted/40 text-muted-foreground"
          />
        </Field>

        <Field label="CTRL+P description" source="manual" hint="Required before publishing">
          <Textarea
            value={value.description}
            onChange={(event) => set("description", event.target.value)}
            rows={6}
            placeholder="Write this in our own words. Pasting the vendor's copy is both a copyright issue and an SEO problem — you would be competing against their page using their words."
          />
          {descriptionAssist}
        </Field>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Specifications</h3>
          <FieldSourceBadge source={sourceOf("spec_table")} />
        </div>
        <SpecEditor value={value.spec_table} onChange={(next) => set("spec_table", next)} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Pricing</h3>
          {tier ? <Badge variant="outline">Tier {tier.code} — {tier.name}</Badge> : <Badge variant="destructive">No tier</Badge>}
        </div>

        <MarkupControl
          cost={value.variants[0]?.unit_cost ?? 0}
          value={value.markup}
          onChange={(next) => set("markup", next)}
          tier={tier}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Variants</h3>
          <FieldSourceBadge source={sourceOf("variants")} />
          <span className="text-xs text-muted-foreground">
            {value.variants.length} row{value.variants.length === 1 ? "" : "s"} imported
          </span>
        </div>

        <VariantTable
          variants={value.variants}
          onChange={(next) => set("variants", next)}
          cardRule={{
            markup_pct: value.markup.markup_pct,
            markup_flat: value.markup.markup_flat,
            rounding_rule: value.markup.rounding_rule,
          }}
          tier={tier}
          priceUnit={value.price_unit}
        />
      </section>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          Saves as a <strong>Draft</strong>. Publishing is a separate pass — what a vendor page says is not what should
          go on your storefront.
        </p>
        <Button type="submit" disabled={saving || !value.title.trim()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save draft
        </Button>
      </div>
    </form>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Field({
  label,
  source,
  hint,
  className,
  children,
}: {
  label: string;
  source: ExtractionSource;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-2">
        <label className="text-xs font-medium">{label}</label>
        <FieldSourceBadge source={source} />
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function SpecEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const entries = Object.entries(value);

  const updateKey = (index: number, key: string) => {
    const next = entries.map(([k, v], i) => (i === index ? [key, v] : [k, v])) as Array<[string, string]>;
    onChange(Object.fromEntries(next));
  };
  const updateValue = (index: number, val: string) => {
    const next = entries.map(([k, v], i) => (i === index ? [k, val] : [k, v])) as Array<[string, string]>;
    onChange(Object.fromEntries(next));
  };

  return (
    <div className="space-y-2">
      {entries.map(([key, val], index) => (
        <div key={index} className="flex gap-2">
          <Input className="h-8 w-48" value={key} onChange={(event) => updateKey(index, event.target.value)} />
          <Input className="h-8 flex-1" value={val} onChange={(event) => updateValue(index, event.target.value)} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(Object.fromEntries(entries.filter((_, i) => i !== index)))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...value, [`Spec ${entries.length + 1}`]: "" })}
      >
        Add specification
      </Button>
    </div>
  );
}

function fromDraft(draft: CaptureDraft): CaptureReviewValue {
  return {
    title: draft.title.value ?? "",
    subtitle: draft.subtitle.value ?? "",
    slug: slugify(draft.title.value ?? ""),
    description: "",
    captured_description: draft.capturedDescription.value ?? "",
    category_id: null,
    vendor_sku: draft.vendorSku.value ?? "",
    price_unit: "each",
    lead_time_days: draft.leadTimeDays.value,
    spec_table: { ...draft.specTable.value },
    markup: { markup_pct: null, markup_flat: null, rounding_rule: null },
    variants: draft.variants.map((variant, index) => ({
      label: variant.label,
      quantity: variant.quantity,
      spec: variant.spec,
      unit_cost: variant.unit_cost,
      markup_pct: null,
      markup_flat: null,
      retail_override: null,
      retail_override_reason: null,
      is_default: index === 0,
      is_available: true,
      sort_order: index,
      source: variant.source,
    })),
  };
}
