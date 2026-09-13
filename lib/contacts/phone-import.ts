// Import contacts straight off a phone.
//
// Ported from Channel Cast (lib/crm/phone-import.ts) and mapped onto Ctrl+P,
// where a contact is a customer account in `users`. Three routes arrive at the
// same review screen:
//
//   1. The Contact Picker API (`navigator.contacts`) — Chrome on Android opens
//      the OS contact sheet and returns structured data. No export, no file.
//   2. A vCard (.vcf) file — what every phone's Contacts app exports; the
//      fallback for iOS, desktop and Firefox.
//   3. Neither, because they're on a laptop — the UI shows a QR code that
//      reopens the page on the phone, where route 1 works.
//
// Everything here is pure (parsing, matching, merging) so the browser dialog
// and the server route share the exact same rules and it can be unit-tested.

/** A parsed person, not yet saved. */
export type ContactDraft = {
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  sms: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  photoUrl?: string;
  /** Anything a phone stores that has no column here (birthday, other numbers…). */
  details: Record<string, string>;
};

/** An existing Ctrl+P contact (a `users` row) as far as matching needs it. */
export type ExistingContact = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role?: string | null;
};

export type ImportCandidate = {
  /** Stable key for React lists and selection (drafts have no id yet). */
  key: string;
  draft: ContactDraft;
  duplicateOf: ExistingContact | null;
  matchedOn: "email" | "phone" | "name" | null;
};

export const PHONE_IMPORT_SOURCE = "Phone";

/** The placeholder domain the CSV import already uses for contacts without an email. */
const PLACEHOLDER_DOMAIN = "import.controlp.io";

type Named = { name?: string | null; firstName?: string; lastName?: string; email?: string | null; phone?: string | null; full_name?: string | null };
function displayName(c: Named): string {
  return c.name?.trim() || c.full_name?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim()
    || (c.email && !isPlaceholderEmail(c.email) ? c.email.trim() : "") || c.phone?.trim() || "Unnamed";
}

// ── Contact Picker API ────────────────────────────────────────────────────────

export type ContactPickerAddress = { addressLine?: string[]; city?: string; region?: string; postalCode?: string; country?: string };
export type ContactPickerResult = { name?: string[]; email?: string[]; tel?: string[]; address?: ContactPickerAddress[]; icon?: Blob[] };
type ContactsManager = {
  getProperties(): Promise<string[]>;
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactPickerResult[]>;
};

export function contactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  if (!nav.contacts || typeof nav.contacts.select !== "function") return null;
  // `ContactsManager` on window is the spec's own feature-detection hint.
  if (typeof window !== "undefined" && !("ContactsManager" in window)) return null;
  return nav.contacts;
}

/** Can this browser open the OS contact sheet? Chrome on Android, over HTTPS. */
export const contactPickerSupported = () => contactsManager() !== null;

export function fromPicked(picked: ContactPickerResult): ContactDraft {
  const draft = blankDraft();
  draft.email = (picked.email ?? []).map((e) => e.trim()).find(Boolean) ?? "";
  const name = (picked.name ?? []).map((n) => n.trim()).find(Boolean) ?? "";
  if (name) applyName(draft, name);

  const tels = (picked.tel ?? []).map((t) => t.trim()).filter(Boolean);
  draft.phone = tels[0] ?? "";
  // A second number is almost always the mobile; keep it rather than drop it.
  if (tels[1]) draft.sms = tels[1];

  const addr = (picked.address ?? [])[0];
  if (addr) {
    draft.address = (addr.addressLine ?? []).filter(Boolean).join(", ");
    draft.city = addr.city ?? "";
    draft.state = addr.region ?? "";
    draft.zip = addr.postalCode ?? "";
    if (addr.country) draft.details.Country = addr.country;
  }
  draft.name = displayName(draft);
  return draft;
}

// ── vCard parsing ─────────────────────────────────────────────────────────────

type VLine = { name: string; params: Record<string, string[]>; value: string };

/** Rejoin RFC 2426 folded lines and vCard 2.1 quoted-printable soft breaks. */
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const prev = out.length ? out[out.length - 1] : null;
    if (prev !== null && /^[ \t]/.test(line)) {
      out[out.length - 1] = prev + line.slice(1);
    } else if (prev !== null && prev.endsWith("=") && /ENCODING=QUOTED-PRINTABLE/i.test(prev)) {
      out[out.length - 1] = prev.slice(0, -1) + line;
    } else {
      out.push(line);
    }
  }
  return out;
}

