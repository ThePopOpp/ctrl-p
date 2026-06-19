"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Grid3X3, List, Minus, Plus, ShoppingCart, X } from "lucide-react";

import { CartProvider, useCart } from "@/lib/cart/cart-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteNav } from "@/components/site-nav";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  description: string | null;
  base_price: number | string | null;
  sale_price: number | string | null;
  featured: boolean | null;
  stock_status: string | null;
  photo_gallery: unknown;
  materials?: unknown;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name A–Z" },
];

const AVAIL_OPTIONS = [
  { value: "in_stock", label: "In stock" },
  { value: "same_day", label: "Same-day pickup" },
  { value: "made_to_order", label: "Made to order" },
];

// Physical material keywords — used to distinguish material types from quality tiers
const PHYSICAL_MATERIALS = new Set([
  "vinyl", "mesh", "fabric", "gatorboard", "coroplast",
  "aluminum", "acrylic", "wood", "foam", "canvas", "cardstock", "paper", "polyester",
]);

function displayPrice(product: Product) {
  return Number(product.sale_price || product.base_price || 0);
}

function getImageUrl(gallery: unknown): string | null {
  if (!gallery) return null;
  if (typeof gallery === "string") return gallery;
  if (Array.isArray(gallery) && gallery.length) return String(gallery[0]);
  if (typeof gallery === "object" && gallery !== null) {
    const obj = gallery as Record<string, unknown>;
    if (obj.url) return String(obj.url);
    if (obj.src) return String(obj.src);
    const first = Object.values(obj)[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && first.length) return String(first[0]);
  }
  return null;
}

function extractMaterials(product: Product): string[] {
  const m = product.materials;
  if (!m) return [];
  let keys: string[] = [];
  if (typeof m === "string") {
    try {
      const parsed = JSON.parse(m);
      keys = Array.isArray(parsed) ? parsed.map(String) : Object.keys(parsed);
    } catch {
      keys = [m];
    }
  } else if (Array.isArray(m)) {
    keys = m.map((i) => (typeof i === "string" ? i : (i as Record<string, string>)?.name ?? "")).filter(Boolean);
  } else if (typeof m === "object") {
    keys = Object.keys(m as Record<string, unknown>);
  }
  return keys.filter((k) => PHYSICAL_MATERIALS.has(k.toLowerCase()));
}

// ─── Cart Widget ─────────────────────────────────────────────────────────────

