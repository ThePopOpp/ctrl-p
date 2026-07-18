// ─── Snapshot export (textured-triangle canvas composite) ────────────────────
//
// Ported VERBATIM from the prototype's snapshot pipeline: backdrop frame +
// pattern surface projected through the homography as a 20×20 textured-triangle
// mesh, blend + opacity applied, cutout holes punched. Client-only (uses canvas).

import { SURFACE_H, SURFACE_W } from "@/lib/wall-studio/constants";
import { surfacePolysForCutouts } from "@/lib/wall-studio/cutouts";
import { projection, projectPoint } from "@/lib/wall-studio/homography";
import { tileDataUri } from "@/lib/wall-studio/tiles";
import type { Corner, Cutout, WsProduct } from "@/lib/wall-studio/types";

export function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  u0: number, v0: number,
  u1: number, v1: number,
  u2: number, v2: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();
  const den = u0 * (v2 - v1) - u1 * v2 + u2 * v1 + (u1 - u2) * v0;
  if (!den) {
    ctx.restore();
    return;
  }
  const m11 = -(v0 * (x2 - x1) - v1 * x2 + v2 * x1 + (v1 - v2) * x0) / den;
  const m12 = (v1 * y2 + v0 * (y1 - y2) - v2 * y1 + (v2 - v1) * y0) / den;
  const m21 = (u0 * (x2 - x1) - u1 * x2 + u2 * x1 + (u1 - u2) * x0) / den;
  const m22 = -(u1 * y2 + u0 * (y1 - y2) - u2 * y1 + (u2 - u1) * y0) / den;
  const dx = (u0 * (v2 * x1 - v1 * x2) + v0 * (u1 * x2 - u2 * x1) + (u2 * v1 - u1 * v2) * x0) / den;
  const dy = (u0 * (v2 * y1 - v1 * y2) + v0 * (u1 * y2 - u2 * y1) + (u2 * v1 - u1 * v2) * y0) / den;
  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

export type SnapshotOptions = {
  backdrop: HTMLImageElement | HTMLVideoElement;
  product: WsProduct;
  corners: Corner[];
  scale: number;
  opacity: number;
  cutouts: Cutout[];
};

/** Compose the on-screen preview into a PNG blob. */
export async function composeSnapshot(opts: SnapshotOptions): Promise<Blob | null> {
  const { backdrop, product, corners, scale, opacity, cutouts } = opts;

  // 1. base frame
  const isVideo = backdrop instanceof HTMLVideoElement;
  const baseW = isVideo ? backdrop.videoWidth || 1200 : (backdrop as HTMLImageElement).naturalWidth || 1200;
  const baseH = isVideo ? backdrop.videoHeight || 900 : (backdrop as HTMLImageElement).naturalHeight || 900;
  const cv = document.createElement("canvas");
  cv.width = baseW;
  cv.height = baseH;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(backdrop, 0, 0, baseW, baseH);

  // 2. pattern surface canvas
  const tileImg = await loadImage(tileDataUri(product.tile_svg ?? ""));
  const pc = document.createElement("canvas");
  pc.width = SURFACE_W;
  pc.height = SURFACE_H;
  const pctx = pc.getContext("2d");
  if (!pctx) return null;
  if (product.repeat_pattern) {
    const s = scale;
    const scaled = document.createElement("canvas");
    scaled.width = s;
    scaled.height = s * (tileImg.height / tileImg.width);
    scaled.getContext("2d")?.drawImage(tileImg, 0, 0, scaled.width, scaled.height);
    const pattern = pctx.createPattern(scaled, "repeat");
    if (pattern) {
      pctx.fillStyle = pattern;
      pctx.fillRect(0, 0, SURFACE_W, SURFACE_H);
    }
  } else {
    pctx.drawImage(tileImg, 0, 0, SURFACE_W, SURFACE_H);
  }

  // 3. project onto the base via the homography (stage fractions -> base px)
  const pts = corners.map((c) => ({ x: c.x * baseW, y: c.y * baseH }));
  const H = projection(SURFACE_W, SURFACE_H, pts);

  // punch cutout holes in the pattern (surface space) so they render clear
  if (cutouts.length) {
    const polys = surfacePolysForCutouts(H, baseW, baseH, cutouts);
    pctx.globalCompositeOperation = "destination-out";
    pctx.fillStyle = "#000";
    polys.forEach((poly) => {
      pctx.beginPath();
      pctx.moveTo(poly[0].x, poly[0].y);
      for (let k = 1; k < poly.length; k++) pctx.lineTo(poly[k].x, poly[k].y);
      pctx.closePath();
      pctx.fill();
    });
    pctx.globalCompositeOperation = "source-over";
  }

  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = product.blend_mode === "multiply" ? "multiply" : "source-over";
  const N = 20;
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const u0 = (gx / N) * SURFACE_W;
      const v0 = (gy / N) * SURFACE_H;
      const u1 = ((gx + 1) / N) * SURFACE_W;
      const v1 = ((gy + 1) / N) * SURFACE_H;
      const A = projectPoint(H, u0, v0);
      const B = projectPoint(H, u1, v0);
      const C = projectPoint(H, u0, v1);
      const D = projectPoint(H, u1, v1);
      drawTexturedTriangle(ctx, pc, A.x, A.y, B.x, B.y, C.x, C.y, u0, v0, u1, v0, u0, v1);
      drawTexturedTriangle(ctx, pc, D.x, D.y, B.x, B.y, C.x, C.y, u1, v1, u1, v0, u0, v1);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), "image/png"));
}
