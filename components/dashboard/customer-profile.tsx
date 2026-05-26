"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Box, Camera, CreditCard, FileCheck2, Home, IdCard, LogOut, MessageSquare, Moon, Save, Settings, Sun, Truck, Upload, UserCircle, type LucideIcon } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CustomerProfileData = {
  profile: {
    email: string | null;
    full_name: string | null;
    phone: string | null;
    company: string | null;
    profile_photo_url: string | null;
    role: string;
    status: string;
  };
};

const navItems: { label: string; icon: LucideIcon; href: string; active?: boolean }[] = [
  { label: "Overview", icon: Home, href: "/dashboard/customer" },
  { label: "Profile", icon: UserCircle, href: "/dashboard/customer/profile", active: true },
  { label: "Orders", icon: Box, href: "/dashboard/customer#orders" },
  { label: "Invoices", icon: CreditCard, href: "/dashboard/customer#invoices" },
  { label: "Artwork", icon: FileCheck2, href: "/dashboard/customer#artwork" },
  { label: "My Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/customer/analytics" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/customer#messages" },
  { label: "Shipping", icon: Truck, href: "/dashboard/customer#shipping" },
  { label: "Settings", icon: Settings, href: "/dashboard/customer/settings" },
];

async function customerToken() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Sign in again before editing your profile.");
  return session.access_token;
}

export function CustomerProfile() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", company: "", email: "", profile_photo_url: "" });

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("controlp_customer_theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const token = await customerToken();
        const response = await fetch("/api/dashboard/customer", { headers: { authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load profile.");
        const profile = (payload as CustomerProfileData).profile;
        setForm({
          full_name: profile.full_name || "",
          phone: profile.phone || "",
          company: profile.company || "",
          email: profile.email || "",
          profile_photo_url: profile.profile_photo_url || "",
        });
        setState("ready");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load profile.");
        setState("error");
      }
    }
    load();
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("controlp_customer_theme", next);
      return next;
    });
  }

  async function save() {
    try {
      setMessage("");
      const token = await customerToken();
      const response = await fetch("/api/dashboard/customer", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save profile.");
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    try {
      setUploading(true);
      setMessage("");
      const token = await customerToken();
      const body = new FormData();
      body.append("file", file);
      body.append("media_type", "customer-profile-photo");
      const response = await fetch("/api/dashboard/customer/digital-cards/media", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not upload profile photo.");
      setForm((current) => ({ ...current, profile_photo_url: String(payload.publicUrl || "") }));
      setMessage("Profile photo uploaded. Save your profile to keep this change.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload profile photo.");
    } finally {
      setUploading(false);
    }
  }

  async function signOut() {
    const db = getSupabaseBrowserClient();
    await db?.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      <CustomerSidebar active="Profile" profile={form} onSignOut={signOut} />
      <main className="min-h-screen lg:pl-[238px]">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background/90 px-5 backdrop-blur">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">Profile</span></div>
          <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
        </header>
        <section className="mx-auto max-w-3xl space-y-5 p-5">
          <div>
            <h1 className="text-[25px] font-semibold tracking-tight">Customer Profile</h1>
            <p className="text-sm text-muted-foreground">Keep contact information current for orders, invoices, proofs, shipping, and digital products.</p>
          </div>
          {message && <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{message}</div>}
          {state === "loading" && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading profile...</CardContent></Card>}
          {state === "error" && <Card><CardContent className="p-6 text-sm text-muted-foreground">{message || "Could not load profile."}</CardContent></Card>}
          {state === "ready" && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Profile</CardTitle>
                <CardDescription>This profile feeds your customer dashboard and future product workflows.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="mb-2 text-sm font-medium text-muted-foreground">Profile photo</div>
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/35 p-3">
                    {form.profile_photo_url ? (
                      <img className="h-16 w-16 rounded-full object-cover" src={form.profile_photo_url} alt="" />
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{(form.full_name || form.email || "C").slice(0, 1).toUpperCase()}</div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" asChild disabled={uploading}>
                        <label className="cursor-pointer"><Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload"}<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} /></label>
                      </Button>
                      <Button variant="outline" asChild disabled={uploading}>
                        <label className="cursor-pointer"><Camera className="h-4 w-4" /> Camera<input type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} /></label>
                      </Button>
                    </div>
                  </div>
                </div>
                <Field label="Full name" value={form.full_name} onChange={(value) => setForm((current) => ({ ...current, full_name: value }))} />
                <Field label="Company" value={form.company} onChange={(value) => setForm((current) => ({ ...current, company: value }))} />
                <Field label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                <Field label="Email" value={form.email} disabled onChange={() => undefined} />
                <Button className="md:col-span-2 md:w-fit" onClick={save}><Save className="h-4 w-4" /> Save profile</Button>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}

function CustomerSidebar({ active, profile, onSignOut }: { active: string; profile: { full_name: string; company: string; email: string; profile_photo_url: string }; onSignOut: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
      <a className="mb-5 flex items-center gap-3 px-2" href="/dashboard/customer">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
        <div><div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div><div className="text-sm font-semibold">Customer</div></div>
      </a>
      <nav className="space-y-1">
        {navItems.map(({ label, icon: Icon, href }) => (
          <a key={label} href={href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground", active === label && "bg-primary/25 text-primary")}>
            <Icon className="h-4 w-4" /> {label}
          </a>
        ))}
      </nav>
      <div className="absolute bottom-16 left-3 right-3 rounded-xl border bg-background/55 p-2">
        <div className="flex items-center gap-2">
          {profile.profile_photo_url ? <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={profile.profile_photo_url} alt="" /> : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{(profile.full_name || profile.email || "C").slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{profile.full_name || "Customer"}</div>
            <div className="truncate text-xs text-muted-foreground">{profile.company || profile.email || "ControlP.io"}</div>
          </div>
        </div>
      </div>
      <Button className="absolute bottom-3 left-3 right-3 justify-start" variant="ghost" onClick={onSignOut}><LogOut className="h-4 w-4" /> Sign out</Button>
    </aside>
  );
}

function Field({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span className="text-muted-foreground">{label}</span>
      <Input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
