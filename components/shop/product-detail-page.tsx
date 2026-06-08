"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronDown, Download, Loader2, Minus,
  Plus, Shield, Star, Tag, Truck, Upload, Zap,
} from "lucide-react";

import { CartProvider, useCart } from "@/lib/cart/cart-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────
type Product = {
  id: string; sku: string; slug: string; name: string; category: string;
  tagline: string | null; description: string | null;
  base_price: number | string | null; base_cost: number | string | null;
  sale_price: number | string | null; featured: boolean | null;
  stock_status: string | null; photo_gallery: unknown;
  sizes: unknown; materials: unknown; print_options: unknown;
  turnaround_times: unknown; quantity_tiers: unknown; customizer_enabled: boolean | null;
};
type ProductOption = { id: string; option_group: string; option_key: string; label: string; cost_delta: number; sort_order: number };
type RelatedProduct = { id: string; slug: string; name: string; category: string; base_price: number | null; photo_gallery: unknown };

// ─── Helpers ──────────────────────────────────────────────
const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function money(n: number) { return fmt.format(n); }

function getImages(gallery: unknown): string[] {
  if (!gallery) return [];
  if (typeof gallery === "string") return [gallery];
  if (Array.isArray(gallery)) return gallery.map(String).filter(Boolean);
  if (typeof gallery === "object" && gallery !== null) {
    const vals = Object.values(gallery as Record<string, unknown>);
    return vals.flatMap((v) => Array.isArray(v) ? v.map(String) : [String(v)]).filter(Boolean);
  }
  return [];
}
function toArr(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "object" && v !== null) return Object.values(v as Record<string, unknown>).map(String).filter(Boolean);
  if (typeof v === "string") { try { return toArr(JSON.parse(v)); } catch { return [v]; } }
  return [];
}

// ─── Product-type config ──────────────────────────────────
type SizePreset = { label: string; sub: string; w: number; h: number }; // w,h in inches; 0 = custom
const BANNER_SIZES: SizePreset[] = [
  { label: "2×4", sub: "ft", w: 24, h: 48 },
  { label: "3×6", sub: "ft", w: 36, h: 72 },
  { label: "4×8", sub: "ft", w: 48, h: 96 },
  { label: "Custom", sub: "", w: 0, h: 0 },
];
const SIGN_SIZES: SizePreset[] = [
  { label: "12×18", sub: "in", w: 12, h: 18 },
  { label: "18×24", sub: "in", w: 18, h: 24 },
  { label: "24×36", sub: "in", w: 24, h: 36 },
  { label: "36×48", sub: "in", w: 36, h: 48 },
];
const GROMMET_OPTIONS = [
  "Every 24\" around perimeter (recommended)",
  "Every 12\" around perimeter",
  "Four corners only",
  "No grommets",
];
const BANNER_FINISHING = [
  { id: "hemming", label: "Hemming (all sides)", price: 8 },
  { id: "windSlits", label: "Wind slits", price: 6 },
  { id: "polePockets", label: "Pole pockets (top & bottom, 3\")", price: 12 },
  { id: "rope", label: "Rope reinforcement", price: 15 },
];
const TURNAROUND_OPTIONS = [
  { id: "standard", label: "Standard (3–5 days)", fee: 0 },
  { id: "rush", label: "Rush (1–2 days)", fee: 15 },
  { id: "sameday", label: "Same day (order by 2pm)", fee: 35 },
];
const MATERIAL_SQFT_DELTA: Record<string, number> = {
  "standard 13oz": 0, "13oz": 0, "standard vinyl": 0,
  "15oz": 0.5, "15oz heavy": 0.5, "heavy-duty": 0.5, "heavy-duty 18oz vinyl": 1.2,
  "18oz": 1.2, "18oz blockout": 1.2, "blockout": 1.2,
  "mesh": 0.75, "mesh vinyl": 0.75,
};

function getMaterialDelta(name: string): number {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(MATERIAL_SQFT_DELTA)) {
    if (key.includes(k)) return v;
  }
  return 0;
}
function getSqft(w: number, h: number) { return (w * h) / 144; }

