// Cutout geometry shared by the live overlay mask and the snapshot export.
// Cutouts are stage-fraction polygons; they punch holes but NEVER affect price.

import { SURFACE_H, SURFACE_W } from "@/lib/wall-studio/constants";
import { adj, projectPoint, type Mat3, type Point } from "@/lib/wall-studio/homography";
import type { Cutout } from "@/lib/wall-studio/types";

/** Inverse-project each stage-space cutout polygon into pattern-surface space. */
export function surfacePolysForCutouts(H: Mat3, toPxX: number, toPxY: number, cutouts: Cutout[]): Point[][] {
  const inv = adj(H);
  return cutouts.map((c) => c.pts.map((pt) => projectPoint(inv, pt.x * toPxX, pt.y * toPxY)));
}

/**
 * CSS `mask-image` url() for the pattern surface: the full surface rect minus
 * each cutout polygon via an even-odd alpha path (cross-browser). Returns null
 * when there are no cutouts.
 */
export function buildMaskUrl(H: Mat3, stageW: number, stageH: number, cutouts: Cutout[]): string | null {
  if (!cutouts.length) return null;
  const polys = surfacePolysForCutouts(H, stageW, stageH, cutouts);
  let d = `M0 0 H${SURFACE_W} V${SURFACE_H} H0 Z `;
  polys.forEach((p) => {
    d +=
      `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)} ` +
      p.slice(1).map((q) => `L${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ") +
      " Z ";
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SURFACE_W} ${SURFACE_H}"><path fill-rule="evenodd" d="${d}" fill="#fff"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export function polyCentroid(px: Point[]): Point {
  let x = 0;
  let y = 0;
  px.forEach((p) => {
    x += p.x;
    y += p.y;
  });
  return { x: x / px.length, y: y / px.length };
}
