// ─── Homography (unit surface → stage px) ────────────────────────────────────
//
// Franklin Ta adjugate method, ported VERBATIM from the prototype. Do not
// "improve" the math. Matrices are length-9 row-major arrays; vectors are
// length-3; points are { x, y }.

export type Mat3 = number[]; // length 9, row-major
export type Vec3 = [number, number, number];
export type Point = { x: number; y: number };

export function adj(m: Mat3): Mat3 {
  return [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3],
  ];
}

export function multmm(a: Mat3, b: Mat3): Mat3 {
  const c = Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j];
      c[3 * i + j] = s;
    }
  }
  return c;
}

export function multmv(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function basisToPoints(
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  x4: number, y4: number,
): Mat3 {
  const m: Mat3 = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const v = multmv(adj(m), [x4, y4, 1]);
  return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

/** Projection from a w×h unit surface to the quad [TL, TR, BL, BR] (px). */
export function projection(w: number, h: number, pts: Point[]): Mat3 {
  const s = basisToPoints(0, 0, w, 0, 0, h, w, h);
  const d = basisToPoints(
    pts[0].x, pts[0].y,
    pts[1].x, pts[1].y,
    pts[2].x, pts[2].y,
    pts[3].x, pts[3].y,
  );
  const t = multmm(d, adj(s));
  for (let i = 0; i < 9; i++) t[i] /= t[8];
  return t;
}

/** CSS `matrix3d(...)` string for a projection matrix (as `applyProjection` did). */
export function matrix3dString(t: Mat3): string {
  return (
    "matrix3d(" +
    [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].join(",") +
    ")"
  );
}

export function projectPoint(H: Mat3, u: number, v: number): Point {
  const p = multmv(H, [u, v, 1]);
  return { x: p[0] / p[2], y: p[1] / p[2] };
}
