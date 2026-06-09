"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight, Megaphone, Moon, Search, Send, Sun, Users } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function channelLabel(value: string) {
  if (value === "email_sms") return "Email + SMS";
  return human(value);
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

async function adminToken() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Sign in again before sending a campaign.");
  return session.access_token;
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

export function AdminMarketing() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);

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

  async function refresh() {
    setData(await loadAdminDashboardData());
  }

  const users = data?.users ?? [];
  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const products = data?.products ?? [];
  const customers = users.filter((user) => user.role === "customer");
  const referrals = users.filter((user) => user.role === "referral");
  const resellers = users.filter((user) => user.role === "reseller");
  const paidRevenue = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const productSegments = useMemo(() => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 8), [products]);
  const visibleUsers = users.filter((user) => [user.full_name, user.email, user.company, user.role].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase().trim())));

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-[45px] px-2 pt-[5px]"><a href="/admin"><img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" /><img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" /></a></div>
          <nav className="space-y-4">{adminNavGroups.map((group) => <div key={group.label}>{group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}<div className="space-y-0.5">{group.items.map(([label, Icon, href]) => <Link key={label} href={href} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}><Icon className="h-4 w-4" />{label}{label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}{label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}{label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}</Link>)}</div></div>)}</nav>

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

        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]"><div className="flex h-12 items-center gap-3 px-5"><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Super Admin</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-foreground">Marketing</span></div><div className="ml-auto flex items-center gap-2"><div className="relative hidden w-[380px] md:block"><Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" /><Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search customers, campaigns, segments..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><AdminNotificationBell /><Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button></div></div></header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/marketing">Go to login</a></Button></CardContent></Card>}
          {authState === "allowed" && <>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h1 className="text-[25px] font-semibold tracking-tight">Marketing command center</h1><p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Manage campaigns, customer segments, referral/reseller outreach, promotions, and outbound email/SMS/dashboard messaging.</p></div><Button onClick={() => setCampaignOpen(true)}><Megaphone className="h-4 w-4" /> New campaign</Button></div>
            <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Stat label="Customers" value={String(customers.length)} hint="Campaign audience" /><Stat label="Referrals" value={String(referrals.length)} hint="Referral partners" /><Stat label="Resellers" value={String(resellers.length)} hint="Reseller channel" /><Stat label="Messages" value={String(messages.length)} hint="Campaign + support history" /><Stat label="Revenue" value={money.format(paidRevenue)} hint="Paid attribution input" /></section>
            <section className="grid gap-4 xl:grid-cols-[1fr_380px]"><Card><CardHeader className="pb-3"><CardTitle className="text-base">Segments</CardTitle><CardDescription>Fast audience views for the next campaign.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Segment title="All customers" count={customers.length} detail="Customer role accounts" /><Segment title="Payment pending" count={orders.filter((order) => ["unpaid", "pending", "partially_paid"].includes(order.payment_status)).length} detail="Billing follow-up" /><Segment title="Proof pending" count={orders.filter((order) => ["file_review", "proofing"].includes(order.status)).length} detail="Approval reminders" /><Segment title="Recent buyers" count={orders.length} detail="Order-linked audience" />{productSegments.map((segment) => <Segment key={segment} title={segment} count={orders.filter((order) => orderItemsForOrder(data, order.id).some((item) => item.products?.category === segment)).length} detail="Product category buyers" />)}</CardContent></Card><Card><CardHeader className="pb-3"><CardTitle className="text-base">Reachable contacts</CardTitle><CardDescription>{visibleUsers.length} visible accounts</CardDescription></CardHeader><CardContent className="space-y-2">{visibleUsers.slice(0, 10).map((user) => <MiniRow key={user.id} title={user.full_name || user.email || "Unnamed"} detail={`${human(user.role)} - ${user.company || "No company"}`} value={user.email ? "Email" : user.phone ? "SMS" : "No contact"} />)}</CardContent></Card></section>
          </>}
        </main>
        <CampaignSheet open={campaignOpen} onOpenChange={setCampaignOpen} users={users} onSent={refresh} />
      </div>
    </div>
  );
}

function orderItemsForOrder(data: AdminDashboardData | null, orderId: string) {
  return (data?.orderItems ?? []).filter((item) => item.order_id === orderId);
}

