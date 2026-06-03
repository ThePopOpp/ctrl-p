"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BarChart3, Bell, Box, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, CreditCard, Download, ExternalLink, FileCheck2, FileText, Home, IdCard, LogOut, Mail, MessageSquare, Moon, Package, PackageCheck, Phone, RotateCcw, Search, Send, Settings, Sun, Truck, Upload, UserCircle, X, type LucideIcon } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CustomerProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  profile_photo_url?: string | null;
  role: string;
  status: string;
};

type CustomerOrder = {
  id: string;
  order_number: string | null;
  status: string;
  production_status: string;
  payment_status: string;
  total: number | string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_notes: string | null;
  due_at: string | null;
  created_at: string | null;
};

type CustomerOrderItem = {
  id: string;
  order_id: string;
  quantity: number | null;
  unit_price: number | string | null;
  line_total: number | string | null;
  proof_required: boolean;
  products?: { id: string; name: string | null; category: string | null } | null;
};

type CustomerPayment = {
  id: string;
  order_id: string | null;
  amount: number | string | null;
  status: string;
  provider: string | null;
  method: string | null;
  currency: string | null;
  invoice_number?: string | null;
  invoice_due_at?: string | null;
  payment_link_url?: string | null;
  received_at: string | null;
  created_at: string | null;
};

type CustomerMessage = {
  id: string;
  order_id: string | null;
  subject: string | null;
  body: string | null;
  channel: string;
  direction: string;
  read_at: string | null;
  sent_at: string | null;
  created_at: string | null;
};

type CustomerArtwork = {
  id: string;
  order_id: string | null;
  filename: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  thumbnail_url?: string | null;
  review_status?: string | null;
  proof_version?: number | null;
  admin_comments?: string | null;
  customer_comments?: string | null;
  created_at: string | null;
};

type CustomerDesignDraft = {
  id: string;
  product_id: string | null;
  product_key: string | null;
  product_label: string | null;
  title: string | null;
  status: string | null;
  preview_svg?: string | null;
  preview_image_url?: string | null;
  order_id?: string | null;
  order_item_id?: string | null;
  last_saved_at: string | null;
  created_at: string | null;
  products?: { id: string; name: string | null; slug: string | null; category: string | null } | null;
};

type CustomerProof = {
  id: string;
  order_item_id: string;
  proof_url: string | null;
  revision_number: number | null;
  status?: string | null;
  admin_comments?: string | null;
  customer_comments?: string | null;
  sent_at: string | null;
  customer_approved_at: string | null;
  created_at: string | null;
};

type CustomerShipment = {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string | null;
  shipped_at: string | null;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
};

type CustomerBooking = {
  id: string;
  title: string | null;
  start_time: string;
  end_time: string | null;
  status: string | null;
  appointment_type_id: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  notes: string | null;
  created_at: string | null;
};

