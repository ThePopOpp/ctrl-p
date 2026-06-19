"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Loader2, User, X } from "lucide-react";

import { useCart } from "@/lib/cart/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Designer = {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  avatar_url: string | null;
  hourly_rate: number;
  specialties: string[];
  weekly_schedule: Record<string, { enabled: boolean; start: string; end: string }>;
};

type Slot = { start: string; end: string; label: string };

// ─── Session packages ─────────────────────────────────────────────────────────

const PACKAGES = [
  {
    hours: 1,
    name: "Quick Session",
    description: "Layout tweaks, text changes, quick adjustments to existing artwork.",
    popular: false,
  },
  {
    hours: 2,
    name: "Design Session",
    description: "Full design creation — from concept through to a print-ready file.",
    popular: true,
  },
  {
    hours: 4,
    name: "Half-Day Build",
    description: "Complete brand suite, vehicle wrap concept, or multiple deliverables.",
    popular: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TZ = "America/Phoenix";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function todayPhoenix() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function longDateLabel(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${dateStr}T12:00:00`));
}

function shortDateLabel(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateStr}T12:00:00`));
}

function timeLabel(isoStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoStr));
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center mb-1">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            s === step ? "w-5 bg-primary" : s < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
          )}
        />
      ))}
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function MiniCalendar({
  year,
  month,
  selected,
  today,
  onSelect,
  onPrev,
  onNext,
  unavailableDays,
}: {
  year: number;
  month: number;
  selected: string | null;
  today: string;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  unavailableDays: Set<number>; // 0=Sun … 6=Sat
}) {
  const firstDay = firstDayOfMonth(year, month);
  const totalDays = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onPrev} className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{monthLabel(year, month)}</span>
        <button onClick={onNext} className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium text-muted-foreground mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const key = dateKey(year, month, day);
          const isPast = key < today;
          const isUnavailable = unavailableDays.has(new Date(`${key}T12:00:00`).getDay());
          const isDisabled = isPast || isUnavailable;
          const isSelected = key === selected;

          return (
            <button
              key={i}
              disabled={isDisabled}
              onClick={() => onSelect(key)}
              className={cn(
                "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors",
                isSelected && "bg-primary text-primary-foreground font-semibold",
                !isSelected && !isDisabled && "hover:bg-accent",
                isDisabled && "text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function DesignerBookingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addItem } = useCart();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedHours, setSelectedHours] = useState<number | null>(null);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loadingDesigners, setLoadingDesigners] = useState(false);
  const [selectedDesigner, setSelectedDesigner] = useState<Designer | null>(null);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const today = todayPhoenix();

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setSelectedHours(null);
        setSelectedDesigner(null);
        setSelectedDate(null);
        setSelectedSlot(null);
        setSlots([]);
        setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", description: "" });
        setError("");
        setDone(false);
      }, 300);
    }
  }, [open]);

  // Load designers when entering step 2
  useEffect(() => {
    if (step === 2 && designers.length === 0) {
      setLoadingDesigners(true);
      fetch("/api/designers")
        .then((r) => r.json())
        .then((d) => setDesigners(d.designers ?? []))
        .catch(() => setDesigners([]))
        .finally(() => setLoadingDesigners(false));
    }
  }, [step, designers.length]);

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate || !selectedDesigner || !selectedHours) return;
    setSlots([]);
    setSelectedSlot(null);
    setLoadingSlots(true);
    fetch(`/api/designers/${selectedDesigner.id}/slots?date=${selectedDate}&hours=${selectedHours}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedDesigner, selectedHours]);

  // Days of week the designer doesn't work (for calendar greying)
  const unavailableDays = useMemo(() => {
    const KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const out = new Set<number>();
    if (!selectedDesigner) return out;
    KEYS.forEach((k, i) => {
      if (!selectedDesigner.weekly_schedule?.[k]?.enabled) out.add(i);
    });
    return out;
  }, [selectedDesigner]);

  const totalPrice = selectedHours && selectedDesigner
    ? selectedHours * Number(selectedDesigner.hourly_rate)
    : null;

  async function handleBook() {
    if (!selectedDesigner || !selectedSlot || !selectedHours) return;
    if (!form.firstName || !form.lastName || !form.email) {
      setError("First name, last name and email are required.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/designer-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designer_id: selectedDesigner.id,
          start_time: selectedSlot.start,
          duration_hours: selectedHours,
          customer_first_name: form.firstName,
          customer_last_name: form.lastName,
          customer_email: form.email,
          customer_phone: form.phone || null,
          company_name: form.company || null,
          project_description: form.description || null,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        setError(payload.error ?? "Booking failed. Please try again.");
        return;
      }

      const { booking } = payload;

      addItem({
        product_id: `designer-booking-${booking.id}`,
        name: `Design Session — ${selectedDesigner.name} · ${shortDateLabel(selectedDate!)} ${selectedSlot.label}`,
        sku: `DS-${selectedHours}HR`,
        unit_price: Number(booking.total_price),
        quantity: 1,
        image: selectedDesigner.avatar_url ?? null,
      });

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  // ── Overlay ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <StepDots step={step} />
            <h2 className="text-lg font-bold leading-tight">
              {done
                ? "You're booked!"
                : step === 1 ? "Book a designer session"
                : step === 2 ? "Choose your designer"
                : step === 3 ? "Pick a date & time"
                : "Your details"}
            </h2>
            {!done && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Step {step} of 4
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">

          {/* ── Done state ── */}
          {done && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15">
                <Check className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="font-semibold text-lg">Session added to cart</p>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">
                <strong>{selectedDesigner?.name}</strong> on{" "}
                <strong>{selectedDate ? longDateLabel(selectedDate) : ""}</strong> at{" "}
                <strong>{selectedSlot?.label}</strong> · {selectedHours}hr session ·{" "}
                <strong>{totalPrice !== null ? fmt(totalPrice) : ""}</strong>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Complete checkout to confirm your session. We'll email the details to{" "}
                <strong>{form.email}</strong>.
              </p>
              <Button className="mt-6 w-full" onClick={onClose}>
                Continue shopping
              </Button>
              <Button variant="outline" className="mt-2 w-full" asChild>
                <a href="/checkout">Go to checkout</a>
              </Button>
            </div>
          )}

          {/* ── Step 1: Duration ── */}
          {!done && step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Our designers create print-ready artwork matched to your brand. Select how much time you need.
              </p>
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.hours}
                  onClick={() => setSelectedHours(pkg.hours)}
                  className={cn(
                    "relative w-full rounded-xl border p-4 text-left transition-all",
                    selectedHours === pkg.hours
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-border/80 hover:bg-accent/50"
                  )}
                >
                  {pkg.popular && (
                    <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      selectedHours === pkg.hours ? "border-primary bg-primary" : "border-border"
                    )}>
                      {selectedHours === pkg.hours && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold">{pkg.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />{pkg.hours}h
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{pkg.description}</p>
                    </div>
                    <div className="shrink-0 text-sm font-bold">
                      from {fmt(pkg.hours * 100)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Designer ── */}
          {!done && step === 2 && (
            <div className="space-y-3">
              {loadingDesigners && (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading designers…
                </div>
              )}
              {!loadingDesigners && designers.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No designers available right now. Please check back soon.
                </p>
              )}
              {designers.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDesigner(d)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-all",
                    selectedDesigner?.id === d.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-border/80 hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {d.avatar_url ? (
                      <img
                        src={d.avatar_url}
                        alt={d.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{d.name}</span>
                        {selectedDesigner?.id === d.id && (
                          <span className="grid h-4 w-4 place-items-center rounded-full bg-primary">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{d.title}</div>
                      {d.bio && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{d.bio}</p>
                      )}
                      {d.specialties.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {d.specialties.slice(0, 5).map((s) => (
                            <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-sm font-bold">{fmt(Number(d.hourly_rate))}/hr</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 3: Date & Time ── */}
          {!done && step === 3 && (
            <div>
              <MiniCalendar
                year={calYear}
                month={calMonth}
                selected={selectedDate}
                today={today}
                onSelect={(d) => setSelectedDate(d)}
                onPrev={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                  else setCalMonth(m => m - 1);
                }}
                onNext={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                  else setCalMonth(m => m + 1);
                }}
                unavailableDays={unavailableDays}
              />

              {selectedDate && (
                <div className="mt-5">
                  <p className="mb-2.5 text-sm font-medium">
                    Available times · <span className="text-muted-foreground font-normal">{longDateLabel(selectedDate)}</span>
                  </p>
                  {loadingSlots && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking availability…
                    </div>
                  )}
                  {!loadingSlots && slots.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No times available on this date. Please choose another day.
                    </p>
                  )}
                  {!loadingSlots && slots.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((slot) => (
                        <button
                          key={slot.start}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "rounded-lg border py-2 text-xs font-medium transition-colors",
                            selectedSlot?.start === slot.start
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                          )}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Contact ── */}
          {!done && step === 4 && (
            <div>
              {/* Summary card */}
              <div className="mb-5 rounded-xl border bg-secondary/30 p-4 text-sm">
                <div className="font-semibold mb-2">Session summary</div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Designer</span>
                    <span className="font-medium text-foreground">{selectedDesigner?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date</span>
                    <span className="font-medium text-foreground">
                      {selectedDate ? longDateLabel(selectedDate) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time</span>
                    <span className="font-medium text-foreground">{selectedSlot?.label ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span className="font-medium text-foreground">{selectedHours}h session</span>
                  </div>
                  <div className="border-t border-border/60 pt-1 mt-1 flex justify-between font-semibold text-foreground">
                    <span>Total</span>
                    <span>{totalPrice !== null ? fmt(totalPrice) : "—"}</span>
                  </div>
                </div>
              </div>

              {/* Contact form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">First name *</label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Last name *</label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Email *</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label>
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="(555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Company</label>
                    <Input
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      placeholder="Acme Co."
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Project description</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Tell us what you're trying to create — the more detail, the better."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>

              {error && (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => (s - 1) as 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button
                size="sm"
                disabled={
                  (step === 1 && !selectedHours) ||
                  (step === 2 && !selectedDesigner) ||
                  (step === 3 && (!selectedDate || !selectedSlot))
                }
                onClick={() => setStep((s) => (s + 1) as 2 | 3 | 4)}
              >
                Continue
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={submitting || !form.firstName || !form.lastName || !form.email}
                onClick={handleBook}
                className="min-w-[160px]"
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Booking…</>
                ) : (
                  <>Add to cart · {totalPrice !== null ? fmt(totalPrice) : ""}</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
