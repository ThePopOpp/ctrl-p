"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  LogIn,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";

import { CartProvider, useCart, type CartItem } from "@/lib/cart/cart-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  base_price: number | string | null;
  sale_price: number | string | null;
  photo_gallery: unknown;
  featured: boolean | null;
};

type CouponResult = {
  valid: boolean;
  coupon: { id: string; code: string; description: string | null; discount_type: string; discount_value: number };
  discount_amount: number;
  discounted_total: number;
};

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

// ─── Cart item row ────────────────────────────────────────────────────────────

function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart();
  const isDesignerSession = item.product_id.startsWith("designer-booking-");

  return (
    <div className="flex gap-4 py-5 border-b last:border-0">
      {/* Image / icon */}
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary/40 flex items-center justify-center">
        {item.image ? (
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
            {isDesignerSession ? "Design Service" : item.sku}
          </p>
          <p className="font-semibold leading-snug line-clamp-2">{item.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{money.format(item.unit_price)} each</p>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {/* Quantity controls — designer sessions are fixed qty 1 */}
          {isDesignerSession ? (
            <span className="text-xs text-muted-foreground">1 session</span>
          ) : (
            <div className="flex items-center gap-1 rounded-lg border">
              <button
                onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                className="grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                className="grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={() => removeItem(item.product_id)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>

      {/* Line total */}
      <div className="shrink-0 text-right">
        <p className="font-bold">{money.format(item.unit_price * item.quantity)}</p>
      </div>
    </div>
  );
}

// ─── Upsell card ─────────────────────────────────────────────────────────────

function UpsellCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const price = Number(product.sale_price || product.base_price || 0);
  const imageUrl = getImageUrl(product.photo_gallery);

  function handleAdd() {
    addItem({
      product_id: product.id,
      name: product.name,
      sku: product.slug.toUpperCase(),
      unit_price: price,
      image: imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-sm transition-shadow">
      <a href={`/shop/${product.slug}`}>
        <div className="aspect-[4/3] overflow-hidden bg-secondary/30">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </a>
      <div className="p-3">
        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{product.category}</p>
        <a href={`/shop/${product.slug}`} className="block text-sm font-semibold leading-tight hover:underline underline-offset-2 line-clamp-2 mb-2">
          {product.name}
        </a>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">{money.format(price)}</p>
          <button
            onClick={handleAdd}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              added
                ? "bg-emerald-500 text-white"
                : "border hover:bg-accent"
            )}
          >
            {added ? <><CheckCircle2 className="h-3 w-3" />Added</> : <><Plus className="h-3 w-3" />Add</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Auth nudge ───────────────────────────────────────────────────────────────

function AuthNudge() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const db = getSupabaseBrowserClient();
        if (!db) { setChecking(false); return; }
        const { data } = await db.auth.getSession();
        setUserEmail(data.session?.user?.email ?? null);
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    }
    check();
  }, []);

  if (checking) return null;

  if (userEmail) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Signed in</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary">
          <LogIn className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Faster checkout</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sign in to pre-fill your details, track orders, and manage proofs.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
              <a href="/login?redirect=/cart">Sign in</a>
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" asChild>
              <a href="/signup?redirect=/cart">Create account</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main cart content ────────────────────────────────────────────────────────

function CartContent() {
  const { items, subtotal, itemCount } = useCart();
  const [upsells, setUpsells] = useState<Product[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const cartProductIds = new Set(items.map((i) => i.product_id));
  const discountAmount = couponResult?.discount_amount ?? 0;
  const total = Math.max(0, subtotal - discountAmount);

  // Fetch recommended products (featured, exclude items already in cart)
  useEffect(() => {
    fetch("/api/products?featured=true&limit=8")
      .then((r) => r.json())
      .then((d) => {
        const products: Product[] = d.products ?? [];
        setUpsells(products.filter((p) => !cartProductIds.has(p.id)).slice(0, 4));
      })
      .catch(() => {});
  }, [items.length]);

  async function validateCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    setCouponResult(null);
    try {
      const res = await fetch("/api/checkout/validate-coupon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, order_total: subtotal }),
      });
      const data = await res.json();
      if (!res.ok) setCouponError(data.error || "Invalid coupon code.");
      else setCouponResult(data);
    } catch {
      setCouponError("Could not validate coupon. Try again.");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponResult(null);
    setCouponCode("");
    setCouponError("");
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!items.length) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-secondary">
            <ShoppingCart className="h-9 w-9 text-muted-foreground" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Your cart is empty</h1>
          <p className="mb-8 text-muted-foreground">Looks like you haven't added anything yet.</p>
          <Button asChild className="h-11 px-8 text-base">
            <a href="/shop">Browse products</a>
          </Button>

          {upsells.length > 0 && (
            <div className="mt-16 text-left">
              <h2 className="mb-4 text-lg font-semibold">Popular products</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {upsells.map((p) => <UpsellCard key={p.id} product={p} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground">Home</a>
          <span>›</span>
          <a href="/shop" className="hover:text-foreground">Shop</a>
          <span>›</span>
          <span className="font-medium text-foreground">Cart</span>
        </nav>

        <h1 className="mb-8 text-3xl font-bold tracking-tight">
          Your cart
          <span className="ml-3 text-lg font-normal text-muted-foreground">({itemCount} {itemCount === 1 ? "item" : "items"})</span>
        </h1>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* ── Left: items + upsells ── */}
          <div>
            {/* Cart items */}
            <div className="rounded-xl border bg-card px-5">
              {items.map((item) => (
                <CartItemRow key={item.product_id} item={item} />
              ))}
            </div>

            <div className="mt-4 flex justify-between items-center">
              <a href="/shop" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Continue shopping
              </a>
              <p className="text-sm text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""} in your cart</p>
            </div>

            {/* Upsell section */}
            {upsells.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">You might also like</h2>
                  <a href="/shop" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    See all <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  {upsells.map((p) => <UpsellCard key={p.id} product={p} />)}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: summary + actions ── */}
          <div className="space-y-4">
            {/* Auth nudge */}
            <AuthNudge />

            {/* Order summary */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 text-base font-semibold">Order summary</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</span>
                  <span>{money.format(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount ({couponResult?.coupon.code})</span>
                    <span>−{money.format(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div className="mt-4 border-t pt-4 flex justify-between text-base font-bold">
                <span>Estimated total</span>
                <span>{money.format(total)}</span>
              </div>

              <Button className="mt-5 w-full h-11 text-base font-semibold gap-2" asChild>
                <a href="/checkout">
                  Proceed to checkout
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Secure checkout powered by Square
              </p>
            </div>

            {/* Coupon code */}
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Tag className="h-4 w-4" />
                Coupon code
              </h2>
              {couponResult ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      {couponResult.coupon.code}
                    </div>
                    {couponResult.coupon.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{couponResult.coupon.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      Saves {money.format(discountAmount)}
                    </p>
                  </div>
                  <button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
                    placeholder="COUPON CODE"
                    className="font-mono uppercase"
                  />
                  <Button variant="outline" onClick={validateCoupon} disabled={couponLoading || !couponCode.trim()}>
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              )}
              {couponError && <p className="mt-2 text-xs text-destructive">{couponError}</p>}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
              {([
                { Icon: Lock, label: "Secure", sub: "SSL checkout" },
                { Icon: Truck, label: "Free ship", sub: "orders $75+" },
                { Icon: ShieldCheck, label: "Guarantee", sub: "or reprint free" },
              ] as const).map((b) => (
                <div key={b.label} className="rounded-lg border bg-card py-3">
                  <b.Icon className="mx-auto h-5 w-5 text-muted-foreground" />
                  <div className="mt-1.5 font-medium text-foreground">{b.label}</div>
                  <div>{b.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function CartPage() {
  return (
    <CartProvider>
      <CartContent />
    </CartProvider>
  );
}
