"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppointmentType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  location_type: string;
  color: string | null;
  questions?: BookingQuestion[];
};

type BookingQuestion = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  help_text: string | null;
  is_required: boolean;
};

type BookingSlot = {
  start: string;
  end: string;
  label: string;
};

type ConfirmedBooking = {
  title: string;
  typeName: string;
  start: string;
  end: string;
  locationLabel: string;
  appointmentId: string;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function longDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00-07:00`));
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}-01T12:00:00-07:00`));
}

function shiftMonth(value: string, direction: number) {
  const date = new Date(`${value}-01T12:00:00-07:00`);
  date.setUTCMonth(date.getUTCMonth() + direction);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function buildCalendarDays(value: string) {
  const [year, month] = value.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1, 19));
  const firstWeekday = new Date(`${value}-01T12:00:00-07:00`).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: Array<{ key: string; day: number; inMonth: boolean }> = [];

  const previousMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    const day = previousMonthDays - index;
    const date = new Date(firstDay);
    date.setUTCDate(day - previousMonthDays);
    days.push({ key: dateKeyFromDate(date), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(firstDay);
    date.setUTCDate(day);
    days.push({ key: dateKeyFromDate(date), day, inMonth: true });
  }

  while (days.length % 7 !== 0 || days.length < 42) {
    const date = new Date(firstDay);
    date.setUTCDate(days.length - firstWeekday + 1);
    days.push({ key: dateKeyFromDate(date), day: date.getUTCDate(), inMonth: false });
  }

  return days;
}

function dateKeyFromDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function human(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// ─── Calendar URL builders (client-side) ──────────────────────────────────────

function toGcalDate(iso: string) {
  return iso.replace(/[:\-]/g, "").replace(/\.\d{3}/, "");
}

function buildGoogleCalUrl(b: ConfirmedBooking) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${b.typeName} with ControlP.io`,
    dates: `${toGcalDate(b.start)}/${toGcalDate(b.end)}`,
    details: `Appointment: ${b.typeName}`,
    location: b.locationLabel,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookCalUrl(b: ConfirmedBooking) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `${b.typeName} with ControlP.io`,
    startdt: b.start,
    enddt: b.end,
    location: b.locationLabel,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function BookingNav({
  theme,
  onToggleTheme,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f7f7f2]/95 backdrop-blur-sm dark:border-white/10 dark:bg-[#07130b]/95">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <a href="/" className="shrink-0">
          <img
            src="/logos/logo-light-lime.svg"
            alt="ControlP.io"
            className="h-9 w-auto dark:hidden"
          />
          <img
            src="/logos/logo-darkgreen-lime.svg"
            alt="ControlP.io"
            className="hidden h-9 w-auto dark:block"
          />
        </a>

        <nav className="hidden items-center gap-0.5 md:flex">
          {[
            ["Home", "/"],
            ["Book", "/book"],
            ["Dashboard", "/dashboard/customer"],
            ["Sign in", "/login"],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors hover:text-foreground",
                href === "/book"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Badge className="hidden bg-[#a3ff12] text-[#07130b] sm:inline-flex">
            Arizona time
          </Badge>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="grid h-8 w-8 place-items-center rounded-lg border border-black/12 text-muted-foreground transition hover:border-[#a3ff12] hover:text-foreground dark:border-white/12"
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_DEFS = [
  { number: 1 as const, label: "Choose type" },
  { number: 2 as const, label: "Date & time" },
  { number: 3 as const, label: "Your details" },
];

function StepIndicator({
  step,
  selectedTypeId,
  selectedSlot,
  onGoTo,
}: {
  step: 1 | 2 | 3;
  selectedTypeId: string;
  selectedSlot: BookingSlot | null;
  onGoTo: (next: 1 | 2 | 3) => void;
}) {
  const canAccess: Record<1 | 2 | 3, boolean> = {
    1: true,
    2: Boolean(selectedTypeId),
    3: Boolean(selectedTypeId && selectedSlot),
  };

  return (
    <nav aria-label="Booking progress" className="mb-8">
      <ol className="flex items-center">
        {STEP_DEFS.map((s, index) => {
          const completed = s.number < step;
          const active = s.number === step;
          const clickable = completed && canAccess[s.number];

          return (
            <li key={s.number} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                disabled={!clickable && !active}
                onClick={() => (clickable ? onGoTo(s.number) : undefined)}
                className={cn(
                  "flex items-center gap-2.5 text-sm transition-colors",
                  active && "font-semibold text-foreground",
                  clickable &&
                    "cursor-pointer text-[#5a8800] hover:text-[#3f6200] dark:text-[#a3ff12] dark:hover:text-[#c8ff5a]",
                  !active && !clickable && "cursor-default text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                    active && "bg-[#a3ff12] text-[#07130b] shadow-sm",
                    completed &&
                      "bg-[#07130b] text-[#a3ff12] dark:bg-[#a3ff12] dark:text-[#07130b]",
                    !active && !completed && "bg-black/10 text-muted-foreground dark:bg-white/10",
                  )}
                >
                  {completed ? <Check className="h-3.5 w-3.5" /> : s.number}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </button>

              {index < STEP_DEFS.length - 1 && (
                <div
                  className={cn(
                    "mx-3 h-px flex-1 rounded-full transition-colors",
                    step > s.number ? "bg-[#a3ff12]/50" : "bg-black/12 dark:bg-white/12",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Appointment type card ────────────────────────────────────────────────────

function TypeCard({
  type,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
}: {
  type: AppointmentType;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-all",
        selected
          ? "border-[#a3ff12] bg-white/95 ring-1 ring-[#a3ff12]/60 dark:bg-[#07130b]/80"
          : "border-black/10 bg-white/85 hover:border-[#a3ff12]/50 dark:border-white/10 dark:bg-white/5",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={onSelect}
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            selected ? "border-[#a3ff12] bg-[#a3ff12]" : "border-black/25 dark:border-white/25",
          )}
        >
          {selected && <Check className="h-3 w-3 text-[#07130b]" />}
        </span>

        {type.color && (
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
            style={{ background: type.color }}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="font-semibold">{type.name}</div>
          {!expanded && type.description && (
            <div className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {type.description}
            </div>
          )}
        </div>

        <Badge variant="outline" className="ml-2 shrink-0">
          {type.duration_minutes} min
        </Badge>

        <button
          type="button"
          aria-label={expanded ? "Collapse details" : "Expand details"}
          className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-black/10 transition hover:border-[#a3ff12] hover:bg-[#a3ff12]/10 dark:border-white/10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      </button>

      {expanded && (
        <div className="border-t border-black/8 bg-black/[0.02] px-5 pb-4 pt-3 dark:border-white/8 dark:bg-white/[0.03]">
          {type.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{type.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{type.duration_minutes} minutes</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{human(type.location_type)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary pill ─────────────────────────────────────────────────────────────

function SummaryPill({ icon, text }: { icon: ReactNode; text: string }) {
  if (!text) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[#a3ff12]/35 bg-[#a3ff12]/12 px-3 py-1.5 text-xs font-medium text-[#07130b] dark:text-[#f7fff2]">
      <span className="shrink-0 text-[#5a8800] [&_svg]:h-3.5 [&_svg]:w-3.5 dark:text-[#a3ff12]">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <label className="text-sm font-medium">{label}</label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

// ─── Inline calendar ──────────────────────────────────────────────────────────

function InlineCalendar({
  date,
  calendarMonth,
  calendarDays,
  onSelectDate,
  onShiftMonth,
}: {
  date: string;
  calendarMonth: string;
  calendarDays: Array<{ key: string; day: number; inMonth: boolean }>;
  onSelectDate: (key: string) => void;
  onShiftMonth: (dir: number) => void;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/85 p-5 dark:border-white/10 dark:bg-white/5">
      {/* Month nav */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 transition hover:border-[#a3ff12] dark:border-white/10"
          onClick={() => onShiftMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="font-semibold">{formatMonth(calendarMonth)}</div>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 transition hover:border-[#a3ff12] dark:border-white/10"
          onClick={() => onShiftMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const isSelected = day.key === date;
          const isDisabled = day.key < todayKey();
          return (
            <button
              key={day.key}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(day.key)}
              className={cn(
                "grid h-10 place-items-center rounded-lg text-sm transition",
                !day.inMonth && "text-muted-foreground/40",
                isDisabled && "cursor-not-allowed text-muted-foreground/25",
                !isDisabled && !isSelected && "hover:bg-[#a3ff12]/20",
                isSelected && "bg-[#a3ff12] font-bold text-[#07130b] hover:bg-[#a3ff12]",
              )}
            >
              {day.day}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
        <button
          type="button"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => {
            const t = todayKey();
            onSelectDate(t);
            onShiftMonth(0);
          }}
        >
          Today
        </button>
      </div>
    </div>
  );
}

// ─── Add-to-calendar buttons ──────────────────────────────────────────────────

function CalendarLinks({ booking }: { booking: ConfirmedBooking }) {
  const icsUrl = `/api/booking/ics?id=${encodeURIComponent(booking.appointmentId)}`;

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-semibold text-muted-foreground">Add to your calendar</p>
      <div className="flex flex-wrap justify-center gap-2">
        <a
          href={buildGoogleCalUrl(booking)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[#4285f4] shadow-sm transition hover:border-[#4285f4]/40 hover:shadow dark:border-white/10 dark:bg-white/5"
        >
          <GoogleIcon />
          Google
        </a>
        <a
          href={buildOutlookCalUrl(booking)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[#0078d4] shadow-sm transition hover:border-[#0078d4]/40 hover:shadow dark:border-white/10 dark:bg-white/5"
        >
          <OutlookIcon />
          Outlook
        </a>
        <a
          href={icsUrl}
          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[#555] shadow-sm transition hover:border-black/20 hover:shadow dark:border-white/10 dark:bg-white/5 dark:text-[#ccc]"
        >
          <AppleIcon />
          Apple
        </a>
        <a
          href={icsUrl}
          download
          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm transition hover:border-black/20 hover:shadow dark:border-white/10 dark:bg-white/5"
        >
          <IcsIcon />
          ICS file
        </a>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="3" fill="#0078d4" />
      <path d="M13 6h7v12h-7V6z" fill="#fff" fillOpacity=".3" />
      <path d="M4 8.5C4 7.12 5.12 6 6.5 6h4C11.88 6 13 7.12 13 8.5v7C13 16.88 11.88 18 10.5 18h-4C5.12 18 4 16.88 4 15.5v-7z" fill="white" />
      <text x="6.5" y="14" fontSize="6" fontWeight="bold" fill="#0078d4" textAnchor="middle">O</text>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.19 1.28-2.17 3.8.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.36 2.78M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function IcsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function BookingPublicPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [expandedTypeId, setExpandedTypeId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [calendarMonth, setCalendarMonth] = useState(monthKey(todayKey()));
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    notes: "",
    sms_consent: false,
    email_consent: true,
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");

  function goTo(next: 1 | 2 | 3) {
    setDirection(next > step ? "fwd" : "back");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    async function loadTypes() {
      setLoadingTypes(true);
      const response = await fetch("/api/booking/appointment-types");
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const list: AppointmentType[] = payload.appointmentTypes ?? [];
        setTypes(list);
        const firstId = list[0]?.id ?? "";
        setSelectedTypeId(firstId);
        setExpandedTypeId(firstId);
      } else {
        setMessage(payload.error || "Could not load appointment types.");
      }
      setLoadingTypes(false);
    }
    loadTypes();
  }, []);

  useEffect(() => {
    async function loadSlots() {
      if (!selectedTypeId || !date) return;
      setLoadingSlots(true);
      setSelectedSlot(null);
      const response = await fetch(
        `/api/booking/availability?appointment_type_id=${encodeURIComponent(selectedTypeId)}&date=${encodeURIComponent(date)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setSlots(payload.slots ?? []);
        setMessage("");
      } else {
        setSlots([]);
        setMessage(payload.error || "Could not load availability.");
      }
      setLoadingSlots(false);
    }
    loadSlots();
  }, [selectedTypeId, date]);

  const selectedType = useMemo(
    () => types.find((t) => t.id === selectedTypeId) ?? null,
    [types, selectedTypeId],
  );
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const canSubmit =
    selectedType &&
    selectedSlot &&
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.email.includes("@") &&
    !submitting;

  async function book() {
    if (!canSubmit || !selectedSlot) return;
    setSubmitting(true);
    setMessage("");
    const response = await fetch("/api/booking/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appointment_type_id: selectedTypeId,
        start_time: selectedSlot.start,
        ...form,
        answers,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setConfirmed({
        title: payload.appointment?.title || selectedType?.name || "Appointment",
        typeName: selectedType?.name || "Appointment",
        start: selectedSlot.start,
        end: selectedSlot.end,
        locationLabel: human(selectedType?.location_type || ""),
        appointmentId: payload.appointment?.id || "",
      });
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company_name: "",
        notes: "",
        sms_consent: false,
        email_consent: true,
      });
      setAnswers({});
    } else {
      setMessage(payload.error || "Could not create appointment.");
    }
    setSubmitting(false);
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-[#f7f7f2] text-[#07130b] dark:bg-[#07130b] dark:text-[#f7fff2]">
        {/* Navigation */}
        <BookingNav theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />

        <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-2xl flex-col px-4 py-8 md:px-6">
          {confirmed ? (
            /* ── Confirmation screen ──────────────────────────── */
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full rounded-2xl border border-[#a3ff12]/40 bg-white/90 p-8 text-center shadow-sm dark:bg-white/5 sm:p-10">
                <CheckCircle2 className="mx-auto h-14 w-14 text-[#72b000]" />
                <h1 className="mt-5 text-2xl font-semibold">Appointment confirmed!</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {confirmed.title} is booked for{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: "America/Phoenix",
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(confirmed.start))}
                  .
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A confirmation email is on its way.
                </p>

                {/* Add to calendar */}
                {confirmed.appointmentId && <CalendarLinks booking={confirmed} />}

                {/* CTA */}
                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Button
                    className="bg-[#a3ff12] text-[#07130b] hover:bg-[#8fe000]"
                    asChild
                  >
                    <a href="/dashboard/customer/bookings">Manage Your Appointments</a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfirmed(null);
                      setSelectedSlot(null);
                      setStep(1);
                    }}
                  >
                    Book another
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              {/* Progress bar */}
              <StepIndicator
                step={step}
                selectedTypeId={selectedTypeId}
                selectedSlot={selectedSlot}
                onGoTo={goTo}
              />

              {/* Animated step wrapper */}
              <div
                key={step}
                className={direction === "fwd" ? "animate-slide-in-right" : "animate-slide-in-left"}
              >

                {/* ── STEP 1: Choose type ──────────────────────── */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">
                        Choose appointment type
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select the service that best fits what you need.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {loadingTypes && (
                        <div className="flex items-center gap-2 rounded-xl border bg-white/85 p-5 text-sm text-muted-foreground dark:bg-white/5">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading appointment types...
                        </div>
                      )}
                      {!loadingTypes && !types.length && (
                        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                          No appointment types are active yet.
                        </div>
                      )}
                      {types.map((type) => (
                        <TypeCard
                          key={type.id}
                          type={type}
                          selected={selectedTypeId === type.id}
                          expanded={expandedTypeId === type.id}
                          onSelect={() => {
                            setSelectedTypeId(type.id);
                            setExpandedTypeId(type.id);
                          }}
                          onToggleExpand={() =>
                            setExpandedTypeId((current) =>
                              current === type.id ? "" : type.id,
                            )
                          }
                        />
                      ))}
                    </div>

                    {message && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                        {message}
                      </div>
                    )}

                    <Button
                      className="w-full bg-[#a3ff12] text-[#07130b] hover:bg-[#8fe000] dark:bg-[#a3ff12] dark:text-[#07130b] dark:hover:bg-[#8fe000]"
                      disabled={!selectedTypeId}
                      onClick={() => goTo(2)}
                    >
                      Continue <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* ── STEP 2: Date & time ──────────────────────── */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">
                        Select a date &amp; time
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Availability checks working hours, buffers, and existing bookings.
                      </p>
                    </div>

                    {/* Inline always-open calendar */}
                    <InlineCalendar
                      date={date}
                      calendarMonth={calendarMonth}
                      calendarDays={calendarDays}
                      onSelectDate={(key) => {
                        setDate(key);
                        setCalendarMonth(monthKey(key));
                      }}
                      onShiftMonth={(dir) => {
                        if (dir === 0) {
                          const t = todayKey();
                          setDate(t);
                          setCalendarMonth(monthKey(t));
                        } else {
                          setCalendarMonth((v) => shiftMonth(v, dir));
                        }
                      }}
                    />

                    {/* Time slots */}
                    <div className="rounded-xl border border-black/10 bg-white/85 p-5 dark:border-white/10 dark:bg-white/5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {date ? longDate(date) : "Select a date above"}
                          </div>
                          <div className="text-xs text-muted-foreground">America/Phoenix</div>
                        </div>
                        {loadingSlots && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {!loadingSlots && !slots.length && (
                        <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                          No times are available for this date.
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((slot) => (
                          <Button
                            key={slot.start}
                            type="button"
                            variant={selectedSlot?.start === slot.start ? "default" : "outline"}
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                              "justify-center",
                              selectedSlot?.start === slot.start &&
                                "bg-[#a3ff12] text-[#07130b] hover:bg-[#8fe000] dark:bg-[#a3ff12] dark:text-[#07130b] dark:hover:bg-[#8fe000]",
                            )}
                          >
                            {slot.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {message && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                        {message}
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <Button variant="outline" className="gap-1.5" onClick={() => goTo(1)}>
                        <ChevronLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button
                        className="flex-1 bg-[#a3ff12] text-[#07130b] hover:bg-[#8fe000] dark:bg-[#a3ff12] dark:text-[#07130b] dark:hover:bg-[#8fe000]"
                        disabled={!selectedSlot}
                        onClick={() => goTo(3)}
                      >
                        Continue <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Your details ─────────────────────── */}
                {step === 3 && (
                  <div className="space-y-5">
                    {/* Sticky summary pills */}
                    <div className="flex flex-wrap gap-2">
                      {selectedType && (
                        <SummaryPill icon={<ShieldCheck />} text={selectedType.name} />
                      )}
                      <SummaryPill icon={<CalendarDays />} text={longDate(date)} />
                      {selectedSlot && (
                        <SummaryPill icon={<Clock />} text={selectedSlot.label + " MST"} />
                      )}
                    </div>

                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">Your details</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        We&apos;ll send a confirmation right away.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="First name *"
                        value={form.first_name}
                        onChange={(v) => setForm({ ...form, first_name: v })}
                      />
                      <Field
                        label="Last name *"
                        value={form.last_name}
                        onChange={(v) => setForm({ ...form, last_name: v })}
                      />
                      <Field
                        label="Email *"
                        type="email"
                        value={form.email}
                        onChange={(v) => setForm({ ...form, email: v })}
                      />
                      <Field
                        label="Phone"
                        type="tel"
                        value={form.phone}
                        onChange={(v) => setForm({ ...form, phone: v })}
                      />
                      <Field
                        label="Company"
                        value={form.company_name}
                        onChange={(v) => setForm({ ...form, company_name: v })}
                        className="sm:col-span-2"
                      />
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Message</label>
                      <Textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Tell us what you are working on."
                        className="min-h-[100px]"
                      />
                    </div>

                    {(selectedType?.questions ?? []).map((question) => (
                      <div key={question.id} className="grid gap-2">
                        <label className="text-sm font-medium">
                          {question.label}
                          {question.is_required && " *"}
                        </label>
                        {question.field_type === "textarea" ? (
                          <Textarea
                            value={answers[question.field_key] || ""}
                            onChange={(e) =>
                              setAnswers({ ...answers, [question.field_key]: e.target.value })
                            }
                            placeholder={question.placeholder || ""}
                          />
                        ) : (
                          <Input
                            value={answers[question.field_key] || ""}
                            onChange={(e) =>
                              setAnswers({ ...answers, [question.field_key]: e.target.value })
                            }
                            placeholder={question.placeholder || ""}
                          />
                        )}
                        {question.help_text && (
                          <div className="text-xs text-muted-foreground">{question.help_text}</div>
                        )}
                      </div>
                    ))}

                    {/* Consent */}
                    <div className="space-y-3 rounded-xl border border-black/10 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5">
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#a3ff12]"
                          type="checkbox"
                          checked={form.email_consent}
                          onChange={(e) => setForm({ ...form, email_consent: e.target.checked })}
                        />
                        <span>Email me my appointment confirmation.</span>
                      </label>
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#a3ff12]"
                          type="checkbox"
                          checked={form.sms_consent}
                          onChange={(e) => setForm({ ...form, sms_consent: e.target.checked })}
                        />
                        <span className="leading-relaxed text-muted-foreground">
                          I agree to receive SMS appointment updates from ControlP.io, including
                          appointment confirmations, reminders, schedule changes, and related
                          service updates. Message frequency may vary. Message and data rates may
                          apply. Reply STOP to unsubscribe or HELP for help. Consent is not a
                          condition of purchase.
                        </span>
                      </label>
                    </div>

                    {message && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                        {message}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button variant="outline" className="gap-1.5" onClick={() => goTo(2)}>
                        <ChevronLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button
                        className="flex-1 bg-[#a3ff12] text-[#07130b] hover:bg-[#8fe000] dark:bg-[#a3ff12] dark:text-[#07130b] dark:hover:bg-[#8fe000]"
                        disabled={!canSubmit}
                        onClick={book}
                      >
                        {submitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        Book Your Appointment
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <footer className="mt-10 border-t border-black/10 pt-4 text-center text-xs text-muted-foreground dark:border-white/10">
            Powered by{" "}
            <a
              href="https://my.controlp.io"
              className="font-medium text-[#5a8800] hover:underline dark:text-[#a3ff12]"
            >
              ControlP.io
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}
