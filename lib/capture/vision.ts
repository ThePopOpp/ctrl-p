// ─── Capture — Tier 3 vision extraction ─────────────────────────────────────
//
// Sends the screenshot to a vision model with a strict schema, for whatever
// tiers 1 and 2 did not supply. The model is instructed to return null rather
// than guess, and every value it returns is badged `extracted` in the review
// form so staff know it was inferred from a picture.
//
// It must never invent a price. `sanitiseVision` enforces that on the way back
// regardless of what the model said.

import Anthropic from "@anthropic-ai/sdk";

import { VISION_JSON_SCHEMA, VISION_SYSTEM_PROMPT } from "@/lib/capture/extract";
import type { VisionExtraction } from "@/lib/capture/types";

const MODEL = "claude-sonnet-5";

/**
 * Returns null when vision is unavailable or unusable — the caller falls back
 * to whatever tiers 1-2 produced and staff fill the rest in by hand. A failed
 * vision pass must never fail the capture.
 */
export async function runVisionExtraction(
  screenshotDataUrl: string,
  missingFields: string[],
): Promise<VisionExtraction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const parsed = parseDataUrl(screenshotDataUrl);
  if (!parsed) return null;

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: parsed.mediaType, data: parsed.data },
            },
            {
              type: "text",
              text: [
                `These fields could not be read from the page markup: ${missingFields.join(", ") || "none"}.`,
                "Extract what you can SEE in the screenshot and return JSON matching this schema:",
                JSON.stringify(VISION_JSON_SCHEMA),
                "Return the JSON object only, with no surrounding prose or code fence.",
              ].join("\n\n"),
            },
          ],
        },
      ],
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    return sanitiseVision(parseJsonLoose(text));
  } catch {
    return null;
  }
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function parseDataUrl(dataUrl: string): { mediaType: ImageMediaType; data: string } | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|gif|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const mediaType = (match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase()) as ImageMediaType;
  return { mediaType, data: match[2] };
}

/** Models sometimes wrap JSON in a fence despite being asked not to. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Coerce the model's output into the schema. Anything that does not fit becomes
 * null — the pipeline treats a missing field as "staff fills this in", which is
 * always safe, whereas a malformed price is not.
 */
export function sanitiseVision(raw: unknown): VisionExtraction | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;

  return {
    title: str(input.title),
    subtitle: str(input.subtitle),
    description: str(input.description),
    sku: str(input.sku),
    specs: stringMap(input.specs),
    priceRows: priceRows(input.priceRows),
    leadTimeDays: positiveInt(input.leadTimeDays),
    confidence: numberMap(input.confidence),
  };
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function stringMap(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const text = str(entry);
    if (key.trim() && text) out[key.trim()] = text;
  }
  return Object.keys(out).length ? out : null;
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof entry === "number" ? entry : Number.parseFloat(String(entry));
    if (Number.isFinite(n)) out[key] = Math.min(1, Math.max(0, n));
  }
  return out;
}

type PriceRow = NonNullable<VisionExtraction["priceRows"]>[number];

function priceRows(value: unknown): VisionExtraction["priceRows"] {
  if (!Array.isArray(value)) return null;

  const rows = value
    .map((entry): PriceRow | null => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const quantity = Number(row.quantity);
      const price = Number(row.price);
      // A zero or negative price is not a discount, it is a misread.
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      if (!Number.isFinite(price) || price <= 0) return null;
      const spec = stringMap(row.spec);
      return spec ? { quantity, price, spec } : { quantity, price };
    })
    .filter((row): row is PriceRow => row !== null);

  return rows.length ? rows : null;
}
