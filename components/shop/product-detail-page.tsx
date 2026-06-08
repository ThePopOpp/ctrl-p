"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Minus, Plus, ShoppingCart, Tag } from "lucide-react";

import { CartProvider, useCart } from "@/lib/cart/cart-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  sizes: unknown;
  materials: unknown;
  print_options: unknown;
  turnaround_times: unknown;
  quantity_tiers: unknown;
  customizer_enabled: boolean | null;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function getImages(gallery: unknown): string[] {
  if (!gallery) return [];
  if (typeof gallery === "string") return [gallery];
  if (Array.isArray(gallery)) return gallery.map(String).filter(Boolean);
  if (typeof gallery === "object" && gallery !== null) {
    const obj = gallery as Record<string, unknown>;
    const vals = Object.values(obj);
    return vals.flatMap((v) => Array.isArray(v) ? v.map(String) : [String(v)]).filter(Boolean);
  }
  return [];
}

function toArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>).map(String).filter(Boolean);
  }
  if (typeof value === "string") {
    try { return toArray(JSON.parse(value)); } catch { return [value]; }
  }
  return [];
}

function SpecSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full border bg-secondary/50 px-2.5 py-0.5 text-xs">{item}</span>
        ))}
      </div>
    </div>
  );
}

function ProductDetailContent({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    fetch(`/api/products?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.products?.[0];
        if (!found) setError("Product not found.");
        else setProduct(found);
      })
      .catch(() => setError("Could not load product."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="mb-4 text-4xl">&#128722;</div>
        <h1 className="mb-2 text-xl font-bold">{error || "Product not found"}</h1>
        <Button variant="outline" asChild><a href="/shop"><ArrowLeft className="mr-2 h-4 w-4" />Back to shop</a></Button>
      </div>
    );
  }

  const price = Number(product.sale_price || product.base_price || 0);
  const images = getImages(product.photo_gallery);
  const isOutOfStock = product.stock_status === "out_of_stock";
  const hasSalePrice = product.sale_price && Number(product.sale_price) < Number(product.base_price || Infinity);

  function handleAddToCart() {
    if (isOutOfStock) return;
    addItem({ product_id: product!.id, name: product!.name, sku: product!.sku, unit_price: price, image: images[0] || null, quantity });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <a href="/shop" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back to shop
        </a>

        <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
          {/* Images */}
          <div>
            <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-2xl bg-secondary/30">
              {images.length ? (
                <img src={images[activeImage]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="h-24 w-24 rounded-full" style={{ backgroundColor: "#6b7280", opacity: 0.3 }} />
                </div>
              )}
              {product.featured && (
                <div className="absolute left-3 top-3">
                  <Badge className="border-primary/20 bg-primary/15 text-xs"><Tag className="mr-1 h-3 w-3" />Featured</Badge>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.slice(0, 6).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={cn("h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors", activeImage === i ? "border-primary" : "border-transparent opacity-60 hover:opacity-100")}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info + add to cart */}
          <div className="space-y-5">
            <div>
              <div className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">{product.category}</div>
              <h1 className="text-3xl font-bold leading-tight">{product.name}</h1>
              {product.tagline && <p className="mt-2 text-muted-foreground">{product.tagline}</p>}
            </div>

            <div className="flex items-end gap-3">
              <div className="text-3xl font-bold">{money.format(price)}</div>
              {hasSalePrice && (
                <div className="text-lg text-muted-foreground line-through">{money.format(Number(product.base_price))}</div>
              )}
              {hasSalePrice && <Badge className="bg-destructive text-destructive-foreground">Sale</Badge>}
            </div>

            {isOutOfStock ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium">
                Currently out of stock
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="mb-2 text-sm font-medium">Quantity</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-accent"
                    ><Minus className="h-4 w-4" /></button>
                    <span className="w-12 text-center text-base font-semibold">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-accent"
                    ><Plus className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className={cn("flex-1 gap-2 transition-all", added && "bg-emerald-600 text-white hover:bg-emerald-700")}
                    onClick={handleAddToCart}
                  >
                    {added ? <><Check className="h-4 w-4" />Added to cart!</> : <><ShoppingCart className="h-4 w-4" />Add to cart &mdash; {money.format(price * quantity)}</>}
                  </Button>
                </div>

                {added && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" asChild><a href="/checkout">Go to checkout</a></Button>
                    <Button variant="outline" className="flex-1" asChild><a href="/shop">Continue shopping</a></Button>
                  </div>
                )}
              </div>
            )}

            {/* Specs */}
            <div className="space-y-4 border-t pt-5">
              <SpecSection title="Sizes" items={toArray(product.sizes)} />
              <SpecSection title="Materials" items={toArray(product.materials)} />
              <SpecSection title="Print options" items={toArray(product.print_options)} />
              <SpecSection title="Turnaround" items={toArray(product.turnaround_times)} />
            </div>

            <div className="text-xs text-muted-foreground">SKU: {product.sku}</div>
          </div>
        </div>

        {/* Full description */}
        {product.description && (
          <div className="mt-10 border-t pt-8">
            <h2 className="mb-4 text-xl font-semibold">Product details</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
              {product.description.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </main>
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
