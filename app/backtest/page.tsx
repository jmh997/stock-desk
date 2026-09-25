import { BacktestPanel } from "@/components/BacktestPanel";
import { listBacktestUniverse } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  let universe: Awaited<ReturnType<typeof listBacktestUniverse>> = [];
  let dbError: string | null = null;

  try {
    universe = await listBacktestUniverse();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Backtest</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Portfolio vs benchmark — Yahoo adjusted daily closes, common-window
          intersection, optional rebalance.
        </p>
      </div>

      {dbError && (
        <div className="card border-[var(--warn)] px-4 py-3 text-sm text-[var(--warn)]">
          Database unavailable: {dbError}. Universe will be empty until{" "}
          <code className="font-mono">DATABASE_URL</code> is set.
        </div>
      )}

      <BacktestPanel universe={universe} />
    </div>
  );
}
