import Link from "next/link";
import { createMemo } from "@/lib/actions";
import { todayNyDate } from "@/lib/memo-parse";

export default function NewMemoPage() {
  const today = todayNyDate();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">New memo</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Paste a Stock Scout write-up. No auth in v1.
          </p>
        </div>
        <Link href="/memos" className="btn-ghost">
          Cancel
        </Link>
      </div>

      <form action={createMemo} className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[var(--muted)]">
            Ticker *
            <input
              name="ticker"
              required
              className="input mt-1 uppercase"
              placeholder="AAPL"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Name
            <input
              name="name"
              className="input mt-1"
              placeholder="Apple Inc."
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Research date (YYYY-MM-DD)
            <input
              name="researchDate"
              type="date"
              defaultValue={today}
              className="input mt-1"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Asset class
            <select name="assetClass" className="input mt-1" defaultValue="">
              <option value="">—</option>
              <option value="stock">stock</option>
              <option value="etf">etf</option>
              <option value="other">other</option>
            </select>
          </label>
        </div>

        <label className="block text-xs text-[var(--muted)]">
          Tags (comma-separated)
          <input
            name="tags"
            className="input mt-1"
            placeholder="research, sample"
          />
        </label>

        <label className="block text-xs text-[var(--muted)]">
          Sources (one per line: url or title|url)
          <textarea
            name="sources"
            rows={3}
            className="input mt-1 font-mono text-xs"
            placeholder={"Issuer page|https://example.com\nhttps://sec.gov/..."}
          />
        </label>

        <label className="block text-xs text-[var(--muted)]">
          Body (markdown) *
          <textarea
            name="body"
            required
            rows={16}
            className="input mt-1 font-mono text-xs leading-relaxed"
            placeholder={`# TICKER — Full Name\n**Research date:** ...\n**Type:** ...\n...`}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="submit" className="btn-primary">
            Save memo
          </button>
        </div>
      </form>
    </div>
  );
}
