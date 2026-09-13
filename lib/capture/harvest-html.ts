// ─── Capture — server-side harvest from fetched HTML ────────────────────────
//
// The web-app fallback path (spec §4.4). Runs on the server with no DOM, so it
// parses the markup directly.
//
// LIMITS, and they matter:
//  · No JavaScript executes, so client-rendered pages yield little. Swap this
//    for a Playwright worker on the VPS when that becomes the common case — it
//    only has to produce a RawHarvest, everything downstream is unchanged.
//  · This connection is NOT authenticated to any dealer portal, so gated
//    wholesale cost is invisible to it. That is by design: the alternative is
//    storing vendor portal credentials, which is worse. The extension borrows
//    the staff member's own live session instead.
//
// Single URL, staff-initiated, no crawling, no link-following. See
// reference/vendors.md — 4Over and B2Sign are reseller partners.

import type { RawHarvest, RawImage, RawTable } from "@/lib/capture/types";

const TAG = {
  script: /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  meta: /<meta\b([^>]*?)\/?>/gi,
  title: /<title[^>]*>([\s\S]*?)<\/title>/i,
  table: /<table\b[^>]*>([\s\S]*?)<\/table>/gi,
  row: /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,
  cell: /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi,
  dl: /<dl\b[^>]*>([\s\S]*?)<\/dl>/gi,
  dt: /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi,
  img: /<img\b([^>]*?)\/?>/gi,
  select: /<select\b([^>]*)>([\s\S]*?)<\/select>/gi,
  option: /<option\b[^>]*>([\s\S]*?)<\/option>/gi,
  itemprop: /<[a-z]+\b[^>]*\bitemprop\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\//gi,
};

/** Read an HTML tag's attributes without caring what order they came in. */
function attributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? match[5] ?? "");
  }
  return attrs;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[String(name).toLowerCase()] ?? whole);
}

function safeCodePoint(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function absolute(url: string, base: string): string {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

// ─── Harvest ────────────────────────────────────────────────────────────────

export function harvestHtml(html: string, url: string): RawHarvest {
  const body = html.replace(/<!--[\s\S]*?-->/g, "");

  return {
    url,
    pageTitle: stripTags(TAG.title.exec(body)?.[1] ?? ""),
    jsonLd: extractJsonLd(body),
    openGraph: extractMeta(body),
    microdata: extractMicrodata(body),
    tables: extractTables(body),
    definitions: extractDefinitions(body),
    images: extractImages(body, url),
    selects: extractSelects(body),
    text: extractText(body),
  };
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  TAG.script.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG.script.exec(html)) !== null) {
    const type = attributes(match[1]).type ?? "";
    if (!/ld\+json/i.test(type)) continue;
    try {
      blocks.push(JSON.parse(decodeEntities(match[2].trim())));
    } catch {
      // A malformed block on a vendor page is not our problem to fix; the
      // other tiers still run.
    }
  }
  return blocks;
}

function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  TAG.meta.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG.meta.exec(html)) !== null) {
    const attrs = attributes(match[1]);
    const key = attrs.property ?? attrs.name ?? "";
    const content = attrs.content;
    if (!key || !content) continue;

    const normalised = key.toLowerCase().replace(/^(og|twitter|product):/, "");
    if (key.toLowerCase().startsWith("og:") || key.toLowerCase().startsWith("twitter:") || key.toLowerCase().startsWith("product:")) {
      if (!meta[normalised]) meta[normalised] = content;
    } else if (normalised === "description" && !meta.description) {
      meta.description = content;
    }
  }
  return meta;
}

function extractMicrodata(html: string): Record<string, string> {
  const data: Record<string, string> = {};
  TAG.itemprop.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG.itemprop.exec(html)) !== null) {
    const key = match[1].trim();
    if (data[key]) continue;
    const inner = stripTags(match[2]);
    // itemprop on a meta/link tag carries the value in `content`/`href`.
    const attrs = attributes(match[0].slice(0, match[0].indexOf(">")));
    const value = inner || attrs.content || attrs.href || "";
    if (value) data[key] = value;
  }
  return data;
}

