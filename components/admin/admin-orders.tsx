"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, ChevronRight, Columns3, List, Moon, Plus, Search, Sun } from "lucide-react";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import { createAdminOrder, getCurrentAdminProfile, loadAdminDashboardData, updateAdminOrder } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, Order } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const orderStatuses = ["new", "quote_requested", "awaiting_payment", "paid", "file_review", "proofing", "approved", "in_production", "ready_for_pickup", "ready_to_ship", "shipped", "delivered", "completed", "cancelled", "refunded"];
const paymentStatuses = ["unpaid", "pending", "paid", "partially_paid", "failed", "refunded", "partially_refunded"];
const productionStatuses = ["new", "file_check", "design_needed", "proof_pending", "proof_approved", "print_ready", "printing", "finishing", "install_scheduled", "ready", "completed", "on_hold"];
const viewModes = ["list", "kanban", "calendar"] as const;

const lanes = [
  { id: "pending", label: "Pending", matches: (order: Order) => order.status === "quote_requested" || order.status === "new", update: { status: "new", paymentStatus: "unpaid", productionStatus: "new" } },
  { id: "pending_payment", label: "Pending payment", matches: (order: Order) => order.status === "awaiting_payment" || ["unpaid", "pending"].includes(order.payment_status), update: { status: "awaiting_payment", paymentStatus: "pending", productionStatus: "new" } },
  { id: "deposit_paid", label: "Deposit paid", matches: (order: Order) => order.payment_status === "partially_paid", update: { status: "paid", paymentStatus: "partially_paid", productionStatus: "file_check" } },
  { id: "awaiting_approval", label: "Awaiting approval", matches: (order: Order) => ["file_review", "proofing"].includes(order.status) || ["proof_pending", "design_needed"].includes(order.production_status), update: { status: "proofing", paymentStatus: "partially_paid", productionStatus: "proof_pending" } },
  { id: "approved", label: "Approved", matches: (order: Order) => order.status === "approved" || order.production_status === "proof_approved", update: { status: "approved", paymentStatus: "partially_paid", productionStatus: "proof_approved" } },
  { id: "order_paid", label: "Order paid", matches: (order: Order) => order.payment_status === "paid" && !["in_production", "ready_to_ship", "shipped", "delivered", "completed"].includes(order.status), update: { status: "paid", paymentStatus: "paid", productionStatus: "print_ready" } },
  { id: "in_production", label: "In production / print", matches: (order: Order) => order.status === "in_production" || ["printing", "finishing"].includes(order.production_status), update: { status: "in_production", paymentStatus: "paid", productionStatus: "printing" } },
  { id: "post_production", label: "Post production", matches: (order: Order) => order.production_status === "ready", update: { status: "ready_to_ship", paymentStatus: "paid", productionStatus: "ready" } },
  { id: "shipping", label: "Shipping", matches: (order: Order) => ["ready_to_ship", "shipped", "ready_for_pickup"].includes(order.status), update: { status: "shipped", paymentStatus: "paid", productionStatus: "ready" } },
  { id: "complete", label: "Complete", matches: (order: Order) => ["delivered", "completed"].includes(order.status), update: { status: "completed", paymentStatus: "paid", productionStatus: "completed" } },
] as const;

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function statusTone(status: string) {
  if (["paid", "completed", "ready", "delivered", "proof_approved", "approved"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["pending", "awaiting_payment", "proof_pending", "printing", "finishing", "file_check", "print_ready", "in_production", "proofing"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  if (["unpaid", "failed", "cancelled", "refunded", "on_hold", "design_needed"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-secondary text-secondary-foreground";
}

function dateKey(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "No due date";
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

export function AdminOrders() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<(typeof viewModes)[number]>("list");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
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

  async function refresh(openOrderId?: string) {
    const next = await loadAdminDashboardData();
    setData(next);
    if (openOrderId) setSelectedOrder(next.orders.find((order) => order.id === openOrderId) ?? null);
  }

  async function moveOrderToLane(order: Order, lane: (typeof lanes)[number]) {
    setNotice(`Moving #${order.order_number || order.id.slice(0, 8)} to ${lane.label}...`);
    try {
      await updateAdminOrder({
        orderId: order.id,
        status: lane.update.status,
        paymentStatus: lane.update.paymentStatus,
        productionStatus: lane.update.productionStatus,
        internalNotes: order.internal_notes || "",
        dueAt: order.due_at ? new Date(order.due_at).toISOString().slice(0, 10) : "",
      });
      await refresh(order.id);
      setNotice(`Moved to ${lane.label}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not move order.");
    }
  }

  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const users = data?.users ?? [];
  const orderItems = data?.orderItems ?? [];
  const artworkFiles = data?.artworkFiles ?? [];
  const proofs = data?.proofs ?? [];
  const productionJobs = data?.productionJobs ?? [];
  const filteredOrders = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return orders;
    return orders.filter((order) => [
      order.order_number,
      order.company,
      order.customer_email,
      order.customer_phone,
      order.users?.full_name,
      order.status,
      order.production_status,
      order.payment_status,
    ].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [orders, query]);

  const openPaymentOrders = orders.filter((order) => ["unpaid", "pending", "partially_paid"].includes(order.payment_status)).length;
  const activeProduction = orders.filter((order) => !["completed", "ready", "delivered"].includes(order.production_status)).length;
  const revenue = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + numberValue(payment.amount), 0);

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-[45px] px-2 pt-[5px]"><a href="/admin"><img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" /><img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" /></a></div>
          <nav className="space-y-4">{adminNavGroups.map((group) => <div key={group.label}>{group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}<div className="space-y-0.5">{group.items.map(([label, Icon, href]) => <Link href={href} key={label} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}><Icon className="h-4 w-4" />{label}{label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}{label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}{label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}{label === "Users" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{users.length}</Badge>}</Link>)}</div></div>)}</nav>

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
          <div className="flex h-12 items-center gap-3 px-5"><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Super Admin</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-foreground">Orders</span></div><div className="ml-auto flex items-center gap-2"><div className="relative hidden w-[380px] md:block"><Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" /><Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search orders, customers, statuses..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><AdminNotificationBell /><Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button></div></div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/orders">Go to login</a></Button></CardContent></Card>}
          {authState === "allowed" && <>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h1 className="text-[25px] font-semibold tracking-tight">Orders command center</h1><p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Bird&apos;s-eye order management across customers, users, products, artwork, payments, production, shipping, messages, and completion.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create order</Button><Button variant="outline" asChild><Link href="/admin/payments">Process payment</Link></Button></div></div>
            {notice && <div className="mb-4 rounded-lg border bg-secondary/35 px-3 py-2 text-sm text-muted-foreground">{notice}</div>}
            <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Stat label="Orders" value={String(orders.length)} hint={`${filteredOrders.length} visible`} /><Stat label="Open payment" value={String(openPaymentOrders)} hint="Needs billing follow-up" /><Stat label="Production" value={String(activeProduction)} hint="Active operational queue" /><Stat label="Revenue" value={money.format(revenue)} hint="Paid records loaded" /><Stat label="Artwork" value={String(artworkFiles.length + proofs.length)} hint="Files and proofs" /></section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1 rounded-lg border bg-card p-1">{viewModes.map((mode) => <Button key={mode} size="sm" variant={view === mode ? "default" : "ghost"} onClick={() => setView(mode)}>{mode === "list" && <List className="h-4 w-4" />}{mode === "kanban" && <Columns3 className="h-4 w-4" />}{mode === "calendar" && <CalendarDays className="h-4 w-4" />}{human(mode)}</Button>)}</div><div className="text-xs text-muted-foreground">Drag cards in Kanban to move status lanes.</div></div>
            {view === "list" && <OrderList orders={filteredOrders} onSelect={setSelectedOrder} />}
            {view === "kanban" && <OrderKanban orders={filteredOrders} draggedOrderId={draggedOrderId} setDraggedOrderId={setDraggedOrderId} onMove={moveOrderToLane} onSelect={setSelectedOrder} />}
            {view === "calendar" && <OrderCalendar orders={filteredOrders} onSelect={setSelectedOrder} />}
          </>}
        </main>

        <CreateOrderSheet open={createOpen} onOpenChange={setCreateOpen} data={data} onCreated={async (orderId) => refresh(orderId)} />
        <OrderDrawer order={selectedOrder} data={data} open={Boolean(selectedOrder)} onOpenChange={(open) => !open && setSelectedOrder(null)} onRefresh={refresh} />
      </div>
    </div>
  );
}

function OrderList({ orders, onSelect }: { orders: Order[]; onSelect: (order: Order) => void }) {
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Live orders</CardTitle><CardDescription>Click any order to review the full stack.</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="pl-4">Order</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead><TableHead>Production</TableHead><TableHead>Due</TableHead><TableHead className="text-right pr-4">Total</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => <TableRow key={order.id} className="cursor-pointer hover:bg-accent/45" onClick={() => onSelect(order)}><TableCell className="pl-4 font-mono text-xs">#{order.order_number || order.id.slice(0, 8)}</TableCell><TableCell><div className="font-medium">{order.users?.full_name || order.company || "Guest customer"}</div><div className="text-xs text-muted-foreground">{order.customer_email || order.customer_phone}</div></TableCell><TableCell><StatusBadge status={order.status} /></TableCell><TableCell><StatusBadge status={order.payment_status} /></TableCell><TableCell>{human(order.production_status)}</TableCell><TableCell>{order.due_at ? new Date(order.due_at).toLocaleDateString() : "Not set"}</TableCell><TableCell className="pr-4 text-right font-semibold">{money.format(numberValue(order.total))}</TableCell></TableRow>)}{!orders.length && <TableRow><TableCell colSpan={7} className="p-6 text-center text-muted-foreground">No orders found.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>;
}

function OrderKanban({ orders, draggedOrderId, setDraggedOrderId, onMove, onSelect }: { orders: Order[]; draggedOrderId: string | null; setDraggedOrderId: (id: string | null) => void; onMove: (order: Order, lane: (typeof lanes)[number]) => Promise<void>; onSelect: (order: Order) => void }) {
  return <div className="grid gap-3 xl:grid-cols-5">{lanes.map((lane) => { const laneOrders = orders.filter(lane.matches); return <Card key={lane.id} className="min-h-[220px]" onDragOver={(event) => event.preventDefault()} onDrop={() => { const order = orders.find((item) => item.id === draggedOrderId); setDraggedOrderId(null); if (order) onMove(order, lane); }}><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm">{lane.label}</CardTitle><Badge variant="outline">{laneOrders.length}</Badge></div></CardHeader><CardContent className="space-y-2">{laneOrders.map((order) => <button key={order.id} draggable onDragStart={() => setDraggedOrderId(order.id)} onClick={() => onSelect(order)} className="w-full rounded-lg border bg-background/50 p-3 text-left hover:bg-accent"><div className="font-mono text-xs">#{order.order_number || order.id.slice(0, 8)}</div><div className="mt-1 truncate text-sm font-medium">{order.users?.full_name || order.company || order.customer_email || "Guest customer"}</div><div className="mt-2 flex flex-wrap gap-1"><StatusBadge status={order.payment_status} /><StatusBadge status={order.production_status} /></div><div className="mt-2 text-xs text-muted-foreground">{money.format(numberValue(order.total))} - {order.due_at ? new Date(order.due_at).toLocaleDateString() : "No due date"}</div></button>)}{!laneOrders.length && <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Drop orders here.</div>}</CardContent></Card>; })}</div>;
}

function OrderCalendar({ orders, onSelect }: { orders: Order[]; onSelect: (order: Order) => void }) {
  const groups = orders.reduce<Record<string, Order[]>>((acc, order) => { const key = dateKey(order.due_at); acc[key] = [...(acc[key] || []), order]; return acc; }, {});
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([day, dayOrders]) => <Card key={day}><CardHeader className="pb-2"><CardTitle className="text-sm">{day === "No due date" ? day : new Date(`${day}T12:00:00`).toLocaleDateString()}</CardTitle><CardDescription>{dayOrders.length} order{dayOrders.length === 1 ? "" : "s"}</CardDescription></CardHeader><CardContent className="space-y-2">{dayOrders.map((order) => <button key={order.id} onClick={() => onSelect(order)} className="w-full rounded-lg border bg-background/50 p-3 text-left hover:bg-accent"><div className="font-mono text-xs">#{order.order_number || order.id.slice(0, 8)}</div><div className="truncate text-sm font-medium">{order.users?.full_name || order.company || order.customer_email || "Guest customer"}</div><div className="mt-2"><StatusBadge status={order.status} /></div></button>)}</CardContent></Card>)}</div>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn("border", statusTone(status))}>{human(status)}</Badge>;
}

function CreateOrderSheet({ open, onOpenChange, data, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; data: AdminDashboardData | null; onCreated: (orderId: string) => Promise<void> }) {
  const users = data?.users ?? [];
  const products = data?.products ?? [];
  const [userId, setUserId] = useState("manual");
  const [productId, setProductId] = useState("none");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [status, setStatus] = useState("new");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [productionStatus, setProductionStatus] = useState("new");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [shippingMethod, setShippingMethod] = useState("pickup");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<{ id: string; code: string; discount_type: string; discount_value: number; discount_amount: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedUser = users.find((user) => user.id === userId);
  const selectedProduct = products.find((product) => product.id === productId);

  async function validateCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    const subtotal = Number(quantity || 1) * Number(unitPrice || 0);
    setCouponValidating(true);
    setMessage("");
    try {
      const db = getSupabaseBrowserClient();
      const sessionResult = await db?.auth.getSession();
      const token = sessionResult?.data.session?.access_token;
      const res = await fetch("/api/checkout/validate-coupon", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code, order_total: subtotal }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Invalid coupon."); setCouponResult(null); }
      else { setCouponResult({ ...data.coupon, discount_amount: data.discount_amount }); setMessage(`Coupon applied: saves ${money.format(data.discount_amount)}`); }
    } catch { setMessage("Could not validate coupon."); }
    finally { setCouponValidating(false); }
  }

  useEffect(() => {
    if (!open) return;
    setProductId(products[0]?.id || "none");
    setMessage("");
  }, [open, products]);

  useEffect(() => {
    if (!selectedUser) return;
    setCompany(selectedUser.company || "");
    setEmail(selectedUser.email || "");
    setPhone(selectedUser.phone || "");
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedProduct) return;
    setUnitPrice(String(selectedProduct.sale_price || selectedProduct.base_price || 0));
  }, [selectedProduct]);

  async function create() {
    if (productId === "none") {
      setMessage("Select a product before creating the order.");
      return;
    }
    setSaving(true);
    setMessage("Creating order...");
    try {
      const order = await createAdminOrder({ userId: userId === "manual" ? undefined : userId, productId, quantity: Number(quantity || 1), unitPrice: Number(unitPrice || 0), couponCode: couponResult?.code || undefined, status, paymentStatus, productionStatus, company, customerEmail: email, customerPhone: phone, customerNotes, internalNotes, dueAt, shippingMethod });
      await onCreated(order.id);
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create order.");
    } finally {
      setSaving(false);
    }
  }

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="overflow-y-auto sm:max-w-[60rem]"><SheetHeader><SheetTitle>Create order</SheetTitle><SheetDescription>Add the customer, user, product, payment, artwork, production, and shipping starting point for a new order.</SheetDescription></SheetHeader><div className="mt-6 space-y-4"><div className="grid gap-3 sm:grid-cols-3"><FieldSelect label="Customer / user" value={userId} onChange={setUserId} items={[{ value: "manual", label: "Manual customer" }, ...users.map((user) => ({ value: user.id, label: `${user.full_name || user.email || user.id.slice(0, 8)} - ${human(user.role)}` }))]} /><FieldSelect label="Product" value={productId} onChange={setProductId} items={products.map((product) => ({ value: product.id, label: `${product.name} - ${product.sku}` }))} placeholder="Select product" /><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Quantity</div><Input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" /></div></div><div className="grid gap-3 sm:grid-cols-3"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Unit price</div><Input value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} inputMode="decimal" /></div><FieldSelect label="Order status" value={status} onChange={setStatus} items={orderStatuses.map((item) => ({ value: item, label: human(item) }))} /><FieldSelect label="Payment status" value={paymentStatus} onChange={setPaymentStatus} items={paymentStatuses.map((item) => ({ value: item, label: human(item) }))} /></div><div className="grid gap-3 sm:grid-cols-3"><FieldSelect label="Production status" value={productionStatus} onChange={setProductionStatus} items={productionStatuses.map((item) => ({ value: item, label: human(item) }))} /><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Due date</div><DateInput value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div><FieldSelect label="Shipping" value={shippingMethod} onChange={setShippingMethod} items={["pickup", "local_delivery", "ship", "install"].map((item) => ({ value: item, label: human(item) }))} /></div><div className="grid gap-3 sm:grid-cols-3"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Company</div><Input value={company} onChange={(event) => setCompany(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Email</div><Input value={email} onChange={(event) => setEmail(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Phone</div><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Customer notes</div><Textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Internal notes</div><Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></div></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Coupon code</div><div className="flex gap-2">{couponResult ? (<div className="flex flex-1 items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"><span>{couponResult.code} — saves {money.format(couponResult.discount_amount)}</span><button type="button" onClick={() => { setCouponResult(null); setCouponCode(""); setMessage(""); }} className="ml-2 text-xs underline">Remove</button></div>) : (<><Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && validateCoupon()} placeholder="COUPON CODE" className="font-mono uppercase" /><Button type="button" variant="outline" onClick={validateCoupon} disabled={couponValidating || !couponCode.trim()}>{couponValidating ? "..." : "Apply"}</Button></>)}</div></div><div className="rounded-lg border bg-secondary/25 px-3 py-2 text-sm text-muted-foreground">{couponResult ? <>Estimated total: {money.format(Math.max(0, Number(quantity || 1) * Number(unitPrice || 0) - couponResult.discount_amount))} (after {couponResult.discount_type === "percentage" ? `${couponResult.discount_value}% discount` : `$${couponResult.discount_value} discount`}).</> : <>Estimated total: {money.format(Number(quantity || 1) * Number(unitPrice || 0))}.</>} A production job is created automatically for the selected product.</div>{message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}<div className="flex gap-2"><Button className="flex-1" onClick={create} disabled={saving}>{saving ? "Creating..." : "Create order"}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button></div></div></SheetContent></Sheet>;
}

function OrderDrawer({ order, data, open, onOpenChange, onRefresh }: { order: Order | null; data: AdminDashboardData | null; open: boolean; onOpenChange: (open: boolean) => void; onRefresh: (orderId?: string) => Promise<void> }) {
  const [status, setStatus] = useState("new");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [productionStatus, setProductionStatus] = useState("new");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const items = (data?.orderItems ?? []).filter((item) => item.order_id === order?.id);
  const payments = (data?.payments ?? []).filter((payment) => payment.order_id === order?.id);
  const messages = (data?.messages ?? []).filter((item) => item.order_id === order?.id);
  const jobs = (data?.productionJobs ?? []).filter((job) => job.order_id === order?.id);
  const artwork = (data?.artworkFiles ?? []).filter((file) => file.order_id === order?.id || items.some((item) => item.id === file.order_item_id));
  const proofs = (data?.proofs ?? []).filter((proof) => items.some((item) => item.id === proof.order_item_id));

  useEffect(() => { setStatus(order?.status || "new"); setPaymentStatus(order?.payment_status || "unpaid"); setProductionStatus(order?.production_status || "new"); setDueAt(order?.due_at ? new Date(order.due_at).toISOString().slice(0, 10) : ""); setNotes(order?.internal_notes || ""); setMessage(""); }, [order]);

  async function saveOrder() {
    if (!order) return;
    setSaving(true);
    setMessage("Saving order...");
    try {
      await updateAdminOrder({ orderId: order.id, status, paymentStatus, productionStatus, internalNotes: notes, dueAt });
      setMessage("Order saved.");
      await onRefresh(order.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save order.");
    } finally {
      setSaving(false);
    }
  }

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="overflow-y-auto sm:max-w-[60rem]"><SheetHeader><SheetTitle>#{order?.order_number || "Order"}</SheetTitle><SheetDescription>{order?.users?.full_name || order?.company || "Guest customer"} - {order?.customer_email}</SheetDescription></SheetHeader>{order && <div className="mt-6 space-y-5"><div className="grid gap-3 sm:grid-cols-3"><FieldSelect label="Order status" value={status} onChange={setStatus} items={orderStatuses.map((item) => ({ value: item, label: human(item) }))} /><FieldSelect label="Payment status" value={paymentStatus} onChange={setPaymentStatus} items={paymentStatuses.map((item) => ({ value: item, label: human(item) }))} /><FieldSelect label="Production" value={productionStatus} onChange={setProductionStatus} items={productionStatuses.map((item) => ({ value: item, label: human(item) }))} /></div><div className="grid gap-3 sm:grid-cols-3"><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Due date</div><DateInput value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div><LinkedMeta label="Total" value={money.format(numberValue(order.total))} subvalue={numberValue(order.discount_amount) > 0 ? `Subtotal ${money.format(numberValue(order.subtotal))} — Discount -${money.format(numberValue(order.discount_amount))}` : "Order total"} /><Button asChild variant="outline" className="h-full min-h-[62px]"><Link href="/admin/payments">Process payment</Link></Button></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Internal notes</div><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>{message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}<Button onClick={saveOrder} disabled={saving}>{saving ? "Saving..." : "Save order"}</Button><div className="grid gap-4 xl:grid-cols-2"><Section title="Products" count={items.length}>{items.map((item) => <Row key={item.id} title={item.products?.name || "Unassigned product"} detail={`${item.products?.category || "Catalog"} - Qty ${item.quantity}`} value={money.format(numberValue(item.line_total))} />)}</Section><Section title="Payments" count={payments.length}>{payments.map((payment) => <Row key={payment.id} title={`${human(payment.provider)} ${human(payment.status)}`} detail={payment.payment_link_url || payment.notes || "Payment record"} value={money.format(numberValue(payment.amount))} />)}</Section><Section title="Artwork and proofs" count={artwork.length + proofs.length}>{artwork.map((file) => <Row key={file.id} title={file.filename} detail={human(file.review_status)} value={fileSize(file.file_size_bytes)} />)}{proofs.map((proof) => <Row key={proof.id} title={`Proof v${proof.revision_number || 1}`} detail={human(proof.status)} value={proof.customer_approved_at ? "Approved" : "Open"} />)}</Section><Section title="Production / shipping" count={jobs.length}>{jobs.map((job) => <Row key={job.id} title={job.station || "Production"} detail={human(job.status)} value={job.due_at ? new Date(job.due_at).toLocaleDateString() : "No due"} />)}</Section><Section title="Messages and notes" count={messages.length}>{messages.map((item) => <Row key={item.id} title={item.subject || human(item.channel)} detail={item.body || human(item.direction)} value={human(item.channel)} />)}</Section></div></div>}</SheetContent></Sheet>;
}

function FieldSelect({ label, value, onChange, items, placeholder }: { label: string; value: string; onChange: (value: string) => void; items: { value: string; label: string }[]; placeholder?: string }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{placeholder && <SelectItem value="none">{placeholder}</SelectItem>}{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>;
}

function LinkedMeta({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return <div className="rounded-lg border bg-secondary/25 px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm font-medium">{value}</div>{subvalue && <div className="mt-1 break-words text-xs text-muted-foreground">{subvalue}</div>}</div>;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><Badge variant="outline">{count}</Badge></div><div className="space-y-2">{count ? children : <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No records yet.</div>}</div></div>;
}

function Row({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge variant="outline">{value}</Badge></div>;
}

function fileSize(value: number | string | null | undefined) {
  const bytes = Number(value || 0);
  if (!bytes) return "Unknown";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
