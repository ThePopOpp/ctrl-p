import { ACTIVE_STAGES, type PipelineStage } from "@/lib/pipeline/stages";

type QuoteLike = { amount: number | string | null; status: string; is_current?: boolean } | null | undefined;

/**
 * The value of an opportunity. The current quote wins when there is one —
 * superseded versions are never added together — and the manual estimate is the
 * fallback before anything has been priced.
 */
export function opportunityValue(estimatedValue: number | string | null | undefined, currentQuote: QuoteLike): number {
  if (currentQuote && currentQuote.status !== "superseded" && currentQuote.is_current !== false) {
    const amount = Number(currentQuote.amount);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  const estimate = Number(estimatedValue);
  return Number.isFinite(estimate) && estimate > 0 ? estimate : 0;
}

export type ForecastRow = {
  stage: PipelineStage;
  probability: number;
  value: number;
  closed_at: string | null;
};

export type ReportingPeriod = { from: Date | null; to: Date | null };

export type PipelineStats = {
  openCount: number;
  openValue: number;
  weightedForecast: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  /** Won / (Won + Lost) within the period, as a 0–100 percentage; null when nothing closed. */
  winRate: number | null;
  onHoldCount: number;
  onHoldValue: number;
};

const inPeriod = (iso: string | null, period: ReportingPeriod) => {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (period.from && time < period.from.getTime()) return false;
  if (period.to && time > period.to.getTime()) return false;
  return true;
};

export function computePipelineStats(rows: ForecastRow[], period: ReportingPeriod = { from: null, to: null }): PipelineStats {
  const open = rows.filter((row) => ACTIVE_STAGES.includes(row.stage));
  const won = rows.filter((row) => row.stage === "closed_won" && inPeriod(row.closed_at, period));
  const lost = rows.filter((row) => row.stage === "closed_lost" && inPeriod(row.closed_at, period));
  const held = rows.filter((row) => row.stage === "on_hold");
  const decided = won.length + lost.length;
  return {
    openCount: open.length,
    openValue: round2(open.reduce((sum, row) => sum + row.value, 0)),
    weightedForecast: round2(open.reduce((sum, row) => sum + (row.value * row.probability) / 100, 0)),
    wonCount: won.length,
    wonValue: round2(won.reduce((sum, row) => sum + row.value, 0)),
    lostCount: lost.length,
    winRate: decided ? Math.round((won.length / decided) * 1000) / 10 : null,
    onHoldCount: held.length,
    onHoldValue: round2(held.reduce((sum, row) => sum + row.value, 0)),
  };
}

export type PeriodKey = "month" | "quarter" | "year" | "all";

export function periodFor(key: PeriodKey, now = new Date()): ReportingPeriod {
  if (key === "all") return { from: null, to: null };
  const year = now.getFullYear();
  if (key === "year") return { from: new Date(year, 0, 1), to: null };
  if (key === "quarter") return { from: new Date(year, Math.floor(now.getMonth() / 3) * 3, 1), to: null };
  return { from: new Date(year, now.getMonth(), 1), to: null };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** True when a date-only value (YYYY-MM-DD) is before today in local time. */
export function isOverdue(date: string | null | undefined, now = new Date()) {
  if (!date) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return new Date(`${date}T00:00:00`).getTime() < today;
}