// ─── Sub-components ───────────────────────────────────────
function Stars({ rating, count, size = "sm" }: { rating: number; count?: number; size?: "sm" | "lg" }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn(size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5",
            i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200 dark:fill-zinc-600 dark:text-zinc-600")} />
        ))}
      </div>
      <span className={cn("font-semibold", size === "lg" ? "text-lg" : "text-sm")}>{rating}</span>
      {count !== undefined && <span className="text-sm text-muted-foreground">{count.toLocaleString()} reviews</span>}
    </div>
  );
}

function ReviewBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 text-right">{stars}</span>
      <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
      <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-4 text-right text-muted-foreground">{count}</span>
    </div>
  );
}

const MOCK_REVIEWS = [
  { initials: "KD", name: "Kristy Dale", verified: true, stars: 5, age: "3 days ago", title: "Perfect for our grand opening", body: "Ordered a 4×8 banner for our new location. Print quality was outstanding, colors matched our brand exactly, and it arrived 2 days early. Already ordered 3 more for other locations.", helpful: 24 },
  { initials: "MG", name: "Mike Gauthier", verified: true, stars: 5, age: "1 week ago", title: "Held up through monsoon season", body: "Bought a 3×6 banner for a community event 6 months ago and it's been out in the Arizona sun and storms ever since. Still looks brand new. These guys know their materials.", helpful: 18 },
  { initials: "TW", name: "Tina Westinghouse", verified: true, stars: 4, age: "2 weeks ago", title: "Great quality, rush order came through", body: "Ordered at 1:45pm and it was ready for pickup the same afternoon. Pricing was fair and the banner looked pro. Knocked one star only because the grommets were slightly uneven on one side.", helpful: 9 },
];
const MOCK_RATINGS = { avg: 4.9, total: 312, dist: [262, 38, 8, 2, 2] };

// ─── Upload Zone ──────────────────────────────────────────
function UploadZone({ file, onFile }: { file: File | null; onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
        drag ? "border-primary bg-primary/5" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
      )}
    >
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.ai,.eps,.png,.jpg,.jpeg" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
      {file ? (
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Check className="h-5 w-5" /> {file.name}
        </div>
      ) : (
        <>
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">Drop your file here or <span className="text-primary underline">browse</span></p>
          <p className="mt-1 text-xs text-muted-foreground">PDF, AI, EPS, PNG, JPG up to 250MB</p>
        </>
      )}
    </div>
  );
}

