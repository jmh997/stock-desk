import "server-only";

import { normalizeTicker } from "@/lib/quotes";

export type HistoryBar = {
  date: string; // YYYY-MM-DD (America/New_York calendar day from Yahoo timestamp)
  adjClose: number;
};

export type TickerHistory = {
  ticker: string;
  bars: HistoryBar[];
  firstDate: string | null;
  lastDate: string | null;
  usedAdjClose: boolean;
  error?: string;
};

type YahooChartResult = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: { timezone?: string; exchangeTimezoneName?: string };
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }>;
    error?: { description?: string };
  };
};

const YAHOO_UA =
  "Mozilla/5.0 (compatible; StockDesk/1.0; +https://github.com/jmh997/stock-desk)";

/** Format a Yahoo chart unix timestamp as YYYY-MM-DD in America/New_York. */
function tsToNyDate(ts: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts * 1000));
}

function parseYmd(ymd: string): number {
  // Treat as UTC midnight for period bounds
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 1000;
}

export type HistoryRange =
  | { kind: "range"; range: "1y" | "2y" | "5y" | "10y" | "max" }
  | { kind: "period"; start: string; end: string };

/**
 * Fetch daily bars from Yahoo chart. Prefers adjusted close
 * (indicators.adjclose); falls back to close with usedAdjClose=false.
 */
export async function fetchDailyHistory(
  rawTicker: string,
  range: HistoryRange,
): Promise<TickerHistory> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) {
    return {
      ticker: rawTicker,
      bars: [],
      firstDate: null,
      lastDate: null,
      usedAdjClose: false,
      error: "empty ticker",
    };
  }

  const params = new URLSearchParams({ interval: "1d" });
  if (range.kind === "range") {
    params.set("range", range.range);
  } else {
    // Pad one trading week before start so first requested day is included
    const p1 = Math.max(0, parseYmd(range.start) - 7 * 86400);
    const p2 = parseYmd(range.end) + 86400;
    params.set("period1", String(p1));
    params.set("period2", String(p2));
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${params}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      throw new Error(`Yahoo HTTP ${res.status}`);
    }
    const data = (await res.json()) as YahooChartResult;
    const result = data.chart?.result?.[0];
    if (!result?.timestamp?.length) {
      throw new Error(data.chart?.error?.description || "Yahoo: no result");
    }

    const timestamps = result.timestamp;
    const adjArr = result.indicators?.adjclose?.[0]?.adjclose;
    const closeArr = result.indicators?.quote?.[0]?.close;
    const usedAdjClose = Array.isArray(adjArr) && adjArr.some((v) => typeof v === "number");
    const priceArr = usedAdjClose ? adjArr! : closeArr;

    if (!priceArr) {
      throw new Error("Yahoo: no price series");
    }

    const bars: HistoryBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const px = priceArr[i];
      if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) continue;
      bars.push({ date: tsToNyDate(timestamps[i]), adjClose: px });
    }

    // Deduplicate by date (keep last) — Yahoo can emit odd duplicates around splits
    const byDate = new Map<string, number>();
    for (const b of bars) byDate.set(b.date, b.adjClose);
    const deduped = [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, adjClose]) => ({ date, adjClose }));

    return {
      ticker,
      bars: deduped,
      firstDate: deduped[0]?.date ?? null,
      lastDate: deduped[deduped.length - 1]?.date ?? null,
      usedAdjClose,
    };
  } catch (err) {
    return {
      ticker,
      bars: [],
      firstDate: null,
      lastDate: null,
      usedAdjClose: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Modest concurrency for serverless Yahoo fetches. */
export async function fetchDailyHistoryMany(
  tickers: string[],
  range: HistoryRange,
  concurrency = 4,
): Promise<TickerHistory[]> {
  const unique = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const out: TickerHistory[] = new Array(unique.length);
  let idx = 0;

  async function worker() {
    while (idx < unique.length) {
      const i = idx++;
      out[i] = await fetchDailyHistory(unique[i], range);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, unique.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}

/**
 * Map a requested [start,end] window to a Yahoo HistoryRange.
 * Pads with a wider range query when custom dates span many years.
 */
export function historyRangeForWindow(
  start: string | null,
  end: string | null,
): HistoryRange {
  if (!start && !end) {
    return { kind: "range", range: "max" };
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
  const s = start || "1970-01-01";
  const e = end || today;
  return { kind: "period", start: s, end: e };
}
