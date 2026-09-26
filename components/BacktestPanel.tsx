"use client";

import { useCallback, useMemo, useState } from "react";
import { formatNumber, formatPct, formatPrice } from "@/lib/format";
import { BacktestChart } from "@/components/BacktestChart";

export type UniverseItem = {
  ticker: string;
  starred: boolean;
  source: "memo" | "watchlist" | "holding";
};

type WeightMode = "equal" | "custom";
type Rebalance = "none" | "monthly" | "quarterly" | "yearly";
type PeriodPreset = "1y" | "3y" | "5y" | "max" | "custom";

type BacktestStats = {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  volAnnual: number;
  sharpeRough: number | null;
};

type BacktestResult = {
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
  series: Array<{ date: string; portfolio: number; benchmark: number | null }>;
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

function todayNy(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

function yearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(d);
}

function presetWindow(preset: PeriodPreset): {
  start: string | null;
  end: string | null;
} {
  const end = todayNy();
  if (preset === "1y") return { start: yearsAgo(1), end };
  if (preset === "3y") return { start: yearsAgo(3), end };
  if (preset === "5y") return { start: yearsAgo(5), end };
  if (preset === "max") return { start: null, end: null };
  return { start: yearsAgo(3), end };
}

function pctClass(n: number | null | undefined): string {
  if (n == null) return "pct-flat";
  if (n > 0) return "pct-up";
  if (n < 0) return "pct-down";
  return "pct-flat";
}

function formatRet(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  return formatPct(n * 100);
}

export function BacktestPanel({ universe }: { universe: UniverseItem[] }) {
  const [selected, setSelected] = useState<string[]>(() => {
    const starred = universe.filter((u) => u.starred).map((u) => u.ticker);
    if (starred.length >= 2) return starred.slice(0, 15);
    const defaults = ["VOO", "VXUS"].filter((t) =>
      universe.some((u) => u.ticker === t),
    );
    if (defaults.length >= 1) return defaults;
    return universe.slice(0, Math.min(2, universe.length)).map((u) => u.ticker);
  });
  const [weightMode, setWeightMode] = useState<WeightMode>("equal");
  const [customWeights, setCustomWeights] = useState<Record<string, string>>(
    {},
  );
  const [preset, setPreset] = useState<PeriodPreset>("3y");
  const [customStart, setCustomStart] = useState(yearsAgo(3));
  const [customEnd, setCustomEnd] = useState(todayNy());
  const [rebalance, setRebalance] = useState<Rebalance>("monthly");
  const [benchmark, setBenchmark] = useState("VOO");
  const [initialValue, setInitialValue] = useState("10000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const toggleTicker = useCallback((t: string) => {
    setSelected((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 15) return prev;
      return [...prev, t];
    });
  }, []);

  const weightSum = useMemo(() => {
    if (weightMode !== "custom") return 1;
    return selected.reduce((s, t) => {
      const n = Number(customWeights[t]);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [weightMode, selected, customWeights]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const window =
        preset === "custom"
          ? { start: customStart, end: customEnd }
          : presetWindow(preset);

      const body: Record<string, unknown> = {
        tickers: selected,
        weightMode,
        rebalance,
        initialValue: Number(initialValue) || 10000,
        benchmark: benchmark.trim() ? benchmark.trim().toUpperCase() : null,
      };
      if (window.start) body.start = window.start;
      if (window.end) body.end = window.end;
      if (weightMode === "custom") {
        const weights: Record<string, number> = {};
        for (const t of selected) {
          weights[t] = Number(customWeights[t]);
        }
        body.weights = weights;
      }

      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setResult(data as BacktestResult);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Universe</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            From memos (starred first), watchlist, and holdings. Max 15.
          </p>
        </div>
        {universe.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No tickers yet -- add memos or watchlist items first.
          </p>
        ) : (
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {universe.map((u) => {
              const on = selected.includes(u.ticker);
              return (
                <button
                  key={u.ticker}
                  type="button"
                  onClick={() => toggleTicker(u.ticker)}
                  className={`rounded-md border px-2 py-1 font-mono text-xs ${
                    on
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {u.starred ? "* " : ""}
                  {u.ticker}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-[var(--muted)]">
          Selected: {selected.join(", ") || "--"} ({selected.length}/15)
        </p>
      </div>

      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted)]">
            Weight mode
          </label>
          <div className="flex gap-2">
            {(["equal", "custom"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setWeightMode(m)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  weightMode === m
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-row)] text-[var(--muted)]"
                }`}
              >
                {m === "equal" ? "Equal" : "Custom"}
              </button>
            ))}
          </div>
          {weightMode === "custom" && (
            <div className="space-y-1.5 pt-1">
              {selected.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="w-16 font-mono text-xs">{t}</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    placeholder="0.25"
                    value={customWeights[t] ?? ""}
                    onChange={(e) =>
                      setCustomWeights((prev) => ({
                        ...prev,
                        [t]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <p
                className={`text-xs ${
                  Math.abs(weightSum - 1) <= 0.001
                    ? "text-[var(--muted)]"
                    : "text-[var(--warn)]"
                }`}
              >
                Sum: {weightSum.toFixed(4)} (need 1.0 +/- 0.001)
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted)]">
            Period
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["1y", "1Y"],
                ["3y", "3Y"],
                ["5y", "5Y"],
                ["max", "Max"],
                ["custom", "Custom"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setPreset(k)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  preset === k
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-row)] text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <input
                className="input max-w-[10rem]"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="self-center text-xs text-[var(--muted)]"> to </span>
              <input
                className="input max-w-[10rem]"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted)]">
            Rebalance
          </label>
          <select
            className="input"
            value={rebalance}
            onChange={(e) => setRebalance(e.target.value as Rebalance)}
          >
            <option value="none">None (buy &amp; hold)</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted)]">
            Benchmark (optional)
          </label>
          <input
            className="input font-mono"
            value={benchmark}
            onChange={(e) => setBenchmark(e.target.value.toUpperCase())}
            placeholder="VOO"
          />
          <label className="mt-2 block text-xs font-medium text-[var(--muted)]">
            Initial value
          </label>
          <input
            className="input"
            type="number"
            min="1"
            step="100"
            value={initialValue}
            onChange={(e) => setInitialValue(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={loading || selected.length === 0}
          onClick={() => void run()}
        >
          {loading ? "Running..." : "Run backtest"}
        </button>
        {error && (
          <p className="text-sm text-[var(--down)]">{error}</p>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          {result.meta.warnings.length > 0 && (
            <div className="card border-[var(--warn)] px-4 py-3 text-sm text-[var(--warn)]">
              <p className="font-medium">Warnings</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[var(--text)]">
                {result.meta.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-[var(--muted)]">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Equity curve</h2>
              <p className="text-xs text-[var(--muted)]">
                {result.meta.commonStart} to {result.meta.commonEnd} | as of{" "}
                {result.meta.asOf}
              </p>
            </div>
            <BacktestChart series={result.series} />
          </div>

          <div className="card overflow-x-auto p-4">
            <h2 className="mb-3 text-sm font-semibold">Stats</h2>
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">Metric</th>
                  <th className="py-2 pr-3 font-medium">Portfolio</th>
                  <th className="py-2 font-medium">Benchmark</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Total return", "totalReturn", true],
                    ["CAGR", "cagr", true],
                    ["Max drawdown", "maxDrawdown", true],
                    ["Vol (ann.)", "volAnnual", true],
                    ["Sharpe (rough)", "sharpeRough", false],
                  ] as const
                ).map(([label, key, isPct]) => {
                  const p = result.stats.portfolio[key];
                  const b = result.stats.benchmark?.[key] ?? null;
                  return (
                    <tr
                      key={key}
                      className="border-b border-[var(--border)]/60"
                    >
                      <td className="py-2 pr-3 text-[var(--muted)]">{label}</td>
                      <td
                        className={`py-2 pr-3 font-mono ${
                          isPct && typeof p === "number" ? pctClass(p) : ""
                        }`}
                      >
                        {key === "sharpeRough"
                          ? p == null
                            ? "--"
                            : formatNumber(p as number, 2)
                          : formatRet(p as number)}
                      </td>
                      <td
                        className={`py-2 font-mono ${
                          isPct && typeof b === "number" ? pctClass(b) : ""
                        }`}
                      >
                        {key === "sharpeRough"
                          ? b == null
                            ? "--"
                            : formatNumber(b as number, 2)
                          : formatRet(b as number | null)}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-2 pr-3 text-[var(--muted)]">End value</td>
                  <td className="py-2 pr-3 font-mono">
                    {formatPrice(
                      result.series[result.series.length - 1]?.portfolio,
                    )}
                  </td>
                  <td className="py-2 font-mono">
                    {formatPrice(
                      result.series[result.series.length - 1]?.benchmark,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card overflow-x-auto p-4">
            <h2 className="mb-3 text-sm font-semibold">Contribution</h2>
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">Ticker</th>
                  <th className="py-2 pr-3 font-medium">Weight</th>
                  <th className="py-2 pr-3 font-medium">First / last</th>
                  <th className="py-2 pr-3 font-medium">End weight</th>
                  <th className="py-2 font-medium">Approx contrib</th>
                </tr>
              </thead>
              <tbody>
                {result.tickers.map((t) => {
                  const c = result.contribution.find(
                    (x) => x.ticker === t.ticker,
                  );
                  return (
                    <tr
                      key={t.ticker}
                      className="border-b border-[var(--border)]/60"
                    >
                      <td className="py-2 pr-3 font-mono">{t.ticker}</td>
                      <td className="py-2 pr-3 font-mono">
                        {formatNumber(t.weight * 100, 1)}%
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-[var(--muted)]">
                        {t.firstDate ?? "--"} to {t.lastDate ?? "--"}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        {c ? `${formatNumber(c.endWeight * 100, 1)}%` : "--"}
                      </td>
                      <td
                        className={`py-2 font-mono ${pctClass(
                          c?.approxReturnContribution ?? null,
                        )}`}
                      >
                        {c
                          ? formatRet(c.approxReturnContribution)
                          : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
