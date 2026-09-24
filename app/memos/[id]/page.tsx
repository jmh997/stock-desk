import Link from "next/link";
import { notFound } from "next/navigation";
import { MemoMarkdown } from "@/components/MemoMarkdown";
import { getMemo } from "@/lib/actions";
import { memoDisplayTitle, type Memo } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function MemoDetailPage({ params }: Props) {
  const { id } = await params;
  let memo: Memo | null = null;
  try {
    memo = await getMemo(id);
  } catch {
    notFound();
  }
  if (!memo) notFound();

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            {memo.assetClass || "memo"} · {memo.researchDate}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {memoDisplayTitle(memo)}
          </h1>
          {memo.tags?.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {memo.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[0.7rem] text-[var(--muted)]"
                >
                  {t}
                </span>
              ))}
            </p>
          )}
        </div>
        <Link href="/memos" className="btn-ghost">
          ← Memos
        </Link>
      </div>

      <div className="card p-4 sm:p-5">
        <MemoMarkdown body={memo.body} />
      </div>

      {memo.sources && memo.sources.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold">Sources (structured)</h2>
          <ul className="space-y-1 text-sm">
            {memo.sources.map((s, i) => (
              <li key={i}>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#60a5fa] underline"
                  >
                    {s.title || s.url}
                  </a>
                ) : (
                  <span>{s.title}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
