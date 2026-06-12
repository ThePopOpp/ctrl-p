"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Upload, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ROLES } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ── Types ──────────────────────────────────────────────────────────────────────

type ParsedRow = Record<string, string>;

type MappedRow = {
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  company: string;
  role: string;
  status: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  profile_photo_url: string;
};

type ImportResult = {
  row: number;
  email: string;
  full_name: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
  user_id?: string;
};

type Step = "upload" | "preview" | "importing" | "done";

// ── CSV field aliases ──────────────────────────────────────────────────────────

const FIELD_ALIASES: Record<keyof MappedRow, string[]> = {
  email:             ["email", "e_mail", "email_address", "emailaddress"],
  first_name:        ["first_name", "firstname", "first", "given_name", "givenname"],
  last_name:         ["last_name", "lastname", "last", "surname", "family_name", "familyname"],
  full_name:         ["full_name", "fullname", "name", "display_name", "displayname"],
  phone:             ["phone", "phone_number", "phonenumber", "mobile", "cell", "telephone"],
  company:           ["company", "business", "organization", "organisation", "org", "business_name"],
  role:              ["role", "user_role", "userrole", "type", "account_type", "accounttype"],
  status:            ["status", "account_status", "accountstatus"],
  address_line1:     ["address", "address_line1", "addressline1", "street", "street_address"],
  address_line2:     ["address_line2", "addressline2", "address2", "suite", "unit"],
  city:              ["city", "town"],
  state:             ["state", "province", "region"],
  zip:               ["zip", "zip_code", "zipcode", "postal_code", "postalcode", "postcode"],
  country:           ["country"],
  profile_photo_url: ["profile_photo_url", "profile_photo", "photo_url", "avatar_url", "avatar", "logo", "image_url"],
};

const FIELD_LABELS: Record<keyof MappedRow, string> = {
  email:             "Email",
  first_name:        "First name",
  last_name:         "Last name",
  full_name:         "Full name",
  phone:             "Phone",
  company:           "Company / Business",
  role:              "Role",
  status:            "Status",
  address_line1:     "Address line 1",
  address_line2:     "Address line 2",
  city:              "City",
  state:             "State / Province",
  zip:               "ZIP / Postal code",
  country:           "Country",
  profile_photo_url: "Profile photo URL",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s\-\.]+/g, "_");
}

