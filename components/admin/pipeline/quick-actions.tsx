"use client";

// The opportunity workspace's quick-action menu: Call, Email, Text, Schedule,
// Note, Voice note, AI Agent, Project, Plan, Contract, SOW, Quote and Invoice.
// Each tool uses the real Ctrl+P module behind it (Twilio, SMTP, Bookings,
// Projects, Payments). Results are recorded only after the provider or the
// database confirms them; nothing is shown as sent that wasn't.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import {
  Bot,
  CalendarClock,
  ClipboardList,
  FileSignature,
  FileText,
  FolderKanban,
  Loader2,
  Mail,
  Maximize2,
  MessageSquare,
  Mic,
  Minimize2,
  Phone,
  PhoneOff,
  Receipt,
  ScrollText,
  Square,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

import { FormLabel, SelectField, fmtDate, fmtDateTime, human, usd } from "@/components/admin/pipeline/pipeline-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AI_MODES, splitEmailDraft, type AiMode } from "@/lib/pipeline/ai-brief";
import { apiRequest, errorMessage, pipelineRequest, pipelineUpload } from "@/lib/pipeline/client";
import type { DocumentKind, DocumentStatus, OpportunityDetail } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

export type QuickActionId =
  | "call" | "email" | "sms" | "schedule" | "note" | "voice" | "agent"
  | "project" | "plan" | "contract" | "sow" | "quote" | "invoice";

export const QUICK_ACTIONS: { id: QuickActionId; label: string; title: string; icon: LucideIcon; wide?: boolean }[] = [
  { id: "call", label: "Call", title: "Call", icon: Phone },
  { id: "email", label: "Email", title: "Send an email", icon: Mail, wide: true },
  { id: "sms", label: "Text", title: "Send a text", icon: MessageSquare },
  { id: "schedule", label: "Schedule", title: "Book an appointment", icon: CalendarClock, wide: true },
  { id: "note", label: "Note", title: "Add a note", icon: StickyNote, wide: true },
  { id: "voice", label: "Voice note", title: "Record a voice note", icon: Mic },
  { id: "agent", label: "AI Agent", title: "AI Agent", icon: Bot, wide: true },
  { id: "project", label: "Project", title: "Project", icon: FolderKanban, wide: true },
  { id: "plan", label: "Plan", title: "Plans", icon: ClipboardList, wide: true },
  { id: "contract", label: "Contract", title: "Contracts", icon: FileSignature, wide: true },
  { id: "sow", label: "SOW", title: "Statements of work", icon: ScrollText, wide: true },
  { id: "quote", label: "Quote", title: "Quote", icon: FileText },
  { id: "invoice", label: "Invoice", title: "Invoice", icon: Receipt, wide: true },
];

export type ToolRequest = { id: Exclude<QuickActionId, "quote">; prefill?: { subject?: string; body?: string } };

/** Horizontal in the header while the sidebar is open; a vertical rail beside the content when it is collapsed. */
export function ActionRail({ vertical, disabled, onRun }: { vertical: boolean; disabled: boolean; onRun: (id: QuickActionId) => void }) {
  if (vertical) {
    return (
      <nav aria-label="Opportunity actions" className="flex flex-col gap-0.5 rounded-xl border bg-card p-2 xl:sticky xl:top-16">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            onClick={() => onRun(action.id)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <action.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </nav>
    );
  }
  return (
    <div role="toolbar" aria-label="Opportunity actions" className="-mx-1 flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {QUICK_ACTIONS.map((action) => (
        <Button key={action.id} size="sm" variant="outline" disabled={disabled} onClick={() => onRun(action.id)} className="h-8 shrink-0 gap-1.5">
          <action.icon className="h-3.5 w-3.5" aria-hidden /> {action.label}
        </Button>
      ))}
    </div>
  );
}

type PanelProps = {
  detail: OpportunityDetail;
  onDone: (message: string) => Promise<void> | void;
  onClose: () => void;
};

