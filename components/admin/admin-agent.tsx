"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, Bot, BrainCircuit, ChevronRight, KeyRound, Moon, PlugZap, Search, ShieldCheck, Sun, Workflow } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData, AdminProfile } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export function AdminAgent() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);

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
    const unpaid = orders.filter((order) => ["unpaid", "pending", "partially_paid"].includes(order.payment_status)).length;
    const proofing = orders.filter((order) => ["file_review", "proofing", "awaiting_approval"].includes(order.status)).length;
    const unread = messages.filter((message) => !message.read_at && message.direction === "inbound").length;
    const missingContact = users.filter((user) => !user.phone || !user.email).length;
    return { unpaid, proofing, unread, missingContact };
  }, [messages, orders, users]);

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div>
              <div className="text-sm font-semibold">Super Admin</div>
            </div>
          </div>
          <nav className="space-y-4">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
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

              <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Stat label="Integrations" value="0/3" hint="Ready after credentials" />
                <Stat label="Payment follow-up" value={String(agentSignals.unpaid)} hint="Potential billing automations" />
                <Stat label="Proof workflows" value={String(agentSignals.proofing)} hint="Review and reminder candidates" />
                <Stat label="Contact gaps" value={String(agentSignals.missingContact)} hint="Users missing email or SMS" />
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function AgentTask({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border bg-background/35 p-3"><div className="text-sm font-medium">{title}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}
