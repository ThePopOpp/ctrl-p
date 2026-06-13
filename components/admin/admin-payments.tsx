"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Moon,
  ReceiptText,
  Search,
  Sun,
  WalletCards,
} from "lucide-react";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import { createAdminInvoice, createSquareCardPayment, createSquarePaymentLink, createSquareRefund, deliverPaymentDocument, getCurrentAdminProfile, loadAdminDashboardData, loadSquarePaymentConfig, updateAdminInvoice } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, Order, Payment, Product } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function statusTone(status: string) {
  if (["paid", "completed"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["pending", "partially_paid"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  if (["failed", "unpaid", "refunded", "partially_refunded"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-secondary text-secondary-foreground";
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

export function AdminPayments() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [refundPayment, setRefundPayment] = useState<Payment | null>(null);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [sendMenuId, setSendMenuId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }

      setAuthState("allowed");
      setData(await loadAdminDashboardData());
    }

    boot();
  }, []);

  useEffect(() => {
    if (!sendMenuId) return;
    function close() { setSendMenuId(null); }
    document.addEventListener("click", close, { capture: true, once: true });
    return () => document.removeEventListener("click", close, { capture: true });
  }, [sendMenuId]);

  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const paidTotal = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const pendingTotal = payments.filter((payment) => ["pending", "unpaid", "partially_paid"].includes(payment.status)).reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const processorBreakdown = useMemo(() => breakdownByProvider(payments), [payments]);

  async function refreshPayments() {
    setData(await loadAdminDashboardData());
  }

  function openPaymentDocument(paymentId: string, kind: "invoice" | "receipt") {
    window.open(`/api/payments/${paymentId}/document?kind=${kind}`, "_blank", "noopener,noreferrer");
  }

  async function sendPaymentDocument(payment: Payment, kind: "invoice" | "receipt", channel: "email" | "sms") {
    setSendMenuId(null);
    setNotice(`Sending ${kind} by ${channel}...`);
    try {
      await deliverPaymentDocument({ paymentId: payment.id, kind, channel });
      setNotice(`${human(kind)} sent by ${channel}.`);
      await refreshPayments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Could not send ${kind}.`);
    }
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-[45px] px-2 pt-[5px]">
            <a href="/admin">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
            </a>
          </div>

          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                {group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link
                      href={href}
                      key={label}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="absolute bottom-3 left-3 right-3">
            <div className="mb-3 border-t border-border" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold">JW</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">Jeremy Waters</div>
                <div className="truncate text-[10px] text-muted-foreground">Owner - Super Admin</div>
              </div>
              <button onClick={handleSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span>Super Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Payments</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search payments, invoices, customers..." />
              </div>
              <AdminNotificationBell />
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30">
              <CardContent className="p-5">
                <div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div>
                <p className="mt-2 text-sm text-muted-foreground">Sign in with an active staff or admin account before opening payments.</p>
                <Button className="mt-4" asChild><a href="/login?redirect=/admin/payments">Go to login</a></Button>
              </CardContent>
            </Card>
          )}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Payments command center</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                    Customer payments, billing, referral and reseller payouts, invoices, receipts, credits, cards, ACH, Stripe, PayPal, and Square workflows.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setInvoiceOpen(true)}><ReceiptText className="h-4 w-4" /> New invoice</Button>
                  <Button variant="outline" onClick={() => setPaymentOpen(true)}><CreditCard className="h-4 w-4" /> Process payment</Button>
                </div>
              </div>

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <PaymentStat icon={<CircleDollarSign />} label="Collected" value={money.format(paidTotal)} hint={`${payments.filter((p) => p.status === "paid").length} paid records`} />
                <PaymentStat icon={<WalletCards />} label="Pending" value={money.format(pendingTotal)} hint="Open invoices and partials" />
                <PaymentStat icon={<ReceiptText />} label="Invoices" value={String(payments.length)} hint="Payment records tracked" />
                <PaymentStat icon={<CreditCard />} label="Cards / ACH" value={String(processorBreakdown.cardAch)} hint="Manual, card, ACH lanes" />
                <PaymentStat icon={<FileText />} label="PDF exports" value="PDFX" hint="Invoices and receipts planned" />
              </section>

              <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Payment activity</CardTitle>
                    <CardDescription>Recent charges, invoices, manual payments, refunds, and processor status</CardDescription>
                    {notice && <div className="rounded-md border bg-background/50 px-3 py-2 text-xs text-muted-foreground">{notice}</div>}
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Payment</TableHead>
                          <TableHead>Processor</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right pr-4">Documents</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="pl-4 font-mono text-xs">{payment.id.slice(0, 8)}</TableCell>
                            <TableCell>{human(payment.provider)}</TableCell>
                            <TableCell>{human(payment.method)}</TableCell>
                            <TableCell><Badge className={cn("border", statusTone(payment.status))}>{human(payment.status)}</Badge></TableCell>
                            <TableCell className="text-right font-semibold">{money.format(numberValue(payment.amount))}</TableCell>
                            <TableCell className="pr-4">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => setEditPayment(payment)}>Edit</Button>
                                <Button size="sm" variant="outline" onClick={() => openPaymentDocument(payment.id, "invoice")}>View</Button>
                                <Button size="sm" variant="outline" onClick={() => window.open(`/api/payments/${payment.id}/document?kind=invoice&autoprint=1`, "_blank", "noopener,noreferrer")}>Download PDF</Button>
                                <SendFab
                                  id={payment.id}
                                  label="Send"
                                  open={sendMenuId === payment.id}
                                  onToggle={() => setSendMenuId(sendMenuId === payment.id ? null : payment.id)}
                                  onEmail={() => sendPaymentDocument(payment, "invoice", "email")}
                                  onSms={() => sendPaymentDocument(payment, "invoice", "sms")}
                                />
                                {payment.status === "paid" && (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => openPaymentDocument(payment.id, "receipt")}>Receipt</Button>
                                    <SendFab
                                      id={`${payment.id}-receipt`}
                                      label="Send receipt"
                                      open={sendMenuId === `${payment.id}-receipt`}
                                      onToggle={() => setSendMenuId(sendMenuId === `${payment.id}-receipt` ? null : `${payment.id}-receipt`)}
                                      onEmail={() => sendPaymentDocument(payment, "receipt", "email")}
                                      onSms={() => sendPaymentDocument(payment, "receipt", "sms")}
                                    />
                                    {payment.provider === "square" && (
                                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-600 dark:text-red-400" onClick={() => setRefundPayment(payment)}>Refund</Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!payments.length && (
                          <TableRow>
                            <TableCell className="p-6 text-center text-muted-foreground" colSpan={6}>No live payment records yet.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Processor lanes</CardTitle>
                    <CardDescription>Stripe, PayPal, Square, cards, ACH, and manual payments</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {processorBreakdown.rows.map((row) => (
                      <div key={row.label} className="rounded-lg border bg-background/35 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{row.label}</span>
                          <Badge variant="outline">{money.format(row.amount)}</Badge>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${row.width}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <WorkflowCard title="Customer billing" items={["Invoices", "Receipts", "Credits", "Refunds"]} />
                <WorkflowCard title="Partner payouts" items={["Referral rewards", "Reseller commissions", "Vendor payments", "1099-ready history"]} />
                <WorkflowCard title="PDF documents" items={["PDFX invoice template", "Receipt downloads", "Quote PDFs", "Proof packets"]} />
              </section>
            </>
          )}
        </main>
        <EditInvoiceSheet
          payment={editPayment}
          open={!!editPayment}
          onOpenChange={(open) => { if (!open) setEditPayment(null); }}
          onSaved={refreshPayments}
        />
        <RefundDialog
          payment={refundPayment}
          onClose={() => setRefundPayment(null)}
          onRefunded={refreshPayments}
        />
        <NewInvoiceSheet
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
          orders={orders}
          products={data?.products ?? []}
          onCreated={refreshPayments}
        />
        <ProcessPaymentSheet
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          orders={orders}
          products={data?.products ?? []}
          onCreated={refreshPayments}
        />
      </div>
    </div>
  );
}

function SendFab({
  id,
  label,
  open,
  onToggle,
  onEmail,
  onSms,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  onEmail: () => void;
  onSms: () => void;
}) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {/* FAB actions — float upward above trigger */}
      <div
        className={cn(
          "absolute bottom-full right-0 mb-2 flex flex-col items-end gap-1.5 transition-all duration-150",
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <button
          onClick={onEmail}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md hover:bg-accent"
        >
          Email
        </button>
        <button
          onClick={onSms}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md hover:bg-accent"
        >
          SMS
        </button>
      </div>
      <Button size="sm" variant={open ? "default" : "outline"} onClick={onToggle}>
        {label}
      </Button>
    </div>
  );
}

function breakdownByProvider(payments: Payment[]) {
  const totals = new Map<string, number>();
  let cardAch = 0;

  for (const payment of payments) {
    const provider = human(payment.provider || "manual");
    totals.set(provider, (totals.get(provider) || 0) + numberValue(payment.amount));
    if (["card", "card_terminal", "ach"].includes(String(payment.method || ""))) cardAch += 1;
  }

  const max = Math.max(1, ...Array.from(totals.values()));
  const rows = Array.from(totals.entries()).map(([label, amount]) => ({
    label,
    amount,
    width: Math.max(8, Math.round((amount / max) * 100)),
  }));

  return {
    cardAch,
    rows: rows.length ? rows : [
      { label: "Stripe", amount: 0, width: 8 },
      { label: "PayPal", amount: 0, width: 8 },
      { label: "Square", amount: 0, width: 8 },
      { label: "Manual", amount: 0, width: 8 },
    ],
  };
}

function PaymentStat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</div>
        </div>
        <div className="text-[22px] font-semibold leading-none">{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function WorkflowCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-lg border bg-background/35 px-3 py-2 text-sm">{item}</div>
        ))}
      </CardContent>
    </Card>
  );
}

function orderLabel(order: Order) {
  const customer = order.users?.full_name || order.company || order.customer_email || "Guest customer";
  return `#${order.order_number || order.id.slice(0, 8)} - ${customer}`;
}

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
  } catch {
    return [];
  }
}

function ProcessPaymentSheet({
  open,
  onOpenChange,
  orders,
  products,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  products: Product[];
  onCreated: () => Promise<void>;
}) {
  const manualOrderId = "__manual__";
  const payableOrders = useMemo(() => orders.filter((order) => order.id), [orders]);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const squareCardRef = useRef<any>(null);
  const [orderId, setOrderId] = useState(manualOrderId);
  const [mode, setMode] = useState<"link" | "card">("link");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("ControlP.io order payment");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [locality, setLocality] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");
  const [lineItemSource, setLineItemSource] = useState("manual");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [lineQuantity, setLineQuantity] = useState("1");
  const [lineUnitPrice, setLineUnitPrice] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("link_only");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  const selectedOrder = orderId === manualOrderId ? null : payableOrders.find((order) => order.id === orderId) ?? null;
  const parsedAmount = Number(amount || 0);
  const canCreate = Boolean(orderId) && Number.isFinite(parsedAmount) && parsedAmount > 0 && !saving && (orderId !== manualOrderId || Boolean(customerEmail || customerPhone));

  useEffect(() => {
    if (!open) return;
    const first = payableOrders[0] ?? null;
    hydrateOrder(first, { fallbackToManual: true });
    setMode("link");
    setDeliveryMethod("link_only");
    setNotes("");
    setMessage("");
    setPaymentLink("");
    setCardReady(false);
  }, [open, payableOrders]);

  useEffect(() => {
    if (!open || mode !== "card") return;
    let cancelled = false;

    async function mountCard() {
      setCardLoading(true);
      setMessage("");
      try {
        const config = await loadSquarePaymentConfig();
        await loadSquareScript(config.scriptUrl);
        if (cancelled) return;
        const square = (window as any).Square;
        if (!square) throw new Error("Square Web Payments SDK did not load.");
        const payments = square.payments(config.applicationId, config.locationId);
        const card = await payments.card();
        if (!cardContainerRef.current || cancelled) return;
        cardContainerRef.current.innerHTML = "";
        await card.attach(cardContainerRef.current);
        squareCardRef.current = { card, config, payments };
        setCardReady(true);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load Square card form.");
      } finally {
        if (!cancelled) setCardLoading(false);
      }
    }

    mountCard();
    return () => {
      cancelled = true;
      squareCardRef.current?.card?.destroy?.();
      squareCardRef.current = null;
      setCardReady(false);
    };
  }, [open, mode]);

  function hydrateOrder(order: Order | null, options?: { fallbackToManual?: boolean }) {
    setOrderId(order?.id ?? (options?.fallbackToManual ? manualOrderId : ""));
    setAmount(order?.total ? Number(order.total).toFixed(2) : "");
    setDescription(order?.order_number ? `ControlP.io order ${order.order_number}` : "ControlP.io order payment");
    setCustomerEmail(order?.customer_email || "");
    setCustomerPhone(order?.customer_phone || "");
  }

  function handleOrderChange(nextOrderId: string) {
    if (nextOrderId === manualOrderId) {
      setOrderId(manualOrderId);
      setDescription("ControlP.io customer payment");
      return;
    }
    hydrateOrder(payableOrders.find((order) => order.id === nextOrderId) ?? null);
  }

  function handleProductChange(nextProductId: string) {
    setSelectedProductId(nextProductId);
    const product = products.find((item) => item.id === nextProductId);
    if (!product) return;
    const price = Number(product.sale_price || product.base_price || product.base_cost || 0);
    setLineUnitPrice(price ? price.toFixed(2) : "");
    const quantity = Number(lineQuantity || 1);
    setAmount((price * quantity).toFixed(2));
    setDescription(`${product.name} payment`);
  }

  function recomputeProductAmount(nextQuantity = lineQuantity, nextUnitPrice = lineUnitPrice) {
    const quantity = Math.max(1, Number(nextQuantity || 1));
    const unit = Number(nextUnitPrice || 0);
    if (Number.isFinite(quantity) && Number.isFinite(unit) && unit > 0) {
      setAmount((quantity * unit).toFixed(2));
    }
  }

  function selectedProductPayload() {
    const product = products.find((item) => item.id === selectedProductId);
    const quantity = Math.max(1, Number(lineQuantity || 1));
    const unitPrice = Number(lineUnitPrice || amount || 0);
    return {
      productId: lineItemSource === "product" ? selectedProductId || undefined : undefined,
      productName: lineItemSource === "product" ? product?.name : serviceName || description,
      quantity,
      unitPrice,
    };
  }

  async function copyPaymentLink() {
    if (!paymentLink || !navigator.clipboard) return;
    await navigator.clipboard.writeText(paymentLink);
    setMessage("Payment link copied.");
  }

  async function processPayment() {
    setSaving(true);
    setMessage("Creating Square payment link...");
    setPaymentLink("");
    try {
      const result = await createSquarePaymentLink({
        orderId: orderId === manualOrderId ? undefined : orderId,
        amount: parsedAmount,
        description,
        customerEmail,
        customerPhone,
        notes,
        deliveryMethod,
        ...selectedProductPayload(),
      });
      if (deliveryMethod !== "link_only") {
        await deliverPaymentDocument({
          paymentId: result.payment.id,
          kind: "invoice",
          channel: deliveryMethod === "both" ? "both" : deliveryMethod === "sms" ? "sms" : "email",
          recipientEmail: customerEmail,
          recipientPhone: customerPhone,
        });
      }
      setPaymentLink(result.square.url);
      setMessage(deliveryMethod === "link_only"
        ? `Square ${human(result.square.environment)} payment link created.`
        : `Square ${human(result.square.environment)} payment link created and sent.`);
      await onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create Square payment link.");
    } finally {
      setSaving(false);
    }
  }

  async function processCardPayment() {
    setSaving(true);
    setMessage("Tokenizing card with Square...");
    setPaymentLink("");
    try {
      if (!squareCardRef.current?.card) throw new Error("Square card form is not ready.");
      const tokenResult = await squareCardRef.current.card.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        throw new Error(tokenResult.errors?.[0]?.message || "Square could not tokenize the card.");
      }
      setMessage("Processing card payment...");
      const result = await createSquareCardPayment({
        sourceId: tokenResult.token,
        orderId: orderId === manualOrderId ? undefined : orderId,
        amount: parsedAmount,
        description,
        customerEmail,
        customerPhone,
        cardholderName,
        addressLine1,
        addressLine2,
        locality,
        administrativeDistrictLevel1: stateCode,
        postalCode,
        country,
        notes,
        ...selectedProductPayload(),
      });
      setMessage(`Square card payment ${human(result.payment.status)}.`);
      await onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not process Square card payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>Process payment</SheetTitle>
          <SheetDescription>Create a Square hosted checkout link for a customer payment.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
            Use a Square hosted checkout link or process a card now with Square secure fields. Raw card details never touch ControlP.io servers.
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background/35 p-1">
            <Button type="button" variant={mode === "link" ? "default" : "ghost"} onClick={() => setMode("link")}>Create payment link</Button>
            <Button type="button" variant={mode === "card" ? "default" : "ghost"} onClick={() => setMode("card")}>Process card now</Button>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Order</div>
            <Select value={orderId} onValueChange={handleOrderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select order" />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)]">
                <SelectItem value={manualOrderId}>Manual customer payment</SelectItem>
                {payableOrders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>{orderLabel(order)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!payableOrders.length && (
              <div className="mt-2 text-xs text-muted-foreground">No live orders are loaded yet. Use a manual customer payment to create a payment-linked order.</div>
            )}
          </div>

          {selectedOrder && (
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryTile label="Customer">{selectedOrder.users?.full_name || selectedOrder.company || selectedOrder.customer_email || "Guest customer"}</SummaryTile>
              <SummaryTile label="Order total">{money.format(numberValue(selectedOrder.total))}</SummaryTile>
              <SummaryTile label="Payment status">{human(selectedOrder.payment_status)}</SummaryTile>
              <SummaryTile label="Order number">#{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}</SummaryTile>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Payment amount</div>
              <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Delivery method</div>
              <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                <SelectTrigger><SelectValue placeholder="Delivery method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link_only">Create link only</SelectItem>
                  <SelectItem value="email">Prepare email link</SelectItem>
                  <SelectItem value="sms">Prepare SMS link</SelectItem>
                  <SelectItem value="both">Prepare email and SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Customer email</div>
              <Input type="email" placeholder="customer@example.com" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Customer phone</div>
              <Input placeholder="+16025550123" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-background/35 p-3">
            <h3 className="text-sm font-semibold">Product or service</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Line item type</div>
                <Select value={lineItemSource} onValueChange={setLineItemSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual service</SelectItem>
                    <SelectItem value="product">Catalog product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {lineItemSource === "product" ? (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Product</div>
                  <Select value={selectedProductId} onValueChange={handleProductChange}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.name} - {money.format(numberValue(product.sale_price || product.base_price || product.base_cost))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Service</div>
                  <Input placeholder="Design setup, deposit, balance..." value={serviceName} onChange={(event) => setServiceName(event.target.value)} />
                </div>
              )}
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Quantity</div>
                <Input inputMode="decimal" value={lineQuantity} onChange={(event) => { setLineQuantity(event.target.value); recomputeProductAmount(event.target.value); }} />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Unit price</div>
                <Input inputMode="decimal" value={lineUnitPrice} onChange={(event) => { setLineUnitPrice(event.target.value); recomputeProductAmount(lineQuantity, event.target.value); }} />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Checkout description</div>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Internal notes</div>
            <Input placeholder="Square checkout link for deposit, balance, or full order payment" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          {mode === "card" && (
            <div className="rounded-lg border bg-background/35 p-3">
              <h3 className="text-sm font-semibold">Card details</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Cardholder name</div>
                  <Input value={cardholderName} onChange={(event) => setCardholderName(event.target.value)} placeholder="Name on card" />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Country</div>
                  <Input value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} placeholder="US" />
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Secure card form</div>
                  <div ref={cardContainerRef} className="min-h-[48px] rounded-md border bg-background px-3 py-3" />
                  <div className="mt-1 text-xs text-muted-foreground">{cardLoading ? "Loading Square card fields..." : cardReady ? "Square secure card fields are ready." : "Switch to Process card now to load secure fields."}</div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Address line 1</div>
                  <Input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Address line 2</div>
                  <Input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">City</div>
                  <Input value={locality} onChange={(event) => setLocality(event.target.value)} />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">State</div>
                  <Input value={stateCode} onChange={(event) => setStateCode(event.target.value.toUpperCase())} />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Postal code</div>
                  <Input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
                </div>
              </div>
            </div>
          )}

          {paymentLink && (
            <div className="rounded-lg border bg-background/35 p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Square checkout link</div>
              <a className="mt-2 block break-all text-sm font-medium text-primary underline-offset-4 hover:underline" href={paymentLink} target="_blank" rel="noreferrer">
                {paymentLink}
              </a>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" onClick={copyPaymentLink}>Copy link</Button>
                <Button variant="outline" asChild><a href={paymentLink} target="_blank" rel="noreferrer">Open checkout</a></Button>
              </div>
            </div>
          )}

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}
          {orderId === manualOrderId && !customerEmail && !customerPhone && (
            <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">
              Add a customer email or phone before creating a manual Square payment link.
            </div>
          )}

          <div className="flex gap-2">
            {mode === "link" ? (
              <Button className="flex-1" disabled={!canCreate} onClick={processPayment}>
                {saving ? "Creating..." : "Create Square payment link"}
              </Button>
            ) : (
              <Button className="flex-1" disabled={!canCreate || !cardReady} onClick={processCardPayment}>
                {saving ? "Processing..." : "Process card payment"}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function loadSquareScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if ((window as any).Square) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Square Web Payments SDK."));
    document.head.appendChild(script);
  });
}

function NewInvoiceSheet({
  open,
  onOpenChange,
  orders,
  products,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  products: Product[];
  onCreated: () => Promise<void>;
}) {
  const invoiceableOrders = useMemo(() => orders.filter((order) => order.id), [orders]);
  const [orderId, setOrderId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [terms, setTerms] = useState("Due on receipt");
  const [processor, setProcessor] = useState("manual");
  const [deliveryStatus, setDeliveryStatus] = useState("draft");
  const [deliveryMethod, setDeliveryMethod] = useState("none");
  const [deliveryRecipient, setDeliveryRecipient] = useState("");
  const [invoiceMessage, setInvoiceMessage] = useState("Thank you for choosing ControlP.io. You can review and pay this invoice using the secure link.");
  const [senderLogoUrl, setSenderLogoUrl] = useState("https://my.controlp.io/logos/ctrl-p-logo-dark.svg");
  const [senderName, setSenderName] = useState("ControlP.io");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("hello@controlp.io");
  const [senderWebsite, setSenderWebsite] = useState("https://www.controlp.io");
  const [senderAddress, setSenderAddress] = useState("");
  const [lineItemSource, setLineItemSource] = useState("manual");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [lineQuantity, setLineQuantity] = useState("1");
  const [lineUnitPrice, setLineUnitPrice] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [amount, setAmount] = useState("");
  const [billingContact, setBillingContact] = useState("{}");
  const [lineItems, setLineItems] = useState("[]");
  const [notes, setNotes] = useState("");
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedOrder = invoiceableOrders.find((order) => order.id === orderId) ?? null;
  const parsedAmount = Number(amount || 0);
  const parsedSubtotal = Number(subtotal || 0);
  const parsedTax = Number(taxAmount || 0);
  const parsedDiscount = Number(discountAmount || 0);
  const canCreate = Boolean(orderId) && Number.isFinite(parsedAmount) && parsedAmount > 0 && !saving;

  useEffect(() => {
    if (!open) return;
    const first = invoiceableOrders[0];
    setOrderId(first?.id ?? "");
    hydrateOrderDefaults(first ?? null);
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setDueAt(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    setTerms("Due on receipt");
    setProcessor("manual");
    setDeliveryStatus("draft");
    setDeliveryMethod("none");
    setDeliveryRecipient(first?.customer_email || first?.customer_phone || "");
    setInvoiceMessage("Thank you for choosing ControlP.io. You can review and pay this invoice using the secure link.");
    setSenderLogoUrl("https://my.controlp.io/logos/ctrl-p-logo-dark.svg");
    setNotes("");
    setMessage("");
    setPaymentLinkUrl("");
    setPreviewOpen(false);
  }, [open, invoiceableOrders]);

  function hydrateOrderDefaults(order: Order | null) {
    const total = order?.total ? Number(order.total) : 0;
    setSubtotal(total ? total.toFixed(2) : "");
    setTaxAmount("0");
    setDiscountAmount("0");
    setAmount(total ? total.toFixed(2) : "");
    setBillingContact(JSON.stringify({
      name: order?.users?.full_name || "",
      company: order?.company || order?.users?.company || "",
      email: order?.customer_email || "",
      phone: order?.customer_phone || "",
    }, null, 2));
    setDeliveryRecipient(order?.customer_email || order?.customer_phone || "");
    setLineItems(JSON.stringify([
      {
        description: order?.order_number ? `Order #${order.order_number}` : "Order",
        quantity: 1,
        unit_price: total,
        line_total: total,
      },
    ], null, 2));
  }

  function handleOrderChange(nextOrderId: string) {
    const nextOrder = invoiceableOrders.find((order) => order.id === nextOrderId);
    setOrderId(nextOrderId);
    hydrateOrderDefaults(nextOrder ?? null);
  }

  function recomputeAmount(nextSubtotal = subtotal, nextTax = taxAmount, nextDiscount = discountAmount) {
    const total = Number(nextSubtotal || 0) + Number(nextTax || 0) - Number(nextDiscount || 0);
    setAmount(Number.isFinite(total) ? Math.max(0, total).toFixed(2) : "");
  }

  function addLineItem() {
    try {
      const current = parseJson("Line items", lineItems);
      const list = Array.isArray(current) ? current : [];
      const product = products.find((item) => item.id === selectedProductId);
      const description = lineItemSource === "product"
        ? product?.name || "Product"
        : serviceName || "Service";
      const unitPrice = lineItemSource === "product"
        ? Number(product?.sale_price || product?.base_price || product?.base_cost || 0)
        : Number(lineUnitPrice || 0);
      const quantity = Number(lineQuantity || 1);
      const next = [
        ...list,
        {
          sku: lineItemSource === "product" ? product?.sku || "" : "",
          description,
          quantity,
          unit_price: unitPrice,
          line_total: quantity * unitPrice,
        },
      ];
      const nextSubtotal = next.reduce((sum, item) => sum + Number(item.line_total || 0), 0).toFixed(2);
      setLineItems(JSON.stringify(next, null, 2));
      setSubtotal(nextSubtotal);
      recomputeAmount(nextSubtotal);
      setServiceName("");
      setLineUnitPrice("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add line item.");
    }
  }

  function parseJson(label: string, value: string) {
    try {
      return JSON.parse(value || "null");
    } catch {
      throw new Error(`${label} must be valid JSON.`);
    }
  }

  async function createInvoice() {
    setSaving(true);
    setMessage("Creating invoice...");
    try {
      const payment = await createAdminInvoice({
        orderId,
        amount: parsedAmount,
        notes: notes || `Invoice for ${selectedOrder?.order_number || "order"}`,
        invoiceNumber,
        dueAt: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : "",
        terms,
        billingContact: parseJson("Billing contact", billingContact),
        senderProfile: {
          logo_url: senderLogoUrl,
          name: senderName,
          phone: senderPhone,
          email: senderEmail,
          website: senderWebsite,
          address: senderAddress,
        },
        deliveryMethod,
        deliveryRecipient,
        invoiceMessage,
        lineItems: parseJson("Line items", lineItems),
        subtotal: parsedSubtotal,
        taxAmount: parsedTax,
        discountAmount: parsedDiscount,
        processor,
        deliveryStatus,
        paymentLinkUrl: paymentLinkUrl.trim() || undefined,
      });
      if (deliveryMethod !== "none" && deliveryStatus !== "draft") {
        await deliverPaymentDocument({
          paymentId: payment.id,
          kind: "invoice",
          channel: deliveryMethod === "both" ? "both" : deliveryMethod === "sms" ? "sms" : "email",
          recipientEmail: deliveryMethod === "sms" ? undefined : deliveryRecipient,
          recipientPhone: deliveryMethod === "email" ? undefined : deliveryRecipient,
        });
      }
      setMessage(deliveryMethod !== "none" && deliveryStatus !== "draft" ? "Invoice created and sent." : "Invoice created.");
      await onCreated();
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>New invoice</SheetTitle>
          <SheetDescription>Create a pending invoice record for an existing order.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Order</div>
            <Select value={orderId} onValueChange={handleOrderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select order" />
              </SelectTrigger>
              <SelectContent>
                {invoiceableOrders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>{orderLabel(order)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOrder && (
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryTile label="Customer">{selectedOrder.users?.full_name || selectedOrder.company || selectedOrder.customer_email || "Guest customer"}</SummaryTile>
              <SummaryTile label="Order total">{money.format(numberValue(selectedOrder.total))}</SummaryTile>
              <SummaryTile label="Payment status">{human(selectedOrder.payment_status)}</SummaryTile>
              <SummaryTile label="Production">{human(selectedOrder.production_status)}</SummaryTile>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Delivery method</div>
              <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                <SelectTrigger><SelectValue placeholder="Delivery method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Do not send yet</SelectItem>
                  <SelectItem value="email">Email digital file</SelectItem>
                  <SelectItem value="sms">SMS invoice link</SelectItem>
                  <SelectItem value="both">Email and SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Delivery recipient</div>
              <Input placeholder="email or phone" value={deliveryRecipient} onChange={(event) => setDeliveryRecipient(event.target.value)} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Invoice number</div>
              <Input placeholder="INV-1001" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Due date</div>
              <DateInput value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Terms</div>
              <Select value={terms} onValueChange={setTerms}>
                <SelectTrigger><SelectValue placeholder="Terms" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                  <SelectItem value="Net 7">Net 7</SelectItem>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Deposit required">Deposit required</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Processor</div>
              <Select value={processor} onValueChange={setProcessor}>
                <SelectTrigger><SelectValue placeholder="Processor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Delivery status</div>
              <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                <SelectTrigger><SelectValue placeholder="Delivery status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready_to_send">Ready to send</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Invoice amount</div>
              <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-background/35 p-3">
            <h3 className="text-sm font-semibold">Invoice sender</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Logo URL</div>
                <Input placeholder="https://..." value={senderLogoUrl} onChange={(event) => setSenderLogoUrl(event.target.value)} />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Business name</div>
                <Input value={senderName} onChange={(event) => setSenderName(event.target.value)} />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Phone</div>
                <Input value={senderPhone} onChange={(event) => setSenderPhone(event.target.value)} />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Email</div>
                <Input value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Website</div>
                <Input value={senderWebsite} onChange={(event) => setSenderWebsite(event.target.value)} />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Address</div>
                <Input value={senderAddress} onChange={(event) => setSenderAddress(event.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background/35 p-3">
            <h3 className="text-sm font-semibold">Add product or service</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Line item type</div>
                <Select value={lineItemSource} onValueChange={setLineItemSource}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual service</SelectItem>
                    <SelectItem value="product">Catalog product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {lineItemSource === "product" ? (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Product</div>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.name} - {money.format(numberValue(product.sale_price || product.base_price || product.base_cost))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Service</div>
                  <Input placeholder="Design setup, install, rush fee..." value={serviceName} onChange={(event) => setServiceName(event.target.value)} />
                </div>
              )}
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Quantity</div>
                <Input inputMode="decimal" value={lineQuantity} onChange={(event) => setLineQuantity(event.target.value)} />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Manual unit price</div>
                <Input inputMode="decimal" value={lineUnitPrice} onChange={(event) => setLineUnitPrice(event.target.value)} disabled={lineItemSource === "product"} />
              </div>
            </div>
            <Button className="mt-3 w-full" variant="outline" onClick={addLineItem}>Add line item</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Subtotal</div>
              <Input inputMode="decimal" value={subtotal} onChange={(event) => { setSubtotal(event.target.value); recomputeAmount(event.target.value); }} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Tax</div>
              <Input inputMode="decimal" value={taxAmount} onChange={(event) => { setTaxAmount(event.target.value); recomputeAmount(subtotal, event.target.value); }} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Discount</div>
              <Input inputMode="decimal" value={discountAmount} onChange={(event) => { setDiscountAmount(event.target.value); recomputeAmount(subtotal, taxAmount, event.target.value); }} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Notes</div>
            <Input placeholder="Invoice note or payment instructions" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Invoice message</div>
            <Input value={invoiceMessage} onChange={(event) => setInvoiceMessage(event.target.value)} />
          </div>

          <div className="rounded-lg border bg-secondary/30 p-3">
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Credit / debit card payment link (optional)</div>
            <Input value={paymentLinkUrl} onChange={(event) => setPaymentLinkUrl(event.target.value)} placeholder="https://checkout.square.site/..." />
            <div className="mt-1.5 text-[11px] text-muted-foreground">When filled, a clickable "Pay securely" button appears in the PDF, email, and SMS. Leave blank for check or manual payments — the link will not appear.</div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Billing contact JSON</div>
              <textarea className="min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={billingContact} onChange={(event) => setBillingContact(event.target.value)} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Line items JSON</div>
              <textarea className="min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={lineItems} onChange={(event) => setLineItems(event.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
            Preview: {senderName} will invoice {selectedOrder?.users?.full_name || selectedOrder?.company || selectedOrder?.customer_email || "the selected customer"} for {money.format(parsedAmount)}. Delivery is set to {human(deliveryMethod)}.
          </div>

          {previewOpen && (
            <div className="rounded-lg border bg-white p-5 text-slate-950 shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b pb-4">
                <div>
                  {senderLogoUrl && <img src={senderLogoUrl} alt="" className="mb-3 max-h-12 max-w-40 object-contain" />}
                  <div className="text-lg font-semibold">{senderName || "ControlP.io"}</div>
                  <div className="mt-1 text-xs text-slate-600">{senderAddress || "Business address"}</div>
                  <div className="text-xs text-slate-600">{senderPhone || "Phone"} · {senderEmail || "Email"} · {senderWebsite || "Website"}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold">Invoice</div>
                  <div className="mt-1 text-xs text-slate-600">{invoiceNumber || "INV-000000"}</div>
                  <div className="text-xs text-slate-600">Due {dueAt || "Not set"}</div>
                </div>
              </div>
              <div className="grid gap-4 border-b py-4 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Bill to</div>
                  <div className="mt-1 text-sm">{selectedOrder?.users?.full_name || selectedOrder?.company || "Customer"}</div>
                  <div className="text-xs text-slate-600">{selectedOrder?.customer_email || "customer@example.com"}</div>
                  <div className="text-xs text-slate-600">{selectedOrder?.customer_phone || "Customer phone"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Message</div>
                  <div className="mt-1 text-sm text-slate-700">{invoiceMessage}</div>
                </div>
              </div>
              <div className="py-4">
                <div className="grid grid-cols-[1fr_70px_90px_90px] border-b pb-2 text-xs font-semibold uppercase text-slate-500">
                  <div>Description</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Rate</div>
                  <div className="text-right">Total</div>
                </div>
                {(safeJsonArray(lineItems)).map((item, index) => (
                  <div key={`${item.description || "line"}-${index}`} className="grid grid-cols-[1fr_70px_90px_90px] border-b py-2 text-sm">
                    <div>{String(item.description || "Line item")}</div>
                    <div className="text-right">{String(item.quantity || 1)}</div>
                    <div className="text-right">{money.format(numberValue(String(item.unit_price || 0)))}</div>
                    <div className="text-right">{money.format(numberValue(String(item.line_total || 0)))}</div>
                  </div>
                ))}
              </div>
              <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{money.format(parsedSubtotal)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{money.format(parsedTax)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>-{money.format(parsedDiscount)}</span></div>
                <div className="flex justify-between border-t pt-2 text-lg font-semibold"><span>Total</span><span>{money.format(parsedAmount)}</span></div>
              </div>
            </div>
          )}

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen((value) => !value)}>
              {previewOpen ? "Hide preview" : "Review invoice"}
            </Button>
            <Button className="flex-1" disabled={!canCreate} onClick={createInvoice}>
              {saving ? "Creating..." : "Create invoice"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditInvoiceSheet({
  payment,
  open,
  onOpenChange,
  onSaved,
}: {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [terms, setTerms] = useState("Due on receipt");
  const [amount, setAmount] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("");
  const [lineItems, setLineItems] = useState("[]");
  const [status, setStatus] = useState("pending");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!payment) return;
    setInvoiceNumber(payment.invoice_number || "");
    setDueAt(payment.invoice_due_at ? new Date(payment.invoice_due_at).toISOString().slice(0, 10) : "");
    setTerms(payment.invoice_terms || "Due on receipt");
    setAmount(String(numberValue(payment.amount)));
    setSubtotal(String(numberValue(payment.subtotal ?? payment.amount)));
    setTaxAmount(String(numberValue(payment.tax_amount)));
    setDiscountAmount(String(numberValue(payment.discount_amount)));
    setNotes(payment.notes || "");
    setPaymentLinkUrl(payment.payment_link_url || "");
    setLineItems(payment.line_items ? JSON.stringify(payment.line_items, null, 2) : "[]");
    setStatus(payment.status || "pending");
    setMessage("");
  }, [payment]);

  function recomputeAmount(nextSubtotal = subtotal, nextTax = taxAmount, nextDiscount = discountAmount) {
    const total = Number(nextSubtotal || 0) + Number(nextTax || 0) - Number(nextDiscount || 0);
    setAmount(Number.isFinite(total) ? Math.max(0, total).toFixed(2) : "");
  }

  async function saveInvoice() {
    if (!payment) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setMessage("Amount must be greater than zero.");
      return;
    }
    setSaving(true);
    setMessage("Saving...");
    try {
      let parsedLines: unknown = undefined;
      try { parsedLines = JSON.parse(lineItems); } catch { throw new Error("Line items must be valid JSON."); }
      await updateAdminInvoice({
        paymentId: payment.id,
        amount: parsedAmount,
        notes,
        invoiceNumber,
        dueAt: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : "",
        terms,
        lineItems: parsedLines,
        subtotal: Number(subtotal || parsedAmount),
        taxAmount: Number(taxAmount || 0),
        discountAmount: Number(discountAmount || 0),
        paymentLinkUrl: paymentLinkUrl.trim() || null,
        status,
      });
      setMessage("Invoice updated.");
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>Edit invoice {payment?.invoice_number || payment?.id.slice(0, 8)}</SheetTitle>
          <SheetDescription>Update invoice details, amounts, and payment link.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Invoice number</div>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-1001" />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Due date</div>
              <DateInput value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Terms</div>
              <Select value={terms} onValueChange={setTerms}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                  <SelectItem value="Net 7">Net 7</SelectItem>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Deposit required">Deposit required</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Partially paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Subtotal</div>
              <Input inputMode="decimal" value={subtotal} onChange={(e) => { setSubtotal(e.target.value); recomputeAmount(e.target.value); }} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Tax</div>
              <Input inputMode="decimal" value={taxAmount} onChange={(e) => { setTaxAmount(e.target.value); recomputeAmount(subtotal, e.target.value); }} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Discount</div>
              <Input inputMode="decimal" value={discountAmount} onChange={(e) => { setDiscountAmount(e.target.value); recomputeAmount(subtotal, taxAmount, e.target.value); }} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Invoice total</div>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Notes</div>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment note or instructions" />
          </div>

          <div className="rounded-lg border bg-secondary/30 p-3">
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Credit / debit card payment link</div>
            <Input value={paymentLinkUrl} onChange={(e) => setPaymentLinkUrl(e.target.value)} placeholder="https://checkout.square.site/..." />
            <div className="mt-1.5 text-[11px] text-muted-foreground">When filled, a clickable pay button appears in the PDF, email, and SMS sent to the customer. Leave blank for check or manual payments.</div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Line items JSON</div>
            <textarea className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={lineItems} onChange={(e) => setLineItems(e.target.value)} />
          </div>

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={saveInvoice} disabled={saving}>{saving ? "Saving..." : "Save invoice"}</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RefundDialog({
  payment,
  onClose,
  onRefunded,
}: {
  payment: Payment | null;
  onClose: () => void;
  onRefunded: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const maxAmount = Number(payment?.amount || 0);

  useEffect(() => {
    if (!payment) return;
    setAmount(maxAmount.toFixed(2));
    setReason("Admin refund");
    setMessage("");
    setDone(false);
    setSaving(false);
  }, [payment]);

  async function issueRefund() {
    if (!payment) return;
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) { setMessage("Enter a valid refund amount."); return; }
    if (parsed > maxAmount) { setMessage(`Refund cannot exceed ${money.format(maxAmount)}.`); return; }

    setSaving(true);
    setMessage("Processing refund with Square...");
    try {
      const result = await createSquareRefund({ paymentId: payment.id, amount: parsed, reason });
      setMessage(`Refund ${result.status} — ${money.format(result.amount)}. Square refund ID: ${result.square_refund_id || "pending"}.`);
      setDone(true);
      await onRefunded();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not process refund.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!payment} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Issue Square refund</DialogTitle>
          <DialogDescription>
            Refund payment {payment?.id.slice(0, 8)} — {money.format(maxAmount)} paid.
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-4 pt-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Refund amount</div>
              <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
              <div className="mt-1 text-xs text-muted-foreground">Maximum: {money.format(maxAmount)}</div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Reason</div>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Admin refund" />
            </div>
            {message && <div className="rounded-md border bg-background/50 p-3 text-sm text-muted-foreground">{message}</div>}
            <div className="flex gap-2">
              <Button className="flex-1 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600" disabled={saving} onClick={issueRefund}>
                {saving ? "Processing..." : "Confirm refund"}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>
            <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
