"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, Box, CalendarClock, CreditCard, Eye, FileCheck2, Heart, Home, IdCard, Link as LinkIcon, LogOut, MessageSquare, Moon, QrCode, Settings, Share2, Smartphone, Sun, Truck, UserCircle, UserPlus, type LucideIcon } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AnalyticsData = {
  profile: { full_name: string | null; email?: string | null; company?: string | null; profile_photo_url?: string | null };
  cards: { id: string; card_name: string; slug: string; status: string; is_public: boolean; view_count: number; updated_at: string | null }[];
  events: { id: string; digital_card_id: string; event_type: string; device_type: string | null; source: string | null; created_at: string | null }[];
  leads: { id: string; digital_card_id: string; name: string | null; email: string | null; phone: string | null; company: string | null; message: string | null; status: string; created_at: string | null }[];
  totals: { views: number; organicViews: number; shares: number; likes: number; qrScans: number; nfcTaps: number; linkClicks: number; copyLinks: number; savedContacts: number; leads: number };
  devices: Record<string, number>;
  sources: Record<string, number>;
};

const navItems: { label: string; icon: LucideIcon; href: string; active?: boolean }[] = [
  { label: "Overview", icon: Home, href: "/dashboard/customer" },
  { label: "Profile", icon: UserCircle, href: "/dashboard/customer/profile" },
  { label: "Orders", icon: Box, href: "/dashboard/customer#orders" },
  { label: "Invoices", icon: CreditCard, href: "/dashboard/customer#invoices" },
  { label: "Artwork", icon: FileCheck2, href: "/dashboard/customer#artwork" },
  { label: "Bookings", icon: CalendarClock, href: "/dashboard/customer#bookings" },
  { label: "My Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/customer/analytics", active: true },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/customer#messages" },
  { label: "Shipping", icon: Truck, href: "/dashboard/customer#shipping" },
  { label: "Settings", icon: Settings, href: "/dashboard/customer/settings" },
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
        {data?.profile && <div className="absolute bottom-3 left-3 right-3 rounded-xl border bg-background/55 p-2">
          <div className="flex items-center gap-2">
            {data.profile.profile_photo_url ? <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={data.profile.profile_photo_url} alt="" /> : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{(data.profile.full_name || data.profile.email || "C").slice(0, 1).toUpperCase()}</div>}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{data.profile.full_name || "Customer"}</div>
              <div className="truncate text-xs text-muted-foreground">{data.profile.company || data.profile.email || "ControlP.io"}</div>
            </div>
          </div>
        </div>}
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
              <Stat icon={<Eye className="h-4 w-4" />} label="Total views" value={data.totals.views} hint="All-time card loads" />
              <Stat icon={<Smartphone className="h-4 w-4" />} label="NFC taps" value={data.totals.nfcTaps} hint="Physical tap-to-share events" accent />
              <Stat icon={<QrCode className="h-4 w-4" />} label="QR scans" value={data.totals.qrScans} hint="QR code scan events" />
              <Stat icon={<UserPlus className="h-4 w-4" />} label="Leads" value={data.totals.leads} hint="Send me your info submissions" />
              <Stat icon={<LinkIcon className="h-4 w-4" />} label="Link clicks" value={data.totals.linkClicks} hint="Tracked link engagement" />
              <Stat icon={<IdCard className="h-4 w-4" />} label="Contacts saved" value={data.totals.savedContacts} hint=".vcf downloads" />
              <Stat icon={<Share2 className="h-4 w-4" />} label="Shares" value={data.totals.shares} hint="Share sheet and copy actions" />
              <Stat icon={<Heart className="h-4 w-4" />} label="Likes" value={data.totals.likes} hint="Visitor interest signal" />
            </section>

            <section className="mb-5">
              <ActivityChart events={data.events} />
            </section>

            <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_420px]">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Recent activity</CardTitle><CardDescription>Latest card engagement events.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="pl-4">Card</TableHead><TableHead>Event</TableHead><TableHead>Source</TableHead><TableHead>Device</TableHead><TableHead className="pr-4 text-right">When</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {recentEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="pl-4 font-medium">{cardsById.get(event.digital_card_id)?.card_name || "Digital card"}</TableCell>
                          <TableCell><SourceBadge type={event.event_type} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{event.source || "organic"}</TableCell>
                          <TableCell>{human(event.device_type)}</TableCell>
                          <TableCell className="pr-4 text-right text-muted-foreground">{date(event.created_at)}</TableCell>
                        </TableRow>
                      ))}
                      {!recentEvents.length && <TableRow><TableCell colSpan={5} className="p-6 text-center text-muted-foreground">No tracked events yet. Share your card link to start seeing data.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Traffic sources</CardTitle><CardDescription>How visitors are finding your card.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(data.sources).length > 0
                      ? Object.entries(data.sources).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                          <Meter key={source} label={sourceLabel(source)} value={count} total={Math.max(1, data.events.length)} />
                        ))
                      : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Source data appears after events are tracked.</div>
                    }
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Device mix</CardTitle><CardDescription>Where visitors are viewing cards.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(data.devices).map(([device, count]) => <Meter key={device} label={human(device)} value={count} total={Math.max(1, data.events.length)} />)}
                    {!Object.keys(data.devices).length && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Device data appears after public events are tracked.</div>}
                  </CardContent>
                </Card>
              </div>
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

