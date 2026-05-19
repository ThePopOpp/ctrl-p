"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

import { createAdminInvoice, createSquarePaymentLink, getCurrentAdminProfile, loadAdminDashboardData } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, Order, Payment, Product } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function AdminPayments() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

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

  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const paidTotal = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const pendingTotal = payments.filter((payment) => ["pending", "unpaid", "partially_paid"].includes(payment.status)).reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const processorBreakdown = useMemo(() => breakdownByProvider(payments), [payments]);

  async function refreshPayments() {
    setData(await loadAdminDashboardData());
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div>
              <div className="text-sm font-semibold">Super Admin</div>
            </div>
          </div>

          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
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
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8">
                <Bell className="h-4 w-4" />
              </Button>
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
                          </TableRow>
                        ))}
                        {!payments.length && (
                          <TableRow>
                            <TableCell className="p-6 text-center text-muted-foreground" colSpan={5}>No live payment records yet.</TableCell>
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
          onCreated={refreshPayments}
        />
      </div>
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
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  onCreated: () => Promise<void>;
}) {
  const payableOrders = useMemo(() => orders.filter((order) => order.id), [orders]);
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("ControlP.io order payment");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("link_only");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  const selectedOrder = payableOrders.find((order) => order.id === orderId) ?? null;
  const parsedAmount = Number(amount || 0);
  const canCreate = Boolean(orderId) && Number.isFinite(parsedAmount) && parsedAmount > 0 && !saving;

  useEffect(() => {
    if (!open) return;
    const first = payableOrders[0] ?? null;
    hydrateOrder(first);
    setDeliveryMethod("link_only");
    setNotes("");
    setMessage("");
    setPaymentLink("");
  }, [open, payableOrders]);

  function hydrateOrder(order: Order | null) {
    setOrderId(order?.id ?? "");
    setAmount(order?.total ? Number(order.total).toFixed(2) : "");
    setDescription(order?.order_number ? `ControlP.io order ${order.order_number}` : "ControlP.io order payment");
    setCustomerEmail(order?.customer_email || "");
    setCustomerPhone(order?.customer_phone || "");
  }

  function handleOrderChange(nextOrderId: string) {
    hydrateOrder(payableOrders.find((order) => order.id === nextOrderId) ?? null);
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
        orderId,
        amount: parsedAmount,
        description,
        customerEmail,
        customerPhone,
        notes,
        deliveryMethod,
      });
      setPaymentLink(result.square.url);
      setMessage(`Square ${human(result.square.environment)} payment link created.`);
      await onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create Square payment link.");
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
            Square checkout keeps card entry on Square's secure page. This first pass creates a payable link and tracks it in ControlP.io.
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Order</div>
            <Select value={orderId} onValueChange={handleOrderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select order" />
              </SelectTrigger>
              <SelectContent>
                {payableOrders.map((order) => (
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

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Checkout description</div>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Internal notes</div>
            <Input placeholder="Square checkout link for deposit, balance, or full order payment" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

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

          <div className="flex gap-2">
            <Button className="flex-1" disabled={!canCreate} onClick={processPayment}>
              {saving ? "Creating..." : "Create Square payment link"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
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
      await createAdminInvoice({
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
      });
      setMessage("Invoice created.");
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
              <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
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

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
