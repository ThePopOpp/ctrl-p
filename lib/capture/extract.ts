// ─── Capture — extraction pipeline ──────────────────────────────────────────
//
// Four tiers, highest confidence first, recording which tier supplied each
// field (spec §5):
//
//   Tier 1  Structured markup — JSON-LD schema.org/Product, Open Graph,
//           microdata. Near-perfect data with no inference.
//   Tier 2  Targeted DOM parsing — price tables, spec lists, images, selects.
//           The price table is the high-value target: eight quantity breaks in
//           one click instead of eight captures.
//   Tier 3  Vision — merged in separately by the caller, for whatever 1 and 2
//           missed. Never lets a price be invented.
//   Tier 4  Text layer — stored whole, for search. Not used for field mapping.
//
// Pure functions. No DOM, no network — the harvest arrives already collected.

import type {
  CaptureDraft,
  DraftImage,
  DraftVariant,
  Field,
  RawHarvest,
  RawTable,
  VisionExtraction,
} from "@/lib/capture/types";
import type { ExtractionSource } from "@/lib/products/types";

// ─── Tier 1: structured markup ──────────────────────────────────────────────

type ProductNode = Record<string, unknown>;

/** Walk JSON-LD, including @graph containers, for the first Product node. */
export function findProductNode(blocks: unknown[]): ProductNode | null {
  const queue: unknown[] = [...blocks];
  const seen = new Set<unknown>();

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }

    const record = node as ProductNode;
    const type = record["@type"];
    const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];
    if (types.some((t) => t.toLowerCase() === "product")) return record;

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return asString(value[0]);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asString(record.name ?? record["@value"] ?? record.value);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  const text = asString(value);
  if (text === null) return null;
  const cleaned = text.replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** All offers on a Product node, flattened out of AggregateOffer wrappers. */
function offersOf(node: ProductNode): Array<Record<string, unknown>> {
  const raw = node.offers;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const flat: Array<Record<string, unknown>> = [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const offer = entry as Record<string, unknown>;
    const nested = offer.offers;
    if (Array.isArray(nested)) flat.push(...(nested as Array<Record<string, unknown>>));
    else flat.push(offer);
  }
  return flat;
}

// ─── Tier 2: price tables ───────────────────────────────────────────────────

const QUANTITY_HEADERS = ["qty", "quantity", "quantities", "pieces", "pcs", "count", "units", "sheets"];
const PRICE_HEADERS = ["price", "cost", "your price", "dealer price", "net", "each", "total", "amount", "unit price"];

export function parseMoney(text: string): number | null {
  if (!text) return null;
  // Take the first money-looking run so "$18.00 ea" and "18.00 USD" both work.
  const match = text.replace(/,/g, "").match(/-?\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function parseQuantity(text: string): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function headerIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => {
    const h = header.toLowerCase().trim();
    return candidates.some((candidate) => h === candidate || h.includes(candidate));
  });
}

/**
 * Pull quantity/price pairs out of a table. Handles the two shapes that cover
 * nearly every trade printer:
 *
 *   Column-oriented   | Qty | 14pt Matte | 16pt Gloss |   → one variant per cell
 *   Row-oriented      | Qty | Price |                     → one variant per row
 *
 * Returns [] rather than guessing when the table is not a price table — a
 * wrong cost is worse than no cost.
 */
export function parsePriceTable(table: RawTable): DraftVariant[] {
  const headers = table.headers.map((h) => h.toLowerCase().trim());
  if (!headers.length || table.rows.length === 0) return [];

  const qtyColumn = headerIndex(headers, QUANTITY_HEADERS);
  if (qtyColumn === -1) return [];

  const priceColumn = headerIndex(headers, PRICE_HEADERS);
  const variants: DraftVariant[] = [];

  for (const row of table.rows) {
    const quantity = parseQuantity(row[qtyColumn] ?? "");
    if (quantity === null) continue;

    if (priceColumn !== -1) {
      // Row-oriented: one price column.
      const unitCost = parseMoney(row[priceColumn] ?? "");
      if (unitCost === null) continue;
      const spec: Record<string, string> = {};
      row.forEach((cell, index) => {
        if (index === qtyColumn || index === priceColumn || !cell?.trim()) return;
        const key = table.headers[index]?.trim();
        if (key) spec[key] = cell.trim();
      });
      variants.push({
        label: buildLabel(quantity, spec, table.caption),
        quantity,
        unit_cost: unitCost,
        spec,
        source: "dom",
      });
      continue;
    }

    // Column-oriented: every other column is a spec option priced per quantity.
    row.forEach((cell, index) => {
      if (index === qtyColumn) return;
      const unitCost = parseMoney(cell ?? "");
      if (unitCost === null) return;
      const optionLabel = table.headers[index]?.trim();
      if (!optionLabel) return;
      const spec = { Option: optionLabel };
      variants.push({
        label: buildLabel(quantity, spec, table.caption),
        quantity,
        unit_cost: unitCost,
        spec,
        source: "dom",
      });
    });
  }

  return variants;
}