function splitUnquoted(s: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of s) {
    if (ch === '"') { quoted = !quoted; cur += ch; }
    else if (ch === sep && !quoted) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function parseLine(line: string): VLine | null {
  let colon = -1;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) { colon = i; break; }
  }
  if (colon < 0) return null;

  const segments = splitUnquoted(line.slice(0, colon), ";");
  let name = segments[0].trim();
  if (name.includes(".")) name = name.slice(name.indexOf(".") + 1); // drop "item1." group prefixes
  if (!name) return null;

  const params: Record<string, string[]> = {};
  const push = (k: string, v: string) => { (params[k] ||= []).push(v); };
  for (const seg of segments.slice(1)) {
    const eq = seg.indexOf("=");
    if (eq < 0) push("type", seg.trim().toUpperCase()); // vCard 2.1 bare params: TEL;CELL;VOICE
    else {
      const key = seg.slice(0, eq).trim().toLowerCase();
      for (const v of splitUnquoted(seg.slice(eq + 1), ",")) push(key, v.replace(/^"|"$/g, "").trim().toUpperCase());
    }
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i));
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

function rawValue(line: VLine): string {
  const enc = (line.params.encoding ?? []).join(" ");
  return /QUOTED-PRINTABLE/i.test(enc) ? decodeQuotedPrintable(line.value) : line.value;
}

function decodeValue(line: VLine): string {
  return rawValue(line).replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

/** Split a structured value (N, ADR, ORG) on unescaped semicolons. */
function components(line: VLine): string[] {
  const raw = rawValue(line);
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      cur += raw[i + 1] === "n" || raw[i + 1] === "N" ? "\n" : raw[i + 1];
      i++;
    } else if (raw[i] === ";") { parts.push(cur); cur = ""; }
    else cur += raw[i];
  }
  parts.push(cur);
  return parts.map((p) => p.trim());
}

const typesOf = (line: VLine) => (line.params.type ?? []).map((t) => t.toUpperCase());
const isMobile = (line: VLine) => typesOf(line).some((t) => t === "CELL" || t === "MOBILE");

/** Contact photos ride along as base64. Skip the huge ones. */
const MAX_PHOTO_CHARS = 120_000;

function photoDataUrl(line: VLine): string | null {
  const value = line.value.replace(/\s/g, "");
  if (!value || value.length > MAX_PHOTO_CHARS) return null;
  if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return value;
  const type = (line.params.type ?? []).map((t) => t.toLowerCase()).find((t) => /^(jpeg|jpg|png|gif|webp)$/.test(t));
  const mime = type ? `image/${type === "jpg" ? "jpeg" : type}` : "image/jpeg";
  return `data:${mime};base64,${value}`;
}

const KNOWN_FIELDS = new Set([
  "BEGIN", "END", "VERSION", "FN", "N", "ORG", "TITLE", "ROLE", "TEL", "EMAIL",
  "ADR", "URL", "NOTE", "PHOTO", "BDAY", "NICKNAME", "CATEGORIES", "PRODID", "REV", "UID",
]);

/** Parse a .vcf file — one card or many, vCard 2.1 / 3.0 / 4.0. */
export function parseVCards(text: string): ContactDraft[] {
  const drafts: ContactDraft[] = [];
  let current: VLine[] | null = null;

  for (const raw of unfold(text)) {
    const line = parseLine(raw);
    if (!line) continue;
    if (line.name === "BEGIN" && /VCARD/i.test(line.value)) { current = []; continue; }
    if (line.name === "END" && /VCARD/i.test(line.value)) {
      if (current) { const draft = buildDraft(current); if (draft) drafts.push(draft); }
      current = null;
      continue;
    }
    current?.push(line);
  }
  // A file that never closed its last card still has a usable person in it.
  if (current) { const draft = buildDraft(current); if (draft) drafts.push(draft); }
  return drafts;
}