function sourceLabel(source: string) {
  if (source === "nfc") return "NFC tap";
  if (source === "qr") return "QR scan";
  if (source === "organic") return "Direct / organic";
  return human(source);
}

const eventColors: Record<string, string> = {
  nfc_tap: "border-primary/30 bg-primary/15 text-lime-800 dark:text-lime-200",
  qr_scan: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  view: "border-border bg-muted/50 text-muted-foreground",
  link_click: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  lead_submit: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  save_contact: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  share: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  like: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  copy_link: "border-border bg-muted/50 text-muted-foreground",
};

function SourceBadge({ type }: { type: string }) {
  return <Badge className={`border text-[11px] ${eventColors[type] || "border-border bg-muted/50 text-muted-foreground"}`}>{human(type)}</Badge>;
}

function Stat({ icon, label, value, hint, accent }: { icon: ReactNode; label: string; value: number; hint: string; accent?: boolean }) {
  return (
    <Card className={accent && value > 0 ? "border-primary/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={accent && value > 0 ? "text-primary" : "text-muted-foreground"}>{icon}</div>
        </div>
        <div className={`mt-2 text-[24px] font-semibold leading-none ${accent && value > 0 ? "text-primary" : ""}`}>{value}</div>
        <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = Math.round((value / total) * 100);
  return <div><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{value}</span></div><div className="h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div></div>;
}

function CopyIcon() {
  return <span className="text-xs font-semibold">URL</span>;
}

// ── Activity bar chart ───────────────────────────────────────────────────────

type DayPoint = { dateKey: string; shortLabel: string; fullLabel: string; views: number; nfc: number; qr: number };

function buildTimeSeries(events: AnalyticsData["events"], days = 14): DayPoint[] {
  const today = new Date();
  const points: DayPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    return {
      dateKey: d.toISOString().slice(0, 10),
      shortLabel: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d),
      fullLabel: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(d),
      views: 0, nfc: 0, qr: 0,
    };
  });
  const byDate = new Map(points.map((p, i) => [p.dateKey, i]));
  for (const e of events) {
    if (!e.created_at) continue;
    const idx = byDate.get(e.created_at.slice(0, 10));
    if (idx === undefined) continue;
    if (e.event_type === "view") points[idx].views++;
    else if (e.event_type === "nfc_tap") points[idx].nfc++;
    else if (e.event_type === "qr_scan") points[idx].qr++;
  }
  return points;
}

const BAR_SERIES = [
  { key: "views" as const, label: "Views", color: "#94a3b8" },
  { key: "nfc" as const, label: "NFC taps", color: "#84cc16" },
  { key: "qr" as const, label: "QR scans", color: "#60a5fa" },
];

