"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus, ShoppingCart, Tag, X } from "lucide-react";

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
  images: unknown;
  color: string | null;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function displayPrice(product: Product) {
  return Number(product.sale_price || product.base_price || 0);
}

function getImageUrl(images: unknown): string | null {
  if (!images) return null;
  if (typeof images === "string") return images;
  if (Array.isArray(images) && images.length) return String(images[0]);
  if (typeof images === "object" && images !== null) {
    const obj = images as Record<string, unknown>;
    if (obj.url) return String(obj.url);
    if (obj.src) return String(obj.src);
    const first = Object.values(obj)[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && first.length) return String(first[0]);
  }
  return null;
}

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
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-64 overflow-y-auto p-3 space-y-2">
            {items.map((item) => (
              <div key={item.product_id} className="flex items-center gap-3 rounded-lg border bg-background/50 p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{money.format(item.unit_price)} each</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="grid h-5 w-5 place-items-center rounded border text-xs hover:bg-accent"><Minus className="h-3 w-3" /></button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="grid h-5 w-5 place-items-center rounded border text-xs hover:bg-accent"><Plus className="h-3 w-3" /></button>
                </div>
                <div className="text-sm font-semibold">{money.format(item.unit_price * item.quantity)}</div>
                <button onClick={() => removeItem(item.product_id)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
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

function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const price = displayPrice(product);
  const imageUrl = getImageUrl(product.images);
  const isOutOfStock = product.stock_status === "out_of_stock";

  function handleAdd() {
    if (isOutOfStock) return;
    addItem({ product_id: product.id, name: product.name, sku: product.sku, unit_price: price, image: imageUrl });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <Card className={cn("group overflow-hidden transition-shadow hover:shadow-md", isOutOfStock && "opacity-60")}>
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/30">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-16 w-16 rounded-full" style={{ backgroundColor: product.color || "#6b7280", opacity: 0.3 }} />
          </div>
        )}
        {product.featured && (
          <div className="absolute left-2 top-2">
            <Badge className="border-primary/20 bg-primary/15 text-xs font-medium"><Tag className="mr-1 h-3 w-3" />Featured</Badge>
          </div>
        )}
        {product.sale_price && Number(product.sale_price) < Number(product.base_price || Infinity) && (
          <div className="absolute right-2 top-2">
            <Badge className="bg-destructive text-destructive-foreground text-xs">Sale</Badge>
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
        <a href={`/shop/${product.slug}`} className="mb-1 block font-semibold leading-tight hover:underline underline-offset-2">{product.name}</a>
        {product.tagline && <div className="mb-3 text-sm text-muted-foreground line-clamp-2">{product.tagline}</div>}
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-lg font-bold leading-none">{money.format(price)}</div>
            {product.sale_price && Number(product.sale_price) < Number(product.base_price || Infinity) && (
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

function ShopContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(params.get("category") || "all");

  function selectCategory(cat: string) {
    setCategory(cat);
    const url = cat === "all" ? "/shop" : `/shop?category=${encodeURIComponent(cat)}`;
    router.replace(url, { scroll: false });
  }

  // Sync category when URL param changes (e.g. browser back/forward)
  useEffect(() => {
    setCategory(params.get("category") || "all");
  }, [params]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setError("Could not load products."))
      .finally(() => setLoading(false));
  }, []);

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort()];

  const filtered = products.filter((p) => {
    const matchesCategory = category === "all" || p.category === category;
    const needle = search.toLowerCase();
    const matchesSearch = !needle || p.name.toLowerCase().includes(needle) || (p.tagline || "").toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Print Shop</h1>
          <p className="mt-2 text-muted-foreground">Custom print products — banners, signs, cards, apparel and more.</p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => selectCategory(cat)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors", category === cat ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground")}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        )}

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        {!loading && !error && (
          <>
            {filtered.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <div className="mb-2 text-4xl">&#128722;</div>
                <div className="font-medium">No products found</div>
                <div className="mt-1 text-sm">Try a different category or search term.</div>
              </div>
            )}
          </>
        )}
      </main>

      <CartWidget />
    </div>
  );
}

export function ShopPage() {
  return (
    <CartProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-white dark:bg-zinc-950">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-8 h-10 w-48 animate-pulse rounded-lg bg-secondary" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-secondary" />)}
            </div>
          </div>
        </div>
      }>
        <ShopContent />
      </Suspense>
    </CartProvider>
  );
}
