// Small, shared rules for digital business cards: slugs, tracked tag/QR URLs,
// logo sizing, and the links a logo or profile photo may open. Pure so the
// builder, the public card, and the API agree and it can be unit-tested.

/** NFC statuses the builder and API accept. "programmed" is set after a successful write. */
export const NFC_STATUSES = ["not_ordered", "ordered", "assigned", "programmed", "shipped"] as const;
export type NfcStatus = (typeof NFC_STATUSES)[number];
export const isNfcStatus = (value: unknown): value is NfcStatus => typeof value === "string" && (NFC_STATUSES as readonly string[]).includes(value);

/**
 * Card slug from a name. An email address keeps only the part before "@", so a
 * card named jw@controlp.io gets /c/jw instead of /c/jw-controlp-io.
 */
export function cardSlugify(value: string, max = 64): string {
  const text = String(value || "").trim();
  const local = text.includes("@") ? text.slice(0, text.indexOf("@")) : text;
  return local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}

export type TrackedSource = "nfc" | "qr";

/** The public URL with ?source=nfc|qr, so taps and scans are counted separately from plain views. */
export function trackedCardUrl(publicUrl: string, source: TrackedSource): string {
  try {
    const url = new URL(publicUrl);
    url.searchParams.set("source", source);
    return url.toString();
  } catch {
    const [base, hash] = publicUrl.split("#");
    const cleaned = base.replace(/([?&])source=[^&]*(&|$)/, (_match, lead: string, tail: string) => (tail ? lead : "")).replace(/[?&]$/, "");
    return `${cleaned}${cleaned.includes("?") ? "&" : "?"}source=${source}${hash ? `#${hash}` : ""}`;
  }
}

export const LOGO_HEIGHT = { min: 16, max: 160, fallback: 48 } as const;
export const LOGO_WIDTH = { max: 320 } as const;

const clampInt = (value: unknown, min: number, max: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
};

/** Logo sizing from media_settings. Cards that never set a size keep the original 48px × 140px bounds. */
export function logoSizing(settings: unknown): { height: number; maxWidth: number; custom: boolean } {
  const source = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const height = source.logo_height === undefined ? null : clampInt(source.logo_height, LOGO_HEIGHT.min, LOGO_HEIGHT.max);
  const width = source.logo_width === undefined ? null : clampInt(source.logo_width, 0, LOGO_WIDTH.max);
  return { height: height ?? LOGO_HEIGHT.fallback, maxWidth: width ?? 0, custom: height !== null || width !== null };
}

/** Inline style for the logo image; object-contain keeps its aspect ratio so it never stretches. */
export function logoStyle(settings: unknown): { height?: number; maxHeight?: number; width: "auto"; maxWidth: number | string } {
  const sizing = logoSizing(settings);
  if (!sizing.custom) return { maxHeight: LOGO_HEIGHT.fallback, width: "auto", maxWidth: 140 };
  return { height: sizing.height, width: "auto", maxWidth: sizing.maxWidth > 0 ? sizing.maxWidth : "100%" };
}

/** A link a logo or photo may open: http(s) only, with https:// added when the scheme is missing. */
export function safeCardHref(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return null;
  return `https://${text.replace(/^\/+/, "")}`;
}
