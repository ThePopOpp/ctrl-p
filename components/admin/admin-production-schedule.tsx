"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Bell, Calendar, ChevronLeft, ChevronRight, Eye, EyeOff, Flag, Link2, Moon, Plus, Search, Sun, Trash2 } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, AdminUser, Order, OrderItem, Product, ProductionJob } from "@/lib/admin/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ScheduleItem = {
  id: string;
  order_id: string | null;
  order_item_id: string | null;
  production_job_id: string | null;
  product_id: string | null;
  customer_id: string | null;
  parent_item_id: string | null;
  title: string;
  description: string | null;
  item_type: string;
  phase: string | null;
  status: string;
  priority: string;
  assigned_to_user_id: string | null;
  assigned_department: string | null;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  estimated_duration_days: number | string | null;
  progress_percent: number | null;
  customer_visible: boolean;
  internal_only: boolean;
  is_blocked: boolean;
  blocker_type: string | null;
  blocker_reason: string | null;
  artwork_review_status: string | null;
  proof_status: string | null;
  production_status: string | null;
  sort_order: number | null;
  internal_notes: string | null;
  customer_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  orders?: {
    id: string;
    order_number: string | null;
    company: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    status: string | null;
    production_status: string | null;
    payment_status: string | null;
    due_at: string | null;
  } | null;
  order_items?: {
    id: string;
    quantity: number | null;
    products?: { id: string; name: string | null; category: string | null } | null;
  } | null;
  products?: { id: string; name: string | null; category: string | null; product_type?: string | null } | null;
  users?: { id: string; full_name: string | null; email: string | null; phone?: string | null; company?: string | null } | null;
  assignee?: { id: string; full_name: string | null; email: string | null; role: string | null } | null;
  production_jobs?: { id: string; status: string | null; station: string | null; due_at: string | null } | null;
};

type ScheduleDependency = {
  id: string;
  parent_item_id: string;
  dependent_item_id: string;
  dependency_type: string;
  lag_days: number | null;
  required_completion_date: string | null;
  delay_impact_notes: string | null;
  notes: string | null;
  auto_shift_schedule: boolean;
  parent?: { id: string; title: string | null; status: string | null; due_date: string | null } | null;
  dependent?: { id: string; title: string | null; status: string | null; start_date: string | null } | null;
};

type SchedulePayload = {
  id?: string;
  order_id: string | null;
  order_item_id: string | null;
  production_job_id: string | null;
  product_id: string | null;
  customer_id: string | null;
  parent_item_id: string | null;
  title: string;
  description: string;
  item_type: string;
  phase: string;
  status: string;
  priority: string;
  assigned_to_user_id: string | null;
  assigned_department: string;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  estimated_duration_days: number | null;
  progress_percent: number;
  customer_visible: boolean;
  internal_only: boolean;
  is_blocked: boolean;
  blocker_type: string;
  blocker_reason: string;
  artwork_review_status: string;
  proof_status: string;
  production_status: string;
  sort_order: number;
  internal_notes: string;
  customer_notes: string;
};

const staffRoles = new Set(["super_admin", "admin", "employee", "staff", "production_manager", "designer", "installer", "customer_support", "vendor"]);
const itemTypes = ["phase", "task", "milestone", "approval", "artwork_review", "proof", "production_step", "qc_check", "delivery", "installation", "customer_action"];
const statuses = ["not_started", "in_progress", "waiting_on_customer", "waiting_on_artwork", "waiting_on_proof_approval", "waiting_on_materials", "waiting_on_vendor", "needs_internal_review", "needs_customer_review", "ready_for_production", "in_production", "quality_check", "completed", "approved", "reopened", "blocked", "on_hold"];
const priorities = ["low", "normal", "high", "rush", "critical", "blocking_production", "blocking_delivery_install"];
const phases = ["Intake / Quote", "Artwork / Design", "File Review", "Proofing / Approval", "Materials / Procurement", "Pre-Production", "Print Production", "Fabrication", "Finishing", "Quality Check", "Packaging", "Pickup / Shipping / Delivery", "Installation", "Customer Sign-Off", "Closeout"];
const departments = ["Design", "Prepress", "Production", "Print", "Embroidery", "Screen Printing", "DTF / DTG", "Vinyl", "Fabrication", "QC", "Shipping", "Install", "Customer Support"];
const views = ["Overview", "Gantt Timeline", "Tasks", "Milestones", "Approvals", "Install / Delivery", "Blocked Items"];

function human(value: string | null | undefined) {
  return String(value || "none").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const startMs = new Date(`${start}T12:00:00`).getTime();
  const endMs = new Date(`${end}T12:00:00`).getTime();
  return Math.max(0, Math.round((endMs - startMs) / 86400000));
}

