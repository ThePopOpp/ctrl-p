"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, FileSpreadsheet, LogOut, Package, Plus, Save, Search, Tags, Upload, type LucideIcon } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type VendorProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  base_cost: number | string | null;
  base_price: number | string | null;
  sale_price?: number | string | null;
  status?: string | null;
  stock_status?: string | null;
  materials?: unknown;
  price_rules?: unknown;
  coupon_code?: string | null;
  created_at?: string | null;
};

type VendorItem = {
  id: string;
  quantity: number | null;
  line_total: number | string | null;
  products?: { name?: string | null; category?: string | null } | null;
  orders?: { order_number?: string | null; status?: string | null; production_status?: string | null; due_at?: string | null } | null;
};

type VendorData = {
  profile: { full_name: string | null; company: string | null; email: string | null };
  products: VendorProduct[];
  orderItems: VendorItem[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const navItems: { label: string; icon: LucideIcon }[] = [
  { label: "Catalog", icon: Package },
  { label: "Materials", icon: Box },
  { label: "Pricing", icon: Tags },
  { label: "CSV import", icon: FileSpreadsheet },
];

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function amount(value: number | string | null | undefined) {
  return money.format(Number(value || 0));
}

function listText(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "";
}

async function token() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Sign in again before using the vendor dashboard.");
  return session.access_token;
}

export function VendorDashboard() {
  const router = useRouter();
  const [data, setData] = useState<VendorData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<VendorProduct | null>(null);

  async function load() {
    const db = getSupabaseBrowserClient();
    const session = db ? (await db.auth.getSession()).data.session : null;
    if (!session?.access_token) {
      router.replace("/login?redirect=/dashboard/vendor");
      return;
    }
    const response = await fetch("/api/dashboard/vendor", { headers: { authorization: `Bearer ${session.access_token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Could not load vendor dashboard.");
      setState("denied");
      return;
    }
    setData(payload as VendorData);
    setState("ready");
  }

  useEffect(() => { load(); }, []);

  async function signOut() {
    const db = getSupabaseBrowserClient();
    await db?.auth.signOut();
    router.replace("/login");
  }

  const products = data?.products ?? [];
  const jobs = data?.orderItems ?? [];
  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => !needle || [product.name, product.sku, product.category, product.status].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [products, query]);

  function openProduct(product?: VendorProduct) {
    setSelectedProduct(product || null);
    setSheetOpen(true);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Importing CSV...");
    try {
      const text = await file.text();
      const [headerLine, ...rows] = text.split(/\r?\n/).filter(Boolean);
      const headers = headerLine.split(",").map((item) => item.trim());
      const auth = await token();
      let imported = 0;
      for (const row of rows) {
        const values = row.split(",");
        const payload = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
        const response = await fetch("/api/dashboard/vendor", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${auth}` }, body: JSON.stringify(payload) });
        if (response.ok) imported += 1;
      }
      setMessage(`Imported ${imported} products from CSV.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import CSV.");
    } finally {
      event.target.value = "";
    }
  }

  return <div className="dark min-h-screen bg-background text-foreground"><aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block"><div className="mb-5 flex items-center gap-3 px-2"><img src="/logos/app-icon.svg" alt="ctrl+p" className="h-9 w-9 rounded-lg" /><div><div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div><div className="text-sm font-semibold">Vendor</div></div></div><nav className="space-y-1">{navItems.map(({ label, icon: Icon }) => <a key={label} href={`#${label.toLowerCase().replace(" ", "-")}`} className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"><Icon className="h-4 w-4" />{label}</a>)}</nav></aside><header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]"><div className="flex h-12 items-center gap-3 px-5"><div className="text-xs text-muted-foreground">Vendor <span className="mx-2">/</span><span className="font-medium text-foreground">Dashboard</span></div><div className="ml-auto flex items-center gap-2"><div className="relative hidden w-[360px] md:block"><Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" /><Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search products, materials, jobs..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><Button variant="outline" className="h-8 text-xs" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button></div></div></header><main className="px-4 py-5 lg:pl-[258px] lg:pr-6">{state === "loading" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading vendor dashboard...</CardContent></Card>}{state === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Vendor access unavailable</div><p className="mt-2 text-sm text-muted-foreground">{message}</p></CardContent></Card>}{state === "ready" && data && <><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h1 className="text-[25px] font-semibold tracking-tight">{data.profile.company || data.profile.full_name || "Vendor"} workspace</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage vendor catalog products, materials, pricing, discounts, CSV uploads, and connected production work.</p></div><div className="flex gap-2"><Button onClick={() => openProduct()}><Plus className="h-4 w-4" /> Add product</Button><Button variant="outline" asChild><label><Upload className="h-4 w-4" /> CSV upload<input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} /></label></Button></div></div>{message && <div className="mb-4 rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}<section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Stat label="Products" value={String(products.length)} hint="Vendor catalog" /><Stat label="Active jobs" value={String(jobs.length)} hint="Linked order lines" /><Stat label="Avg price" value={amount(products.reduce((sum, item) => sum + Number(item.base_price || 0), 0) / Math.max(products.length, 1))} hint="Catalog base price" /><Stat label="Discounts" value={String(products.filter((item) => item.sale_price || item.coupon_code).length)} hint="Sale price or coupon" /></section><section className="mb-5 grid gap-4 xl:grid-cols-[1fr_380px]"><Card id="catalog"><CardHeader className="pb-3"><CardTitle className="text-base">Vendor catalog</CardTitle><CardDescription>Add products, material lists, prices, discounts, templates, and CSV updates.</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="pl-4">Product</TableHead><TableHead>Materials</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader><TableBody>{visibleProducts.map((product) => <TableRow key={product.id} className="cursor-pointer" onClick={() => openProduct(product)}><TableCell className="pl-4"><div className="font-medium">{product.name}</div><div className="text-xs text-muted-foreground">{product.sku} - {product.category}</div></TableCell><TableCell className="max-w-[260px] truncate">{listText(product.materials) || "Not set"}</TableCell><TableCell><Badge variant="outline">{human(product.status)}</Badge></TableCell><TableCell className="text-right">{amount(product.base_price)}</TableCell></TableRow>)}{!visibleProducts.length && <TableRow><TableCell colSpan={4} className="p-6 text-center text-muted-foreground">No vendor products yet.</TableCell></TableRow>}</TableBody></Table></CardContent></Card><Card><CardHeader className="pb-3"><CardTitle className="text-base">Work connected to catalog</CardTitle></CardHeader><CardContent className="space-y-2">{jobs.slice(0, 8).map((item) => <MiniRow key={item.id} title={item.orders?.order_number || item.id.slice(0, 8)} detail={`${item.products?.name || "Product"} - ${human(item.orders?.production_status)}`} value={String(item.quantity || 1)} />)}{!jobs.length && <Empty text="No linked order lines yet." />}</CardContent></Card></section><section className="grid gap-4 xl:grid-cols-3"><InfoCard id="materials" title="Materials" items={["Material names via comma list", "Template files: PDF, PNG, SVG, EPS", "Shipping classes and dimensions next"]} /><InfoCard id="pricing" title="Prices and discounts" items={["Base cost", "Base price", "Sale price", "Coupon code", "Quantity tier JSON"]} /><InfoCard id="csv-import" title="CSV columns" items={["name, sku, slug, category", "base_cost, base_price, sale_price", "materials, coupon_code, status"]} /></section></>}</main><ProductSheet open={sheetOpen} onOpenChange={setSheetOpen} product={selectedProduct} onSaved={load} /></div>;
}

function ProductSheet({ open, onOpenChange, product, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; product: VendorProduct | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      id: product?.id || "",
      name: product?.name || "",
      sku: product?.sku || "",
      slug: product?.slug || "",
      category: product?.category || "",
      base_cost: String(product?.base_cost || ""),
      base_price: String(product?.base_price || ""),
      sale_price: String(product?.sale_price || ""),
      coupon_code: product?.coupon_code || "",
      materials: listText(product?.materials),
      price_rules: listText(product?.price_rules),
      status: product?.status || "active",
      stock_status: product?.stock_status || "in_stock",
      description: "",
    });
    setMessage("");
  }, [product, open]);

  function set(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage("Saving product...");
    try {
      const auth = await token();
      const method = product ? "PATCH" : "POST";
      const response = await fetch("/api/dashboard/vendor", { method, headers: { "content-type": "application/json", authorization: `Bearer ${auth}` }, body: JSON.stringify(form) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save product.");
      setMessage("Product saved.");
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="overflow-y-auto sm:max-w-[60rem]"><SheetHeader><SheetTitle>{product ? "Edit vendor product" : "Add vendor product"}</SheetTitle><SheetDescription>Manage catalog, materials, prices, discounts, and CSV-ready fields.</SheetDescription></SheetHeader><div className="mt-6 space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Name" value={form.name} onChange={(value) => set("name", value)} /><Field label="SKU" value={form.sku} onChange={(value) => set("sku", value)} /><Field label="Slug" value={form.slug} onChange={(value) => set("slug", value)} /><Field label="Category" value={form.category} onChange={(value) => set("category", value)} /><Field label="Base cost" value={form.base_cost} onChange={(value) => set("base_cost", value)} /><Field label="Base price" value={form.base_price} onChange={(value) => set("base_price", value)} /><Field label="Sale price" value={form.sale_price} onChange={(value) => set("sale_price", value)} /><Field label="Coupon code" value={form.coupon_code} onChange={(value) => set("coupon_code", value)} /><Field label="Status" value={form.status} onChange={(value) => set("status", value)} /><Field label="Stock status" value={form.stock_status} onChange={(value) => set("stock_status", value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Materials</div><Textarea value={form.materials || ""} onChange={(event) => set("materials", event.target.value)} placeholder="vinyl, mesh banner, matte laminate" /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Pricing rules / quantity breaks</div><Textarea value={form.price_rules || ""} onChange={(event) => set("price_rules", event.target.value)} placeholder="JSON or comma-separated rule labels" /></div>{message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}<div className="flex gap-2"><Button className="flex-1" disabled={saving} onClick={save}><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save product"}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div></div></SheetContent></Sheet>;
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Input value={value || ""} onChange={(event) => onChange(event.target.value)} /></div>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function MiniRow({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3 text-sm"><div className="min-w-0"><div className="truncate font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge variant="outline">{value}</Badge></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{text}</div>;
}

function InfoCard({ id, title, items }: { id: string; title: string; items: string[] }) {
  return <Card id={id}><CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-2">{items.map((item) => <div key={item} className="rounded-lg border bg-background/35 px-3 py-2 text-sm">{item}</div>)}</CardContent></Card>;
}
