import { describe, expect, it } from "vitest";

import {
  draftNotes,
  fillBlanks,
  findDuplicate,
  fromPicked,
  isPlaceholderEmail,
  parseVCards,
  phoneKey,
  placeholderEmailFor,
  sanitizeDraft,
  toCandidates,
  type ContactDraft,
  type ExistingContact,
} from "@/lib/contacts/phone-import";

/** What Android's "Export to .vcf" actually writes: vCard 2.1, quoted-printable. */
const ANDROID_21 = [
  "BEGIN:VCARD",
  "VERSION:2.1",
  "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Nu=C3=B1ez;Jos=C3=A9;;;",
  "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9 Nu=C3=B1ez",
  "ORG;CHARSET=UTF-8:Desert Signs;Install",
  "TITLE:Install Lead",
  "TEL;HOME;VOICE:(480) 555-0110",
  "TEL;CELL;VOICE:+1 480-555-0142",
  "EMAIL;INTERNET:jose@desertsigns.com",
  "ADR;HOME:;;1200 W Camelback Rd;Phoenix;AZ;85013;USA",
  "X-ANDROID-CUSTOM:vnd.android.cursor.item/nickname;Joe;;;;;;;;;;;;;;",
  "NOTE;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Needs fleet wraps=0A=",
  "Prefers texts",
  "END:VCARD",
].join("\r\n");

const VCARD_30 = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Whitfield;Dana;;;",
  "FN:Dana Whitfield",
  "ORG:Oasis Tower Resorts",
  "TEL;TYPE=CELL:+1 (480) 555-0142",
  "EMAIL;TYPE=WORK:dana@oasistower.com",
  "URL:https://oasistower.com",
  "item1.X-ABLabel:Corporate",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Marcus Lee",
  "ORG:Copper Mesa Apartments",
  "TEL:4805550110",
  "NOTE:Wants banners\\, yard signs",
  "END:VCARD",
].join("\n");

const user = (over: Partial<ExistingContact>): ExistingContact => ({ id: "u_x", full_name: null, email: null, phone: null, company: null, role: "customer", ...over });

describe("parseVCards — Android vCard 2.1", () => {
  const [jose] = parseVCards(ANDROID_21);

  it("decodes quoted-printable UTF-8 names", () => {
    expect(jose.name).toBe("José Nuñez");
    expect(jose.firstName).toBe("José");
    expect(jose.lastName).toBe("Nuñez");
  });

  it("prefers the mobile number and keeps the other", () => {
    expect(jose.phone).toBe("+1 480-555-0142");
    expect(jose.sms).toBe("+1 480-555-0142");
    expect(jose.details["Other phones"]).toBe("(480) 555-0110");
  });

  it("splits ORG and maps the address", () => {
    expect(jose.company).toBe("Desert Signs");
    expect(jose.details.Department).toBe("Install");
    expect([jose.address, jose.city, jose.state, jose.zip]).toEqual(["1200 W Camelback Rd", "Phoenix", "AZ", "85013"]);
  });

  it("joins soft line breaks and drops X-ANDROID bookkeeping", () => {
    expect(jose.notes).toBe("Needs fleet wraps\nPrefers texts");
    expect(Object.keys(jose.details).some((k) => /android/i.test(k))).toBe(false);
  });
});

describe("parseVCards — vCard 3.0 and malformed input", () => {
  const drafts = parseVCards(VCARD_30);

  it("reads every card in a multi-card file", () => {
    expect(drafts.map((d) => d.name)).toEqual(["Dana Whitfield", "Marcus Lee"]);
    expect(drafts[0].details.Ablabel).toBe("Corporate");
    expect(drafts[1].notes).toBe("Wants banners, yard signs");
    expect(drafts[1].firstName).toBe("Marcus");
  });

  it("returns nothing for junk and skips empty cards", () => {
    expect(parseVCards("not a vcard")).toEqual([]);
    expect(parseVCards("BEGIN:VCARD\nVERSION:3.0\nEND:VCARD")).toEqual([]);
  });

  it("keeps number-only cards, unclosed cards and folded lines", () => {
    expect(parseVCards("BEGIN:VCARD\nTEL:4805550110\nEND:VCARD")[0].name).toBe("4805550110");
    expect(parseVCards("BEGIN:VCARD\nFN:Wes Okafor\nTEL:9165550155")).toHaveLength(1);
    expect(parseVCards("BEGIN:VCARD\nFN:Priya Nair\nNOTE:Storefront\n  sign\nEND:VCARD")[0].notes).toBe("Storefront sign");
  });
});