function buildDraft(lines: VLine[]): ContactDraft | null {
  const draft = blankDraft();
  const details: Record<string, string> = {};
  const extraTels: string[] = [];
  const extraEmails: string[] = [];
  let fn = "";
  let org = "";
  let department = "";

  for (const line of lines) {
    switch (line.name) {
      case "FN":
        fn = decodeValue(line);
        break;
      case "N": {
        const [last, first, middle, prefix, suffix] = components(line);
        draft.firstName = first || "";
        draft.lastName = last || "";
        draft.name = [prefix, first, middle, last, suffix].filter(Boolean).join(" ").trim();
        break;
      }
      case "ORG": {
        const [company, dept] = components(line);
        org = company || "";
        department = dept || "";
        break;
      }
      case "TITLE":
      case "ROLE":
        if (!draft.title) draft.title = decodeValue(line);
        break;
      case "TEL": {
        const tel = decodeValue(line);
        if (!tel) break;
        if (isMobile(line)) {
          // The mobile is the number you'd actually text — promote it.
          if (draft.phone && draft.phone !== tel) extraTels.push(draft.phone);
          draft.phone = tel;
          draft.sms = tel;
        } else if (!draft.phone) draft.phone = tel;
        else if (tel !== draft.phone) extraTels.push(tel);
        break;
      }
      case "EMAIL": {
        const email = decodeValue(line);
        if (!email) break;
        if (!draft.email) draft.email = email;
        else if (email !== draft.email) extraEmails.push(email);
        break;
      }
      case "ADR": {
        if (draft.city || draft.address) break;
        const [, , street, city, region, postal, country] = components(line);
        draft.address = street || "";
        draft.city = city || "";
        draft.state = region || "";
        draft.zip = postal || "";
        if (country) details.Country = country;
        break;
      }
      case "URL":
        if (!draft.website) draft.website = decodeValue(line);
        break;
      case "NOTE": {
        const note = decodeValue(line);
        if (note) draft.notes = [draft.notes, note].filter(Boolean).join("\n");
        break;
      }
      case "PHOTO": {
        const url = photoDataUrl(line);
        if (url && !draft.photoUrl) draft.photoUrl = url;
        break;
      }
      case "BDAY":
        details.Birthday = decodeValue(line);
        break;
      case "NICKNAME":
        details.Nickname = decodeValue(line);
        break;
      default: {
        if (KNOWN_FIELDS.has(line.name)) break;
        const value = decodeValue(line);
        // X-ANDROID-CUSTOM carries the phone's own bookkeeping — noise, not data.
        if (!value || line.name.startsWith("X-ANDROID")) break;
        details[prettyKey(line.name)] = value;
      }
    }
  }

  draft.company = org;
  if (department) details.Department = department;
  if (extraTels.length) details["Other phones"] = extraTels.join(", ");
  if (extraEmails.length) details["Other emails"] = extraEmails.join(", ");
  draft.details = details;

  // FN wins over the assembled N — it's what the phone displays.
  if (fn) draft.name = fn;
  if (!draft.firstName && !draft.lastName && draft.name) applyName(draft, draft.name);
  draft.name = displayName(draft);
  // No name, no email and no number isn't a person, it's a stub.
  return draft.name === "Unnamed" ? null : draft;
}