function autoMapColumns(headers: string[]): Partial<Record<keyof MappedRow, string>> {
  const mapping: Partial<Record<keyof MappedRow, string>> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (!mapping[field as keyof MappedRow] && aliases.includes(normalized)) {
        mapping[field as keyof MappedRow] = header;
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

function applyMapping(rows: ParsedRow[], mapping: Partial<Record<keyof MappedRow, string>>): MappedRow[] {
  return rows.map((row) => {
    const result = {} as MappedRow;
    for (const [field, csvHeader] of Object.entries(mapping)) {
      result[field as keyof MappedRow] = csvHeader ? (row[csvHeader] ?? "") : "";
    }
    // Fill any unmapped fields with empty string
    for (const field of Object.keys(FIELD_LABELS) as (keyof MappedRow)[]) {
      if (!(field in result)) result[field] = "";
    }
    return result;
  });
}

function downloadSampleCSV() {
  const headers = ["first_name", "last_name", "email", "phone", "company", "role", "status", "address_line1", "city", "state", "zip", "country", "profile_photo_url"];
  const sample = [
    ["Jane", "Smith", "jane@example.com", "+1-555-0101", "Acme Corp", "customer", "active", "123 Main St", "Phoenix", "AZ", "85001", "US", ""],
    ["Bob", "Designer", "bob@studio.io", "+1-555-0202", "Studio IO", "designer", "active", "456 Oak Ave", "Tempe", "AZ", "85281", "US", ""],
    ["Sarah", "Vendor", "sarah@vendor.com", "+1-555-0303", "Supply Co", "vendor", "pending", "", "", "", "", "", ""],
  ];
  const csv = [headers.join(","), ...sample.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ctrl-p-users-import-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function getAccessToken(): Promise<string | null> {
  const db = getSupabaseBrowserClient();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return data.session?.access_token ?? null;
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function ImportUsersSheet({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<keyof MappedRow, string>>>({});
  const [showMapping, setShowMapping] = useState(false);
  const [defaultRole, setDefaultRole] = useState("customer");
  const [sendInvites, setSendInvites] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState({ succeeded: 0, skipped: 0, failed: 0 });
  const [showErrors, setShowErrors] = useState(false);

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setParsedRows([]);
    setMapping({});
    setShowMapping(false);
    setSendInvites(false);
    setSkipExisting(true);
    setResults([]);
    setSummary({ succeeded: 0, skipped: 0, failed: 0 });
    setShowErrors(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function loadFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      alert("Please upload a .csv file.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows } = parseCSV(text);
      if (!h.length) { alert("Could not parse CSV. Please check the file format."); return; }
      setHeaders(h);
      setParsedRows(rows);
      setMapping(autoMapColumns(h));
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  async function runImport() {
    setImporting(true);
    setStep("importing");

    const mappedRows = applyMapping(parsedRows, mapping);
    // Apply default role to rows where role is blank
    const preparedRows = mappedRows.map((r) => ({
      ...r,
      role: r.role || defaultRole,
    }));

    try {
      const token = await getAccessToken();
      const resp = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rows: preparedRows, default_role: defaultRole, send_invites: sendInvites, skip_existing: skipExisting }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        alert(data.error || "Import failed.");
        setStep("preview");
        return;
      }
      setResults(data.results ?? []);
      setSummary({ succeeded: data.succeeded ?? 0, skipped: data.skipped ?? 0, failed: data.failed ?? 0 });
      setStep("done");
      if ((data.succeeded ?? 0) > 0) onImported();
    } catch {
      alert("Network error — import failed.");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  }

  const previewRows = parsedRows.slice(0, 5);
  const editableRoles = Object.values(ROLES);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Import users from CSV</SheetTitle>
          <SheetDescription>
            Upload a CSV file to bulk-create or update users and assign roles.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Step: Upload ── */}
          {step === "upload" && (
            <div className="space-y-4">
              <button
                onClick={downloadSampleCSV}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-4 w-4" />
                Download sample CSV template
              </button>

              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors cursor-pointer",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">Drop your CSV here, or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .csv files up to 500 rows</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />

              <div className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground text-[13px]">Supported columns</p>
                <p>email · first_name · last_name · full_name · phone · company · role · status</p>
                <p>address_line1 · address_line2 · city · state · zip · country · profile_photo_url</p>
                <p className="pt-1">The <strong>role</strong> column accepts: {editableRoles.join(", ")}</p>
              </div>
            </div>
          )}

          {/* ── Step: Preview & Configure ── */}
          {step === "preview" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{parsedRows.length} rows detected</p>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  <X className="h-3.5 w-3.5" /> Change file
                </Button>
              </div>

              {/* Column mapping */}
              <div className="rounded-lg border overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold bg-muted/40 hover:bg-muted/70 transition-colors"
                  onClick={() => setShowMapping((p) => !p)}
                >
                  Column mapping
                  {showMapping ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {showMapping && (
                  <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                    {(Object.keys(FIELD_LABELS) as (keyof MappedRow)[]).map((field) => (
                      <div key={field}>
                        <label className="block text-xs text-muted-foreground mb-1">{FIELD_LABELS[field]}</label>
                        <Select
                          value={mapping[field] ?? "__none__"}
                          onValueChange={(v) => setMapping((prev) => ({ ...prev, [field]: v === "__none__" ? undefined : v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="— not mapped —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— not mapped —</SelectItem>
                            {headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview table */}
              <div>
                <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">Preview (first {previewRows.length} rows)</p>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        {(["email", "full_name", "first_name", "last_name", "phone", "company", "role"] as (keyof MappedRow)[])
                          .filter((f) => mapping[f])
                          .map((f) => <TableHead key={f} className="py-2 text-xs">{FIELD_LABELS[f]}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applyMapping(previewRows, mapping).map((row, i) => (
                        <TableRow key={i} className="text-xs">
                          {(["email", "full_name", "first_name", "last_name", "phone", "company", "role"] as (keyof MappedRow)[])
                            .filter((f) => mapping[f])
                            .map((f) => (
                              <TableCell key={f} className="py-1.5 max-w-[150px] truncate">
                                {row[f] || <span className="text-muted-foreground/50">—</span>}
                              </TableCell>
                            ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedRows.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-1.5">…and {parsedRows.length - 5} more rows</p>
                )}
              </div>

              {/* Import settings */}
              <div className="rounded-lg border p-4 space-y-4">
                <p className="font-semibold text-sm">Import settings</p>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Default role (applied when CSV row has no role)</label>
                  <Select value={defaultRole} onValueChange={setDefaultRole}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editableRoles.map((r) => (
                        <SelectItem key={r} value={r}>{r.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-3">
                  <input type="checkbox" id="send-invites" checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                  <div>
                    <label htmlFor="send-invites" className="text-sm font-medium cursor-pointer">Send invite emails</label>
                    <p className="text-xs text-muted-foreground">New users receive a sign-up link. Status is set to "pending".</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input type="checkbox" id="skip-existing" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                  <div>
                    <label htmlFor="skip-existing" className="text-sm font-medium cursor-pointer">Skip existing emails</label>
                    <p className="text-xs text-muted-foreground">Uncheck to update matching users' profile data instead.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Importing ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-semibold">Importing {parsedRows.length} users…</p>
              <p className="text-sm text-muted-foreground">This may take a moment. Please don't close this panel.</p>
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.succeeded}</p>
                  <p className="text-xs text-muted-foreground mt-1">Imported</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.skipped}</p>
                  <p className="text-xs text-muted-foreground mt-1">Skipped</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.failed}</p>
                  <p className="text-xs text-muted-foreground mt-1">Failed</p>
                </div>
              </div>

              {summary.failed > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                    onClick={() => setShowErrors((p) => !p)}
                  >
                    <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {summary.failed} failed row{summary.failed !== 1 ? "s" : ""}</span>
                    {showErrors ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {showErrors && (
                    <div className="divide-y text-xs">
                      {results.filter((r) => !r.success && !r.skipped).map((r) => (
                        <div key={r.row} className="px-4 py-2.5 flex items-start gap-3">
                          <span className="font-mono text-muted-foreground w-8 shrink-0">#{r.row}</span>
                          <span className="font-medium truncate flex-1">{r.email}</span>
                          <span className="text-red-600 dark:text-red-400 shrink-0">{r.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {summary.succeeded > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="px-4 py-3 text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {summary.succeeded} user{summary.succeeded !== 1 ? "s" : ""} imported successfully
                  </div>
                  <div className="divide-y text-xs max-h-52 overflow-y-auto">
                    {results.filter((r) => r.success).map((r) => (
                      <div key={r.row} className="px-4 py-2 flex items-center gap-3">
                        <span className="font-mono text-muted-foreground w-8 shrink-0">#{r.row}</span>
                        <span className="flex-1 truncate">{r.full_name || r.email}</span>
                        <span className="text-muted-foreground truncate">{r.full_name ? r.email : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.skipped > 0 && (
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{summary.skipped} row{summary.skipped !== 1 ? "s" : ""} skipped</p>
                  <p className="text-xs text-muted-foreground mt-1">These emails already exist. To update them, re-import with "Skip existing" unchecked.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t px-6 py-4 flex gap-3 justify-end">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={runImport} disabled={!mapping.email || importing}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {parsedRows.length} user{parsedRows.length !== 1 ? "s" : ""}
              </Button>
            </>
          )}

          {step === "done" && (
            <>
              <Button variant="outline" onClick={reset}>Import another</Button>
              <Button onClick={handleClose}>Done</Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