describe("fromPicked", () => {
  it("maps the Contact Picker payload", () => {
    const draft = fromPicked({
      name: ["Riley Chen"],
      email: ["riley@summit.co"],
      tel: ["+1 303 555 0166", "3035550100"],
      address: [{ addressLine: ["18 Larimer St", "Unit 4"], city: "Denver", region: "CO", postalCode: "80202" }],
    });
    expect(draft).toMatchObject({ name: "Riley Chen", firstName: "Riley", email: "riley@summit.co", phone: "+1 303 555 0166", sms: "3035550100", address: "18 Larimer St, Unit 4" });
  });
});

describe("matching against Ctrl+P contacts", () => {
  const existing = [
    user({ id: "a", full_name: "Dana Whitfield", email: "dana@oasistower.com", phone: "+14805550142" }),
    user({ id: "b", full_name: "Marcus Lee", email: "no-email-14805550110@import.controlp.io", phone: "4805550110" }),
  ];
  const draft = (over: Partial<ContactDraft>): ContactDraft => ({ ...parseVCards("BEGIN:VCARD\nFN:Someone Else\nEND:VCARD")[0], ...over });

  it("matches email, then phone ignoring formatting, then name", () => {
    expect(findDuplicate(draft({ email: "DANA@oasistower.com" }), existing)?.matchedOn).toBe("email");
    expect(findDuplicate(draft({ phone: "(480) 555-0110" }), existing)?.contact.id).toBe("b");
    expect(findDuplicate(draft({ name: "marcus lee" }), existing)?.matchedOn).toBe("name");
    expect(findDuplicate(draft({ email: "new@example.com" }), existing)).toBeNull();
  });

  it("collapses a person listed twice on the phone", () => {
    const drafts = parseVCards(
      "BEGIN:VCARD\nFN:Tony Bruno\nEMAIL:tony@pizza.com\nEND:VCARD\nBEGIN:VCARD\nFN:Tony Bruno\nEMAIL:tony@pizza.com\nTEL:3125550129\nEND:VCARD",
    );
    expect(toCandidates(drafts, [])).toHaveLength(1);
  });

  it("normalizes phone keys", () => {
    expect(phoneKey("+1 (480) 555-0142")).toBe("4805550142");
    expect(phoneKey("911")).toBe("911");
  });
});

describe("saving rules", () => {
  const [dana] = parseVCards(["BEGIN:VCARD", "FN:Dana Whitfield", "ORG:Oasis Towers LLC", "TITLE:GM", "TEL;TYPE=CELL:+1 480 555 0142", "BDAY:1984-03-02", "END:VCARD"].join("\n"));

  it("fills blanks without overwriting and never touches email, role or status", () => {
    const patch = fillBlanks({ full_name: "Dana W.", phone: null, company: "Oasis Tower Resorts", notes: null, profile_photo_url: null }, dana);
    expect(patch.phone).toBe("+14805550142");
    expect(patch.company).toBeUndefined();
    expect(patch.full_name).toBeUndefined();
    expect(patch.notes).toContain("Birthday: 1984-03-02");
    expect(Object.keys(patch)).not.toEqual(expect.arrayContaining(["email", "role", "status"]));
  });

  it("returns an empty patch when the phone adds nothing", () => {
    expect(fillBlanks({ full_name: "Dana", phone: "+14805550142", company: "Oasis", notes: "Existing", profile_photo_url: "https://x/y.jpg" }, dana)).toEqual({});
  });

  it("keeps fields without a column as readable notes", () => {
    const notes = draftNotes(dana);
    expect(notes.startsWith("Imported from phone")).toBe(true);
    expect(notes).toContain("Title: GM");
  });

  it("uses the same placeholder email as the CSV import", () => {
    expect(placeholderEmailFor("+1 480-555-0142")).toBe("no-email-14805550142@import.controlp.io");
    expect(placeholderEmailFor("911")).toBeNull();
    expect(isPlaceholderEmail("no-email-1@import.controlp.io")).toBe(true);
  });

  it("sanitizes untrusted drafts", () => {
    expect(sanitizeDraft(null)).toBeNull();
    expect(sanitizeDraft({ email: "not-an-email" })).toBeNull();
    const clean = sanitizeDraft({ name: "  Ana  ", email: "ANA@X.COM", photoUrl: "javascript:alert(1)", details: { Birthday: "2000-01-01" } });
    expect(clean).toMatchObject({ name: "Ana", email: "ana@x.com", details: { Birthday: "2000-01-01" } });
    expect(clean?.photoUrl).toBeUndefined();
  });
});
