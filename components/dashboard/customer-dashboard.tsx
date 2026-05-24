"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, Box, CreditCard, FileCheck2, Home, IdCard, LogOut, Mail, MessageSquare, Moon, PackageCheck, Phone, Search, Sun, Truck, type LucideIcon } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CustomerProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company: string | null;
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
  due_at: string | null;
  created_at: string | null;
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
  created_at: string | null;
};

type CustomerArtwork = {
  id: string;
  order_id: string | null;
  filename: string;
  review_status?: string | null;
  proof_version?: number | null;
  admin_comments?: string | null;
  customer_comments?: string | null;
  created_at: string | null;
};

type CustomerProof = {
  id: string;
  order_item_id: string;
  proof_url: string | null;
  revision_number: number | null;
  status?: string | null;
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
  estimated_delivery_at: string | null;
  delivered_at: string | null;
};

type CustomerData = {
  profile: CustomerProfile;
  orders: CustomerOrder[];
  payments: CustomerPayment[];
  messages: CustomerMessage[];
  artworkFiles: CustomerArtwork[];
  proofs: CustomerProof[];
  shipments: CustomerShipment[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const navItems: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Overview", icon: Home, href: "#overview" },
  { label: "Orders", icon: Box, href: "#orders" },
  { label: "Invoices", icon: CreditCard, href: "#invoices" },
  { label: "Artwork", icon: FileCheck2, href: "#artwork" },
  { label: "Manage Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Messages", icon: MessageSquare, href: "#messages" },
  { label: "Shipping", icon: Truck, href: "#shipping" },
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

function statusTone(value: string | null | undefined) {
  const status = String(value || "");
  if (["paid", "approved", "completed", "delivered"].includes(status)) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["failed", "cancelled", "rejected", "refunded"].includes(status)) return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-primary/20 bg-primary/15 text-lime-800 dark:text-lime-200";
}

export function CustomerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<CustomerData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("controlp_customer_theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    async function load() {
      const db = getSupabaseBrowserClient();
      const session = db ? (await db.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        router.replace("/login?redirect=/dashboard/customer");
        return;
      }

      const response = await fetch("/api/dashboard/customer", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not load customer dashboard.");
        setState("denied");
        return;
      }
      setData(payload as CustomerData);
      setState("ready");
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

  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const artwork = data?.artworkFiles ?? [];
  const proofs = data?.proofs ?? [];
  const shipments = data?.shipments ?? [];
  const openOrders = orders.filter((order) => !["completed", "delivered", "cancelled", "refunded"].includes(order.status));
  const unpaidPayments = payments.filter((payment) => !["paid", "refunded"].includes(payment.status));
  const proofQueue = proofs.filter((proof) => !proof.customer_approved_at && !["approved", "rejected"].includes(String(proof.status || "")));
  const unreadMessages = messages.filter((item) => !item.read_at && item.direction === "outbound");
  const visibleOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => !needle || [order.order_number, order.status, order.production_status, order.payment_status].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [orders, query]);

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
            </a>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
        <div className="flex h-12 items-center gap-3 px-5">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">Dashboard</span></div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden w-[360px] md:block">
              <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
              <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search orders, status, invoices..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Notifications"><Bell className="h-4 w-4" /></Button>
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
                <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Track orders, invoices, proofs, messages, and shipping from one customer workspace.</p>
              </div>
              <div className="flex gap-2">
                <Button asChild><a href="mailto:hello@controlp.io">Message support</a></Button>
                <Button variant="outline" asChild><a href="/">Browse products</a></Button>
              </div>
            </section>

            <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Stat label="Open orders" value={String(openOrders.length)} hint={`${orders.length} total orders`} />
              <Stat label="Payment due" value={String(unpaidPayments.length)} hint={amount(unpaidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))} />
              <Stat label="Proofs" value={String(proofQueue.length)} hint="Awaiting review" />
              <Stat label="Shipments" value={String(shipments.length)} hint="Tracking records" />
              <Stat label="Unread" value={String(unreadMessages.length)} hint="Dashboard messages" />
            </section>

            <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card id="orders">
                <CardHeader className="pb-3"><CardTitle className="text-base">Orders</CardTitle><CardDescription>Bird&apos;s-eye view of current and past order activity.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="pl-4">Order</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead><TableHead>Production</TableHead><TableHead>Due</TableHead><TableHead className="pr-4 text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>{visibleOrders.map((order) => <TableRow key={order.id}><TableCell className="pl-4 font-mono text-xs">#{order.order_number || order.id.slice(0, 8)}</TableCell><TableCell><Status value={order.status} /></TableCell><TableCell><Status value={order.payment_status} /></TableCell><TableCell>{human(order.production_status)}</TableCell><TableCell>{date(order.due_at)}</TableCell><TableCell className="pr-4 text-right font-semibold">{amount(order.total)}</TableCell></TableRow>)}{!visibleOrders.length && <TableRow><TableCell colSpan={6} className="p-6 text-center text-muted-foreground">No orders found.</TableCell></TableRow>}</TableBody>
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
                <Card id="messages">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Recent messages</CardTitle></CardHeader>
                  <CardContent className="space-y-2">{messages.slice(0, 5).map((item) => <MiniRow key={item.id} title={item.subject || human(item.channel)} detail={item.body || "No message body"} value={human(item.channel)} />)}{!messages.length && <Empty text="No messages yet." />}</CardContent>
                </Card>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <Card id="invoices"><CardHeader className="pb-3"><CardTitle className="text-base">Invoices and payments</CardTitle></CardHeader><CardContent className="space-y-2">{payments.slice(0, 6).map((payment) => <MiniRow key={payment.id} title={payment.invoice_number || human(payment.provider)} detail={`${human(payment.method)} - ${date(payment.created_at)}`} value={amount(payment.amount)} href={payment.payment_link_url || undefined} />)}{!payments.length && <Empty text="No invoices or payments yet." />}</CardContent></Card>
              <Card id="artwork"><CardHeader className="pb-3"><CardTitle className="text-base">Artwork and proofs</CardTitle></CardHeader><CardContent className="space-y-2">{proofs.slice(0, 3).map((proof) => <MiniRow key={proof.id} title={`Proof v${proof.revision_number || 1}`} detail={`${human(proof.status)} - ${date(proof.sent_at || proof.created_at)}`} value={proof.customer_approved_at ? "Approved" : "Review"} href={proof.proof_url || undefined} />)}{artwork.slice(0, 3).map((file) => <MiniRow key={file.id} title={file.filename} detail={human(file.review_status)} value={`v${file.proof_version || 0}`} />)}{!proofs.length && !artwork.length && <Empty text="No artwork or proofs yet." />}</CardContent></Card>
              <Card id="shipping"><CardHeader className="pb-3"><CardTitle className="text-base">Shipping</CardTitle></CardHeader><CardContent className="space-y-2">{shipments.slice(0, 6).map((shipment) => <MiniRow key={shipment.id} title={`${human(shipment.carrier)} ${shipment.tracking_number || ""}`} detail={`${human(shipment.status)} - ETA ${date(shipment.estimated_delivery_at)}`} value="Track" href={shipment.tracking_url || undefined} />)}{!shipments.length && <Empty text="No shipments yet." />}</CardContent></Card>
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
