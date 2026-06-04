"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Bot, BrainCircuit, ChevronRight, Clock, Copy, KeyRound, Loader2, Moon, PlugZap, Search, Send, ShieldCheck, Sun, Workflow } from "lucide-react";
import { LogOut } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AdminDashboardData, AdminProfile } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const integrations = [
  {
    name: "Paperclip",
    status: "Planned",
    description: "Document intake, invoice/proof parsing, file summaries, and structured handoff workflows.",
    next: "Add credentials and choose first document automation.",
  },
  {
    name: "Hermes",
    status: "Planned",
    description: "Message routing, outbound campaign assist, conversation summaries, and customer follow-up queues.",
    next: "Connect messaging permissions and define send guardrails.",
  },
  {
    name: "Open Claw",
    status: "Optional",
    description: "Computer-use style operational assistant for controlled dashboard workflows and QA passes.",
    next: "Decide whether this should run as supervised-only.",
  },
];

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type ChatMessage = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  { label: "Daily summary", prompt: "Give me a daily operations summary: what's due today, what's overdue, upcoming appointments, and the top 3 things that need immediate attention." },
  { label: "Overdue items", prompt: "List all overdue production tasks and overdue orders. For each, include the customer, how many days late, and a recommended next action." },
  { label: "Draft customer update", prompt: "Draft a professional customer update message for the order that most urgently needs customer communication. Use <draft>...</draft> tags around the message." },
  { label: "Blocked items", prompt: "What's currently blocking production? List all blocked items with their blocker type and suggested resolution steps." },
];

function DraftBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(content).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="my-2 rounded-lg border border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between gap-2 border-b border-primary/20 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Draft message</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap px-3 py-2 text-[12px] leading-relaxed text-foreground">{content}</pre>
    </div>
  );
}

