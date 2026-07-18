// ─── Visualizer geometry (pure) ──────────────────────────────────────────────
//
// Ported from the prototype's quadArea / estimatedSqft / estimatedDims. Area is
// computed in whatever coordinate space the corners are given (fractions or px);
// pricing uses the AREA RATIO vs a calibration area, so the space cancels out —
// which makes live pricing independent of the (variable) stage pixel size.

import type { Corner } from "@/lib/wall-studio/types";

/** Shoelace area of the quad. Corners are [TL, TR, BL, BR]; drawn order TL TR BR BL. */
export function quadArea(corners: Corner[]): number {
  const o = [corners[0], corners[1], corners[3], corners[2]];
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    a += o[i].x * o[j].y - o[j].x * o[i].y;
  }
  return Math.abs(a / 2);
}

/** Estimated real square footage: dims scaled by the quad-area ratio, rounded to 0.1. */
export function estimatedSqft(area: number, calibArea: number | null, dims: { w: number; h: number }): number {
  const calib = calibArea || area || 1;
  const ratio = area / calib;
  return Math.max(1, Math.round(dims.w * dims.h * ratio * 10) / 10);
}

/** Estimated real dimensions: W and H scaled by the sqrt of the area ratio. */
export function estimatedDims(area: number, calibArea: number | null, dims: { w: number; h: number }): { w: number; h: number } {
  const ratio = Math.sqrt(area / (calibArea || area || 1));
  return { w: Math.round(dims.w * ratio * 10) / 10, h: Math.round(dims.h * ratio * 10) / 10 };
}
