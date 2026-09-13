// ─── Ambient harvest types for the content script ───────────────────────────
//
// content.ts is injected with chrome.scripting.executeScript({ files }), which
// loads a CLASSIC script. Any import — even a type-only one — makes TypeScript
// emit `export {}` to preserve module semantics, and a top-level `export` in a
// classic script is a SyntaxError that kills the injection.
//
// So the content script's types are declared globally here instead. This file
// has no imports or exports, which is what keeps it ambient.
//
// These must stay structurally identical to `RawHarvest` in lib/capture/types.
// messages.ts holds a compile-time assignment that fails to build the moment
// they diverge, so this cannot silently rot.

type CtrlpRawTable = {
  headers: string[];
  rows: string[][];
  caption?: string;
};

type CtrlpRawImage = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

type CtrlpRawHarvest = {
  url: string;
  pageTitle: string;
  jsonLd: unknown[];
  openGraph: Record<string, string>;
  microdata: Record<string, string>;
  tables: CtrlpRawTable[];
  definitions: Array<{ term: string; definition: string }>;
  images: CtrlpRawImage[];
  selects: Array<{ label: string; options: string[] }>;
  text: string;
  regionScreenshot?: string;
};

type CtrlpRect = { x: number; y: number; width: number; height: number };

/** The messages content.ts sends. Mirrors ContentToWorker in messages.ts. */
type CtrlpContentToWorker =
  | { type: "HARVEST_PAGE_RESULT"; harvest: CtrlpRawHarvest; devicePixelRatio: number }
  | { type: "ELEMENT_PICKED"; harvest: CtrlpRawHarvest; rect: CtrlpRect; devicePixelRatio: number }
  | { type: "REGION_PICKED"; rect: CtrlpRect; devicePixelRatio: number }
  | { type: "PICK_CANCELLED" };

/** The commands content.ts receives. Mirrors WorkerToContent in messages.ts. */
type CtrlpWorkerToContent =
  | { type: "HARVEST_PAGE" }
  | { type: "PICK_ELEMENT" }
  | { type: "PICK_REGION" }
  | { type: "CANCEL_PICK" };
