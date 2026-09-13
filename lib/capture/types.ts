// ─── Capture — the contract between page harvesting and draft assembly ──────
//
// Harvesting is environment-specific: the extension's content script walks a
// live DOM, the server fallback parses fetched HTML. Both produce a RawHarvest.
// Everything after that is shared, pure, and testable.

import type { ExtractionSource } from "@/lib/products/types";

export type RawTable = {
  /** Normalised header cells, lowercased. Empty when the table has no header row. */
  headers: string[];
  rows: string[][];
  /** Text immediately preceding the table — often names what it prices. */
  caption?: string;
};

export type RawImage = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type RawHarvest = {
  url: string;
  /** document.title, or the <title> tag. */
  pageTitle: string;
  /** Parsed application/ld+json blocks, verbatim. */
  jsonLd: unknown[];
  /** og:* and twitter:* meta tags, keyed without the prefix. */
  openGraph: Record<string, string>;
  /** itemprop values from schema.org microdata. */
  microdata: Record<string, string>;
  tables: RawTable[];
  /** <dl> pairs and "Label: value" list items. */
  definitions: Array<{ term: string; definition: string }>;
  images: RawImage[];
  /** <select> option sets — usually the product's configuration axes. */
  selects: Array<{ label: string; options: string[] }>;
  /** Full page text. Tier 4: makes the capture searchable later. */
  text: string;
  /** Set when the user drag-selected a region instead of taking the viewport. */
  regionScreenshot?: string;
};

/** Every extracted value travels with where it came from. */
export type Field<T> = {
  value: T;
  source: ExtractionSource;
  /** 0–1 for vision-extracted fields; absent for structured and DOM tiers. */
  confidence?: number;
};

export type DraftVariant = {
  label: string;
  quantity: number;
  unit_cost: number;
  spec: Record<string, string>;
  source: ExtractionSource;
};

export type DraftImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** Always starts as scraped_reference. Staff reclassify before publishing. */
  image_source: "scraped_reference";
};

export type CaptureDraft = {
  sourceUrl: string;
  title: Field<string>;
  subtitle: Field<string | null>;
  /** The vendor's own copy. Reference only — never published verbatim. */
  capturedDescription: Field<string | null>;
  brand: Field<string | null>;
  vendorSku: Field<string | null>;
  specTable: Field<Record<string, string>>;
  currency: string;
  variants: DraftVariant[];
  images: DraftImage[];
  leadTimeDays: Field<number | null>;
  /** Field name → tier that supplied it. Drives the badges in the review form. */
  extractionSources: Record<string, ExtractionSource>;
  /** What the pipeline could not find. Shown to staff as "needs your input". */
  unresolved: string[];
};

/** The strict shape a vision model must return. Nothing else is accepted. */
export type VisionExtraction = {
  title: string | null;
  subtitle: string | null;
  description: string | null;
  sku: string | null;
  specs: Record<string, string> | null;
  priceRows: Array<{ quantity: number; price: number; spec?: Record<string, string> }> | null;
  leadTimeDays: number | null;
  confidence: Record<string, number>;
};
