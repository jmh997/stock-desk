"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export function useClientSort<T>(
  rows: T[],
  defaultKey: string,
  defaultDir: SortDir,
  accessors: Record<string, (row: T) => string | number | null | undefined>,
) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function onSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const get = accessors[sortKey];
    if (!get) return rows;
    const mult = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * mult;
      }
      return String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * mult;
    });
  }, [rows, sortKey, sortDir, accessors]);

  return { sorted, sortKey, sortDir, onSort };
}

export function SortTh({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  col: string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (col: string) => void;
  className?: string;
}) {
  const active = sortKey === col;
  return (
    <th className={className}>
      <button
        type="button"
        className={`sort-th${active ? " sort-th-active" : ""}`}
        onClick={() => onSort(col)}
        aria-sort={
          active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        {label}
        <span className="sort-indicator" aria-hidden>
          {active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
        </span>
      </button>
    </th>
  );
}
