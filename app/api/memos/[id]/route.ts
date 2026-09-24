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

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await ensureSchema();
    const db = getDb();
    const deleted = await db
      .delete(memos)
      .where(eq(memos.id, id))
      .returning({ id: memos.id });
    if (!deleted[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    await ensureSchema();
    const db = getDb();
    const rows = await db.select().from(memos).where(eq(memos.id, id)).limit(1);
    if (!rows[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let starred = rows[0].starred;
    if (typeof body.starred === "boolean") {
      starred = body.starred;
    } else if (body.toggle === true) {
      starred = !rows[0].starred;
    } else {
      return NextResponse.json(
        { error: "Provide starred: boolean or toggle: true" },
        { status: 400 },
      );
    }

    await db.update(memos).set({ starred }).where(eq(memos.id, id));
    return NextResponse.json({ memo: { ...rows[0], starred } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
