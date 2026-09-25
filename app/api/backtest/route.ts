import { NextRequest, NextResponse } from "next/server";
import {
  BacktestValidationError,
  parseBacktestBody,
  runBacktest,
} from "@/lib/backtest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = parseBacktestBody(body);
    const result = await runBacktest(parsed);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BacktestValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
