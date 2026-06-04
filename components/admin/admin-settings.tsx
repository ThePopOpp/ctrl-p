"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Moon, Search, ShieldCheck, Sun } from "lucide-react";

import { getCurrentAdminProfile, loadAdminDashboardData } from "@/lib/admin/admin-api";
import { adminNavGroups, isAdminNavActive } from "@/lib/admin/navigation";
import type { AdminDashboardData } from "@/lib/admin/types";
import { ROLE_PERMISSIONS } from "@/lib/rbac/permissions";
import { ROLES } from "@/lib/rbac/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type MessagingConfig = {
  twilio?: { configured: boolean; phoneNumber: string; webhookUrl?: string };
  smtp?: { configured: boolean; host: string; port: string; from: string };
  imap?: { configured: boolean; host: string; port: string; mailbox?: string };
};

function human(value: string | null | undefined) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadMessagingConfig(): Promise<MessagingConfig | null> {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session) return null;
  const response = await fetch("/api/admin/messaging/config", { headers: { authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) return null;
  return response.json();
}

export function AdminSettings() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [config, setConfig] = useState<MessagingConfig | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function boot() {
      const profile = await getCurrentAdminProfile();
      if (!profile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setAuthState("denied");
        return;
      }
      setAuthState("allowed");
      const [nextData, nextConfig] = await Promise.all([loadAdminDashboardData(), loadMessagingConfig()]);
      setData(nextData);
      setConfig(nextConfig);
    }
    boot();
  }, []);

  const users = data?.users ?? [];
  const orders = data?.orders ?? [];
  const payments = data?.payments ?? [];
  const messages = data?.messages ?? [];
  const activity = data?.activityLogs ?? [];
  const internalCount = users.filter((user) => ["super_admin", "admin", "employee", "staff", "production_manager", "installer", "customer_support"].includes(user.role)).length;
  const roleRows = Object.values(ROLES).filter((role) => role.toLowerCase().includes(query.toLowerCase().trim()) || !query.trim());

  return (
    <div className={cn(theme === "dark" && "dark")}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
          <div className="mb-5 px-2"><a href="/admin"><img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[140px] dark:hidden" /><img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[140px] dark:block" /></a><div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Super Admin</div></div>
          <nav className="space-y-4">{adminNavGroups.map((group) => <div key={group.label}><div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div><div className="space-y-0.5">{group.items.map(([label, Icon, href]) => <Link key={label} href={href} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", isAdminNavActive(label, pathname) && "bg-accent font-medium text-accent-foreground")}><Icon className="h-4 w-4" />{label}{label === "Orders" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{orders.length}</Badge>}{label === "Payments" && <Badge className="ml-auto h-5 bg-primary/20 px-1.5 text-[10px] text-foreground">{payments.length}</Badge>}{label === "Messages" && <Badge className="ml-auto h-5 bg-red-500/10 px-1.5 text-[10px] text-red-600 dark:text-red-300">{messages.length}</Badge>}</Link>)}</div></div>)}</nav>
        </aside>
        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]"><div className="flex h-12 items-center gap-3 px-5"><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Super Admin</span><ChevronRight className="h-3.5 w-3.5" /><span className="font-medium text-foreground">Settings</span></div><div className="ml-auto flex items-center gap-2"><div className="relative hidden w-[380px] md:block"><Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" /><Input className="h-8 rounded-lg pl-9 text-xs" placeholder="Search settings, roles, integrations..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><Button variant="outline" size="icon" aria-label="Notifications" className="h-8 w-8"><Bell className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Toggle theme" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button></div></div></header>
        <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
          {authState === "checking" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Checking admin access...</CardContent></Card>}
          {authState === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-600 dark:text-red-300">Admin access required</div><Button className="mt-4" asChild><a href="/login?redirect=/admin/settings">Go to login</a></Button></CardContent></Card>}
          {authState === "allowed" && <>
            <div className="mb-5"><h1 className="text-[25px] font-semibold tracking-tight">Settings command center</h1><p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Review RBAC, integrations, notifications, billing, shipping, and operational readiness before adding the next user dashboards.</p></div>
            <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Stat label="Users" value={String(users.length)} hint="Accounts governed" /><Stat label="Internal" value={String(internalCount)} hint="Admin console roles" /><Stat label="Orders" value={String(orders.length)} hint="Workflow records" /><Stat label="Payments" value={String(payments.length)} hint="Billing records" /><Stat label="Messages" value={String(messages.length)} hint="Notification context" /></section>
            <section className="grid gap-4 xl:grid-cols-[1fr_420px]"><Card><CardHeader className="pb-3"><CardTitle className="text-base">Roles and permissions</CardTitle><CardDescription>Current app RBAC map used for dashboard routing and access checks.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{roleRows.map((role) => <div key={role} className="rounded-lg border bg-background/35 p-3"><div className="flex items-center justify-between"><div className="font-medium">{human(role)}</div><ShieldCheck className="h-4 w-4 text-primary" /></div><div className="mt-2 text-xs text-muted-foreground">{ROLE_PERMISSIONS[role]?.length || 0} permissions</div></div>)}</CardContent></Card><div className="space-y-4"><Card><CardHeader className="pb-3"><CardTitle className="text-base">Integration readiness</CardTitle></CardHeader><CardContent className="space-y-2"><ReadyRow title="Twilio SMS" detail={config?.twilio?.phoneNumber || "TWILIO_* env vars"} ready={Boolean(config?.twilio?.configured)} /><ReadyRow title="SMTP email" detail={`${config?.smtp?.host || "SMTP_HOST"}:${config?.smtp?.port || "465"}`} ready={Boolean(config?.smtp?.configured)} /><ReadyRow title="IMAP inbox" detail={`${config?.imap?.host || "IMAP_HOST"} / ${config?.imap?.mailbox || "INBOX"}`} ready={Boolean(config?.imap?.configured)} /><ReadyRow title="Square payments" detail="SQUARE_* env vars configured in Coolify" ready /><ReadyRow title="UPS / USPS" detail="UPS_* and USPS_* ready for live rate wiring" ready /></CardContent></Card><Card><CardHeader className="pb-3"><CardTitle className="text-base">Recent audit activity</CardTitle></CardHeader><CardContent className="space-y-2">{activity.slice(0, 8).map((item) => <div key={item.id} className="rounded-lg border bg-background/35 p-3"><div className="text-sm font-medium">{human(item.action)}</div><div className="text-xs text-muted-foreground">{human(item.entity_type)} - {new Date(item.created_at).toLocaleString()}</div></div>)}{!activity.length && <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No recent audit activity loaded.</div>}</CardContent></Card></div></section>
          </>}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function ReadyRow({ title, detail, ready }: { title: string; detail: string; ready: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{title}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><Badge className={ready ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}>{ready ? "Ready" : "Missing"}</Badge></div>;
}
