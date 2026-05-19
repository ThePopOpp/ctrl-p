"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight, Moon, Search, Sun } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData, updateAdminOrder } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, Order } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const orderStatuses = ["new", "quote_requested", "awaiting_payment", "paid", "file_review", "proofing", "approved", "in_production", "ready_for_pickup", "ready_to_ship", "shipped", "delivered", "completed", "cancelled", "refunded"];
const paymentStatuses = ["unpaid", "pending", "paid", "partially_paid", "failed", "refunded", "partially_refunded"];
const productionStatuses = ["new", "file_check", "design_needed", "proof_pending", "proof_approved", "print_ready", "printing", "finishing", "install_scheduled", "ready", "completed", "on_hold"];

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function statusTone(status: string) {
  if (["paid", "completed", "ready", "delivered", "proof_approved"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["pending", "proof_pending", "printing", "finishing", "file_check", "print_ready", "in_production"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  if (["unpaid", "failed", "cancelled", "refunded", "on_hold"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-secondary text-secondary-foreground";
}

export function AdminOrders() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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

  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const users = data?.users ?? [];
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
                      className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
                      {label === "Users" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{users.length}</Badge>}
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
              <span className="font-medium text-foreground">Orders</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search orders, customers, statuses..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/orders">Go to login</a></Button></CardContent></Card>
          )}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Orders command center</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Manage customer orders, payment holds, production status, due dates, line items, messages, and internal notes.</p>
                </div>
                <Button asChild><Link href="/admin/payments">Create invoice</Link></Button>
              </div>

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Stat label="Orders" value={String(orders.length)} hint={`${filteredOrders.length} visible`} />
                <Stat label="Open payment" value={String(openPaymentOrders)} hint="Needs billing follow-up" />
                <Stat label="Production" value={String(activeProduction)} hint="Active operational queue" />
                <Stat label="Revenue" value={money.format(revenue)} hint="Paid records loaded" />
                <Stat label="Messages" value={String(messages.length)} hint="Customer/internal activity" />
              </section>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Live orders</CardTitle>
                  <CardDescription>Click any order to review details and update statuses.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Production</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right pr-4">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                          <TableCell className="pl-4 font-mono text-xs">#{order.order_number || order.id.slice(0, 8)}</TableCell>
                          <TableCell>
                            <div className="font-medium">{order.users?.full_name || order.company || "Guest customer"}</div>
                            <div className="text-xs text-muted-foreground">{order.customer_email || order.customer_phone}</div>
                          </TableCell>
                          <TableCell><StatusBadge status={order.status} /></TableCell>
                          <TableCell><StatusBadge status={order.payment_status} /></TableCell>
                          <TableCell>{human(order.production_status)}</TableCell>
                          <TableCell>{order.due_at ? new Date(order.due_at).toLocaleDateString() : "Not set"}</TableCell>
                          <TableCell className="pr-4 text-right font-semibold">{money.format(numberValue(order.total))}</TableCell>
                        </TableRow>
                      ))}
                      {!filteredOrders.length && <TableRow><TableCell colSpan={7} className="p-6 text-center text-muted-foreground">No orders found.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </main>

        <OrderDrawer order={selectedOrder} data={data} open={Boolean(selectedOrder)} onOpenChange={(open) => !open && setSelectedOrder(null)} onRefresh={refresh} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn("border", statusTone(status))}>{human(status)}</Badge>;
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

  useEffect(() => {
    setStatus(order?.status || "new");
    setPaymentStatus(order?.payment_status || "unpaid");
    setProductionStatus(order?.production_status || "new");
    setDueAt(order?.due_at ? new Date(order.due_at).toISOString().slice(0, 10) : "");
    setNotes(order?.internal_notes || "");
    setMessage("");
  }, [order]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>#{order?.order_number || "Order"}</SheetTitle>
          <SheetDescription>{order?.users?.full_name || order?.company || "Guest customer"} - {order?.customer_email}</SheetDescription>
        </SheetHeader>
        {order && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <FieldSelect label="Order status" value={status} onChange={setStatus} items={orderStatuses} />
              <FieldSelect label="Payment status" value={paymentStatus} onChange={setPaymentStatus} items={paymentStatuses} />
              <FieldSelect label="Production" value={productionStatus} onChange={setProductionStatus} items={productionStatuses} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Due date</div><Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div>
              <div className="rounded-lg border bg-secondary/30 p-3"><div className="text-xs font-semibold uppercase text-muted-foreground">Total</div><div className="mt-1 text-xl font-semibold">{money.format(numberValue(order.total))}</div></div>
            </div>
            <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Internal notes</div><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}
            <Button onClick={saveOrder} disabled={saving}>{saving ? "Saving..." : "Save order"}</Button>

            <Section title="Line items" count={items.length}>
              {items.map((item) => <Row key={item.id} title={item.products?.name || "Unassigned product"} detail={`${item.products?.category || "Catalog"} - Qty ${item.quantity}`} value={money.format(numberValue(item.line_total))} />)}
            </Section>
            <Section title="Payments" count={payments.length}>
              {payments.map((payment) => <Row key={payment.id} title={`${human(payment.provider)} ${human(payment.status)}`} detail={payment.payment_link_url || payment.notes || "Payment record"} value={money.format(numberValue(payment.amount))} />)}
            </Section>
            <Section title="Messages" count={messages.length}>
              {messages.map((item) => <Row key={item.id} title={item.subject || human(item.channel)} detail={item.body || human(item.direction)} value={human(item.channel)} />)}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FieldSelect({ label, value, onChange, items }: { label: string; value: string; onChange: (value: string) => void; items: string[] }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}</SelectContent></Select></div>;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><Badge variant="outline">{count}</Badge></div><div className="space-y-2">{count ? children : <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No records yet.</div>}</div></div>;
}

function Row({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge variant="outline">{value}</Badge></div>;
}
