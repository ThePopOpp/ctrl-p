"use client";

import { useEffect, useRef, useState } from "react";
import { Box, CalendarClock, CreditCard, ExternalLink, FileCheck2, MessageSquare, Truck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  CustomerShell,
  EmptyState,
  StatusBadge,
  fmtDate,
  fmtDateTime,
  human,
  amount,
  useCustomerSession,
} from "@/components/dashboard/customer-shell";

export function CustomerDashboard() {
  const { data, state, errorMessage, theme, setTheme, messages, setMessages, bookings, getToken, signOut } = useCustomerSession();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  async function openNotifications() {
    setNotifOpen((o) => !o);
    const unread = messages.filter((m) => !m.read_at && m.direction === "outbound");
    if (!unread.length) return;
    setMessages((prev) => prev.map((m) => (!m.read_at && m.direction === "outbound" ? { ...m, read_at: new Date().toISOString() } : m)));
    const token = await getToken();
    if (!token) return;
    await fetch("/api/dashboard/customer/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: unread.map((m) => m.id) }),
    }).catch(() => null);
  }

  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const proofs = data?.proofs ?? [];
  const shipments = data?.shipments ?? [];
  const designDrafts = data?.designDrafts ?? [];

  const openOrders = orders.filter((o) => !["completed", "delivered", "cancelled", "refunded"].includes(o.status));
  const unpaidPayments = payments.filter((p) => !["paid", "refunded"].includes(p.status));
  const proofQueue = proofs.filter((p) => !p.customer_approved_at && !["approved", "rejected"].includes(String(p.status || "")));
  const unreadMessages = messages.filter((m) => !m.read_at && m.direction === "outbound");
  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const activeShipments = shipments.filter((s) => !["delivered", "cancelled"].includes(String(s.status || "")));
  const outstandingPayments = payments.filter((p) => !["paid", "refunded", "canceled", "failed"].includes(String(p.status ?? "")));

  return (
    <CustomerShell
      profile={data?.profile}
      unreadCount={unreadMessages.length}
      upcomingBookingsCount={upcomingBookings.length}
      theme={theme}
      onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
      onSignOut={signOut}
      activePage="Overview"
      state={state}
      errorMessage={errorMessage}
      messages={messages}
      onOpenNotifications={openNotifications}
      notifOpen={notifOpen}
      notifRef={notifRef}
      onCloseNotif={() => setNotifOpen(false)}
    >
      {data && (
        <>
          <section className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight">
                Welcome back{data.profile.full_name ? `, ${data.profile.full_name.split(" ")[0]}` : ""}
              </h1>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Track orders, invoices, proofs, bookings, and shipping from one workspace.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild><a href="/dashboard/customer/messages">Message support</a></Button>
              <Button variant="outline" asChild><a href="/">Browse products</a></Button>
            </div>
          </section>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Open orders" value={String(openOrders.length)} hint={`${orders.length} total`} href="/dashboard/customer/orders" />
            <StatCard label="Payment due" value={String(unpaidPayments.length)} hint={amount(unpaidPayments.reduce((s, p) => s + Number(p.amount || 0), 0))} href="/dashboard/customer/invoices" />
            <StatCard label="Proofs" value={String(proofQueue.length)} hint="Awaiting review" href="/dashboard/customer/artwork" />
            <StatCard label="Designs" value={String(designDrafts.length)} hint="Saved drafts" href="/dashboard/customer/artwork" />
            <StatCard label="Bookings" value={String(upcomingBookings.length)} hint="Upcoming" href="/dashboard/customer/bookings" />
            <StatCard label="Unread" value={String(unreadMessages.length)} hint="New messages" href="/dashboard/customer/messages" />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <PreviewHeader icon={<Box className="h-4 w-4 text-primary" />} title="Recent orders" href="/dashboard/customer/orders" />
              <CardContent className="space-y-2">
                {orders.slice(0, 4).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono font-medium">#{order.order_number || order.id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={order.status} />
                      <span className="shrink-0 font-semibold">{amount(order.total)}</span>
                    </div>
                  </div>
                ))}
                {!orders.length && <EmptyState text="No orders yet." />}
              </CardContent>
            </Card>

            <Card>
              <PreviewHeader icon={<CreditCard className="h-4 w-4 text-primary" />} title="Outstanding invoices" href="/dashboard/customer/invoices" />
              <CardContent className="space-y-2">
                {outstandingPayments.slice(0, 4).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{payment.invoice_number || "Invoice"}</div>
                      <div className="text-xs text-muted-foreground">Due {fmtDate(payment.invoice_due_at)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold">{amount(payment.amount)}</span>
                      {payment.payment_link_url && (
                        <Button size="sm" className="h-7 text-xs" asChild>
                          <a href={payment.payment_link_url} target="_blank" rel="noreferrer">Pay <ExternalLink className="ml-1 h-3 w-3" /></a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!outstandingPayments.length && <EmptyState text="No outstanding invoices." />}
              </CardContent>
            </Card>

            <Card>
              <PreviewHeader icon={<MessageSquare className="h-4 w-4 text-primary" />} title="Recent messages" href="/dashboard/customer/messages" />
              <CardContent className="space-y-2">
                {messages.slice(0, 4).map((msg) => (
                  <div key={msg.id} className={cn("rounded-lg border bg-background/35 p-3 text-sm", !msg.read_at && msg.direction === "outbound" && "border-primary/20 bg-primary/5")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{msg.subject || (msg.direction === "outbound" ? "From Ctrl+P" : "Your message")}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{msg.body || "No body."}</div>
                      </div>
                      {!msg.read_at && msg.direction === "outbound" && <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{fmtDate(msg.created_at)}</div>
                  </div>
                ))}
                {!messages.length && <EmptyState text="No messages yet." />}
              </CardContent>
            </Card>

            <Card>
              <PreviewHeader icon={<CalendarClock className="h-4 w-4 text-primary" />} title="Upcoming bookings" href="/dashboard/customer/bookings" />
              <CardContent className="space-y-2">
                {upcomingBookings.slice(0, 4).map((booking) => (
                  <div key={booking.id} className="flex items-start justify-between gap-3 rounded-lg border bg-background/35 p-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{booking.title || "Appointment"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(booking.start_time)}</div>
                    </div>
                    <StatusBadge value={booking.status || "scheduled"} />
                  </div>
                ))}
                {!upcomingBookings.length && <EmptyState text="No upcoming appointments." />}
                <a href="/book" className="block pt-1 text-center text-xs text-primary hover:underline">Book an appointment →</a>
              </CardContent>
            </Card>

            <Card>
              <PreviewHeader icon={<Truck className="h-4 w-4 text-primary" />} title="Active shipments" href="/dashboard/customer/shipping" />
              <CardContent className="space-y-2">
                {activeShipments.slice(0, 4).map((shipment) => (
                  <div key={shipment.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{human(shipment.carrier)}</div>
                      {shipment.tracking_number && <div className="font-mono text-xs text-muted-foreground">{shipment.tracking_number}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge value={shipment.status || "pending"} />
                      {shipment.tracking_url && (
                        <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="text-primary">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {!activeShipments.length && <EmptyState text="No active shipments." />}
              </CardContent>
            </Card>

            <Card>
              <PreviewHeader icon={<FileCheck2 className="h-4 w-4 text-primary" />} title="Proof queue" href="/dashboard/customer/artwork" />
              <CardContent className="space-y-2">
                {proofQueue.slice(0, 4).map((proof) => (
                  <div key={proof.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">Proof v{proof.revision_number || 1}</div>
                      <div className="text-xs text-muted-foreground">Sent {fmtDate(proof.sent_at || proof.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">Review needed</Badge>
                      {proof.proof_url && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                          <a href={proof.proof_url} target="_blank" rel="noreferrer">View</a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!proofQueue.length && <EmptyState text="No proofs awaiting review." />}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </CustomerShell>
  );
}

function StatCard({ label, value, hint, href }: { label: string; value: string; hint: string; href: string }) {
  return (
    <a href={href} className="block">
      <Card className="transition-colors hover:border-primary/30">
        <CardContent className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 text-[22px] font-semibold leading-none">{value}</div>
          <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
        </CardContent>
      </Card>
    </a>
  );
}

function PreviewHeader({ icon, title, href }: { icon: React.ReactNode; title: string; href: string }) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
        <a href={href} className="text-xs text-primary hover:underline">View all →</a>
      </div>
    </CardHeader>
  );
}
