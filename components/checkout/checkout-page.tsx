"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus, Tag, Trash2, X } from "lucide-react";

import { CartProvider, useCart } from "@/lib/cart/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type CouponResult = {
  valid: boolean;
  coupon: { id: string; code: string; description: string | null; discount_type: string; discount_value: number };
  discount_amount: number;
  discounted_total: number;
};

function CheckoutContent() {
  const { items, subtotal, removeItem, updateQuantity, clearCart } = useCart();

  // Customer info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [shippingMethod, setShippingMethod] = useState("pickup");
  const [customerNotes, setCustomerNotes] = useState("");

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // Checkout
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const discountAmount = couponResult?.discount_amount ?? 0;
  const total = Math.max(0, subtotal - discountAmount);

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
      if (!res.ok) {
        setCouponError(data.error || "Invalid coupon code.");
      } else {
        setCouponResult(data);
      }
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

  async function handleCheckout() {
    if (!items.length) return;
    setError("");

    if (!firstName.trim()) { setError("First name is required."); return; }
    if (!lastName.trim()) { setError("Last name is required."); return; }
    if (!email.trim()) { setError("Email address is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid email address."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            name: item.name,
          })),
          coupon_code: couponResult?.coupon.code || undefined,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          shipping_method: shippingMethod,
          customer_notes: customerNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create order.");
        return;
      }

      clearCart();
      window.location.href = data.payment_link_url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!items.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="mb-4 text-5xl">&#128722;</div>
        <h1 className="mb-2 text-2xl font-bold">Your cart is empty</h1>
        <p className="mb-6 text-muted-foreground">Add products from the shop to continue.</p>
        <Button asChild><a href="/shop">Browse products</a></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <a href="/"><img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-7 w-auto dark:hidden" /><img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-7 w-auto dark:block" /></a>
          <span className="text-muted-foreground">/</span>
          <a href="/shop" className="text-sm text-muted-foreground hover:text-foreground">Shop</a>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Checkout</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Checkout</h1>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Left: customer info */}
          <div className="space-y-6">
            <section>
              <h2 className="mb-4 text-base font-semibold">Contact information</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">First name *</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Last name *</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email *</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone</label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Company</label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" />
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-base font-semibold">Delivery method</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "pickup", label: "Store pickup", description: "Pick up at our location" },
                  { value: "local_delivery", label: "Local delivery", description: "Delivered to your address" },
                  { value: "ship", label: "Shipping", description: "Shipped via carrier" },
                  { value: "install", label: "Installation", description: "We handle installation" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setShippingMethod(option.value)}
                    className={cn("rounded-lg border p-3 text-left transition-colors", shippingMethod === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50")}
                  >
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-base font-semibold">Order notes</h2>
              <Textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Special instructions, sizes, colors, file references..."
                rows={3}
              />
            </section>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button onClick={handleCheckout} disabled={submitting} className="w-full sm:w-auto h-11 text-base px-8">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Pay with Square"}
            </Button>
            <p className="text-xs text-muted-foreground">You will be redirected to Square to complete payment securely.</p>
          </div>

          {/* Right: order summary */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Order summary</h2>

              <div className="space-y-2 divide-y">
                {items.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 pt-2 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{money.format(item.unit_price)} × {item.quantity}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="grid h-5 w-5 place-items-center rounded border text-muted-foreground hover:text-foreground"><Minus className="h-3 w-3" /></button>
                      <span className="w-5 text-center text-xs font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="grid h-5 w-5 place-items-center rounded border text-muted-foreground hover:text-foreground"><Plus className="h-3 w-3" /></button>
                      <button onClick={() => removeItem(item.product_id)} className="ml-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="text-sm font-semibold">{money.format(item.unit_price * item.quantity)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{money.format(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Discount ({couponResult?.coupon.code})</span>
                    <span>-{money.format(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{money.format(total)}</span>
                </div>
              </div>
            </div>

            {/* Coupon code */}
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold flex items-center gap-2"><Tag className="h-4 w-4" />Coupon code</h2>
              {couponResult ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      {couponResult.coupon.code}
                    </div>
                    {couponResult.coupon.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{couponResult.coupon.description}</div>
                    )}
                    <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Saves {money.format(discountAmount)}</div>
                  </div>
                  <button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
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
              {couponError && <div className="mt-2 text-xs text-destructive">{couponError}</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function CheckoutPage() {
  return (
    <CartProvider>
      <CheckoutContent />
    </CartProvider>
  );
}
