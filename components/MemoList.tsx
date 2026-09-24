import Link from "next/link";
import type { Memo } from "@/lib/db/schema";

export function MemoList({ memos }: { memos: Memo[] }) {
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="dense">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Name</th>
              <th>Research date</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {memos.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-[var(--muted)]">
                  No memos yet.{" "}
                  <Link href="/memos/new" className="text-[#60a5fa] underline">
                    Add one
                  </Link>{" "}
                  or ingest via API.
                </td>
              </tr>
            ) : (
              memos.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link
                      href={`/memos/${m.id}`}
                      className="font-semibold tracking-wide text-[#60a5fa] hover:underline"
                    >
                      {m.ticker}
                    </Link>
                  </td>
                  <td className="max-w-[16rem] truncate text-[var(--text)]">
                    <Link href={`/memos/${m.id}`} className="hover:underline">
                      {m.name || "—"}
                    </Link>
                  </td>
                  <td className="font-mono text-[0.8rem] text-[var(--muted)]">
                    {m.researchDate}
                  </td>
                  <td className="uppercase text-[0.7rem] tracking-wide text-[var(--muted)]">
                    {m.assetClass || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
