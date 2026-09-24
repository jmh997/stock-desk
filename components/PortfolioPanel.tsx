import { addHolding, removeHolding } from "@/lib/actions";
import type { Holding } from "@/lib/db/schema";
import { formatNumber, formatPct, formatPrice } from "@/lib/format";
import type { Quote } from "@/lib/quotes";

function pctClass(n: number | null | undefined): string {
  if (n == null) return "pct-flat";
  if (n > 0) return "pct-up";
  if (n < 0) return "pct-down";
  return "pct-flat";
}

type Row = Holding & {
  price: number | null;
  marketValue: number | null;
  costBasis: number | null;
  pnl: number | null;
  pnlPct: number | null;
};

export function PortfolioPanel({
  holdings,
  quotes,
}: {
  holdings: Holding[];
  quotes: Record<string, Quote>;
}) {
  const rows: Row[] = holdings.map((h) => {
    const price = quotes[h.ticker]?.price ?? null;
    const marketValue =
      price != null ? price * h.shares : null;
    const costBasis =
      h.avgCost != null ? h.avgCost * h.shares : null;
    const pnl =
      marketValue != null && costBasis != null
        ? marketValue - costBasis
        : null;
    const pnlPct =
      pnl != null && costBasis != null && costBasis !== 0
        ? (pnl / costBasis) * 100
        : null;
    return { ...h, price, marketValue, costBasis, pnl, pnlPct };
  });

  const totalMv = rows.reduce(
    (sum, r) => sum + (r.marketValue ?? 0),
    0,
  );
  const totalCost = rows.reduce(
    (sum, r) => sum + (r.costBasis ?? 0),
    0,
  );
  const hasCost = rows.some((r) => r.costBasis != null);
  const totalPnl = hasCost ? totalMv - totalCost : null;
  const totalPnlPct =
    totalPnl != null && totalCost !== 0 ? (totalPnl / totalCost) * 100 : null;

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Portfolio</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Mkt value {formatPrice(rows.some((r) => r.marketValue != null) ? totalMv : null)}
            {totalPnl != null && (
              <>
                {" · "}
                P/L{" "}
                <span className={pctClass(totalPnl)}>
                  {formatPrice(totalPnl)} ({formatPct(totalPnlPct)})
                </span>
              </>
            )}
          </p>
        </div>
        <form
          action={addHolding}
          className="flex flex-wrap items-end gap-2"
        >
          <input
            name="ticker"
            placeholder="Ticker"
            className="input w-24 uppercase"
            required
            autoComplete="off"
          />
          <input
            name="shares"
            type="number"
            step="any"
            min="0"
            placeholder="Shares"
            className="input w-24"
            required
          />
          <input
            name="avgCost"
            type="number"
            step="any"
            min="0"
            placeholder="Avg cost"
            className="input w-24"
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
              <th>Shares</th>
              <th>Avg cost</th>
              <th>Mkt value</th>
              <th>P/L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[var(--muted)]">
                  No holdings yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold tracking-wide">{r.ticker}</td>
                  <td className="font-mono text-[0.8rem]">
                    {formatNumber(r.shares, r.shares % 1 === 0 ? 0 : 4)}
                  </td>
                  <td className="font-mono text-[0.8rem]">
                    {formatPrice(r.avgCost)}
                  </td>
                  <td className="font-mono text-[0.8rem]">
                    {formatPrice(r.marketValue)}
                  </td>
                  <td
                    className={`font-mono text-[0.8rem] ${pctClass(r.pnl)}`}
                  >
                    {r.pnl == null
                      ? "—"
                      : `${formatPrice(r.pnl)} (${formatPct(r.pnlPct)})`}
                  </td>
                  <td className="text-right">
                    <form action={removeHolding}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="btn-ghost">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