// ─── Main Product Content ─────────────────────────────────
function ProductDetailContent({ slug }: { slug: string }) {
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Gallery
  const [activeImg, setActiveImg] = useState(0);

  // Configurator state
  const [sizeIdx, setSizeIdx] = useState(1); // default 3×6
  const [customW, setCustomW] = useState("36");
  const [customH, setCustomH] = useState("72");
  const [matIdx, setMatIdx] = useState(0);
  const [finish, setFinish] = useState("Gloss");
  const [sides, setSides] = useState("Single-Sided");
  const [grommet, setGrommet] = useState(GROMMET_OPTIONS[0]);
  const [finishing, setFinishing] = useState<string[]>(["hemming"]);
  const [quantity, setQuantity] = useState(1);
  const [turnaround, setTurnaround] = useState(TURNAROUND_OPTIONS[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedQtyTier, setSelectedQtyTier] = useState<ProductOption | null>(null);

  // Cart
  const [added, setAdded] = useState(false);

  // Tabs
  const [tab, setTab] = useState<"description" | "specifications" | "shipping" | "reviews">("description");

  useEffect(() => {
    fetch(`/api/products?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then(async (data) => {
        const p = data.products?.[0];
        if (!p) { setError("Product not found."); return; }
        setProduct(p);

        // Options
        const optR = await fetch(`/api/products/options?product_id=${p.id}`);
        if (optR.ok) {
          const optD = await optR.json();
          const opts: ProductOption[] = optD.options ?? [];
          setOptions(opts);
          const qtyOpts = opts.filter((o) => o.option_group === "quantity");
          if (qtyOpts.length) setSelectedQtyTier(qtyOpts[0]);
        }

        // Related
        const relR = await fetch(`/api/products?category=${encodeURIComponent(p.category)}&limit=8`);
        if (relR.ok) {
          const relD = await relR.json();
          setRelated((relD.products ?? []).filter((x: RelatedProduct) => x.slug !== slug).slice(0, 4));
        }
      })
      .catch(() => setError("Could not load product."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error || !product) return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-4 text-4xl">🖨️</div>
      <h1 className="mb-2 text-xl font-bold">{error || "Product not found"}</h1>
      <Button variant="outline" asChild><a href="/shop"><ArrowLeft className="mr-2 h-4 w-4" />Back to shop</a></Button>
    </div>
  );

  const images = getImages(product.photo_gallery);
  const isOutOfStock = product.stock_status === "out_of_stock";
  const isBanner = ["banners"].includes(product.category);
  const isSign = ["signage"].includes(product.category);
  const isPrint = ["print"].includes(product.category);
  const isAreaBased = isBanner || isSign;

  // Parsed arrays
  const productSizes = toArr(product.sizes);
  const productMaterials = toArr(product.materials);
  const productPrintOptions = toArr(product.print_options);
  const productTurnaround = toArr(product.turnaround_times);

  // Determine size presets
  const sizePresets: SizePreset[] = isBanner ? BANNER_SIZES : isSign ? SIGN_SIZES :
    productSizes.map((s) => ({ label: s, sub: "", w: 0, h: 0 }));

  const selectedSize = sizePresets[sizeIdx] ?? sizePresets[0];
  const isCustomSize = selectedSize?.label === "Custom" || selectedSize?.w === 0;
  const wIn = isCustomSize ? (parseFloat(customW) || 0) : (selectedSize?.w ?? 0);
  const hIn = isCustomSize ? (parseFloat(customH) || 0) : (selectedSize?.h ?? 0);
  const sqft = getSqft(wIn, hIn);

  // Materials
  const materials = productMaterials.length ? productMaterials : ["Standard", "Premium", "Heavy-Duty"];
  const selectedMaterial = materials[matIdx] ?? materials[0];

  // Sides / finish from print options
  const hasSidesOption = productPrintOptions.some((o) => o.toLowerCase().includes("double"));
  const hasFinishOption = productPrintOptions.some((o) => o.toLowerCase().includes("gloss") || o.toLowerCase().includes("matte"));
  const finishOptions = productPrintOptions.filter((o) => o.toLowerCase().includes("gloss") || o.toLowerCase().includes("matte") || o.toLowerCase().includes("satin") || o.toLowerCase().includes("soft"));

  // Price calculation
  function computePrice(): { total: number; perSqft: number; label: string } {
    if (!product) return { total: 0, perSqft: 0, label: "" };
    if (isPrint && selectedQtyTier) {
      const bc = Number(product.base_cost || 0);
      const retail = Math.round(((bc + selectedQtyTier.cost_delta) / 0.34) / 0.05) * 0.05;
      return { total: retail * quantity, perSqft: 0, label: `${selectedQtyTier.label}` };
    }
    if (isAreaBased && sqft > 0) {
      const matDelta = getMaterialDelta(selectedMaterial);
      const basePsf = Number(product.base_price || 29) / getSqft(BANNER_SIZES[0].w, BANNER_SIZES[0].h);
      const pricePsf = Math.max(2.5, basePsf) + matDelta;
      const sidesMultiplier = sides.toLowerCase().includes("double") ? 1.7 : 1.0;
      const baseTotal = sqft * pricePsf * sidesMultiplier;
      const finishingTotal = BANNER_FINISHING.filter((f) => finishing.includes(f.id)).reduce((s, f) => s + f.price, 0);
      const turnFee = TURNAROUND_OPTIONS.find((t) => t.id === turnaround.id)?.fee ?? 0;
      return { total: (baseTotal + finishingTotal + turnFee) * quantity, perSqft: pricePsf, label: `${wIn}" × ${hIn}" · ${sqft.toFixed(1)} sqft · ${money(pricePsf)}/sqft` };
    }
    return { total: Number(product.base_price || 0) * quantity, perSqft: 0, label: "" };
  }

  const { total: totalPrice, perSqft, label: priceLabel } = computePrice();

  function handleAddToCart() {
    if (isOutOfStock) return;
    const qty = isPrint && selectedQtyTier ? (parseInt(selectedQtyTier.option_key, 10) || quantity) : quantity;
    addItem({ product_id: product!.id, name: product!.name, sku: product!.sku, unit_price: totalPrice / qty, image: images[0] || null, quantity: qty });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  // Estimated delivery
  const today = new Date();
  const shipDays = turnaround.fee > 20 ? 0 : turnaround.fee > 0 ? 2 : 4;
  const shipDate = new Date(today); shipDate.setDate(today.getDate() + shipDays);
  const delivDate = new Date(shipDate); delivDate.setDate(shipDate.getDate() + 2);
  const dayFmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  // Qty tier options for print products
  const qtyOptions = options.filter((o) => o.option_group === "quantity");

  const descLines = (product.description || "").split("\n").filter(Boolean);

  const categoryLabel: Record<string, string> = {
    banners: "Large Format Banner", signage: "Sign", displays: "Display", print: "Business Card", flags: "Flag", "wall-art": "Wall Art",
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <SiteNav />

      <div className="mx-auto max-w-[1200px] px-4 py-4">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <a href="/" className="hover:text-foreground">Home</a>
          <span>/</span>
          <a href="/shop" className="hover:text-foreground">Shop</a>
          <span>/</span>
          <a href={`/shop?category=${product.category}`} className="capitalize hover:text-foreground">{product.category}</a>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[520px_1fr]">
          {/* ── Left: Image Gallery ──────────────────── */}
          <div className="flex gap-3">
            {/* Vertical thumbnails */}
            <div className="hidden sm:flex flex-col gap-2 shrink-0">
              {images.length ? images.slice(0, 5).map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={cn("h-16 w-16 rounded-lg border-2 overflow-hidden shrink-0 transition-colors", activeImg === i ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-700 opacity-60 hover:opacity-100")}>
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              )) : [0, 1, 2, 3].map((i) => (
                <div key={i} className={cn("h-16 w-16 rounded-lg border-2 overflow-hidden shrink-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800", i === 0 ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-700 opacity-40")}>
                  <div className="w-8 h-6 border border-zinc-300 dark:border-zinc-600 rounded flex items-center justify-center">
                    <div className="w-6 h-4 border border-zinc-300 dark:border-zinc-600 rounded-sm bg-zinc-100 dark:bg-zinc-700 relative">
                      <div className="absolute inset-x-1 top-1 h-0.5 bg-zinc-300 dark:bg-zinc-500 rounded" />
                      <div className="absolute inset-x-1 top-2.5 h-0.5 bg-zinc-300 dark:bg-zinc-500 rounded" />
                    </div>
                  </div>
                </div>
              ))}
              {product.featured && (
                <button className="h-16 w-16 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 opacity-60 relative">
                  <div className="text-[8px] text-muted-foreground flex items-center justify-center text-center leading-tight px-1">▶ 0:43</div>
                </button>
              )}
            </div>

            {/* Main image */}
            <div className="flex-1 relative">
              {product.featured && (
                <div className="absolute left-3 top-3 z-10">
                  <span className="inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">Best Seller</span>
                </div>
              )}
              <div className="absolute right-3 top-3 z-10 flex gap-2">
                <button className="h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 border flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                </button>
                <button className="h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 border flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
                </button>
              </div>

              <div className="aspect-[4/3] rounded-xl border bg-zinc-50 dark:bg-zinc-900 overflow-hidden flex items-center justify-center">
                {images.length ? (
                  <img src={images[activeImg]} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-40 h-24 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                      <div className="w-32 h-16 border border-zinc-300 dark:border-zinc-600 rounded bg-zinc-50 dark:bg-zinc-700 relative">
                        <div className="absolute inset-x-3 top-3 h-1 bg-zinc-300 dark:bg-zinc-500 rounded" />
                        <div className="absolute inset-x-3 top-6 h-1 bg-zinc-300 dark:bg-zinc-500 rounded" />
                        <div className="absolute left-2 top-1.5 w-1.5 h-1.5 rounded-full border border-zinc-400" />
                        <div className="absolute right-2 top-1.5 w-1.5 h-1.5 rounded-full border border-zinc-400" />
                        <div className="absolute left-2 bottom-1.5 w-1.5 h-1.5 rounded-full border border-zinc-400" />
                        <div className="absolute right-2 bottom-1.5 w-1.5 h-1.5 rounded-full border border-zinc-400" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* View larger */}
              <button className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto mr-0">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                View larger
              </button>
            </div>
          </div>

          {/* ── Right: Configurator ──────────────────── */}
          <div>
            {/* Product header */}
            <div className="mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {categoryLabel[product.category] || product.category} · SKU {product.sku.toUpperCase()}
              </div>
              <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
              <div className="mt-1.5 flex items-center gap-3">
                <Stars rating={MOCK_RATINGS.avg} count={MOCK_RATINGS.total} />
                {!isOutOfStock && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />In stock
                  </span>
                )}
              </div>
              {product.tagline && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{product.tagline}</p>}
            </div>

            <div className="space-y-4">
              {/* ── Size Selector ── */}
              {(isAreaBased || sizePresets.length > 0) && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">Size</span>
                    <button className="text-xs text-primary underline underline-offset-2">Size guide</button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {sizePresets.map((s, i) => (
                      <button key={i} onClick={() => setSizeIdx(i)}
                        className={cn("rounded-lg border px-2 py-2.5 text-center text-sm font-medium transition-colors",
                          sizeIdx === i ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                        )}>
                        <div className="font-semibold">{s.label}</div>
                        {s.sub && <div className="text-[10px] opacity-60">{s.sub}</div>}
                      </button>
                    ))}
                  </div>
                  {(isCustomSize && isAreaBased) && (
                    <div className="flex items-center gap-2 mt-2">
                      <input type="number" value={customW} onChange={(e) => setCustomW(e.target.value)} placeholder="W" className="h-8 w-20 rounded-lg border bg-background px-2.5 text-sm text-center" />
                      <span className="text-xs text-muted-foreground">W in</span>
                      <input type="number" value={customH} onChange={(e) => setCustomH(e.target.value)} placeholder="H" className="h-8 w-20 rounded-lg border bg-background px-2.5 text-sm text-center" />
                      <span className="text-xs text-muted-foreground">H in</span>
                    </div>
                  )}
                  {!isCustomSize && isAreaBased && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input readOnly value={wIn} className="h-7 w-16 rounded border bg-zinc-50 dark:bg-zinc-900 px-2 text-center text-sm" />
                      <span>W in</span>
                      <input readOnly value={hIn} className="h-7 w-16 rounded border bg-zinc-50 dark:bg-zinc-900 px-2 text-center text-sm" />
                      <span>H in</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Print / Quantity Tier (for cards/print) ── */}
              {isPrint && qtyOptions.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Quantity</div>
                  <div className="space-y-1">
                    {qtyOptions.map((opt, i) => {
                      const bc = Number(product.base_cost || 0);
                      const retail = Math.round(((bc + opt.cost_delta) / 0.34) / 0.05) * 0.05;
                      const qty = parseInt(opt.option_key, 10) || 1;
                      const perUnit = retail / qty;
                      const first = qtyOptions[0];
                      const firstRetail = Math.round(((bc + first.cost_delta) / 0.34) / 0.05) * 0.05;
                      const firstPerUnit = firstRetail / (parseInt(first.option_key, 10) || 1);
                      const savings = i === 0 ? 0 : Math.round((1 - perUnit / firstPerUnit) * 100);
                      const isRec = i === Math.floor(qtyOptions.length / 2);
                      return (
                        <button key={opt.id} onClick={() => setSelectedQtyTier(opt)}
                          className={cn("w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
                            selectedQtyTier?.id === opt.id ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900 ring-1 ring-zinc-900 dark:ring-zinc-100" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                          )}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold w-14">{qty.toLocaleString()}</span>
                            <span className="text-muted-foreground text-xs">{money(perUnit)}/unit</span>
                            {isRec && <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-medium">Recommended</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{money(retail)}</span>
                            {savings > 0 && <span className="text-[11px] text-emerald-600 font-medium">{savings}% off</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Material ── */}
              {materials.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Material</div>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(materials.length, 3)}, 1fr)` }}>
                    {materials.map((m, i) => {
                      const delta = getMaterialDelta(m);
                      return (
                        <button key={i} onClick={() => setMatIdx(i)}
                          className={cn("rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                            matIdx === i ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                          )}>
                          <div className="font-semibold text-[12px] leading-tight">{m}</div>
                          {isAreaBased && <div className={cn("text-[10px] mt-0.5", matIdx === i ? "opacity-70" : "text-muted-foreground")}>
                            {delta === 0 ? "Standard" : `+${money(delta)}/sqft`}
                          </div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Finish ── */}
              {(hasFinishOption || finishOptions.length > 0) && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Finish</div>
                  <div className="flex gap-2">
                    {(finishOptions.length > 0 ? finishOptions : ["Gloss", "Matte"]).map((f) => (
                      <button key={f} onClick={() => setFinish(f)}
                        className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                          finish === f ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                        )}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Printed Sides (banners/signs) ── */}
              {(hasSidesOption || isAreaBased) && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Printed sides</div>
                  <div className="grid grid-cols-2 gap-2">
                    {["Single-Sided", "Double-Sided"].map((s) => (
                      <button key={s} onClick={() => setSides(s)}
                        className={cn("rounded-lg border py-2.5 text-sm font-medium transition-colors relative",
                          sides === s ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                        )}>
                        {s}
                        {s === "Double-Sided" && <span className={cn("block text-[10px]", sides === s ? "opacity-70" : "text-muted-foreground")}>+70%</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Grommets (banners) ── */}
              {isBanner && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Grommets</div>
                  <div className="relative">
                    <select value={grommet} onChange={(e) => setGrommet(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-background px-3 py-2.5 pr-8 text-sm appearance-none cursor-pointer">
                      {GROMMET_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* ── Finishing options (banners) ── */}
              {isBanner && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Finishing options</div>
                  <div className="space-y-2">
                    {BANNER_FINISHING.map((f) => (
                      <label key={f.id} className="flex items-center justify-between cursor-pointer rounded-lg border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800 py-1 px-1 -mx-1">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer",
                            finishing.includes(f.id) ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600"
                          )} onClick={() => setFinishing((prev) => prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id])}>
                            {finishing.includes(f.id) && <Check className="h-2.5 w-2.5 text-white dark:text-zinc-900" />}
                          </div>
                          <span className="text-sm">{f.label}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">+{money(f.price)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Quantity + Turnaround ── */}
              {!isPrint && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-2 text-sm font-semibold">Quantity</div>
                    <div className="flex h-10 items-center rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-full w-10 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex-1 text-center text-sm font-semibold">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="h-full w-10 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-semibold">Turnaround</div>
                    <div className="relative">
                      <select value={turnaround.id} onChange={(e) => setTurnaround(TURNAROUND_OPTIONS.find((t) => t.id === e.target.value) ?? TURNAROUND_OPTIONS[0])}
                        className="w-full h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-background px-3 pr-8 text-sm appearance-none cursor-pointer">
                        {TURNAROUND_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}{t.fee > 0 ? ` +${money(t.fee)}` : ""}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Artwork Upload ── */}
              <div>
                <div className="mb-2 text-sm font-semibold">Artwork</div>
                <UploadZone file={uploadFile} onFile={setUploadFile} />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <button className="underline underline-offset-2 hover:text-foreground">Upload later →</button>
                  <button className="underline underline-offset-2 hover:text-foreground">I need design help ($85+) →</button>
                </div>
              </div>

              {/* ── Estimated Total ── */}
              <div className="rounded-xl border bg-zinc-50 dark:bg-zinc-900 p-4">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimated total</span>
                  {priceLabel && <span className="text-xs text-muted-foreground">{priceLabel}</span>}
                </div>
                <div className="text-3xl font-bold">{money(totalPrice)}</div>
                <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h5l3 4v3h-8V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                  Ships by <strong className="text-foreground">{dayFmt(shipDate)}</strong>
                  <span className="mx-1">·</span>
                  Delivered <strong className="text-foreground">{dayFmt(delivDate)}</strong>
                </div>
              </div>

              {/* ── CTAs ── */}
              {isOutOfStock ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium text-center">Currently out of stock</div>
              ) : (
                <div className="space-y-2">
                  <Button size="default" onClick={handleAddToCart}
                    className={cn("w-full text-base font-semibold gap-2 transition-all", added ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200")}>
                    {added ? <><Check className="h-5 w-5" />Added to cart!</> : <><Tag className="h-4 w-4" />Add to cart</>}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="text-xs">Save as draft</Button>
                    <Button variant="outline" size="sm" className="text-xs">Design in browser</Button>
                  </div>
                </div>
              )}

              {/* ── Trust badges ── */}
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground pt-1">
                {[
                  { icon: <Truck className="mx-auto mb-1 h-4 w-4" />, text: "Free shipping", sub: "orders $75+" },
                  { icon: <Zap className="mx-auto mb-1 h-4 w-4" />, text: "Rush available", sub: "same-day" },
                  { icon: <Shield className="mx-auto mb-1 h-4 w-4" />, text: "Print guarantee", sub: "or reprint free" },
                ].map((b, i) => (
                  <div key={i} className="flex flex-col items-center">
                    {b.icon}
                    <div className="font-medium text-foreground">{b.text}</div>
                    <div>{b.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────── */}
        <div className="mt-10 border-t">
          <div className="flex gap-0 overflow-x-auto">
            {(["description", "specifications", "shipping", "reviews"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-5 py-3.5 text-sm font-medium capitalize whitespace-nowrap transition-colors border-b-2",
                  tab === t ? "border-zinc-900 dark:border-zinc-100 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                {t === "reviews" ? `Reviews (${MOCK_RATINGS.total})` : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="py-8">
            {tab === "description" && (
              <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
                <div>
                  {descLines.length > 0 ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none space-y-3 text-muted-foreground">
                      {descLines.map((l, i) => <p key={i}>{l}</p>)}
                    </div>
                  ) : (
                    <div>
                      <h3 className="mb-3 text-lg font-bold">Built to last through any weather.</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Our flagship {product.name.toLowerCase()} is printed with UV-stable eco-solvent inks, making it ideal for both indoor and outdoor use. The material is rip-resistant, waterproof, and engineered to hold vibrant color for up to 2 years outdoors.
                      </p>
                      <h4 className="mb-2 font-semibold text-sm">What&apos;s included</h4>
                      <ul className="space-y-1.5 text-sm">
                        {["Full-bleed custom print on your choice of material", "Nickel-plated brass grommets (standard) or custom pattern", "Reinforced hemming on all four sides (add-on)", "Free file proof within 4 business hours", "100% reprint guarantee on color or print defects"].map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl border p-4">
                    <h4 className="mb-3 text-sm font-semibold">Design guidelines</h4>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {["Add 0.5\" bleed on all sides", "Outline all fonts to paths", "Embed all images at 150 DPI+", "CMYK color mode for print", "Save as PDF, AI, or EPS"].map((g, i) => (
                        <li key={i} className="flex items-start gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{g}</li>
                      ))}
                    </ul>
                    <Button variant="outline" size="sm" className="mt-3 w-full gap-2 text-xs">
                      <Download className="h-3.5 w-3.5" />Download templates
                    </Button>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">CP</div>
                      <div className="text-sm font-semibold">Need help designing?</div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Our team designs from $85. Fast turnaround, unlimited revisions until you&apos;re happy.</p>
                    <Button size="sm" className="w-full bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white text-xs">Request design help</Button>
                  </div>
                </div>
              </div>
            )}

            {tab === "specifications" && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { title: "Sizes", items: toArr(product.sizes) },
                  { title: "Materials", items: toArr(product.materials) },
                  { title: "Print options", items: toArr(product.print_options) },
                  { title: "Turnaround", items: toArr(product.turnaround_times).length ? toArr(product.turnaround_times) : ["Standard (3–5 days)", "Rush (1–2 days)", "Same day"] },
                ].filter(s => s.items.length > 0).map(({ title, items }) => (
                  <div key={title}>
                    <h4 className="mb-2 text-sm font-semibold">{title}</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((item) => <span key={item} className="rounded-full border bg-secondary/50 px-2.5 py-0.5 text-xs">{item}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "shipping" && (
              <div className="max-w-2xl space-y-4 text-sm text-muted-foreground">
                {[
                  { title: "Free economy shipping", body: "Orders over $75 qualify for free economy shipping (6–8 business days) to addresses in the continental US." },
                  { title: "Rush & same-day options", body: "Rush production (1–2 days) and same-day (order by 2pm) are available for most products. Expedited shipping upgrades are available at checkout." },
                  { title: "Returns & reprints", body: "We stand behind every order with our print guarantee. If there's a defect in color, print quality, or materials, we'll reprint it free. Custom orders are non-refundable but we'll always make it right." },
                  { title: "Local pickup", body: "Pick up from our Chandler, Arizona shop — no shipping required. Select 'Local Pickup' at checkout." },
                ].map(({ title, body }) => (
                  <div key={title} className="border-b pb-4 last:border-0">
                    <h4 className="mb-1 font-semibold text-foreground">{title}</h4>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "reviews" && (
              <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
                {/* Rating summary */}
                <div>
                  <div className="text-5xl font-bold mb-1">{MOCK_RATINGS.avg}</div>
                  <Stars rating={MOCK_RATINGS.avg} size="lg" />
                  <div className="mt-1 text-sm text-muted-foreground">Based on {MOCK_RATINGS.total} verified reviews</div>
                  <div className="mt-4 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((s, i) => (
                      <ReviewBar key={s} stars={s} count={MOCK_RATINGS.dist[i]} total={MOCK_RATINGS.total} />
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full text-xs">Write a review</Button>
                </div>

                {/* Review list */}
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    {["All (312)", "With photos (87)", "Verified (289)"].map((f) => (
                      <button key={f} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", f.startsWith("All") ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-700 text-muted-foreground hover:border-zinc-400")}>{f}</button>
                    ))}
                  </div>
                  <div className="space-y-6">
                    {MOCK_REVIEWS.map((r, i) => (
                      <div key={i} className="border-b pb-6 last:border-0">
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">{r.initials}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{r.name}</span>
                              {r.verified && <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5 font-medium">Verified</span>}
                              <span className="text-xs text-muted-foreground">· {r.age}</span>
                            </div>
                            <Stars rating={r.stars} />
                            <p className="mt-1.5 font-semibold text-sm">{r.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                            <button className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" /><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></svg>
                              Helpful ({r.helpful})
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="mt-4 w-full text-sm">Load 12 more reviews</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Related products ────────────────────────── */}
        {related.length > 0 && (
          <div className="border-t pt-8 pb-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">You might also like</h2>
              <a href={`/shop?category=${product.category}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 capitalize">
                See all {product.category} →
              </a>
            </div>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              {related.map((rp) => {
                const rpImg = getImages(rp.photo_gallery)[0];
                return (
                  <a key={rp.id} href={`/shop/${rp.slug}`} className="group block rounded-xl border overflow-hidden hover:shadow-md transition-all">
                    <div className="aspect-[4/3] bg-zinc-50 dark:bg-zinc-900 overflow-hidden flex items-center justify-center">
                      {rpImg ? (
                        <img src={rpImg} alt={rp.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="opacity-20">
                          <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{categoryLabel[rp.category] || rp.category}</div>
                      <div className="text-sm font-semibold leading-snug group-hover:underline underline-offset-2">{rp.name}</div>
                      {rp.base_price && <div className="mt-0.5 text-sm text-muted-foreground">From {money(Number(rp.base_price))}</div>}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductDetailPage({ slug }: { slug: string }) {
  return (
    <CartProvider>
      <ProductDetailContent slug={slug} />
    </CartProvider>
  );
}
