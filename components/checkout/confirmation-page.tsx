"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type OrderConfirmation = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  production_status: string;
  customer_email: string;
  subtotal: number | string;
  discount_amount: number | string | null;
  total: number | string;
  shipping_method: string | null;
  customer_notes: string | null;
  created_at: string;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
    products: { id: string; name: string; sku: string; category: string } | null;
  }>;
  payment: {
    id: string;
    status: string;
    amount: number | string;
    provider: string;
    method: string;
    payment_link_url: string | null;
  } | null;
};

function statusTone(status: string) {
  if (["paid", "completed"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["pending", "awaiting_payment"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  if (["failed", "cancelled"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-secondary text-secondary-foreground";
}

function human(value: string | null | undefined) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function ConfirmationPage() {
  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");

    if (!orderId) {
      setError("No order ID found.");
      setLoading(false);
      return;
    }

    fetch(`/api/checkout/confirmation?order_id=${encodeURIComponent(orderId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setOrder(data.order);
      })
      .catch(() => setError("Could not load order details."))
      .finally(() => setLoading(false));
  }, []);

  const isPaid = order?.payment_status === "paid";
  const isPending = order?.payment_status === "pending" || order?.status === "awaiting_payment";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4">
          <a href="/"><img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-7 w-auto dark:hidden" /><img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-7 w-auto dark:block" /></a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mb-3 h-8 w-8 animate-spin" />
            <span>Loading your order...</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <div className="mb-2 font-semibold text-destructive">Could not load order</div>
            <div className="text-sm text-muted-foreground">{error}</div>
            <Button className="mt-4" asChild><a href="/shop">Back to shop</a></Button>
          </div>
        )}

        {order && !loading && (
          <div className="space-y-6">
            {/* Hero */}
            <div className="rounded-xl border bg-card p-6 text-center">
              {isPaid ? (
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
              ) : isPending ? (
                <Clock className="mx-auto mb-3 h-12 w-12 text-primary" />
              ) : (
                <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              )}
              <h1 className="text-2xl font-bold">{isPaid ? "Payment confirmed!" : isPending ? "Order received!" : "Order placed"}</h1>
              <p className="mt-2 text-muted-foreground">
                {isPaid
                  ? "Your payment was successful. We'll start working on your order shortly."
                  : isPending
                  ? "Your order has been placed. Complete payment to begin production."
                  : "Your order has been submitted."}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-secondary/50 px-4 py-1.5 text-sm font-mono font-medium">
                Order #{order.order_number}
              </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap justify-center gap-2">
              <Badge className={cn("border", statusTone(order.status))}>{human(order.status)}</Badge>
              <Badge className={cn("border", statusTone(order.payment_status))}>{human(order.payment_status)}</Badge>
            </div>

            {/* Items */}
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Items ordered</h2>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.products?.name || "Product"}</div>
                      <div className="text-xs text-muted-foreground">{item.products?.category || ""} &bull; Qty {item.quantity}</div>
                    </div>
                    <div className="text-sm font-semibold">{money.format(Number(item.line_total))}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{money.format(Number(order.subtotal))}</span>
                </div>
                {order.discount_amount && Number(order.discount_amount) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Discount applied</span>
                    <span>-{money.format(Number(order.discount_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{money.format(Number(order.total))}</span>
                </div>
              </div>
            </div>

            {/* Payment action */}
            {isPending && order.payment?.payment_link_url && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="mb-3 text-sm text-muted-foreground">Payment is still pending. Complete it to start your order.</p>
                <Button asChild>
                  <a href={order.payment.payment_link_url} target="_blank" rel="noopener noreferrer">Complete payment</a>
                </Button>
              </div>
            )}

            {/* Confirmation email note */}
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">What happens next?</div>
              <ul className="mt-2 space-y-1.5 list-disc pl-4">
                <li>A confirmation has been recorded for <span className="font-medium text-foreground">{order.customer_email}</span>.</li>
                <li>Our team will review your order and reach out if we need anything.</li>
                {order.shipping_method && <li>Delivery method: <span className="capitalize">{human(order.shipping_method)}</span>.</li>}
                <li>Track your order from your <a href="/dashboard/customer/orders" className="underline underline-offset-2 hover:text-foreground">customer dashboard</a>.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild><a href="/shop">Continue shopping</a></Button>
              <Button variant="outline" asChild><a href="/dashboard/customer/orders">View my orders</a></Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
