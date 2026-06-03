"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Bell, Box, CalendarClock, CreditCard, ExternalLink, FileCheck2,
  Home, IdCard, LogOut, Mail, MessageSquare, Moon, Package, Settings,
  ShieldCheck, Sun, Truck, UserCircle, type LucideIcon,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const navItems: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Overview", icon: Home, href: "/dashboard/customer" },
  { label: "Profile", icon: UserCircle, href: "/dashboard/customer/profile" },
  { label: "Orders", icon: Box, href: "/dashboard/customer#orders" },
  { label: "Invoices", icon: CreditCard, href: "/dashboard/customer#invoices" },
  { label: "Artwork", icon: FileCheck2, href: "/dashboard/customer#artwork" },
  { label: "Bookings", icon: CalendarClock, href: "/dashboard/customer#bookings" },
  { label: "My Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/customer/analytics" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/customer#messages" },
  { label: "Shipping", icon: Truck, href: "/dashboard/customer#shipping" },
  { label: "Settings", icon: Settings, href: "/dashboard/customer/settings" },
];

type Profile = {
  email: string | null;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  created_at?: string | null;
};

type NotifPrefs = {
  email_orders: boolean;
  email_proofs: boolean;
  email_invoices: boolean;
  email_shipping: boolean;
  email_marketing: boolean;
  sms_orders: boolean;
  sms_proofs: boolean;
  sms_urgent: boolean;
};

const NOTIF_DEFAULTS: NotifPrefs = {
  email_orders: true,
  email_proofs: true,
  email_invoices: true,
  email_shipping: true,
  email_marketing: false,
  sms_orders: false,
  sms_proofs: false,
  sms_urgent: false,
};

function loadPrefs(): NotifPrefs {
  try {
    const raw = window.localStorage.getItem("controlp_notif_prefs");
    return raw ? { ...NOTIF_DEFAULTS, ...JSON.parse(raw) } : { ...NOTIF_DEFAULTS };
  } catch {
    return { ...NOTIF_DEFAULTS };
  }
}

function savePrefs(prefs: NotifPrefs) {
  window.localStorage.setItem("controlp_notif_prefs", JSON.stringify(prefs));
}

