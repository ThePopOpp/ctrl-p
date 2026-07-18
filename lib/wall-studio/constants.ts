import type { Corner } from "@/lib/wall-studio/types";

/** Pattern-surface working space (the prototype's #patternSurface is 1200×900). */
export const SURFACE_W = 1200;
export const SURFACE_H = 900;

/** Default quad corners as stage fractions: TL, TR, BL, BR. */
export const DEFAULT_CORNERS: Corner[] = [
  { x: 0.18, y: 0.22 },
  { x: 0.62, y: 0.2 },
  { x: 0.18, y: 0.8 },
  { x: 0.62, y: 0.82 },
];

/** Demo room backdrop (inline SVG) shown before the user picks camera/photo. */
export const DEMO_ROOM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#e6e1d8"/><rect y="640" width="1200" height="260" fill="#c9b99f"/><g stroke="#bcae95" stroke-width="3"><path d="M0 700 H1200 M0 770 H1200 M0 845 H1200"/></g><rect x="850" y="140" width="240" height="330" fill="#dfeaf0" stroke="#f5f2ec" stroke-width="14"/><path d="M970 140 V470 M850 305 H1090" stroke="#f5f2ec" stroke-width="10"/><rect x="120" y="560" width="430" height="150" rx="22" fill="#8a7f6d"/><rect x="140" y="480" width="390" height="110" rx="18" fill="#9c917e"/><rect x="105" y="545" width="60" height="165" rx="14" fill="#7c7261"/><rect x="505" y="545" width="60" height="165" rx="14" fill="#7c7261"/><ellipse cx="340" cy="875" rx="330" ry="24" fill="#00000014"/><rect x="660" y="520" width="110" height="190" rx="8" fill="#6b5d48"/><ellipse cx="715" cy="470" rx="70" ry="60" fill="#5d7a52"/><ellipse cx="690" cy="440" rx="45" ry="42" fill="#6d8c60"/></svg>`;
