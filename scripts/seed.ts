/**
 * Seed sample memo + optional watchlist tickers.
 * Usage: DATABASE_URL=... npm run db:seed
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/db/schema";
import { memos, watchlist } from "../lib/db/schema";

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(url);
const db = drizzle(sql, { schema });

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS memos (
      id text PRIMARY KEY,
      ticker text NOT NULL,
      name text NOT NULL DEFAULT '',
      research_date text NOT NULL,
      asset_class text,
      body text NOT NULL,
      sources jsonb NOT NULL DEFAULT '[]'::jsonb,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamp NOT NULL
    )
  `;
  await sql`ALTER TABLE memos ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE memos ADD COLUMN IF NOT EXISTS research_date text`;
  await sql`ALTER TABLE memos ADD COLUMN IF NOT EXISTS asset_class text`;
  await sql`ALTER TABLE memos ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await sql`
    CREATE TABLE IF NOT EXISTS watchlist (
      ticker text PRIMARY KEY,
      added_at timestamp NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS holdings (
      id text PRIMARY KEY,
      ticker text NOT NULL,
      shares real NOT NULL,
      avg_cost real,
      created_at timestamp NOT NULL
    )
  `;
}

const SAMPLE_BODY = `# AAPL — Apple Inc.

**Research date:** Thursday, Sep 24, 2026 (America/New_York)  
**Type:** stock  
**Scope:** Facts and trade-offs only. Not a buy/sell recommendation.

## 1. What it is
- Consumer electronics and services company (iPhone, Mac, services ecosystem).
- Large-cap U.S. equity; mega-cap tech concentration in broad indices.

## 2. Business / strategy
- Hardware + high-margin services (App Store, iCloud, Apple Music, etc.).
- Ecosystem lock-in and installed base as recurring revenue driver.

## 3. Thesis hooks (arguments someone might cite — not advice)
- Brand strength and pricing power in premium hardware.
- Services mix as margin and retention story.
- Balance sheet and cash generation historically strong.

## 4. Risks
- Product cycle / iPhone dependence.
- Regulatory pressure on App Store / antitrust.
- Valuation and concentration risk in indices.

## 5. Valuation / cost context
- Sample seed only — fill with current multiples / margins from filings.

## 6. Recent catalysts (≈ last 3–6 months)
- Sample placeholder — replace with dated catalysts from primary sources.

## 7. Sources
- Apple investor relations: https://investor.apple.com/
- SEC EDGAR (AAPL filings): https://www.sec.gov/edgar/browse/?CIK=320193

---
*Stock Scout · educational research · not investment advice*
`;

async function main() {
  await ensureTables();
  const now = new Date().toISOString();

  await db
    .insert(memos)
    .values({
      id: "memo_sample_aapl",
      ticker: "AAPL",
      name: "Apple Inc.",
      researchDate: "2026-09-24",
      assetClass: "stock",
      body: SAMPLE_BODY,
      sources: [
        { title: "Apple IR", url: "https://investor.apple.com/" },
        {
          title: "SEC EDGAR",
          url: "https://www.sec.gov/edgar/browse/?CIK=320193",
        },
      ],
      tags: ["sample"],
      createdAt: now,
    })
    .onConflictDoNothing();

  for (const ticker of ["AAPL", "MSFT", "VOO"]) {
    await db
      .insert(watchlist)
      .values({ ticker, addedAt: now })
      .onConflictDoNothing();
  }

  console.log("Seed complete: sample AAPL memo + AAPL/MSFT/VOO watchlist");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
