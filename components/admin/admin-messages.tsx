"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  BookOpen,
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Inbox,
  List,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sun,
  Table2,
  Trash2,
  User,
} from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData, markMessageRead } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData } from "@/lib/admin/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ───────────────────────────────────────────────────────────────────

type BookingTemplate = {
  id: string;
  name: string;
  channel: "email" | "sms";
  notification_type: string;
  subject?: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type MessagingConfig = {
  twilio?: { configured: boolean; phoneNumber: string; hasAccountSid: boolean; hasAuthToken: boolean; validateWebhook?: boolean; webhookUrl?: string };
  smtp?: { configured: boolean; host: string; port: string; secure: string; user: string; from: string; replyTo: string; hasPassword: boolean };
  imap?: { configured: boolean; host: string; port: string; secure: string; user: string; mailbox?: string; hasPassword: boolean };
  pop?: { configured: boolean; host: string; port: string; secure: string; user: string; hasPassword: boolean };
};

type ContactSubmission = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  created_at: string;
};

type ComposePrefill = {
  channel?: string;
  recipient?: string;
  subject?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(new Date(value))
    .replace(",", "");
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminMessages() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [config, setConfig] = useState<MessagingConfig | null>(null);
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState<"inbox" | "templates" | "contact">("inbox");
  const [templates, setTemplates] = useState<BookingTemplate[]>([]);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BookingTemplate | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Contact Page tab state
  const [contactSubmissions, setContactSubmissions] = useState<ContactSubmission[]>([]);
  const [contactView, setContactView] = useState<"table" | "list" | "calendar">("table");
  const [contactQuery, setContactQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactCalendarMonth, setContactCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }
      setAuthState("allowed");
      const [dashData, msgConfig, templateData, contactData] = await Promise.all([
        loadAdminDashboardData(),
        loadMessagingConfig(),
        loadBookingTemplates(),
        loadContactSubmissions(),
      ]);
      setData(dashData);
      setConfig(msgConfig);
      setTemplates(templateData);
      setContactSubmissions(contactData);
    }
    boot();
  }, []);

  async function refreshData() {
    const [nextData, nextConfig, nextTemplates, nextContacts] = await Promise.all([
      loadAdminDashboardData(),
      loadMessagingConfig(),
      loadBookingTemplates(),
      loadContactSubmissions(),
    ]);
    setData(nextData);
    setConfig(nextConfig);
    setTemplates(nextTemplates);
    setContactSubmissions(nextContacts);
  }

  async function refreshContacts() {
    const submissions = await loadContactSubmissions();
    setContactSubmissions(submissions);
  }

  async function deleteTemplate(id: string) {
    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/booking-templates?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setNotice(payload.error || "Could not delete template.");
        return;
      }
      setTemplates((current) => current.filter((t) => t.id !== id));
      setDeletingTemplateId(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete template.");
    }
  }

  async function syncEmailInbox() {
    setSyncing(true);
    setNotice("");
    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/messaging/sync-email", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not sync email.");
      setNotice(`Imported ${payload.imported || 0} email message${payload.imported === 1 ? "" : "s"}.`);
      await refreshData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not sync email.");
    } finally {
      setSyncing(false);
    }
  }

  async function openMessage(message: AdminDashboardData["messages"][number]) {
    setSelectedMessageId(message.id);
    if (message.read_at) return;
    setData((current) =>
      current
        ? { ...current, messages: current.messages.map((item) => item.id === message.id ? { ...item, read_at: new Date().toISOString() } : item) }
        : current,
    );
    try {
      await markMessageRead(message.id, message.order_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not mark message as read.");
    }
  }

  async function openContact(submission: ContactSubmission) {
    setSelectedContactId(submission.id);
    if (submission.status !== "new") return;
    setContactSubmissions((prev) => prev.map((s) => s.id === submission.id ? { ...s, status: "read" } : s));
    updateContactStatus(submission.id, "read").catch(() => {});
  }

  async function handleContactStatusChange(id: string, status: string) {
    setContactSubmissions((prev) => prev.map((s) => s.id === id ? { ...s, status: status as ContactSubmission["status"] } : s));
    await updateContactStatus(id, status).catch(() => {});
  }

  // Derived data
  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const users = data?.users ?? [];

  const visibleMessages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return messages;
    return messages.filter((m) =>
      [m.subject, m.body, m.channel, m.direction, m.order_id].some((v) => String(v || "").toLowerCase().includes(needle)),
    );
  }, [messages, query]);

  const visibleContacts = useMemo(() => {
    const needle = contactQuery.trim().toLowerCase();
    if (!needle) return contactSubmissions;
    return contactSubmissions.filter((s) =>
      [s.first_name, s.last_name, s.email, s.phone, s.company, s.subject, s.message].some((v) =>
        String(v || "").toLowerCase().includes(needle),
      ),
    );
  }, [contactSubmissions, contactQuery]);

  const inbound = messages.filter((m) => m.direction === "inbound");
  const outbound = messages.filter((m) => m.direction === "outbound");
  const unread = messages.filter((m) => !m.read_at);
  const configuredChannels = [config?.twilio?.configured, config?.smtp?.configured, config?.imap?.configured].filter(Boolean).length;
  const selectedMessage = useMemo(() => messages.find((m) => m.id === selectedMessageId) ?? null, [messages, selectedMessageId]);
  const selectedContact = useMemo(() => contactSubmissions.find((s) => s.id === selectedContactId) ?? null, [contactSubmissions, selectedContactId]);

  const contactNew = contactSubmissions.filter((s) => s.status === "new").length;
  const contactReplied = contactSubmissions.filter((s) => s.status === "replied").length;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const contactThisWeek = contactSubmissions.filter((s) => s.created_at >= weekAgo).length;

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
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
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
              <span className="font-medium text-foreground">Messages</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-8 rounded-lg pl-9 text-xs"
                  placeholder="Search messages, customers, orders..."
                  value={activeSection === "contact" ? contactQuery : query}
                  onChange={(e) => activeSection === "contact" ? setContactQuery(e.target.value) : setQuery(e.target.value)}
                />
              </div>
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
                <p className="mt-2 text-sm text-muted-foreground">Sign in with an active staff or admin account before opening messages.</p>
                <Button className="mt-4" asChild><a href="/login?redirect=/admin/messages">Go to login</a></Button>
              </CardContent>
            </Card>
          )}
          {authState === "allowed" && (
            <>
              {/* Page heading + actions */}
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Messaging command center</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                    Manage customer conversations, Twilio SMS, SMTP outbound email, IMAP inbox sync, notifications, templates, and contact form messages.
                  </p>
                </div>
                <div className="flex gap-2">
                  {activeSection === "inbox" ? (
                    <>
                      <Button onClick={() => setComposeOpen(true)}><Send className="h-4 w-4" /> New message</Button>
                      <Button variant="outline" onClick={syncEmailInbox} disabled={syncing || !config?.imap?.configured}>
                        <Inbox className="h-4 w-4" /> {syncing ? "Syncing..." : "Sync email"}
                      </Button>
                    </>
                  ) : activeSection === "contact" ? (
                    <Button variant="outline" onClick={refreshContacts}>
                      <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                  ) : (
                    <Button onClick={() => { setEditingTemplate(null); setTemplateFormOpen(true); }}>
                      <Plus className="h-4 w-4" /> New template
                    </Button>
                  )}
                </div>
              </div>

              {/* Tab nav */}
              <div className="mb-5 flex border-b border-border">
                <button
                  onClick={() => setActiveSection("inbox")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium -mb-px transition-colors",
                    activeSection === "inbox" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Inbox className="h-4 w-4" /> Messages
                </button>
                <button
                  onClick={() => setActiveSection("contact")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium -mb-px transition-colors",
                    activeSection === "contact" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <User className="h-4 w-4" /> Contact Page
                  {contactNew > 0 && (
                    <Badge className="h-4 bg-primary/20 px-1.5 text-[10px] text-foreground">{contactNew}</Badge>
                  )}
                </button>
                <button
                  onClick={() => setActiveSection("templates")}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium -mb-px transition-colors",
                    activeSection === "templates" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Calendar className="h-4 w-4" /> Booking Templates
                </button>
              </div>

              {notice && (
                <div className="mb-4 rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">{notice}</div>
              )}

              {/* ── Inbox section ── */}
              {activeSection === "inbox" && (
                <>
                  <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MessageStat label="Unread" value={String(unread.length)} hint="Visible unread records" />
                    <MessageStat label="Inbound" value={String(inbound.length)} hint="Customer replies" />
                    <MessageStat label="Outbound" value={String(outbound.length)} hint="Admin/system sent" />
                    <MessageStat label="Channels" value={`${configuredChannels}/3`} hint="SMS, SMTP, IMAP ready" />
                    <MessageStat label="Contacts" value={String(users.length)} hint="Reachable accounts" />
                  </section>

                  <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_380px]">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Inbox</CardTitle>
                        <CardDescription>Unread dashboard, email, SMS, and internal messages</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="pl-4">Message</TableHead>
                              <TableHead>Channel</TableHead>
                              <TableHead>Direction</TableHead>
                              <TableHead>Order</TableHead>
                              <TableHead className="w-[150px] min-w-[150px] whitespace-nowrap">Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleMessages.map((message) => (
                              <TableRow
                                key={message.id}
                                className="cursor-pointer hover:bg-accent/45"
                                tabIndex={0}
                                onClick={() => openMessage(message)}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMessage(message); } }}
                              >
                                <TableCell className="pl-4">
                                  <div className="flex items-center gap-2 font-medium">
                                    {!message.read_at && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                                    <span>{message.subject || "Untitled message"}</span>
                                  </div>
                                  <div className="line-clamp-1 text-xs text-muted-foreground">{message.body || "No body preview"}</div>
                                </TableCell>
                                <TableCell><ChannelBadge channel={message.channel} /></TableCell>
                                <TableCell>{human(message.direction)}</TableCell>
                                <TableCell className="font-mono text-xs">{message.order_id ? message.order_id.slice(0, 8) : "None"}</TableCell>
                                <TableCell className="w-[150px] min-w-[150px] whitespace-nowrap text-sm">{formatDate(message.created_at)}</TableCell>
                              </TableRow>
                            ))}
                            {!visibleMessages.length && (
                              <TableRow><TableCell className="p-6 text-center text-muted-foreground" colSpan={5}>No messages found.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <div className="space-y-4">
                      <ChannelCard icon={<Phone />} title="Twilio SMS" ready={Boolean(config?.twilio?.configured)} rows={[
                        ["Phone", config?.twilio?.phoneNumber || "Not set"],
                        ["Account SID", config?.twilio?.hasAccountSid ? "Configured" : "Missing"],
                        ["Auth token", config?.twilio?.hasAuthToken ? "Configured" : "Missing"],
                        ["Webhook", config?.twilio?.webhookUrl || "Set PUBLIC_APP_URL"],
                      ]} />
                      <ChannelCard icon={<Mail />} title="SMTP email" ready={Boolean(config?.smtp?.configured)} rows={[
                        ["From", config?.smtp?.from || "Not set"],
                        ["Server", [config?.smtp?.host, config?.smtp?.port].filter(Boolean).join(":") || "Missing"],
                        ["Password", config?.smtp?.hasPassword ? "Configured" : "Missing"],
                      ]} />
                      <ChannelCard icon={<Inbox />} title="IMAP inbox" ready={Boolean(config?.imap?.configured)} rows={[
                        ["User", config?.imap?.user || "Not set"],
                        ["Server", [config?.imap?.host, config?.imap?.port].filter(Boolean).join(":") || "Missing"],
                        ["Mailbox", config?.imap?.mailbox || "INBOX"],
                        ["Password", config?.imap?.hasPassword ? "Configured" : "Missing"],
                      ]} />
                    </div>
                  </section>

                  <section className="grid gap-4 xl:grid-cols-3">
                    <TemplateCard title="Order updates" items={["Proof ready", "Order in production", "Ready for pickup", "Order shipped"]} />
                    <TemplateCard title="Billing notices" items={["Invoice sent", "Payment reminder", "Payment received", "Refund processed"]} />
                    <TemplateCard title="Support replies" items={["Artwork issue", "Quote follow-up", "Customer question", "Internal note"]} />
                  </section>
                </>
              )}

              {/* ── Contact Page section ── */}
              {activeSection === "contact" && (
                <>
                  {/* Stats */}
                  <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MessageStat label="Total" value={String(contactSubmissions.length)} hint="All contact submissions" />
                    <MessageStat label="New" value={String(contactNew)} hint="Awaiting response" />
                    <MessageStat label="Replied" value={String(contactReplied)} hint="Marked as replied" />
                    <MessageStat label="This Week" value={String(contactThisWeek)} hint="Last 7 days" />
                  </section>

                  {/* Search + view toggle */}
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative sm:w-72">
                      <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="h-8 pl-9 text-xs"
                        placeholder="Search name, email, subject..."
                        value={contactQuery}
                        onChange={(e) => setContactQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-0.5 rounded-lg border bg-secondary/40 p-1 w-fit">
                      {(["table", "list", "calendar"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setContactView(v)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                            contactView === v
                              ? "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {v === "table" && <Table2 className="h-3.5 w-3.5" />}
                          {v === "list" && <List className="h-3.5 w-3.5" />}
                          {v === "calendar" && <Calendar className="h-3.5 w-3.5" />}
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {contactView === "table" && (
                    <ContactTableView submissions={visibleContacts} onSelect={openContact} />
                  )}
                  {contactView === "list" && (
                    <ContactListView submissions={visibleContacts} onSelect={openContact} />
                  )}
                  {contactView === "calendar" && (
                    <ContactCalendarView
                      submissions={visibleContacts}
                      month={contactCalendarMonth}
                      onMonthChange={setContactCalendarMonth}
                      selectedDay={selectedCalendarDay}
                      onDaySelect={setSelectedCalendarDay}
                      onSelect={openContact}
                    />
                  )}
                </>
              )}

              {/* ── Booking Templates section ── */}
              {activeSection === "templates" && (
                <>
                  <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <MessageStat label="Total" value={String(templates.length)} hint="All booking templates" />
                    <MessageStat label="Email" value={String(templates.filter((t) => t.channel === "email").length)} hint="Email templates" />
                    <MessageStat label="SMS" value={String(templates.filter((t) => t.channel === "sms").length)} hint="SMS templates" />
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Booking &amp; Appointment Templates</CardTitle>
                      <CardDescription>Manage automated email and SMS message templates for booking confirmations, reminders, and updates.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">Template name</TableHead>
                            <TableHead>Channel</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[140px] min-w-[140px]">Updated</TableHead>
                            <TableHead className="w-[90px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {templates.map((template) => (
                            <TableRow key={template.id}>
                              <TableCell className="pl-4">
                                <div className="font-medium">{template.name}</div>
                                <div className="line-clamp-1 text-xs text-muted-foreground">
                                  {template.channel === "email" && template.subject ? template.subject : template.body}
                                </div>
                              </TableCell>
                              <TableCell><ChannelBadge channel={template.channel} /></TableCell>
                              <TableCell className="text-sm">{human(template.notification_type)}</TableCell>
                              <TableCell>
                                <Badge className={template.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-secondary text-secondary-foreground"}>
                                  {template.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{formatDate(template.updated_at)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    aria-label="Edit template"
                                    onClick={() => { setEditingTemplate(template); setTemplateFormOpen(true); }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  {deletingTemplateId === template.id ? (
                                    <div className="flex items-center gap-1">
                                      <Button variant="destructive" size="sm" className="h-7 px-2 text-xs" onClick={() => deleteTemplate(template.id)}>Confirm</Button>
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDeletingTemplateId(null)}>Cancel</Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      aria-label="Delete template"
                                      onClick={() => setDeletingTemplateId(template.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {!templates.length && (
                            <TableRow>
                              <TableCell className="p-8 text-center text-muted-foreground" colSpan={6}>
                                No templates yet. Click <strong>New template</strong> to create your first.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </main>

        {/* Sheets */}
        <BookingTemplateSheet
          open={templateFormOpen}
          onOpenChange={setTemplateFormOpen}
          template={editingTemplate}
          onSaved={(saved) => {
            setTemplates((current) => {
              const idx = current.findIndex((t) => t.id === saved.id);
              return idx >= 0 ? current.map((t) => t.id === saved.id ? saved : t) : [saved, ...current];
            });
            setTemplateFormOpen(false);
            setEditingTemplate(null);
          }}
        />
        <ComposeMessageSheet
          open={composeOpen}
          onOpenChange={(open) => { setComposeOpen(open); if (!open) setComposePrefill(null); }}
          orders={orders}
          users={users}
          config={config}
          prefill={composePrefill}
          onMessageSent={refreshData}
        />
        <MessageDetailSheet
          message={selectedMessage}
          open={Boolean(selectedMessage)}
          onOpenChange={(open) => { if (!open) setSelectedMessageId(null); }}
          order={orders.find((o) => o.id === selectedMessage?.order_id) ?? null}
          user={users.find((u) => u.id === selectedMessage?.user_id) ?? null}
          onCompose={() => { setSelectedMessageId(null); setComposeOpen(true); }}
        />
        <ContactSubmissionSheet
          submission={selectedContact}
          open={Boolean(selectedContact)}
          onOpenChange={(open) => { if (!open) setSelectedContactId(null); }}
          onStatusChange={handleContactStatusChange}
          onCompose={(prefill) => {
            setSelectedContactId(null);
            setComposePrefill(prefill);
            setComposeOpen(true);
          }}
        />
      </div>
    </div>
  );
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getAdminToken() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  const token = session?.access_token;
  if (!token) throw new Error("Sign in again before using messaging.");
  return token;
}

async function loadMessagingConfig(): Promise<MessagingConfig | null> {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session) return null;
  const response = await fetch("/api/admin/messaging/config", {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function loadBookingTemplates(): Promise<BookingTemplate[]> {
  try {
    const token = await getAdminToken();
    const response = await fetch("/api/admin/booking-templates", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return payload.templates ?? [];
  } catch {
    return [];
  }
}

async function loadContactSubmissions(): Promise<ContactSubmission[]> {
  try {
    const token = await getAdminToken();
    const response = await fetch("/api/admin/contact-submissions", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return payload.submissions ?? [];
  } catch {
    return [];
  }
}

async function updateContactStatus(id: string, status: string) {
  const token = await getAdminToken();
  await fetch("/api/admin/contact-submissions", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, status }),
  });
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function MessageStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-[22px] font-semibold leading-none">{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const tone =
    channel === "sms"
      ? "bg-primary/15 text-foreground"
      : channel === "email"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : channel === "contact_form"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
      : "bg-secondary text-secondary-foreground";
  return <Badge className={tone}>{channel === "contact_form" ? "Contact Form" : human(channel)}</Badge>;
}

function ContactStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    read: "bg-secondary text-secondary-foreground",
    replied: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    archived: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  };
  return <Badge className={styles[status] ?? "bg-secondary text-secondary-foreground"}>{human(status)}</Badge>;
}

function ChannelCard({ icon, title, ready, rows }: { icon: ReactNode; title: string; ready: boolean; rows: [string, string][] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge className={ready ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}>
            {ready ? "Ready" : "Missing"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-lg border bg-background/35 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TemplateCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => <div key={item} className="rounded-lg border bg-background/35 px-3 py-2 text-sm">{item}</div>)}
      </CardContent>
    </Card>
  );
}

function MessageMeta({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="rounded-lg border bg-secondary/25 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
      {subvalue && <div className="mt-1 break-words text-xs text-muted-foreground">{subvalue}</div>}
    </div>
  );
}

// ─── Contact view components ──────────────────────────────────────────────────

function contactInitials(s: ContactSubmission) {
  return [s.first_name[0], s.last_name?.[0]].filter(Boolean).join("").toUpperCase();
}

function contactFullName(s: ContactSubmission) {
  return [s.first_name, s.last_name].filter(Boolean).join(" ");
}

function ContactTableView({ submissions, onSelect }: { submissions: ContactSubmission[]; onSelect: (s: ContactSubmission) => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px] min-w-[140px] whitespace-nowrap">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-accent/45"
                tabIndex={0}
                onClick={() => onSelect(s)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s); } }}
              >
                <TableCell className="pl-4">
                  <div className="flex items-center gap-2">
                    {s.status === "new" && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="New" />}
                    <div>
                      <div className="font-medium">{contactFullName(s)}</div>
                      {s.company && <div className="text-xs text-muted-foreground">{s.company}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{s.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.phone || "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">{s.subject || "No subject"}</TableCell>
                <TableCell><ContactStatusBadge status={s.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDate(s.created_at)}</TableCell>
              </TableRow>
            ))}
            {!submissions.length && (
              <TableRow>
                <TableCell className="p-8 text-center text-muted-foreground" colSpan={6}>No contact submissions found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ContactListView({ submissions, onSelect }: { submissions: ContactSubmission[]; onSelect: (s: ContactSubmission) => void }) {
  if (!submissions.length) {
    return <div className="py-16 text-center text-muted-foreground">No contact submissions found.</div>;
  }
  return (
    <div className="space-y-3">
      {submissions.map((s) => (
        <Card key={s.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => onSelect(s)}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {contactInitials(s)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  {s.status === "new" && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <span className="truncate font-semibold text-sm">{contactFullName(s)}</span>
                  {s.company && <span className="text-xs text-muted-foreground shrink-0">· {s.company}</span>}
                  <span className="ml-auto shrink-0"><ContactStatusBadge status={s.status} /></span>
                </div>
                {s.subject && <div className="mb-1 text-sm font-medium text-foreground/80">{s.subject}</div>}
                <div className="line-clamp-2 text-xs text-muted-foreground">{s.message}</div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{s.email}</span>
                  {s.phone && <span>{s.phone}</span>}
                  <span className="ml-auto">{formatDate(s.created_at)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ContactCalendarView({
  submissions,
  month,
  onMonthChange,
  selectedDay,
  onDaySelect,
  onSelect,
}: {
  submissions: ContactSubmission[];
  month: Date;
  onMonthChange: (d: Date) => void;
  selectedDay: string | null;
  onDaySelect: (day: string | null) => void;
  onSelect: (s: ContactSubmission) => void;
}) {
  const year = month.getFullYear();
  const monthNum = month.getMonth();
  const firstDayOfWeek = new Date(year, monthNum, 1).getDay();
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(month);
  const todayKey = new Date().toISOString().slice(0, 10);

  const dayMap = new Map<string, number>();
  submissions.forEach((s) => {
    const key = s.created_at.slice(0, 10);
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  });

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const filteredSubs = selectedDay ? submissions.filter((s) => s.created_at.startsWith(selectedDay)) : submissions;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onMonthChange(new Date(year, monthNum - 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{monthLabel}</span>
            <button
              onClick={() => onMonthChange(new Date(year, monthNum + 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-1 grid grid-cols-7">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="py-1 text-center text-[10px] font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="aspect-square" />;
              const key = `${year}-${String(monthNum + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const count = dayMap.get(key) ?? 0;
              const isSelected = selectedDay === key;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  onClick={() => onDaySelect(isSelected ? null : key)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-md text-xs transition-colors",
                    isSelected ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent",
                    isToday && !isSelected && "font-bold text-primary",
                    count > 0 && !isSelected && "bg-primary/8",
                  )}
                >
                  <span>{day}</span>
                  {count > 0 && (
                    <span className={cn(
                      "absolute bottom-0 text-[8px] font-bold leading-tight",
                      isSelected ? "text-primary-foreground/80" : "text-primary",
                    )}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            {selectedDay ? (
              <div className="flex items-center justify-between">
                <span>
                  {filteredSubs.length} submission{filteredSubs.length !== 1 ? "s" : ""} on{" "}
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <button onClick={() => onDaySelect(null)} className="underline hover:text-foreground">Clear</button>
              </div>
            ) : (
              <span className="block text-center">Click a day to filter</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <ContactListView submissions={filteredSubs} onSelect={onSelect} />
      </div>
    </div>
  );
}

// ─── Detail sheet for contact submissions ────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700" },
  { value: "read", label: "Read", color: "bg-secondary text-secondary-foreground border-border" },
  { value: "replied", label: "Replied", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700" },
  { value: "archived", label: "Archived", color: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700" },
];

function ContactSubmissionSheet({
  submission,
  open,
  onOpenChange,
  onStatusChange,
  onCompose,
}: {
  submission: ContactSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: string) => void;
  onCompose: (prefill: ComposePrefill) => void;
}) {
  if (!submission) return null;

  const fullName = contactFullName(submission);
  const initials = contactInitials(submission);
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === submission.status) ?? STATUS_OPTIONS[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[64rem]">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl">{fullName}</SheetTitle>
              <SheetDescription className="mt-0.5">
                {submission.company ? `${submission.company} · ` : ""}{submission.email}
              </SheetDescription>
            </div>
            <Badge className={currentStatus.color}>{currentStatus.label}</Badge>
          </div>
        </SheetHeader>

        {/* Quick actions */}
        <div className="mt-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</div>
          <div className="flex flex-wrap gap-2">
            {submission.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${submission.phone}`}>
                  <Phone className="mr-1.5 h-3.5 w-3.5" />Call
                </a>
              </Button>
            )}
            {submission.phone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onOpenChange(false); onCompose({ channel: "sms", recipient: submission.phone! }); }}
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />SMS
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onCompose({
                  channel: "email",
                  recipient: submission.email,
                  subject: `Re: ${submission.subject || "your inquiry"}`,
                });
              }}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />Email
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/orders?customer_email=${encodeURIComponent(submission.email)}&name=${encodeURIComponent(fullName)}`}>
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />Add project
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/bookings?email=${encodeURIComponent(submission.email)}&name=${encodeURIComponent(fullName)}`}>
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />Book appointment
              </Link>
            </Button>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <MessageMeta label="Email" value={submission.email} />
          <MessageMeta label="Phone" value={submission.phone || "Not provided"} />
          <MessageMeta label="Company" value={submission.company || "Not provided"} />
          <MessageMeta label="Submitted" value={formatDate(submission.created_at)} />
        </div>

        {/* Subject */}
        {submission.subject && (
          <div className="mt-4">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</div>
            <div className="rounded-lg border bg-secondary/25 px-3 py-2 text-sm font-medium">{submission.subject}</div>
          </div>
        )}

        {/* Message body */}
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Message</div>
          <div className="rounded-xl border bg-background/40 p-4 whitespace-pre-wrap break-words text-sm leading-6">
            {submission.message}
          </div>
        </div>

        {/* Status update */}
        <div className="mt-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Update status</div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStatusChange(submission.id, opt.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  submission.status === opt.value
                    ? opt.color
                    : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {opt.value === "archived" && <Archive className="mr-1 inline h-3 w-3" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Existing detail / compose sheets ────────────────────────────────────────

function MessageDetailSheet({
  message,
  open,
  onOpenChange,
  order,
  user,
  onCompose,
}: {
  message: AdminDashboardData["messages"][number] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: AdminDashboardData["orders"][number] | null;
  user: AdminDashboardData["users"][number] | null;
  onCompose: () => void;
}) {
  if (!message) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>{message.subject || "Untitled message"}</SheetTitle>
          <SheetDescription>
            {human(message.direction)} {human(message.channel)} message created {formatDate(message.created_at)}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MessageMeta label="Channel" value={human(message.channel)} />
            <MessageMeta label="Direction" value={human(message.direction)} />
            <MessageMeta label="Read" value={message.read_at ? formatDate(message.read_at) : "Unread"} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MessageMeta
              label="Customer"
              value={user?.full_name || user?.email || order?.customer_email || "Not linked"}
              subvalue={user?.company || order?.company || user?.phone || order?.customer_phone || undefined}
            />
            <MessageMeta
              label="Order"
              value={order?.order_number ? `#${order.order_number}` : message.order_id ? message.order_id : "Not linked"}
              subvalue={order ? `${human(order.status)} / ${human(order.payment_status)}` : undefined}
            />
          </div>
          <div className="rounded-xl border bg-background/40 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full message</div>
            <div className="whitespace-pre-wrap break-words text-sm leading-6">{message.body || "No message body was saved for this record."}</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onCompose}><Send className="h-4 w-4" /> Reply or forward</Button>
            {order && (
              <Button variant="outline" asChild><Link href="/admin/orders">Open orders</Link></Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ComposeMessageSheet({
  open,
  onOpenChange,
  orders,
  users,
  config,
  prefill,
  onMessageSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: AdminDashboardData["orders"];
  users: AdminDashboardData["users"];
  config: MessagingConfig | null;
  prefill?: ComposePrefill | null;
  onMessageSent: () => Promise<void>;
}) {
  const [channel, setChannel] = useState("email");
  const [mode, setMode] = useState("single");
  const [target, setTarget] = useState("manual");
  const [role, setRole] = useState("all");
  const [recipient, setRecipient] = useState("");
  const [orderId, setOrderId] = useState("none");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  // Apply prefill when sheet opens
  useEffect(() => {
    if (open && prefill) {
      setMode("single");
      setTarget("manual");
      if (prefill.channel) setChannel(prefill.channel);
      if (prefill.recipient) setRecipient(prefill.recipient);
      if (prefill.subject) setSubject(prefill.subject);
    }
    if (!open) setStatus("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const channelReady = channel === "sms" ? config?.twilio?.configured : channel === "email" ? config?.smtp?.configured : true;
  const roles = Array.from(new Set(users.map((u) => u.role))).sort();
  const selectedUser = users.find((u) => u.id === target);
  const resolvedRecipient =
    target === "manual"
      ? recipient
      : channel === "sms"
      ? selectedUser?.phone || ""
      : selectedUser?.email || "";

  async function sendMessage() {
    setSending(true);
    setStatus("");
    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/messaging/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          channel,
          mode,
          recipient: mode === "single" ? resolvedRecipient : undefined,
          userIds: mode === "bulk" && target !== "manual" && target !== "role" ? [target] : undefined,
          role: mode === "bulk" ? role : undefined,
          orderId: orderId === "none" ? null : orderId,
          subject,
          body,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send message.");
      const failedCount = Array.isArray(payload.failed) ? payload.failed.length : 0;
      setStatus(`Sent ${payload.sent || 0} message${payload.sent === 1 ? "" : "s"}${failedCount ? `, ${failedCount} failed` : ""}.`);
      await onMessageSent();
      setBody("");
      setSubject("");
      if (!failedCount) onOpenChange(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader>
          <SheetTitle>New message</SheetTitle>
          <SheetDescription>Send email, SMS, dashboard, or internal messages to one contact or a role-based audience.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Channel</div>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Mode</div>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Individual</SelectItem>
                  <SelectItem value="bulk">Bulk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Linked order</div>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger><SelectValue placeholder="Order" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No order</SelectItem>
                  {orders.map((o) => <SelectItem key={o.id} value={o.id}>#{o.order_number || o.id.slice(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mode === "bulk" ? (
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Audience</div>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All active users</SelectItem>
                    {roles.map((r) => <SelectItem key={r} value={r}>{human(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Saved contact</div>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger><SelectValue placeholder="Contact" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual recipient</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email || u.phone || u.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {mode === "single" && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Recipient</div>
              <Input
                value={target === "manual" ? recipient : resolvedRecipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={target !== "manual"}
                placeholder={channel === "sms" ? "+14805551212" : "customer@example.com"}
              />
            </div>
          )}
          {mode === "bulk" && (
            <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
              Bulk {human(channel)} will target active {role === "all" ? "users across every role" : human(role)} with a saved {channel === "sms" ? "phone number" : "email address"}.
            </div>
          )}
          {target !== "manual" && selectedUser && mode === "single" && (
            <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
              Connected to {selectedUser.full_name || selectedUser.email || "selected user"}: {selectedUser.email || "no email"} / {selectedUser.phone || "no phone"}.
            </div>
          )}
          {channel === "sms" && (
            <div className="rounded-lg border bg-secondary/30 p-3 text-xs text-muted-foreground">
              SMS replies should point Twilio Messaging webhook to {config?.twilio?.webhookUrl || "/api/webhooks/twilio/sms"}.
            </div>
          )}
          {channel === "email" && (
            <div className="rounded-lg border bg-secondary/30 p-3 text-xs text-muted-foreground">
              Email replies are pulled from {config?.imap?.mailbox || "INBOX"} with the Sync email action.
            </div>
          )}
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Subject</div>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Order update" disabled={channel === "sms"} />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Message</div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the message..." />
          </div>
          <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
            {channelReady ? "This channel is configured and ready to send." : "This channel is missing environment variables."}
          </div>
          {status && <div className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">{status}</div>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={sendMessage} disabled={sending || !channelReady || !body.trim()}>
              {sending ? "Sending..." : mode === "bulk" ? "Send bulk message" : "Send message"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Booking template sheet ───────────────────────────────────────────────────

const NOTIFICATION_TYPES = [
  { value: "booking_confirmation", label: "Booking Confirmation" },
  { value: "appointment_reminder", label: "Appointment Reminder" },
  { value: "appointment_rescheduled", label: "Appointment Rescheduled" },
  { value: "appointment_cancelled", label: "Appointment Cancelled" },
  { value: "appointment_follow_up", label: "Follow-up" },
  { value: "custom", label: "Custom" },
];

function BookingTemplateSheet({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: BookingTemplate | null;
  onSaved: (template: BookingTemplate) => void;
}) {
  const isEdit = Boolean(template);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [notificationType, setNotificationType] = useState("booking_confirmation");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (template) {
      setName(template.name);
      setChannel(template.channel);
      setNotificationType(template.notification_type);
      setSubject(template.subject || "");
      setBody(template.body);
      setIsActive(template.is_active);
    } else {
      setName(""); setChannel("email"); setNotificationType("booking_confirmation"); setSubject(""); setBody(""); setIsActive(true);
    }
    setStatus("");
  }, [template, open]);

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const token = await getAdminToken();
      const method = isEdit ? "PATCH" : "POST";
      const payload = {
        ...(isEdit ? { id: template!.id } : {}),
        name, channel, notification_type: notificationType,
        subject: channel === "email" ? subject : undefined,
        body, is_active: isActive,
      };
      const response = await fetch("/api/admin/booking-templates", {
        method,
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save template.");
      onSaved(result.template);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[56rem]">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit template" : "New booking template"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update the content and settings for this template." : "Create an email or SMS template for booking notifications."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Template name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Booking Confirmation Email" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Channel</div>
              <Select value={channel} onValueChange={(v) => setChannel(v as "email" | "sms")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Notification type</div>
              <Select value={notificationType} onValueChange={setNotificationType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {channel === "email" && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Subject line</div>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your appointment is confirmed" />
            </div>
          )}
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">
              {channel === "email" ? "Email body" : "SMS message"}
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[180px]"
              placeholder={channel === "sms"
                ? "ControlP.io: Your {{typeName}} is confirmed for {{date}} at {{time}}. Reply STOP to opt out."
                : "Hi {{firstName}},\n\nYour {{typeName}} appointment is confirmed for {{date}} at {{time}}.\n\nSee you soon!"}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Available: {"{{firstName}}"}, {"{{lastName}}"}, {"{{typeName}}"}, {"{{date}}"}, {"{{time}}"}, {"{{location}}"}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-secondary/30 px-4 py-3">
            <input id="template-active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-primary" />
            <label htmlFor="template-active" className="text-sm">Active — use this template for automated notifications</label>
          </div>
          {status && <div className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">{status}</div>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving || !name.trim() || !body.trim()}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create template"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
