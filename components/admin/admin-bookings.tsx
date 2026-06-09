"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  Clock,
  Link2,
  Link2Off,
  Loader2,
  Moon,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import { LogOut } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData } from "@/lib/admin/types";
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

type AppointmentType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_in_advance: number;
  location_type: string;
  meeting_url: string | null;
  color: string;
  is_active: boolean;
};

type Appointment = {
  id: string;
  appointment_type_id: string | null;
  customer_id: string | null;
  assigned_staff_id: string | null;
  related_order_id: string | null;
  related_job_id: string | null;
  title: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  company_name: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  location_type: string;
  customer_notes: string | null;
  internal_notes: string | null;
};

type AvailabilityRule = {
  id: string;
  appointment_type_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_available: boolean;
};

type BlockedTime = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  blocks_public_booking: boolean;
};

type BookingData = {
  appointments: Appointment[];
  appointmentTypes: AppointmentType[];
  availabilityRules: AvailabilityRule[];
  blockedTimes: BlockedTime[];
  notifications: { id: string; appointment_id: string | null; channel: string; status: string; notification_type: string; error_message: string | null; created_at: string }[];
  users: { id: string; full_name: string | null; email: string | null; role: string | null }[];
  orders: { id: string; order_number: string | null; company: string | null }[];
  productionJobs: { id: string; station: string | null; status: string | null }[];
};

const STATUS_OPTIONS = ["pending", "confirmed", "rescheduled", "canceled", "completed", "no_show", "follow_up_needed", "awaiting_payment", "awaiting_deposit", "awaiting_customer_info", "awaiting_approval"];
const LOCATION_OPTIONS = ["phone_call", "video_meeting", "in_person", "onsite_installation", "vehicle_dropoff", "pickup", "delivery", "custom_location"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function human(value: string | null | undefined) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Phoenix", weekday: "short", month: "short", day: "numeric" }).format(new Date(value));
}

function fmtTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function startOfToday() {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${key}T00:00:00-07:00`);
}

function badgeClass(status: string) {
  if (status === "confirmed") return "bg-primary/20 text-foreground";
  if (status === "completed") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200";
  if (status === "canceled" || status === "no_show") return "bg-red-500/15 text-red-700 dark:text-red-200";
  if (status.startsWith("awaiting")) return "bg-amber-500/15 text-amber-700 dark:text-amber-200";
  return "bg-secondary text-secondary-foreground";
}

async function adminFetch(path: string, init?: RequestInit) {
  const db = getSupabaseBrowserClient();
  const session = await db?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Sign in again before managing bookings.");
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Booking request failed.");
  return payload;
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

export function AdminBookings() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [view, setView] = useState<"overview" | "list" | "calendar" | "availability">("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingType, setEditingType] = useState<AppointmentType | null>(null);
  const [typeForm, setTypeForm] = useState({ name: "", slug: "", description: "", duration_minutes: "30", location_type: "phone_call" });
  const [ruleForm, setRuleForm] = useState({ day_of_week: "1", start_time: "09:00", end_time: "17:00", appointment_type_id: "all" });
  const [blockForm, setBlockForm] = useState({ title: "", start_time: "", end_time: "", reason: "" });

  async function load() {
    const currentProfile = await getCurrentAdminProfile();
    if (!currentProfile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setAuthState("denied");
      return;
    }
    setAuthState("allowed");
    setDashboardData(await loadAdminDashboardData());
    setLoading(true);
    try {
      const payload = await adminFetch("/api/admin/bookings");
      setBookingData(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const orders = dashboardData?.orders ?? [];
  const payments = dashboardData?.payments ?? [];
  const messages = dashboardData?.messages ?? [];
  const users = dashboardData?.users ?? [];
  const appointments = bookingData?.appointments ?? [];
  const types = bookingData?.appointmentTypes ?? [];
  const filteredAppointments = appointments.filter((appointment) => statusFilter === "all" || appointment.status === statusFilter);
  const today = startOfToday();
  const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const stats = useMemo(() => {
    const upcoming = appointments.filter((appointment) => new Date(appointment.start_time) >= new Date() && appointment.status !== "canceled");
    return [
      { label: "Today", value: String(appointments.filter((appointment) => dateKey(appointment.start_time) === dateKey(today.toISOString())).length), hint: "Phoenix calendar day" },
      { label: "Upcoming", value: String(upcoming.length), hint: "Not canceled" },
      { label: "Pending", value: String(appointments.filter((appointment) => appointment.status === "pending").length), hint: "Needs review" },
      { label: "Confirmed", value: String(appointments.filter((appointment) => appointment.status === "confirmed").length), hint: "Ready to attend" },
      { label: "Blocked", value: String(bookingData?.blockedTimes.length ?? 0), hint: "Manual unavailable time" },
    ];
  }, [appointments, bookingData?.blockedTimes.length]);

  async function refreshWithMessage(nextMessage: string) {
    const payload = await adminFetch("/api/admin/bookings");
    setBookingData(payload);
    setMessage(nextMessage);
  }

  async function updateAppointment(updates: Record<string, unknown>) {
    if (!selected) return;
    const payload = await adminFetch("/api/admin/bookings", {
      method: "PATCH",
      body: JSON.stringify({ resource: "appointment", id: selected.id, ...updates }),
    });
    setSelected(payload.appointment);
    await refreshWithMessage("Appointment updated.");
  }

  async function updateAppointmentType(id: string, updates: Record<string, unknown>) {
    try {
      await adminFetch("/api/admin/bookings", {
        method: "PATCH",
        body: JSON.stringify({ resource: "appointment_type", id, ...updates }),
      });
      setEditingType(null);
      await refreshWithMessage("Appointment type updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update appointment type.");
    }
  }

  async function deleteAppointmentType(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await adminFetch(`/api/admin/bookings?resource=appointment_type&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshWithMessage("Appointment type deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete appointment type.");
    }
  }

  async function createAppointmentType() {
    if (!typeForm.name.trim()) return;
    await adminFetch("/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify({
        resource: "appointment_type",
        ...typeForm,
        duration_minutes: Number(typeForm.duration_minutes || 30),
        slug: typeForm.slug || typeForm.name,
      }),
    });
    setTypeForm({ name: "", slug: "", description: "", duration_minutes: "30", location_type: "phone_call" });
    await refreshWithMessage("Appointment type created.");
  }

  async function createAvailabilityRule() {
    await adminFetch("/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify({
        resource: "availability_rule",
        ...ruleForm,
        appointment_type_id: ruleForm.appointment_type_id === "all" ? null : ruleForm.appointment_type_id,
        day_of_week: Number(ruleForm.day_of_week),
      }),
    });
    await refreshWithMessage("Availability rule added.");
  }

  async function createBlockedTime() {
    if (!blockForm.start_time || !blockForm.end_time) return;
    await adminFetch("/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify({
        resource: "blocked_time",
        title: blockForm.title || "Blocked time",
        start_time: new Date(blockForm.start_time).toISOString(),
        end_time: new Date(blockForm.end_time).toISOString(),
        reason: blockForm.reason,
      }),
    });
    setBlockForm({ title: "", start_time: "", end_time: "", reason: "" });
    await refreshWithMessage("Blocked time added.");
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
                    <Link href={href} key={label} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}>
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Bookings" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{appointments.length}</Badge>}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
                      {label === "Users" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{users.length}</Badge>}
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
              <span className="font-medium text-foreground">Bookings</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search bookings, customers, appointment types..." />
              </div>
              <AdminNotificationBell />
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking admin access...</CardContent></Card>}
          {authState === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/bookings">Go to login</a></Button></CardContent></Card>}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Bookings</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Manage public appointments, availability, blocked time, notifications, and future calendar connections.</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild><a href="/book" target="_blank" rel="noreferrer"><CalendarCheck className="mr-2 h-4 w-4" />Public booking page</a></Button>
                  <Button variant="outline" onClick={() => setView("availability")}><Plus className="mr-2 h-4 w-4" />Block time</Button>
                </div>
              </div>

              {message && <div className="mb-4 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{message}</div>}
              {loading && <div className="mb-4 flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading booking records...</div>}

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
              </section>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(["overview", "list", "calendar", "availability"] as const).map((item) => (
                  <Button key={item} size="sm" variant={view === item ? "default" : "outline"} onClick={() => setView(item)}>{human(item)}</Button>
                ))}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="ml-auto h-9 w-[190px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{human(status)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {view === "overview" && <Overview appointments={appointments} types={types} notifications={bookingData?.notifications ?? []} onSelect={setSelected} onEditType={setEditingType} onDeleteType={deleteAppointmentType} />}
              {view === "list" && <AppointmentList appointments={filteredAppointments} types={types} onSelect={setSelected} />}
              {view === "calendar" && <CalendarView appointments={filteredAppointments.filter((appointment) => {
                const date = new Date(appointment.start_time);
                return date >= today && date < weekEnd;
              })} types={types} onSelect={setSelected} />}
              {view === "availability" && (
                <AvailabilityView
                  types={types}
                  rules={bookingData?.availabilityRules ?? []}
                  blockedTimes={bookingData?.blockedTimes ?? []}
                  typeForm={typeForm}
                  setTypeForm={setTypeForm}
                  ruleForm={ruleForm}
                  setRuleForm={setRuleForm}
                  blockForm={blockForm}
                  setBlockForm={setBlockForm}
                  onCreateType={createAppointmentType}
                  onCreateRule={createAvailabilityRule}
                  onCreateBlock={createBlockedTime}
                />
              )}

              <AppointmentSheet
                appointment={selected}
                type={types.find((type) => type.id === selected?.appointment_type_id) ?? null}
                users={bookingData?.users ?? []}
                orders={bookingData?.orders ?? []}
                jobs={bookingData?.productionJobs ?? []}
                onOpenChange={(open) => !open && setSelected(null)}
                onSave={updateAppointment}
              />
              <TypeSheet
                type={editingType}
                onOpenChange={(open) => !open && setEditingType(null)}
                onSave={updateAppointmentType}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
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

function Overview({ appointments, types, notifications, onSelect, onEditType, onDeleteType }: { appointments: Appointment[]; types: AppointmentType[]; notifications: BookingData["notifications"]; onSelect: (appointment: Appointment) => void; onEditType: (type: AppointmentType) => void; onDeleteType: (id: string, name: string) => void }) {
  const upcoming = appointments.filter((appointment) => new Date(appointment.start_time) >= new Date()).slice(0, 8);
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader className="pb-3"><CardTitle>Upcoming appointments</CardTitle><CardDescription>Newest public bookings and manually managed appointments.</CardDescription></CardHeader>
        <CardContent><AppointmentList compact appointments={upcoming} types={types} onSelect={onSelect} /></CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Appointment types</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {types.map((type) => (
              <div key={type.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background/35 p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{type.name}</div>
                  <div className="text-xs text-muted-foreground">{type.duration_minutes} min · {human(type.location_type)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">{type.is_active ? "Active" : "Hidden"}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditType(type)} aria-label={`Edit ${type.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => onDeleteType(type.id, type.name)} aria-label={`Delete ${type.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {!types.length && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No appointment types yet. Go to Availability to create one.</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Notifications</CardTitle><CardDescription>Email/SMS hooks are tracked here.</CardDescription></CardHeader>
          <CardContent className="space-y-2">{notifications.slice(0, 6).map((item) => <div key={item.id} className="rounded-lg border bg-background/35 p-3 text-sm"><div className="flex items-center justify-between"><span>{human(item.notification_type)}</span><Badge className={badgeClass(item.status)}>{human(item.status)}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{human(item.channel)} - {item.error_message || new Date(item.created_at).toLocaleString()}</div></div>)}{!notifications.length && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No notification history yet.</div>}</CardContent>
        </Card>
      </div>
    </section>
  );
}

function AppointmentList({ appointments, types, onSelect, compact = false }: { appointments: Appointment[]; types: AppointmentType[]; onSelect: (appointment: Appointment) => void; compact?: boolean }) {
  if (!appointments.length) return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No appointments found.</div>;
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Appointment</TableHead>
            <TableHead>Customer</TableHead>
            {!compact && <TableHead>Type</TableHead>}
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((appointment) => {
            const type = types.find((item) => item.id === appointment.appointment_type_id);
            return (
              <TableRow key={appointment.id} className="cursor-pointer hover:bg-accent/45" onClick={() => onSelect(appointment)}>
                <TableCell><div className="font-medium">{appointment.title}</div><div className="text-xs text-muted-foreground">{human(appointment.location_type)}</div></TableCell>
                <TableCell><div>{[appointment.customer_first_name, appointment.customer_last_name].filter(Boolean).join(" ") || "Guest"}</div><div className="text-xs text-muted-foreground">{appointment.customer_email}</div></TableCell>
                {!compact && <TableCell>{type?.name || "Unlinked"}</TableCell>}
                <TableCell>{fmtDate(appointment.start_time)}<div className="text-xs text-muted-foreground">{fmtTime(appointment.start_time)} - {fmtTime(appointment.end_time)}</div></TableCell>
                <TableCell><Badge className={badgeClass(appointment.status)}>{human(appointment.status)}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CalendarView({ appointments, types, onSelect }: { appointments: Appointment[]; types: AppointmentType[]; onSelect: (appointment: Appointment) => void }) {
  const today = startOfToday();
  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today.getTime() + index * 24 * 60 * 60 * 1000);
    return { date, key: dateKey(date.toISOString()) };
  });
  return (
    <Card>
      <CardHeader><CardTitle>Calendar</CardTitle><CardDescription>Phase 1 week view. Drag/drop and external calendar sync are staged for Phase 2.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-7">
        {days.map((day) => (
          <div key={day.key} className="min-h-[240px] rounded-lg border bg-background/35 p-3">
            <div className="mb-3 text-sm font-semibold">{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(day.date)}</div>
            <div className="space-y-2">
              {appointments.filter((appointment) => dateKey(appointment.start_time) === day.key).map((appointment) => {
                const type = types.find((item) => item.id === appointment.appointment_type_id);
                return (
                  <button key={appointment.id} onClick={() => onSelect(appointment)} className="w-full rounded-md border bg-card p-2 text-left text-xs hover:border-primary">
                    <div className="font-medium">{fmtTime(appointment.start_time)} {appointment.customer_first_name || "Guest"}</div>
                    <div className="text-muted-foreground">{type?.name || appointment.title}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type CalendarIntegrationStatus = {
  id: string;
  account_email: string | null;
  calendar_name: string | null;
  is_active: boolean;
  token_expires_at: string | null;
} | null;

function CalendarConnectionCard() {
  const [status, setStatus] = useState<CalendarIntegrationStatus>(null);
  const [connectUrl, setConnectUrl] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    async function getToken() {
      const db = getSupabaseBrowserClient();
      return (await db?.auth.getSession())?.data.session?.access_token ?? null;
    }
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch("/api/admin/calendar", {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json() as { integration: CalendarIntegrationStatus; connectUrl: string; configured: boolean };
        setStatus(data.integration);
        setConnectUrl(data.connectUrl);
        setConfigured(data.configured);
      } finally {
        setLoading(false);
      }
    }
    load();
    // Handle redirect back from Google OAuth
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("calendar_connected")) {
        window.history.replaceState({}, "", window.location.pathname);
        load();
      }
    }
  }, []);

  async function disconnect() {
    setDisconnecting(true);
    try {
      const db = getSupabaseBrowserClient();
      const token = (await db?.auth.getSession())?.data.session?.access_token;
      await fetch("/api/admin/calendar", {
        method: "DELETE",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      setStatus(null);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Google Calendar sync</CardTitle>
        <CardDescription>Two-way sync blocks your Google Calendar busy times from being booked and pushes new appointments to your calendar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : !configured ? (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">Not configured</div>
            <p>Add <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_CALENDAR_CLIENT_ID</code> and <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_CALENDAR_CLIENT_SECRET</code> to your environment variables to enable Google Calendar sync.</p>
          </div>
        ) : status?.is_active ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              <div className="text-sm">
                <div className="font-medium text-green-700 dark:text-green-300">Connected</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{status.account_email || status.calendar_name || "Google Calendar"}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Your Google Calendar busy times are now automatically blocked from public booking. New appointments will be pushed to your calendar.</p>
            <Button variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={disconnect} disabled={disconnecting}>
              <Link2Off className="mr-2 h-3.5 w-3.5" />{disconnecting ? "Disconnecting…" : "Disconnect Google Calendar"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Connect your Google Calendar to automatically block busy times and prevent double-booking.</p>
            <Button className="w-full" asChild>
              <a href={connectUrl}><Link2 className="mr-2 h-4 w-4" />Connect Google Calendar</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AvailabilityView(props: {
  types: AppointmentType[];
  rules: AvailabilityRule[];
  blockedTimes: BlockedTime[];
  typeForm: { name: string; slug: string; description: string; duration_minutes: string; location_type: string };
  setTypeForm: (form: { name: string; slug: string; description: string; duration_minutes: string; location_type: string }) => void;
  ruleForm: { day_of_week: string; start_time: string; end_time: string; appointment_type_id: string };
  setRuleForm: (form: { day_of_week: string; start_time: string; end_time: string; appointment_type_id: string }) => void;
  blockForm: { title: string; start_time: string; end_time: string; reason: string };
  setBlockForm: (form: { title: string; start_time: string; end_time: string; reason: string }) => void;
  onCreateType: () => void;
  onCreateRule: () => void;
  onCreateBlock: () => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader className="pb-3"><CardTitle>Appointment types</CardTitle><CardDescription>Create services customers can book.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Name" value={props.typeForm.name} onChange={(event) => props.setTypeForm({ ...props.typeForm, name: event.target.value })} />
          <Input placeholder="Slug (optional)" value={props.typeForm.slug} onChange={(event) => props.setTypeForm({ ...props.typeForm, slug: event.target.value })} />
          <Textarea placeholder="Description" value={props.typeForm.description} onChange={(event) => props.setTypeForm({ ...props.typeForm, description: event.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type="number" min="5" placeholder="Duration minutes" value={props.typeForm.duration_minutes} onChange={(event) => props.setTypeForm({ ...props.typeForm, duration_minutes: event.target.value })} />
            <Select value={props.typeForm.location_type} onValueChange={(value) => props.setTypeForm({ ...props.typeForm, location_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LOCATION_OPTIONS.map((type) => <SelectItem key={type} value={type}>{human(type)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={props.onCreateType}><Plus className="mr-2 h-4 w-4" />Add appointment type</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle>Weekly availability</CardTitle><CardDescription>Public booking uses these working windows.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={props.ruleForm.day_of_week} onValueChange={(value) => props.setRuleForm({ ...props.ruleForm, day_of_week: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DAYS.map((day, index) => <SelectItem key={day} value={String(index)}>{day}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={props.ruleForm.appointment_type_id} onValueChange={(value) => props.setRuleForm({ ...props.ruleForm, appointment_type_id: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All appointment types</SelectItem>{props.types.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="time" value={props.ruleForm.start_time} onChange={(event) => props.setRuleForm({ ...props.ruleForm, start_time: event.target.value })} />
            <Input type="time" value={props.ruleForm.end_time} onChange={(event) => props.setRuleForm({ ...props.ruleForm, end_time: event.target.value })} />
          </div>
          <Button className="w-full" onClick={props.onCreateRule}><Clock className="mr-2 h-4 w-4" />Add availability</Button>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {props.rules.map((rule) => <div key={rule.id} className="rounded-lg border bg-background/35 p-3 text-sm"><div className="font-medium">{DAYS[rule.day_of_week]} {String(rule.start_time).slice(0, 5)} - {String(rule.end_time).slice(0, 5)}</div><div className="text-xs text-muted-foreground">{props.types.find((type) => type.id === rule.appointment_type_id)?.name || "All appointment types"}</div></div>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle>Blocked time</CardTitle><CardDescription>Manual unavailable windows prevent public booking.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Title" value={props.blockForm.title} onChange={(event) => props.setBlockForm({ ...props.blockForm, title: event.target.value })} />
          <Input type="datetime-local" value={props.blockForm.start_time} onChange={(event) => props.setBlockForm({ ...props.blockForm, start_time: event.target.value })} />
          <Input type="datetime-local" value={props.blockForm.end_time} onChange={(event) => props.setBlockForm({ ...props.blockForm, end_time: event.target.value })} />
          <Textarea placeholder="Reason" value={props.blockForm.reason} onChange={(event) => props.setBlockForm({ ...props.blockForm, reason: event.target.value })} />
          <Button className="w-full" onClick={props.onCreateBlock}>Block time</Button>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {props.blockedTimes.map((item) => <div key={item.id} className="rounded-lg border bg-background/35 p-3 text-sm"><div className="font-medium">{item.title}</div><div className="text-xs text-muted-foreground">{fmtDate(item.start_time)} {fmtTime(item.start_time)} - {fmtTime(item.end_time)}</div></div>)}
            {!props.blockedTimes.length && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No blocked time yet.</div>}
          </div>
        </CardContent>
      </Card>

      <CalendarConnectionCard />
    </section>
  );
}

function AppointmentSheet(props: {
  appointment: Appointment | null;
  type: AppointmentType | null;
  users: BookingData["users"];
  orders: BookingData["orders"];
  jobs: BookingData["productionJobs"];
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Record<string, unknown>) => void;
}) {
  const [status, setStatus] = useState("confirmed");
  const [internalNotes, setInternalNotes] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("none");
  const [relatedOrderId, setRelatedOrderId] = useState("none");
  const [relatedJobId, setRelatedJobId] = useState("none");

  useEffect(() => {
    setStatus(props.appointment?.status || "confirmed");
    setInternalNotes(props.appointment?.internal_notes || "");
    setAssignedStaffId(props.appointment?.assigned_staff_id || "none");
    setRelatedOrderId(props.appointment?.related_order_id || "none");
    setRelatedJobId(props.appointment?.related_job_id || "none");
  }, [props.appointment]);

  return (
    <Sheet open={Boolean(props.appointment)} onOpenChange={props.onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        {props.appointment && (
          <>
            <SheetHeader>
              <SheetTitle>{props.appointment.title}</SheetTitle>
              <SheetDescription>{props.type?.name || "Appointment"} - {fmtDate(props.appointment.start_time)} at {fmtTime(props.appointment.start_time)}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryTile label="Customer">{[props.appointment.customer_first_name, props.appointment.customer_last_name].filter(Boolean).join(" ") || "Guest"}</SummaryTile>
                <SummaryTile label="Email">{props.appointment.customer_email || "Missing"}</SummaryTile>
                <SummaryTile label="Phone">{props.appointment.customer_phone || "Missing"}</SummaryTile>
                <SummaryTile label="Location">{human(props.appointment.location_type)}</SummaryTile>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2"><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><label className="text-xs font-medium text-muted-foreground">Assigned staff</label><Select value={assignedStaffId} onValueChange={setAssignedStaffId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{props.users.map((user) => <SelectItem key={user.id} value={user.id}>{user.full_name || user.email || user.id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><label className="text-xs font-medium text-muted-foreground">Related order</label><Select value={relatedOrderId} onValueChange={setRelatedOrderId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No order</SelectItem>{props.orders.map((order) => <SelectItem key={order.id} value={order.id}>{order.order_number || order.company || order.id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><label className="text-xs font-medium text-muted-foreground">Related production job</label><Select value={relatedJobId} onValueChange={setRelatedJobId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No job</SelectItem>{props.jobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.station || job.status || job.id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">Internal notes</label>
                <Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Staff-only appointment notes." />
              </div>

              {props.appointment.customer_notes && <div className="rounded-lg border bg-background/35 p-3 text-sm"><div className="mb-1 text-xs font-medium text-muted-foreground">Customer message</div>{props.appointment.customer_notes}</div>}

              <Button className="w-full" onClick={() => props.onSave({
                status,
                internal_notes: internalNotes,
                assigned_staff_id: assignedStaffId === "none" ? null : assignedStaffId,
                related_order_id: relatedOrderId === "none" ? null : relatedOrderId,
                related_job_id: relatedJobId === "none" ? null : relatedJobId,
              })}><ShieldCheck className="mr-2 h-4 w-4" />Save appointment</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-background/35 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

function TypeSheet(props: {
  type: AppointmentType | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [locationType, setLocationType] = useState("phone_call");
  const [bufferBefore, setBufferBefore] = useState("0");
  const [bufferAfter, setBufferAfter] = useState("0");
  const [minNotice, setMinNotice] = useState("120");
  const [maxDays, setMaxDays] = useState("30");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [isActive, setIsActive] = useState("true");

  useEffect(() => {
    if (!props.type) return;
    setName(props.type.name);
    setDescription(props.type.description || "");
    setDuration(String(props.type.duration_minutes));
    setLocationType(props.type.location_type);
    setBufferBefore(String(props.type.buffer_before_minutes));
    setBufferAfter(String(props.type.buffer_after_minutes));
    setMinNotice(String(props.type.min_notice_minutes));
    setMaxDays(String(props.type.max_days_in_advance));
    setMeetingUrl(props.type.meeting_url || "");
    setIsActive(props.type.is_active ? "true" : "false");
  }, [props.type]);

  return (
    <Sheet open={Boolean(props.type)} onOpenChange={props.onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        {props.type && (
          <>
            <SheetHeader>
              <SheetTitle>Edit appointment type</SheetTitle>
              <SheetDescription>{props.type.slug}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description shown to customers" className="resize-none" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                  <Input type="number" min="5" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Location type</label>
                  <Select value={locationType} onValueChange={setLocationType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCATION_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{human(opt)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Buffer before (min)</label>
                  <Input type="number" min="0" value={bufferBefore} onChange={(e) => setBufferBefore(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Buffer after (min)</label>
                  <Input type="number" min="0" value={bufferAfter} onChange={(e) => setBufferAfter(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Min notice (min)</label>
                  <Input type="number" min="0" value={minNotice} onChange={(e) => setMinNotice(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Max days in advance</label>
                  <Input type="number" min="1" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
                </div>
              </div>
              {(locationType === "video_meeting" || locationType === "custom_location") && (
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Meeting URL</label>
                  <Input type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://..." />
                </div>
              )}
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">Visibility</label>
                <Select value={isActive} onValueChange={setIsActive}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active — visible to customers</SelectItem>
                    <SelectItem value="false">Hidden — not bookable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => props.onSave(props.type!.id, {
                name,
                description,
                duration_minutes: Number(duration) || 30,
                location_type: locationType,
                buffer_before_minutes: Number(bufferBefore) || 0,
                buffer_after_minutes: Number(bufferAfter) || 0,
                min_notice_minutes: Number(minNotice) || 0,
                max_days_in_advance: Number(maxDays) || 30,
                meeting_url: meetingUrl || null,
                is_active: isActive === "true",
              })}>
                <ShieldCheck className="mr-2 h-4 w-4" />Save changes
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
