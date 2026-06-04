"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarRange, ChevronRight, Moon, Plus, Search, Sun } from "lucide-react";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import { createProductionJob, getCurrentAdminProfile, loadAdminDashboardData, updateProductionJob } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, ProductionJob } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const productionStatuses = ["new", "file_check", "design_needed", "proof_pending", "proof_approved", "print_ready", "printing", "finishing", "install_scheduled", "ready", "completed", "on_hold"];
const stations = ["Prepress", "Design", "Print", "Finishing", "Install", "QC", "Shipping"];
const staffRoles = new Set(["super_admin", "admin", "employee", "staff", "production_manager", "designer", "installer", "customer_support"]);

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function dateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function statusTone(status: string) {
  if (["completed", "ready", "proof_approved"].includes(status)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["file_check", "proof_pending", "print_ready", "printing", "finishing", "install_scheduled"].includes(status)) return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
  if (["design_needed", "on_hold"].includes(status)) return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-border bg-secondary text-secondary-foreground";
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

export function AdminProduction() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);

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

  async function refresh(openJobId?: string) {
    const next = await loadAdminDashboardData();
    setData(next);
    if (openJobId) setSelectedJob(next.productionJobs.find((job) => job.id === openJobId) ?? null);
  }

  const orders = data?.orders ?? [];
  const jobs = data?.productionJobs ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const users = data?.users ?? [];
  const orderItems = data?.orderItems ?? [];
  const staff = users.filter((user) => staffRoles.has(user.role));

  const visibleJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) => {
      const order = orders.find((item) => item.id === job.order_id);
      const item = orderItems.find((line) => line.id === job.order_item_id);
      const assignee = users.find((user) => user.id === job.assigned_staff_id);
      return [
        job.status,
        job.station,
        job.notes,
        order?.order_number,
        order?.customer_email,
        order?.company,
        order?.users?.full_name,
        item?.products?.name,
        item?.products?.category,
        assignee?.full_name,
        assignee?.email,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [jobs, orderItems, orders, query, users]);

  const activeJobs = jobs.filter((job) => !["completed", "ready"].includes(job.status));
  const proofJobs = jobs.filter((job) => job.status === "proof_pending");
  const designJobs = jobs.filter((job) => job.status === "design_needed");
  const printJobs = jobs.filter((job) => ["print_ready", "printing", "finishing"].includes(job.status));
  const holdJobs = jobs.filter((job) => job.status === "on_hold");

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-5 px-2 pt-[5px]">
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
                      className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}
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
              <span className="font-medium text-foreground">Production</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search jobs, orders, products..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/production">Go to login</a></Button></CardContent></Card>
          )}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Production command center</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                    Create jobs from orders, connect products and line items, assign staff, track proofing, print, finishing, install, and shipping handoff.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href="/admin/production-schedule"><CalendarRange className="h-4 w-4" /> Manage Projects</Link>
                  </Button>
                  <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create job</Button>
                </div>
              </div>

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <ProductionStat label="Active jobs" value={String(activeJobs.length)} hint="Not completed or ready" />
                <ProductionStat label="Design queue" value={String(designJobs.length)} hint="Needs design work" />
                <ProductionStat label="Proof pending" value={String(proofJobs.length)} hint="Awaiting proof approval" />
                <ProductionStat label="Print floor" value={String(printJobs.length)} hint="Print, finishing, or ready" />
                <ProductionStat label="On hold" value={String(holdJobs.length)} hint="Blocked jobs" />
              </section>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Live production queue</CardTitle>
                  <CardDescription>Click a job to update status, station, assignee, due date, and notes.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Priority</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Order / customer</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead className="pr-4">Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleJobs.map((job) => {
                        const order = orders.find((item) => item.id === job.order_id);
                        const item = orderItems.find((line) => line.id === job.order_item_id);
                        const assignee = users.find((user) => user.id === job.assigned_staff_id);
                        return (
                          <TableRow key={job.id} className="cursor-pointer hover:bg-accent/45" onClick={() => setSelectedJob(job)}>
                            <TableCell className="pl-4 font-mono text-xs">{job.priority ?? 100}</TableCell>
                            <TableCell>
                              <div className="font-medium">{item?.products?.name || job.order_items?.products?.name || "General production job"}</div>
                              <div className="text-xs text-muted-foreground">{item?.products?.category || job.order_items?.products?.category || "No product line selected"}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-xs">#{order?.order_number || job.orders?.order_number || job.order_id.slice(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">{order?.users?.full_name || order?.company || order?.customer_email || "Customer not linked"}</div>
                            </TableCell>
                            <TableCell>{job.station || "Prepress"}</TableCell>
                            <TableCell><Badge className={cn("border", statusTone(job.status))}>{human(job.status)}</Badge></TableCell>
                            <TableCell>{assignee?.full_name || assignee?.email || "Unassigned"}</TableCell>
                            <TableCell className="pr-4">{formatDate(job.due_at)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {!visibleJobs.length && <TableRow><TableCell colSpan={7} className="p-6 text-center text-muted-foreground">No production jobs found.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </main>

        <ProductionJobSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          data={data}
          staff={staff}
          onSave={async (input) => {
            const job = await createProductionJob(input);
            await refresh(job.id);
          }}
        />
        <ProductionJobSheet
          open={Boolean(selectedJob)}
          onOpenChange={(open) => {
            if (!open) setSelectedJob(null);
          }}
          job={selectedJob}
          data={data}
          staff={staff}
          onSave={async (input) => {
            if (!selectedJob) return;
            const job = await updateProductionJob({ ...input, jobId: selectedJob.id });
            await refresh(job.id);
          }}
        />
      </div>
    </div>
  );
}

function ProductionStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-[22px] font-semibold leading-none">{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function ProductionJobSheet({
  open,
  onOpenChange,
  job,
  data,
  staff,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: ProductionJob | null;
  data: AdminDashboardData | null;
  staff: AdminDashboardData["users"];
  onSave: (input: {
    orderId: string;
    orderItemId?: string;
    status: string;
    priority: number;
    station: string;
    dueAt: string;
    assignedStaffId?: string;
    notes: string;
  }) => Promise<void>;
}) {
  const orders = data?.orders ?? [];
  const orderItems = data?.orderItems ?? [];
  const [orderId, setOrderId] = useState("none");
  const [orderItemId, setOrderItemId] = useState("none");
  const [status, setStatus] = useState("new");
  const [priority, setPriority] = useState("100");
  const [station, setStation] = useState("Prepress");
  const [dueAt, setDueAt] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrderId(job?.order_id || orders[0]?.id || "none");
    setOrderItemId(job?.order_item_id || "none");
    setStatus(job?.status || "new");
    setPriority(String(job?.priority ?? 100));
    setStation(job?.station || "Prepress");
    setDueAt(dateInput(job?.due_at));
    setAssignedStaffId(job?.assigned_staff_id || "none");
    setNotes(job?.notes || "");
    setMessage("");
  }, [job, open, orders]);

  const selectedOrder = orders.find((order) => order.id === orderId);
  const selectedItems = orderItems.filter((item) => item.order_id === orderId);
  const selectedItem = selectedItems.find((item) => item.id === orderItemId);

  async function save() {
    if (orderId === "none") {
      setMessage("Select an order before saving this production job.");
      return;
    }
    setSaving(true);
    setMessage(job ? "Updating production job..." : "Creating production job...");
    try {
      await onSave({
        orderId,
        orderItemId: orderItemId === "none" ? undefined : orderItemId,
        status,
        priority: Number(priority || 100),
        station,
        dueAt,
        assignedStaffId: assignedStaffId === "none" ? undefined : assignedStaffId,
        notes,
      });
      setMessage(job ? "Production job updated." : "Production job created.");
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save production job.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>{job ? "Update production job" : "Create production job"}</SheetTitle>
          <SheetDescription>Connect a production job to an order, product line, customer, assigned staff member, and operational station.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldSelect label="Order" value={orderId} onChange={(value) => { setOrderId(value); setOrderItemId("none"); }} items={orders.map((order) => ({
              value: order.id,
              label: `#${order.order_number || order.id.slice(0, 8)} - ${order.users?.full_name || order.company || order.customer_email || "Customer"}`,
            }))} placeholder="Select order" />
            <FieldSelect label="Product / line item" value={orderItemId} onChange={setOrderItemId} items={selectedItems.map((item) => ({
              value: item.id,
              label: `${item.products?.name || "Product"} - Qty ${item.quantity || 1}`,
            }))} placeholder="General job" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect label="Status" value={status} onChange={setStatus} items={productionStatuses.map((item) => ({ value: item, label: human(item) }))} />
            <FieldSelect label="Station" value={station} onChange={setStation} items={stations.map((item) => ({ value: item, label: item }))} />
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Priority</div>
              <Input value={priority} onChange={(event) => setPriority(event.target.value)} inputMode="numeric" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Due date</div>
              <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
            <FieldSelect label="Assigned staff" value={assignedStaffId} onChange={setAssignedStaffId} items={staff.map((user) => ({
              value: user.id,
              label: `${user.full_name || user.email || user.id.slice(0, 8)} - ${human(user.role)}`,
            }))} placeholder="Unassigned" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LinkedMeta label="Customer" value={selectedOrder?.users?.full_name || selectedOrder?.company || selectedOrder?.customer_email || "Not selected"} subvalue={selectedOrder?.customer_phone || selectedOrder?.customer_email || undefined} />
            <LinkedMeta label="Product" value={selectedItem?.products?.name || "General production job"} subvalue={selectedItem?.products?.category || "No specific product line selected"} />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Production notes</div>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Artwork notes, production requirements, finishing details, install notes..." />
          </div>

          {message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving || orderId === "none"}>{saving ? "Saving..." : job ? "Save production job" : "Create production job"}</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
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

function LinkedMeta({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="rounded-lg border bg-secondary/25 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
      {subvalue && <div className="mt-1 break-words text-xs text-muted-foreground">{subvalue}</div>}
    </div>
  );
}
