import { describe, expect, it } from "vitest";

import { estimatedDims, estimatedSqft, quadArea } from "@/lib/wall-studio/geometry";
import type { Corner } from "@/lib/wall-studio/types";

// A unit square as [TL, TR, BL, BR].
const unit: Corner[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

describe("quadArea", () => {
  it("computes the area of a unit square as 1", () => {
    expect(quadArea(unit)).toBeCloseTo(1, 6);
  });
  it("scales with a half-size quad", () => {
    const half: Corner[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ];
    expect(quadArea(half)).toBeCloseTo(0.25, 6);
  });
});

describe("estimatedSqft", () => {
  it("returns dims product when area equals the calibration area", () => {
    const area = quadArea(unit);
    expect(estimatedSqft(area, area, { w: 20, h: 10 })).toBe(200);
  });
  it("scales linearly with the area ratio", () => {
    const calib = quadArea(unit); // 1
    const half: Corner[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0, y: 1 },
      { x: 0.5, y: 1 },
    ];
    expect(estimatedSqft(quadArea(half), calib, { w: 20, h: 10 })).toBe(100); // area 0.5 -> half
  });
});

describe("estimatedDims", () => {
  it("scales W and H by sqrt of the area ratio", () => {
    const calib = quadArea(unit); // 1
    const quarter: Corner[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ]; // area 0.25 -> sqrt 0.5
    expect(estimatedDims(quadArea(quarter), calib, { w: 20, h: 10 })).toEqual({ w: 10, h: 5 });
  });
});
