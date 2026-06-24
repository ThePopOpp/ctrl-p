"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Moon,
  Plus,
  Send,
  Settings2,
  Sparkles,
  Sun,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { LogOut } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData } from "@/lib/admin/admin-api";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AdminDashboardData } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ─── Model config ─────────────────────────────────────────────────────────────

const AGENT_MODELS = [
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", badge: "Active", tools: true },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", badge: "Fast", tools: true },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", badge: "Active", tools: false },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic", badge: "Powerful", tools: false },
  { id: "openrouter/auto", label: "OpenRouter Auto", provider: "openrouter", badge: "Soon", tools: false, disabled: true },
  { id: "gemini-1.5-pro", label: "Gemini Pro", provider: "google", badge: "Soon", tools: false, disabled: true },
  { id: "hermes", label: "Hermes AI", provider: "hermes", badge: "Soon", tools: false, disabled: true },
] as const;

// ─── Skills ───────────────────────────────────────────────────────────────────

const SKILLS = [
  {
    category: "Operations",
    items: [
      { icon: Zap, label: "Daily briefing", prompt: "Give me a daily operations summary: what's due today, what's overdue, upcoming appointments, unread messages, and the top 3 things needing immediate attention." },
      { icon: Clock, label: "Overdue review", prompt: "List all overdue orders and overdue production tasks. For each, include the customer, how many days late, and a recommended next action." },
      { icon: Wrench, label: "Production blockers", prompt: "What's currently blocking production? List all blocked items with their blocker type and suggest a resolution for each." },
    ],
  },
  {
    category: "Communications",
    items: [
      { icon: MessageSquare, label: "Draft order update", prompt: "Review recent orders and draft a professional customer update for any order that most urgently needs customer communication. Wrap the draft in <draft> tags." },
      { icon: Bell, label: "Proof reminders", prompt: "List all orders pending proof approval. Draft an SMS reminder for the most overdue one. Wrap the SMS text in <draft> tags." },
      { icon: Mail, label: "Follow-up email", prompt: "Find customers who have unread messages or pending orders older than 3 days. Draft a follow-up email for the most urgent case." },
    ],
  },
  {
    category: "Content",
    items: [
      { icon: FileText, label: "Blog post idea", prompt: "Suggest 5 blog post ideas for the Ctrl+P website that would attract Phoenix-area businesses looking for print, signs, or vehicle wraps. For each, include the title, target keyword, and a 2-sentence outline." },
      { icon: Sparkles, label: "SMS campaign", prompt: "Draft a promotional SMS campaign for business cards targeting local Phoenix businesses. Create 3 variations under 160 characters each. Wrap each in <draft> tags. Then save the best one as a draft." },
      { icon: Mail, label: "Email template", prompt: "Create a professional order confirmation email template for Ctrl+P. Use {customer_name}, {order_number}, {product_name}, and {due_date} as placeholders. Save it as a draft when done." },
    ],
  },
  {
    category: "Analytics",
    items: [
      { icon: Zap, label: "Revenue overview", prompt: "Pull the business overview and summarize this month's revenue, order volume by status, and the top 3 actionable insights." },
      { icon: MessageSquare, label: "Inbox summary", prompt: "List all unread inbound messages. Summarize the topics and draft a response plan for the top 3 most urgent ones." },
      { icon: Wrench, label: "Product performance", prompt: "List all active products sorted by category. Identify which categories have the most products and which might need better coverage." },
    ],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolCallRecord = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallRecord[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

async function handleSignOut() {
  const db = getSupabaseBrowserClient();
  if (db) await db.auth.signOut();
  window.location.href = "/login";
}

// ─── Tool call card ───────────────────────────────────────────────────────────

function ToolCallCard({ call }: { call: ToolCallRecord }) {
  const [open, setOpen] = useState(false);

  const icons: Record<string, React.ElementType> = {
    get_business_overview: Zap,
    list_orders: FileText,
    get_order_details: FileText,
    list_customers: Bell,
    list_messages: MessageSquare,
    list_products: Wrench,
    list_production_items: Clock,
    send_sms: MessageSquare,
    send_email: Mail,
    save_content_draft: Sparkles,
  };
  const Icon = icons[call.name] ?? Wrench;
  const isError = call.error || (typeof call.result === "object" && call.result !== null && "error" in (call.result as Record<string, unknown>));

  return (
    <div className={cn("my-1 rounded-lg border text-[12px]", isError ? "border-red-500/30 bg-red-500/5" : "border-primary/20 bg-primary/5")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", isError ? "text-red-500" : "text-primary")} />
        <span className="font-medium text-foreground">{human(call.name)}</span>
        {isError && <Badge className="ml-1 h-4 bg-red-500/15 px-1 text-[10px] text-red-600 dark:text-red-400">Error</Badge>}
        <ChevronDown className={cn("ml-auto h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-primary/10 px-3 pb-2 pt-2 space-y-1.5">
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Input</div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-background/60 px-2 py-1 text-[11px] text-foreground">{JSON.stringify(call.args, null, 2)}</pre>
          </div>
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Result</div>
            <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap rounded bg-background/60 px-2 py-1 text-[11px] text-foreground">{JSON.stringify(call.result, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Draft block ──────────────────────────────────────────────────────────────

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
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Draft</span>
        <button onClick={copy} className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
          <Copy className="h-3 w-3" />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap px-3 py-2 text-[12px] leading-relaxed text-foreground">{content}</pre>
    </div>
  );
}

function renderContent(content: string) {
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

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminAgent() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [model, setModel] = useState("gpt-4o");
  const [skillsOpen, setSkillsOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) { setAuthState("denied"); return; }
      if (profile?.role !== "super_admin") { setAuthState("denied"); return; }
      setAuthState("allowed");
      setData(await loadAdminDashboardData());
    }
    boot();
  }, []);

  const orders = data?.orders ?? [];
  const msgList = data?.messages ?? [];
  const payments = data?.payments ?? [];

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || thinking) return;
    setInput("");

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setThinking(true);

    try {
      const db = getSupabaseBrowserClient();
      const token = (await db?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/admin/agent", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          message: content,
          model,
          history: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const payload = await res.json().catch(() => ({})) as { response?: string; toolCalls?: ToolCallRecord[]; error?: string };
      if (!res.ok) throw new Error(payload.error || "Agent request failed.");
      setMessages([...next, { role: "assistant", content: payload.response ?? "(no response)", toolCalls: payload.toolCalls ?? [] }]);
    } catch (err) {
      setMessages([...next, { role: "assistant", content: err instanceof Error ? `Error: ${err.message}` : "Could not reach the agent.", toolCalls: [] }]);
    } finally {
      setThinking(false);
      textareaRef.current?.focus();
    }
  }

  const selectedModelConfig = AGENT_MODELS.find((m) => m.id === model);

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
                {group.label !== "Main" && <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>}
                <div className="space-y-0.5">
                  {group.items.map(([label, Icon, href]) => (
                    <Link key={label} href={href} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}>
                      <Icon className="h-4 w-4" />
                      {label}
                      {label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}
                      {label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}
                      {label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{msgList.length}</Badge>}
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
                <div className="truncate text-[10px] text-muted-foreground">Owner — Super Admin</div>
              </div>
              <button onClick={handleSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </aside>

        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
          <div className="flex h-12 items-center gap-3 px-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span>Super Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Agent</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <AdminNotificationBell />
              <Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="flex h-[calc(100vh-48px)] lg:pl-[238px]">
          {authState === "checking" && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking access...
            </div>
          )}
          {authState === "denied" && (
            <div className="flex flex-1 items-center justify-center p-6">
              <Card className="max-w-md border-red-500/30">
                <CardContent className="p-5">
                  <div className="font-semibold text-red-600 dark:text-red-300">Super Admin access required</div>
                  <p className="mt-2 text-sm text-muted-foreground">Agent controls are restricted to Super Admin only.</p>
                  <Button className="mt-4" asChild><a href="/admin">Back to dashboard</a></Button>
                </CardContent>
              </Card>
            </div>
          )}
          {authState === "allowed" && (
            <div className="flex flex-1 overflow-hidden">
              {/* Skills panel */}
              <div className={cn("flex-none border-r bg-card/50 transition-all duration-200", skillsOpen ? "w-[240px]" : "w-0 overflow-hidden")}>
                <div className="h-full overflow-y-auto p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Skills</span>
                    <button onClick={() => setSkillsOpen(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="space-y-4">
                    {SKILLS.map((group) => (
                      <div key={group.category}>
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.category}</div>
                        <div className="space-y-1">
                          {group.items.map((skill) => (
                            <button
                              key={skill.label}
                              disabled={thinking}
                              onClick={() => sendMessage(skill.prompt)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                            >
                              <skill.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                              {skill.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat area */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Chat toolbar */}
                <div className="flex items-center gap-2 border-b bg-background/50 px-4 py-2">
                  {!skillsOpen && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setSkillsOpen(true)}>
                      <Settings2 className="h-3.5 w-3.5" /> Skills
                    </Button>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">Model</span>
                  </div>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="h-7 w-[180px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id} disabled={m.disabled}>
                          <span className="flex items-center gap-2">
                            {m.label}
                            <Badge className={cn("h-4 px-1 text-[9px]",
                              m.badge === "Soon" ? "bg-muted text-muted-foreground" :
                              m.badge === "Fast" ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                              "bg-primary/20 text-foreground"
                            )}>{m.badge}</Badge>
                            {m.tools && <Badge className="h-4 bg-blue-500/20 px-1 text-[9px] text-blue-700 dark:text-blue-400">Tools</Badge>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedModelConfig?.tools && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">⚠ This model doesn&apos;t support tools</span>
                  )}
                  {messages.length > 0 && (
                    <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs text-muted-foreground" onClick={() => setMessages([])}>
                      <Plus className="mr-1 h-3 w-3" /> New chat
                    </Button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4">
                  {messages.length === 0 && !thinking && (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                      <div className="rounded-full border bg-primary/10 p-4">
                        <Bot className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <div className="text-base font-semibold">ControlP.io Agent</div>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          Your AI operations assistant. Ask about orders, draft customer messages, create content, or get business insights.
                        </p>
                      </div>
                      <div className="grid max-w-sm gap-2 sm:grid-cols-2">
                        {[
                          { label: "What's overdue?", prompt: "What orders and production items are overdue today?" },
                          { label: "Draft follow-up SMS", prompt: "Find the most urgent customer follow-up and draft an SMS for it." },
                          { label: "Revenue this month", prompt: "Pull the business overview and tell me about revenue and order trends." },
                          { label: "Write a blog post", prompt: "Write a 400-word blog post about the benefits of vehicle wraps for local businesses in Phoenix. Make it SEO-friendly." },
                        ].map((s) => (
                          <button
                            key={s.label}
                            onClick={() => sendMessage(s.prompt)}
                            className="rounded-lg border bg-card/50 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {messages.map((msg, i) => (
                      <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "assistant" && (
                          <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-primary/10">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                        <div className="max-w-[80%]">
                          {msg.role === "assistant" && msg.toolCalls?.length ? (
                            <div className="mb-2 space-y-1">
                              {msg.toolCalls.map((tc) => (
                                <ToolCallCard key={tc.id} call={tc} />
                              ))}
                            </div>
                          ) : null}
                          <div className={cn("rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                            msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                          )}>
                            {msg.role === "assistant" ? renderContent(msg.content) : msg.content.split("\n").map((line, j) => (
                              <span key={j}>{line}{j < msg.content.split("\n").length - 1 && <br />}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    {thinking && (
                      <div className="flex justify-start">
                        <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-primary/10">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* Input */}
                <div className="border-t bg-background/80 p-3 backdrop-blur">
                  <div className="flex gap-2">
                    <Textarea
                      ref={textareaRef}
                      className="min-h-[52px] max-h-[140px] resize-none text-sm"
                      placeholder="Ask about orders, draft an SMS, write a blog post, analyze revenue..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
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
                      onClick={() => sendMessage()}
                      disabled={thinking || !input.trim()}
                      aria-label="Send"
                    >
                      {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">Enter to send · Shift+Enter for new line</span>
                    {selectedModelConfig?.tools && (
                      <span className="text-[11px] text-primary/70">⚡ Tool calling enabled — agent can read data and send SMS/email</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
