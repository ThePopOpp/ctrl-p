"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Upload, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ── Types ──────────────────────────────────────────────────────────────────────

type ParsedRow = Record<string, string>;

type MappedField =
  | "name" | "sku" | "slug" | "category" | "short_description" | "description"
  | "tagline" | "product_type" | "base_price" | "sale_price" | "base_cost"
  | "vendor" | "status" | "stock_status" | "featured" | "customizer_enabled"
  | "video_url" | "dimension_width_in" | "dimension_height_in" | "dimension_length_in"
  | "weight_lbs" | "shipping_class" | "tax_status" | "photo_gallery" | "gallery"
  | "template_files" | "quantity_tiers" | "sizes" | "materials" | "print_options"
  | "finishing_options" | "turnaround_times" | "tags" | "woo_product_id";

type ImportResult = {
  row: number;
  sku: string;
  name: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
};

type Step = "upload" | "preview" | "importing" | "done";

// ── Field definitions ──────────────────────────────────────────────────────────

const FIELD_ALIASES: Record<MappedField, string[]> = {
  name:               ["name", "product_name", "title", "product_title"],
  sku:                ["sku", "product_sku", "item_code", "item_number", "product_code"],
  slug:               ["slug", "url_slug", "permalink", "handle"],
  category:           ["category", "product_category", "cat", "type", "product_type_category"],
  short_description:  ["short_description", "short_desc", "summary", "excerpt"],
  description:        ["description", "desc", "long_description", "full_description", "body"],
  tagline:            ["tagline", "subtitle", "caption"],
  product_type:       ["product_type", "kind", "format"],
  base_price:         ["base_price", "price", "retail_price", "regular_price", "list_price"],
  sale_price:         ["sale_price", "discounted_price", "promo_price", "special_price"],
  base_cost:          ["base_cost", "cost", "wholesale_price", "vendor_cost"],
  vendor:             ["vendor", "supplier", "source", "fulfillment"],
  status:             ["status", "product_status", "publish_status", "visibility"],
  stock_status:       ["stock_status", "inventory_status", "availability", "stock"],
  featured:           ["featured", "is_featured", "feature", "highlight"],
  customizer_enabled: ["customizer_enabled", "designer", "online_designer", "custom_designer"],
  video_url:          ["video_url", "video", "product_video", "demo_url"],
  dimension_width_in: ["width", "dimension_width_in", "width_in", "width_inches", "w"],
  dimension_height_in:["height", "dimension_height_in", "height_in", "height_inches", "h"],
  dimension_length_in:["length", "dimension_length_in", "length_in", "length_inches", "l", "depth"],
  weight_lbs:         ["weight", "weight_lbs", "weight_pounds", "lbs"],
  shipping_class:     ["shipping_class", "ship_class", "shipping"],
  tax_status:         ["tax_status", "taxable", "tax"],
  photo_gallery:      ["photo_gallery", "photos", "images", "image_urls", "product_images"],
  gallery:            ["gallery", "media_gallery", "gallery_images"],
  template_files:     ["template_files", "templates", "template_urls", "download_templates"],
  quantity_tiers:     ["quantity_tiers", "quantity_discounts", "qty_tiers", "volume_pricing", "tiers"],
  sizes:              ["sizes", "dimensions", "available_sizes", "size_options"],
  materials:          ["materials", "material_options", "substrates"],
  print_options:      ["print_options", "printing_options", "print_sides"],
  finishing_options:  ["finishing_options", "finishing", "finishes"],
  turnaround_times:   ["turnaround_times", "turnaround", "lead_times", "production_times"],
  tags:               ["tags", "keywords", "labels"],
  woo_product_id:     ["woo_product_id", "woocommerce_id", "woo_id", "wp_id"],
};

const FIELD_LABELS: Record<MappedField, string> = {
  name:               "Name *",
  sku:                "SKU *",
  slug:               "Slug (URL)",
  category:           "Category *",
  short_description:  "Short description",
  description:        "Description",
  tagline:            "Tagline",
  product_type:       "Product type",
  base_price:         "Base price",
  sale_price:         "Sale price",
  base_cost:          "Base cost",
  vendor:             "Vendor",
  status:             "Status",
  stock_status:       "Stock status",
  featured:           "Featured",
  customizer_enabled: "Online designer",
  video_url:          "Video URL",
  dimension_width_in: "Width (in)",
  dimension_height_in:"Height (in)",
  dimension_length_in:"Length (in)",
  weight_lbs:         "Weight (lbs)",
  shipping_class:     "Shipping class",
  tax_status:         "Tax status",
  photo_gallery:      "Photos / gallery URLs",
  gallery:            "Gallery (media)",
  template_files:     "Template files (JSON/URL)",
  quantity_tiers:     "Quantity discounts",
  sizes:              "Sizes / dimensions (JSON)",
  materials:          "Materials (JSON)",
  print_options:      "Print options (JSON)",
  finishing_options:  "Finishing options (JSON)",
  turnaround_times:   "Turnaround times (JSON)",
  tags:               "Tags (comma-separated)",
  woo_product_id:     "WooCommerce product ID",
};

