"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Disc,
  Download,
  FileText,
  LogOut,
  Mail,
  MessageSquare,
  Mic,
  MicOff,
  Moon,
  Pause,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Play,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Voicemail,
  X,
} from "lucide-react";

import { getCurrentAdminProfile } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import { AdminEmail } from "@/components/admin/admin-email";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ────────────────────────────────────────────────────────────────────

type TwilioCall = {
  sid: string;
  to: string;
  from: string;
  status: string;
  direction: string;
  duration: string;
  price: string | null;
  priceUnit: string;
  dateCreated: string;
  startTime: string | null;
  endTime: string | null;
};

type TwilioRecording = {
  sid: string;
  callSid: string;
  duration: string;
  status: string;
  source: string;
  dateCreated: string;
  audioUrl: string;
};

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: "user" | "contact";
};

type DeviceStatus = "unregistered" | "registering" | "registered" | "error";
type ActiveCallState = "idle" | "connecting" | "ringing" | "active" | "disconnecting";

type CommunicationsTab = "calls" | "sms" | "contacts" | "ai-voice" | "email";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return phone;
}

// Normalize a phone number to its last 10 digits for reliable matching
// across formats like "+14803527598", "14803527598", and "4803527598".
function normalizeNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function formatDuration(seconds: string | number): string {
  const s = Number(seconds);
  if (!s || isNaN(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatDateTime(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(date));
}

function formatDateShort(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date));
}