export function QuickActionModal({
  request,
  detail,
  onClose,
  onSwitch,
  onDone,
}: {
  request: ToolRequest | null;
  detail: OpportunityDetail;
  onClose: () => void;
  onSwitch: (next: ToolRequest) => void;
  onDone: (message: string) => Promise<void> | void;
}) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!request) setFull(false);
  }, [request]);
  const meta = request ? QUICK_ACTIONS.find((action) => action.id === request.id) ?? null : null;
  const props: PanelProps = { detail, onDone, onClose };

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(full ? "flex h-[96vh] w-[96vw] max-w-none flex-col gap-3 overflow-y-auto" : cn("max-h-[90vh] overflow-y-auto", meta?.wide ? "sm:max-w-3xl" : "sm:max-w-md"))}
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <DialogTitle className="flex items-center gap-2">
            {meta && <meta.icon className="h-4 w-4" aria-hidden />}
            {meta?.title}
          </DialogTitle>
          <button type="button" onClick={() => setFull(!full)} aria-label={full ? "Exit full screen" : "Expand to full screen"}
            className="mr-7 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </DialogHeader>
        <DialogDescription className="sr-only">{meta?.title} for {detail.opportunity.name}</DialogDescription>
        {request?.id === "call" && <CallPanel {...props} />}
        {request?.id === "email" && <EmailPanel key={`email-${request.prefill?.body ?? ""}`} {...props} prefill={request.prefill} />}
        {request?.id === "sms" && <SmsPanel key={`sms-${request.prefill?.body ?? ""}`} {...props} prefill={request.prefill} />}
        {request?.id === "schedule" && <SchedulePanel {...props} />}
        {request?.id === "note" && <NotePanel {...props} />}
        {request?.id === "voice" && <VoiceNotePanel {...props} />}
        {request?.id === "agent" && <AiAgentPanel {...props} onSwitch={onSwitch} />}
        {request?.id === "project" && <ProjectPanel {...props} />}
        {(request?.id === "plan" || request?.id === "contract" || request?.id === "sow") && <DocumentPanel key={request.id} {...props} kind={request.id} />}
        {request?.id === "invoice" && <InvoicePanel {...props} />}
      </DialogContent>
    </Dialog>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

const isPlaceholder = (email: string | null | undefined) => Boolean(email && /@import\.controlp\.io$/i.test(email));
const contactEmail = (detail: OpportunityDetail) => {
  const email = detail.customer?.email || detail.opportunity.contact_email || "";
  return isPlaceholder(email) ? "" : email;
};
const contactPhone = (detail: OpportunityDetail) => detail.customer?.phone || detail.opportunity.contact_phone || "";
const contactName = (detail: OpportunityDetail) => detail.customer?.full_name || detail.opportunity.contact_name || "";

