"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Box, CalendarClock, Camera, CreditCard, FileCheck2, Home, IdCard, LogOut, Mail, Menu, MessageSquare, Moon, Phone, Save, Settings, ShieldCheck, Sun, Truck, Upload, UserCircle, X, type LucideIcon } from "lucide-react";

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
  { label: "Bookings", icon: CalendarClock, href: "/dashboard/customer#bookings" },
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
  const [mobileOpen, setMobileOpen] = useState(false);

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

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-card transition-transform duration-200 ease-in-out lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-14 items-center justify-between border-b px-4">
          <a href="/dashboard/customer">
            <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[110px] dark:hidden" />
            <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[110px] dark:block" />
          </a>
          <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map(({ label, icon: Icon, href }) => (
            <a key={label} href={href} onClick={() => setMobileOpen(false)}
              className={cn("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", label === "Profile" && "bg-accent font-medium text-accent-foreground")}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </a>
          ))}
        </nav>
        <div className="border-t px-3 py-3">
          <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
            {form.profile_photo_url
              ? <img className="h-7 w-7 shrink-0 rounded-full object-cover" src={form.profile_photo_url} alt="" />
              : <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{(form.full_name || form.email || "C").slice(0, 1).toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{form.full_name || "Customer"}</div>
              <div className="truncate text-[10px] text-muted-foreground">Customer</div>
            </div>
            <button onClick={signOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>

      <main className="min-h-screen lg:pl-[238px]">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <button type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">Profile</span></div>
          <div className="ml-auto">
            <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
          </div>
        </header>
        <section className="space-y-5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight">Customer Profile</h1>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Keep your contact identity current for orders, invoices, proof approvals, shipping updates, and digital product workflows.</p>
            </div>
            {state === "ready" && <Button onClick={save}><Save className="h-4 w-4" /> Save profile</Button>}
          </div>
          {message && <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{message}</div>}
          {state === "loading" && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading profile...</CardContent></Card>}
          {state === "error" && <Card><CardContent className="p-6 text-sm text-muted-foreground">{message || "Could not load profile."}</CardContent></Card>}
          {state === "ready" && (
            <>
              <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
                <Card className="overflow-hidden">
                  <div className="h-24 bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
                  <CardContent className="-mt-10 space-y-4 p-5">
                    <div className="flex items-end justify-between gap-4">
                      {form.profile_photo_url ? (
                        <img className="h-24 w-24 rounded-2xl border-4 border-card object-cover shadow-xl" src={form.profile_photo_url} alt="" />
                      ) : (
                        <div className="grid h-24 w-24 place-items-center rounded-2xl border-4 border-card bg-primary text-2xl font-bold text-primary-foreground shadow-xl">{(form.full_name || form.email || "C").slice(0, 1).toUpperCase()}</div>
                      )}
                      <div className="flex flex-wrap gap-2 pb-1">
                        <Button variant="outline" asChild disabled={uploading}>
                          <label className="cursor-pointer"><Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload" }<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} /></label>
                        </Button>
                        <Button variant="outline" asChild disabled={uploading}>
                          <label className="cursor-pointer"><Camera className="h-4 w-4" /> Camera<input type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} /></label>
                        </Button>
                      </div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold">{form.full_name || "Customer"}</div>
                      <div className="text-sm text-muted-foreground">{form.company || "ControlP.io customer"}</div>
                    </div>
                    <div className="grid gap-2">
                      <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={form.email || "Missing"} />
                      <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={form.phone || "Missing"} />
                      <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="Account" value="Customer workspace" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Contact Information</CardTitle>
                    <CardDescription>This profile feeds invoices, proof updates, shipping notices, support messages, and managed digital products.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field label="Full name" value={form.full_name} onChange={(value) => setForm((current) => ({ ...current, full_name: value }))} />
                    <Field label="Company" value={form.company} onChange={(value) => setForm((current) => ({ ...current, company: value }))} />
                    <Field label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                    <Field label="Email" value={form.email} disabled onChange={() => undefined} />
                    <div className="rounded-xl border bg-background/35 p-4 md:col-span-2">
                      <div className="text-sm font-medium">Profile photo usage</div>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">Your photo appears in the customer dashboard sidebar and can be reused later for digital products, support conversations, and customer-facing workflows.</p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 md:grid-cols-3">
                <ProfileCard title="Orders and invoices" description="Used for order receipts, payment reminders, and invoice contact details." />
                <ProfileCard title="Artwork and proofs" description="Used when designs, revisions, and approvals need customer confirmation." />
                <ProfileCard title="Digital products" description="Used by business cards, QR pages, NFC products, forms, and future memberships." />
              </section>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function CustomerSidebar({ active, profile, onSignOut }: { active: string; profile: { full_name: string; company: string; email: string; profile_photo_url: string }; onSignOut: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
      <a className="mb-[45px] block px-2 pt-[5px]" href="/dashboard/customer">
        <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
        <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
      </a>
      <nav className="space-y-1">
        {navItems.map(({ label, icon: Icon, href }) => (
          <a key={label} href={href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground", active === label && "bg-primary/25 text-primary")}>
            <Icon className="h-4 w-4" /> {label}
          </a>
        ))}
      </nav>
      <div className="absolute bottom-3 left-3 right-3">
        <div className="mb-3 border-t border-border" />
        <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
          {profile.profile_photo_url ? <img className="h-7 w-7 shrink-0 rounded-full object-cover" src={profile.profile_photo_url} alt="" /> : <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{(profile.full_name || profile.email || "C").slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{profile.full_name || "Customer"}</div>
            <div className="truncate text-[10px] text-muted-foreground">Customer</div>
          </div>
          <button onClick={onSignOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
        </div>
      </div>
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/35 p-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="min-w-0 truncate font-medium">{value}</div>
    </div>
  );
}

function ProfileCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="font-semibold">{title}</div>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