const ALL_FIELDS = Object.keys(FIELD_LABELS) as MappedField[];

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s\-\.]+/g, "_");
}

function autoMapColumns(headers: string[]): Partial<Record<MappedField, string>> {
  const mapping: Partial<Record<MappedField, string>> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (!mapping[field as MappedField] && aliases.includes(normalized)) {
        mapping[field as MappedField] = header;
        break;
      }
    }
  }
  return mapping;
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        cells.push(current); current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  }

  const headers = parseLine(lines[0]);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    const row: ParsedRow = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

function applyMapping(rows: ParsedRow[], mapping: Partial<Record<MappedField, string>>): Record<MappedField, string>[] {
  return rows.map((row) => {
    const result = {} as Record<MappedField, string>;
    for (const field of ALL_FIELDS) {
      const csvHeader = mapping[field];
      result[field] = csvHeader ? (row[csvHeader] ?? "") : "";
    }
    return result;
  });
}

function downloadSampleCSV() {
  const headers = ["name", "sku", "category", "short_description", "base_price", "sale_price", "base_cost", "vendor", "status", "video_url", "dimension_width_in", "dimension_height_in", "quantity_tiers", "photo_gallery", "template_files", "sizes", "tags", "featured", "customizer_enabled"];
  const sample = [
    ["Vinyl Banner", "bn-36x72", "Signs and Banners", "Custom full-color banners printed fast.", "96", "79", "34", "in_house", "active", "", "36", "72", "1:96,5:82,10:70", "https://cdn.example.com/bn-1.jpg,https://cdn.example.com/bn-2.jpg", "", '[{"label":"3x6 ft","width":36,"height":72,"unit":"in"}]', "banner,vinyl,outdoor", "false", "true"],
    ["Business Cards", "bc-500", "Business Cards", "Premium full-color business cards.", "49", "", "18", "in_house", "active", "", "3.5", "2", "100:49,250:69,500:89", "", '[{"label":"Print template","format":"pdf","url":""}]', '[{"label":"3.5x2 in","width":3.5,"height":2,"unit":"in"}]', "business card,print", "false", "true"],
  ];
  const csv = [headers.join(","), ...sample.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ctrl-p-products-import-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function getAccessToken(): Promise<string | null> {
  const db = getSupabaseBrowserClient();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return data.session?.access_token ?? null;
}

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function ImportProductsSheet({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<MappedField, string>>>({});
  const [showMapping, setShowMapping] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState({ imported: 0, updated: 0, skipped: 0, failed: 0 });

  function reset() {
    setStep("upload");
    setDragging(false);
    setFileName("");
    setHeaders([]);
    setParsedRows([]);
    setMapping({});
    setShowMapping(false);
    setSkipExisting(true);
    setImporting(false);
    setResults([]);
    setSummary({ imported: 0, updated: 0, skipped: 0, failed: 0 });
  }

  function handleClose() {
    reset();
    onClose();
  }

  function processFile(file: File) {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows } = parseCSV(text);
      if (!h.length) return;
      setHeaders(h);
      setParsedRows(rows);
      setMapping(autoMapColumns(h));
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  async function runImport() {
    setImporting(true);
    setStep("importing");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again before importing.");

      const mapped = applyMapping(parsedRows, mapping);
      const response = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows: mapped, skip_existing: skipExisting }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Import failed.");

      setResults(payload.results ?? []);
      setSummary({
        imported: payload.imported ?? 0,
        updated: payload.updated ?? 0,
        skipped: payload.skipped ?? 0,
        failed: payload.failed ?? 0,
      });
      setStep("done");
      onImported();
    } catch (err) {
      setResults([{ row: 0, sku: "", name: "", success: false, error: err instanceof Error ? err.message : "Unknown error." }]);
      setStep("done");
    } finally {
      setImporting(false);
    }
  }

  const mappedCount = ALL_FIELDS.filter((f) => mapping[f]).length;
  const requiredMapped = Boolean(mapping.name && mapping.sku && mapping.category);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-[56rem]">
        <SheetHeader>
          <SheetTitle>Import Products</SheetTitle>
          <SheetDescription>
            Upload a CSV to bulk-create or update products. Supports all product fields — name, pricing, photos, templates, quantity discounts, dimensions, and more.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">

          {/* ── STEP: Upload ── */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drag a CSV file here, or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">Max 500 products per import. UTF-8 encoding recommended.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => fileRef.current?.click()}>
                  Choose file
                </Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
              </div>

              <div className="rounded-lg border bg-secondary/30 p-4 text-sm">
                <p className="font-medium">Required columns</p>
                <p className="mt-1 text-muted-foreground">
                  <code className="text-xs">name</code>, <code className="text-xs">sku</code>, <code className="text-xs">category</code>
                </p>
                <p className="mt-2 font-medium">Optional columns (partial list)</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  short_description · description · base_price · sale_price · base_cost · vendor · status ·
                  video_url · dimension_width_in · dimension_height_in · quantity_tiers (e.g. <code>1:96,5:82,10:70</code>) ·
                  photo_gallery (comma-separated URLs or JSON) · template_files (JSON) · sizes · materials ·
                  print_options · finishing_options · tags (comma-separated) · featured · customizer_enabled
                </p>
              </div>

              <Button variant="outline" size="sm" className="gap-2" onClick={downloadSampleCSV}>
                <Download className="h-4 w-4" /> Download sample CSV
              </Button>
            </div>
          )}

          {/* ── STEP: Preview ── */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{parsedRows.length} rows · {mappedCount} of {ALL_FIELDS.length} fields mapped</p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}><X className="h-4 w-4" /> Change file</Button>
              </div>

              {!requiredMapped && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Map the required fields (Name, SKU, Category) before importing.
                </div>
              )}

              {/* Column mapping */}
              <div>
                <button
                  className="flex w-full items-center gap-2 rounded-lg border bg-secondary/30 px-3 py-2 text-sm font-medium hover:bg-secondary/60"
                  onClick={() => setShowMapping(!showMapping)}
                >
                  {showMapping ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Column mapping
                  <span className="ml-auto text-xs text-muted-foreground">{mappedCount} mapped</span>
                </button>

                {showMapping && (
                  <div className="mt-2 rounded-lg border bg-background p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ALL_FIELDS.map((field) => (
                        <div key={field} className="flex items-center gap-2">
                          <div className="w-44 shrink-0 text-xs text-muted-foreground">{FIELD_LABELS[field]}</div>
                          <Select
                            value={mapping[field] ?? "__none__"}
                            onValueChange={(v) => setMapping({ ...mapping, [field]: v === "__none__" ? undefined : v })}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="— skip —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— skip —</SelectItem>
                              {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="flex items-center gap-4 rounded-lg border bg-secondary/30 px-3 py-2 text-sm">
                <span className="font-medium">If SKU already exists:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="skip" checked={skipExisting} onChange={() => setSkipExisting(true)} />
                  <span>Skip</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="skip" checked={!skipExisting} onChange={() => setSkipExisting(false)} />
                  <span>Update</span>
                </label>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-3">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Sale</TableHead>
                      <TableHead>Width</TableHead>
                      <TableHead>Height</TableHead>
                      <TableHead>Qty tiers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 10).map((row, idx) => {
                      const get = (field: MappedField) => mapping[field] ? row[mapping[field]!] ?? "" : "";
                      return (
                        <TableRow key={idx}>
                          <TableCell className="pl-3 text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium max-w-[160px] truncate">{get("name")}</TableCell>
                          <TableCell className="font-mono text-xs">{get("sku")}</TableCell>
                          <TableCell className="max-w-[120px] truncate text-xs">{get("category")}</TableCell>
                          <TableCell className="text-xs">{get("base_price") ? `$${get("base_price")}` : ""}</TableCell>
                          <TableCell className="text-xs">{get("sale_price") ? `$${get("sale_price")}` : ""}</TableCell>
                          <TableCell className="text-xs">{get("dimension_width_in") ? `${get("dimension_width_in")}″` : ""}</TableCell>
                          <TableCell className="text-xs">{get("dimension_height_in") ? `${get("dimension_height_in")}″` : ""}</TableCell>
                          <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{get("quantity_tiers")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {parsedRows.length > 10 && (
                  <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                    +{parsedRows.length - 10} more rows not shown
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" disabled={!requiredMapped} onClick={runImport}>
                  Import {parsedRows.length} product{parsedRows.length !== 1 ? "s" : ""}
                </Button>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ── STEP: Importing ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Importing {parsedRows.length} products...</p>
              <p className="text-xs text-muted-foreground">This may take a moment for large catalogs.</p>
            </div>
          )}

          {/* ── STEP: Done ── */}
          {step === "done" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Imported", value: summary.imported, color: "text-green-600 dark:text-green-400" },
                  { label: "Updated", value: summary.updated, color: "text-blue-600 dark:text-blue-400" },
                  { label: "Skipped", value: summary.skipped, color: "text-muted-foreground" },
                  { label: "Failed", value: summary.failed, color: "text-red-600 dark:text-red-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border bg-secondary/30 p-3 text-center">
                    <div className={cn("text-2xl font-semibold", color)}>{value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              {results.length > 0 && (
                <div className="max-h-[320px] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-3 w-10">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r) => (
                        <TableRow key={r.row}>
                          <TableCell className="pl-3 text-muted-foreground">{r.row}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{r.name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.sku || "—"}</TableCell>
                          <TableCell>
                            {r.skipped ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Skipped</span>
                            ) : r.success ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> OK</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><AlertCircle className="h-3.5 w-3.5" /> {r.error}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={reset}>Import another file</Button>
                <Button variant="outline" onClick={handleClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