function durationDays(item: ScheduleItem, start: string, end: string) {
  const explicit = Number(item.estimated_duration_days || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return daysBetween(start, end) + 1;
}

function statusTone(status: string) {
  if (["completed", "approved"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["blocked", "on_hold", "reopened"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  if (status.startsWith("waiting_on") || status.includes("review")) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (["in_progress", "ready_for_production", "in_production", "quality_check"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  return "border-border bg-secondary text-secondary-foreground";
}

function priorityTone(priority: string) {
  if (["critical", "blocking_production", "blocking_delivery_install"].includes(priority)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  if (["rush", "high"].includes(priority)) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (priority === "low") return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  return "border-border bg-secondary text-secondary-foreground";
}

function itemTypeLabel(item: ScheduleItem) {
  if (item.item_type === "production_step" && item.assigned_department) return item.assigned_department;
  return human(item.item_type);
}

async function getAdminToken() {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase is not configured.");
  const sessionResult = await db.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  if (!token) throw new Error("Sign in again before managing production schedule.");
  return token;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAdminToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload as { error?: string };
    throw new Error(error.error || "Schedule request failed.");
  }
  return payload as T;
}

export function AdminProductionSchedule() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [dependencies, setDependencies] = useState<ScheduleDependency[]>([]);
  const [activeView, setActiveView] = useState("Overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [selectedDependency, setSelectedDependency] = useState<ScheduleDependency | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refresh(openItemId?: string) {
    const [nextData, itemPayload, dependencyPayload] = await Promise.all([
      loadAdminDashboardData(),
      apiJson<{ items: ScheduleItem[] }>("/api/admin/production-schedule"),
      apiJson<{ dependencies: ScheduleDependency[] }>("/api/admin/production-schedule/dependencies"),
    ]);
    setData(nextData);
    setItems(itemPayload.items);
    setDependencies(dependencyPayload.dependencies);
    if (openItemId) setSelectedItem(itemPayload.items.find((item) => item.id === openItemId) ?? null);
  }

  useEffect(() => {
    async function boot() {
      try {
        const profile = await getCurrentAdminProfile();
        if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
          setAuthState("denied");
          return;
        }
        setAuthState("allowed");
        await refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load production schedule.");
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  const orders = data?.orders ?? [];
  const users = data?.users ?? [];
  const products = data?.products ?? [];
  const orderItems = data?.orderItems ?? [];
  const productionJobs = data?.productionJobs ?? [];
  const staff = users.filter((user) => staffRoles.has(user.role));

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (visibilityFilter === "customer" && !item.customer_visible) return false;
      if (visibilityFilter === "internal" && item.customer_visible) return false;
      if (!needle) return true;
      const order = orders.find((row) => row.id === item.order_id);
      const product = products.find((row) => row.id === item.product_id);
      const customer = users.find((row) => row.id === item.customer_id);
      const assignee = users.find((row) => row.id === item.assigned_to_user_id);
      return [
        item.title,
        item.description,
        item.phase,
        item.status,
        item.priority,
        item.assigned_department,
        item.blocker_reason,
        order?.order_number,
        order?.company,
        order?.customer_email,
        product?.name,
        product?.category,
        customer?.full_name,
        customer?.email,
        assignee?.full_name,
        assignee?.email,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [items, orders, priorityFilter, products, query, statusFilter, users, visibilityFilter]);

  const sectionItems = useMemo(() => {
    if (activeView === "Tasks") return visibleItems.filter((item) => ["task", "production_step", "artwork_review", "qc_check"].includes(item.item_type));
    if (activeView === "Milestones") return visibleItems.filter((item) => item.item_type === "milestone");
    if (activeView === "Approvals") return visibleItems.filter((item) => ["approval", "proof", "artwork_review", "customer_action"].includes(item.item_type));
    if (activeView === "Install / Delivery") return visibleItems.filter((item) => ["delivery", "installation"].includes(item.item_type));
    if (activeView === "Blocked Items") return visibleItems.filter((item) => item.is_blocked || item.status === "blocked");
    return visibleItems;
  }, [activeView, visibleItems]);

  const activeItems = items.filter((item) => !["completed", "approved"].includes(item.status));
  const blockedItems = items.filter((item) => item.is_blocked || item.status === "blocked");
  const customerVisibleItems = items.filter((item) => item.customer_visible);
  const overdueItems = items.filter((item) => item.due_date && !["completed", "approved"].includes(item.status) && item.due_date < dateOnly(new Date()));
  const approvalItems = items.filter((item) => ["approval", "proof", "artwork_review", "customer_action"].includes(item.item_type));
  const installItems = items.filter((item) => ["delivery", "installation"].includes(item.item_type));

  async function saveItem(input: SchedulePayload) {
    const payload = await apiJson<{ item: ScheduleItem }>("/api/admin/production-schedule", {
      method: input.id ? "PATCH" : "POST",
      body: JSON.stringify(input),
    });
    await refresh(payload.item.id);
    setMessage(input.id ? "Schedule item updated." : "Schedule item created.");
    return payload.item;
  }

  async function updateItemDates(item: ScheduleItem, updates: { start_date: string | null; end_date: string | null; due_date: string | null; estimated_duration_days?: number | null }) {
    const nextPayload = {
      ...payloadFromItem(item),
      start_date: updates.start_date,
      end_date: updates.end_date,
      due_date: updates.due_date,
      estimated_duration_days: updates.estimated_duration_days ?? (updates.start_date && updates.end_date ? daysBetween(updates.start_date, updates.end_date) + 1 : Number(item.estimated_duration_days || 0)),
    };
    await saveItem(nextPayload);
  }

  async function deleteItem(item: ScheduleItem) {
    const confirmed = window.confirm(`Delete "${item.title}" from the production schedule?`);
    if (!confirmed) return;
    await apiJson("/api/admin/production-schedule", {
      method: "DELETE",
      body: JSON.stringify({ id: item.id }),
    });
    setSelectedItem(null);
    await refresh();
    setMessage("Schedule item deleted.");
  }

  async function createDependency(input: {
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days?: number;
    required_completion_date: string | null;
    delay_impact_notes?: string;
    notes?: string;
    auto_shift_schedule: boolean;
  }) {
    const payload = await apiJson<{ dependency: ScheduleDependency }>("/api/admin/production-schedule/dependencies", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await refresh();
    setMessage(`Dependency created for ${payload.dependency.dependency_type.replace(/_/g, " ")}.`);
  }

  async function updateDependency(input: {
    id: string;
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days: number;
    required_completion_date: string | null;
    notes: string;
    auto_shift_schedule: boolean;
  }) {
    const payload = await apiJson<{ dependency: ScheduleDependency }>("/api/admin/production-schedule/dependencies", {
      method: "PATCH",
      body: JSON.stringify({
        ...input,
        delay_impact_notes: input.notes,
      }),
    });
    await refresh();
    setSelectedDependency(payload.dependency);
    setMessage("Dependency updated.");
  }

  async function deleteDependency(dependency: ScheduleDependency) {
    await apiJson("/api/admin/production-schedule/dependencies", {
      method: "DELETE",
      body: JSON.stringify({ id: dependency.id }),
    });
    await refresh();
    setSelectedDependency(null);
    setMessage("Dependency removed.");
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
                      className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Production Schedule" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{activeItems.length}</Badge>}
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
              <span className="font-medium text-foreground">Production Schedule</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[420px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search schedule, orders, customers, products..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/production-schedule">Go to login</a></Button></CardContent></Card>
          )}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Project Management / Gantt Schedule</h1>
                  <p className="mt-1 max-w-4xl text-sm leading-5 text-muted-foreground">
                    Schedule design, artwork review, proofing, production, QC, shipping, delivery, installation, blockers, and customer-visible milestones between Orders and Production.
                  </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add schedule item</Button>
              </div>

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <ScheduleStat label="Scheduled jobs" value={String(activeItems.length)} hint="Open timeline items" />
                <ScheduleStat label="Blocked" value={String(blockedItems.length)} hint="Needs triage" urgent={blockedItems.length > 0} />
                <ScheduleStat label="Overdue" value={String(overdueItems.length)} hint="Past due date" urgent={overdueItems.length > 0} />
                <ScheduleStat label="Approvals" value={String(approvalItems.length)} hint="Proof and customer action" />
                <ScheduleStat label="Install / delivery" value={String(installItems.length)} hint="Fulfillment schedule" />
                <ScheduleStat label="Customer visible" value={String(customerVisibleItems.length)} hint="Shared checkpoints" />
              </section>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                {views.map((view) => (
                  <Button key={view} variant={activeView === view ? "default" : "outline"} size="sm" onClick={() => setActiveView(view)}>
                    {view}
                  </Button>
                ))}
                <div className="ml-auto flex flex-wrap gap-2">
                  <FilterSelect value={statusFilter} onChange={setStatusFilter} items={statuses} placeholder="All statuses" />
                  <FilterSelect value={priorityFilter} onChange={setPriorityFilter} items={priorities} placeholder="All priorities" />
                  <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                    <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All visibility</SelectItem>
                      <SelectItem value="customer">Customer visible</SelectItem>
                      <SelectItem value="internal">Internal only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {message && <div className="mb-4 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{message}</div>}
              {loading ? (
                <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading production schedule...</CardContent></Card>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-4">
                    {(activeView === "Overview" || activeView === "Gantt Timeline") && (
                      <GanttTimeline
                        items={sectionItems}
                        dependencies={dependencies}
                        onSelect={setSelectedItem}
                        onUpdateItemDates={updateItemDates}
                        onCreateDependency={createDependency}
                        onSelectDependency={setSelectedDependency}
                      />
                    )}
                    <ScheduleTable items={sectionItems} orders={orders} users={users} products={products} onSelect={setSelectedItem} onDelete={deleteItem} />
                  </div>
                  <DependencyPanel items={items} dependencies={dependencies} onCreate={createDependency} onDelete={deleteDependency} />
                </div>
              )}
            </>
          )}
        </main>

        <ScheduleItemSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          data={data}
          staff={staff}
          onSave={async (input) => {
            await saveItem(input);
            setCreateOpen(false);
          }}
        />
        <ScheduleItemSheet
          open={Boolean(selectedItem)}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
          item={selectedItem}
          data={data}
          staff={staff}
          onSave={async (input) => {
            await saveItem(input);
          }}
          onDelete={selectedItem ? () => deleteItem(selectedItem) : undefined}
        />
        <DependencyInspector
          dependency={selectedDependency}
          items={items}
          onOpenChange={(open) => {
            if (!open) setSelectedDependency(null);
          }}
          onSave={updateDependency}
          onDelete={deleteDependency}
        />
      </div>
    </div>
  );
}

function ScheduleStat({ label, value, hint, urgent }: { label: string; value: string; hint: string; urgent?: boolean }) {
  return (
    <Card className={cn(urgent && "border-red-500/25")}>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-2 text-[22px] font-semibold leading-none", urgent && "text-red-600 dark:text-red-300")}>{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ value, onChange, items, placeholder }: { value: string; onChange: (value: string) => void; items: string[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {items.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

type ConnectorSide = "start" | "finish";
type DependencyPath = {
  id: string;
  d: string;
  sourceId: string;
  targetId: string;
  dependencyType: string;
  blocked: boolean;
  complete: boolean;
};

type GanttDrag = {
  item: ScheduleItem;
  mode: "move" | "resize-start" | "resize-end";
  pointerStartX: number;
  originalStart: string;
  originalEnd: string;
  originalDurationDays: number;
  previewStart: string;
  previewEnd: string;
  previewDurationDays: number;
  moved: boolean;
};

function dependencyTypeFromSides(sourceSide: ConnectorSide, targetSide: ConnectorSide) {
  if (sourceSide === "finish" && targetSide === "start") return "finish_to_start";
  if (sourceSide === "start" && targetSide === "start") return "start_to_start";
  if (sourceSide === "finish" && targetSide === "finish") return "finish_to_finish";
  return "start_to_finish";
}

function connectorX(rect: DOMRect, side: ConnectorSide) {
  return side === "finish" ? rect.right : rect.left;
}

function sideFromDependency(type: string, role: "source" | "target"): ConnectorSide {
  if (type === "start_to_start") return "start";
  if (type === "finish_to_finish") return "finish";
  if (type === "start_to_finish") return role === "source" ? "start" : "finish";
  return role === "source" ? "finish" : "start";
}

function GanttTimeline({
  items,
  dependencies,
  onSelect,
  onUpdateItemDates,
  onCreateDependency,
  onSelectDependency,
}: {
  items: ScheduleItem[];
  dependencies: ScheduleDependency[];
  onSelect: (item: ScheduleItem) => void;
  onUpdateItemDates: (item: ScheduleItem, updates: { start_date: string | null; end_date: string | null; due_date: string | null; estimated_duration_days?: number | null }) => Promise<void>;
  onCreateDependency: (input: {
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days?: number;
    required_completion_date: string | null;
    notes?: string;
    auto_shift_schedule: boolean;
  }) => Promise<void>;
  onSelectDependency: (dependency: ScheduleDependency) => void;
}) {
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [paths, setPaths] = useState<DependencyPath[]>([]);
  const [draftSource, setDraftSource] = useState<{ itemId: string; side: ConnectorSide } | null>(null);
  const [dragState, setDragState] = useState<GanttDrag | null>(null);
  const suppressNextSelectRef = useRef(false);
  const [linkMessage, setLinkMessage] = useState("");
  const datedItems = items.filter((item) => item.start_date || item.due_date || item.end_date);
  const today = dateOnly(new Date());
  const dates = datedItems.flatMap((item) => [item.start_date, item.due_date, item.end_date]).filter(Boolean) as string[];
  const minDate = dates.length ? dates.reduce((min, value) => value < min ? value : min, dates[0]) : today;
  const maxDate = dates.length ? dates.reduce((max, value) => value > max ? value : max, dates[0]) : dateOnly(addDays(new Date(), 14));
  const timelineStart = dateOnly(addDays(new Date(`${minDate}T12:00:00`), -2));
  const timelineEnd = dateOnly(addDays(new Date(`${maxDate}T12:00:00`), 4));
  const totalDays = Math.max(7, daysBetween(timelineStart, timelineEnd) + 1);
  const ticks = Array.from({ length: Math.min(totalDays, 45) }, (_, index) => dateOnly(addDays(new Date(`${timelineStart}T12:00:00`), index)));

  const recalculatePaths = useCallback(() => {
    const overlay = overlayRef.current;
    const timeline = timelineRef.current;
    if (!overlay || !timeline) return;

    const overlayRect = overlay.getBoundingClientRect();
    const nextPaths = dependencies.flatMap((dependency) => {
      const source = dependency.parent_item_id;
      const target = dependency.dependent_item_id;
      const sourceEl = timeline.querySelector<HTMLElement>(`[data-gantt-id="${source}"]`);
      const targetEl = timeline.querySelector<HTMLElement>(`[data-gantt-id="${target}"]`);
      if (!sourceEl || !targetEl) return [];

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const sourceSide = sideFromDependency(dependency.dependency_type, "source");
      const targetSide = sideFromDependency(dependency.dependency_type, "target");
      const x1 = connectorX(sourceRect, sourceSide) - overlayRect.left;
      const y1 = sourceRect.top + sourceRect.height / 2 - overlayRect.top;
      const x2 = connectorX(targetRect, targetSide) - overlayRect.left;
      const y2 = targetRect.top + targetRect.height / 2 - overlayRect.top;
      const elbow = Math.max(18, Math.abs(x2 - x1) / 2);
      const c1 = sourceSide === "finish" ? x1 + elbow : x1 - elbow;
      const c2 = targetSide === "start" ? x2 - elbow : x2 + elbow;
      const d = `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`;
      const sourceItem = items.find((item) => item.id === source);
      const targetItem = items.find((item) => item.id === target);
      return [{
        id: dependency.id,
        d,
        sourceId: source,
        targetId: target,
        dependencyType: dependency.dependency_type,
        blocked: Boolean(sourceItem?.is_blocked || targetItem?.is_blocked || targetItem?.status === "blocked"),
        complete: Boolean(sourceItem?.status === "completed" && targetItem?.status === "completed"),
      }];
    });
    setPaths(nextPaths);
  }, [dependencies, items]);

  useEffect(() => {
    const timeout = window.setTimeout(recalculatePaths, 0);
    const timeline = timelineRef.current;
    const resizeObserver = new ResizeObserver(recalculatePaths);
    if (timeline) resizeObserver.observe(timeline);
    window.addEventListener("resize", recalculatePaths);
    return () => {
      window.clearTimeout(timeout);
      resizeObserver.disconnect();
      window.removeEventListener("resize", recalculatePaths);
    };
  }, [recalculatePaths]);

  const dayWidth = useCallback(() => {
    const grid = timelineRef.current?.querySelector<HTMLElement>("[data-timeline-grid]");
    if (!grid) return 32;
    return Math.max(16, grid.getBoundingClientRect().width / ticks.length);
  }, [ticks.length]);

  const startDrag = useCallback((event: PointerEvent<HTMLElement>, item: ScheduleItem, mode: GanttDrag["mode"]) => {
    const start = item.start_date || item.due_date || item.end_date || timelineStart;
    const end = item.end_date || item.due_date || start;
    const originalDurationDays = durationDays(item, start, end);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragState({
      item,
      mode,
      pointerStartX: event.clientX,
      originalStart: start,
      originalEnd: end,
      originalDurationDays,
      previewStart: start,
      previewEnd: end,
      previewDurationDays: originalDurationDays,
      moved: false,
    });
    setLinkMessage(mode === "move" ? "Dragging schedule item. Release to save date changes." : "Resizing schedule item. Release to save duration.");
  }, [timelineStart]);

  useEffect(() => {
    if (!dragState) return;
    const activeDrag = dragState;

    function handleMove(event: globalThis.PointerEvent) {
      const rawDeltaDays = (event.clientX - activeDrag.pointerStartX) / dayWidth();
      const moved = Math.abs(event.clientX - activeDrag.pointerStartX) > 4;
      const deltaDays = Math.round(rawDeltaDays);
      const fractionalDelta = Math.round(rawDeltaDays * 8) / 8;
      let previewStart = activeDrag.originalStart;
      let previewEnd = activeDrag.originalEnd;
      let previewDurationDays = activeDrag.originalDurationDays;
      if (activeDrag.mode === "move") {
        previewStart = dateOnly(addDays(new Date(`${activeDrag.originalStart}T12:00:00`), deltaDays));
        previewEnd = dateOnly(addDays(new Date(`${activeDrag.originalEnd}T12:00:00`), deltaDays));
      } else if (activeDrag.mode === "resize-start") {
        const proposedStart = dateOnly(addDays(new Date(`${activeDrag.originalStart}T12:00:00`), deltaDays));
        previewStart = proposedStart <= activeDrag.originalEnd ? proposedStart : activeDrag.originalEnd;
        previewDurationDays = Math.max(0.125, activeDrag.originalDurationDays - fractionalDelta);
      } else {
        const proposedEnd = dateOnly(addDays(new Date(`${activeDrag.originalEnd}T12:00:00`), deltaDays));
        previewEnd = proposedEnd >= activeDrag.originalStart ? proposedEnd : activeDrag.originalStart;
        previewDurationDays = Math.max(0.125, activeDrag.originalDurationDays + fractionalDelta);
      }
      setDragState((current) => current ? { ...current, previewStart, previewEnd, previewDurationDays, moved: current.moved || moved } : current);
      window.requestAnimationFrame(recalculatePaths);
    }

    async function handleUp() {
      const current = activeDrag;
      setDragState(null);
      if (!current.moved) {
        suppressNextSelectRef.current = false;
        onSelect(current.item);
        setLinkMessage("");
        return;
      }
      if (current.previewStart === current.originalStart && current.previewEnd === current.originalEnd && current.previewDurationDays === current.originalDurationDays) {
        setLinkMessage("");
        suppressNextSelectRef.current = false;
        return;
      }
      try {
        await onUpdateItemDates(current.item, {
          start_date: current.previewStart,
          end_date: current.previewEnd,
          due_date: current.previewEnd,
          estimated_duration_days: current.previewDurationDays,
        });
        setLinkMessage(`Updated ${current.item.title}: ${formatDate(current.previewStart)} - ${formatDate(current.previewEnd)} (${current.previewDurationDays}d).`);
      } catch (error) {
        setLinkMessage(error instanceof Error ? error.message : "Could not update schedule dates.");
      }
      window.setTimeout(() => {
        suppressNextSelectRef.current = false;
      }, 80);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dayWidth, dragState, onUpdateItemDates, recalculatePaths]);

  async function completeConnection(targetItemId: string, targetSide: ConnectorSide) {
    if (!draftSource) return;
    if (draftSource.itemId === targetItemId) {
      setLinkMessage("A schedule item cannot depend on itself.");
      setDraftSource(null);
      return;
    }
    const dependencyType = dependencyTypeFromSides(draftSource.side, targetSide);
    const duplicate = dependencies.some((dependency) => dependency.parent_item_id === draftSource.itemId && dependency.dependent_item_id === targetItemId && dependency.dependency_type === dependencyType);
    if (duplicate) {
      setLinkMessage("That dependency already exists.");
      setDraftSource(null);
      return;
    }
    try {
      await onCreateDependency({
        parent_item_id: draftSource.itemId,
        dependent_item_id: targetItemId,
        dependency_type: dependencyType,
        lag_days: 0,
        required_completion_date: null,
        notes: "",
        auto_shift_schedule: true,
      });
      setLinkMessage(`Dependency created: ${human(dependencyType)}.`);
    } catch (error) {
      setLinkMessage(error instanceof Error ? error.message : "Could not create dependency.");
    } finally {
      setDraftSource(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Gantt timeline</CardTitle>
        <CardDescription>First-pass schedule grid for phases, tasks, milestones, blockers, proof approvals, production, delivery, and install.</CardDescription>
      </CardHeader>
      <CardContent>
        {!items.length ? (
          <EmptyState title="No schedule items yet" description="Add a phase, task, milestone, proof, production step, or delivery item to start building the timeline." />
        ) : (
          <div ref={timelineRef} className="overflow-x-auto" onScroll={recalculatePaths}>
            <div className="relative min-w-[860px]">
              <svg ref={overlayRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible">
                {paths.map((path) => {
                  const dependency = dependencies.find((item) => item.id === path.id);
                  return (
                    <g key={path.id}>
                      <path
                        d={path.d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="14"
                        className="pointer-events-auto cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (dependency) onSelectDependency(dependency);
                        }}
                      />
                      <path
                        d={path.d}
                        fill="none"
                        stroke={path.blocked ? "rgb(239 68 68)" : path.complete ? "rgb(16 185 129)" : "rgb(132 204 22)"}
                        strokeDasharray={path.dependencyType.includes("start_to") ? "5 4" : undefined}
                        strokeLinecap="round"
                        strokeWidth="2"
                        className="pointer-events-none drop-shadow-sm"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="grid grid-cols-[260px_minmax(600px,1fr)] border-b pb-2 text-[11px] font-medium text-muted-foreground">
                <div>Item</div>
                <div data-timeline-grid className="grid" style={{ gridTemplateColumns: `repeat(${ticks.length}, minmax(24px, 1fr))` }}>
                  {ticks.map((tick) => <div key={tick} className={cn("border-l pl-1", tick === today && "text-primary")}>{new Date(`${tick}T12:00:00`).getDate()}</div>)}
                </div>
              </div>
              <div className="divide-y">
                {items.map((item) => {
                  const preview = dragState?.item.id === item.id ? dragState : null;
                  const start = preview?.previewStart || item.start_date || item.due_date || item.end_date || timelineStart;
                  const end = preview?.previewEnd || item.end_date || item.due_date || start;
                  const offset = Math.min(ticks.length - 1, Math.max(0, daysBetween(timelineStart, start)));
                  const displayDuration = preview?.previewDurationDays ?? durationDays(item, start, end);
                  const span = Math.max(0.125, Math.min(ticks.length - offset, displayDuration));
                  const blocked = item.is_blocked || item.status === "blocked";
                  const hasDependency = dependencies.some((dependency) => dependency.parent_item_id === item.id || dependency.dependent_item_id === item.id);
                  return (
                    <button
                      key={item.id}
                      className={cn("grid w-full grid-cols-[260px_minmax(600px,1fr)] py-2 text-left hover:bg-accent/30", draftSource?.itemId === item.id && "bg-primary/10", preview && "bg-primary/15")}
                      onClick={() => {
                        if (suppressNextSelectRef.current) return;
                        onSelect(item);
                      }}
                    >
                      <div className="pr-3">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span>{itemTypeLabel(item)}</span>
                          {hasDependency && <Link2 className="h-3 w-3" />}
                          {blocked && <Flag className="h-3 w-3 text-red-500" />}
                          {item.customer_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </div>
                      </div>
                      <div className="relative grid min-h-9" style={{ gridTemplateColumns: `repeat(${ticks.length}, minmax(24px, 1fr))` }}>
                        {ticks.map((tick) => <div key={tick} className={cn("border-l", tick === today && "bg-primary/10")} />)}
                        <div
                          data-gantt-id={item.id}
                          className={cn("absolute top-1 h-7 cursor-grab rounded-md border px-2 text-[11px] font-medium leading-7 shadow-sm active:cursor-grabbing", blocked ? "border-red-500/35 bg-red-500/20 text-red-700 dark:text-red-200" : "border-primary/20 bg-primary/25 text-lime-900 dark:text-lime-100", preview && "ring-2 ring-primary/60")}
                          style={{ left: `${(offset / ticks.length) * 100}%`, width: `${(span / ticks.length) * 100}%` }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            startDrag(event, item, "move");
                          }}
                        >
                          <span
                            className="absolute inset-y-0 left-1 z-20 w-2 cursor-ew-resize rounded-l-md bg-background/20 hover:bg-primary/40"
                            title="Drag to adjust start date"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              startDrag(event, item, "resize-start");
                            }}
                          />
                          <ConnectorHandle
                            side="start"
                            active={draftSource?.itemId === item.id && draftSource.side === "start"}
                            onStart={(event) => {
                              event.stopPropagation();
                              setDraftSource({ itemId: item.id, side: "start" });
                              setLinkMessage("Drag to another task handle to create a dependency.");
                            }}
                            onEnd={(event) => {
                              event.stopPropagation();
                              completeConnection(item.id, "start");
                            }}
                          />
                          <span className="block truncate">{item.progress_percent ?? 0}% {human(item.status)} {displayDuration < 1 ? `• ${displayDuration}d` : ""}</span>
                          <span
                            className="absolute inset-y-0 right-1 z-20 w-2 cursor-ew-resize rounded-r-md bg-background/20 hover:bg-primary/40"
                            title="Drag to adjust end date"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              startDrag(event, item, "resize-end");
                            }}
                          />
                          <ConnectorHandle
                            side="finish"
                            active={draftSource?.itemId === item.id && draftSource.side === "finish"}
                            onStart={(event) => {
                              event.stopPropagation();
                              setDraftSource({ itemId: item.id, side: "finish" });
                              setLinkMessage("Drag to another task handle to create a dependency.");
                            }}
                            onEnd={(event) => {
                              event.stopPropagation();
                              completeConnection(item.id, "finish");
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {linkMessage && <div className="mt-3 rounded-lg border bg-background/80 px-3 py-2 text-xs text-muted-foreground">{linkMessage}</div>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectorHandle({
  side,
  active,
  onStart,
  onEnd,
}: {
  side: ConnectorSide;
  active: boolean;
  onStart: (event: PointerEvent<HTMLSpanElement>) => void;
  onEnd: (event: PointerEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${side} dependency connector`}
      title={`${side === "start" ? "Start" : "Finish"} connector`}
      onPointerDown={onStart}
      onPointerUp={onEnd}
      className={cn(
        "absolute top-1/2 z-30 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-md ring-2 ring-primary/25",
        side === "start" ? "-left-2.5" : "-right-2.5",
        active && "scale-125 bg-red-500 ring-red-500/30",
      )}
    />
  );
}

function ScheduleTable({
  items,
  orders,
  users,
  products,
  onSelect,
  onDelete,
}: {
  items: ScheduleItem[];
  orders: Order[];
  users: AdminUser[];
  products: Product[];
  onSelect: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Schedule items</CardTitle>
        <CardDescription>List view for phases, tasks, milestones, approvals, install, delivery, and blocked work.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Item</TableHead>
              <TableHead>Order / customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const order = orders.find((row) => row.id === item.order_id);
              const customer = users.find((row) => row.id === item.customer_id);
              const assignee = users.find((row) => row.id === item.assigned_to_user_id);
              const product = products.find((row) => row.id === item.product_id);
              return (
                <TableRow key={item.id} className="cursor-pointer hover:bg-accent/45" onClick={() => onSelect(item)}>
                  <TableCell className="pl-4">
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                      <span>{itemTypeLabel(item)}</span>
                      <span>•</span>
                      <span>{item.phase || "No phase"}</span>
                      {item.customer_visible && <span>• Customer visible</span>}
                      {item.is_blocked && <span className="text-red-600 dark:text-red-300">• Blocked</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">#{order?.order_number || item.orders?.order_number || item.order_id?.slice(0, 8) || "Unlinked"}</div>
                    <div className="text-xs text-muted-foreground">{customer?.full_name || customer?.email || order?.company || order?.customer_email || "No customer"}</div>
                  </TableCell>
                  <TableCell>{product?.name || item.products?.name || item.order_items?.products?.name || "Not linked"}</TableCell>
                  <TableCell><Badge className={cn("border", statusTone(item.status))}>{human(item.status)}</Badge></TableCell>
                  <TableCell><Badge className={cn("border", priorityTone(item.priority))}>{human(item.priority)}</Badge></TableCell>
                  <TableCell>{assignee?.full_name || assignee?.email || item.assignee?.full_name || "Unassigned"}</TableCell>
                  <TableCell>{formatDate(item.due_date || item.end_date)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete schedule item"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(item);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!items.length && <TableRow><TableCell colSpan={8} className="p-6"><EmptyState title="No matching schedule items" description="Adjust filters or add a schedule item to connect orders, products, artwork, production, and fulfillment." /></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DependencyPanel({
  items,
  dependencies,
  onCreate,
  onDelete,
}: {
  items: ScheduleItem[];
  dependencies: ScheduleDependency[];
  onCreate: (input: {
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days?: number;
    required_completion_date: string | null;
    delay_impact_notes?: string;
    notes?: string;
    auto_shift_schedule: boolean;
  }) => Promise<void>;
  onDelete: (dependency: ScheduleDependency) => Promise<void>;
}) {
  const [parentItemId, setParentItemId] = useState("none");
  const [dependentItemId, setDependentItemId] = useState("none");
  const [dependencyType, setDependencyType] = useState("finish_to_start");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (parentItemId === "none" || dependentItemId === "none") return;
    setSaving(true);
    try {
      await onCreate({
        parent_item_id: parentItemId,
        dependent_item_id: dependentItemId,
        dependency_type: dependencyType,
        lag_days: 0,
        required_completion_date: requiredDate || null,
        delay_impact_notes: notes,
        notes,
        auto_shift_schedule: true,
      });
      setParentItemId("none");
      setDependentItemId("none");
      setNotes("");
      setRequiredDate("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dependencies</CardTitle>
          <CardDescription>Connect work that must happen before another task can start.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldSelect label="Must finish first" value={parentItemId} onChange={setParentItemId} items={items.map((item) => ({ value: item.id, label: item.title }))} placeholder="Select item" />
          <FieldSelect label="Dependent item" value={dependentItemId} onChange={setDependentItemId} items={items.filter((item) => item.id !== parentItemId).map((item) => ({ value: item.id, label: item.title }))} placeholder="Select item" />
          <FieldSelect label="Dependency type" value={dependencyType} onChange={setDependencyType} items={["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"].map((item) => ({ value: item, label: human(item) }))} />
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Lag days</div>
            <Input value="0" readOnly />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Required completion date</div>
            <Input type="date" value={requiredDate} onChange={(event) => setRequiredDate(event.target.value)} />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Delay impact notes</div>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Proof approval must be complete before print production can start." />
          </div>
          <Button className="w-full" onClick={save} disabled={saving || parentItemId === "none" || dependentItemId === "none" || parentItemId === dependentItemId}>
            <Link2 className="h-4 w-4" /> {saving ? "Saving..." : "Add dependency"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active links</CardTitle>
          <CardDescription>{dependencies.length} dependency relationships</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {dependencies.map((dependency) => {
            const parent = items.find((item) => item.id === dependency.parent_item_id);
            const dependent = items.find((item) => item.id === dependency.dependent_item_id);
            return (
              <div key={dependency.id} className="rounded-lg border bg-secondary/20 p-3">
                <div className="text-sm font-medium">{parent?.title || dependency.parent?.title || "Parent item"}</div>
                <div className="my-1 text-[11px] uppercase tracking-wide text-muted-foreground">{human(dependency.dependency_type)} {dependency.lag_days ? `+ ${dependency.lag_days}d` : ""}</div>
                <div className="text-sm text-muted-foreground">{dependent?.title || dependency.dependent?.title || "Dependent item"}</div>
                {(dependency.notes || dependency.delay_impact_notes) && <div className="mt-2 text-xs text-muted-foreground">{dependency.notes || dependency.delay_impact_notes}</div>}
                <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-red-600 dark:text-red-300" onClick={() => onDelete(dependency)}>Remove</Button>
              </div>
            );
          })}
          {!dependencies.length && <EmptyState title="No dependencies yet" description="Add a dependency to show handoffs and blockers across proofing, production, QC, shipping, and install." />}
        </CardContent>
      </Card>
    </div>
  );
}

function DependencyInspector({
  dependency,
  items,
  onOpenChange,
  onSave,
  onDelete,
}: {
  dependency: ScheduleDependency | null;
  items: ScheduleItem[];
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    id: string;
    parent_item_id: string;
    dependent_item_id: string;
    dependency_type: string;
    lag_days: number;
    required_completion_date: string | null;
    notes: string;
    auto_shift_schedule: boolean;
  }) => Promise<void>;
  onDelete: (dependency: ScheduleDependency) => Promise<void>;
}) {
  const [dependencyType, setDependencyType] = useState("finish_to_start");
  const [lagDays, setLagDays] = useState("0");
  const [requiredDate, setRequiredDate] = useState("");
  const [autoShift, setAutoShift] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!dependency) return;
    setDependencyType(dependency.dependency_type || "finish_to_start");
    setLagDays(String(dependency.lag_days ?? 0));
    setRequiredDate(dateInput(dependency.required_completion_date));
    setAutoShift(dependency.auto_shift_schedule !== false);
    setNotes(dependency.notes || dependency.delay_impact_notes || "");
    setMessage("");
  }, [dependency]);

  if (!dependency) return null;

  const source = items.find((item) => item.id === dependency.parent_item_id);
  const target = items.find((item) => item.id === dependency.dependent_item_id);

  async function save() {
    const current = dependency;
    if (!current) return;
    setSaving(true);
    setMessage("Saving dependency...");
    try {
      await onSave({
        id: current.id,
        parent_item_id: current.parent_item_id,
        dependent_item_id: current.dependent_item_id,
        dependency_type: dependencyType,
        lag_days: Number(lagDays || 0),
        required_completion_date: requiredDate || null,
        notes,
        auto_shift_schedule: autoShift,
      });
      setMessage("Dependency updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update dependency.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(dependency)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>Dependency inspector</SheetTitle>
          <SheetDescription>Dependencies are editable records that connect a source schedule item to a target schedule item.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <LinkedMeta label="Source item" value={source?.title || dependency.parent?.title || "Source item"} subvalue={source ? `${itemTypeLabel(source)} - ${human(source.status)}` : undefined} />
            <LinkedMeta label="Target item" value={target?.title || dependency.dependent?.title || "Target item"} subvalue={target ? `${itemTypeLabel(target)} - ${human(target.status)}` : undefined} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Dependency type" value={dependencyType} onChange={setDependencyType} items={["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"].map((item) => ({ value: item, label: human(item) }))} />
            <TextField label="Lag days" value={lagDays} onChange={setLagDays} inputMode="numeric" />
            <DateField label="Required completion" value={requiredDate} onChange={setRequiredDate} />
          </div>

          <ToggleRow label="Auto-shift schedule" description="Future schedule automation can move dependent target items when the source item moves." checked={autoShift} onChange={setAutoShift} />

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Notes</div>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Dependency notes, delay impact, production risk, or handoff details." />
          </div>

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save dependency"}</Button>
            <Button variant="outline" className="text-red-600 dark:text-red-300" onClick={() => onDelete(dependency)}><Trash2 className="h-4 w-4" /> Delete dependency</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ScheduleItemSheet({
  open,
  onOpenChange,
  item,
  data,
  staff,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ScheduleItem | null;
  data: AdminDashboardData | null;
  staff: AdminUser[];
  onSave: (input: SchedulePayload) => Promise<void>;
  onDelete?: () => void;
}) {
  const orders = data?.orders ?? [];
  const users = data?.users ?? [];
  const products = data?.products ?? [];
  const orderItems = data?.orderItems ?? [];
  const productionJobs = data?.productionJobs ?? [];
  const [form, setForm] = useState<SchedulePayload>(() => emptyPayload());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(payloadFromItem(item));
    setMessage("");
  }, [item, open]);

  const selectedOrder = orders.find((order) => order.id === form.order_id);
  const selectedItems = orderItems.filter((row) => row.order_id === form.order_id);
  const selectedProduct = products.find((product) => product.id === form.product_id);

  useEffect(() => {
    if (!open || item) return;
    if (selectedOrder?.user_id && !form.customer_id) update("customer_id", selectedOrder.user_id);
  }, [form.customer_id, item, open, selectedOrder?.user_id]);

  function update<Key extends keyof SchedulePayload>(key: Key, value: SchedulePayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateOrder(orderId: string) {
    const order = orders.find((row) => row.id === orderId);
    update("order_id", orderId === "none" ? null : orderId);
    setForm((current) => ({
      ...current,
      order_id: orderId === "none" ? null : orderId,
      order_item_id: null,
      customer_id: order?.user_id || current.customer_id,
      due_date: current.due_date || dateInput(order?.due_at),
    }));
  }

  function updateOrderItem(orderItemId: string) {
    const orderItem = orderItems.find((row) => row.id === orderItemId);
    setForm((current) => ({
      ...current,
      order_item_id: orderItemId === "none" ? null : orderItemId,
      product_id: orderItem?.products?.id || current.product_id,
    }));
  }

  async function save() {
    if (!form.title.trim()) {
      setMessage("Add a title before saving this schedule item.");
      return;
    }
    setSaving(true);
    setMessage(item ? "Updating schedule item..." : "Creating schedule item...");
    try {
      await onSave(form);
      setMessage(item ? "Schedule item updated." : "Schedule item created.");
      if (!item) onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save schedule item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>{item ? "Edit schedule item" : "Add schedule item"}</SheetTitle>
          <SheetDescription>Connect the schedule to a customer, order, product, production job, owner, dates, blockers, and customer visibility.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Title" value={form.title} onChange={(value) => update("title", value)} placeholder="Proof approval for vinyl banner" />
            <FieldSelect label="Type" value={form.item_type} onChange={(value) => update("item_type", value)} items={itemTypes.map((value) => ({ value, label: human(value) }))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldSelect label="Order" value={form.order_id || "none"} onChange={updateOrder} items={orders.map((order) => ({ value: order.id, label: `#${order.order_number || order.id.slice(0, 8)} - ${order.users?.full_name || order.company || order.customer_email || "Customer"}` }))} placeholder="No order" />
            <FieldSelect label="Order item" value={form.order_item_id || "none"} onChange={updateOrderItem} items={selectedItems.map((line) => ({ value: line.id, label: `${line.products?.name || "Product"} - Qty ${line.quantity || 1}` }))} placeholder="No line item" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldSelect label="Customer / user" value={form.customer_id || "none"} onChange={(value) => update("customer_id", value === "none" ? null : value)} items={users.map((user) => ({ value: user.id, label: `${user.full_name || user.email || "User"} - ${human(user.role)}` }))} placeholder="No customer" />
            <FieldSelect label="Product" value={form.product_id || "none"} onChange={(value) => update("product_id", value === "none" ? null : value)} items={products.map((product) => ({ value: product.id, label: `${product.name} - ${product.category}` }))} placeholder="No product" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Status" value={form.status} onChange={(value) => update("status", value)} items={statuses.map((value) => ({ value, label: human(value) }))} />
            <FieldSelect label="Priority" value={form.priority} onChange={(value) => update("priority", value)} items={priorities.map((value) => ({ value, label: human(value) }))} />
            <FieldSelect label="Phase" value={form.phase || "none"} onChange={(value) => update("phase", value === "none" ? "" : value)} items={phases.map((value) => ({ value, label: value }))} placeholder="No phase" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Assigned to" value={form.assigned_to_user_id || "none"} onChange={(value) => update("assigned_to_user_id", value === "none" ? null : value)} items={staff.map((user) => ({ value: user.id, label: `${user.full_name || user.email || "User"} - ${human(user.role)}` }))} placeholder="Unassigned" />
            <FieldSelect label="Department" value={form.assigned_department || "none"} onChange={(value) => update("assigned_department", value === "none" ? "" : value)} items={departments.map((value) => ({ value, label: value }))} placeholder="No department" />
            <FieldSelect label="Production job" value={form.production_job_id || "none"} onChange={(value) => update("production_job_id", value === "none" ? null : value)} items={productionJobs.map((job) => ({ value: job.id, label: `${job.station || "Job"} - ${human(job.status)}` }))} placeholder="No production job" />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <DateField label="Start date" value={form.start_date || ""} onChange={(value) => update("start_date", value || null)} />
            <DateField label="End date" value={form.end_date || ""} onChange={(value) => update("end_date", value || null)} />
            <DateField label="Due date" value={form.due_date || ""} onChange={(value) => update("due_date", value || null)} />
            <TextField label="Progress %" value={String(form.progress_percent)} onChange={(value) => update("progress_percent", Number(value || 0))} inputMode="numeric" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Estimated duration days"
              value={String(form.estimated_duration_days ?? "")}
              onChange={(value) => update("estimated_duration_days", value === "" ? null : Number(value))}
              placeholder="0.125 for 1 hour, 0.5 for half day"
              inputMode="decimal"
            />
            <LinkedMeta label="Duration examples" value="0.125 = 1 hour, 0.25 = 2 hours, 0.5 = half day" subvalue="Timeline bars remain day-positioned in this pass; duration data can now be fractional." />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Customer visible" description="Show this item later in customer-facing schedule views." checked={form.customer_visible} onChange={(checked) => {
              update("customer_visible", checked);
              update("internal_only", !checked);
            }} />
            <ToggleRow label="Blocked" description="Flag work that is blocked by customer action, proofing, material, vendor, payment, or production issues." checked={form.is_blocked} onChange={(checked) => {
              update("is_blocked", checked);
              if (checked && form.status !== "blocked") update("status", "blocked");
            }} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Blocker type" value={form.blocker_type} onChange={(value) => update("blocker_type", value)} placeholder="Missing artwork, proof not approved, material delay..." />
            <TextField label="Blocker reason" value={form.blocker_reason} onChange={(value) => update("blocker_reason", value)} placeholder="What is stopping this from moving forward?" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Artwork status" value={form.artwork_review_status} onChange={(value) => update("artwork_review_status", value)} placeholder="file_check, approved, revisions..." />
            <TextField label="Proof status" value={form.proof_status} onChange={(value) => update("proof_status", value)} placeholder="sent, viewed, approved..." />
            <TextField label="Production status" value={form.production_status} onChange={(value) => update("production_status", value)} placeholder="print_ready, finishing..." />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Description</div>
            <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What needs to happen for this schedule item?" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Internal notes</div>
              <Textarea value={form.internal_notes} onChange={(event) => update("internal_notes", event.target.value)} placeholder="Internal production notes, assignment context, blocker details..." />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Customer notes</div>
              <Textarea value={form.customer_notes} onChange={(event) => update("customer_notes", event.target.value)} placeholder="Safe-to-share customer-facing schedule note." />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LinkedMeta label="Order" value={selectedOrder?.order_number ? `#${selectedOrder.order_number}` : "Not linked"} subvalue={selectedOrder?.customer_email || selectedOrder?.customer_phone || undefined} />
            <LinkedMeta label="Product" value={selectedProduct?.name || "Not linked"} subvalue={selectedProduct?.category || undefined} />
            <LinkedMeta label="Visibility" value={form.customer_visible ? "Customer visible" : "Internal only"} subvalue={form.is_blocked ? "Blocked item" : "Open schedule item"} />
          </div>

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : item ? "Save schedule item" : "Create schedule item"}</Button>
            {onDelete && <Button variant="outline" className="text-red-600 dark:text-red-300" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function emptyPayload(): SchedulePayload {
  return {
    order_id: null,
    order_item_id: null,
    production_job_id: null,
    product_id: null,
    customer_id: null,
    parent_item_id: null,
    title: "",
    description: "",
    item_type: "task",
    phase: "Artwork / Design",
    status: "not_started",
    priority: "normal",
    assigned_to_user_id: null,
    assigned_department: "Design",
    start_date: dateOnly(new Date()),
    end_date: dateOnly(addDays(new Date(), 2)),
    due_date: dateOnly(addDays(new Date(), 2)),
    estimated_duration_days: 2,
    progress_percent: 0,
    customer_visible: false,
    internal_only: true,
    is_blocked: false,
    blocker_type: "",
    blocker_reason: "",
    artwork_review_status: "",
    proof_status: "",
    production_status: "",
    sort_order: 100,
    internal_notes: "",
    customer_notes: "",
  };
}

function payloadFromItem(item?: ScheduleItem | null): SchedulePayload {
  if (!item) return emptyPayload();
  return {
    id: item.id,
    order_id: item.order_id,
    order_item_id: item.order_item_id,
    production_job_id: item.production_job_id,
    product_id: item.product_id,
    customer_id: item.customer_id,
    parent_item_id: item.parent_item_id,
    title: item.title,
    description: item.description || "",
    item_type: item.item_type,
    phase: item.phase || "",
    status: item.status,
    priority: item.priority,
    assigned_to_user_id: item.assigned_to_user_id,
    assigned_department: item.assigned_department || "",
    start_date: dateInput(item.start_date) || null,
    end_date: dateInput(item.end_date) || null,
    due_date: dateInput(item.due_date) || null,
    estimated_duration_days: Number(item.estimated_duration_days || 0),
    progress_percent: Number(item.progress_percent || 0),
    customer_visible: item.customer_visible,
    internal_only: item.internal_only,
    is_blocked: item.is_blocked,
    blocker_type: item.blocker_type || "",
    blocker_reason: item.blocker_reason || "",
    artwork_review_status: item.artwork_review_status || "",
    proof_status: item.proof_status || "",
    production_status: item.production_status || "",
    sort_order: Number(item.sort_order || 100),
    internal_notes: item.internal_notes || "",
    customer_notes: item.customer_notes || "",
  };
}

function FieldSelect({
  label,
  value,
  onChange,
  items,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {placeholder && <SelectItem value="none">{placeholder}</SelectItem>}
          {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: "numeric" | "decimal" | "text" }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(visibleMonth);
  const firstDay = visibleMonth.getDay();
  const gridStart = addDays(visibleMonth, -firstDay);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const today = dateOnly(new Date());

  function choose(day: Date) {
    onChange(dateOnly(day));
    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm ring-offset-background transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value ? new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(selected) : "Select date"}</span>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-[4.4rem] z-[70] w-[320px] rounded-lg border bg-card p-3 text-card-foreground shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold">{monthLabel}</div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <div key={day} className="py-1">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = dateOnly(day);
              const selectedDay = value === key;
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  className={cn(
                    "grid h-9 place-items-center rounded-md text-sm transition-colors hover:bg-primary hover:text-primary-foreground",
                    !inMonth && "text-muted-foreground/55",
                    key === today && "border border-primary/50",
                    selectedDay && "bg-primary font-semibold text-primary-foreground shadow-sm",
                  )}
                  onClick={() => choose(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <Button variant="ghost" size="sm" onClick={() => { onChange(""); setOpen(false); }}>Clear</Button>
            <Button variant="outline" size="sm" onClick={() => choose(new Date())}>Today</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-secondary/20 p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function LinkedMeta({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="rounded-lg border bg-secondary/25 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
      {subvalue && <div className="mt-1 break-words text-xs text-muted-foreground">{subvalue}</div>}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-center">
      <div className="font-medium">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</div>
    </div>
  );
}
