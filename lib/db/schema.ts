import { boolean, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

export type MemoSource = { title?: string; url?: string };
export type AssetClass = "stock" | "etf" | "other";

export const memos = pgTable("memos", {
  id: text("id").primaryKey(),
  ticker: text("ticker").notNull(),
  /** Full company / fund name */
  name: text("name").notNull().default(""),
  /** Research date YYYY-MM-DD (America/New_York calendar day) */
  researchDate: text("research_date").notNull(),
  assetClass: text("asset_class").$type<AssetClass | null>(),
  body: text("body").notNull(),
  sources: jsonb("sources").$type<MemoSource[]>().notNull().default([]),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  /** Favorite / star — starred memos sort first */
  starred: boolean("starred").notNull().default(false),
  /** Ingest / row creation timestamp (ISO) */
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export const watchlist = pgTable("watchlist", {
  ticker: text("ticker").primaryKey(),
  addedAt: timestamp("added_at", { mode: "string" }).notNull(),
});

export const holdings = pgTable("holdings", {
  id: text("id").primaryKey(),
  ticker: text("ticker").notNull(),
  shares: real("shares").notNull(),
  avgCost: real("avg_cost"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export type Memo = typeof memos.$inferSelect;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type Holding = typeof holdings.$inferSelect;

/** Display title derived from ticker + name */
export function memoDisplayTitle(memo: {
  ticker: string;
  name?: string | null;
}): string {
  const name = (memo.name || "").trim();
  if (!name) return memo.ticker;
  return `${memo.ticker} — ${name}`;
}
