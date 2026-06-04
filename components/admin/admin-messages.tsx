"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Inbox,
  Mail,
  MessageSquare,
  Moon,
  Phone,
  Search,
  Send,
  Sun,
} from "lucide-react";
import { LogOut } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData, markMessageRead } from "@/lib/admin/admin-api";
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

type MessagingConfig = {
  twilio?: { configured: boolean; phoneNumber: string; hasAccountSid: boolean; hasAuthToken: boolean; validateWebhook?: boolean; webhookUrl?: string };
  smtp?: { configured: boolean; host: string; port: string; secure: string; user: string; from: string; replyTo: string; hasPassword: boolean };
  imap?: { configured: boolean; host: string; port: string; secure: string; user: string; mailbox?: string; hasPassword: boolean };
  pop?: { configured: boolean; host: string; port: string; secure: string; user: string; hasPassword: boolean };
};

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)).replace(",", "");
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

export function AdminMessages() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [config, setConfig] = useState<MessagingConfig | null>(null);
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }

      setAuthState("allowed");
      setData(await loadAdminDashboardData());
      setConfig(await loadMessagingConfig());
    }

    boot();
  }, []);

  async function refreshData() {
    const [nextData, nextConfig] = await Promise.all([loadAdminDashboardData(), loadMessagingConfig()]);
    setData(nextData);
    setConfig(nextConfig);
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

  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const users = data?.users ?? [];
  const visibleMessages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return messages;
    return messages.filter((message) => [
      message.subject,
      message.body,
      message.channel,
      message.direction,
      message.order_id,
    ].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [messages, query]);

  const inbound = messages.filter((message) => message.direction === "inbound");
  const outbound = messages.filter((message) => message.direction === "outbound");
  const unread = messages.filter((message) => !message.read_at);
  const configuredChannels = [config?.twilio?.configured, config?.smtp?.configured, config?.imap?.configured].filter(Boolean).length;
  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) ?? null,
    [messages, selectedMessageId],
  );

  async function openMessage(message: AdminDashboardData["messages"][number]) {
    setSelectedMessageId(message.id);
    if (message.read_at) return;

    setData((current) => current ? {
      ...current,
      messages: current.messages.map((item) => item.id === message.id ? { ...item, read_at: new Date().toISOString() } : item),
    } : current);

    try {
      await markMessageRead(message.id, message.order_id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not mark message as read.");
    }
  }

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-5 px-2 pt-[5px]">
            <a href="/admin">
              <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
              <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
            </a>
          </div>

          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                {group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}
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
              <button onClick={handleSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </aside>

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
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search messages, customers, orders..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
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
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Messaging command center</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                    Manage customer conversations, Twilio SMS, SMTP outbound email, IMAP inbox sync, notifications, templates, and order communication.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setComposeOpen(true)}><Send className="h-4 w-4" /> New message</Button>
                  <Button variant="outline" onClick={syncEmailInbox} disabled={syncing || !config?.imap?.configured}>
                    <Inbox className="h-4 w-4" /> {syncing ? "Syncing..." : "Sync email"}
                  </Button>
                </div>
              </div>

              {notice && (
                <div className="mb-4 rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                  {notice}
                </div>
              )}

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
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openMessage(message);
                              }
                            }}
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
        </main>

        <ComposeMessageSheet open={composeOpen} onOpenChange={setComposeOpen} orders={orders} users={users} config={config} onMessageSent={refreshData} />
        <MessageDetailSheet
          message={selectedMessage}
          open={Boolean(selectedMessage)}
          onOpenChange={(open) => {
            if (!open) setSelectedMessageId(null);
          }}
          order={orders.find((order) => order.id === selectedMessage?.order_id) ?? null}
          user={users.find((user) => user.id === selectedMessage?.user_id) ?? null}
          onCompose={() => {
            setSelectedMessageId(null);
            setComposeOpen(true);
          }}
        />
      </div>
    </div>
  );
}

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
  const tone = channel === "sms" ? "bg-primary/15 text-foreground" : channel === "email" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-secondary text-secondary-foreground";
  return <Badge className={tone}>{human(channel)}</Badge>;
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
          <Badge className={ready ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}>{ready ? "Ready" : "Missing"}</Badge>
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
            <div className="whitespace-pre-wrap break-words text-sm leading-6">
              {message.body || "No message body was saved for this record."}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={onCompose}><Send className="h-4 w-4" /> Reply or forward</Button>
            {order && (
              <Button variant="outline" asChild>
                <Link href="/admin/orders">Open orders</Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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

function ComposeMessageSheet({
  open,
  onOpenChange,
  orders,
  users,
  config,
  onMessageSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: AdminDashboardData["orders"];
  users: AdminDashboardData["users"];
  config: MessagingConfig | null;
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

  const channelReady = channel === "sms" ? config?.twilio?.configured : channel === "email" ? config?.smtp?.configured : true;
  const roles = Array.from(new Set(users.map((user) => user.role))).sort();
  const selectedUser = users.find((user) => user.id === target);
  const resolvedRecipient = target === "manual"
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
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
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
                  {orders.map((order) => <SelectItem key={order.id} value={order.id}>#{order.order_number || order.id.slice(0, 8)}</SelectItem>)}
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
                    {roles.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}
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
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email || user.phone || user.id.slice(0, 8)}
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
                onChange={(event) => setRecipient(event.target.value)}
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
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Order update" disabled={channel === "sms"} />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Message</div>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the message..." />
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
