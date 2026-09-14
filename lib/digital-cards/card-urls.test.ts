import { describe, expect, it } from "vitest";

import { cardSlugify, isNfcStatus, logoSizing, logoStyle, safeCardHref, trackedCardUrl } from "@/lib/digital-cards/card-urls";

describe("cardSlugify", () => {
  it("drops the email domain", () => {
    expect(cardSlugify("jw@controlp.io")).toBe("jw");
    expect(cardSlugify("Jeremy.Waters@qallus.co")).toBe("jeremy-waters");
  });
  it("slugifies names and trims to the limit", () => {
    expect(cardSlugify("  Jeremy Waters — CEO! ")).toBe("jeremy-waters-ceo");
    expect(cardSlugify("a".repeat(80))).toHaveLength(64);
    expect(cardSlugify("@@@")).toBe("");
  });
});

describe("trackedCardUrl", () => {
  it("adds or replaces the source", () => {
    expect(trackedCardUrl("https://controlp.io/c/jw", "nfc")).toBe("https://controlp.io/c/jw?source=nfc");
    expect(trackedCardUrl("https://controlp.io/c/jw?source=qr", "nfc")).toBe("https://controlp.io/c/jw?source=nfc");
    expect(trackedCardUrl("https://controlp.io/c/jw?ref=a", "qr")).toBe("https://controlp.io/c/jw?ref=a&source=qr");
  });
  it("handles relative paths", () => {
    expect(trackedCardUrl("/c/jw", "qr")).toBe("/c/jw?source=qr");
  });
});

describe("logo sizing", () => {
  it("keeps the original bounds for cards that never set a size", () => {
    expect(logoSizing({}).custom).toBe(false);
    expect(logoStyle(null)).toEqual({ maxHeight: 48, width: "auto", maxWidth: 140 });
  });
  it("clamps custom sizes and treats width 0 as auto", () => {
    expect(logoSizing({ logo_height: 999, logo_width: -5 })).toEqual({ height: 160, maxWidth: 0, custom: true });
    expect(logoStyle({ logo_height: 64, logo_width: 0 })).toEqual({ height: 64, width: "auto", maxWidth: "100%" });
    expect(logoStyle({ logo_height: 30, logo_width: 200 })).toEqual({ height: 30, width: "auto", maxWidth: 200 });
  });
});

describe("safeCardHref", () => {
  it("allows only web links", () => {
    expect(safeCardHref("controlp.io")).toBe("https://controlp.io");
    expect(safeCardHref("http://example.com/a")).toBe("http://example.com/a");
    expect(safeCardHref("javascript:alert(1)")).toBeNull();
    expect(safeCardHref("")).toBeNull();
  });
});

describe("NFC status", () => {
  it("accepts the builder's statuses only", () => {
    expect(isNfcStatus("programmed")).toBe(true);
    expect(isNfcStatus("active")).toBe(false);
  });
});
