import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { memos } from "@/lib/db/schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await ensureSchema();
    const db = getDb();
    const rows = await db.select().from(memos).where(eq(memos.id, id)).limit(1);
    if (!rows[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ memo: rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
