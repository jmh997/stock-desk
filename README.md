# Stock Desk

Personal research desk for Jeremy Hanken (`jmh997`): memos, watchlist, and one portfolio.

Stack mirrors [kitchen](https://github.com/jmh997/kitchen): **Next.js 16.3.3**, React 19, Tailwind v4, Neon + Drizzle. **No Clerk / no auth in v1** (public personal desk). Bot ingest is protected by a shared header key.

## Env vars

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Neon/Postgres connection string |
| `STOCK_DESK_INGEST_KEY` | yes for bots | Shared secret for `POST /api/memos` |
| `FINNHUB_API_KEY` | optional | Quote fallback if Yahoo fails |

Copy `.env.example` → `.env.local` for local dev.

Also accepted aliases for the DB URL (same as kitchen): `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`.

## Database

```bash
npm install
npm run db:push    # drizzle-kit push (preferred locally)
npm run db:seed    # sample AAPL memo + watchlist tickers
```

On Vercel, once `DATABASE_URL` is set, the first request also runs `CREATE TABLE IF NOT EXISTS` via `ensureSchema()` so you can skip a local push if needed. Still prefer `db:push` when you can.

## Dev / build

```bash
npm run dev
npm run build
npm start
```

Build succeeds without `DATABASE_URL` (DB is lazy). Pages show a warning if the DB is missing at runtime.

## Ingest API (Stock Scout → Desk)

`POST /api/memos` requires header `x-stock-desk-key` when `STOCK_DESK_INGEST_KEY` is set. If the env key is unset (bootstrap), POST is allowed without the header.

### Exact curl

```bash
curl -X POST https://YOUR_DOMAIN/api/memos \
  -H "Content-Type: application/json" \
  -H "x-stock-desk-key: $STOCK_DESK_INGEST_KEY" \
  -d '{
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "researchDate": "2026-09-24",
    "assetClass": "stock",
    "body": "# AAPL — Apple Inc.\n**Research date:** Thursday, Sep 24, 2026 (America/New_York)\n**Type:** stock\n**Scope:** Facts and trade-offs only. Not a buy/sell recommendation.\n\n## 1. What it is\n...\n\n## 7. Sources\n...\n\n---\n*Stock Scout · educational research · not investment advice*",
    "sources": [
      { "title": "Apple IR", "url": "https://investor.apple.com/" }
    ],
    "tags": ["research"]
  }'
```

### Request fields

| Field | Required | Notes |
|---|---|---|
| `ticker` | **yes** | Normalized to uppercase |
| `body` | **yes** | Full markdown memo |
| `name` | no | Full company/fund name (list column) |
| `researchDate` | no | `YYYY-MM-DD` (America/New_York calendar day); defaults to today ET |
| `assetClass` | no | `stock` \| `etf` \| `other` |
| `sources` | no | Array of `{ title?, url }` |
| `tags` | no | `string[]` |
| `id` / `createdAt` | no | Internal; auto-generated if omitted |

### Response (201)

```json
{
  "memo": {
    "id": "memo_…",
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "researchDate": "2026-09-24",
    "assetClass": "stock",
    "body": "# AAPL — …",
    "sources": [{ "title": "Apple IR", "url": "https://investor.apple.com/" }],
    "tags": ["research"],
    "createdAt": "2026-09-24T16:00:00.000Z"
  }
}
```

401 if the ingest key is set and the header is missing/wrong. 400 if `ticker` or `body` is missing.

UI writes use **Server Actions** (no ingest key). List view columns: ticker, name, researchDate, assetClass.

## Other API routes

- `GET /api/memos?q=` — list / search
- `GET /api/memos/[id]` — one memo
- `GET|POST|DELETE /api/watchlist` — `POST {ticker}`, `DELETE ?ticker=`
- `GET|POST|DELETE /api/holdings` — `POST {ticker,shares,avgCost?}`, `DELETE ?id=`
- `GET /api/quotes?symbols=AAPL,MSFT` — Yahoo primary, Finnhub optional fallback; ~60s in-memory cache

## Quotes

Server-side Yahoo chart API (no key):

`https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1d&range=5d`

Parses `meta.regularMarketPrice` and previous close for day %. Sets a User-Agent. Optional `FINNHUB_API_KEY` fallback.
