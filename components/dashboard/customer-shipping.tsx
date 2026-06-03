"use client";

import { useRef, useState } from "react";
import { ExternalLink, Mail, MessageSquare, Phone, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import {
  CustomerShell,
  EmptyState,
  StatusBadge,
  fmtDate,
  human,
  useCustomerSession,
} from "@/components/dashboard/customer-shell";
import { cn } from "@/lib/utils";

export function CustomerShipping() {
  const { data, state, errorMessage, theme, setTheme, messages, setMessages, bookings, getToken, signOut } = useCustomerSession();
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);

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

  const shipments = data?.shipments ?? [];
  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const unreadMessages = messages.filter((m) => !m.read_at && m.direction === "outbound");

  function reportIssue() {
    window.location.href = "/dashboard/customer/messages?subject=Shipping+issue";
  }

  return (
    <CustomerShell
      profile={data?.profile}
      unreadCount={unreadMessages.length}
      upcomingBookingsCount={upcomingBookings.length}
      theme={theme}
      onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
      onSignOut={signOut}
      activePage="Shipping"
      state={state}
      errorMessage={errorMessage}
      messages={messages}
      onOpenNotifications={openNotifications}
      notifOpen={notifOpen}
      notifRef={notifRef}
      onCloseNotif={() => setNotifOpen(false)}
    >
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4 text-primary" />Shipping
                </CardTitle>
                <CardDescription>Tracking and delivery status for all shipments on your orders.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={reportIssue}>
                <MessageSquare className="h-3.5 w-3.5" />Report issue
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-background/35 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Shipping contact</div>
              <div className="grid gap-1 text-sm md:grid-cols-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{data.profile.email || "No email on file"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{data.profile.phone || "No phone on file"}</span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                To update your shipping address or contact details, visit{" "}
                <a href="/dashboard/customer/profile" className="text-primary hover:underline">your profile</a>.
              </p>
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
                        <StatusBadge value={shipment.status || "pending"} />
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {shipment.shipped_at && (
                          <div className="flex justify-between"><span>Shipped</span><span className="text-foreground">{fmtDate(shipment.shipped_at)}</span></div>
                        )}
                        {shipment.estimated_delivery_at && !delivered && (
                          <div className="flex justify-between"><span>Est. delivery</span><span className="text-foreground">{fmtDate(shipment.estimated_delivery_at)}</span></div>
                        )}
                        {shipment.delivered_at && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span>Delivered</span><span>{fmtDate(shipment.delivered_at)}</span>
                          </div>
                        )}
                      </div>
                      {shipment.tracking_url && (
                        <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                          Track shipment <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No shipments yet. Tracking information will appear here once your order ships." />
            )}
          </CardContent>
        </Card>
      )}
    </CustomerShell>
  );
}
