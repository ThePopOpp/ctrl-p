"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  Phone,
  Video,
  MapPin,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import {
  CustomerShell,
  CustomerBooking,
  EmptyState,
  StatusBadge,
  fmtDateTime,
  useCustomerSession,
} from "@/components/dashboard/customer-shell";

// ─── Types ───────────────────────────────────────────────────────────────────

type AvailabilitySlot = { start: string; end: string; label: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function locationLabel(booking: CustomerBooking): string {
  const type = booking.location_type || "";
  const map: Record<string, string> = {
    video_meeting: "Video meeting",
    phone_call: "Phone call",
    in_person: "In person",
    onsite_installation: "On-site installation",
    vehicle_dropoff: "Vehicle drop-off",
    pickup: "Pick-up",
    delivery: "Delivery",
    custom_location: "Custom location",
  };
  return map[type] || type.replace(/_/g, " ");
}

function LocationIcon({ type }: { type: string | null }) {
  if (type === "video_meeting") return <Video className="h-3.5 w-3.5 shrink-0" />;
  if (type === "phone_call") return <Phone className="h-3.5 w-3.5 shrink-0" />;
  return <MapPin className="h-3.5 w-3.5 shrink-0" />;
}

function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildGoogleCalUrl(booking: CustomerBooking): string {
  const start = booking.start_time.replace(/[:\-]/g, "").replace(/\.\d{3}/, "");
  const end = (booking.end_time || booking.start_time).replace(/[:\-]/g, "").replace(/\.\d{3}/, "");
  const name = booking.booking_appointment_types?.name || booking.title || "Appointment";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${name} with ControlP.io`,
    dates: `${start}/${end}`,
    location: booking.meeting_url || locationLabel(booking),
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(booking: CustomerBooking): string {
  const name = booking.booking_appointment_types?.name || booking.title || "Appointment";
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `${name} with ControlP.io`,
    startdt: booking.start_time,
    enddt: booking.end_time || booking.start_time,
    location: booking.meeting_url || locationLabel(booking),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// ─── Reschedule Dialog ───────────────────────────────────────────────────────

function RescheduleDialog({
  booking,
  open,
  onClose,
  onConfirm,
}: {
  booking: CustomerBooking | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (newStart: string, reason: string) => Promise<void>;
}) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedDate(null);
      setSlots([]);
      setSelectedSlot(null);
      setReason("");
      setSlotsError("");
    }
  }, [open]);

  // Fetch slots when date selected
  useEffect(() => {
    if (!selectedDate || !booking?.appointment_type_id) return;
    const dateKey = toDateKey(selectedDate);
    setLoadingSlots(true);
    setSlotsError("");
    setSlots([]);
    setSelectedSlot(null);
    fetch(`/api/booking/availability?appointment_type_id=${encodeURIComponent(booking.appointment_type_id)}&date=${dateKey}`)
      .then((r) => r.json())
      .then((data: { slots?: AvailabilitySlot[]; error?: string }) => {
        if (data.error) { setSlotsError(data.error); return; }
        setSlots(data.slots ?? []);
        if (!data.slots?.length) setSlotsError("No available times on this day.");
      })
      .catch(() => setSlotsError("Could not load available times."))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, booking?.appointment_type_id]);

  async function submit() {
    if (!selectedSlot) return;
    setSaving(true);
    try {
      await onConfirm(selectedSlot, reason);
    } finally {
      setSaving(false);
    }
  }

  // Calendar rendering helpers
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 90);

  function prevMonth() {
    setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const monthLabel = calendarMonth.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>
            {booking ? (
              <>Current: <strong>{fmtDateTime(booking.start_time)}</strong></>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month calendar */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                disabled={calendarMonth <= new Date(today.getFullYear(), today.getMonth(), 1)}
                className="rounded p-1 hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">{monthLabel}</span>
              <button type="button" onClick={nextMonth} className="rounded p-1 hover:bg-muted">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="py-1 text-[10px] font-semibold text-muted-foreground">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, month, day);
                const dateKey = toDateKey(date);
                const isSelected = selectedDate ? toDateKey(selectedDate) === dateKey : false;
                const isPast = date < new Date(toDateKey(today) + "T00:00:00");
                const isFuture = date > maxDate;
                const disabled = isPast || isFuture;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedDate(date)}
                    className={`rounded py-1.5 text-xs transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : disabled
                        ? "cursor-not-allowed text-muted-foreground/40"
                        : "hover:bg-muted"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Available times —{" "}
                {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              {loadingSlots ? (
                <div className="py-4 text-center text-xs text-muted-foreground">Loading times…</div>
              ) : slotsError ? (
                <div className="rounded-md bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">{slotsError}</div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`rounded-md border py-2 text-xs font-medium transition-colors ${
                        selectedSlot === slot.start
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/60 hover:bg-muted"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          {selectedSlot && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Reason for rescheduling <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Let us know if there's anything we should be aware of…"
                className="h-20 resize-none text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={!selectedSlot || saving}>
            {saving ? "Rescheduling…" : "Confirm reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Booking card ────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onCancel,
  onReschedule,
}: {
  booking: CustomerBooking;
  onCancel: (id: string) => void;
  onReschedule: (booking: CustomerBooking) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUpcoming = new Date(booking.start_time) >= new Date();
  const isCanceled = ["canceled", "completed", "no_show"].includes(booking.status || "");
  const typeName = booking.booking_appointment_types?.name || null;

  const messageHref = `/dashboard/customer/messages?subject=${encodeURIComponent(
    `Re: ${typeName || booking.title || "Appointment"} on ${new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(booking.start_time))}`
  )}&body=${encodeURIComponent(
    `Hi, I have a question about my ${typeName || "appointment"} scheduled for ${fmtDateTime(booking.start_time)}.`
  )}`;

  return (
    <div className={`rounded-lg border bg-background/35 transition-all ${isCanceled ? "opacity-60" : ""}`}>
      {/* Summary row */}
      <button
        type="button"
        className="flex w-full items-start gap-3 p-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{booking.title || typeName || "Appointment"}</span>
            <StatusBadge value={booking.status || "scheduled"} />
          </div>
          {typeName && booking.title && typeName !== booking.title && (
            <div className="mt-0.5 text-xs text-muted-foreground">{typeName}</div>
          )}
          <div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(booking.start_time)}</div>
        </div>
        {expanded ? (
          <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-3">
          {/* Location / meeting link */}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <LocationIcon type={booking.location_type} />
            <span>
              {locationLabel(booking)}
              {booking.meeting_url && (
                <>
                  {" — "}
                  <a
                    href={booking.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
                  >
                    Join meeting <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </span>
          </div>

          {/* Customer notes */}
          {booking.customer_notes && (
            <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Your notes: </span>
              {booking.customer_notes}
            </div>
          )}

          {/* Cancellation reason */}
          {booking.cancellation_reason && (
            <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{booking.cancellation_reason}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <a href={messageHref}>
                <MessageSquare className="h-3.5 w-3.5" /> Message team
              </a>
            </Button>

            {isUpcoming && !isCanceled && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <a href={buildGoogleCalUrl(booking)} target="_blank" rel="noopener noreferrer">
                    <CalendarPlus className="h-3.5 w-3.5" /> Google
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <a href={buildOutlookUrl(booking)} target="_blank" rel="noopener noreferrer">
                    <CalendarPlus className="h-3.5 w-3.5" /> Outlook
                  </a>
                </Button>
                {booking.appointment_type_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onReschedule(booking)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reschedule
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
                  onClick={() => onCancel(booking.id)}
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CustomerBookings() {
  const { data, state, errorMessage, theme, setTheme, messages, setMessages, bookings, setBookings, getToken, signOut } =
    useCustomerSession();
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  // Cancel state
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  // Reschedule state
  const [rescheduleBooking, setRescheduleBooking] = useState<CustomerBooking | null>(null);

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

  async function handleCancel() {
    if (!cancelId) return;
    setCanceling(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/dashboard/customer/bookings/${cancelId}/cancel`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        alert(payload.error || "Could not cancel this appointment.");
        return;
      }
      setBookings((prev) => prev.map((b) => (b.id === cancelId ? { ...b, status: "canceled" } : b)));
      setCancelId(null);
    } finally {
      setCanceling(false);
    }
  }

  async function handleReschedule(newStart: string, reason: string) {
    if (!rescheduleBooking) return;
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`/api/dashboard/customer/bookings/${rescheduleBooking.id}/reschedule`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ new_start_time: newStart, reason: reason || undefined }),
    });
    const payload = await res.json().catch(() => ({})) as { appointment?: { start_time: string; end_time: string; status: string }; error?: string };
    if (!res.ok) {
      alert(payload.error || "Could not reschedule this appointment.");
      return;
    }
    if (payload.appointment) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === rescheduleBooking.id
            ? { ...b, start_time: payload.appointment!.start_time, end_time: payload.appointment!.end_time, status: payload.appointment!.status }
            : b
        )
      );
    }
    setRescheduleBooking(null);
  }

  const upcomingBookings = bookings.filter((b) => new Date(b.start_time) >= new Date());
  const pastBookings = bookings.filter((b) => new Date(b.start_time) < new Date());
  const unreadMessages = messages.filter((m) => !m.read_at && m.direction === "outbound");
  const cancelTarget = bookings.find((b) => b.id === cancelId);

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
              <div className="space-y-5">
                {upcomingBookings.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</div>
                    <div className="space-y-2">
                      {upcomingBookings.map((booking) => (
                        <BookingCard key={booking.id} booking={booking} onCancel={setCancelId} onReschedule={setRescheduleBooking} />
                      ))}
                    </div>
                  </div>
                )}
                {pastBookings.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past appointments</div>
                    <div className="space-y-2">
                      {pastBookings.map((booking) => (
                        <BookingCard key={booking.id} booking={booking} onCancel={setCancelId} onReschedule={setRescheduleBooking} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelId} onOpenChange={(open) => { if (!open) setCancelId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel appointment?</DialogTitle>
            <DialogDescription>
              {cancelTarget ? (
                <>
                  <strong>{cancelTarget.booking_appointment_types?.name || cancelTarget.title || "Appointment"}</strong>
                  {" on "}
                  {fmtDateTime(cancelTarget.start_time)}
                </>
              ) : "This appointment"}{" "}
              will be marked as canceled. To reschedule instead, use the Reschedule button.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)} disabled={canceling}>Keep appointment</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={canceling}>
              {canceling ? "Canceling…" : "Yes, cancel it"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <RescheduleDialog
        booking={rescheduleBooking}
        open={!!rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        onConfirm={handleReschedule}
      />
    </CustomerShell>
  );
}
