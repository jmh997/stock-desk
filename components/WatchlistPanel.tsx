import {
  addWatchlistTicker,
  removeWatchlistTicker,
} from "@/lib/actions";
import { formatPct, formatPrice } from "@/lib/format";
import type { Quote } from "@/lib/quotes";
import type { WatchlistItem } from "@/lib/db/schema";

function pctClass(n: number | null | undefined): string {
  if (n == null) return "pct-flat";
  if (n > 0) return "pct-up";
  if (n < 0) return "pct-down";
  return "pct-flat";
}

function formatWeek52(
  high: number | null | undefined,
  low: number | null | undefined,
): string {
  const h = formatPrice(high ?? null);
  const l = formatPrice(low ?? null);
  if (h === "—" && l === "—") return "—";
  return `${l} – ${h}`;
}

export function WatchlistPanel({
  items,
  quotes,
}: {
  items: WatchlistItem[];
  quotes: Record<string, Quote>;
}) {
  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold">Watchlist</h2>
        <form action={addWatchlistTicker} className="flex gap-2">
          <input
            name="ticker"
            placeholder="Add ticker"
            className="input w-28 uppercase"
            required
            autoComplete="off"
          />
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>
      </div>
      <div className="table-wrap">
        <table className="dense">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Price</th>
              <th>Day %</th>
              <th className="hidden sm:table-cell">52w L–H</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-[var(--muted)]">
                  No tickers yet — add one above.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const q = quotes[item.ticker];
                const week52 = formatWeek52(q?.week52High, q?.week52Low);
                return (
                  <tr key={item.ticker}>
                    <td className="font-semibold tracking-wide">
                      {item.ticker}
                    </td>
                    <td className="font-mono text-[0.8rem]">
                      <div>{formatPrice(q?.price ?? null)}</div>
                      <div className="mt-0.5 text-[0.65rem] text-[var(--muted)] sm:hidden">
                        52w {week52}
                      </div>
                    </td>
                    <td
                      className={`font-mono text-[0.8rem] ${pctClass(q?.changePercent)}`}
                    >
                      {formatPct(q?.changePercent ?? null)}
                    </td>
                    <td className="hidden font-mono text-[0.75rem] text-[var(--muted)] sm:table-cell">
                      {week52}
                    </td>
                    <td className="text-right">
                      <form action={removeWatchlistTicker}>
                        <input type="hidden" name="ticker" value={item.ticker} />
                        <button type="submit" className="btn-ghost">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
