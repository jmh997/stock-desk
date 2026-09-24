import Link from "next/link";
import { MemoList } from "@/components/MemoList";
import { listMemos } from "@/lib/actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function MemosPage({ searchParams }: Props) {
  const { q } = await searchParams;
  let memos: Awaited<ReturnType<typeof listMemos>> = [];
  let dbError: string | null = null;

  try {
    memos = await listMemos(q);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Memos</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Research write-ups from Stock Scout (and manual paste).
          </p>
        </div>
        <Link href="/memos/new" className="btn-primary">
          New memo
        </Link>
      </div>

      <form className="flex gap-2" method="get">
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Filter by ticker, name, or tag"
          className="input max-w-sm"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {dbError && (
        <div className="card border-[var(--warn)] px-4 py-3 text-sm text-[var(--warn)]">
          Database unavailable: {dbError}
        </div>
      )}

      <MemoList memos={memos} />
    </div>
  );
}
