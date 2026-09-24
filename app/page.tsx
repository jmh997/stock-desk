import { PortfolioPanel } from "@/components/PortfolioPanel";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import { listHoldings, listWatchlist } from "@/lib/actions";
import { getQuoteMap } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function DeskPage() {
  let watchlist: Awaited<ReturnType<typeof listWatchlist>> = [];
  let holdings: Awaited<ReturnType<typeof listHoldings>> = [];
  let dbError: string | null = null;

  try {
    [watchlist, holdings] = await Promise.all([
      listWatchlist(),
      listHoldings(),
    ]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const symbols = [
    ...watchlist.map((w) => w.ticker),
    ...holdings.map((h) => h.ticker),
  ];
  const quotes =
    symbols.length > 0 ? await getQuoteMap(symbols) : {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Desk</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Watchlist and one portfolio — quotes via Yahoo (Finnhub fallback).
        </p>
      </div>

      {dbError && (
        <div className="card border-[var(--warn)] px-4 py-3 text-sm text-[var(--warn)]">
          Database unavailable: {dbError}. Set{" "}
          <code className="font-mono">DATABASE_URL</code> and run{" "}
          <code className="font-mono">npm run db:push</code> (or reload once
          URL is set — tables auto-create).
        </div>
      )}

      <WatchlistPanel items={watchlist} quotes={quotes} />
      <PortfolioPanel holdings={holdings} quotes={quotes} />
    </div>
  );
}
