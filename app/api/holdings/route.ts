import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { holdings } from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { normalizeTicker } from "@/lib/quotes";

export async function GET() {
  try {
    await ensureSchema();
    const db = getDb();
    const rows = await db.select().from(holdings).orderBy(holdings.ticker);
    return NextResponse.json({ holdings: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticker = normalizeTicker(String(body.ticker || ""));
    const shares = Number(body.shares);
    const avgCost =
      body.avgCost === undefined || body.avgCost === null || body.avgCost === ""
        ? null
        : Number(body.avgCost);

    if (!ticker || !Number.isFinite(shares) || shares <= 0) {
      return NextResponse.json(
        { error: "ticker and positive shares required" },
        { status: 400 },
      );
    }

    await ensureSchema();
    const db = getDb();
    const row = {
      id: newId("hld"),
      ticker,
      shares,
      avgCost: avgCost != null && Number.isFinite(avgCost) ? avgCost : null,
      createdAt: nowIso(),
    };
    await db.insert(holdings).values(row);
    return NextResponse.json({ holding: row }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = String(req.nextUrl.searchParams.get("id") || "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await ensureSchema();
    const db = getDb();
    await db.delete(holdings).where(eq(holdings.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
