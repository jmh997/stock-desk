"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { deleteMemo, toggleMemoStar } from "@/lib/actions";
import type { Memo } from "@/lib/db/schema";
import { SortTh, useClientSort } from "@/components/sortable";

export function MemoList({ memos }: { memos: Memo[] }) {
  const [pending, startTransition] = useTransition();

  const accessors = useMemo(
    () => ({
      starred: (m: Memo) => (m.starred ? 1 : 0),
      ticker: (m: Memo) => m.ticker,
      name: (m: Memo) => m.name || "",
      researchDate: (m: Memo) => m.researchDate,
      assetClass: (m: Memo) => m.assetClass || "",
    }),
    [],
  );

  const { sorted, sortKey, sortDir, onSort } = useClientSort(
    memos,
    "starred",
    "desc",
    accessors,
  );

  function onToggleStar(id: string) {
    startTransition(async () => {
      await toggleMemoStar(id);
    });
  }

  function onDelete(id: string, label: string) {
    if (!window.confirm(`Delete memo “${label}”? This cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      await deleteMemo(id);
    });
  }

  return (
    <div className="card">
      <div className="table-wrap">
        <table className="dense">
          <thead>
            <tr>
              <SortTh
                label="★"
                col="starred"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh
                label="Ticker"
                col="ticker"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh
                label="Name"
                col="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh
                label="Research date"
                col="researchDate"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortTh
                label="Type"
                col="assetClass"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[var(--muted)]">
                  No memos yet.{" "}
                  <Link href="/memos/new" className="text-[#60a5fa] underline">
                    Add one
                  </Link>{" "}
                  or ingest via API.
                </td>
              </tr>
            ) : (
              sorted.map((m) => (
                <tr key={m.id}>
                  <td>
                    <button
                      type="button"
                      className={`star-btn${m.starred ? " starred" : ""}`}
                      aria-label={m.starred ? "Unstar memo" : "Star memo"}
                      disabled={pending}
                      onClick={() => onToggleStar(m.id)}
                    >
                      {m.starred ? "★" : "☆"}
                    </button>
                  </td>
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
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={pending}
                      onClick={() =>
                        onDelete(m.id, m.name ? `${m.ticker} — ${m.name}` : m.ticker)
                      }
                    >
                      Delete
                    </button>
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