function buildLabel(quantity: number, spec: Record<string, string>, caption?: string): string {
  const parts = [formatQuantity(quantity), ...Object.values(spec).filter(Boolean)];
  const label = parts.join(" / ");
  return caption ? `${caption.trim()} — ${label}` : label;
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? quantity.toLocaleString("en-US") : String(quantity);
}

/** The best price table on the page — the one yielding the most variants. */
export function pickPriceTable(tables: RawTable[]): { table: RawTable; variants: DraftVariant[] } | null {
  let best: { table: RawTable; variants: DraftVariant[] } | null = null;
  for (const table of tables) {
    const variants = parsePriceTable(table);
    if (variants.length > (best?.variants.length ?? 0)) best = { table, variants };
  }
  return best;
}

// ─── Tier 2: specs, images ──────────────────────────────────────────────────

const SPEC_KEY_HINTS = [
  "material",
  "stock",
  "paper",
  "size",
  "dimension",
  "finish",
  "coating",
  "sides",
  "turnaround",
  "lead time",
  "weight",
  "thickness",
  "colour",
  "color",
  "print",
  "shape",
  "corner",
];

export function collectSpecs(harvest: RawHarvest): Record<string, string> {
  const specs: Record<string, string> = {};

  for (const { term, definition } of harvest.definitions) {
    const key = term.replace(/[:\s]+$/, "").trim();
    const value = definition.trim();
    if (!key || !value || key.length > 40 || value.length > 200) continue;
    specs[key] = value;
  }

  // A <select> on a product page is a configuration axis; its options are the
  // spec's possible values, which is worth keeping even before variants exist.
  for (const select of harvest.selects) {
    const key = select.label.trim();
    if (!key || specs[key] || select.options.length === 0) continue;
    if (!SPEC_KEY_HINTS.some((hint) => key.toLowerCase().includes(hint))) continue;
    specs[key] = select.options.slice(0, 8).join(", ");
  }

  return specs;
}

const IMAGE_JUNK = /(sprite|icon|logo|badge|pixel|placeholder|thumb(nail)?|1x1|blank)/i;

/** Product images at their highest available resolution, junk filtered out. */
export function pickImages(harvest: RawHarvest, limit = 8): DraftImage[] {
  const seen = new Set<string>();
  const candidates = harvest.images
    .filter((image) => {
      if (!image.src || seen.has(image.src)) return false;
      if (IMAGE_JUNK.test(image.src)) return false;
      if (image.src.startsWith("data:")) return false;
      // Anything under 200px on a side is chrome, not the product.
      if (image.width !== undefined && image.width > 0 && image.width < 200) return false;
      if (image.height !== undefined && image.height > 0 && image.height < 200) return false;
      seen.add(image.src);
      return true;
    })
    .sort((a, b) => area(b) - area(a));

  const ogImage = harvest.openGraph.image;
  if (ogImage && !seen.has(ogImage)) candidates.unshift({ src: ogImage, alt: harvest.openGraph.title });

  return candidates.slice(0, limit).map((image) => ({
    url: image.src,
    alt: image.alt?.trim() || "",
    width: image.width,
    height: image.height,
    image_source: "scraped_reference" as const,
  }));
}

function area(image: { width?: number; height?: number }): number {
  return (image.width ?? 0) * (image.height ?? 0);
}

// ─── Assembly ───────────────────────────────────────────────────────────────

function field<T>(value: T, source: ExtractionSource, confidence?: number): Field<T> {
  return confidence === undefined ? { value, source } : { value, source, confidence };
}

/**
 * Run tiers 1 and 2 over a harvest and assemble the draft card. Tier 3 is
 * merged afterwards by `mergeVisionExtraction`, which only fills gaps.
 */
