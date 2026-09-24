import { desc, ilike, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { memos } from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/ids";
import {
  parseAssetClass,
  parseResearchDate,
  parseSources,
  parseTags,
  todayNyDate,
} from "@/lib/memo-parse";
import { normalizeTicker } from "@/lib/quotes";

function ingestAuthorized(req: NextRequest): boolean {
  const expected = process.env.STOCK_DESK_INGEST_KEY;
  if (!expected) {
    // Bootstrap: allow POST when key not configured yet
    return true;
  }
  const provided = req.headers.get("x-stock-desk-key");
  return provided === expected;
}

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const db = getDb();
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const rows = q
      ? await db
          .select()
          .from(memos)
          .where(
            or(
              ilike(memos.ticker, `%${q}%`),
              ilike(memos.name, `%${q}%`),
              sql`${memos.tags}::text ILIKE ${`%${q}%`}`,
            ),
          )
          .orderBy(
            desc(memos.starred),
            desc(memos.researchDate),
            desc(memos.createdAt),
          )
      : await db
          .select()
          .from(memos)
          .orderBy(
            desc(memos.starred),
            desc(memos.researchDate),
            desc(memos.createdAt),
          );
    return NextResponse.json({ memos: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!ingestAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid x-stock-desk-key" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const ticker = normalizeTicker(String(body.ticker || ""));
    const name = String(body.name || "").trim();
    const memoBody = String(body.body || "").trim();
    const researchDate =
      parseResearchDate(body.researchDate) || todayNyDate();
    const assetClass = parseAssetClass(body.assetClass);
    const sources = parseSources(body.sources);
    const tags = parseTags(body.tags);
    const starred =
      typeof body.starred === "boolean" ? body.starred : false;

    if (!ticker || !memoBody) {
      return NextResponse.json(
        { error: "Required fields: ticker, body" },
        { status: 400 },
      );
    }

    await ensureSchema();
    const db = getDb();
    const id = typeof body.id === "string" && body.id ? body.id : newId("memo");
    const createdAt =
      typeof body.createdAt === "string" && body.createdAt
        ? body.createdAt
        : nowIso();

    const row = {
      id,
      ticker,
      name,
      researchDate,
      assetClass,
      body: memoBody,
      sources,
      tags,
      starred,
      createdAt,
    };
    await db.insert(memos).values(row).onConflictDoNothing();

    return NextResponse.json({ memo: row }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
