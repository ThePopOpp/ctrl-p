// ─── The message contract between panel, service worker and content script ──
//
// Kept in one file so the three contexts cannot disagree about a payload shape.

import type { RawHarvest } from "@/lib/capture/types";

export type Rect = { x: number; y: number; width: number; height: number };

export type PanelToWorker =
  | { type: "HARVEST_ACTIVE_TAB" }
  | { type: "START_ELEMENT_PICK" }
  | { type: "START_REGION_PICK" }
  | { type: "CANCEL_PICK" }
  | { type: "CAPTURE_VIEWPORT" };

export type WorkerToPanel =
  | { type: "HARVEST_RESULT"; harvest: RawHarvest }
  | { type: "SCREENSHOT_RESULT"; dataUrl: string; devicePixelRatio: number }
  | { type: "REGION_SELECTED"; rect: Rect; devicePixelRatio: number }
  | { type: "ELEMENT_SELECTED"; harvest: RawHarvest; rect: Rect; devicePixelRatio: number }
  | { type: "PICK_CANCELLED" }
  | { type: "CAPTURE_ERROR"; message: string };

export type WorkerToContent =
  | { type: "HARVEST_PAGE" }
  | { type: "PICK_ELEMENT" }
  | { type: "PICK_REGION" }
  | { type: "CANCEL_PICK" };

export type ContentToWorker =
  | { type: "HARVEST_PAGE_RESULT"; harvest: RawHarvest; devicePixelRatio: number }
  | { type: "ELEMENT_PICKED"; harvest: RawHarvest; rect: Rect; devicePixelRatio: number }
  | { type: "REGION_PICKED"; rect: Rect; devicePixelRatio: number }
  | { type: "PICK_CANCELLED" };

export type AnyMessage = PanelToWorker | WorkerToPanel | WorkerToContent | ContentToWorker;

export function isMessage<T extends { type: string }>(value: unknown, type: T["type"]): value is T {
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === type;
}

// ─── Conformance ────────────────────────────────────────────────────────────
//
// content.ts cannot import these types — it is injected as a classic script, and
// any import makes TypeScript emit `export {}`, which is a SyntaxError there. It
// uses the ambient mirrors in harvest.d.ts instead.
//
// These two assignments are the guard rail: if the ambient shapes drift from the
// shared ones, `npm run build:extension` fails here rather than the extension
// failing silently in a staff member's browser. They are types only and emit
// nothing.
type AssertAssignable<Expected, Actual extends Expected> = [Expected, Actual];

export type _HarvestConformance = AssertAssignable<RawHarvest, CtrlpRawHarvest>;
export type _MessageConformance = AssertAssignable<ContentToWorker, CtrlpContentToWorker>;
