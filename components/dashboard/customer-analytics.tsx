"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, Box, CreditCard, Eye, FileCheck2, Heart, Home, IdCard, Link as LinkIcon, LogOut, MessageSquare, Moon, Settings, Share2, Sun, Truck, UserCircle, UserPlus, type LucideIcon } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AnalyticsData = {
  profile: { full_name: string | null };
  cards: { id: string; card_name: string; slug: string; status: string; is_public: boolean; view_count: number; updated_at: string | null }[];
  events: { id: string; digital_card_id: string; event_type: string; device_type: string | null; source: string | null; created_at: string | null }[];
  leads: { id: string; digital_card_id: string; name: string | null; email: string | null; phone: string | null; company: string | null; message: string | null; status: string; created_at: string | null }[];
  totals: { views: number; shares: number; likes: number; qrScans: number; linkClicks: number; copyLinks: number; savedContacts: number; leads: number };
  devices: Record<string, number>;
};

const navItems: { label: string; icon: LucideIcon; href: string; active?: boolean }[] = [
  { label: "Overview", icon: Home, href: "/dashboard/customer" },
  { label: "Orders", icon: Box, href: "/dashboard/customer#orders" },
  { label: "Invoices", icon: CreditCard, href: "/dashboard/customer#invoices" },
  { label: "Artwork", icon: FileCheck2, href: "/dashboard/customer#artwork" },
  { label: "Manage Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/customer/analytics", active: true },
  { label: "Profile", icon: UserCircle, href: "/dashboard/customer/profile" },
  { label: "Settings", icon: Settings, href: "/dashboard/customer/settings" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/customer#messages" },
  { label: "Shipping", icon: Truck, href: "/dashboard/customer#shipping" },
];

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

async function customerToken() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Sign in again before viewing analytics.");
  return session.access_token;
}

export function CustomerAnalytics() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("controlp_customer_theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const token = await customerToken();
        const response = await fetch("/api/dashboard/customer/analytics", { headers: { authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load analytics.");
        setData(payload as AnalyticsData);
        setState("ready");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load analytics.");
        setState("error");
      }
    }
    load();
  }, []);

  async function signOut() {
    const db = getSupabaseBrowserClient();
    await db?.auth.signOut();
    router.replace("/login");
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("controlp_customer_theme", next);
      return next;
    });
  }

  const recentEvents = data?.events.slice(0, 20) ?? [];
  const cardsById = useMemo(() => new Map((data?.cards ?? []).map((card) => [card.id, card])), [data?.cards]);

  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
        <a className="mb-5 flex items-center gap-3 px-2" href="/">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div>
            <div className="text-sm font-semibold">Customer</div>
          </div>
        </a>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, href, active }) => (
            <a key={label} href={href} className={cn("flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", active && "bg-accent font-medium text-accent-foreground")}>
              <Icon className="h-4 w-4" />
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
        <div className="flex h-12 items-center gap-3 px-5">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">Analytics</span></div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Notifications"><Bell className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Toggle theme" onClick={toggleTheme}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            <Button variant="outline" className="h-8 text-xs" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
        {state === "loading" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading analytics...</CardContent></Card>}
        {state === "error" && <Card className="border-red-500/30"><CardContent className="p-5 text-sm text-red-600 dark:text-red-300">{message}</CardContent></Card>}
        {state === "ready" && data && (
          <>
            <section className="mb-5">
              <h1 className="text-[25px] font-semibold tracking-tight">Analytics</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Track digital card views, shares, likes, contact saves, link clicks, and leads.</p>
            </section>

            <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Stat icon={<Eye className="h-4 w-4" />} label="Total views" value={data.totals.views} hint="Public card loads" />
              <Stat icon={<Share2 className="h-4 w-4" />} label="Shares" value={data.totals.shares} hint="Share sheet and copy actions" />
              <Stat icon={<Heart className="h-4 w-4" />} label="Likes" value={data.totals.likes} hint="Visitor interest signal" />
              <Stat icon={<UserPlus className="h-4 w-4" />} label="Leads" value={data.totals.leads} hint="Send me your info submissions" />
              <Stat icon={<LinkIcon className="h-4 w-4" />} label="Link clicks" value={data.totals.linkClicks} hint="Tracked link engagement" />
              <Stat icon={<IdCard className="h-4 w-4" />} label="Contacts saved" value={data.totals.savedContacts} hint=".vcf downloads" />
              <Stat icon={<BarChart3 className="h-4 w-4" />} label="QR scans" value={data.totals.qrScans} hint="QR scan events" />
              <Stat icon={<CopyIcon />} label="Copied links" value={data.totals.copyLinks} hint="Copy URL actions" />
            </section>

            <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Recent activity</CardTitle><CardDescription>Latest card engagement events.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="pl-4">Card</TableHead><TableHead>Event</TableHead><TableHead>Device</TableHead><TableHead className="pr-4 text-right">When</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {recentEvents.map((event) => <TableRow key={event.id}><TableCell className="pl-4 font-medium">{cardsById.get(event.digital_card_id)?.card_name || "Digital card"}</TableCell><TableCell><Badge variant="outline">{human(event.event_type)}</Badge></TableCell><TableCell>{human(event.device_type)}</TableCell><TableCell className="pr-4 text-right text-muted-foreground">{date(event.created_at)}</TableCell></TableRow>)}
                      {!recentEvents.length && <TableRow><TableCell colSpan={4} className="p-6 text-center text-muted-foreground">No tracked events yet.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Device mix</CardTitle><CardDescription>Where visitors are viewing cards.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(data.devices).map(([device, count]) => <Meter key={device} label={human(device)} value={count} total={Math.max(1, data.events.length)} />)}
                  {!Object.keys(data.devices).length && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Device data appears after public events are tracked.</div>}
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Lead capture</CardTitle><CardDescription>People who used the public “Send me your info” form.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.leads.map((lead) => (
                  <div key={lead.id} className="rounded-lg border bg-background/35 p-3">
                    <div className="flex items-start justify-between gap-3"><div className="font-medium">{lead.name || "New lead"}</div><Badge variant="outline">{human(lead.status)}</Badge></div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && <div>{lead.phone}</div>}
                      {lead.company && <div>{lead.company}</div>}
                      {lead.message && <div className="pt-1 text-foreground">{lead.message}</div>}
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">{date(lead.created_at)}</div>
                  </div>
                ))}
                {!data.leads.length && <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No leads yet. Public card lead forms will land here.</div>}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint: string }) {
  return <Card><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-primary">{icon}</div></div><div className="mt-2 text-[24px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = Math.round((value / total) * 100);
  return <div><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{value}</span></div><div className="h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div></div>;
}

function CopyIcon() {
  return <span className="text-xs font-semibold">URL</span>;
}
