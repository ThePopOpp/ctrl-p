import type { WsProduct } from "@/lib/wall-studio/types";

/** Inline SVG string → a data: URI usable as an <img> src or CSS url(). */
export function tileDataUri(svg: string): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/** CSS `background-image` value for a design's pattern tile (Storage url or inline SVG). */
export function tileBackgroundImage(p: Pick<WsProduct, "tile_url" | "tile_svg">): string {
  if (p.tile_url) return `url("${p.tile_url}")`;
  if (p.tile_svg) return `url("${tileDataUri(p.tile_svg)}")`;
  return "none";
}
