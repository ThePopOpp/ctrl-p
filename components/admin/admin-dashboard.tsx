"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CircleDollarSign,
  LogOut,
  Moon,
  Search,
  Sun,
  Trophy,
  Zap,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import {
  getCurrentAdminProfile,
  loadAdminDashboardData,
  markMessageRead,
  updateProductionJobStatus,
} from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, Order } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const productionStatuses = [
  "new",
  "file_check",
  "design_needed",
  "proof_pending",
  "proof_approved",
  "print_ready",
  "printing",
  "finishing",
  "install_scheduled",
  "ready",
  "completed",
  "on_hold",
];

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function initials(value: string | null | undefined) {
  return String(value || "CP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusTone(status: string) {
  if (["paid", "completed", "ready", "delivered", "proof_approved"].includes(status)) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (["pending", "proof_pending", "printing", "finishing", "file_check", "print_ready"].includes(status)) {
    return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  }
  if (["unpaid", "needs_changes", "file_review", "on_hold"].includes(status)) {
    return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  return "border-border bg-secondary text-secondary-foreground";
}

export function AdminDashboard() {
  const pathname = usePathname();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
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

  async function handleSignOut() {
    const db = getSupabaseBrowserClient();
    if (db) await db.auth.signOut();
    window.location.href = "/login";
  }

  async function refresh(openOrderId?: string) {
    const nextData = await loadAdminDashboardData();
    setData(nextData);
    if (openOrderId) {
      setSelectedOrder(nextData.orders.find((order) => order.id === openOrderId) ?? null);
    }
  }

  const dashboard = data;
  const orders = dashboard?.orders ?? [];
  const productionJobs = dashboard?.productionJobs ?? [];
  const unreadMessages = dashboard?.messages ?? [];
  const payments = dashboard?.payments ?? [];
  const orderItems = dashboard?.orderItems ?? [];

  const revenue = useMemo(
    () => payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + numberValue(payment.amount), 0),
    [payments],
  );

  const activeProduction = productionJobs.filter((job) => !["completed", "ready"].includes(job.status));
  const pendingPayments = orders.filter((order) => ["unpaid", "pending", "partially_paid"].includes(order.payment_status));
  const approvalsNeeded = orders.filter((order) => ["file_review", "proofing"].includes(order.status));
  const averageOrder = orders.length ? revenue / orders.length : 0;
  const completedJobs = productionJobs.filter((job) => ["completed", "ready"].includes(job.status)).length;
  const productionCompletion = productionJobs.length ? Math.round((completedJobs / productionJobs.length) * 100) : 0;

  const productLeaders = useMemo(() => {
    const map = new Map<string, { name: string; category: string; revenue: number; quantity: number }>();
    for (const item of orderItems) {
      const product = item.products;
      const key = product?.id || product?.name || "unknown";
      const current = map.get(key) || {
        name: product?.name || "Unassigned product",
        category: product?.category || "Catalog",
        revenue: 0,
        quantity: 0,
      };
      current.revenue += numberValue(item.line_total);
      current.quantity += Number(item.quantity || 0);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  }, [orderItems]);

  const alerts = [
    approvalsNeeded.length ? ["high", `${approvalsNeeded.length} orders waiting on artwork or proof review`] : null,
    pendingPayments.length ? ["med", `${pendingPayments.length} orders have open payment follow-up`] : null,
    unreadMessages.length ? ["med", `${unreadMessages.length} unread customer/internal messages`] : null,
  ].filter(Boolean) as string[][];

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
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{unreadMessages.length}</Badge>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="absolute bottom-3 left-3 right-3">
            <Separator className="mb-3" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold">JW</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">Jeremy Waters</div>
                <div className="truncate text-[10px] text-muted-foreground">Owner - Super Admin</div>
              </div>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span>Super Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Dashboard</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search orders, customers, products..." />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <Badge variant="outline" className="hidden h-8 gap-2 rounded-lg px-2 md:flex">
                JW <span className="font-normal text-muted-foreground">jw@controlp.io</span>
              </Badge>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && (
            <Card className="mb-5">
              <CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent>
            </Card>
          )}

          {authState === "denied" && (
            <Card className="mb-5 border-red-500/30">
              <CardContent className="p-5">
                <div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div>
                <p className="mt-2 text-sm text-muted-foreground">Sign in with an active staff or admin account before opening the Next.js admin console.</p>
                <Button className="mt-4" asChild>
                  <a href="/login?redirect=/admin">Go to login</a>
                </Button>
              </CardContent>
            </Card>
          )}

          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Super Admin command center</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                    Network-wide view of orders, production, file review, payments, messages, and revenue - preview data for layout and workflows.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button>New order</Button>
                  <Button variant="outline">Export</Button>
                </div>
              </div>

              <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-10">
                <StatCard label="Revenue" value={money.format(revenue)} hint="Paid this week" />
                <StatCard label="Orders" value={String(orders.length)} hint={`${pendingPayments.length} payment holds`} />
                <StatCard label="AOV" value={money.format(averageOrder)} hint="Average order" />
                <StatCard label="Jobs" value={String(productionJobs.length)} hint={`${activeProduction.length} active`} />
                <StatCard label="Print ready" value={String(productionJobs.filter((job) => job.status === "print_ready").length)} hint="Queued next" />
                <StatCard label="Proofing" value={String(productionJobs.filter((job) => job.status === "proof_pending").length)} hint="Customer lane" />
                <StatCard label="Approvals" value={String(approvalsNeeded.length)} hint="Need review" />
                <StatCard label="Messages" value={String(unreadMessages.length)} hint="Unread" />
                <StatCard label="Completion" value={`${productionCompletion}%`} hint="Queue closure" />
                <StatCard label="Products" value={String(productLeaders.length)} hint="Selling now" />
              </section>

              <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">Production health overview</CardTitle>
                        <CardDescription>Live posture across the shop floor</CardDescription>
                      </div>
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-4">
                      {["file_check", "proof_pending", "printing", "on_hold"].map((status) => (
                        <div key={status} className={cn("rounded-lg border p-4 text-center", statusTone(status))}>
                          <div className="text-[10px] font-semibold uppercase">{human(status)}</div>
                          <div className="mt-1 text-2xl font-semibold">{productionJobs.filter((job) => job.status === status).length}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-4 w-4 text-primary" />
                      Active production is tracking {activeProduction.length} jobs across prepress, design, print, and finishing.
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Order pipeline</CardTitle>
                    <CardDescription>Status distribution across live orders</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {["file_review", "proofing", "in_production", "awaiting_payment"].map((status) => {
                      const count = orders.filter((order) => order.status === status || order.production_status === status).length;
                      const width = Math.max(8, Math.round((count / Math.max(1, orders.length)) * 100));
                      return (
                        <div key={status} className="rounded-lg border bg-background/35 p-2.5">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-medium">{human(status)}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </section>

              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                    <div>
                      <CardTitle className="text-base">Alerts and errors</CardTitle>
                      <CardDescription>Operational triage lane</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {alerts.length ? alerts.map(([level, text]) => (
                    <div key={text} className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2 text-sm">
                      <Badge className={cn("border-0", level === "high" ? "bg-red-500/10 text-red-600 dark:text-red-300" : "bg-primary/15 text-foreground")}>{level}</Badge>
                      <span>{text}</span>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No live operational alerts.</div>
                  )}
                  <Button className="h-8 w-full" variant="outline">Route to automation</Button>
                </CardContent>
              </Card>

              <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent orders</CardTitle>
                    <CardDescription>Click a row to inspect the shadcn Sheet detail view</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Order</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Production</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                            <TableCell className="pl-4 font-mono text-xs">#{order.order_number}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-[10px] font-semibold">
                                  {initials(order.users?.full_name || order.company)}
                                </div>
                                <div>
                                  <div className="font-medium">{order.users?.full_name || order.company || "Guest customer"}</div>
                                  <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><StatusBadge status={order.status} /></TableCell>
                            <TableCell>{human(order.production_status)}</TableCell>
                            <TableCell className="text-right font-semibold">{money.format(numberValue(order.total))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent messages</CardTitle>
                    <CardDescription>Unread customer and internal notes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {unreadMessages.slice(0, 5).map((message) => (
                      <div key={message.id} className="rounded-lg border bg-background/35 p-3">
                        <div className="text-sm font-medium">{message.subject || "Unread message"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{human(message.channel)} - {human(message.direction)}</div>
                      </div>
                    ))}
                    {!unreadMessages.length && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No unread messages.</div>}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <LeaderCard icon={<Trophy className="h-5 w-5 text-primary" />} title="Top products" subtitle="Revenue-weighted live order mix">
                  {productLeaders.map((product, index) => (
                    <LeaderRow key={product.name} index={index + 1} name={product.name} detail={`${product.quantity} units ordered`} value={money.format(product.revenue)} />
                  ))}
                </LeaderCard>
                <LeaderCard icon={<CircleDollarSign className="h-5 w-5 text-primary" />} title="Production queue" subtitle="Priority-weighted job lane">
                  {productionJobs.slice(0, 4).map((job, index) => (
                    <LeaderRow
                      key={job.id}
                      index={index + 1}
                      name={`${job.orders?.order_number || "Order"} - ${job.order_items?.products?.name || human(job.status)}`}
                      detail={`${human(job.status)} - ${job.station || "No station"}`}
                      value={job.priority ? `P${job.priority}` : "Live"}
                    />
                  ))}
                </LeaderCard>
              </section>
            </>
          )}
        </main>

        <OrderSheet
          data={dashboard}
          order={selectedOrder}
          open={Boolean(selectedOrder)}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="min-h-[96px]">
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-[22px] font-semibold leading-none">{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn("border", statusTone(status))}>{human(status)}</Badge>;
}

function LeaderCard({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        {icon}
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function LeaderRow({ index, name, detail, value }: { index: number; name: string; detail: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b py-3 last:border-0">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-sm font-semibold">{index}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <Badge variant="outline">{value}</Badge>
    </div>
  );
}

function OrderSheet({
  data,
  order,
  open,
  onOpenChange,
  onRefresh,
}: {
  data: AdminDashboardData | null;
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: (openOrderId?: string) => Promise<void>;
}) {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("new");
  const [actionMessage, setActionMessage] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const items = (data?.orderItems ?? []).filter((item) => item.order_id === order?.id);
  const jobs = (data?.productionJobs ?? []).filter((job) => job.order_id === order?.id);
  const payments = (data?.payments ?? []).filter((payment) => payment.order_id === order?.id);
  const messages = (data?.messages ?? []).filter((message) => message.order_id === order?.id);

  useEffect(() => {
    const firstJob = jobs[0];
    setSelectedJobId(firstJob?.id ?? "");
    setSelectedStatus(firstJob?.status ?? "new");
    setActionMessage("");
  }, [order?.id, jobs]);

  async function saveProductionStatus() {
    if (!order || !selectedJobId) return;
    setSaving(true);
    setActionMessage("Saving production status...");
    try {
      await updateProductionJobStatus(selectedJobId, selectedStatus, order.id);
      setActionMessage("Production status saved.");
      await onRefresh(order.id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Could not save production status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkRead(messageId: string) {
    if (!order) return;
    setSaving(true);
    setActionMessage("Marking message read...");
    try {
      await markMessageRead(messageId, order.id);
      setActionMessage("Message marked read.");
      await onRefresh(order.id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Could not mark message read.");
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
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <SummaryTile label="Order status"><StatusBadge status={order.status} /></SummaryTile>
              <SummaryTile label="Payment"><StatusBadge status={order.payment_status} /></SummaryTile>
              <SummaryTile label="Production"><span className="font-semibold">{human(order.production_status)}</span></SummaryTile>
              <SummaryTile label="Total"><span className="font-semibold">{money.format(numberValue(order.total))}</span></SummaryTile>
            </div>

            <Section title="Line items" count={items.length}>
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{item.products?.name || "Unassigned product"}</div>
                    <div className="text-xs text-muted-foreground">{item.products?.category || "Catalog"} - Qty {item.quantity}</div>
                  </div>
                  <div className="font-semibold">{money.format(numberValue(item.line_total))}</div>
                </div>
              ))}
            </Section>

            <Section title="Production jobs" count={jobs.length}>
              {jobs.map((job) => (
                <div key={job.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{job.order_items?.products?.name || human(job.status)}</div>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{job.station || "No station assigned"}</div>
                </div>
              ))}
            </Section>

            {jobs.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Update production</h3>
                <div className="rounded-lg border bg-secondary/30 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Select
                      value={selectedJobId}
                      onValueChange={(value) => {
                        const job = jobs.find((item) => item.id === value);
                        setSelectedJobId(value);
                        setSelectedStatus(job?.status ?? "new");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Production job" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.order_items?.products?.name || human(job.status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {human(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button type="button" disabled={saving} onClick={saveProductionStatus}>
                      Save
                    </Button>
                  </div>
                  {actionMessage && <div className="mt-2 text-xs text-muted-foreground">{actionMessage}</div>}
                </div>
              </div>
            )}

            <Section title="Payments and unread messages" count={payments.length + messages.length}>
              {payments.map((payment) => (
                <div key={payment.id} className="rounded-lg border p-3">
                  <div className="font-medium">Payment {human(payment.status)}</div>
                  <div className="text-xs text-muted-foreground">{money.format(numberValue(payment.amount))} - {payment.provider || "manual"}</div>
                </div>
              ))}
              {messages.map((message) => (
                <div key={message.id} className="rounded-lg border p-3">
                  <div className="font-medium">{message.subject || "Unread message"}</div>
                  <div className="text-xs text-muted-foreground">{human(message.channel)} - {human(message.direction)}</div>
                  <Button className="mt-2" size="sm" variant="outline" disabled={saving} onClick={() => handleMarkRead(message.id)}>
                    Mark read
                  </Button>
                </div>
              ))}
            </Section>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Notes</h3>
              <div className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
                {order.internal_notes || order.customer_notes || "No notes yet."}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="space-y-2">
        {count ? children : <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No records yet.</div>}
      </div>
      <Separator className="mt-4" />
    </div>
  );
}
