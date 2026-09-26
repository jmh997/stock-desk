import "server-only";

import {
  fetchDailyHistoryMany,
  historyRangeForWindow,
  type TickerHistory,
} from "@/lib/history";
import { normalizeTicker } from "@/lib/quotes";

export type WeightMode = "equal" | "custom";
export type Rebalance = "none" | "monthly" | "quarterly" | "yearly";

export type BacktestRequest = {
  tickers: string[];
  weights?: Record<string, number>;
  weightMode: WeightMode;
  start?: string | null;
  end?: string | null;
  rebalance: Rebalance;
  benchmark?: string | null;
  initialValue?: number;
};

export type BacktestStats = {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  volAnnual: number;
  sharpeRough: number | null;
};

export type BacktestResponse = {
  meta: {
    asOf: string;
    commonStart: string;
    commonEnd: string;
    rebalance: Rebalance;
    weightMode: WeightMode;
    initialValue: number;
    warnings: string[];
  };
  tickers: Array<{
    ticker: string;
    firstDate: string | null;
    lastDate: string | null;
    weight: number;
  }>;
  series: Array<{
    date: string;
    portfolio: number;
    benchmark: number | null;
  }>;
  stats: {
    portfolio: BacktestStats;
    benchmark: BacktestStats | null;
  };
  contribution: Array<{
    ticker: string;
    endWeight: number;
    approxReturnContribution: number;
  }>;
};

const WEIGHT_SUM_TOL = 0.001;
const MAX_TICKERS = 15;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export class BacktestValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "BacktestValidationError";
  }
}

function assertYmd(label: string, v: string | null | undefined): string | null {
  if (v == null || v === "") return null;
  if (!YMD_RE.test(v)) {
    throw new BacktestValidationError(`${label} must be YYYY-MM-DD`);
  }
  return v;
}

export function parseBacktestBody(body: unknown): BacktestRequest {
  if (!body || typeof body !== "object") {
    throw new BacktestValidationError("JSON body required");
  }
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.tickers) || b.tickers.length === 0) {
    throw new BacktestValidationError("tickers required (1–15)");
  }
  if (b.tickers.length > MAX_TICKERS) {
    throw new BacktestValidationError(`tickers capped at ${MAX_TICKERS}`);
  }
  const tickers = b.tickers.map((t) => {
    if (typeof t !== "string") {
      throw new BacktestValidationError("tickers must be strings");
    }
    const n = normalizeTicker(t);
    if (!n) throw new BacktestValidationError("empty ticker");
    return n;
  });
  if (new Set(tickers).size !== tickers.length) {
    throw new BacktestValidationError("tickers must be unique");
  }

  const weightMode = b.weightMode === "custom" ? "custom" : b.weightMode === "equal" ? "equal" : null;
  if (!weightMode) {
    throw new BacktestValidationError("weightMode must be equal|custom");
  }

  let weights: Record<string, number> | undefined;
  if (weightMode === "equal") {
    const w = 1 / tickers.length;
    weights = Object.fromEntries(tickers.map((t) => [t, w]));
  } else {
    if (!b.weights || typeof b.weights !== "object") {
      throw new BacktestValidationError("weights required for custom weightMode");
    }
    const raw = b.weights as Record<string, unknown>;
    weights = {};
    for (const t of tickers) {
      const v = raw[t];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        throw new BacktestValidationError(`weights.${t} required (non-negative number)`);
      }
      weights[t] = v;
    }
    const sum = Object.values(weights).reduce((a, c) => a + c, 0);
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOL) {
      throw new BacktestValidationError(
        `weights must sum to 1.0 ± ${WEIGHT_SUM_TOL} (got ${sum})`,
      );
    }
  }

  const rebalanceRaw = b.rebalance;
  const rebalance: Rebalance =
    rebalanceRaw === "none" ||
    rebalanceRaw === "monthly" ||
    rebalanceRaw === "quarterly" ||
    rebalanceRaw === "yearly"
      ? rebalanceRaw
      : (() => {
          throw new BacktestValidationError(
            "rebalance must be none|monthly|quarterly|yearly",
          );
        })();

  const start = assertYmd("start", typeof b.start === "string" ? b.start : null);
  const end = assertYmd("end", typeof b.end === "string" ? b.end : null);
  if (start && end && start > end) {
    throw new BacktestValidationError("start must be ≤ end");
  }

  let benchmark: string | null = null;
  if (b.benchmark != null && b.benchmark !== "") {
    if (typeof b.benchmark !== "string") {
      throw new BacktestValidationError("benchmark must be a ticker string");
    }
    benchmark = normalizeTicker(b.benchmark);
  }

  let initialValue = 10_000;
  if (b.initialValue != null) {
    if (typeof b.initialValue !== "number" || !Number.isFinite(b.initialValue) || b.initialValue <= 0) {
      throw new BacktestValidationError("initialValue must be a positive number");
    }
    initialValue = b.initialValue;
  }

  return {
    tickers,
    weights,
    weightMode,
    start,
    end,
    rebalance,
    benchmark,
    initialValue,
  };
}

