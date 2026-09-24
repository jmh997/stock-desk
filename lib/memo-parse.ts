import type { AssetClass, MemoSource } from "@/lib/db/schema";

const ASSET_CLASSES = new Set(["stock", "etf", "other"]);

export function parseAssetClass(raw: unknown): AssetClass | null {
  if (raw == null || raw === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (ASSET_CLASSES.has(v)) return v as AssetClass;
  return null;
}

export function parseSources(raw: unknown): MemoSource[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line): MemoSource => {
        if (line.includes("|")) {
          const [title, url] = line.split("|").map((s) => s.trim());
          const out: MemoSource = {};
          if (title) out.title = title;
          if (url) out.url = url;
          return out;
        }
        if (line.startsWith("http")) return { url: line };
        return { title: line };
      })
      .filter((s) => Boolean(s.title || s.url));
  }
  if (!Array.isArray(raw)) return [];
  const out: MemoSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const source: MemoSource = {};
    if (typeof obj.title === "string" && obj.title.trim()) {
      source.title = obj.title.trim();
    }
    if (typeof obj.url === "string" && obj.url.trim()) {
      source.url = obj.url.trim();
    }
    if (source.title || source.url) out.push(source);
  }
  return out;
}

export function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/** Prefer YYYY-MM-DD; accept ISO datetime and take date part. */
export function parseResearchDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayNyDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