export function buildDraft(harvest: RawHarvest): CaptureDraft {
  const product = findProductNode(harvest.jsonLd);
  const og = harvest.openGraph;
  const micro = harvest.microdata;
  const sources: Record<string, ExtractionSource> = {};

  const title = firstOf<string>([
    [asString(product?.name), "structured"],
    [micro.name ?? null, "structured"],
    [og.title ?? null, "structured"],
    [cleanPageTitle(harvest.pageTitle), "dom"],
  ]);
  sources.title = title.source;

  const capturedDescription = firstOf<string | null>([
    [asString(product?.description), "structured"],
    [micro.description ?? null, "structured"],
    [og.description ?? null, "structured"],
  ]);
  sources.captured_description = capturedDescription.source;

  const brand = firstOf<string | null>([
    [asString(product?.brand), "structured"],
    [micro.brand ?? null, "structured"],
    [og.site_name ?? null, "structured"],
  ]);
  sources.brand = brand.source;

  const vendorSku = firstOf<string | null>([
    [asString(product?.sku), "structured"],
    [asString(product?.mpn), "structured"],
    [micro.sku ?? null, "structured"],
  ]);
  sources.vendor_sku = vendorSku.source;

  // Variants: the price table beats structured offers, because a table gives
  // the whole quantity ladder while offers usually give one price.
  const tableResult = pickPriceTable(harvest.tables);
  let variants: DraftVariant[] = tableResult?.variants ?? [];
  let variantSource: ExtractionSource = "dom";

  if (!variants.length && product) {
    variants = offersFromStructured(product);
    variantSource = "structured";
  }
  if (variants.length) sources.variants = variantSource;

  const specs = collectSpecs(harvest);
  if (Object.keys(specs).length) sources.spec_table = "dom";

  const images = pickImages(harvest);
  if (images.length) sources.images = og.image && images[0]?.url === og.image ? "structured" : "dom";

  const currency = asString(offersOf(product ?? {})[0]?.priceCurrency) ?? "USD";
  const leadTimeDays = leadTimeFromSpecs(specs);
  if (leadTimeDays !== null) sources.lead_time_days = "dom";

  const unresolved: string[] = [];
  if (!variants.length) unresolved.push("cost");
  if (!images.length) unresolved.push("images");
  if (!Object.keys(specs).length) unresolved.push("specs");
  if (!title.value) unresolved.push("title");

  return {
    sourceUrl: harvest.url,
    title: field(title.value ?? "", title.source),
    subtitle: field(subtitleFromSpecs(specs), "dom"),
    capturedDescription: field(capturedDescription.value ?? null, capturedDescription.source),
    brand: field(brand.value ?? null, brand.source),
    vendorSku: field(vendorSku.value ?? null, vendorSku.source),
    specTable: field(specs, Object.keys(specs).length ? "dom" : "manual"),
    currency,
    variants,
    images,
    leadTimeDays: field(leadTimeDays, leadTimeDays === null ? "manual" : "dom"),
    extractionSources: sources,
    unresolved,
  };
}

/** Take the first non-empty candidate and remember which tier it came from. */
function firstOf<T>(candidates: Array<[T | null, ExtractionSource]>): { value: T | null; source: ExtractionSource } {
  for (const [value, source] of candidates) {
    if (value !== null && value !== undefined && String(value).trim() !== "") return { value, source };
  }
  return { value: null, source: "manual" };
}

function offersFromStructured(product: ProductNode): DraftVariant[] {
  return offersOf(product)
    .map((offer): DraftVariant | null => {
      const price = asNumber(offer.price ?? offer.lowPrice);
      if (price === null) return null;
      const quantity = asNumber(offer.eligibleQuantity) ?? 1;
      const name = asString(offer.name) ?? asString(offer.sku) ?? "";
      return {
        label: name || `Qty ${formatQuantity(quantity)}`,
        quantity,
        unit_cost: price,
        spec: name ? { Option: name } : {},
        source: "structured" as const,
      };
    })
    .filter((v): v is DraftVariant => v !== null);
}

function cleanPageTitle(pageTitle: string): string | null {
  if (!pageTitle) return null;
  // Strip the "… | Vendor Name" suffix most product pages carry.
  return pageTitle.split(/\s+[|—–]\s+/)[0]?.trim() || pageTitle.trim();
}

function subtitleFromSpecs(specs: Record<string, string>): string | null {
  for (const key of ["Size", "Stock", "Material", "Paper", "Dimensions"]) {
    const match = Object.entries(specs).find(([k]) => k.toLowerCase() === key.toLowerCase());
    if (match) return `${match[0]}: ${match[1]}`.slice(0, 120);
  }
  return null;
}