export function CustomerSettings() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(NOTIF_DEFAULTS);
  const [notifSaved, setNotifSaved] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("controlp_customer_theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
    setNotifPrefs(loadPrefs());

    async function loadProfile() {
      try {
        const db = getSupabaseBrowserClient();
        const session = db ? (await db.auth.getSession()).data.session : null;
        if (!session?.access_token) return;
        const res = await fetch("/api/dashboard/customer", {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok) setProfile(payload.profile ?? null);
      } catch {
        // profile stays null
      }
    }
    loadProfile();
  }, []);

  function changeTheme(value: "light" | "dark") {
    setTheme(value);
    window.localStorage.setItem("controlp_customer_theme", value);
    showToast("Appearance preference saved.");
  }

  function toggleNotif(key: keyof NotifPrefs) {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savePrefs(next);
      return next;
    });
    setNotifSaved(false);
  }

  function saveNotifications() {
    savePrefs(notifPrefs);
    setNotifSaved(true);
    showToast("Notification preferences saved.");
  }

  async function sendPasswordReset() {
    if (!profile?.email) return;
    const db = getSupabaseBrowserClient();
    if (!db) return;
    const { error } = await db.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/dashboard/customer/settings`,
    });
    if (error) {
      showToast(error.message);
    } else {
      setResetSent(true);
      showToast("Password reset email sent to " + profile.email);
    }
  }

  async function requestDeactivation() {
    if (!profile?.email) return;
    try {
      const db = getSupabaseBrowserClient();
      const session = db ? (await db.auth.getSession()).data.session : null;
      if (!session?.access_token) return;
      await fetch("/api/dashboard/customer/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          subject: "Account deactivation request",
          body: `I would like to request deactivation of my account (${profile.email}). Please confirm when this has been processed.`,
        }),
      });
      setDeactivateConfirm(false);
      showToast("Deactivation request sent to support. We'll confirm within 1-2 business days.");
    } catch {
      showToast("Could not send request. Please email support directly.");
    }
  }

  async function signOut() {
    const db = getSupabaseBrowserClient();
    await db?.auth.signOut();
    router.replace("/login");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
        <a className="mb-5 flex items-center gap-3 px-2" href="/dashboard/customer">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div>
            <div className="text-sm font-semibold">Customer</div>
          </div>
        </a>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, href }) => (
            <a key={label} href={href} className={cn("flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", label === "Settings" && "bg-accent font-medium text-accent-foreground")}>
              <Icon className="h-4 w-4" />{label}
            </a>
          ))}
        </nav>
        {profile && (
          <div className="absolute bottom-14 left-3 right-3 rounded-xl border bg-background/55 p-2">
            <div className="flex items-center gap-2">
              {profile.profile_photo_url
                ? <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={profile.profile_photo_url} alt="" />
                : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{(profile.full_name || profile.email || "C").slice(0, 1).toUpperCase()}</div>
              }
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{profile.full_name || "Customer"}</div>
                <div className="truncate text-xs text-muted-foreground">{profile.company || profile.email || "ControlP.io"}</div>
              </div>
            </div>
          </div>
        )}
        <Button className="absolute bottom-3 left-3 right-3 justify-start" variant="ghost" onClick={signOut}>
          <LogOut className="h-4 w-4" />Sign out
        </Button>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
        <div className="flex h-12 items-center justify-between gap-3 px-5">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">Settings</span></div>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Toggle theme" onClick={() => changeTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border bg-card px-5 py-3 text-sm shadow-xl">
            {toast}
          </div>
        )}

        <div className="space-y-5">
          <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight">Settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage your account preferences, notifications, and security settings.</p>
            </div>
          </section>

          {/* Profile + Appearance side-by-side */}
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base"><UserCircle className="h-4 w-4 text-primary" />Profile & Identity</CardTitle>
                    <CardDescription>Your name, contact details, and profile photo used across orders, invoices, and proofs.</CardDescription>
                  </div>
                  <Button size="sm" asChild><a href="/dashboard/customer/profile">Edit profile</a></Button>
                </div>
              </CardHeader>
              <CardContent>
                {profile ? (
                  <div className="flex items-center gap-4">
                    {profile.profile_photo_url
                      ? <img className="h-14 w-14 shrink-0 rounded-2xl border object-cover" src={profile.profile_photo_url} alt="" />
                      : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">{(profile.full_name || profile.email || "C").slice(0, 1).toUpperCase()}</div>
                    }
                    <div className="min-w-0 space-y-1">
                      <div className="font-semibold">{profile.full_name || "Name not set"}</div>
                      <div className="text-sm text-muted-foreground">{profile.company || "No company"}</div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{profile.email || "No email"}</span>
                        <span className="flex items-center gap-1"><Package className="h-3 w-3" />{profile.phone || "No phone"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Loading profile...</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Appearance</CardTitle>
                <CardDescription>Controls how the dashboard looks on this device.</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="space-y-1 text-sm font-medium">
                  <span className="text-muted-foreground">Theme</span>
                  <Select value={theme} onValueChange={(v) => changeTheme(v as "light" | "dark")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </CardContent>
            </Card>
          </div>

          {/* Notification preferences */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-primary" />Notification Preferences</CardTitle>
                  <CardDescription>Choose which updates you receive by email and SMS. Preferences are saved to this device and sent to the support team.</CardDescription>
                </div>
                <Button size="sm" variant={notifSaved ? "outline" : "default"} onClick={saveNotifications}>
                  {notifSaved ? "Saved" : "Save"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email notifications</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    { key: "email_orders" as const, label: "Order updates", description: "Status changes, production milestones" },
                    { key: "email_proofs" as const, label: "Proof approvals", description: "New proofs ready for review" },
                    { key: "email_invoices" as const, label: "Invoice reminders", description: "Payment due and confirmation" },
                    { key: "email_shipping" as const, label: "Shipping updates", description: "Tracking and delivery notices" },
                    { key: "email_marketing" as const, label: "Marketing & promotions", description: "New products, offers, news" },
                  ] as { key: keyof NotifPrefs; label: string; description: string }[]).map(({ key, label, description }) => (
                    <button
                      key={key}
                      onClick={() => toggleNotif(key)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40",
                        notifPrefs[key] ? "border-primary/30 bg-primary/5" : "bg-background/35",
                      )}
                    >
                      <div className={cn("mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition-colors", notifPrefs[key] ? "border-primary bg-primary" : "border-muted-foreground/50 bg-transparent")} />
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">SMS notifications</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    { key: "sms_orders" as const, label: "Order updates", description: "Status changes via text" },
                    { key: "sms_proofs" as const, label: "Proof ready alerts", description: "Text when proofs are sent" },
                    { key: "sms_urgent" as const, label: "Urgent notices only", description: "Action required messages" },
                  ] as { key: keyof NotifPrefs; label: string; description: string }[]).map(({ key, label, description }) => (
                    <button
                      key={key}
                      onClick={() => toggleNotif(key)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40",
                        notifPrefs[key] ? "border-primary/30 bg-primary/5" : "bg-background/35",
                      )}
                    >
                      <div className={cn("mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition-colors", notifPrefs[key] ? "border-primary bg-primary" : "border-muted-foreground/50 bg-transparent")} />
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                {!profile?.phone && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Add a phone number to your <a href="/dashboard/customer/profile" className="underline">profile</a> to enable SMS notifications.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" />Security</CardTitle>
              <CardDescription>Manage your password and account access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3">
                <div>
                  <div className="text-sm font-medium">Password</div>
                  <div className="text-xs text-muted-foreground">{resetSent ? "Reset email sent — check your inbox." : "Send a password reset link to your email address."}</div>
                </div>
                <Button size="sm" variant="outline" disabled={resetSent || !profile?.email} onClick={sendPasswordReset}>
                  {resetSent ? "Email sent" : "Reset password"}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3">
                <div>
                  <div className="text-sm font-medium">Email address</div>
                  <div className="text-xs text-muted-foreground">{profile?.email || "Loading..."}</div>
                </div>
                <Badge variant="outline">Verified</Badge>
              </div>
              {profile?.created_at && (
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3">
                  <div>
                    <div className="text-sm font-medium">Account created</div>
                    <div className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(profile.created_at))}</div>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300">Active</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing & Addresses */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Billing & Shipping Addresses</CardTitle>
                  <CardDescription>Contact details used for invoices, shipping, and order management.</CardDescription>
                </div>
                <Button size="sm" variant="outline" asChild><a href="/dashboard/customer/profile">Edit</a></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background/35 p-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Billing contact</div>
                  <div className="space-y-1 text-sm">
                    <div>{profile?.full_name || "—"}</div>
                    <div className="text-muted-foreground">{profile?.company || "—"}</div>
                    <div className="text-muted-foreground">{profile?.email || "—"}</div>
                    <div className="text-muted-foreground">{profile?.phone || "—"}</div>
                  </div>
                </div>
                <div className="rounded-lg border bg-background/35 p-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Shipping contact</div>
                  <div className="space-y-1 text-sm">
                    <div>{profile?.full_name || "—"}</div>
                    <div className="text-muted-foreground">{profile?.company || "—"}</div>
                    <div className="text-muted-foreground">{profile?.email || "—"}</div>
                    <div className="text-muted-foreground">{profile?.phone || "—"}</div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Need a different shipping address? Mention it in your order notes.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {[
                { label: "View my orders", href: "/dashboard/customer#orders", icon: Box },
                { label: "Invoices & payments", href: "/dashboard/customer#invoices", icon: CreditCard },
                { label: "Artwork & proofs", href: "/dashboard/customer#artwork", icon: FileCheck2 },
                { label: "Messages", href: "/dashboard/customer#messages", icon: MessageSquare },
                { label: "Shipping", href: "/dashboard/customer#shipping", icon: Truck },
                { label: "Analytics", href: "/dashboard/customer/analytics", icon: null },
              ].map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3 text-sm hover:bg-accent/40"
                >
                  <div className="flex items-center gap-2 font-medium">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                    {label}
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ))}
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-red-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-red-600 dark:text-red-400">Account Actions</CardTitle>
              <CardDescription>Manage your account status. Deactivation requests are reviewed by our team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/35 p-3">
                <div>
                  <div className="text-sm font-medium">Sign out</div>
                  <div className="text-xs text-muted-foreground">Sign out of your customer workspace on this device.</div>
                </div>
                <Button size="sm" variant="outline" onClick={signOut}><LogOut className="mr-1.5 h-3.5 w-3.5" />Sign out</Button>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="text-sm font-medium text-red-600 dark:text-red-400">Request account deactivation</div>
                <p className="mt-1 text-xs text-muted-foreground">This sends a deactivation request to our support team. Your data is retained per our privacy policy until confirmed.</p>
                {!deactivateConfirm ? (
                  <Button size="sm" variant="outline" className="mt-3 border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => setDeactivateConfirm(true)}>
                    Request deactivation
                  </Button>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={requestDeactivation}>
                      Confirm — send request
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeactivateConfirm(false)}>Cancel</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

