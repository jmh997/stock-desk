"use client";

import { useTransition } from "react";
import { deleteMemoAndRedirect, toggleMemoStar } from "@/lib/actions";

export function MemoActions({
  id,
  starred,
  label,
}: {
  id: string;
  starred: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`star-btn star-btn-lg${starred ? " starred" : ""}`}
        aria-label={starred ? "Unstar memo" : "Star memo"}
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await toggleMemoStar(id);
          });
        }}
      >
        {starred ? "★ Starred" : "☆ Star"}
      </button>
      <button
        type="button"
        className="btn-ghost"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete memo “${label}”? This cannot be undone.`)) {
            return;
          }
          startTransition(async () => {
            await deleteMemoAndRedirect(id);
          });
        }}
      >
        Delete
      </button>
    </div>
  );
}