function leadTimeFromSpecs(specs: Record<string, string>): number | null {
  for (const [key, value] of Object.entries(specs)) {
    if (!/turnaround|lead time|production/i.test(key)) continue;
    const match = value.match(/(\d+)/);
    if (match) return Number.parseInt(match[1], 10);
  }
  return null;
}

// ─── Tier 3: vision merge ───────────────────────────────────────────────────

/**
 * Fill gaps with vision output. Two rules, both load-bearing:
 *
 *  1. Vision never overwrites a structured or DOM value. Those tiers read the
 *     page's own data; vision reads a picture of it.
 *  2. Vision-supplied prices are marked `vision` so the review form can render
 *     them distinctly. Acting on an inferred cost without checking it is how
 *     margin quietly disappears.
 */
export function mergeVisionExtraction(draft: CaptureDraft, vision: VisionExtraction): CaptureDraft {
  const merged: CaptureDraft = { ...draft, extractionSources: { ...draft.extractionSources } };
  const confidence = vision.confidence ?? {};

  if (!merged.title.value && vision.title) {
    merged.title = field(vision.title, "vision", confidence.title);
    merged.extractionSources.title = "vision";
  }
  if (!merged.subtitle.value && vision.subtitle) {
    merged.subtitle = field(vision.subtitle, "vision", confidence.subtitle);
    merged.extractionSources.subtitle = "vision";
  }
  if (!merged.capturedDescription.value && vision.description) {
    merged.capturedDescription = field(vision.description, "vision", confidence.description);
    merged.extractionSources.captured_description = "vision";
  }
  if (!merged.vendorSku.value && vision.sku) {
    merged.vendorSku = field(vision.sku, "vision", confidence.sku);
    merged.extractionSources.vendor_sku = "vision";
  }
  if (vision.specs) {
    // Existing keys win; vision only adds rows the DOM pass did not find.
    const specs = { ...vision.specs, ...merged.specTable.value };
    merged.specTable = field(specs, merged.specTable.source === "manual" ? "vision" : merged.specTable.source);
    merged.extractionSources.spec_table = merged.extractionSources.spec_table ?? "vision";
  }
  if (merged.leadTimeDays.value === null && vision.leadTimeDays !== null) {
    merged.leadTimeDays = field(vision.leadTimeDays, "vision", confidence.leadTimeDays);
    merged.extractionSources.lead_time_days = "vision";
  }

  if (!merged.variants.length && vision.priceRows?.length) {
    merged.variants = vision.priceRows
      .filter((row) => Number.isFinite(row.price) && row.price > 0 && Number.isFinite(row.quantity))
      .map((row) => ({
        label: buildLabel(row.quantity, row.spec ?? {}),
        quantity: row.quantity,
        unit_cost: row.price,
        spec: row.spec ?? {},
        source: "vision" as const,
      }));
    if (merged.variants.length) merged.extractionSources.variants = "vision";
  }

  merged.unresolved = draft.unresolved.filter((key) => {
    if (key === "cost") return merged.variants.length === 0;
    if (key === "title") return !merged.title.value;
    if (key === "specs") return Object.keys(merged.specTable.value).length === 0;
    return true;
  });

  return merged;
}

/** The instruction a vision model gets. Kept here so it versions with the schema. */
export const VISION_SYSTEM_PROMPT = `You extract product data from a screenshot of a wholesale printing vendor's product page.

Return ONLY JSON matching the schema you are given.

Rules:
- Return null for any field you cannot actually SEE in the image. Do not infer, do not guess, do not use general knowledge about the product category.
- NEVER invent a price. If a price is not legible in the image, priceRows must be null.
- Prices on these pages are wholesale/dealer costs, not retail. Report the number as shown.
- For quantity/price tables, return one entry per row you can read, with the quantity and its price.
- confidence is a 0-1 number per field name reflecting how clearly you could read it.`;

/** JSON schema handed to the vision model alongside the prompt. */
export const VISION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "description", "sku", "specs", "priceRows", "leadTimeDays", "confidence"],
  properties: {
    title: { type: ["string", "null"] },
    subtitle: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    sku: { type: ["string", "null"] },
    specs: { type: ["object", "null"], additionalProperties: { type: "string" } },
    priceRows: {
      type: ["array", "null"],
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quantity", "price"],
        properties: {
          quantity: { type: "number" },
          price: { type: "number" },
          spec: { type: "object", additionalProperties: { type: "string" } },
        },
      },
    },
    leadTimeDays: { type: ["number", "null"] },
    confidence: { type: "object", additionalProperties: { type: "number" } },
  },
} as const;