function prettyKey(name: string): string {
  return name.replace(/^X-/i, "").split(/[-_]/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export function blankDraft(): ContactDraft {
  return {
    name: "", firstName: "", lastName: "", title: "", company: "", email: "", phone: "", sms: "",
    website: "", address: "", city: "", state: "", zip: "", notes: "", details: {},
  };
}

function applyName(draft: ContactDraft, full: string) {
  draft.name = full;
  const parts = full.split(/\s+/).filter(Boolean);
  draft.firstName = parts[0] ?? "";
  draft.lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
}

/** Phone numbers for comparison only: last 10 digits, so formatting and country code don't matter. */
export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** How Ctrl+P stores phone numbers (matches /api/admin/users). */
export const normalizePhone = (phone: string | null | undefined) => (phone ?? "").trim().replace(/[^\d+]/g, "");

export const isPlaceholderEmail = (email: string | null | undefined) =>
  Boolean(email && email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`));

/** Same placeholder the CSV import creates, so a phone-only contact imported twice is still one person. */
export function placeholderEmailFor(phone: string | null | undefined): string | null {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return digits.length >= 7 ? `no-email-${digits}@${PLACEHOLDER_DOMAIN}` : null;
}

export const isValidEmail = (email: string | null | undefined) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email ?? "").trim());

const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");

/** Find the existing contact this draft duplicates. Email, then phone, then name. */
export function findDuplicate(
  draft: ContactDraft,
  existing: ExistingContact[],
): { contact: ExistingContact; matchedOn: "email" | "phone" | "name" } | null {
  const email = draft.email.trim().toLowerCase();
  if (email) {
    const hit = existing.find((c) => c.email?.trim().toLowerCase() === email);
    if (hit) return { contact: hit, matchedOn: "email" };
  }
  for (const number of [draft.phone, draft.sms]) {
    const key = phoneKey(number);
    if (key.length < 10) continue;
    const hit = existing.find((c) => phoneKey(c.phone) === key);
    if (hit) return { contact: hit, matchedOn: "phone" };
  }
  const name = nameKey(draft.name);
  if (name.length > 3) {
    const hit = existing.find((c) => nameKey(displayName(c)) === name);
    if (hit) return { contact: hit, matchedOn: "name" };
  }
  return null;
}

/**
 * Turn drafts into reviewable candidates: de-duplicated against each other
 * (phones often hold the same person once per synced account) and matched
 * against the contacts already in Ctrl+P.
 */
export function toCandidates(drafts: ContactDraft[], existing: ExistingContact[]): ImportCandidate[] {
  const seen = new Set<string>();
  const candidates: ImportCandidate[] = [];
  drafts.forEach((draft, i) => {
    const identity = draft.email.trim().toLowerCase() || phoneKey(draft.phone) || nameKey(draft.name);
    if (identity && seen.has(identity)) return;
    if (identity) seen.add(identity);
    const dup = findDuplicate(draft, existing);
    candidates.push({ key: `${identity || "row"}-${i}`, draft, duplicateOf: dup?.contact ?? null, matchedOn: dup?.matchedOn ?? null });
  });
  return candidates;
}

/**
 * Ctrl+P has no title, website or address columns on a contact, so those — and
 * anything else the phone stored — are kept as readable notes rather than lost.
 */
export function draftNotes(draft: ContactDraft): string {
  const address = [draft.address, [draft.city, draft.state].filter(Boolean).join(", "), draft.zip].filter(Boolean).join(" ").trim();
  const lines = [
    draft.title && `Title: ${draft.title}`,
    draft.website && `Website: ${draft.website}`,
    address && `Address: ${address}`,
    draft.sms && normalizePhone(draft.sms) !== normalizePhone(draft.phone) && `Mobile: ${draft.sms}`,
    ...Object.entries(draft.details ?? {}).map(([key, value]) => `${key}: ${value}`),
  ].filter(Boolean) as string[];
  const body = [draft.notes.trim(), lines.join("\n")].filter(Boolean).join("\n\n");
  return body ? `Imported from phone\n${body}` : "";
}

export type ContactColumns = {
  full_name: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  profile_photo_url: string | null;
};

/**
 * What a phone record adds to an existing contact: blanks only, never an
 * overwrite. Email, role and status are never part of the patch — what's in
 * Ctrl+P was entered by a person and outranks a phone book.
 */
export function fillBlanks(existing: Partial<ContactColumns>, draft: ContactDraft): Partial<ContactColumns> {
  const patch: Partial<ContactColumns> = {};
  const blank = (value: string | null | undefined) => !value || !value.trim();
  const name = displayName({ name: draft.name, firstName: draft.firstName, lastName: draft.lastName });
  if (blank(existing.full_name) && name !== "Unnamed") patch.full_name = name;
  const phone = normalizePhone(draft.phone || draft.sms);
  if (blank(existing.phone) && phone.replace(/\D/g, "").length >= 7) patch.phone = phone;
  if (blank(existing.company) && draft.company.trim()) patch.company = draft.company.trim();
  const notes = draftNotes(draft);
  if (blank(existing.notes) && notes) patch.notes = notes;
  if (blank(existing.profile_photo_url) && draft.photoUrl) patch.profile_photo_url = draft.photoUrl;
  return patch;
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Coerce untrusted input (a request body) into a draft, or null if it isn't a usable person. */
export function sanitizeDraft(input: unknown): ContactDraft | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const draft: ContactDraft = {
    name: text(raw.name, 200),
    firstName: text(raw.firstName, 100),
    lastName: text(raw.lastName, 100),
    title: text(raw.title, 200),
    company: text(raw.company, 200),
    email: text(raw.email, 320).toLowerCase(),
    phone: text(raw.phone, 40),
    sms: text(raw.sms, 40),
    website: text(raw.website, 500),
    address: text(raw.address, 300),
    city: text(raw.city, 100),
    state: text(raw.state, 100),
    zip: text(raw.zip, 20),
    notes: text(raw.notes, 4000),
    details: {},
  };
  const photo = text(raw.photoUrl, MAX_PHOTO_CHARS);
  if (photo && (/^data:image\/(jpeg|png|gif|webp);base64,/i.test(photo) || /^https:\/\//i.test(photo))) draft.photoUrl = photo;
  if (raw.details && typeof raw.details === "object") {
    for (const [key, value] of Object.entries(raw.details as Record<string, unknown>).slice(0, 30)) {
      const k = text(key, 60);
      const v = text(value, 500);
      if (k && v) draft.details[k] = v;
    }
  }
  if (draft.email && !isValidEmail(draft.email)) draft.email = "";
  draft.name = displayName(draft);
  return draft.name === "Unnamed" ? null : draft;
}
