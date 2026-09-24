import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: Db | null = null;
let ensurePromise: Promise<void> | null = null;

function databaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function getSql(): NeonQueryFunction<false, false> {
  return neon(databaseUrl());
}

export function getDb(): Db {
  if (!cachedDb) {
    cachedDb = drizzle(neon(databaseUrl()), { schema });
  }
  return cachedDb;
}

async function createTables() {
  const sql = getSql();
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
  // Upgrade path if an older title-based table already exists
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

/** Idempotent: safe on first request / Vercel once DATABASE_URL is set. */
export function ensureSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = createTables().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}
