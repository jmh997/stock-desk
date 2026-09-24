import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/quotes";

export async function GET(req: NextRequest) {
  try {
    const symbolsParam = req.nextUrl.searchParams.get("symbols") || "";
    const symbols = symbolsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (symbols.length === 0) {
      return NextResponse.json(
        { error: "symbols query required, e.g. ?symbols=AAPL,MSFT" },
        { status: 400 },
      );
    }
    const quotes = await getQuotes(symbols);
    return NextResponse.json({ quotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
