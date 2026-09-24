"use server";

import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureSchema, getDb } from "@/lib/db";
import { holdings, memos, watchlist } from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/ids";
import {
  parseAssetClass,
  parseResearchDate,
  parseSources,
  parseTags,
  todayNyDate,
} from "@/lib/memo-parse";
import { normalizeTicker } from "@/lib/quotes";

export async function addWatchlistTicker(formData: FormData) {
  const ticker = normalizeTicker(String(formData.get("ticker") || ""));
  if (!ticker) return;
  await ensureSchema();
  const db = getDb();
  await db
    .insert(watchlist)
    .values({ ticker, addedAt: nowIso() })
    .onConflictDoNothing();
  revalidatePath("/");
}

export async function removeWatchlistTicker(formData: FormData) {
  const ticker = normalizeTicker(String(formData.get("ticker") || ""));
  if (!ticker) return;
  await ensureSchema();
  const db = getDb();
  await db.delete(watchlist).where(eq(watchlist.ticker, ticker));
  revalidatePath("/");
}

export async function addHolding(formData: FormData) {
  const ticker = normalizeTicker(String(formData.get("ticker") || ""));
  const shares = Number(formData.get("shares"));
  const avgCostRaw = formData.get("avgCost");
  const avgCost =
    avgCostRaw === null || avgCostRaw === "" ? null : Number(avgCostRaw);
  if (!ticker || !Number.isFinite(shares) || shares <= 0) return;
  await ensureSchema();
  const db = getDb();
  await db.insert(holdings).values({
    id: newId("hld"),
    ticker,
    shares,
    avgCost: avgCost != null && Number.isFinite(avgCost) ? avgCost : null,
    createdAt: nowIso(),
  });
  revalidatePath("/");
}

export async function removeHolding(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await ensureSchema();
  const db = getDb();
  await db.delete(holdings).where(eq(holdings.id, id));
  revalidatePath("/");
}

export async function createMemo(formData: FormData) {
  const ticker = normalizeTicker(String(formData.get("ticker") || ""));
  const name = String(formData.get("name") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const researchDate =
    parseResearchDate(formData.get("researchDate")) || todayNyDate();
  const assetClass = parseAssetClass(formData.get("assetClass"));
  const tags = parseTags(String(formData.get("tags") || ""));
  const sources = parseSources(String(formData.get("sources") || ""));

  if (!ticker || !body) {
    throw new Error("ticker and body are required");
  }

  await ensureSchema();
  const db = getDb();
  const id = newId("memo");
  await db.insert(memos).values({
    id,
    ticker,
    name,
    researchDate,
    assetClass,
    body,
    sources,
    tags,
    createdAt: nowIso(),
  });
  revalidatePath("/memos");
  revalidatePath(`/memos/${id}`);
  redirect(`/memos/${id}`);
}

export async function listMemos(q?: string) {
  await ensureSchema();
  const db = getDb();
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    return db
      .select()
      .from(memos)
      .where(
        or(
          ilike(memos.ticker, term),
          ilike(memos.name, term),
          sql`${memos.tags}::text ILIKE ${term}`,
        ),
      )
      .orderBy(desc(memos.researchDate), desc(memos.createdAt));
  }
  return db
    .select()
    .from(memos)
    .orderBy(desc(memos.researchDate), desc(memos.createdAt));
}

export async function getMemo(id: string) {
  await ensureSchema();
  const db = getDb();
  const rows = await db.select().from(memos).where(eq(memos.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listWatchlist() {
  await ensureSchema();
  const db = getDb();
  return db.select().from(watchlist).orderBy(watchlist.ticker);
}

export async function listHoldings() {
  await ensureSchema();
  const db = getDb();
  return db.select().from(holdings).orderBy(holdings.ticker);
}