function formatEstCost(price: string | null): string {
  if (!price) return "—";
  const n = Math.abs(Number(price));
  return `$${n.toFixed(4)}`;
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

async function getAdminToken(): Promise<string> {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required.");
  return token;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function CallStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "in-progress": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "no-answer": "bg-red-500/15 text-red-600 dark:text-red-400",
    busy: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    canceled: "bg-secondary text-secondary-foreground",
    queued: "bg-secondary text-secondary-foreground",
    ringing: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  };
  const labels: Record<string, string> = {
    "no-answer": "No Answer",
    "in-progress": "In Progress",
  };
  return (
    <Badge className={cn("text-[10px] px-1.5 py-0", styles[status] ?? "bg-secondary text-secondary-foreground")}>
      {labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function CallDirectionIcon({ direction, status }: { direction: string; status: string }) {
  const isOut = direction.startsWith("outbound");
  const missed = status === "no-answer" || status === "busy" || status === "failed";
  if (missed) return <PhoneMissed className="h-4 w-4 text-red-500" />;
  if (isOut) return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
  return <PhoneIncoming className="h-4 w-4 text-emerald-500" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminCommunications() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [activeTab, setActiveTab] = useState<CommunicationsTab>("calls");

  // Dialer state
  const [dialInput, setDialInput] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("unregistered");
  const [callState, setCallState] = useState<ActiveCallState>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(process.env.NEXT_PUBLIC_TWILIO_PHONE || "");
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState("");

  // Active call tracking
  const [activeCallSid, setActiveCallSid] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  // Call history state
  const [calls, setCalls] = useState<TwilioCall[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<"calls" | "voicemail">("calls");
  const [directionFilter, setDirectionFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [numberFilter, setNumberFilter] = useState<string | null>(null);
  const [expandedCallSid, setExpandedCallSid] = useState<string | null>(null);
  const [callRecordings, setCallRecordings] = useState<Record<string, TwilioRecording[]>>({});
  const [loadingRecordings, setLoadingRecordings] = useState<Record<string, boolean>>({});
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [transcribing, setTranscribing] = useState<Record<string, boolean>>({});

  // Notes state
  type CallNote = { id: string; details: { note: string }; created_at: string };
  const [callNotes, setCallNotes] = useState<Record<string, CallNote[]>>({});
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<Record<string, boolean>>({});
  const [deletingNote, setDeletingNote] = useState<Record<string, boolean>>({});

  // Contacts state
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactSearch, setContactSearch] = useState("");

  // SMS state
  const [smsTo, setSmsTo] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState("");

  // Refs for Twilio Device
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeCallRef = useRef<any>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Boot
  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }
      setAuthState("allowed");
      initTwilioDevice();
      loadCalls();
      loadContacts();
    }
    boot();
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      deviceRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init Twilio Device
  async function initTwilioDevice() {
    setDeviceStatus("registering");
    setDeviceError("");
    try {
      const token = await getAdminToken();
      const res = await fetch("/api/admin/communications/token", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeviceError(data.error || "Could not get Twilio token.");
        setDeviceStatus("error");
        return;
      }
      const data = await res.json();
      if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      if (data.phoneNumbers?.length) {
        setAvailableNumbers(data.phoneNumbers);
        const defaultId = data.defaultPhoneNumber || data.phoneNumbers[0];
        setSelectedCallerId((prev) => prev || defaultId);
      }

      const { Device, Call } = await import("@twilio/voice-sdk");
      void Call; // imported for type resolution
      const device = new Device(data.token, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        codecPreferences: ["opus", "pcmu"] as any,
        sounds: {},
      });

      device.on("registered", () => setDeviceStatus("registered"));
      device.on("error", (err: Error) => {
        setDeviceStatus("error");
        setDeviceError(err.message || "Twilio device error.");
      });
      device.on("incoming", (call: unknown) => handleIncomingCall(call));
      device.on("tokenWillExpire", () => initTwilioDevice());

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      setDeviceStatus("error");
      setDeviceError(err instanceof Error ? err.message : "Could not initialize Twilio.");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleIncomingCall(call: any) {
    const from = call.parameters?.From || "Unknown";
    if (window.confirm(`Incoming call from ${formatPhone(from)}. Accept?`)) {
      call.accept();
      activeCallRef.current = call;
      setCallState("active");
      startCallTimer();
      call.on("disconnect", endCall);
    } else {
      call.reject();
    }
  }

  function startCallTimer() {
    setCallDuration(0);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
  }

  function endCall() {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    activeCallRef.current = null;
    setCallState("idle");
    setIsMuted(false);
    setIsOnHold(false);
    setCallDuration(0);
    setActiveCallSid("");
    setIsRecording(false);
    // Refresh call history after a short delay
    setTimeout(() => loadCalls(), 3000);
  }

  async function makeCall() {
    if (!deviceRef.current || !dialInput.trim()) return;
    setCallState("connecting");
    try {
      const call = await deviceRef.current.connect({ params: { To: dialInput.trim(), callerId: selectedCallerId } });
      activeCallRef.current = call;
      call.on("ringing", () => setCallState("ringing"));
      call.on("accept", () => {
        setCallState("active");
        startCallTimer();
        setActiveCallSid(call.parameters?.CallSid || "");
      });
      call.on("disconnect", endCall);
      call.on("cancel", endCall);
      call.on("reject", endCall);
    } catch (err) {
      setCallState("idle");
      setDeviceError(err instanceof Error ? err.message : "Call failed.");
    }
  }

  async function startRecording() {
    if (!activeCallSid || isRecording) return;
    setIsRecording(true);
    try {
      const token = await getAdminToken();
      await fetch("/api/admin/communications/calls/record", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ callSid: activeCallSid }),
      });
    } catch {
      setIsRecording(false);
    }
  }

  function hangUp() {
    activeCallRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
    endCall();
  }

  function toggleMute() {
    if (!activeCallRef.current) return;
    const next = !isMuted;
    activeCallRef.current.mute(next);
    setIsMuted(next);
  }

  function pressKey(key: string) {
    if (callState === "active") {
      activeCallRef.current?.sendDigits(key);
    }
    setDialInput((prev) => prev + key);
  }

  // Call history
  async function loadCalls(voicemail = false) {
    setCallsLoading(true);
    try {
      const token = await getAdminToken();
      const url = voicemail
        ? "/api/admin/communications/calls?voicemail=true"
        : "/api/admin/communications/calls?limit=50";
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
      }
    } finally {
      setCallsLoading(false);
    }
  }

  async function toggleCallExpand(sid: string) {
    if (expandedCallSid === sid) {
      setExpandedCallSid(null);
      return;
    }
    setExpandedCallSid(sid);
    if (!callRecordings[sid] && !loadingRecordings[sid]) {
      setLoadingRecordings((prev) => ({ ...prev, [sid]: true }));
      try {
        const token = await getAdminToken();
        const res = await fetch(`/api/admin/communications/recordings?callSid=${encodeURIComponent(sid)}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCallRecordings((prev) => ({ ...prev, [sid]: data.recordings ?? [] }));
        }
      } finally {
        setLoadingRecordings((prev) => ({ ...prev, [sid]: false }));
      }
    }
    if (!callNotes[sid]) {
      loadNotes(sid);
    }
  }

  async function transcribeRecording(recordingSid: string) {
    setTranscribing((prev) => ({ ...prev, [recordingSid]: true }));
    try {
      const token = await getAdminToken();
      const res = await fetch("/api/admin/communications/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ recordingSid }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTranscripts((prev) => ({ ...prev, [recordingSid]: data.transcript }));
      } else {
        setTranscripts((prev) => ({ ...prev, [recordingSid]: data.error || "Transcription failed." }));
      }
    } finally {
      setTranscribing((prev) => ({ ...prev, [recordingSid]: false }));
    }
  }

  // Notes
  async function loadNotes(callSid: string) {
    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/communications/calls/notes?callSid=${encodeURIComponent(callSid)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCallNotes((prev) => ({ ...prev, [callSid]: data.notes ?? [] }));
      }
    } catch { /* silent */ }
  }

  async function saveNote(callSid: string) {
    const note = (noteInput[callSid] || "").trim();
    if (!note) return;
    setSavingNote((prev) => ({ ...prev, [callSid]: true }));
    try {
      const token = await getAdminToken();
      await fetch("/api/admin/communications/calls/notes", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ callSid, note }),
      });
      setNoteInput((prev) => ({ ...prev, [callSid]: "" }));
      await loadNotes(callSid);
    } finally {
      setSavingNote((prev) => ({ ...prev, [callSid]: false }));
    }
  }

  async function deleteNote(callSid: string, noteId: string) {
    setDeletingNote((prev) => ({ ...prev, [noteId]: true }));
    try {
      const token = await getAdminToken();
      await fetch(`/api/admin/communications/calls/notes?id=${encodeURIComponent(noteId)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      await loadNotes(callSid);
    } finally {
      setDeletingNote((prev) => ({ ...prev, [noteId]: false }));
    }
  }

  // Contacts
  async function loadContacts() {
    try {
      const token = await getAdminToken();
      const [usersRes, contactsRes] = await Promise.all([
        fetch("/api/admin/users", { headers: { authorization: `Bearer ${token}` } }),
        fetch("/api/admin/contact-submissions", { headers: { authorization: `Bearer ${token}` } }),
      ]);
      const rows: ContactRow[] = [];
      if (usersRes.ok) {
        const data = await usersRes.json();
        (data.users ?? []).forEach((u: { id: string; full_name?: string; email?: string; phone?: string; company?: string }) => {
          rows.push({ id: u.id, name: u.full_name || u.email || "Unknown", email: u.email || null, phone: u.phone || null, company: u.company || null, source: "user" });
        });
      }
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        (data.submissions ?? []).forEach((s: { id: string; first_name: string; last_name?: string; email: string; phone?: string; company?: string }) => {
          rows.push({
            id: s.id,
            name: [s.first_name, s.last_name].filter(Boolean).join(" "),
            email: s.email,
            phone: s.phone || null,
            company: s.company || null,
            source: "contact",
          });
        });
      }
      setContacts(rows);
    } catch { /* silent */ }
  }

  // SMS send
  async function sendSms() {
    if (!smsTo.trim() || !smsBody.trim()) return;
    setSmsSending(true);
    setSmsStatus("");
    try {
      const token = await getAdminToken();
      const res = await fetch("/api/admin/messaging/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel: "sms", mode: "single", recipient: smsTo.trim(), body: smsBody.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSmsStatus(`Sent successfully.`);
        setSmsBody("");
      } else {
        setSmsStatus(data.error || "Send failed.");
      }
    } catch {
      setSmsStatus("Send failed.");
    } finally {
      setSmsSending(false);
    }
  }

  // Derived
  const filteredContacts = useMemo(() => {
    const needle = contactSearch.toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((c) =>
      [c.name, c.email, c.phone, c.company].some((v) => String(v || "").toLowerCase().includes(needle)),
    );
  }, [contacts, contactSearch]);

  const visibleCalls = useMemo(() => {
    let list = calls;
    if (historyTab === "voicemail") {
      list = list.filter((c) => c.direction === "inbound" && ["no-answer", "completed"].includes(c.status));
    } else if (directionFilter !== "all") {
      list = list.filter((c) =>
        directionFilter === "outbound" ? c.direction.startsWith("outbound") : !c.direction.startsWith("outbound"),
      );
    }
    if (numberFilter) {
      list = list.filter((c) => normalizeNumber(c.to) === numberFilter || normalizeNumber(c.from) === numberFilter);
    }
    return list;
  }, [calls, historyTab, directionFilter, numberFilter]);

  const isCallActive = callState !== "idle";

  // ─── Sidebar nav shared with other admin pages ──────────────────────────────
  const orders = [] as { id: string }[];
  const payments = [] as { id: string }[];
  const messages = [] as { id: string }[];

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-[45px] px-2 pt-[5px]">
            <a href="/admin">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
            </a>
          </div>
          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                {group.label !== "Main" && (
                  <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
                )}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link
                      href={href}
                      key={label}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && orders.length > 0 && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Payments" && payments.length > 0 && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && messages.length > 0 && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="mb-3 border-t border-border" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold">JW</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">Jeremy Waters</div>
                <div className="truncate text-[10px] text-muted-foreground">Owner - Super Admin</div>
              </div>
              <button onClick={handleSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span>Super Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Communications</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <AdminNotificationBell />
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && (
            <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>
          )}
          {authState === "denied" && (
            <Card className="border-red-500/30">
              <CardContent className="p-5">
                <div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div>
                <Button className="mt-4" asChild><a href="/login?redirect=/admin/communications">Go to login</a></Button>
              </CardContent>
            </Card>
          )}

          {authState === "allowed" && (
            <>
              {/* Page heading */}
              <div className="mb-5">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Communications</h1>
                  <DeviceStatusDot status={deviceStatus} />
                </div>
                <p className="text-sm text-muted-foreground">Voice calls, SMS messaging, contacts, and AI voice — powered by Twilio.</p>
              </div>

              {/* Tab navigation */}
              <div className="mb-5 flex gap-1 overflow-x-auto border-b pb-0 scrollbar-none">
                {([
                  ["calls", PhoneCall, "Calls"],
                  ["sms", MessageSquare, "SMS"],
                  ["contacts", Users, "Contacts"],
                  ["ai-voice", Bot, "AI Voice"],
                  ["email", Mail, "Email"],
                ] as const).map(([tab, Icon, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium -mb-px transition-colors",
                      activeTab === tab
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </div>

              {/* Device error banner */}
              {deviceError && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  <span className="flex-1">{deviceError}</span>
                  <button onClick={initTwilioDevice} className="shrink-0 rounded-md border px-2 py-0.5 text-xs hover:bg-red-100 dark:hover:bg-red-900/40">Retry</button>
                  <button onClick={() => setDeviceError("")} className="shrink-0"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              {/* ─── CALLS TAB ─── */}
              {activeTab === "calls" && (
                <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
                  {/* Dialpad */}
                  <Card className="h-fit">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">Dialpad</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Phone number display */}
                      <div className="relative">
                        <input
                          type="tel"
                          value={dialInput}
                          onChange={(e) => setDialInput(e.target.value)}
                          placeholder="Enter phone number"
                          className="h-11 w-full rounded-lg border bg-secondary/30 px-4 text-center text-base font-mono tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={isCallActive}
                        />
                        {dialInput && !isCallActive && (
                          <button
                            onClick={() => setDialInput("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Active call display */}
                      {isCallActive && (
                        <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 text-center">
                          <div className="text-xs text-muted-foreground mb-1">
                            {callState === "connecting" && "Connecting..."}
                            {callState === "ringing" && "Ringing..."}
                            {callState === "active" && formatDuration(callDuration)}
                            {callState === "disconnecting" && "Disconnecting..."}
                          </div>
                          <div className="text-sm font-semibold">{formatPhone(dialInput) || "Unknown"}</div>
                        </div>
                      )}

                      {/* Key pad */}
                      {!isCallActive && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            ["1", ""], ["2", "ABC"], ["3", "DEF"],
                            ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
                            ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
                            ["*", ""], ["0", ""], ["#", ""],
                          ].map(([digit, letters]) => (
                            <button
                              key={digit}
                              onClick={() => pressKey(digit)}
                              className="flex h-14 flex-col items-center justify-center rounded-xl border bg-secondary/30 font-semibold transition-colors hover:bg-accent active:scale-95"
                            >
                              <span className="text-xl leading-none">{digit}</span>
                              {letters && <span className="mt-0.5 text-[9px] font-medium tracking-widest text-muted-foreground">{letters}</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* In-call actions */}
                      {isCallActive && (
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            onClick={toggleMute}
                            className={cn(
                              "flex h-14 flex-col items-center justify-center rounded-xl border gap-1 text-xs font-medium transition-colors",
                              isMuted ? "bg-red-500/15 border-red-400 text-red-600" : "bg-secondary/30 hover:bg-accent",
                            )}
                          >
                            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            {isMuted ? "Unmute" : "Mute"}
                          </button>
                          <button
                            onClick={() => setIsOnHold(!isOnHold)}
                            className={cn(
                              "flex h-14 flex-col items-center justify-center rounded-xl border gap-1 text-xs font-medium transition-colors",
                              isOnHold ? "bg-orange-500/15 border-orange-400 text-orange-600" : "bg-secondary/30 hover:bg-accent",
                            )}
                          >
                            <Pause className="h-4 w-4" />
                            {isOnHold ? "Resume" : "Hold"}
                          </button>
                          <button
                            onClick={startRecording}
                            disabled={isRecording || !activeCallSid}
                            className={cn(
                              "flex h-14 flex-col items-center justify-center rounded-xl border gap-1 text-xs font-medium transition-colors",
                              isRecording
                                ? "bg-red-500/15 border-red-400 text-red-600"
                                : "bg-secondary/30 hover:bg-accent disabled:opacity-40",
                            )}
                          >
                            {isRecording
                              ? <Circle className="h-4 w-4 fill-red-500 text-red-500 animate-pulse" />
                              : <Disc className="h-4 w-4" />}
                            {isRecording ? "Recording" : "Record"}
                          </button>
                          <button className="flex h-14 flex-col items-center justify-center rounded-xl border bg-secondary/30 gap-1 text-xs font-medium hover:bg-accent">
                            <Phone className="h-4 w-4" />
                            Keypad
                          </button>
                        </div>
                      )}

                      {/* Call / Hang up button */}
                      {!isCallActive ? (
                        <button
                          onClick={makeCall}
                          disabled={!dialInput.trim() || deviceStatus !== "registered"}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-white transition-all hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Phone className="h-5 w-5" />
                          Call
                        </button>
                      ) : (
                        <button
                          onClick={hangUp}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-500 font-semibold text-white transition-all hover:bg-red-600"
                        >
                          <PhoneOff className="h-5 w-5" />
                          Hang up
                        </button>
                      )}

                      {/* Device status */}
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          deviceStatus === "registered" ? "bg-emerald-500" : deviceStatus === "registering" ? "bg-yellow-500 animate-pulse" : "bg-red-500",
                        )} />
                        {deviceStatus === "registered" && "Ready to call"}
                        {deviceStatus === "registering" && "Connecting..."}
                        {deviceStatus === "unregistered" && "Not connected"}
                        {deviceStatus === "error" && "Connection error"}
                        {phoneNumber && <span className="ml-1 opacity-70">· {formatPhone(phoneNumber)}</span>}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Call history */}
                  <div>
                    {/* Caller ID selector */}
                    {availableNumbers.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dial out from</div>
                        <div className="flex flex-wrap gap-2">
                          {availableNumbers.map((num) => {
                            const isSelected = num === selectedCallerId;
                            return (
                              <button
                                key={num}
                                onClick={() => setSelectedCallerId(num)}
                                disabled={isCallActive}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                                  isSelected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-accent hover:text-foreground",
                                )}
                              >
                                <Phone className={cn("h-3 w-3", isSelected && "text-primary")} />
                                {formatPhone(num)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mb-3 flex items-center justify-between">
                      {/* Sub-tabs: Call History / Voicemail */}
                      <div className="flex items-center gap-1 rounded-lg border bg-secondary/40 p-1">
                        <button
                          onClick={() => { setHistoryTab("calls"); loadCalls(false); }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            historyTab === "calls" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Clock className="h-3.5 w-3.5" />Call History
                        </button>
                        <button
                          onClick={() => { setHistoryTab("voicemail"); }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            historyTab === "voicemail" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Voicemail className="h-3.5 w-3.5" />Voicemail
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{visibleCalls.length} {historyTab === "voicemail" ? "messages" : "calls"}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadCalls(historyTab === "voicemail")}
                          disabled={callsLoading}
                          className="h-7 gap-1.5 text-xs"
                        >
                          <RefreshCw className={cn("h-3 w-3", callsLoading && "animate-spin")} />Refresh
                        </Button>
                      </div>
                    </div>

                    {/* Direction filter: All / Inbound / Outbound */}
                    {historyTab === "calls" && (
                      <div className="mb-3 flex items-center gap-1.5">
                        {([
                          ["all", "All", null],
                          ["inbound", "Inbound", PhoneIncoming],
                          ["outbound", "Outbound", PhoneOutgoing],
                        ] as const).map(([key, label, Icon]) => {
                          const isActive = directionFilter === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setDirectionFilter(key)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                isActive
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-secondary/30 text-muted-foreground hover:bg-accent hover:text-foreground",
                              )}
                            >
                              {Icon && <Icon className="h-3.5 w-3.5" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Active number filter */}
                    {numberFilter && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="text-muted-foreground">Showing calls with</span>
                        <span className="font-semibold">{formatPhone(numberFilter)}</span>
                        <button
                          onClick={() => setNumberFilter(null)}
                          className="ml-auto flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />Clear filter
                        </button>
                      </div>
                    )}

                    {/* Call list */}
                    <div className="space-y-2">
                      {callsLoading && !calls.length && (
                        Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary" />
                        ))
                      )}
                      {!callsLoading && !visibleCalls.length && (
                        <Card>
                          <CardContent className="p-8 text-center text-muted-foreground">
                            {numberFilter
                              ? `No ${historyTab === "voicemail" ? "voicemail" : "calls"} with ${formatPhone(numberFilter)}.`
                              : historyTab === "voicemail" ? "No voicemail messages." : "No call history yet."}
                          </CardContent>
                        </Card>
                      )}
                      {visibleCalls.map((call) => {
                        const isExpanded = expandedCallSid === call.sid;
                        const recordings = callRecordings[call.sid] ?? [];
                        const loadingRec = loadingRecordings[call.sid];
                        const displayNumber = call.direction.startsWith("outbound") ? call.to : call.from;
                        const hasRecording = isExpanded && recordings.length > 0;

                        return (
                          <Card key={call.sid} className={cn("overflow-hidden transition-shadow", isExpanded && "ring-1 ring-primary/20")}>
                            {/* Call row header */}
                            <button
                              onClick={() => toggleCallExpand(call.sid)}
                              className="flex w-full items-center gap-3 p-3 hover:bg-accent/40 transition-colors text-left"
                            >
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-secondary/50">
                                <CallDirectionIcon direction={call.direction} status={call.status} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const digits = normalizeNumber(displayNumber);
                                      setNumberFilter((prev) => (prev === digits ? null : digits));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const digits = normalizeNumber(displayNumber);
                                        setNumberFilter((prev) => (prev === digits ? null : digits));
                                      }
                                    }}
                                    className="font-semibold text-sm cursor-pointer rounded hover:text-primary hover:underline underline-offset-2"
                                    title="Show only calls with this number"
                                  >
                                    {formatPhone(displayNumber)}
                                  </span>
                                  <CallStatusBadge status={call.status} />
                                  {recordings.length > 0 && (
                                    <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] px-1.5 py-0">
                                      <Play className="mr-0.5 h-2.5 w-2.5 inline" />Recorded
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDuration(call.duration)}</span>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{formatDateShort(call.dateCreated)}</span>
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                              </div>
                            </button>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="border-t bg-secondary/10">
                                <div className="grid grid-cols-4 gap-4 px-4 py-3">
                                  <div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Direction</div>
                                    <div className="text-sm font-medium mt-0.5">
                                      {call.direction.startsWith("outbound") ? "Outbound" : "Inbound"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Duration</div>
                                    <div className="text-sm font-medium mt-0.5">{formatDuration(call.duration)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Date &amp; Time</div>
                                    <div className="text-sm font-medium mt-0.5">{formatDateTime(call.dateCreated)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Est. Cost</div>
                                    <div className="text-sm font-medium mt-0.5 text-emerald-600 dark:text-emerald-400">
                                      {formatEstCost(call.price)}
                                    </div>
                                  </div>
                                </div>

                                {/* Dial back quick action */}
                                <div className="flex items-center gap-2 px-4 pb-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() => {
                                      setActiveTab("calls");
                                      setDialInput(displayNumber);
                                    }}
                                  >
                                    <Phone className="h-3 w-3" />Call back
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() => {
                                      setActiveTab("sms");
                                      setSmsTo(displayNumber);
                                    }}
                                  >
                                    <MessageSquare className="h-3 w-3" />SMS
                                  </Button>
                                </div>

                                {/* Recordings & Transcription */}
                                {loadingRec && (
                                  <div className="border-t px-4 py-3 text-xs text-muted-foreground">Loading recordings...</div>
                                )}
                                {!loadingRec && recordings.length === 0 && (
                                  <div className="border-t px-4 py-2.5">
                                    <p className="text-xs text-muted-foreground italic">No recording for this call.</p>
                                  </div>
                                )}
                                {!loadingRec && recordings.map((rec) => (
                                  <div key={rec.sid} className="border-t bg-background/30">
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                      <Disc className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      <audio
                                        controls
                                        src={rec.audioUrl}
                                        className="h-7 flex-1"
                                        style={{ colorScheme: "dark" }}
                                      />
                                      <span className="text-xs text-muted-foreground">{formatDuration(rec.duration)}</span>
                                      <a
                                        href={rec.audioUrl}
                                        download={`recording-${rec.sid}.mp3`}
                                        className="grid h-6 w-6 place-items-center rounded-md border text-muted-foreground hover:text-foreground"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                    <div className="border-t px-4 py-2.5">
                                      {transcripts[rec.sid] ? (
                                        <div>
                                          <div className="mb-1.5 flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI Transcript</span>
                                          </div>
                                          <p className="text-sm leading-5 text-foreground/80">{transcripts[rec.sid]}</p>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => transcribeRecording(rec.sid)}
                                          disabled={transcribing[rec.sid]}
                                          className="flex items-center gap-1.5 rounded-lg border bg-secondary/30 px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                                        >
                                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                                          {transcribing[rec.sid] ? "Transcribing..." : "Transcribe with AI"}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* Notes */}
                                <div className="border-t bg-background/20 px-4 py-3">
                                  <div className="mb-2 flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Call Notes</span>
                                  </div>

                                  {/* Saved notes */}
                                  {(callNotes[call.sid] ?? []).length > 0 && (
                                    <div className="mb-2 space-y-1.5">
                                      {(callNotes[call.sid] ?? []).map((n) => (
                                        <div key={n.id} className="group flex items-start gap-2 rounded-lg border bg-secondary/30 px-3 py-2">
                                          <p className="flex-1 text-xs leading-5 text-foreground/90">{n.details.note}</p>
                                          <div className="flex shrink-0 items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] text-muted-foreground">
                                              {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(n.created_at))}
                                            </span>
                                            <button
                                              onClick={() => deleteNote(call.sid, n.id)}
                                              disabled={deletingNote[n.id]}
                                              className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:text-red-500 disabled:opacity-40"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* New note input */}
                                  <div className="flex gap-2">
                                    <textarea
                                      value={noteInput[call.sid] || ""}
                                      onChange={(e) => setNoteInput((prev) => ({ ...prev, [call.sid]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(call.sid);
                                      }}
                                      placeholder="Add a note... (⌘↵ to save)"
                                      rows={2}
                                      className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    <button
                                      onClick={() => saveNote(call.sid)}
                                      disabled={savingNote[call.sid] || !(noteInput[call.sid] || "").trim()}
                                      className="shrink-0 self-end rounded-lg border bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                                    >
                                      {savingNote[call.sid] ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── SMS TAB ─── */}
              {activeTab === "sms" && (
                <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">Send SMS</CardTitle>
                      </div>
                      <CardDescription>Send a text message via your Twilio number.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="mb-1.5 text-xs font-medium text-muted-foreground">To</div>
                        <Input value={smsTo} onChange={(e) => setSmsTo(e.target.value)} placeholder="+14805551234" />
                      </div>
                      <div>
                        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Message</div>
                        <Textarea
                          value={smsBody}
                          onChange={(e) => setSmsBody(e.target.value)}
                          placeholder="Type your message..."
                          className="min-h-[120px] resize-none"
                        />
                        <div className="mt-1 text-[11px] text-muted-foreground text-right">{smsBody.length}/1600</div>
                      </div>
                      {smsStatus && (
                        <div className={cn(
                          "rounded-lg border px-3 py-2 text-sm",
                          smsStatus.includes("fail") || smsStatus.includes("error")
                            ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                            : "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
                        )}>
                          {smsStatus}
                        </div>
                      )}
                      <Button
                        className="w-full gap-2"
                        onClick={sendSms}
                        disabled={smsSending || !smsTo.trim() || !smsBody.trim()}
                      >
                        <Send className="h-4 w-4" />
                        {smsSending ? "Sending..." : "Send message"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Quick send to contacts</CardTitle>
                      <CardDescription>Click a contact to pre-fill the SMS form.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ContactSearchList
                        contacts={filteredContacts}
                        search={contactSearch}
                        onSearchChange={setContactSearch}
                        onCallContact={(phone) => { setActiveTab("calls"); setDialInput(phone); }}
                        onSmsContact={(phone) => setSmsTo(phone)}
                        onEmailContact={() => {}}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ─── CONTACTS TAB ─── */}
              {activeTab === "contacts" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="relative w-72">
                      <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="h-8 pl-9 text-xs"
                        placeholder="Search contacts..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={loadContacts} className="gap-1.5 text-xs h-8">
                      <RefreshCw className="h-3.5 w-3.5" />Refresh
                    </Button>
                  </div>
                  <ContactSearchList
                    contacts={filteredContacts}
                    search={contactSearch}
                    onSearchChange={setContactSearch}
                    onCallContact={(phone) => { setActiveTab("calls"); setDialInput(phone); }}
                    onSmsContact={(phone) => { setActiveTab("sms"); setSmsTo(phone); }}
                    onEmailContact={() => {}}
                    showFull
                  />
                </div>
              )}

              {/* ─── AI VOICE TAB ─── */}
              {activeTab === "ai-voice" && (
                <AiVoicePanel phoneNumber={phoneNumber} />
              )}

              {/* ─── EMAIL TAB ─── */}
              {activeTab === "email" && (
                <AdminEmail />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeviceStatusDot({ status }: { status: DeviceStatus }) {
  return (
    <div className="flex items-center gap-1 rounded-full border bg-secondary/50 px-2 py-0.5 text-[10px] font-medium">
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "registered" ? "bg-emerald-500" :
        status === "registering" ? "bg-yellow-500 animate-pulse" : "bg-red-500",
      )} />
      <span className="text-muted-foreground">
        {status === "registered" ? "Ready" : status === "registering" ? "Connecting" : "Offline"}
      </span>
    </div>
  );
}

function ContactSearchList({
  contacts,
  search,
  onSearchChange,
  onCallContact,
  onSmsContact,
  onEmailContact,
  showFull = false,
}: {
  contacts: ContactRow[];
  search: string;
  onSearchChange: (v: string) => void;
  onCallContact: (phone: string) => void;
  onSmsContact: (phone: string) => void;
  onEmailContact: (email: string) => void;
  showFull?: boolean;
}) {
  return (
    <div>
      {showFull && (
        <div className="relative mb-3 hidden">
          <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-8 pl-9 text-xs"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      )}
      <div className="max-h-[600px] space-y-1.5 overflow-y-auto pr-1">
        {!contacts.length && (
          <div className="py-8 text-center text-sm text-muted-foreground">No contacts found.</div>
        )}
        {contacts.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg border bg-secondary/20 px-3 py-2.5 hover:bg-accent/40 transition-colors"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {c.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {c.phone && <span>{c.phone}</span>}
                {c.email && <span className="truncate">{c.email}</span>}
              </div>
              {showFull && c.company && <div className="text-[11px] text-muted-foreground">{c.company}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {c.phone && (
                <button
                  onClick={() => onCallContact(c.phone!)}
                  className="grid h-7 w-7 place-items-center rounded-md border bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                  title="Call"
                >
                  <Phone className="h-3.5 w-3.5" />
                </button>
              )}
              {c.phone && (
                <button
                  onClick={() => onSmsContact(c.phone!)}
                  className="grid h-7 w-7 place-items-center rounded-md border bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                  title="SMS"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              )}
              {c.email && (
                <button
                  onClick={() => onEmailContact(c.email!)}
                  className="grid h-7 w-7 place-items-center rounded-md border bg-secondary hover:bg-accent transition-colors"
                  title="Email"
                >
                  <Mail className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiVoicePanel({ phoneNumber }: { phoneNumber: string }) {
  const webhookBase = typeof window !== "undefined" ? window.location.origin : "";
  const [greeting, setGreeting] = useState("Thank you for calling Ctrl Plus P. Our team will be right with you.");
  const [saved, setSaved] = useState(false);

  const saveGreeting = useCallback(() => {
    // Persist to env / DB in a real implementation
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">AI Voice Configuration</CardTitle>
          </div>
          <CardDescription>Configure how Twilio handles inbound calls and voicemail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Inbound greeting</div>
            <Textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Spoken when a customer calls your Twilio number.</p>
          </div>

          <div className="space-y-2">
            {[
              ["Your Twilio Number", phoneNumber || "Not configured"],
              ["Voice Webhook URL", `${webhookBase}/api/webhooks/twilio/voice`],
              ["Recording Status URL", `${webhookBase}/api/webhooks/twilio/recording-status`],
              ["Transcription", process.env.NEXT_PUBLIC_OPENAI_CONFIGURED === "true" ? "Enabled (OpenAI Whisper)" : "Add OPENAI_API_KEY to enable"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between rounded-lg border bg-secondary/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="ml-2 text-right font-mono text-xs break-all max-w-[240px]">{value}</span>
              </div>
            ))}
          </div>

          <Button onClick={saveGreeting} className="w-full gap-2" variant="outline">
            {saved ? "Saved!" : "Save greeting"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Setup checklist</CardTitle>
          <CardDescription>Required configuration to enable voice features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "TWILIO_ACCOUNT_SID", desc: "Your Twilio account identifier", env: "TWILIO_ACCOUNT_SID" },
            { label: "TWILIO_AUTH_TOKEN", desc: "Twilio auth token for REST API", env: "TWILIO_AUTH_TOKEN" },
            { label: "TWILIO_PHONE_NUMBER", desc: "Your Twilio phone number (+1...)", env: "TWILIO_PHONE_NUMBER" },
            { label: "TWILIO_API_KEY_SID", desc: "API key for Access Token generation", env: "TWILIO_API_KEY_SID" },
            { label: "TWILIO_API_KEY_SECRET", desc: "API key secret", env: "TWILIO_API_KEY_SECRET" },
            { label: "TWILIO_TWIML_APP_SID", desc: "TwiML App SID for browser calling", env: "TWILIO_TWIML_APP_SID" },
            { label: "OPENAI_API_KEY", desc: "Enables AI call transcription (Whisper)", env: "OPENAI_API_KEY" },
          ].map((item) => (
            <div key={item.env} className="flex items-start gap-2.5 rounded-lg border bg-secondary/20 px-3 py-2">
              <div className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/30 bg-secondary" />
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold">{item.label}</div>
                <div className="text-[11px] text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1">
            Set these in your <code className="font-mono">.env.local</code> file or Vercel environment variables.
            Point your Twilio TwiML App Voice URL to{" "}
            <span className="font-mono">{webhookBase}/api/webhooks/twilio/voice</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
