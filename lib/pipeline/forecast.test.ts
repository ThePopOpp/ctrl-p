import { describe, expect, it } from "vitest";

import { computePipelineStats, isOverdue, opportunityValue, periodFor } from "@/lib/pipeline/forecast";

describe("opportunityValue", () => {
  it("uses the current quote amount, not a sum of versions", () => {
    expect(opportunityValue(1000, { amount: 2400, status: "sent", is_current: true })).toBe(2400);
  });
  it("ignores superseded or non-current quotes and falls back to the estimate", () => {
    expect(opportunityValue(1000, { amount: 2400, status: "superseded", is_current: false })).toBe(1000);
    expect(opportunityValue("750.50", null)).toBe(750.5);
    expect(opportunityValue(null, null)).toBe(0);
  });
});

describe("computePipelineStats", () => {
  const rows = [
    { stage: "discovery" as const, probability: 25, value: 1000, closed_at: null },
    { stage: "quote_sent" as const, probability: 60, value: 5000, closed_at: null },
    { stage: "on_hold" as const, probability: 0, value: 9000, closed_at: null },
    { stage: "closed_won" as const, probability: 100, value: 3000, closed_at: "2026-09-02T10:00:00Z" },
    { stage: "closed_won" as const, probability: 100, value: 4000, closed_at: "2026-06-02T10:00:00Z" },
    { stage: "closed_lost" as const, probability: 0, value: 2000, closed_at: "2026-09-05T10:00:00Z" },
  ];

  it("excludes On Hold and closed records from open value and the weighted forecast", () => {
    const stats = computePipelineStats(rows);
    expect(stats.openCount).toBe(2);
    expect(stats.openValue).toBe(6000);
    expect(stats.weightedForecast).toBe(250 + 3000);
    expect(stats.onHoldCount).toBe(1);
    expect(stats.onHoldValue).toBe(9000);
  });

  it("calculates won value and win rate for the reporting period", () => {
    const all = computePipelineStats(rows);
    expect(all.wonValue).toBe(7000);
    expect(all.winRate).toBeCloseTo(66.7, 1);

    const september = computePipelineStats(rows, { from: new Date("2026-09-01T00:00:00Z"), to: null });
    expect(september.wonValue).toBe(3000);
    expect(september.wonCount).toBe(1);
    expect(september.lostCount).toBe(1);
    expect(september.winRate).toBe(50);
  });

  it("returns a null win rate when nothing closed", () => {
    expect(computePipelineStats(rows.slice(0, 3)).winRate).toBeNull();
  });
});

describe("dates", () => {
  const now = new Date(2026, 8, 13, 15, 0);
  it("flags dates before today as overdue, not today itself", () => {
    expect(isOverdue("2026-09-12", now)).toBe(true);
    expect(isOverdue("2026-09-13", now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });
  it("builds period starts", () => {
    expect(periodFor("quarter", now).from?.getMonth()).toBe(6);
    expect(periodFor("all", now).from).toBeNull();
  });
});