function toPriceMap(h: TickerHistory): Map<string, number> {
  return new Map(h.bars.map((b) => [b.date, b.adjClose]));
}

/** Intersection of date sets; optionally clamp to [start,end]. */
function commonDates(
  maps: Map<string, number>[],
  start: string | null,
  end: string | null,
): string[] {
  if (maps.length === 0) return [];
  let set = new Set(maps[0].keys());
  for (let i = 1; i < maps.length; i++) {
    const next = new Set<string>();
    for (const d of set) {
      if (maps[i].has(d)) next.add(d);
    }
    set = next;
  }
  let dates = [...set].sort();
  if (start) dates = dates.filter((d) => d >= start);
  if (end) dates = dates.filter((d) => d <= end);
  return dates;
}

function ymdParts(d: string): { y: number; m: number; day: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}

/**
 * Rebalance on the first trading day of each calendar month / quarter / year
 * (including the first day of the common window, which is the initial buy).
 */
function isRebalanceDay(
  date: string,
  prevDate: string | null,
  mode: Rebalance,
): boolean {
  if (mode === "none") return false;
  if (!prevDate) return true; // initial allocation day
  const cur = ymdParts(date);
  const prev = ymdParts(prevDate);
  if (mode === "monthly") return cur.m !== prev.m || cur.y !== prev.y;
  if (mode === "quarterly") {
    const cq = Math.floor((cur.m - 1) / 3);
    const pq = Math.floor((prev.m - 1) / 3);
    return cq !== pq || cur.y !== prev.y;
  }
  // yearly
  return cur.y !== prev.y;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const varSum = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
  return Math.sqrt(varSum / (xs.length - 1));
}

function computeStats(values: number[], firstDate: string, lastDate: string): BacktestStats {
  if (values.length < 2) {
    return {
      totalReturn: 0,
      cagr: 0,
      maxDrawdown: 0,
      volAnnual: 0,
      sharpeRough: null,
    };
  }
  const start = values[0];
  const end = values[values.length - 1];
  const totalReturn = start > 0 ? end / start - 1 : 0;

  const t0 = Date.parse(`${firstDate}T00:00:00Z`);
  const t1 = Date.parse(`${lastDate}T00:00:00Z`);
  const years = Math.max((t1 - t0) / (365.25 * 86400_000), 1 / 365.25);
  const cagr = start > 0 && end > 0 ? Math.pow(end / start, 1 / years) - 1 : 0;

  const daily: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) daily.push(values[i] / values[i - 1] - 1);
  }
  const volAnnual = stdev(daily) * Math.sqrt(252);

  let peak = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = v / peak - 1;
      if (dd < maxDd) maxDd = dd;
    }
  }

  const sharpeRough =
    volAnnual > 1e-12 && Number.isFinite(cagr) ? cagr / volAnnual : null;

  return {
    totalReturn,
    cagr,
    maxDrawdown: maxDd,
    volAnnual,
    sharpeRough,
  };
}

