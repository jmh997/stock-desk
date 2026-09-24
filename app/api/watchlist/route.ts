import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { watchlist } from "@/lib/db/schema";
import { nowIso } from "@/lib/ids";
import { normalizeTicker } from "@/lib/quotes";

export async function GET() {
  try {
    await ensureSchema();
    const db = getDb();
    const rows = await db.select().from(watchlist).orderBy(watchlist.ticker);
    return NextResponse.json({ watchlist: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticker = normalizeTicker(String(body.ticker || ""));
    if (!ticker) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }
    await ensureSchema();
    const db = getDb();
    await db
      .insert(watchlist)
      .values({ ticker, addedAt: nowIso() })
      .onConflictDoNothing();
    return NextResponse.json({ ticker }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ticker = normalizeTicker(
      String(req.nextUrl.searchParams.get("ticker") || ""),
    );
    if (!ticker) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }
    await ensureSchema();
    const db = getDb();
    await db.delete(watchlist).where(eq(watchlist.ticker, ticker));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
