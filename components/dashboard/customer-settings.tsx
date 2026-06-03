"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, Box, CalendarClock, CreditCard, FileCheck2, Home, IdCard, LogOut, MessageSquare, Moon, Settings, Sun, Truck, UserCircle, type LucideIcon } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function CustomerSettings() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null; company: string | null; profile_photo_url?: string | null } | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("controlp_customer_theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    async function loadProfile() {
      try {
        const db = getSupabaseBrowserClient();
        const session = db ? (await db.auth.getSession()).data.session : null;
        if (!session?.access_token) return;
        const response = await fetch("/api/dashboard/customer", { headers: { authorization: `Bearer ${session.access_token}` } });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) setProfile(payload.profile || null);
      } catch {
        setProfile(null);
      }
    }
    loadProfile();
  }, []);

  function changeTheme(value: "light" | "dark") {
    setTheme(value);
    window.localStorage.setItem("controlp_customer_theme", value);
    setMessage("Dashboard appearance saved on this device.");
  }

  async function signOut() {
    const db = getSupabaseBrowserClient();
    await db?.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
        <a className="mb-5 flex items-center gap-3 px-2" href="/dashboard/customer">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
          <div><div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div><div className="text-sm font-semibold">Customer</div></div>
        </a>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, href }) => (
            <a key={label} href={href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground", label === "Settings" && "bg-primary/25 text-primary")}>
              <Icon className="h-4 w-4" /> {label}
            </a>
          ))}
        </nav>
        {profile && <div className="absolute bottom-16 left-3 right-3 rounded-xl border bg-background/55 p-2">
          <div className="flex items-center gap-2">
            {profile.profile_photo_url ? <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={profile.profile_photo_url} alt="" /> : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{(profile.full_name || profile.email || "C").slice(0, 1).toUpperCase()}</div>}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{profile.full_name || "Customer"}</div>
              <div className="truncate text-xs text-muted-foreground">{profile.company || profile.email || "ControlP.io"}</div>
            </div>
          </div>
        </div>}
        <Button className="absolute bottom-3 left-3 right-3 justify-start" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
      </aside>
      <main className="min-h-screen lg:pl-[238px]">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background/90 px-5 backdrop-blur">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">Settings</span></div>
          <Button variant="outline" size="icon" onClick={() => changeTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
        </header>
        <section className="mx-auto max-w-3xl space-y-5 p-5">
          <div>
            <h1 className="text-[25px] font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Control dashboard preferences and prepare notification settings for customer tools.</p>
          </div>
          {message && <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{message}</div>}
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Appearance</CardTitle>
              <CardDescription>This controls the signed-in customer dashboard on this device.</CardDescription>
            </CardHeader>
            <CardContent className="max-w-sm">
              <label className="space-y-1 text-sm font-medium">
                <span className="text-muted-foreground">Theme</span>
                <Select value={theme} onValueChange={(value) => changeTheme(value as "light" | "dark")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
              <CardDescription>Coming soon: order updates, proof alerts, lead notifications, Square subscription alerts, and shipping updates.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {["Email notifications", "SMS notifications", "Lead routing", "Invoice reminders"].map((item) => (
                <div key={item} className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{item}</div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