function CartWidget() {
  const { items, itemCount, subtotal, removeItem, updateQuantity } = useCart();
  const [open, setOpen] = useState(false);

  if (!itemCount) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-2xl border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Your cart</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-3 space-y-2">
            {items.map((item) => (
              <div key={item.product_id} className="flex items-center gap-3 rounded-lg border bg-background/50 p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{money.format(item.unit_price)} each</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="grid h-5 w-5 place-items-center rounded border text-xs hover:bg-accent">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="grid h-5 w-5 place-items-center rounded border text-xs hover:bg-accent">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-sm font-semibold">{money.format(item.unit_price * item.quantity)}</div>
                <button onClick={() => removeItem(item.product_id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{money.format(subtotal)}</span>
            </div>
            <Button className="w-full" asChild>
              <a href="/checkout">Proceed to checkout</a>
            </Button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg text-primary-foreground hover:opacity-90 transition-opacity relative"
      >
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      </button>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, view }: { product: Product; view: "grid" | "list" }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const price = displayPrice(product);
  const imageUrl = getImageUrl(product.photo_gallery);
  const isOutOfStock = product.stock_status === "out_of_stock";
  const isOnSale = !!(product.sale_price && Number(product.sale_price) < Number(product.base_price ?? Infinity));

  function handleAdd() {
    if (isOutOfStock) return;
    addItem({ product_id: product.id, name: product.name, sku: product.sku, unit_price: price, image: imageUrl });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  if (view === "list") {
    return (
      <Card className={cn("overflow-hidden transition-shadow hover:shadow-md", isOutOfStock && "opacity-60")}>
        <div className="flex gap-4 p-4">
          <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-secondary/30">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-muted" />
              </div>
            )}
            {isOnSale && (
              <div className="absolute right-1 top-1">
                <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1 border-0">Sale</Badge>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col justify-between min-w-0">
            <div>
              <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{product.category}</div>
              <a href={`/shop/${product.slug}`} className="font-semibold hover:underline underline-offset-2 leading-tight">
                {product.name}
              </a>
              {product.tagline && <div className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{product.tagline}</div>}
            </div>
            <div className="flex items-center justify-between gap-4 mt-2">
              <div>
                <span className="text-lg font-bold leading-none">{money.format(price)}</span>
                {isOnSale && (
                  <span className="ml-2 text-sm text-muted-foreground line-through">{money.format(Number(product.base_price))}</span>
                )}
              </div>
              <Button size="sm" onClick={handleAdd} disabled={isOutOfStock} className={cn("shrink-0 transition-all", added && "bg-emerald-600 text-white")}>
                {added ? "Added!" : isOutOfStock ? "Out of stock" : <><Plus className="mr-1 h-3.5 w-3.5" />Add</>}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("group overflow-hidden transition-shadow hover:shadow-md", isOutOfStock && "opacity-60")}>
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/30">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-muted" />
          </div>
        )}
        {product.featured && (
          <div className="absolute left-2 top-2">
            <Badge className="bg-emerald-500 text-white text-xs border-0 shadow-sm">Best Seller</Badge>
          </div>
        )}
        {isOnSale && (
          <div className="absolute right-2 top-2">
            <Badge className="bg-destructive text-destructive-foreground text-xs border-0">Sale</Badge>
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">Out of stock</span>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{product.category}</div>
        <a href={`/shop/${product.slug}`} className="mb-1 block font-semibold leading-tight hover:underline underline-offset-2">
          {product.name}
        </a>
        {product.tagline && <div className="mb-3 text-sm text-muted-foreground line-clamp-2">{product.tagline}</div>}
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-lg font-bold leading-none">{money.format(price)}</div>
            {isOnSale && (
              <div className="text-xs text-muted-foreground line-through">{money.format(Number(product.base_price))}</div>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={cn("shrink-0 transition-all", added && "bg-emerald-600 text-white")}
          >
            {added ? "Added!" : isOutOfStock ? "Out of stock" : <><Plus className="mr-1 h-3.5 w-3.5" />Add to cart</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Filter Section (collapsible) ────────────────────────────────────────────

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border py-4 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-sm font-semibold text-foreground"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = useMemo<(number | "...")[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const arr: (number | "...")[] = [1];
    if (page > 3) arr.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) arr.push(i);
    if (page < totalPages - 2) arr.push("...");
    arr.push(totalPages);
    return arr;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}–{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> products
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="flex h-8 w-8 items-center justify-center rounded border text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded border text-sm transition-colors",
                page === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-8 w-8 items-center justify-center rounded border text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Main Shop Content ────────────────────────────────────────────────────────

function ShopContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [availFilter, setAvailFilter] = useState<Set<string>>(new Set());
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [showMoreMaterials, setShowMoreMaterials] = useState(false);

  function selectCategory(cat: string) {
    setCategory(cat);
    setPage(1);
    router.replace(cat === "all" ? "/shop" : `/shop?category=${encodeURIComponent(cat)}`, { scroll: false });
  }

  useEffect(() => {
    setCategory(params.get("category") ?? "all");
    setPage(1);
  }, [params]);

  useEffect(() => {
    fetch("/api/products?limit=100")
      .then((r) => r.json())
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setError("Could not load products."))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort()],
    [products]
  );

  const maxProductPrice = useMemo(() => {
    if (!products.length) return 1000;
    return Math.ceil(Math.max(...products.map(displayPrice)) / 100) * 100;
  }, [products]);

  const availCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      const s = p.stock_status ?? "in_stock";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [products]);

  const materialCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      for (const mat of extractMaterials(p)) {
        counts[mat] = (counts[mat] ?? 0) + 1;
      }
    }
    return counts;
  }, [products]);

  const sortedMaterials = useMemo(
    () => Object.entries(materialCounts).sort((a, b) => b[1] - a[1]),
    [materialCounts]
  );
  const visibleMaterials = showMoreMaterials ? sortedMaterials : sortedMaterials.slice(0, 7);
  const hasMaterials = sortedMaterials.length > 0;

  // Filtering
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (search) {
        const needle = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(needle) &&
          !(p.tagline ?? "").toLowerCase().includes(needle) &&
          !p.sku.toLowerCase().includes(needle)
        )
          return false;
      }
      if (availFilter.size > 0 && !availFilter.has(p.stock_status ?? "in_stock")) return false;
      if (priceMax !== null && displayPrice(p) > priceMax) return false;
      if (selectedMaterials.size > 0 && !extractMaterials(p).some((m) => selectedMaterials.has(m))) return false;
      return true;
    });
  }, [products, category, search, availFilter, priceMax, selectedMaterials]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "price_asc") arr.sort((a, b) => displayPrice(a) - displayPrice(b));
    else if (sortBy === "price_desc") arr.sort((a, b) => displayPrice(b) - displayPrice(a));
    else if (sortBy === "name_asc") arr.sort((a, b) => a.name.localeCompare(b.name));
    else arr.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return arr;
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageProducts = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Active filter chips
  type ActiveFilter = { label: string; clear: () => void };
  const activeFilters: ActiveFilter[] = [];
  if (availFilter.size > 0) {
    for (const s of availFilter) {
      const lbl = AVAIL_OPTIONS.find((o) => o.value === s)?.label ?? s;
      activeFilters.push({ label: lbl, clear: () => { const n = new Set(availFilter); n.delete(s); setAvailFilter(n); setPage(1); } });
    }
  }
  if (priceMax !== null) {
    activeFilters.push({ label: `Under ${money.format(priceMax)}`, clear: () => { setPriceMax(null); setPage(1); } });
  }
  for (const m of selectedMaterials) {
    activeFilters.push({ label: m, clear: () => { const n = new Set(selectedMaterials); n.delete(m); setSelectedMaterials(n); setPage(1); } });
  }

  function clearAllFilters() {
    setAvailFilter(new Set());
    setPriceMax(null);
    setSelectedMaterials(new Set());
    setSearch("");
    setPage(1);
  }

  function toggleAvail(value: string) {
    const n = new Set(availFilter);
    if (n.has(value)) n.delete(value); else n.add(value);
    setAvailFilter(n);
    setPage(1);
  }

  function toggleMaterial(mat: string) {
    const n = new Set(selectedMaterials);
    if (n.has(mat)) n.delete(mat); else n.add(mat);
    setSelectedMaterials(n);
    setPage(1);
  }

  const effectivePriceMax = priceMax ?? maxProductPrice;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <nav className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <a href="/" className="hover:text-foreground transition-colors">Home</a>
            <span>›</span>
            <span className="text-foreground">Shop</span>
          </nav>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">All products</h1>
              <p className="mt-1.5 text-muted-foreground">
                Browse our full catalog — signs, banners, wraps, business cards, and more.
              </p>
            </div>
            {!loading && (
              <p className="shrink-0 text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {sorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)}
                </span>{" "}
                of <span className="font-medium text-foreground">{sorted.length}</span> products
              </p>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex min-w-max border-b">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => selectCategory(cat)}
                className={cn(
                  "whitespace-nowrap px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                  category === cat
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content: sidebar + main */}
        <div className="flex gap-8">
          {/* ── Sidebar ───────────────────────────────────── */}
          <aside className="hidden w-56 shrink-0 lg:block">
            {/* Active filters */}
            {activeFilters.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Active filters</span>
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Clear all
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeFilters.map(({ label, clear }) => (
                    <button
                      key={label}
                      onClick={clear}
                      className="flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium hover:bg-secondary/70 transition-colors"
                    >
                      {label} <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Availability */}
            <FilterSection title="Availability">
              {AVAIL_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={availFilter.has(value)}
                    onChange={() => toggleAvail(value)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-muted-foreground">({availCounts[value] ?? 0})</span>
                </label>
              ))}
            </FilterSection>

            {/* Price */}
            <FilterSection title="Price">
              <div className="flex items-center gap-2">
                <div className="flex h-8 flex-1 items-center gap-0.5 rounded border bg-background px-2 text-sm">
                  <span className="text-muted-foreground">$</span>
                  <input type="number" value={0} readOnly className="w-full bg-transparent focus:outline-none" />
                </div>
                <span className="text-muted-foreground text-sm">—</span>
                <div className="flex h-8 flex-1 items-center gap-0.5 rounded border bg-background px-2 text-sm">
                  <span className="text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={effectivePriceMax}
                    min={0}
                    max={maxProductPrice}
                    onChange={(e) => { setPriceMax(Number(e.target.value)); setPage(1); }}
                    className="w-full bg-transparent focus:outline-none"
                  />
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={maxProductPrice}
                value={effectivePriceMax}
                onChange={(e) => { setPriceMax(Number(e.target.value)); setPage(1); }}
                className="mt-2 w-full accent-primary"
              />
            </FilterSection>

            {/* Material */}
            {hasMaterials && (
              <FilterSection title="Material">
                {visibleMaterials.map(([mat, count]) => (
                  <label key={mat} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedMaterials.has(mat)}
                      onChange={() => toggleMaterial(mat)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="flex-1 capitalize">{mat}</span>
                    <span className="text-xs text-muted-foreground">({count})</span>
                  </label>
                ))}
                {sortedMaterials.length > 7 && (
                  <button
                    onClick={() => setShowMoreMaterials(!showMoreMaterials)}
                    className="mt-1 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {showMoreMaterials ? "Show less" : `Show ${sortedMaterials.length - 7} more`}
                  </button>
                )}
              </FilterSection>
            )}
          </aside>

          {/* ── Main content ───────────────────────────────── */}
          <div className="min-w-0 flex-1">
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* Mobile active filter chips */}
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 lg:hidden">
                  {activeFilters.map(({ label, clear }) => (
                    <button
                      key={label}
                      onClick={clear}
                      className="flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium"
                    >
                      {label} <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}

              {/* Search */}
              <input
                type="search"
                placeholder="Search products…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 rounded-lg border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring lg:w-52"
              />

              <div className="ml-auto flex items-center gap-2">
                {/* View toggle */}
                <div className="flex overflow-hidden rounded-lg border">
                  <button
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center transition-colors",
                      viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center border-l transition-colors",
                      viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Sort */}
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  Sort by:
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                    className="h-8 rounded-lg border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div className={cn("grid gap-5", viewMode === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-xl bg-secondary" />
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
            )}

            {/* Products */}
            {!loading && !error && (
              <>
                {pageProducts.length ? (
                  <div className={cn("grid gap-5", viewMode === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
                    {pageProducts.map((product) => (
                      <ProductCard key={product.id} product={product} view={viewMode} />
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center text-muted-foreground">
                    <div className="mb-2 text-4xl">🛒</div>
                    <div className="font-medium">No products found</div>
                    <div className="mt-1 text-sm">Try different filters or search terms.</div>
                    {(activeFilters.length > 0 || search) && (
                      <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-4">
                        Clear all filters
                      </Button>
                    )}
                  </div>
                )}

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={sorted.length}
                  pageSize={PAGE_SIZE}
                  onChange={(p) => {
                    setPage(p);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </>
            )}
          </div>
        </div>
      </main>

      <CartWidget />
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function ShopPage() {
  return (
    <CartProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-white dark:bg-zinc-950">
            <div className="mx-auto max-w-7xl px-4 py-8">
              <div className="mb-8 h-10 w-48 animate-pulse rounded-lg bg-secondary" />
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-xl bg-secondary" />
                ))}
              </div>
            </div>
          </div>
        }
      >
        <ShopContent />
      </Suspense>
    </CartProvider>
  );
}