function todayNy(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export async function runBacktest(req: BacktestRequest): Promise<BacktestResponse> {
  const warnings: string[] = [];
  const weights = req.weights!;
  const initialValue = req.initialValue ?? 10_000;
  const start = req.start ?? null;
  const end = req.end ?? null;

  const fetchTickers = [...req.tickers];
  if (req.benchmark && !fetchTickers.includes(req.benchmark)) {
    fetchTickers.push(req.benchmark);
  }

  const range = historyRangeForWindow(start, end);
  const histories = await fetchDailyHistoryMany(fetchTickers, range);
  const byTicker = new Map(histories.map((h) => [h.ticker, h]));

  for (const t of req.tickers) {
    const h = byTicker.get(t);
    if (!h || h.error || h.bars.length === 0) {
      throw new BacktestValidationError(
        `Failed to fetch history for ${t}: ${h?.error || "no bars"}`,
      );
    }
    if (!h.usedAdjClose) {
      warnings.push(`${t}: adjusted close unavailable; using raw close`);
    }
  }

  let benchHist: TickerHistory | null = null;
  if (req.benchmark) {
    benchHist = byTicker.get(req.benchmark) ?? null;
    if (!benchHist || benchHist.error || benchHist.bars.length === 0) {
      warnings.push(
        `Benchmark ${req.benchmark} history unavailable (${benchHist?.error || "no bars"}); continuing without benchmark series`,
      );
      benchHist = null;
    } else if (!benchHist.usedAdjClose) {
      warnings.push(
        `${req.benchmark}: adjusted close unavailable; using raw close`,
      );
    }
  }

  const portMaps = req.tickers.map((t) => toPriceMap(byTicker.get(t)!));
  const mapsForCommon = benchHist
    ? [...portMaps, toPriceMap(benchHist)]
    : portMaps;
  const dates = commonDates(mapsForCommon, start, end);

  if (dates.length < 2) {
    throw new BacktestValidationError(
      "Insufficient overlapping trading days for selected tickers/window",
    );
  }

  const commonStart = dates[0];
  const commonEnd = dates[dates.length - 1];

  if (start && commonStart > start) {
    warnings.push(
      `Common window starts ${commonStart} (requested ${start}) — truncated by shortest history`,
    );
  }
  if (end && commonEnd < end) {
    warnings.push(
      `Common window ends ${commonEnd} (requested ${end})`,
    );
  }

  for (const t of req.tickers) {
    const h = byTicker.get(t)!;
    if (h.firstDate && start && h.firstDate > start) {
      warnings.push(
        `${t}: history starts ${h.firstDate} (short/IPO history relative to requested start)`,
      );
    }
  }

  if (req.rebalance !== "none") {
    warnings.push(
      `Rebalance=${req.rebalance}: target weights applied on the first trading day of each ${req.rebalance === "monthly" ? "month" : req.rebalance === "quarterly" ? "quarter" : "year"} (incl. start)`,
    );
  }

  // --- Simulate portfolio ---
  const shares: Record<string, number> = {};
  const series: BacktestResponse["series"] = [];
  const portfolioValues: number[] = [];
  const benchmarkValues: number[] = [];
  let benchShares = 0;

  let prevDate: string | null = null;
  for (const date of dates) {
    const prices: Record<string, number> = {};
    for (let i = 0; i < req.tickers.length; i++) {
      prices[req.tickers[i]] = portMaps[i].get(date)!;
    }

    const needRebalance =
      prevDate === null ||
      (req.rebalance !== "none" && isRebalanceDay(date, prevDate, req.rebalance));

    if (prevDate === null) {
      // Initial buy
      for (const t of req.tickers) {
        shares[t] = (initialValue * weights[t]) / prices[t];
      }
      if (benchHist) {
        const bp = toPriceMap(benchHist).get(date)!;
        benchShares = initialValue / bp;
      }
    } else if (needRebalance) {
      const portVal = req.tickers.reduce(
        (s, t) => s + shares[t] * prices[t],
        0,
      );
      for (const t of req.tickers) {
        shares[t] = (portVal * weights[t]) / prices[t];
      }
    }

    const portVal = req.tickers.reduce((s, t) => s + shares[t] * prices[t], 0);
    portfolioValues.push(portVal);

    let benchVal: number | null = null;
    if (benchHist) {
      const bp = toPriceMap(benchHist).get(date)!;
      benchVal = benchShares * bp;
      benchmarkValues.push(benchVal);
    }

    series.push({
      date,
      portfolio: roundMoney(portVal),
      benchmark: benchVal != null ? roundMoney(benchVal) : null,
    });

    prevDate = date;
  }

  // End weights + approximate contribution
  const lastPrices: Record<string, number> = {};
  const firstPrices: Record<string, number> = {};
  for (let i = 0; i < req.tickers.length; i++) {
    const t = req.tickers[i];
    firstPrices[t] = portMaps[i].get(commonStart)!;
    lastPrices[t] = portMaps[i].get(commonEnd)!;
  }
  const endPort = portfolioValues[portfolioValues.length - 1];
  const contribution = req.tickers.map((t) => {
    const endValue = shares[t] * lastPrices[t];
    const endWeight = endPort > 0 ? endValue / endPort : 0;
    // Approximate: initial weight × ticker total return over common window
    const tickerRet =
      firstPrices[t] > 0 ? lastPrices[t] / firstPrices[t] - 1 : 0;
    const approxReturnContribution = weights[t] * tickerRet;
    return {
      ticker: t,
      endWeight: round4(endWeight),
      approxReturnContribution: round6(approxReturnContribution),
    };
  });

  const portStats = computeStats(portfolioValues, commonStart, commonEnd);
  const benchStats =
    benchmarkValues.length >= 2
      ? computeStats(benchmarkValues, commonStart, commonEnd)
      : null;

  return {
    meta: {
      asOf: todayNy(),
      commonStart,
      commonEnd,
      rebalance: req.rebalance,
      weightMode: req.weightMode,
      initialValue,
      warnings,
    },
    tickers: req.tickers.map((t) => {
      const h = byTicker.get(t)!;
      return {
        ticker: t,
        firstDate: h.firstDate,
        lastDate: h.lastDate,
        weight: round6(weights[t]),
      };
    }),
    series,
    stats: {
      portfolio: roundStats(portStats),
      benchmark: benchStats ? roundStats(benchStats) : null,
    },
    contribution,
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
function roundStats(s: BacktestStats): BacktestStats {
  return {
    totalReturn: round6(s.totalReturn),
    cagr: round6(s.cagr),
    maxDrawdown: round6(s.maxDrawdown),
    volAnnual: round6(s.volAnnual),
    sharpeRough:
      s.sharpeRough == null ? null : round6(s.sharpeRough),
  };
}
