import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { buildDraft } from "@/lib/capture/extract";
import { harvestHtml } from "@/lib/capture/harvest-html";
import { loadVendors } from "@/lib/products/queries";

export const maxDuration = 60;

const FETCH_TIMEOUT_MS = 20_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

// POST /api/capture/url — the web-app fallback (spec §4.4).
//
// Single URL, staff-initiated. This does not crawl and does not follow links,
// and there is no bulk mode by design — see reference/vendors.md, 4Over and
// B2Sign are reseller partners, not scrape targets.
//
// This path cannot see gated dealer cost. The response says so explicitly in
// `costVisibility` so the UI can explain an empty price rather than leaving
// staff to wonder.
export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const target = parseTarget(body.url);
  if (!target) return jsonError("A valid http(s) URL is required.");

  const db = verified.adminClient;

  const queued = await db
    .from("product_captures")
    .insert({
      captured_by: verified.actorId,
      source_url: target.toString(),
      capture_method: "headless",
      status: "running",
    })
    .select("id")
    .single();

  if (queued.error) return jsonError(queued.error.message, 400);
  const captureId = queued.data.id as string;

  try {
    const html = await fetchHtml(target);
    const harvest = harvestHtml(html, target.toString());
    const draft = buildDraft(harvest);

    const vendors = await loadVendors(db);
    const host = target.hostname.replace(/^www\./, "");
    const vendor = vendors.find((v) => v.domain && host.endsWith(v.domain.replace(/^www\./, ""))) ?? null;

    const costGated = Boolean(vendor?.requires_login) && draft.variants.length === 0;

    await db
      .from("product_captures")
      .update({
        status: "complete",
        vendor_id: vendor?.id ?? null,
        raw_structured_data: { jsonLd: harvest.jsonLd, openGraph: harvest.openGraph, microdata: harvest.microdata },
        detected_price_table: draft.variants.length ? { variants: draft.variants } : null,
        extracted_text: harvest.text.slice(0, 200_000),
        extraction_sources: draft.extractionSources,
        draft,
      })
      .eq("id", captureId);

    return NextResponse.json({
      capture: { id: captureId, status: "complete" },
      draft,
      vendor: vendor ? { id: vendor.id, name: vendor.name, requiresLogin: vendor.requires_login } : null,
      costVisibility: costGated
        ? {
            available: false,
            reason: `${vendor?.name ?? "This vendor"} shows dealer pricing only to authenticated accounts, and this server is not signed in. Capture the page with the CTRL+P extension while you are logged into their portal, or enter the cost by hand.`,
          }
        : { available: draft.variants.length > 0, reason: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture failed.";
    await db.from("product_captures").update({ status: "failed", error_message: message }).eq("id", captureId);
    return NextResponse.json({ capture: { id: captureId, status: "failed" }, error: message }, { status: 502 });
  }
}

function parseTarget(raw?: string): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Refuse to fetch anything that resolves inside our own network.
  if (isPrivateHost(url.hostname)) return null;
  return url;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (/^\[?::1\]?$/.test(host)) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

async function fetchHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify ourselves honestly. A vendor who wants to block this should
        // be able to, and a staff member should be able to explain what it is.
        "user-agent": "CTRL+P-ProductCapture/1.0 (+https://controlp.io; staff-initiated single-page capture)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) throw new Error(`The vendor page returned ${response.status} ${response.statusText}.`);

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      throw new Error(`Expected an HTML page but got "${contentType}".`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) throw new Error("That page is too large to capture.");
    return new TextDecoder("utf-8").decode(buffer);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The vendor page took too long to respond.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