/** E.164 for the dialer; ten-digit numbers are treated as US numbers. */
function dialable(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (value.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function Status({ tone, children }: { tone: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md px-3 py-2 text-xs",
        tone === "error" && "bg-red-500/10 text-red-700 dark:text-red-300",
        tone === "success" && "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        tone === "warning" && "bg-amber-500/10 text-amber-800 dark:text-amber-200",
        tone === "info" && "bg-muted/60 text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">{children}</div>;
}

// ── Call ────────────────────────────────────────────────────────────────────

type TokenInfo = { token: string; twimlAppSid: string | null; phoneNumbers: string[]; defaultPhoneNumber: string | null; smsPhoneNumbers: string[] };
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function CallPanel({ detail, onDone }: PanelProps) {
  const [number, setNumber] = useState(contactPhone(detail));
  const [numbers, setNumbers] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "connecting" | "on_call" | "ended">("loading");
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const info = await apiRequest<TokenInfo>("/api/admin/communications/token");
        if (!alive) return;
        setNumbers(info.phoneNumbers);
        setFrom(info.defaultPhoneNumber ?? info.phoneNumbers[0] ?? "");
        if (!info.twimlAppSid) {
          setState("unavailable");
          setMessage({ tone: "error", text: "Calling isn't configured: TWILIO_TWIML_APP_SID is missing." });
          return;
        }
        const voice = await import("@twilio/voice-sdk");
        if (!alive) return;
        // Not registered: this dialer only places calls, so it never takes incoming calls meant for Communications.
        deviceRef.current = new voice.Device(info.token, { logLevel: "error" });
        setState("ready");
      } catch (error) {
        if (!alive) return;
        setState("unavailable");
        setMessage({ tone: "error", text: errorMessage(error, "Calling isn't available.") });
      }
    })();
    return () => {
      alive = false;
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (state !== "on_call") return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  async function place() {
    const device = deviceRef.current;
    const to = dialable(number);
    if (!device || to.replace(/\D/g, "").length < 10) {
      setMessage({ tone: "error", text: "Enter a full phone number." });
      return;
    }
    setState("connecting");
    setMessage(null);
    setSeconds(0);
    try {
      const call = await device.connect({ params: { To: to, callerId: from } });
      callRef.current = call;
      let finished = false;
      const finish = async () => {
        if (finished) return;
        finished = true;
        callRef.current = null;
        setState("ended");
        const callSid = call.parameters?.CallSid;
        if (!callSid) {
          setMessage({ tone: "info", text: "The call didn't connect, so nothing was recorded." });
          return;
        }
        try {
          const result = await pipelineRequest<{ recorded: boolean; status?: string; duplicate?: boolean }>(`/opportunities/${detail.opportunity.id}/actions`, {
            method: "POST",
            body: { type: "call", call_sid: callSid, to, from },
          });
          setMessage({ tone: "success", text: result.recorded ? `Call recorded on the timeline. Twilio status: ${human(result.status)}.` : "This call is already on the timeline." });
          await onDone("Call recorded");
        } catch (error) {
          setMessage({ tone: "error", text: `The call ended but couldn't be recorded: ${errorMessage(error)}` });
        }
      };
      call.on("accept", () => setState("on_call"));
      call.on("disconnect", () => void finish());
      call.on("cancel", () => void finish());
      call.on("reject", () => void finish());
      call.on("error", (error: { message?: string }) => {
        setMessage({ tone: "error", text: error?.message ?? "The call failed." });
        void finish();
      });
    } catch (error) {
      setState("ready");
      setMessage({ tone: "error", text: errorMessage(error, "Couldn't start the call.") });
    }
  }

  const live = state === "connecting" || state === "on_call";

  return (
    <div className="space-y-3">
      {numbers.length > 1 && (
        <FormLabel label="Call from">
          <SelectField value={from} onChange={(event) => setFrom(event.target.value)} disabled={live}>
            {numbers.map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectField>
        </FormLabel>
      )}
      <FormLabel label="Number">
        <Input type="tel" value={number} onChange={(event) => setNumber(event.target.value)} disabled={live} className="text-center text-lg tracking-wide" />
      </FormLabel>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <Button key={key} type="button" variant="outline" className="h-11 text-base"
            onClick={() => (state === "on_call" ? callRef.current?.sendDigits(key) : setNumber((value) => value + key))}>
            {key}
          </Button>
        ))}
      </div>
      {live ? (
        <Button className="w-full bg-red-600 text-white hover:bg-red-700" onClick={() => callRef.current?.disconnect()}>
          <PhoneOff className="h-4 w-4" /> {state === "connecting" ? "Cancel" : `Hang up · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
        </Button>
      ) : (
        <Button className="w-full" onClick={() => void place()} disabled={state === "loading" || state === "unavailable"}>
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Call
        </Button>
      )}
      {message && <Status tone={message.tone}>{message.text}</Status>}
      <p className="text-[11px] text-muted-foreground">Calls go through Twilio and are recorded per your Communications setup. After you hang up, the real call status and length are fetched from Twilio and added to the timeline.</p>
    </div>
  );
}

// ── Text ────────────────────────────────────────────────────────────────────

function SmsPanel({ detail, onDone, onClose, prefill }: PanelProps & { prefill?: ToolRequest["prefill"] }) {
  const [to, setTo] = useState(contactPhone(detail));
  const [body, setBody] = useState(prefill?.body ?? "");
  const [numbers, setNumbers] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<TokenInfo>("/api/admin/communications/token")
      .then((info) => {
        setNumbers(info.smsPhoneNumbers ?? []);
        setFrom(info.smsPhoneNumbers?.[0] ?? "");
      })
      .catch(() => undefined);
  }, []);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const result = await pipelineRequest<{ status: string }>(`/opportunities/${detail.opportunity.id}/actions`, { method: "POST", body: { type: "sms", to, from: from || null, body } });
      await onDone(`Text accepted by Twilio (${human(result.status)})`);
      onClose();
    } catch (sendError) {
      setError(errorMessage(sendError, "The text wasn't sent."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {numbers.length > 1 && (
        <FormLabel label="From">
          <SelectField value={from} onChange={(event) => setFrom(event.target.value)}>{numbers.map((value) => <option key={value} value={value}>{value}</option>)}</SelectField>
        </FormLabel>
      )}
      <FormLabel label="To"><Input type="tel" value={to} onChange={(event) => setTo(event.target.value)} /></FormLabel>
      <FormLabel label="Message" hint={`${body.length} characters${body.length > 160 ? ` · ${Math.ceil(body.length / 153)} segments` : ""}`}>
        <Textarea rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
      </FormLabel>
      {error && <Status tone="error">{error}</Status>}
      <Footer>
        <Button onClick={() => void send()} disabled={busy || !to.trim() || !body.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} Send text
        </Button>
      </Footer>
    </div>
  );
}

// ── Email ───────────────────────────────────────────────────────────────────

function EmailPanel({ detail, onDone, onClose, prefill }: PanelProps & { prefill?: ToolRequest["prefill"] }) {
  const [to, setTo] = useState(contactEmail(detail));
  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [body, setBody] = useState(prefill?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await pipelineRequest(`/opportunities/${detail.opportunity.id}/actions`, { method: "POST", body: { type: "email", to, subject, body } });
      await onDone("Email sent");
      onClose();
    } catch (sendError) {
      setError(errorMessage(sendError, "The email wasn't sent."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FormLabel label="To"><Input type="email" value={to} onChange={(event) => setTo(event.target.value)} /></FormLabel>
      <FormLabel label="Subject"><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></FormLabel>
      <FormLabel label="Message"><Textarea rows={12} value={body} onChange={(event) => setBody(event.target.value)} /></FormLabel>
      {!contactEmail(detail) && <Status tone="warning">No email address on file for this contact.</Status>}
      {error && <Status tone="error">{error}</Status>}
      <Footer>
        <span className="mr-auto text-[11px] text-muted-foreground">Sent as plain text through your email server and saved to Messages.</span>
        <Button onClick={() => void send()} disabled={busy || !to.trim() || !subject.trim() || !body.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send email
        </Button>
      </Footer>
    </div>
  );
}

// ── Schedule ────────────────────────────────────────────────────────────────

type AppointmentType = { id: string; name: string; description: string | null; duration_minutes: number };
type Slot = { start: string; end: string; label: string };

const localDate = (offsetDays: number) => {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function SchedulePanel({ detail, onDone, onClose }: PanelProps) {
  const name = contactName(detail).split(/\s+/).filter(Boolean);
  const [types, setTypes] = useState<AppointmentType[] | null>(null);
  const [typeId, setTypeId] = useState("");
  const [date, setDate] = useState(localDate(1));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState("");
  const [firstName, setFirstName] = useState(name[0] ?? "");
  const [lastName, setLastName] = useState(name.slice(1).join(" "));
  const [email, setEmail] = useState(contactEmail(detail));
  const [phone, setPhone] = useState(contactPhone(detail));
  const [notes, setNotes] = useState(detail.opportunity.name);
  const [smsConsent, setSmsConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ appointmentTypes: AppointmentType[] }>("/api/booking/appointment-types")
      .then((result) => {
        setTypes(result.appointmentTypes);
        setTypeId(result.appointmentTypes[0]?.id ?? "");
      })
      .catch((loadError) => setError(errorMessage(loadError, "Couldn't load appointment types.")));
  }, []);

  useEffect(() => {
    if (!typeId || !date) return;
    setSlots(null);
    setSlot("");
    apiRequest<{ slots: Slot[] }>(`/api/booking/availability?appointment_type_id=${encodeURIComponent(typeId)}&date=${encodeURIComponent(date)}`)
      .then((result) => setSlots(result.slots))
      .catch((loadError) => {
        setSlots([]);
        setError(errorMessage(loadError, "Couldn't load open times."));
      });
  }, [typeId, date]);

  async function book() {
    setBusy(true);
    setError(null);
    let appointmentId: string | null = null;
    try {
      const created = await apiRequest<{ appointment: { id: string } }>("/api/booking/appointments", {
        method: "POST",
        body: { appointment_type_id: typeId, start_time: slot, first_name: firstName, last_name: lastName, email, phone, company_name: detail.opportunity.company, notes, sms_consent: smsConsent && Boolean(phone), email_consent: true },
      });
      appointmentId = created.appointment.id;
      await pipelineRequest(`/opportunities/${detail.opportunity.id}/actions`, { method: "POST", body: { type: "appointment", appointment_id: appointmentId } });
      await onDone("Appointment booked");
      onClose();
    } catch (bookError) {
      setError(appointmentId
        ? `The appointment was booked but couldn't be attached to this opportunity: ${errorMessage(bookError)}. It's in Bookings.`
        : errorMessage(bookError, "The appointment wasn't booked."));
    } finally {
      setBusy(false);
    }
  }

  const type = types?.find((item) => item.id === typeId);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormLabel label="Appointment type">
          <SelectField value={typeId} onChange={(event) => setTypeId(event.target.value)} disabled={!types}>
            {!types && <option>Loading…</option>}
            {types?.length === 0 && <option value="">No active appointment types</option>}
            {types?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.duration_minutes} min</option>)}
          </SelectField>
        </FormLabel>
        <FormLabel label="Date"><Input type="date" value={date} min={localDate(0)} onChange={(event) => setDate(event.target.value)} /></FormLabel>
      </div>
      {type?.description && <p className="text-xs text-muted-foreground">{type.description}</p>}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Open times (Arizona)</p>
        {slots === null ? (
          <p className="text-xs text-muted-foreground">Loading open times…</p>
        ) : slots.length === 0 ? (
          <p className="text-xs text-muted-foreground">No open times that day.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((item) => (
              <Button key={item.start} type="button" size="sm" variant={slot === item.start ? "default" : "outline"} onClick={() => setSlot(item.start)}>{item.label}</Button>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormLabel label="First name"><Input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></FormLabel>
        <FormLabel label="Last name"><Input value={lastName} onChange={(event) => setLastName(event.target.value)} /></FormLabel>
        <FormLabel label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></FormLabel>
        <FormLabel label="Mobile"><Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></FormLabel>
        <FormLabel label="Notes" className="sm:col-span-2"><Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></FormLabel>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={smsConsent} disabled={!phone} onChange={(event) => setSmsConsent(event.target.checked)} className="h-4 w-4 accent-primary" />
        Customer agreed to text reminders
      </label>
      <Status tone="info">This books a real appointment in Bookings and sends the customer the normal booking confirmation.</Status>
      {error && <Status tone="error">{error}</Status>}
      <Footer>
        <Button onClick={() => void book()} disabled={busy || !slot || !firstName.trim() || !lastName.trim() || !email.includes("@")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Book appointment
        </Button>
      </Footer>
    </div>
  );
}

// ── Note ────────────────────────────────────────────────────────────────────

function NotePanel({ detail, onDone, onClose }: PanelProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await pipelineRequest(`/opportunities/${detail.opportunity.id}/activities`, { method: "POST", body: { kind: "note", subject, body } });
      await onDone("Note added");
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError, "The note wasn't saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FormLabel label="Title"><Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Discovery call recap" /></FormLabel>
      <FormLabel label="Note"><Textarea rows={12} value={body} onChange={(event) => setBody(event.target.value)} /></FormLabel>
      {error && <Status tone="error">{error}</Status>}
      <Footer>
        <Button onClick={() => void save()} disabled={busy || (!subject.trim() && !body.trim())}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />} Save note
        </Button>
      </Footer>
    </div>
  );
}

// ── Voice note ──────────────────────────────────────────────────────────────

function VoiceNotePanel({ detail, onDone, onClose }: PanelProps) {
  const [phase, setPhase] = useState<"idle" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [transcribe, setTranscribe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const supported = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const type = (recorder.mimeType || mimeType || "audio/webm").split(";")[0];
        const recorded = new Blob(chunks, { type });
        setBlob(recorded);
        setPreviewUrl(URL.createObjectURL(recorded));
        setPhase("recorded");
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder;
      setSeconds(0);
      recorder.start();
      setPhase("recording");
    } catch {
      setError("Microphone access was blocked. Allow it in your browser to record.");
    }
  }

  async function save() {
    if (!blob) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", blob, `voice-note.${blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
      form.append("duration_seconds", String(seconds));
      form.append("title", title);
      form.append("transcribe", String(transcribe));
      const result = await pipelineUpload<{ transcriptStatus: string; transcriptError: string | null }>(`/opportunities/${detail.opportunity.id}/voice-notes`, form);
      await onDone(result.transcriptStatus === "transcribed" ? "Voice note saved and transcribed" : "Voice note saved");
      if (transcribe && result.transcriptStatus !== "transcribed") {
        setError(`Saved without a transcript: ${result.transcriptError ?? "transcription unavailable"}.`);
        setBlob(null);
        setPhase("idle");
      } else {
        onClose();
      }
    } catch (saveError) {
      setError(errorMessage(saveError, "The voice note wasn't saved."));
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return <Status tone="error">This browser can&apos;t record audio.</Status>;

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
        <div className="text-2xl font-semibold tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>
        {phase === "recording" ? (
          <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => recorderRef.current?.stop()}><Square className="h-4 w-4" /> Stop</Button>
        ) : (
          <Button variant={phase === "recorded" ? "outline" : "default"} onClick={() => void start()} disabled={busy}><Mic className="h-4 w-4" /> {phase === "recorded" ? "Record again" : "Start recording"}</Button>
        )}
        {previewUrl && phase === "recorded" && <audio controls src={previewUrl} className="w-full" />}
      </div>
      <FormLabel label="Title"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Site visit notes" /></FormLabel>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={transcribe} onChange={(event) => setTranscribe(event.target.checked)} className="h-4 w-4 accent-primary" />
        Transcribe (needs OPENAI_API_KEY)
      </label>
      {error && <Status tone="error">{error}</Status>}
      <Footer>
        <Button onClick={() => void save()} disabled={busy || phase !== "recorded"}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Save voice note
        </Button>
      </Footer>
    </div>
  );
}

// ── AI Agent ────────────────────────────────────────────────────────────────

function AiAgentPanel({ detail, onDone, onSwitch }: PanelProps & { onSwitch: (next: ToolRequest) => void }) {
  const [mode, setMode] = useState<AiMode>("summary");
  const [instructions, setInstructions] = useState("");
  const [text, setText] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "save" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function generate() {
    setBusy("draft");
    setMessage(null);
    try {
      const result = await pipelineRequest<{ text: string; model: string }>(`/opportunities/${detail.opportunity.id}/actions`, { method: "POST", body: { type: "ai_draft", mode, instructions } });
      setText(result.text);
      setModel(result.model);
    } catch (draftError) {
      setMessage({ tone: "error", text: errorMessage(draftError, "The AI didn't respond.") });
    } finally {
      setBusy(null);
    }
  }

  async function saveToTimeline() {
    setBusy("save");
    setMessage(null);
    try {
      await pipelineRequest(`/opportunities/${detail.opportunity.id}/actions`, { method: "POST", body: { type: "ai_save", mode, instructions, text, model } });
      await onDone("AI draft saved to the timeline");
      setMessage({ tone: "success", text: "Saved to the timeline as an AI draft (not sent)." });
    } catch (saveError) {
      setMessage({ tone: "error", text: errorMessage(saveError, "Couldn't save the draft.") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <Status tone="info">The AI works only from this opportunity&apos;s record and never sends anything. AI phone calling isn&apos;t available in Ctrl+P yet.</Status>
      <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
        <FormLabel label="Task">
          <SelectField value={mode} onChange={(event) => setMode(event.target.value as AiMode)}>
            {AI_MODES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </SelectField>
        </FormLabel>
        <FormLabel label={mode === "question" ? "Your question" : "Extra instructions (optional)"}>
          <Input value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder={mode === "question" ? "What's still missing to send the quote?" : "Mention the rush timeline"} />
        </FormLabel>
      </div>
      <Button onClick={() => void generate()} disabled={busy !== null || (mode === "question" && !instructions.trim())}>
        {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />} {text ? "Regenerate" : "Generate"}
      </Button>
      {text && (
        <>
          <FormLabel label={`Draft${model ? ` · ${model}` : ""}`} hint="Edit before using it. Review facts — the AI can be wrong.">
            <Textarea rows={12} value={text} onChange={(event) => setText(event.target.value)} />
          </FormLabel>
          <Footer>
            <Button variant="outline" onClick={() => void saveToTimeline()} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />} Save to timeline
            </Button>
            <Button variant="outline" onClick={() => onSwitch({ id: "email", prefill: splitEmailDraft(text) })}><Mail className="h-4 w-4" /> Use in email</Button>
            <Button variant="outline" onClick={() => onSwitch({ id: "sms", prefill: { body: text } })}><MessageSquare className="h-4 w-4" /> Use in text</Button>
          </Footer>
        </>
      )}
      {message && <Status tone={message.tone}>{message.text}</Status>}
    </div>
  );
}

// ── Project ─────────────────────────────────────────────────────────────────

type ScheduleItem = { id: string; title: string; status: string | null; project_name: string | null; due_date: string | null };

function ProjectPanel({ detail, onDone, onClose }: PanelProps) {
  const o = detail.opportunity;
  const [mode, setMode] = useState<"create" | "link">("create");
  const [title, setTitle] = useState(o.name);
  const [dueDate, setDueDate] = useState(o.requested_completion_date ?? "");
  const [description, setDescription] = useState(o.description ?? "");
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "link" || items) return;
    apiRequest<{ items: ScheduleItem[] }>("/api/admin/production-schedule")
      .then((result) => setItems(result.items))
      .catch((loadError) => setError(errorMessage(loadError, "Couldn't load projects.")));
  }, [mode, items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (items ?? []).filter((item) => !needle || [item.title, item.project_name].some((value) => String(value || "").toLowerCase().includes(needle))).slice(0, 100);
  }, [items, query]);

  async function submit() {
    setBusy(true);
    setError(null);
    let projectId = mode === "link" ? selected : "";
    try {
      if (mode === "create") {
        const created = await apiRequest<{ item: { id: string } }>("/api/admin/production-schedule", {
          method: "POST",
          body: { title, due_date: dueDate || null, description: description || null, customer_id: o.customer_user_id, order_id: o.won_order_id, project_name: o.name },
        });
        projectId = created.item.id;
      }
      await pipelineRequest(`/opportunities/${o.id}/actions`, { method: "POST", body: { type: "project", project_id: projectId } });
      await onDone(mode === "create" ? "Project created and linked" : "Project linked");
      onClose();
    } catch (submitError) {
      setError(mode === "create" && projectId
        ? `The project was created in Projects but couldn't be linked: ${errorMessage(submitError)}`
        : errorMessage(submitError, "Nothing was changed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {detail.projects.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Linked projects</p>
          {detail.projects.map((project) => <div key={project.id} className="flex justify-between gap-2"><span>{project.title}</span><span className="text-xs text-muted-foreground">{human(project.status)}{project.due_date ? ` · due ${fmtDate(project.due_date)}` : ""}</span></div>)}
        </div>
      )}
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["create", "link"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)}
            className={cn("rounded-md px-2 py-1.5 text-xs font-medium", mode === key ? "bg-background shadow-sm" : "text-muted-foreground")}>
            {key === "create" ? "Create a project" : "Link an existing project"}
          </button>
        ))}
      </div>
      {mode === "create" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormLabel label="Title" className="sm:col-span-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></FormLabel>
          <FormLabel label="Due date"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></FormLabel>
          <FormLabel label="Description" className="sm:col-span-2"><Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></FormLabel>
          <p className="text-[11px] text-muted-foreground sm:col-span-2">Creates the item in Projects{o.won_order_id ? " on the won order" : ""}. Production steps are managed there.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Input placeholder="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} />
          <SelectField size={8} className="h-auto" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Project">
            {!items && <option disabled>Loading…</option>}
            {visible.map((item) => <option key={item.id} value={item.id}>{item.title}{item.project_name ? ` · ${item.project_name}` : ""} · {human(item.status)}</option>)}
          </SelectField>
        </div>
      )}
      {error && <Status tone="error">{error}</Status>}
      <Footer>
        <Button onClick={() => void submit()} disabled={busy || (mode === "create" ? !title.trim() : !selected)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderKanban className="h-4 w-4" />} {mode === "create" ? "Create project" : "Link project"}
        </Button>
      </Footer>
    </div>
  );
}

