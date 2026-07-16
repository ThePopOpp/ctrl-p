import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LegalDoc = { title: string; lastUpdated: string; body: string };

/**
 * Loads a legal markdown doc from /docs at build time (these pages are static),
 * strips publisher HTML comments, and rewrites the canonical cross-links to the
 * app's own routes. Title and "Last Updated" are lifted out for the page header.
 */
export function loadLegalDoc(file: string): LegalDoc {
  const raw = readFileSync(join(process.cwd(), "docs", file), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/https:\/\/controlp\.io\/privacy-policy\/?/g, "/privacy")
    .replace(/https:\/\/controlp\.io\/terms-of-service\/?/g, "/terms")
    .trim();

  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  const lastUpdated = raw.match(/\*\*Last Updated:\s*(.+?)\*\*/)?.[1]?.trim() ?? "";
  const body = raw
    .replace(/^#\s+.+$/m, "")
    .replace(/\*\*Last Updated:.*?\*\*/, "")
    .trim();

  return { title, lastUpdated, body };
}