function CampaignSheet({ open, onOpenChange, users, onSent }: { open: boolean; onOpenChange: (open: boolean) => void; users: AdminDashboardData["users"]; onSent: () => Promise<void> }) {
  const [channel, setChannel] = useState("email_sms");
  const [role, setRole] = useState("all");
  const [subject, setSubject] = useState("ControlP.io update");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const roles = Array.from(new Set(users.map((user) => user.role))).sort();
  const audienceUsers = useMemo(() => (role === "all" ? users : users.filter((user) => user.role === role)).filter((user) => user.status === "active"), [role, users]);
  const emailReachable = audienceUsers.filter((user) => user.email);
  const smsReachable = audienceUsers.filter((user) => user.phone);
  const combinedReachable = audienceUsers.filter((user) => user.email || user.phone);
  const reachableCount = channel === "sms" ? smsReachable.length : channel === "email" ? emailReachable.length : channel === "email_sms" ? combinedReachable.length : audienceUsers.length;
  const canSend = body.trim().length > 0 && reachableCount > 0 && !sending;

  useEffect(() => {
    setMessage("");
  }, [channel, role]);

  async function send() {
    setSending(true);
    setMessage("Sending campaign...");
    try {
      const token = await adminToken();
      const targetUsers = channel === "sms" ? smsReachable : channel === "email" ? emailReachable : channel === "email_sms" ? combinedReachable : audienceUsers;
      const response = await fetch("/api/admin/messaging/send", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ channel, mode: "bulk", role, userIds: targetUsers.map((user) => user.id), subject, body }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send campaign.");
      setMessage(`Sent ${payload.sent || 0} message${payload.sent === 1 ? "" : "s"}.`);
      await onSent();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send campaign.");
    } finally {
      setSending(false);
    }
  }

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="overflow-y-auto sm:max-w-[60rem]"><SheetHeader><SheetTitle>New campaign</SheetTitle><SheetDescription>Send a bulk email, SMS, dashboard, or internal campaign to a role-based audience.</SheetDescription></SheetHeader><div className="mt-6 space-y-4"><div className="grid gap-3 sm:grid-cols-2"><FieldSelect label="Channel" value={channel} onChange={setChannel} items={["email_sms", "email", "sms", "dashboard", "internal"].map((item) => ({ value: item, label: channelLabel(item) }))} /><FieldSelect label="Audience" value={role} onChange={setRole} items={[{ value: "all", label: "All active users" }, ...roles.map((item) => ({ value: item, label: human(item) }))]} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Subject</div><Input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={channel === "sms"} /></div><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Message</div><Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Campaign copy, offer details, reminder, or announcement..." /></div><div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground"><Users className="mr-2 inline h-4 w-4" />Audience preview: {reachableCount}/{audienceUsers.length} reachable by {channelLabel(channel)}. {channel === "sms" ? "SMS uses phone numbers saved on any user or customer." : channel === "email" ? "Email uses addresses saved on any user or customer." : channel === "email_sms" ? `${emailReachable.length} email-ready and ${smsReachable.length} SMS-ready contacts. Users with both receive both.` : "Dashboard/internal messages use active user records."}</div>{(channel === "sms" || channel === "email_sms") && <div className={cn("rounded-lg border p-3 text-sm", smsReachable.length ? "bg-background/35 text-muted-foreground" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300")}><div className="font-medium">{smsReachable.length ? "SMS recipients ready" : "No SMS recipients for this audience"}</div><div className="mt-1 text-xs">{smsReachable.length ? smsReachable.slice(0, 6).map((user) => `${user.full_name || user.email || "Unnamed"} ${user.phone}`).join(" | ") : "Add phone numbers from Users or Customers before sending SMS."}</div></div>}{(channel === "email" || channel === "email_sms") && <div className={cn("rounded-lg border p-3 text-sm", emailReachable.length ? "bg-background/35 text-muted-foreground" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300")}><div className="font-medium">{emailReachable.length ? "Email recipients ready" : "No email recipients for this audience"}</div><div className="mt-1 text-xs">{emailReachable.length ? emailReachable.slice(0, 6).map((user) => `${user.full_name || user.email || "Unnamed"} ${user.email}`).join(" | ") : "Add email addresses from Users or Customers before sending email."}</div></div>}{message && <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{message}</div>}<div className="flex gap-2"><Button className="flex-1" disabled={!canSend} onClick={send}><Send className="h-4 w-4" /> {sending ? "Sending..." : "Send campaign"}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div></div></SheetContent></Sheet>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function Segment({ title, count, detail }: { title: string; count: number; detail: string }) {
  return <div className="rounded-lg border bg-background/35 p-3"><div className="flex items-center justify-between gap-3"><div className="font-medium">{title}</div><Badge variant="outline">{count}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}

function MiniRow({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge variant="outline">{value}</Badge></div>;
}

function FieldSelect({ label, value, onChange, items }: { label: string; value: string; onChange: (value: string) => void; items: { value: string; label: string }[] }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>;
}
