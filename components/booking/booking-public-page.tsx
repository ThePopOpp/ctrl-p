"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Loader2, MapPin, MessageSquare, Phone, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

function human(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function BookingPublicPage() {
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState<{ title: string; start: string } | null>(null);
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

  useEffect(() => {
    async function loadTypes() {
      setLoadingTypes(true);
      const response = await fetch("/api/booking/appointment-types");
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setTypes(payload.appointmentTypes ?? []);
        setSelectedTypeId(payload.appointmentTypes?.[0]?.id ?? "");
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
      const response = await fetch(`/api/booking/availability?appointment_type_id=${encodeURIComponent(selectedTypeId)}&date=${encodeURIComponent(date)}`);
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

  const selectedType = useMemo(() => types.find((type) => type.id === selectedTypeId) ?? null, [types, selectedTypeId]);
  const canSubmit = selectedType && selectedSlot && form.first_name.trim() && form.last_name.trim() && form.email.includes("@") && !submitting;

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
      setConfirmed({ title: payload.appointment?.title || selectedType?.name || "Appointment", start: selectedSlot.start });
      setForm({ first_name: "", last_name: "", email: "", phone: "", company_name: "", notes: "", sms_consent: false, email_consent: true });
      setAnswers({});
    } else {
      setMessage(payload.error || "Could not create appointment.");
    }
    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-[#07130b] dark:bg-[#07130b] dark:text-[#f7fff2]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 md:px-6">
        <header className="mb-5 flex items-center justify-between border-b border-black/10 pb-4 dark:border-white/10">
          <a className="flex items-center gap-3" href="/">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#a3ff12] text-sm font-black text-[#07130b]">cp</div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-black/45 dark:text-white/45">controlp.io</div>
              <div className="text-lg font-semibold">Book an appointment</div>
            </div>
          </a>
          <Badge className="hidden bg-[#a3ff12] text-[#07130b] md:inline-flex">Arizona time</Badge>
        </header>

        {confirmed ? (
          <Card className="mx-auto mt-12 w-full max-w-2xl border-[#a3ff12]/45 bg-white/80 shadow-sm dark:bg-white/5">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#72b000]" />
              <h1 className="mt-4 text-2xl font-semibold">Appointment confirmed</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {confirmed.title} is booked for {new Intl.DateTimeFormat("en-US", { timeZone: "America/Phoenix", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(confirmed.start))}.
              </p>
              <Button className="mt-6" onClick={() => { setConfirmed(null); setSelectedSlot(null); }}>Book another appointment</Button>
            </CardContent>
          </Card>
        ) : (
          <section className="grid flex-1 gap-5 xl:grid-cols-[380px_1fr_420px]">
            <Card className="bg-white/85 dark:bg-white/5">
              <CardHeader>
                <CardTitle>Choose appointment type</CardTitle>
                <CardDescription>Pick the service that best matches what you need.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingTypes && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading appointment types...</div>}
                {!loadingTypes && !types.length && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No appointment types are active yet.</div>}
                {types.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedTypeId(type.id)}
                    className={cn(
                      "w-full rounded-lg border bg-background/45 p-4 text-left transition hover:border-[#a3ff12]",
                      selectedTypeId === type.id && "border-[#a3ff12] ring-1 ring-[#a3ff12]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{type.name}</div>
                      <Badge variant="outline">{type.duration_minutes} min</Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{type.description}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{human(type.location_type)}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white/85 dark:bg-white/5">
              <CardHeader>
                <CardTitle>Select a date and time</CardTitle>
                <CardDescription>Availability checks working hours, blocked time, buffers, and existing appointments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:max-w-xs">
                  <label className="text-sm font-medium" htmlFor="booking-date">Date</label>
                  <Input id="booking-date" type="date" value={date} min={todayKey()} onChange={(event) => setDate(event.target.value)} />
                </div>

                <div className="rounded-lg border bg-background/35 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{date ? longDate(date) : "Select a date"}</div>
                      <div className="text-xs text-muted-foreground">America/Phoenix</div>
                    </div>
                    {loadingSlots && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  {!loadingSlots && !slots.length && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No times are available for this date.</div>}
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {slots.map((slot) => (
                      <Button
                        key={slot.start}
                        type="button"
                        variant={selectedSlot?.start === slot.start ? "default" : "outline"}
                        onClick={() => setSelectedSlot(slot)}
                        className="justify-center"
                      >
                        {slot.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {message && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">{message}</div>}
              </CardContent>
            </Card>

            <Card className="bg-white/85 dark:bg-white/5">
              <CardHeader>
                <CardTitle>Your details</CardTitle>
                <CardDescription>We will send a confirmation after booking.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-background/35 p-3 text-sm">
                  <div className="font-medium">{selectedType?.name || "Appointment type"}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{date ? longDate(date) : "Date not selected"}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{selectedSlot?.label || "Time not selected"}</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name" value={form.first_name} onChange={(value) => setForm({ ...form, first_name: value })} />
                  <Field label="Last name" value={form.last_name} onChange={(value) => setForm({ ...form, last_name: value })} />
                  <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
                  <Field label="Phone" type="tel" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
                  <Field label="Company" value={form.company_name} onChange={(value) => setForm({ ...form, company_name: value })} />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Tell us what you are working on." />
                </div>

                {(selectedType?.questions ?? []).map((question) => (
                  <div key={question.id} className="grid gap-2">
                    <label className="text-sm font-medium">{question.label}{question.is_required && " *"}</label>
                    {question.field_type === "textarea" ? (
                      <Textarea value={answers[question.field_key] || ""} onChange={(event) => setAnswers({ ...answers, [question.field_key]: event.target.value })} placeholder={question.placeholder || ""} />
                    ) : (
                      <Input value={answers[question.field_key] || ""} onChange={(event) => setAnswers({ ...answers, [question.field_key]: event.target.value })} placeholder={question.placeholder || ""} />
                    )}
                    {question.help_text && <div className="text-xs text-muted-foreground">{question.help_text}</div>}
                  </div>
                ))}

                <label className="flex items-start gap-2 text-sm">
                  <input className="mt-1 h-4 w-4 accent-[#a3ff12]" type="checkbox" checked={form.email_consent} onChange={(event) => setForm({ ...form, email_consent: event.target.checked })} />
                  <span>Email me my appointment confirmation.</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input className="mt-1 h-4 w-4 accent-[#a3ff12]" type="checkbox" checked={form.sms_consent} onChange={(event) => setForm({ ...form, sms_consent: event.target.checked })} />
                  <span>Text me appointment updates. Message/data rates may apply.</span>
                </label>

                <Button className="w-full" disabled={!canSubmit} onClick={book}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Confirm booking
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" /><MessageSquare className="h-3.5 w-3.5" />Notifications are prepared for email and SMS.</div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">{label}</label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