function ActivityChart({ events }: { events: AnalyticsData["events"] }) {
  const points = useMemo(() => buildTimeSeries(events, 14), [events]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [VW, setVW] = useState(800);

  // Track actual container width so SVG coordinates match CSS pixels 1:1 — no viewBox scaling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w > 0) setVW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const VH = 200;
  const ML = 36, MR = 12, MT = 12, MB = 28;
  const PW = VW - ML - MR, PH = VH - MT - MB;
  const n = points.length;
  const groupW = PW / n;
  const barW = Math.max(8, groupW * 0.6);

  const maxStack = useMemo(() => Math.max(1, ...points.map((p) => p.views + p.nfc + p.qr)), [points]);
  const yMax = Math.ceil(maxStack / 4) * 4 || 4;
  const yTicks = [0, Math.round(yMax / 4), Math.round(yMax / 2), Math.round(yMax * 3 / 4), yMax];

  function toY(v: number) { return MT + PH - (v / yMax) * PH; }
  function barX(i: number) { return ML + i * groupW + (groupW - barW) / 2; }

  const totalEvents = points.reduce((s, p) => s + p.views + p.nfc + p.qr, 0);
  const avgPerDay = (totalEvents / n).toFixed(1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">14-day activity</CardTitle>
            <CardDescription>Daily events over the last two weeks.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {BAR_SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div ref={containerRef} className="relative">
          <svg
            width={VW}
            height={VH}
            style={{ display: "block", width: "100%", overflow: "visible" }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const i = Math.max(0, Math.min(n - 1, Math.floor((x - ML) / groupW)));
              setHoverIdx(i);
            }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Y grid */}
            {yTicks.map((tick) => {
              const y = toY(tick).toFixed(1);
              return (
                <g key={tick}>
                  <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke="currentColor" strokeOpacity={0.07} strokeWidth={1} />
                  <text x={ML - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="currentColor" fillOpacity={0.4}>{tick}</text>
                </g>
              );
            })}

            {/* Stacked bars */}
            {points.map((p, i) => {
              const isHovered = hoverIdx === i;
              const segments: { key: "views" | "nfc" | "qr"; count: number; color: string }[] = [
                { key: "views", count: p.views, color: "#94a3b8" },
                { key: "nfc", count: p.nfc, color: "#84cc16" },
                { key: "qr", count: p.qr, color: "#60a5fa" },
              ];
              let yOffset = MT + PH;
              return (
                <g key={p.dateKey}>
                  {isHovered && (
                    <rect x={ML + i * groupW} y={MT} width={groupW} height={PH} fill="currentColor" fillOpacity={0.04} rx={2} />
                  )}
                  {segments.map(({ key, count, color }) => {
                    if (!count) return null;
                    const h = (count / yMax) * PH;
                    yOffset -= h;
                    return (
                      <rect key={key} x={barX(i)} y={yOffset} width={barW} height={h} fill={color} fillOpacity={isHovered ? 1 : 0.75} rx={2} />
                    );
                  })}
                </g>
              );
            })}

            {/* X labels — every 3rd day */}
            {points.map((p, i) => {
              if (i % 3 !== 0) return null;
              return (
                <text key={p.dateKey} x={(barX(i) + barW / 2).toFixed(1)} y={VH - 6} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.45}>
                  {p.shortLabel}
                </text>
              );
            })}
          </svg>

          {/* Hover tooltip */}
          {hoverIdx !== null && (() => {
            const p = points[hoverIdx];
            const pct = ((hoverIdx + 0.5) / n * 100).toFixed(1);
            return (
              <div
                className="pointer-events-none absolute top-0 z-10 rounded-lg border bg-popover px-3 py-2 text-[11px] shadow-lg"
                style={{ left: `calc(${pct}% - 60px)`, minWidth: 120 }}
              >
                <div className="mb-1.5 font-semibold text-foreground">{p.fullLabel}</div>
                {BAR_SERIES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-sm" style={{ background: s.color }} />{s.label}
                    </span>
                    <span className="font-medium text-foreground">{p[s.key]}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
          <span><span className="font-medium text-foreground">{totalEvents}</span> events in 14 days</span>
          <span>Avg <span className="font-medium text-foreground">{avgPerDay}</span> / day</span>
        </div>
      </CardContent>
    </Card>
  );
}