function extractTables(html: string): RawTable[] {
  const tables: RawTable[] = [];
  TAG.table.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG.table.exec(html)) !== null) {
    const inner = match[1];
    const rows: string[][] = [];
    let headers: string[] = [];

    TAG.row.lastIndex = 0;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = TAG.row.exec(inner)) !== null) {
      const cells: string[] = [];
      let isHeaderRow = false;

      TAG.cell.lastIndex = 0;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = TAG.cell.exec(rowMatch[1])) !== null) {
        if (cellMatch[1].toLowerCase() === "th") isHeaderRow = true;
        cells.push(stripTags(cellMatch[2]));
      }
      if (!cells.length) continue;

      // The first all-<th> row is the header; a table with no <th> uses its
      // first row instead, which is what most vendor tables actually do.
      if (isHeaderRow && !headers.length) headers = cells;
      else rows.push(cells);
    }

    if (!headers.length && rows.length > 1) headers = rows.shift() as string[];
    if (headers.length && rows.length) tables.push({ headers, rows });
  }
  return tables;
}

function extractDefinitions(html: string): Array<{ term: string; definition: string }> {
  const pairs: Array<{ term: string; definition: string }> = [];

  TAG.dl.lastIndex = 0;
  let dlMatch: RegExpExecArray | null;
  while ((dlMatch = TAG.dl.exec(html)) !== null) {
    TAG.dt.lastIndex = 0;
    let pairMatch: RegExpExecArray | null;
    while ((pairMatch = TAG.dt.exec(dlMatch[1])) !== null) {
      const term = stripTags(pairMatch[1]);
      const definition = stripTags(pairMatch[2]);
      if (term && definition) pairs.push({ term, definition });
    }
  }

  // "Material: 16pt C2S" list items are the other common spec shape.
  const listItems = html.match(/<li\b[^>]*>([\s\S]{0,240}?)<\/li>/gi) ?? [];
  for (const item of listItems) {
    const text = stripTags(item);
    const colon = text.indexOf(":");
    if (colon <= 0 || colon > 40) continue;
    const term = text.slice(0, colon).trim();
    const definition = text.slice(colon + 1).trim();
    if (term && definition && definition.length <= 200) pairs.push({ term, definition });
  }

  return pairs.slice(0, 60);
}

function extractImages(html: string, base: string): RawImage[] {
  const images: RawImage[] = [];
  TAG.img.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG.img.exec(html)) !== null) {
    const attrs = attributes(match[1]);
    // Prefer the largest srcset candidate; lazy-loaded pages keep the real
    // source in data-src and leave src as a placeholder.
    const src = largestSrcsetCandidate(attrs.srcset) ?? attrs["data-src"] ?? attrs.src ?? "";
    if (!src) continue;
    images.push({
      src: absolute(src, base),
      alt: attrs.alt,
      width: Number.parseInt(attrs.width ?? "", 10) || undefined,
      height: Number.parseInt(attrs.height ?? "", 10) || undefined,
    });
  }
  return images.slice(0, 60);
}

function largestSrcsetCandidate(srcset?: string): string | null {
  if (!srcset) return null;
  const candidates = srcset
    .split(",")
    .map((entry) => entry.trim().split(/\s+/))
    .map(([url, descriptor]) => ({ url, weight: Number.parseFloat(descriptor ?? "0") || 0 }))
    .filter((c) => c.url);
  if (!candidates.length) return null;
  return candidates.reduce((best, c) => (c.weight > best.weight ? c : best), candidates[0]).url;
}

function extractSelects(html: string): Array<{ label: string; options: string[] }> {
  const selects: Array<{ label: string; options: string[] }> = [];
  TAG.select.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG.select.exec(html)) !== null) {
    const attrs = attributes(match[1]);
    const label = attrs["aria-label"] || attrs.name || attrs.id || "";
    const options: string[] = [];

    TAG.option.lastIndex = 0;
    let optionMatch: RegExpExecArray | null;
    while ((optionMatch = TAG.option.exec(match[2])) !== null) {
      const text = stripTags(optionMatch[1]);
      if (text && !/^(choose|select|please|--)/i.test(text)) options.push(text);
    }

    if (label && options.length) {
      selects.push({ label: humanise(label), options });
    }
  }
  return selects;
}

function humanise(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tier 4 — the whole text layer, for search rather than field mapping. */
function extractText(html: string): string {
  return stripTags(
    html
      .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " "),
  ).slice(0, 200_000);
}