type CustomerData = {
  profile: CustomerProfile;
  orders: CustomerOrder[];
  orderItems: CustomerOrderItem[];
  payments: CustomerPayment[];
  messages: CustomerMessage[];
  artworkFiles: CustomerArtwork[];
  designDrafts: CustomerDesignDraft[];
  proofs: CustomerProof[];
  shipments: CustomerShipment[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const navItems: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Overview", icon: Home, href: "#overview" },
  { label: "Profile", icon: UserCircle, href: "/dashboard/customer/profile" },
  { label: "Orders", icon: Box, href: "#orders" },
  { label: "Invoices", icon: CreditCard, href: "#invoices" },
  { label: "Artwork", icon: FileCheck2, href: "#artwork" },
  { label: "Bookings", icon: CalendarClock, href: "#bookings" },
  { label: "My Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/customer/analytics" },
  { label: "Messages", icon: MessageSquare, href: "#messages" },
  { label: "Shipping", icon: Truck, href: "#shipping" },
  { label: "Settings", icon: Settings, href: "/dashboard/customer/settings" },
];

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function amount(value: number | string | null | undefined) {
  return money.format(Number(value || 0));
}

function date(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function statusTone(value: string | null | undefined) {
  const status = String(value || "");
  if (["paid", "approved", "completed", "delivered"].includes(status)) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["failed", "cancelled", "rejected", "refunded", "revision_requested"].includes(status)) return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
}

export function CustomerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<CustomerData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [proofBusy, setProofBusy] = useState<Set<string>>(new Set());
  const [proofRevisionId, setProofRevisionId] = useState<string | null>(null);
  const [proofRevisionText, setProofRevisionText] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeOrderId, setComposeOrderId] = useState<string | null>(null);
  const [artworkUploading, setArtworkUploading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("controlp_customer_theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  const getToken = useCallback(async () => {
    const db = getSupabaseBrowserClient();
    return (await db?.auth.getSession())?.data.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    async function load() {
      const db = getSupabaseBrowserClient();
      const session = db ? (await db.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        router.replace("/login?redirect=/dashboard/customer");
        return;
      }

      const headers = { authorization: `Bearer ${session.access_token}` };

      const [dashResponse, bookingsResponse] = await Promise.all([
        fetch("/api/dashboard/customer", { headers }),
        fetch("/api/dashboard/customer/bookings", { headers }),
      ]);

      const payload = await dashResponse.json().catch(() => ({}));
      if (!dashResponse.ok) {
        setMessage(payload.error || "Could not load customer dashboard.");
        setState("denied");
        return;
      }

      const dashData = payload as CustomerData;
      setData(dashData);
      setMessages(dashData.messages ?? []);
      setState("ready");

      const bookingsPayload = await bookingsResponse.json().catch(() => ({}));
      if (bookingsResponse.ok) setBookings(bookingsPayload.bookings ?? []);
    }
    load();
  }, [router]);

  async function signOut() {
    const db = getSupabaseBrowserClient();
    await db?.auth.signOut();
    router.replace("/login");
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("controlp_customer_theme", next);
      return next;
    });
  }

  async function openNotifications() {
    setNotifOpen((open) => !open);
    const unread = messages.filter((m) => !m.read_at && m.direction === "outbound");
    if (!unread.length) return;
    // Optimistic update
    setMessages((prev) => prev.map((m) => (!m.read_at && m.direction === "outbound" ? { ...m, read_at: new Date().toISOString() } : m)));
    const token = await getToken();
    if (!token) return;
    await fetch("/api/dashboard/customer/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: unread.map((m) => m.id) }),
    }).catch(() => null);
  }

  async function respondToProof(proofId: string, action: "approve" | "revision", comment?: string) {
    setProofBusy((prev) => new Set(prev).add(proofId));
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/dashboard/customer/proofs/${proofId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, comment }),
      });
      const payload = await res.json().catch(() => ({})) as { proof?: CustomerProof; error?: string };
      if (!res.ok) {
        alert(payload.error || "Could not submit response.");
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          proofs: prev.proofs.map((p) =>
            p.id === proofId
              ? { ...p, status: payload.proof?.status ?? p.status, customer_approved_at: payload.proof?.customer_approved_at ?? p.customer_approved_at }
              : p,
          ),
        };
      });
      setProofRevisionId(null);
      setProofRevisionText("");
    } finally {
      setProofBusy((prev) => { const next = new Set(prev); next.delete(proofId); return next; });
    }
  }

  async function sendMessage() {
    const body = composeBody.trim();
    if (!body) return;
    setComposeSending(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/dashboard/customer/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: composeSubject.trim() || null, body, order_id: composeOrderId }),
      });
      const payload = await res.json().catch(() => ({})) as { message?: CustomerMessage; error?: string };
      if (!res.ok) { alert(payload.error || "Could not send message."); return; }
      if (payload.message) {
        setMessages((prev) => [payload.message!, ...prev]);
      }
      setComposeBody("");
      setComposeSubject("");
      setComposeOrderId(null);
      setComposeOpen(false);
    } finally {
      setComposeSending(false);
    }
  }

  function openComposeForOrder(orderId: string, subject: string, prefill?: string) {
    setComposeOrderId(orderId);
    setComposeSubject(subject);
    setComposeBody(prefill || "");
    setComposeOpen(true);
    setTimeout(() => document.getElementById("messages")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function uploadArtwork(file: File, orderId?: string) {
    setArtworkUploading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const form = new FormData();
      form.append("file", file);
      if (orderId) form.append("order_id", orderId);
      const res = await fetch("/api/dashboard/customer/artwork/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const payload = await res.json().catch(() => ({})) as { artworkFile?: CustomerArtwork; error?: string };
      if (!res.ok) { alert(payload.error || "Could not upload artwork."); return; }
      if (payload.artworkFile) {
        setData((prev) => prev ? { ...prev, artworkFiles: [payload.artworkFile!, ...prev.artworkFiles] } : prev);
      }
    } finally {
      setArtworkUploading(false);
    }
  }

  const orders = data?.orders ?? [];
  const orderItems = data?.orderItems ?? [];
  const payments = data?.payments ?? [];
  const artwork = data?.artworkFiles ?? [];
  const designDrafts = data?.designDrafts ?? [];
  const proofs = data?.proofs ?? [];
  const shipments = data?.shipments ?? [];
  const itemsByOrder = useMemo(() => {
    const map = new Map<string, CustomerOrderItem[]>();
    for (const item of orderItems) {
      const list = map.get(item.order_id) ?? [];
      list.push(item);
      map.set(item.order_id, list);
    }
    return map;
  }, [orderItems]);
  const outstandingPayments = payments.filter((p) => !["paid", "refunded", "canceled"].includes(String(p.status ?? "")) && String(p.status ?? "") !== "failed");
  const failedPayments = payments.filter((p) => String(p.status ?? "") === "failed");
  const paidPayments = payments.filter((p) => ["paid", "refunded"].includes(String(p.status ?? "")));
  const openOrders = orders.filter((order) => !["completed", "delivered", "cancelled", "refunded"].includes(order.status));
  const unpaidPayments = payments.filter((payment) => !["paid", "refunded"].includes(payment.status));
  const proofQueue = proofs.filter((proof) => !proof.customer_approved_at && !["approved", "rejected"].includes(String(proof.status || "")));
  const unreadMessages = messages.filter((item) => !item.read_at && item.direction === "outbound");
  const visibleOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => !needle || [order.order_number, order.status, order.production_status, order.payment_status].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [orders, query]);

  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const pastBookings = bookings.filter((b) => new Date(b.start_time) < new Date());

  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
        <a className="mb-5 flex items-center gap-3 px-2" href="/">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div>
            <div className="text-sm font-semibold">Customer</div>
          </div>
        </a>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, href }) => (
            <a key={label} href={href} className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <Icon className="h-4 w-4" />
              {label}
              {label === "Bookings" && upcomingBookings.length > 0 && (
                <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{upcomingBookings.length}</Badge>
              )}
            </a>
          ))}
        </nav>
        {data?.profile && <div className="absolute bottom-3 left-3 right-3 rounded-xl border bg-background/55 p-2">
          <div className="flex items-center gap-2">
            {data.profile.profile_photo_url ? <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={data.profile.profile_photo_url} alt="" /> : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{(data.profile.full_name || data.profile.email || "C").slice(0, 1).toUpperCase()}</div>}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{data.profile.full_name || "Customer"}</div>
              <div className="truncate text-xs text-muted-foreground">{data.profile.company || data.profile.email || "ControlP.io"}</div>
            </div>
          </div>
        </div>}
      </aside>

      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
        <div className="flex h-12 items-center gap-3 px-5">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">Dashboard</span></div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden w-[360px] md:block">
              <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
              <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search orders, status, invoices..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div ref={notifRef} className="relative">
              <Button
                variant="outline"
                size="icon"
                className="relative h-8 w-8"
                aria-label="Notifications"
                onClick={openNotifications}
              >
                <Bell className="h-4 w-4" />
                {unreadMessages.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadMessages.length > 9 ? "9+" : unreadMessages.length}
                  </span>
                )}
              </Button>
              {notifOpen && (
                <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-card shadow-xl">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="text-sm font-semibold">Notifications</div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNotifOpen(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {messages.slice(0, 8).map((msg) => (
                      <div key={msg.id} className={cn("border-b px-4 py-3 last:border-0", !msg.read_at && msg.direction === "outbound" && "bg-primary/5")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{msg.subject || human(msg.channel)}</div>
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{msg.body || "No message body."}</div>
                          </div>
                          {!msg.read_at && msg.direction === "outbound" && <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{date(msg.created_at)}</div>
                      </div>
                    ))}
                    {!messages.length && <div className="px-4 py-6 text-center text-xs text-muted-foreground">No notifications yet.</div>}
                  </div>
                </div>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Toggle theme" onClick={toggleTheme}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            <Button variant="outline" className="h-8 text-xs" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
        {state === "loading" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading your dashboard...</CardContent></Card>}
        {state === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Dashboard unavailable</div><p className="mt-2 text-sm text-muted-foreground">{message}</p><Button className="mt-4" asChild><a href="/login?redirect=/dashboard/customer">Go to login</a></Button></CardContent></Card>}
        {state === "ready" && data && (
          <>
            <section id="overview" className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-[25px] font-semibold tracking-tight">Welcome back{data.profile.full_name ? `, ${data.profile.full_name.split(" ")[0]}` : ""}</h1>
                <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Track orders, invoices, proofs, bookings, and shipping from one customer workspace.</p>
              </div>
              <div className="flex gap-2">
                <Button asChild><a href="mailto:hello@controlp.io">Message support</a></Button>
                <Button variant="outline" asChild><a href="/">Browse products</a></Button>
              </div>
            </section>

            <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <Stat label="Open orders" value={String(openOrders.length)} hint={`${orders.length} total orders`} />
              <Stat label="Payment due" value={String(unpaidPayments.length)} hint={amount(unpaidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))} />
              <Stat label="Proofs" value={String(proofQueue.length)} hint="Awaiting review" />
              <Stat label="Designs" value={String(designDrafts.length)} hint="Saved drafts" />
              <Stat label="Bookings" value={String(upcomingBookings.length)} hint="Upcoming appointments" />
              <Stat label="Unread" value={String(unreadMessages.length)} hint="New messages" />
            </section>

            <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card id="orders">
                <CardHeader className="pb-3"><CardTitle className="text-base">Orders</CardTitle><CardDescription>Click any order to see line items and notes.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6 pl-4" />
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="hidden md:table-cell">Production</TableHead>
                        <TableHead className="hidden sm:table-cell">Due</TableHead>
                        <TableHead className="pr-4 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleOrders.map((order) => {
                        const isExpanded = expandedOrderId === order.id;
                        const items = itemsByOrder.get(order.id) ?? [];
                        return (
                          <>
                            <TableRow
                              key={order.id}
                              className="cursor-pointer hover:bg-accent/40"
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            >
                              <TableCell className="pl-4 text-muted-foreground">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-medium">#{order.order_number || order.id.slice(0, 8)}</TableCell>
                              <TableCell><Status value={order.status} /></TableCell>
                              <TableCell><Status value={order.payment_status} /></TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{human(order.production_status)}</TableCell>
                              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{date(order.due_at)}</TableCell>
                              <TableCell className="pr-4 text-right font-semibold">{amount(order.total)}</TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${order.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={7} className="px-4 pb-4 pt-2">
                                  {items.length > 0 && (
                                    <div className="mb-3">
                                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Items</div>
                                      <div className="space-y-1.5">
                                        {items.map((item) => (
                                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border bg-background/60 px-3 py-2 text-sm">
                                            <div className="flex items-center gap-2">
                                              <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                              <span className="font-medium">{item.products?.name || "Item"}</span>
                                              {item.products?.category && <span className="text-xs text-muted-foreground">· {item.products.category}</span>}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                              <span className="text-muted-foreground">×{item.quantity ?? 1}</span>
                                              <span>{amount(item.line_total ?? (Number(item.unit_price || 0) * Number(item.quantity || 1)))}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Order details</div>
                                      <div className="space-y-1 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Placed</span><span>{date(order.created_at)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Est. completion</span><span>{date(order.due_at)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Production</span><span>{human(order.production_status)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shipments.find((s) => s.order_id === order.id) ? human(shipments.find((s) => s.order_id === order.id)!.status || "pending") : "Not shipped"}</span></div>
                                      </div>
                                    </div>
                                    {order.customer_notes && (
                                      <div>
                                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</div>
                                        <div className="rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">{order.customer_notes}</div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openComposeForOrder(order.id, `Question about order #${order.order_number || order.id.slice(0, 8)}`)}>
                                      <MessageSquare className="h-3.5 w-3.5" />Message support
                                    </Button>
                                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openComposeForOrder(order.id, `Reorder request — #${order.order_number || order.id.slice(0, 8)}`, `Hi, I'd like to reorder #${order.order_number || order.id.slice(0, 8)}. Please confirm availability and pricing.`)}>
                                      <RotateCcw className="h-3.5 w-3.5" />Request reorder
                                    </Button>
                                    {(() => { const pmt = payments.find((p) => p.order_id === order.id && p.payment_link_url); return pmt ? (<Button size="sm" variant="outline" className="gap-1.5" asChild><a href={pmt.payment_link_url!} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" />Receipt</a></Button>) : null; })()}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                      {!visibleOrders.length && <TableRow><TableCell colSpan={7} className="p-6 text-center text-muted-foreground">No orders found.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Contact profile</CardTitle><CardDescription>Used for order, SMS, invoice, and proof updates.</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    <ContactRow icon={<Mail className="h-4 w-4" />} label="Email" value={data.profile.email || "Missing"} />
                    <ContactRow icon={<Phone className="h-4 w-4" />} label="Phone" value={data.profile.phone || "Missing"} />
                    <ContactRow icon={<PackageCheck className="h-4 w-4" />} label="Company" value={data.profile.company || "Not set"} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Recent messages</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {messages.slice(0, 4).map((item) => (
                      <div key={item.id} className={cn("rounded-lg border bg-background/35 p-3 text-sm", !item.read_at && item.direction === "outbound" && "border-primary/20 bg-primary/5")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{item.subject || (item.direction === "outbound" ? "From Ctrl+P" : "Your message")}</div>
                            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.body || "No body."}</div>
                          </div>
                          {!item.read_at && item.direction === "outbound" && <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{date(item.created_at)}</div>
                      </div>
                    ))}
                    {!messages.length && <Empty text="No messages yet." />}
                    <a href="#messages" className="block pt-1 text-center text-xs text-primary hover:underline">View all messages →</a>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card id="artwork">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Artwork</CardTitle>
                      <CardDescription>Saved designs, proof approvals, and uploaded artwork live together here.</CardDescription>
                    </div>
                    <Button size="sm" asChild><a href="/designer.html">Open designer</a></Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved artwork</div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {designDrafts.slice(0, 6).map((draft) => (
                        <div key={draft.id} className="rounded-lg border bg-background/35 p-3">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{draft.title || "Untitled design"}</div>
                              <div className="mt-1 truncate text-xs text-muted-foreground">{draft.product_label || draft.products?.name || human(draft.product_key)}</div>
                            </div>
                            <Status value={draft.status || "draft"} />
                          </div>
                          <div className="mt-3 grid h-28 place-items-center overflow-hidden rounded-md border bg-secondary/40">
                            {draft.preview_image_url ? (
                              <img className="h-full w-full object-cover" src={draft.preview_image_url} alt="" />
                            ) : draft.preview_svg ? (
                              <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: draft.preview_svg }} />
                            ) : (
                              <div className="text-xs text-muted-foreground">No preview yet</div>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" asChild><a href={`/designer.html?draft=${draft.id}`}>Continue editing</a></Button>
                            <Button size="sm" variant="outline">Order this design</Button>
                          </div>
                          <div className="mt-2 text-[11px] text-muted-foreground">Saved {date(draft.last_saved_at || draft.created_at)}</div>
                        </div>
                      ))}
                      {!designDrafts.length && <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No saved artwork yet. Open the designer and save a draft to see it here.</div>}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proofs</div>
                    {proofs.length > 0 ? (
                      <div className="space-y-2">
                        {proofs.slice(0, 6).map((proof) => {
                          const approved = !!proof.customer_approved_at || proof.status === "approved";
                          const revisionRequested = proof.status === "revision_requested";
                          const busy = proofBusy.has(proof.id);
                          const isRevising = proofRevisionId === proof.id;
                          return (
                            <div key={proof.id} className={cn("rounded-lg border bg-background/35 p-3", approved && "border-emerald-500/30 bg-emerald-500/5")}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Proof v{proof.revision_number || 1}</span>
                                    <Status value={proof.status || "pending"} />
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">Sent {date(proof.sent_at || proof.created_at)}</div>
                                  {proof.admin_comments && (
                                    <div className="mt-2 rounded border bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground">Note: </span>{proof.admin_comments}
                                    </div>
                                  )}
                                </div>
                                {proof.proof_url && (
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={proof.proof_url} target="_blank" rel="noreferrer">View proof</a>
                                  </Button>
                                )}
                              </div>
                              {!approved && !revisionRequested && (
                                <>
                                  {!isRevising ? (
                                    <div className="mt-3 flex gap-2">
                                      <Button
                                        size="sm"
                                        className="flex-1 gap-1.5"
                                        disabled={busy}
                                        onClick={() => respondToProof(proof.id, "approve")}
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {busy ? "Submitting..." : "Approve"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 gap-1.5"
                                        disabled={busy}
                                        onClick={() => { setProofRevisionId(proof.id); setProofRevisionText(""); }}
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Request revision
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="mt-3 space-y-2">
                                      <Textarea
                                        className="min-h-[64px] resize-none text-xs"
                                        placeholder="Describe what needs to change..."
                                        value={proofRevisionText}
                                        onChange={(e) => setProofRevisionText(e.target.value)}
                                        autoFocus
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          className="flex-1"
                                          disabled={busy || !proofRevisionText.trim()}
                                          onClick={() => respondToProof(proof.id, "revision", proofRevisionText)}
                                        >
                                          {busy ? "Submitting..." : "Submit revision request"}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setProofRevisionId(null)}>
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                              {approved && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Approved {proof.customer_approved_at ? date(proof.customer_approved_at) : ""}
                                </div>
                              )}
                              {revisionRequested && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Revision requested{proof.customer_comments ? `: "${proof.customer_comments}"` : ""}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty text="No proofs sent yet. Proofs will appear here once your order is in the artwork review stage." />
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploaded files</div>
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" disabled={artworkUploading} asChild>
                        <label className="cursor-pointer">
                          <Upload className="h-3.5 w-3.5" />{artworkUploading ? "Uploading..." : "Upload artwork"}
                          <input type="file" className="hidden" accept="image/*,.pdf,.ai,.eps,.psd,.svg" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArtwork(f); }} />
                        </label>
                      </Button>
                    </div>
                    {artwork.length > 0 ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {artwork.slice(0, 6).map((file) => {
                          const linkedOrder = file.order_id ? orders.find((o) => o.id === file.order_id) : null;
                          return (
                            <div key={file.id} className="flex items-start gap-3 rounded-lg border bg-background/35 p-3">
                              {file.thumbnail_url ? (
                                <img src={file.thumbnail_url} alt="" className="h-10 w-10 shrink-0 rounded-md border object-cover" />
                              ) : (
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border bg-muted">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{file.filename}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                  <Status value={file.review_status || "pending"} />
                                  {file.mime_type && <span className="text-[11px] text-muted-foreground">{file.mime_type.split("/")[1]?.toUpperCase()}</span>}
                                  {file.file_size_bytes != null && (
                                    <span className="text-[11px] text-muted-foreground">{(file.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                                  )}
                                  {file.proof_version != null && <span className="text-[11px] text-muted-foreground">v{file.proof_version}</span>}
                                  {linkedOrder && <span className="text-[11px] text-muted-foreground">Order #{linkedOrder.order_number || linkedOrder.id.slice(0, 8)}</span>}
                                </div>
                                {file.admin_comments && (
                                  <div className="mt-1.5 rounded border bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">
                                    <span className="font-medium text-foreground">Design team: </span>{file.admin_comments}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty text="No artwork files yet. Use the upload button above to submit artwork for your order." />
                    )}
                    <div className="mt-3 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">File requirements: </span>
                      Accepted: PDF, AI, EPS, PSD, SVG, PNG, JPEG · Min 300 DPI for print · Max 50 MB · CMYK color mode preferred
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Design tools</CardTitle><CardDescription>Start from the online designer and bring work into orders, proofs, and production.</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  <MiniRow title="Online designer" detail="Create cards, hats, stickers, signage, and apparel designs." value="Open" href="/designer.html" />
                  <MiniRow title="Proof workflow" detail="Saved designs can later become proof requests." value="Next" />
                  <MiniRow title="Checkout handoff" detail="Order this design will connect drafts to order items." value="Planned" />
                </CardContent>
              </Card>
            </section>

            <section id="bookings" className="mb-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" /> Bookings</CardTitle>
                      <CardDescription>Your scheduled appointments with the Ctrl+P team.</CardDescription>
                    </div>
                    <Button size="sm" asChild><a href="/book">Book appointment</a></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {bookings.length === 0 ? (
                    <Empty text="No appointments in the last 30 days. Use the button above to schedule time with us." />
                  ) : (
                    <div className="space-y-4">
                      {upcomingBookings.length > 0 && (
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</div>
                          <div className="space-y-2">
                            {upcomingBookings.map((booking) => (
                              <div key={booking.id} className="flex items-start justify-between gap-3 rounded-lg border bg-background/35 p-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{booking.title || "Appointment"}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">{dateTime(booking.start_time)}</div>
                                  {booking.notes && <div className="mt-1.5 text-xs text-muted-foreground">{booking.notes}</div>}
                                </div>
                                <Status value={booking.status || "scheduled"} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {pastBookings.length > 0 && (
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent past</div>
                          <div className="space-y-2">
                            {pastBookings.slice(0, 3).map((booking) => (
                              <div key={booking.id} className="flex items-start justify-between gap-3 rounded-lg border bg-background/35 p-3 opacity-70">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{booking.title || "Appointment"}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">{dateTime(booking.start_time)}</div>
                                </div>
                                <Status value={booking.status || "completed"} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section id="messages" className="mb-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4 text-primary" /> Messages</CardTitle>
                      <CardDescription>Your conversation history with the Ctrl+P team.</CardDescription>
                    </div>
                    <Button size="sm" variant={composeOpen ? "outline" : "default"} onClick={() => { setComposeOpen((v) => !v); if (composeOpen) { setComposeOrderId(null); setComposeSubject(""); setComposeBody(""); } }}>
                      {composeOpen ? "Cancel" : <><Send className="h-3.5 w-3.5" /> New message</>}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {composeOpen && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      {orders.length > 0 && (
                        <Select value={composeOrderId ?? "none"} onValueChange={(v) => setComposeOrderId(v === "none" ? null : v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Link to an order (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No order linked</SelectItem>
                            {orders.slice(0, 30).map((o) => (
                              <SelectItem key={o.id} value={o.id}>Order #{o.order_number || o.id.slice(0, 8)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <input
                        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
                        placeholder="Subject (optional)"
                        value={composeSubject}
                        onChange={(e) => setComposeSubject(e.target.value)}
                      />
                      <Textarea
                        className="min-h-[80px] resize-none text-sm"
                        placeholder="Write your message to the team..."
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); sendMessage(); } }}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Ctrl+Enter to send</span>
                        <Button size="sm" disabled={composeSending || !composeBody.trim()} onClick={sendMessage}>
                          {composeSending ? "Sending..." : <><Send className="h-3.5 w-3.5" /> Send</>}
                        </Button>
                      </div>
                    </div>
                  )}
                  {messages.length > 0 ? (
                    <div className="space-y-2">
                      {messages.slice(0, 20).map((msg) => {
                        const isOutbound = msg.direction === "outbound";
                        return (
                          <div key={msg.id} className={cn("rounded-lg border p-3", isOutbound ? "bg-background/35" : "border-primary/20 bg-primary/5")}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium">{msg.subject || (isOutbound ? "From Ctrl+P" : "Your message")}</span>
                                  <Badge variant="outline" className="text-[10px]">{human(msg.channel)}</Badge>
                                  {!isOutbound && <Badge className="border-primary/20 bg-primary/10 text-[10px] text-primary">Sent</Badge>}
                                  {msg.order_id && (() => { const o = orders.find((x) => x.id === msg.order_id); return o ? <Badge variant="outline" className="text-[10px]">Order #{o.order_number || o.id.slice(0, 8)}</Badge> : null; })()}
                                </div>
                                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{msg.body || "No message body."}</p>
                              </div>
                              {!msg.read_at && isOutbound && <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                            </div>
                            <div className="mt-2 text-[11px] text-muted-foreground">{dateTime(msg.sent_at || msg.created_at)}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty text="No messages yet. Send us a message using the button above." />
                  )}
                </CardContent>
              </Card>
            </section>

            <section id="invoices" className="mb-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4 text-primary" /> Invoices &amp; payments</CardTitle>
                  <CardDescription>Outstanding invoices and payment history for your orders.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {failedPayments.length > 0 && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div className="text-sm">
                        <div className="font-semibold text-red-600 dark:text-red-300">Failed payment{failedPayments.length > 1 ? "s" : ""}</div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{failedPayments.map((p) => `${p.invoice_number || "Invoice"} — ${amount(p.amount)}`).join(" · ")} · Please update your payment method or contact support.</p>
                      </div>
                    </div>
                  )}
                  {outstandingPayments.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding ({outstandingPayments.length})</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {outstandingPayments.map((payment) => (
                          <div key={payment.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{payment.invoice_number || `Invoice`}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {human(payment.method || payment.provider)} · {payment.currency?.toUpperCase() ?? "USD"}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold">{amount(payment.amount)}</div>
                                <Status value={payment.status} />
                              </div>
                            </div>
                            {payment.invoice_due_at && (
                              <div className="mt-2 text-xs text-muted-foreground">Due {date(payment.invoice_due_at)}</div>
                            )}
                            {payment.payment_link_url && (
                              <Button size="sm" className="mt-3 w-full" asChild>
                                <a href={payment.payment_link_url} target="_blank" rel="noreferrer">
                                  Pay now <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {paidPayments.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</div>
                      <div className="space-y-2">
                        {paidPayments.slice(0, 8).map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 px-3 py-2.5">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{payment.invoice_number || `Payment`}</div>
                              <div className="text-xs text-muted-foreground">
                                {human(payment.method || payment.provider)} · {date(payment.received_at || payment.created_at)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">{amount(payment.amount)}</span>
                              <Status value={payment.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!payments.length && <Empty text="No invoices or payments yet." />}
                </CardContent>
              </Card>
            </section>

            <section id="shipping" className="mb-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4 text-primary" /> Shipping</CardTitle>
                      <CardDescription>Tracking and delivery status for all shipments on your orders.</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => { setComposeOpen(true); setComposeSubject("Shipping issue"); }}>
                      <MessageSquare className="h-3.5 w-3.5" />Report issue
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-background/35 p-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Shipping contact</div>
                    <div className="grid gap-1 text-sm md:grid-cols-2">
                      <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{data.profile.email || "No email on file"}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{data.profile.phone || "No phone on file"}</span></div>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">To update your shipping address or contact details, visit <a href="/dashboard/customer/profile" className="text-primary hover:underline">your profile</a>.</p>
                  </div>
                  {shipments.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {shipments.map((shipment) => {
                        const delivered = shipment.status === "delivered" || !!shipment.delivered_at;
                        return (
                          <div key={shipment.id} className={cn("rounded-lg border p-4", delivered && "border-emerald-500/30 bg-emerald-500/5")}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium">{human(shipment.carrier)}</div>
                                {shipment.tracking_number && (
                                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">{shipment.tracking_number}</div>
                                )}
                              </div>
                              <Status value={shipment.status || "pending"} />
                            </div>
                            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                              {shipment.shipped_at && (
                                <div className="flex justify-between"><span>Shipped</span><span className="text-foreground">{date(shipment.shipped_at)}</span></div>
                              )}
                              {shipment.estimated_delivery_at && !delivered && (
                                <div className="flex justify-between"><span>Est. delivery</span><span className="text-foreground">{date(shipment.estimated_delivery_at)}</span></div>
                              )}
                              {shipment.delivered_at && (
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Delivered</span><span>{date(shipment.delivered_at)}</span></div>
                              )}
                            </div>
                            {shipment.tracking_url && (
                              <a
                                href={shipment.tracking_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                              >
                                Track shipment <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty text="No shipments yet. Tracking information will appear here once your order ships." />
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function Status({ value }: { value: string }) {
  return <Badge className={`border ${statusTone(value)}`}>{human(value)}</Badge>;
}

function ContactRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3 text-sm"><div className="flex items-center gap-2 text-muted-foreground">{icon}<span>{label}</span></div><div className="font-medium">{value}</div></div>;
}

function MiniRow({ title, detail, value, href }: { title: string; detail: string; value: string; href?: string }) {
  const content = <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-background/35 p-3 text-sm hover:bg-accent/40"><div className="min-w-0"><div className="truncate font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge variant="outline">{value}</Badge></div>;
  return href ? <a href={href} target="_blank" rel="noreferrer">{content}</a> : content;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{text}</div>;
}