// ── Plans, contracts, SOWs ──────────────────────────────────────────────────

const DOC_LABEL: Record<DocumentKind, string> = { plan: "Plan", contract: "Contract", sow: "Statement of work" };
const DOC_STATUSES: DocumentStatus[] = ["draft", "sent", "accepted", "signed", "declined", "archived"];

function DocumentPanel({ detail, onDone, onClose, kind }: PanelProps & { kind: DocumentKind }) {
  const o = detail.opportunity;
  const existing = detail.documents.filter((doc) => doc.kind === kind);
  const [title, setTitle] = useState(`${o.company || o.name} — ${DOC_LABEL[kind]}`);
  const [status, setStatus] = useState<DocumentStatus>("draft");
  const [amount, setAmount] = useState(kind === "plan" ? "" : String(detail.value || ""));
  const [effectiveDate, setEffectiveDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [body, setBody] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await pipelineRequest(`/opportunities/${o.id}/documents`, {
        method: "POST",
        body: { kind, title, status, amount: amount || null, effective_date: effectiveDate || null, due_date: dueDate || null, body: body || null, file_url: fileUrl || null },
      });
      await onDone(`${DOC_LABEL[kind]} saved`);
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError, "Nothing was saved."));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(documentId: string, next: string) {
    setError(null);
    try {
      await pipelineRequest(`/opportunities/${o.id}/documents`, { method: "PATCH", body: { document_id: documentId, status: next } });
      await onDone(`${DOC_LABEL[kind]} marked ${next}`);
    } catch (saveError) {
      setError(errorMessage(saveError, "The status wasn't changed."));
    }
  }

  return (
    <div className="space-y-3">
      {existing.length > 0 && (
        <div className="space-y-1.5 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">On this opportunity</p>
          {existing.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{doc.file_url ? <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{doc.title}</a> : doc.title}</span>
              {doc.amount !== null && <span className="text-xs text-muted-foreground">{usd(doc.amount)}</span>}
              <SelectField aria-label={`Status of ${doc.title}`} className="h-8 w-auto text-xs" value={doc.status} onChange={(event) => void changeStatus(doc.id, event.target.value)}>
                {DOC_STATUSES.map((value) => <option key={value} value={value}>{human(value)}</option>)}
              </SelectField>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormLabel label="Title" className="sm:col-span-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></FormLabel>
        <FormLabel label="Status">
          <SelectField value={status} onChange={(event) => setStatus(event.target.value as DocumentStatus)}>{DOC_STATUSES.map((value) => <option key={value} value={value}>{human(value)}</option>)}</SelectField>
        </FormLabel>
        <FormLabel label="Amount"><Input type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} /></FormLabel>
        <FormLabel label="Effective date"><Input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></FormLabel>
        <FormLabel label={kind === "plan" ? "Target date" : "Due / expires"}><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></FormLabel>
        <FormLabel label={kind === "plan" ? "Plan" : "Terms / scope"} className="sm:col-span-2"><Textarea rows={8} value={body} onChange={(event) => setBody(event.target.value)} /></FormLabel>
        <FormLabel label="Link to signed or shared file (optional)" className="sm:col-span-2"><Input value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} placeholder="https://…" /></FormLabel>
      </div>
      <Status tone="info">Status is recorded by your team. There&apos;s no e-signature or document sending built in yet.</Status>
      {error && <Status tone="error">{error}</Status>}
      <Footer>
        <Button onClick={() => void create()} disabled={busy || !title.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Save {DOC_LABEL[kind].toLowerCase()}
        </Button>
      </Footer>
    </div>
  );
}

// ── Invoice ─────────────────────────────────────────────────────────────────

function InvoicePanel({ detail, onDone, onClose }: PanelProps) {
  const o = detail.opportunity;
  const orders = detail.orders;
  const [orderId, setOrderId] = useState(o.won_order_id ?? orders[0]?.id ?? "");
  const [amount, setAmount] = useState(String(detail.value || ""));
  const [description, setDescription] = useState(o.name);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState(localDate(14));
  const [terms, setTerms] = useState(o.payment_terms || "Due on receipt");
  const [channel, setChannel] = useState<"none" | "email" | "sms" | "both">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    let paymentId: string | null = null;
    let delivered: "email" | "sms" | "both" | null = null;
    try {
      const value = Number(amount);
      const created = await apiRequest<{ payment: { id: string } }>("/api/admin/payments", {
        method: "POST",
        body: {
          order_id: orderId,
          amount: value,
          subtotal: value,
          invoice_number: invoiceNumber || undefined,
          invoice_due_at: dueDate || undefined,
          invoice_terms: terms,
          line_items: [{ description, quantity: 1, unit_price: value, total: value, line_total: value }],
        },
      });
      paymentId = created.payment.id;
      if (channel !== "none") {
        try {
          await apiRequest(`/api/admin/payments/${paymentId}/deliver`, {
            method: "POST",
            body: { kind: "invoice", channel, recipient_email: contactEmail(detail) || undefined, recipient_phone: contactPhone(detail) || undefined },
          });
          delivered = channel;
        } catch (deliverError) {
          setError(`The invoice was created but not sent: ${errorMessage(deliverError)}. You can send it from Payments.`);
        }
      }
      await pipelineRequest(`/opportunities/${o.id}/actions`, { method: "POST", body: { type: "invoice", payment_id: paymentId, delivery_channel: delivered } });
      await onDone(delivered ? "Invoice created and sent" : "Invoice created");
      if (channel === "none" || delivered) onClose();
    } catch (createError) {
      setError(paymentId ? `The invoice exists in Payments but couldn't be attached here: ${errorMessage(createError)}` : errorMessage(createError, "The invoice wasn't created."));
    } finally {
      setBusy(false);
    }
  }

  if (!orders.length) {
    return (
      <div className="space-y-3">
        <Status tone="warning">Invoices belong to an order. Link a quote order to this opportunity (Quote) or close it as won to create its order, then invoice here.</Status>
        <Link href="/admin/payments" className="text-xs underline">Open Payments</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {detail.payments.length > 0 && (
        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Existing invoices and payments</p>
          {detail.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between gap-2">
              <span>{payment.invoice_number ?? "Invoice"} · <Badge variant="outline" className="text-[10px]">{human(payment.status)}</Badge></span>
              <span className="text-xs text-muted-foreground">{usd(payment.amount)} · {fmtDateTime(payment.created_at)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormLabel label="Order" className="sm:col-span-2">
          <SelectField value={orderId} onChange={(event) => setOrderId(event.target.value)}>
            {orders.map((order) => <option key={order.id} value={order.id}>{order.order_number ?? order.id.slice(0, 8)} · {human(order.status)} · {usd(order.total)}{order.id === o.won_order_id ? " · won order" : ""}</option>)}
          </SelectField>
        </FormLabel>
        <FormLabel label="Amount"><Input type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></FormLabel>
        <FormLabel label="Invoice number (optional)"><Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></FormLabel>
        <FormLabel label="Due date"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></FormLabel>
        <FormLabel label="Terms"><Input value={terms} onChange={(event) => setTerms(event.target.value)} /></FormLabel>
        <FormLabel label="Line description" className="sm:col-span-2"><Input value={description} onChange={(event) => setDescription(event.target.value)} /></FormLabel>
        <FormLabel label="Send to customer" className="sm:col-span-2">
          <SelectField value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}>
            <option value="none">Don&apos;t send yet</option>
            <option value="email" disabled={!contactEmail(detail)}>Email{contactEmail(detail) ? ` · ${contactEmail(detail)}` : " (no email on file)"}</option>
            <option value="sms" disabled={!contactPhone(detail)}>Text{contactPhone(detail) ? ` · ${contactPhone(detail)}` : " (no phone on file)"}</option>
            <option value="both" disabled={!contactEmail(detail) || !contactPhone(detail)}>Email and text</option>
          </SelectField>
        </FormLabel>
      </div>
      <p className="text-[11px] text-muted-foreground">Creates the invoice in Payments on the selected order. Payment status always comes from Payments.</p>
      {error && <Status tone="error">{error}</Status>}
      <Footer>
        <Button onClick={() => void create()} disabled={busy || !orderId || !(Number(amount) > 0)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} {channel === "none" ? "Create invoice" : "Create and send"}
        </Button>
      </Footer>
    </div>
  );
}
