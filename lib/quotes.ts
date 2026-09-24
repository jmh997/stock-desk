import "server-only";

export type Quote = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  changePercent: number | null;
  source: "yahoo" | "finnhub" | "none";
  error?: string;
};

type CacheEntry = { quote: Quote; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

function pctChange(price: number | null, previousClose: number | null): number | null {
  if (price == null || previousClose == null || previousClose === 0) return null;
  return ((price - previousClose) / previousClose) * 100;
}

async function fetchYahoo(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; StockDesk/1.0; +https://github.com/jmh997/stock-desk)",
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Yahoo HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          symbol?: string;
        };
        indicators?: {
          quote?: Array<{ close?: Array<number | null> }>;
        };
      }>;
      error?: { description?: string };
    };
  };
  const result = data.chart?.result?.[0];
  if (!result?.meta) {
    throw new Error(data.chart?.error?.description || "Yahoo: no result");
  }
  const meta = result.meta;
  const price =
    typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
  let previousClose: number | null =
    typeof meta.previousClose === "number"
      ? meta.previousClose
      : typeof meta.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : null;

  if (previousClose == null) {
    const closes = result.indicators?.quote?.[0]?.close?.filter(
      (c): c is number => typeof c === "number",
    );
    if (closes && closes.length >= 2) {
      previousClose = closes[closes.length - 2] ?? null;
    }
  }

  return {
    symbol,
    price,
    previousClose,
    changePercent: pctChange(price, previousClose),
    source: "yahoo",
  };
}

async function fetchFinnhub(symbol: string): Promise<Quote> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY not set");
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  const data = (await res.json()) as {
    c?: number;
    pc?: number;
    dp?: number;
  };
  const price = typeof data.c === "number" && data.c > 0 ? data.c : null;
  const previousClose = typeof data.pc === "number" && data.pc > 0 ? data.pc : null;
  const changePercent =
    typeof data.dp === "number"
      ? data.dp
      : pctChange(price, previousClose);
  if (price == null) throw new Error("Finnhub: no price");
  return {
    symbol,
    price,
    previousClose,
    changePercent,
    source: "finnhub",
  };
}

async function fetchOne(raw: string): Promise<Quote> {
  const symbol = normalizeTicker(raw);
  if (!symbol) {
    return {
      symbol: raw,
      price: null,
      previousClose: null,
      changePercent: null,
      source: "none",
      error: "empty symbol",
    };
  }

  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.quote;
  }

  let quote: Quote;
  try {
    quote = await fetchYahoo(symbol);
  } catch (yahooErr) {
    try {
      quote = await fetchFinnhub(symbol);
    } catch (finnhubErr) {
      quote = {
        symbol,
        price: null,
        previousClose: null,
        changePercent: null,
        source: "none",
        error: `yahoo: ${yahooErr instanceof Error ? yahooErr.message : String(yahooErr)}; finnhub: ${finnhubErr instanceof Error ? finnhubErr.message : String(finnhubErr)}`,
      };
    }
  }

  if (quote.price != null) {
    cache.set(symbol, { quote, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return quote;
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const unique = [...new Set(symbols.map(normalizeTicker).filter(Boolean))];
  return Promise.all(unique.map(fetchOne));
}

export async function getQuoteMap(
  symbols: string[],
): Promise<Record<string, Quote>> {
  const quotes = await getQuotes(symbols);
  return Object.fromEntries(quotes.map((q) => [q.symbol, q]));
}

export { normalizeTicker };