function renderMessageContent(content: string) {
  const parts = content.split(/(<draft>[\s\S]*?<\/draft>)/g);
  return parts.map((part, i) => {
    const match = part.match(/^<draft>([\s\S]*?)<\/draft>$/);
    if (match) return <DraftBlock key={i} content={match[1].trim()} />;
    return (
      <span key={i}>
        {part.split("\n").map((line, j, arr) => (
          <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
        ))}
      </span>
    );
  });
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

export function AdminAgent() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, thinking]);

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || thinking) return;
    setChatInput("");
    const nextHistory: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(nextHistory);
    setThinking(true);
    try {
      const db = getSupabaseBrowserClient();
      const token = (await db?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/admin/agent", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          message: text,
          history: chatMessages.slice(-10),
        }),
      });
      const payload = await res.json().catch(() => ({})) as { response?: string; error?: string };
      if (!res.ok) throw new Error(payload.error || "Agent request failed.");
      setChatMessages([...nextHistory, { role: "assistant", content: payload.response ?? "(no response)" }]);
    } catch (error) {
      setChatMessages([...nextHistory, { role: "assistant", content: error instanceof Error ? `Error: ${error.message}` : "Could not reach the agent." }]);
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    async function boot() {
      const currentProfile = await getCurrentAdminProfile();
      setProfile(currentProfile);
      if (!currentProfile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }
      if (currentProfile?.role !== "super_admin") {
        setAuthState("denied");
        return;
      }
      setAuthState("allowed");
      setData(await loadAdminDashboardData());
    }
    boot();
  }, []);

  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const users = data?.users ?? [];
  const agentSignals = useMemo(() => {
    const now = new Date().toISOString();
    const unpaid = orders.filter((order) => ["unpaid", "pending", "partially_paid"].includes(order.payment_status)).length;
    const proofing = orders.filter((order) => ["file_review", "proofing", "awaiting_approval"].includes(order.status)).length;
    const unread = messages.filter((message) => !message.read_at && message.direction === "inbound").length;
    const missingContact = users.filter((user) => !user.phone || !user.email).length;
    const overdueOrders = orders.filter((order) =>
      order.due_at && order.due_at < now &&
      !["completed", "shipped", "canceled", "archived"].includes(String(order.status ?? "")),
    ).length;
    return { unpaid, proofing, unread, missingContact, overdueOrders };
  }, [messages, orders, users]);

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
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
                {group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link key={label} href={href} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}>
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}
                      {label === "Agent" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">SA</Badge>}
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
              <span className="font-medium text-foreground">Agent</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-[380px] md:block">
                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search agents, automations, workflows..." />
              </div>
              <Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking super admin access...</CardContent></Card>}
          {authState === "denied" && (
            <Card className="border-red-500/30">
              <CardContent className="p-5">
                <div className="font-semibold text-red-600 dark:text-red-300">Super Admin access required</div>
                <p className="mt-2 text-sm text-muted-foreground">Agent controls are restricted to Super Admin for now. Current role: {human(profile?.role)}.</p>
                <Button className="mt-4" asChild><a href="/admin">Back to dashboard</a></Button>
              </CardContent>
            </Card>
          )}
          {authState === "allowed" && (
            <>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-[25px] font-semibold tracking-tight">Agent command center</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Prepare supervised automation for Paperclip, Hermes, and optional Open Claw workflows. This section is Super Admin-only while integrations are being connected.</p>
                </div>
                <div className="flex gap-2">
                  <Button disabled><PlugZap className="h-4 w-4" /> Connect agent</Button>
                  <Button variant="outline" disabled><KeyRound className="h-4 w-4" /> Manage keys</Button>
                </div>
              </div>

              <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Stat label="Overdue orders" value={String(agentSignals.overdueOrders)} hint="Orders past their due date" urgent={agentSignals.overdueOrders > 0} />
                <Stat label="Payment follow-up" value={String(agentSignals.unpaid)} hint="Orders unpaid or partially paid" urgent={agentSignals.unpaid > 0} />
                <Stat label="Proof workflows" value={String(agentSignals.proofing)} hint="Orders waiting on proof approval" />
                <Stat label="Unread messages" value={String(agentSignals.unread)} hint="Inbound messages from customers" urgent={agentSignals.unread > 0} />
                <Stat label="Contact gaps" value={String(agentSignals.missingContact)} hint="Users missing email or phone" />
              </section>

              <section className="mb-5 grid gap-4 xl:grid-cols-3">
                {integrations.map((item) => (
                  <Card key={item.name}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" /> {item.name}</CardTitle>
                        <Badge variant="outline">{item.status}</Badge>
                      </div>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{item.next}</div>
                    </CardContent>
                  </Card>
                ))}
              </section>

              <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><Workflow className="h-4 w-4 text-primary" /> Workflow guardrails</CardTitle>
                    <CardDescription>Initial scope before live automation is connected.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 md:grid-cols-2">
                    {[
                      "Super Admin approval required for first run",
                      "No customer-facing sends without preview",
                      "No order/payment changes without audit log",
                      "Read-only analysis mode before write mode",
                      "Separate Paperclip document parsing from Hermes messaging",
                      "Keep Open Claw supervised if enabled",
                    ].map((item) => <div key={item} className="rounded-lg border bg-background/35 px-3 py-2 text-sm">{item}</div>)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4 text-primary" /> Suggested first agents</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <AgentTask title="Invoice intake" detail="Paperclip parses uploads into payment/invoice fields." />
                    <AgentTask title="Proof reminder" detail="Hermes drafts SMS/email reminders for stale proofs." />
                    <AgentTask title="Order triage" detail="Summarize new orders with payment, artwork, and shipping gaps." />
                    <AgentTask title="Contact hygiene" detail="Find missing phone/email records before campaigns." />
                  </CardContent>
                </Card>
              </section>

              <section className="mt-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Access model</CardTitle>
                    <CardDescription>Agent controls are currently locked to Super Admin only. We can later add granular employee permissions once the connectors are live.</CardDescription>
                  </CardHeader>
                </Card>
              </section>

              <section className="mt-5">
                <Card className="flex flex-col" style={{ height: "580px" }}>
                  <CardHeader className="flex-none pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" /> Operations agent</CardTitle>
                      {chatMessages.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setChatMessages([])}>
                          Clear
                        </Button>
                      )}
                    </div>
                    <CardDescription>Ask about orders, overdue tasks, proofs, appointments, or draft customer messages. Read-only analysis only.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
                    {/* Quick-prompt shortcuts */}
                    <div className="flex flex-none flex-wrap gap-1.5">
                      {QUICK_PROMPTS.map((qp) => (
                        <button
                          key={qp.label}
                          disabled={thinking}
                          onClick={() => { setChatInput(qp.prompt); }}
                          className="flex items-center gap-1 rounded-full border bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-40"
                        >
                          <Clock className="h-3 w-3" />
                          {qp.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 overflow-y-auto rounded-lg border bg-background/35 p-3">
                      {chatMessages.length === 0 && !thinking && (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Ask the agent anything about your current operations.
                        </div>
                      )}
                      <div className="space-y-3">
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[82%] rounded-xl px-3.5 py-2 text-sm leading-relaxed",
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground",
                              )}
                            >
                              {msg.role === "assistant" ? renderMessageContent(msg.content) : msg.content.split("\n").map((line, j) => (
                                <span key={j}>{line}{j < msg.content.split("\n").length - 1 && <br />}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {thinking && (
                          <div className="flex justify-start">
                            <div className="flex items-center gap-2 rounded-xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    </div>
                    <div className="flex flex-none gap-2">
                      <Textarea
                        className="min-h-[60px] resize-none text-sm"
                        placeholder="Ask about orders, blockers, proofs, appointments..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        disabled={thinking}
                      />
                      <Button
                        className="h-auto self-stretch px-3"
                        onClick={sendMessage}
                        disabled={thinking || !chatInput.trim()}
                        aria-label="Send message"
                      >
                        {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, urgent }: { label: string; value: string; hint: string; urgent?: boolean }) {
  return (
    <Card className={cn(urgent && value !== "0" && "border-red-500/30")}>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-2 text-[22px] font-semibold leading-none", urgent && value !== "0" && "text-red-600 dark:text-red-400")}>{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function AgentTask({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border bg-background/35 p-3"><div className="text-sm font-medium">{title}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}
