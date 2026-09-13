import { describe, expect, it } from "vitest";

import {
  buildDraft,
  collectSpecs,
  findProductNode,
  mergeVisionExtraction,
  parseMoney,
  parsePriceTable,
  parseQuantity,
  pickImages,
  pickPriceTable,
} from "@/lib/capture/extract";
import type { RawHarvest, VisionExtraction } from "@/lib/capture/types";

const harvest = (over: Partial<RawHarvest> = {}): RawHarvest => ({
  url: "https://www.4over.com/business-cards/16pt-matte",
  pageTitle: "16pt Matte Business Cards | 4Over",
  jsonLd: [],
  openGraph: {},
  microdata: {},
  tables: [],
  definitions: [],
  images: [],
  selects: [],
  text: "",
  ...over,
});

// ─── Tier 1 ─────────────────────────────────────────────────────────────────

describe("Tier 1 — structured markup", () => {
  it("finds a Product node at the top level", () => {
    const node = findProductNode([{ "@type": "Product", name: "Business Cards" }]);
    expect(node?.name).toBe("Business Cards");
  });

  it("finds a Product inside an @graph", () => {
    const node = findProductNode([
      { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage" }, { "@type": "Product", name: "Banners" }] },
    ]);
    expect(node?.name).toBe("Banners");
  });

  it("handles a @type array", () => {
    const node = findProductNode([{ "@type": ["Thing", "Product"], name: "Flyers" }]);
    expect(node?.name).toBe("Flyers");
  });

  it("returns null when there is no Product", () => {
    expect(findProductNode([{ "@type": "Organization", name: "4Over" }])).toBeNull();
  });

  it("prefers JSON-LD over Open Graph over the page title", () => {
    const draft = buildDraft(
      harvest({
        jsonLd: [{ "@type": "Product", name: "16pt Matte Business Card", sku: "4O-BC-16PT" }],
        openGraph: { title: "OG title", description: "Vendor blurb." },
      }),
    );
    expect(draft.title.value).toBe("16pt Matte Business Card");
    expect(draft.title.source).toBe("structured");
    expect(draft.vendorSku.value).toBe("4O-BC-16PT");
  });

  it("falls back to a cleaned page title and marks it as a DOM read", () => {
    const draft = buildDraft(harvest());
    expect(draft.title.value).toBe("16pt Matte Business Cards");
    expect(draft.title.source).toBe("dom");
  });

  it("reads a brand given as a nested object", () => {
    const draft = buildDraft(harvest({ jsonLd: [{ "@type": "Product", name: "X", brand: { "@type": "Brand", name: "4Over" } }] }));
    expect(draft.brand.value).toBe("4Over");
  });

  it("builds variants from structured offers when no table exists", () => {
    const draft = buildDraft(
      harvest({
        jsonLd: [
          {
            "@type": "Product",
            name: "Yard Sign",
            offers: [
              { "@type": "Offer", price: "12.50", priceCurrency: "USD", name: "18x24" },
              { "@type": "Offer", price: "19.00", priceCurrency: "USD", name: "24x36" },
            ],
          },
        ],
      }),
    );
    expect(draft.variants).toHaveLength(2);
    expect(draft.variants[0].unit_cost).toBe(12.5);
    expect(draft.variants[0].source).toBe("structured");
    expect(draft.currency).toBe("USD");
  });

  it("unwraps an AggregateOffer", () => {
    const draft = buildDraft(
      harvest({
        jsonLd: [
          {
            "@type": "Product",
            name: "Banner",
            offers: { "@type": "AggregateOffer", offers: [{ price: 30 }, { price: 45 }] },
          },
        ],
      }),
    );
    expect(draft.variants.map((v) => v.unit_cost)).toEqual([30, 45]);
  });
});

// ─── Tier 2: price tables ───────────────────────────────────────────────────

describe("Tier 2 — price tables", () => {
  it("parses a row-oriented quantity ladder", () => {
    const variants = parsePriceTable({
      headers: ["Qty", "Stock", "Finish", "Price"],
      rows: [
        ["250", "14pt", "Matte", "$18.00"],
        ["500", "14pt", "Matte", "$24.00"],
        ["1,000", "14pt", "Matte", "$34.00"],
      ],
    });

    expect(variants).toHaveLength(3);
    expect(variants[1]).toMatchObject({ quantity: 500, unit_cost: 24, spec: { Stock: "14pt", Finish: "Matte" } });
    expect(variants[2].quantity).toBe(1000);
    expect(variants[2].label).toBe("1,000 / 14pt / Matte");
  });

  it("parses a column-oriented table into one variant per cell", () => {
    const variants = parsePriceTable({
      headers: ["Quantity", "14pt Matte", "16pt Gloss"],
      rows: [
        ["250", "$18.00", "$22.00"],
        ["500", "$24.00", "$31.00"],
      ],
    });

    expect(variants).toHaveLength(4);
    expect(variants[0]).toMatchObject({ quantity: 250, unit_cost: 18, spec: { Option: "14pt Matte" } });
    expect(variants[3]).toMatchObject({ quantity: 500, unit_cost: 31, spec: { Option: "16pt Gloss" } });
  });

  it("recognises dealer-price column headers", () => {
    const variants = parsePriceTable({
      headers: ["Pieces", "Dealer Price"],
      rows: [["100", "9.75"]],
    });
    expect(variants[0]).toMatchObject({ quantity: 100, unit_cost: 9.75 });
  });

  it("ignores a table with no quantity column rather than guessing", () => {
    expect(
      parsePriceTable({ headers: ["Feature", "Detail"], rows: [["Material", "16pt C2S"]] }),
    ).toEqual([]);
  });

  it("skips rows whose price cannot be read", () => {
    const variants = parsePriceTable({
      headers: ["Qty", "Price"],
      rows: [["250", "$18.00"], ["500", "Call for pricing"]],
    });
    expect(variants).toHaveLength(1);
  });

  it("picks the table that yields the most variants", () => {
    const best = pickPriceTable([
      { headers: ["Qty", "Price"], rows: [["100", "$5.00"]] },
      { headers: ["Qty", "Price"], rows: [["250", "$18"], ["500", "$24"], ["1000", "$34"]] },
      { headers: ["Spec", "Value"], rows: [["Material", "16pt"]] },
    ]);
    expect(best?.variants).toHaveLength(3);
  });

  it("prefixes labels with the table caption when there is one", () => {
    const variants = parsePriceTable({
      caption: "16pt Matte",
      headers: ["Qty", "Price"],
      rows: [["500", "$24.00"]],
    });
    expect(variants[0].label).toBe("16pt Matte — 500");
  });

  it("prefers the price table over structured offers — the ladder beats one price", () => {
    const draft = buildDraft(
      harvest({
        jsonLd: [{ "@type": "Product", name: "Cards", offers: { price: 24 } }],
        tables: [{ headers: ["Qty", "Price"], rows: [["250", "$18"], ["500", "$24"], ["1000", "$34"]] }],
      }),
    );
    expect(draft.variants).toHaveLength(3);
    expect(draft.extractionSources.variants).toBe("dom");
  });
});

describe("money and quantity parsing", () => {
  it("reads prices in the shapes vendors use", () => {
    expect(parseMoney("$18.00")).toBe(18);
    expect(parseMoney("18.00 USD")).toBe(18);
    expect(parseMoney("$1,234.56")).toBe(1234.56);
    expect(parseMoney("$18.00 ea")).toBe(18);
    expect(parseMoney("Call for pricing")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });

  it("reads quantities with separators", () => {
    expect(parseQuantity("1,000")).toBe(1000);
    expect(parseQuantity("250 pcs")).toBe(250);
    expect(parseQuantity("—")).toBeNull();
  });
});

// ─── Tier 2: specs and images ───────────────────────────────────────────────

describe("Tier 2 — specs and images", () => {
  it("collects definition-list specs", () => {
    const specs = collectSpecs(
      harvest({
        definitions: [
          { term: "Material", definition: "16pt C2S" },
          { term: "Finish:", definition: "Matte" },
        ],
      }),
    );
    expect(specs).toEqual({ Material: "16pt C2S", Finish: "Matte" });
  });

  it("keeps configuration selects that look like specs and drops the rest", () => {
    const specs = collectSpecs(
      harvest({
        selects: [
          { label: "Paper Stock", options: ["14pt", "16pt", "18pt"] },
          { label: "Country", options: ["US", "CA"] },
        ],
      }),
    );
    expect(specs["Paper Stock"]).toBe("14pt, 16pt, 18pt");
    expect(specs.Country).toBeUndefined();
  });

  it("filters sprites, icons and tiny images", () => {
    const images = pickImages(
      harvest({
        images: [
          { src: "https://cdn/product-front.jpg", width: 1200, height: 800 },
          { src: "https://cdn/sprite.png", width: 900, height: 900 },
          { src: "https://cdn/tiny.png", width: 32, height: 32 },
          { src: "data:image/png;base64,AAA" },
        ],
      }),
    );
    expect(images.map((i) => i.url)).toEqual(["https://cdn/product-front.jpg"]);
  });

  it("sorts by area so the highest resolution leads", () => {
    const images = pickImages(
      harvest({
        images: [
          { src: "https://cdn/small.jpg", width: 400, height: 400 },
          { src: "https://cdn/large.jpg", width: 1600, height: 1200 },
        ],
      }),
    );
    expect(images[0].url).toBe("https://cdn/large.jpg");
  });

  it("marks every captured image as reference-only", () => {
    const images = pickImages(harvest({ images: [{ src: "https://cdn/a.jpg", width: 800, height: 600 }] }));
    expect(images[0].image_source).toBe("scraped_reference");
  });
});

// ─── Draft assembly ─────────────────────────────────────────────────────────

describe("draft assembly", () => {
  it("records which tier supplied each field", () => {
    const draft = buildDraft(
      harvest({
        jsonLd: [{ "@type": "Product", name: "Cards", sku: "SKU1", description: "Vendor copy." }],
        tables: [{ headers: ["Qty", "Price"], rows: [["500", "$24"]] }],
        definitions: [{ term: "Material", definition: "16pt" }],
      }),
    );

    expect(draft.extractionSources).toMatchObject({
      title: "structured",
      vendor_sku: "structured",
      captured_description: "structured",
      variants: "dom",
      spec_table: "dom",
    });
  });

  it("keeps vendor copy in captured_description, never as the card description", () => {
    const draft = buildDraft(harvest({ openGraph: { description: "Vendor's own marketing blurb." } }));
    expect(draft.capturedDescription.value).toBe("Vendor's own marketing blurb.");
    expect(draft).not.toHaveProperty("description");
  });

  it("lists what it could not find so staff know what to fill in", () => {
    const draft = buildDraft(harvest());
    expect(draft.unresolved).toContain("cost");
    expect(draft.unresolved).toContain("images");
    expect(draft.unresolved).toContain("specs");
  });

  it("derives a subtitle and lead time from the specs", () => {
    const draft = buildDraft(
      harvest({
        definitions: [
          { term: "Size", definition: '3.5" x 2"' },
          { term: "Turnaround", definition: "4 business days" },
        ],
      }),
    );
    expect(draft.subtitle.value).toBe('Size: 3.5" x 2"');
    expect(draft.leadTimeDays.value).toBe(4);
  });
});

// ─── Tier 3 merge ───────────────────────────────────────────────────────────

const vision = (over: Partial<VisionExtraction> = {}): VisionExtraction => ({
  title: null,
  subtitle: null,
  description: null,
  sku: null,
  specs: null,
  priceRows: null,
  leadTimeDays: null,
  confidence: {},
  ...over,
});

describe("Tier 3 — vision merge", () => {
  it("fills only the gaps and never overwrites a structured value", () => {
    const draft = buildDraft(harvest({ jsonLd: [{ "@type": "Product", name: "Real Title", sku: "REAL-SKU" }] }));
    const merged = mergeVisionExtraction(draft, vision({ title: "Vision Title", sku: "VISION-SKU" }));

    expect(merged.title.value).toBe("Real Title");
    expect(merged.title.source).toBe("structured");
    expect(merged.vendorSku.value).toBe("REAL-SKU");
  });

  it("supplies a title when tiers 1 and 2 found none, badged as extracted", () => {
    const draft = buildDraft(harvest({ pageTitle: "" }));
    const merged = mergeVisionExtraction(draft, vision({ title: "Vision Title", confidence: { title: 0.82 } }));

    expect(merged.title.value).toBe("Vision Title");
    expect(merged.title.source).toBe("vision");
    expect(merged.title.confidence).toBe(0.82);
    expect(merged.extractionSources.title).toBe("vision");
  });

  it("marks vision-supplied prices so the form can render them distinctly", () => {
    const draft = buildDraft(harvest());
    const merged = mergeVisionExtraction(
      draft,
      vision({ priceRows: [{ quantity: 500, price: 24 }, { quantity: 1000, price: 34 }] }),
    );

    expect(merged.variants).toHaveLength(2);
    expect(merged.variants.every((v) => v.source === "vision")).toBe(true);
    expect(merged.extractionSources.variants).toBe("vision");
  });

  it("does not replace a DOM-read price ladder with a vision-read one", () => {
    const draft = buildDraft(harvest({ tables: [{ headers: ["Qty", "Price"], rows: [["500", "$24"]] }] }));
    const merged = mergeVisionExtraction(draft, vision({ priceRows: [{ quantity: 500, price: 99 }] }));

    expect(merged.variants[0].unit_cost).toBe(24);
    expect(merged.variants[0].source).toBe("dom");
  });

  it("drops price rows with an unusable number rather than importing a zero cost", () => {
    const draft = buildDraft(harvest());
    const merged = mergeVisionExtraction(
      draft,
      vision({ priceRows: [{ quantity: 500, price: 0 }, { quantity: 1000, price: Number.NaN }] }),
    );
    expect(merged.variants).toHaveLength(0);
    expect(merged.unresolved).toContain("cost");
  });

  it("adds spec rows without clobbering the ones the DOM already gave", () => {
    const draft = buildDraft(harvest({ definitions: [{ term: "Material", definition: "16pt C2S" }] }));
    const merged = mergeVisionExtraction(draft, vision({ specs: { Material: "WRONG", Finish: "Matte" } }));

    expect(merged.specTable.value.Material).toBe("16pt C2S");
    expect(merged.specTable.value.Finish).toBe("Matte");
  });

  it("clears resolved items from the unresolved list", () => {
    const draft = buildDraft(harvest());
    expect(draft.unresolved).toContain("cost");
    const merged = mergeVisionExtraction(draft, vision({ priceRows: [{ quantity: 500, price: 24 }] }));
    expect(merged.unresolved).not.toContain("cost");
  });
});
