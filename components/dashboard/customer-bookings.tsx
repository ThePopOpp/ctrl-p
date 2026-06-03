"use client";

import { useRef, useState } from "react";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import {
  CustomerShell,
  EmptyState,
  StatusBadge,
  fmtDateTime,
  useCustomerSession,
} from "@/components/dashboard/customer-shell";

export function CustomerBookings() {
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

  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const pastBookings = bookings.filter((b) => new Date(b.start_time) < new Date());
  const unreadMessages = messages.filter((m) => !m.read_at && m.direction === "outbound");

  return (
    <CustomerShell
      profile={data?.profile}
      unreadCount={unreadMessages.length}
      upcomingBookingsCount={upcomingBookings.length}
      theme={theme}
      onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
      onSignOut={signOut}
      activePage="Bookings"
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
                  <CalendarClock className="h-4 w-4 text-primary" />Bookings
                </CardTitle>
                <CardDescription>Your scheduled appointments with the Ctrl+P team.</CardDescription>
              </div>
              <Button size="sm" asChild><a href="/book">Book appointment</a></Button>
            </div>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <EmptyState text="No appointments yet. Use the button above to schedule time with us." />
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
                            <div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(booking.start_time)}</div>
                            {booking.notes && <div className="mt-1.5 text-xs text-muted-foreground">{booking.notes}</div>}
                          </div>
                          <StatusBadge value={booking.status || "scheduled"} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {pastBookings.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past appointments</div>
                    <div className="space-y-2">
                      {pastBookings.map((booking) => (
                        <div key={booking.id} className="flex items-start justify-between gap-3 rounded-lg border bg-background/35 p-3 opacity-70">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{booking.title || "Appointment"}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(booking.start_time)}</div>
                          </div>
                          <StatusBadge value={booking.status || "completed"} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </CustomerShell>
  );
}
