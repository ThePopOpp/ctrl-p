"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, Box, Copy, CreditCard, Download, Eye, FileCheck2, Home, IdCard, LogOut, MessageSquare, Monitor, Moon, Plus, QrCode, Save, Settings, Smartphone, Sun, Tablet, Trash2, Truck, UserCircle } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type DigitalCardLink = {
  id?: string;
  label: string;
  url: string;
  link_type: string;
  icon?: string | null;
  display_order: number;
  is_visible: boolean;
  open_in_new_tab: boolean;
};

type DigitalCard = {
  id?: string;
  card_name: string;
  slug: string;
  status: string;
  is_public: boolean;
  public_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  job_title?: string | null;
  company_name?: string | null;
  department?: string | null;
  bio?: string | null;
  profile_photo_url?: string | null;
  logo_url?: string | null;
  background_image_url?: string | null;
  background_color: string;
  accent_color: string;
  text_color: string;
  primary_phone?: string | null;
  sms_phone?: string | null;
  primary_email?: string | null;
  website_url?: string | null;
  maps_url?: string | null;
  intro_video_url?: string | null;
  qr_settings: { foreground?: string; background?: string; size?: number };
  nfc_status?: string | null;
  access_status?: string | null;
  access_plan?: string | null;
  assigned_order_id?: string | null;
  assigned_product_id?: string | null;
  view_count?: number;
  click_count?: number;
  updated_at?: string | null;
  digital_card_links?: DigitalCardLink[];
};

type Product = {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  tagline: string | null;
  sale_price: number | string | null;
  base_price: number | string | null;
};

type CardData = {
  cards: DigitalCard[];
  products: Product[];
  publicBase: string;
  profile: { email: string | null; full_name: string | null; phone: string | null; company: string | null; profile_photo_url?: string | null };
};

const linkTypes = ["website", "social", "phone", "email", "sms", "map", "booking", "payment", "download", "video", "review", "custom"];
const customerNavItems = [
  { label: "Overview", icon: Home, href: "/dashboard/customer" },
  { label: "Profile", icon: UserCircle, href: "/dashboard/customer/profile" },
  { label: "Orders", icon: Box, href: "/dashboard/customer#orders" },
  { label: "Invoices", icon: CreditCard, href: "/dashboard/customer#invoices" },
  { label: "Artwork", icon: FileCheck2, href: "/dashboard/customer#artwork" },
  { label: "My Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/customer/analytics" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/customer#messages" },
  { label: "Shipping", icon: Truck, href: "/dashboard/customer#shipping" },
  { label: "Settings", icon: Settings, href: "/dashboard/customer/settings" },
];
const previewModes = [
  { value: "mobile", label: "Mobile", width: 280, icon: Smartphone },
  { value: "tablet", label: "Tablet", width: 340, icon: Tablet },
  { value: "desktop", label: "Desktop", width: 440, icon: Monitor },
] as const;

type PreviewMode = typeof previewModes[number]["value"];

function human(value: string | null | undefined) {
  return String(value || "none").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function emptyCard(profile?: CardData["profile"]): DigitalCard {
  const display = profile?.full_name || "My Digital Card";
  return {
    card_name: display,
    slug: slugify(display) || "my-card",
    status: "draft",
    is_public: false,
    display_name: profile?.full_name || "",
    company_name: profile?.company || "",
    primary_phone: profile?.phone || "",
    sms_phone: profile?.phone || "",
    primary_email: profile?.email || "",
    background_color: "#07130b",
    accent_color: "#a3ff12",
    text_color: "#f7fff2",
    qr_settings: { foreground: "#07130b", background: "#ffffff", size: 512 },
    digital_card_links: [{ label: "Website", url: "https://www.controlp.io", link_type: "website", display_order: 1, is_visible: true, open_in_new_tab: true }],
  };
}

function qrUrl(cardUrl: string, card: DigitalCard) {
  const foreground = String(card.qr_settings?.foreground || "#07130b").replace("#", "");
  const background = String(card.qr_settings?.background || "#ffffff").replace("#", "");
  const size = Number(card.qr_settings?.size || 512);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=${foreground}&bgcolor=${background}&data=${encodeURIComponent(cardUrl)}`;
}

async function customerToken() {
  const db = getSupabaseBrowserClient();
  const session = db ? (await db.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Sign in again before managing digital cards.");
  return session.access_token;
}

export function CustomerDigitalCards() {
  const router = useRouter();
  const [data, setData] = useState<CardData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [message, setMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<DigitalCard>(() => emptyCard());
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("controlp_customer_theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  async function load() {
    try {
      const token = await customerToken();
      const response = await fetch("/api/dashboard/customer/digital-cards", { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load digital cards.");
      setData(payload as CardData);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load digital cards.");
      setState("denied");
    }
  }

  useEffect(() => {
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

  const cards = data?.cards ?? [];
  const products = data?.products ?? [];
  const publicUrl = useMemo(() => `${data?.publicBase || "https://my.controlp.io"}/c/${form.slug || "card"}`, [data?.publicBase, form.slug]);

  function openNew() {
    setMessage("");
    router.push("/dashboard/customer/manage-products/digital-cards/new");
  }

  function openEdit(card: DigitalCard) {
    setMessage("");
    if (card.id) router.push(`/dashboard/customer/manage-products/digital-cards/${card.id}`);
  }

  function update<K extends keyof DigitalCard>(key: K, value: DigitalCard[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateLink(index: number, patch: Partial<DigitalCardLink>) {
    setForm((current) => {
      const links = [...(current.digital_card_links || [])];
      links[index] = { ...links[index], ...patch };
      return { ...current, digital_card_links: links };
    });
  }

  function addLink() {
    setForm((current) => ({
      ...current,
      digital_card_links: [
        ...(current.digital_card_links || []),
        { label: "New link", url: "https://", link_type: "custom", display_order: (current.digital_card_links || []).length + 1, is_visible: true, open_in_new_tab: true },
      ],
    }));
  }

  function removeLink(index: number) {
    setForm((current) => ({ ...current, digital_card_links: (current.digital_card_links || []).filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const token = await customerToken();
      const response = await fetch("/api/dashboard/customer/digital-cards", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save digital card.");
      setMessage("Digital card saved.");
      setEditorOpen(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save digital card.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard(card: DigitalCard) {
    if (!card.id) return;
    setMessage("");
    try {
      const token = await customerToken();
      const response = await fetch(`/api/dashboard/customer/digital-cards?id=${card.id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not delete digital card.");
      setMessage("Digital card deleted.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete digital card.");
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard.");
  }

  async function copyPublicUrl(card: DigitalCard, url: string) {
    if (card.status !== "published" || !card.is_public) {
      setMessage("Publish and save this card before sharing the public URL.");
      return;
    }
    await copy(url);
  }

  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
        <a className="mb-[45px] block px-2 pt-[5px]" href="/dashboard/customer">
          <img src="/logos/logo-light-lime.svg" alt="ControlP.io" className="h-auto w-[125px] dark:hidden" />
          <img src="/logos/logo-darkgreen-lime.svg" alt="ControlP.io" className="hidden h-auto w-[125px] dark:block" />
        </a>
        <nav className="space-y-1">
          {customerNavItems.map(({ label, icon: Icon, href }) => (
            <Nav key={label} href={href} icon={<Icon className="h-4 w-4" />} label={label} active={label === "My Products"} />
          ))}
        </nav>
        {data?.profile && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="mb-3 border-t border-border" />
            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2">
              {data.profile.profile_photo_url ? <img className="h-7 w-7 shrink-0 rounded-full object-cover" src={data.profile.profile_photo_url} alt="" /> : <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{(data.profile.full_name || data.profile.email || "C").slice(0, 1).toUpperCase()}</div>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{data.profile.full_name || "Customer"}</div>
                <div className="truncate text-[10px] text-muted-foreground">Customer</div>
              </div>
              <button onClick={signOut} aria-label="Sign out" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
      </aside>

      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
        <div className="flex h-12 items-center gap-3 px-5">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span><span className="font-medium text-foreground">My Products</span></div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Notifications"><Bell className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Toggle theme" onClick={toggleTheme}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            <Button variant="outline" className="h-8 text-xs" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
        {state === "loading" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading digital cards...</CardContent></Card>}
        {state === "denied" && <Card className="border-red-500/30"><CardContent className="p-5"><div className="font-semibold text-red-300">Digital cards unavailable</div><p className="mt-2 text-sm text-muted-foreground">{message}</p></CardContent></Card>}
        {state === "ready" && data && (
          <>
            <section className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-[25px] font-semibold tracking-tight">My Products</h1>
                <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Manage customer-owned digital products, public profiles, QR/NFC landing pages, memberships, purchases, and future product subscriptions from one workspace.</p>
              </div>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> Create card</Button>
            </section>

            {message && <div className="mb-4 rounded-lg border bg-background/50 p-3 text-sm text-muted-foreground">{message}</div>}

            <section className="mb-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Products" value={String(cards.length)} hint="Digital products owned" />
              <Stat label="Published" value={String(cards.filter((card) => card.status === "published").length)} hint="Public URL active" />
              <Stat label="Views" value={String(cards.reduce((sum, card) => sum + Number(card.view_count || 0), 0))} hint="Public profile loads" />
              <Stat label="Clicks" value={String(cards.reduce((sum, card) => sum + Number(card.click_count || 0), 0))} hint="Link and button actions" />
              <Stat label="NFC ready" value={String(cards.filter((card) => card.nfc_status !== "not_ordered").length)} hint="Prepared for physical products" />
              <Stat label="Subscriptions" value={String(cards.filter((card) => card.access_status === "active").length)} hint="Monthly access active" />
            </section>

            {!cards.length ? (
              <Card className="border-dashed"><CardContent className="p-8 text-center"><QrCode className="mx-auto h-10 w-10 text-primary" /><div className="mt-3 text-lg font-semibold">Create your first digital business card</div><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Add your contact info, links, QR code, and a stable public URL for NFC cards, stickers, signs, badges, apparel, and printed business cards.</p><Button className="mt-5" onClick={openNew}><Plus className="h-4 w-4" /> Create card</Button></CardContent></Card>
            ) : (
              <section className="grid gap-4 xl:grid-cols-2">
                {cards.map((card) => {
                  const url = card.public_url || `${data.publicBase}/c/${card.slug}`;
                  const isPublished = card.status === "published" && card.is_public;
                  return (
                    <Card key={card.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div><CardTitle className="text-base">{card.card_name}</CardTitle><CardDescription>{url}</CardDescription></div>
                          <Badge className={cn("border", isPublished ? "border-primary/25 bg-primary/15 text-lime-800 dark:text-lime-200" : "border-border bg-secondary")}>{human(card.status)}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-[1fr_140px]">
                        <div className="space-y-3">
                          <PreviewMini card={card} />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => openEdit(card)}>Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => copyPublicUrl(card, url)}><Copy className="h-4 w-4" /> Copy public link</Button>
                            {isPublished ? (
                              <Button size="sm" variant="outline" asChild><a href={`/c/${card.slug}`} target="_blank"><Eye className="h-4 w-4" /> Public page</a></Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled><Eye className="h-4 w-4" /> Publish first</Button>
                            )}
                            <Button size="sm" variant="outline" asChild><a href={qrUrl(url, card)} download={`${card.slug}-qr.png`}><Download className="h-4 w-4" /> QR PNG</a></Button>
                            <Button size="sm" variant="outline" onClick={() => deleteCard(card)}><Trash2 className="h-4 w-4" /> Delete</Button>
                          </div>
                        </div>
                        <img className="h-[140px] w-[140px] rounded-lg border bg-white p-2" src={qrUrl(url, card)} alt={`${card.card_name} QR code`} />
                      </CardContent>
                    </Card>
                  );
                })}
              </section>
            )}

            <section className="mt-5">
              <Card><CardHeader className="pb-3"><CardTitle className="text-base">Digital product types</CardTitle><CardDescription>Business cards are live now. This hub is ready for QR pages, NFC products, lead forms, scratch/reveal coupons, loyalty cards, and future subscription products.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{["Digital Business Cards", "QR Code Landing Pages", "NFC Tap Products", "Lead Capture Forms", "Slideshow Cards", "Scratch / Reveal Coupons", "Loyalty / Punch Cards", "Product Bundles"].map((item, index) => <div key={item} className="rounded-lg border bg-background/35 p-3"><div className="flex items-center justify-between gap-2"><div className="font-medium">{item}</div><Badge variant={index === 0 ? "default" : "secondary"}>{index === 0 ? "Live" : "Next"}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{index === 0 ? `${cards.length} owned by your account` : "Prepared for future upsell workflows"}</div></div>)}</CardContent></Card>
              <Card className="mt-5"><CardHeader className="pb-3"><CardTitle className="text-base">Connected products and upsells</CardTitle><CardDescription>These physical and digital products can connect to a customer-owned card, QR URL, or NFC destination.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{products.map((product) => <div key={product.id} className="rounded-lg border bg-background/35 p-3"><div className="font-medium">{product.name}</div><div className="mt-1 text-xs text-muted-foreground">{product.tagline || product.category || "Ready for future card bundle links"}</div></div>)}{!products.length && ["NFC business cards", "QR stickers", "ID badges", "Dog tags"].map((item) => <div key={item} className="rounded-lg border bg-background/35 p-3"><div className="font-medium">{item}</div><div className="mt-1 text-xs text-muted-foreground">Future managed product connection</div></div>)}</CardContent></Card>
            </section>
          </>
        )}
      </main>

      <EditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        form={form}
        publicUrl={publicUrl}
        saving={saving}
        update={update}
        updateLink={updateLink}
        addLink={addLink}
        removeLink={removeLink}
        save={save}
        copy={copy}
      />
    </div>
  );
}

function EditorSheet({
  open,
  onOpenChange,
  form,
  publicUrl,
  saving,
  update,
  updateLink,
  addLink,
  removeLink,
  save,
  copy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: DigitalCard;
  publicUrl: string;
  saving: boolean;
  update: <K extends keyof DigitalCard>(key: K, value: DigitalCard[K]) => void;
  updateLink: (index: number, patch: Partial<DigitalCardLink>) => void;
  addLink: () => void;
  removeLink: (index: number) => void;
  save: () => void;
  copy: (value: string) => Promise<void>;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[60rem]">
        <SheetHeader><SheetTitle>{form.id ? "Edit digital card" : "Create digital card"}</SheetTitle><SheetDescription>Build a QR and NFC-ready public business card.</SheetDescription></SheetHeader>
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Card name" value={form.card_name} onChange={(value) => update("card_name", value)} />
              <Field label="Slug" value={form.slug} onChange={(value) => update("slug", slugify(value))} />
              <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div><Select value={form.status} onValueChange={(value) => { update("status", value); update("is_public", value === "published"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="unpublished">Unpublished</SelectItem></SelectContent></Select></div>
            </div>

            <div className="rounded-lg border bg-background/35 p-3">
              <div className="text-xs font-medium text-muted-foreground">Public URL</div>
              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                <code className="flex-1 rounded-md bg-secondary px-2 py-2 text-xs">{publicUrl}</code>
                <Button variant="outline" onClick={() => copy(publicUrl)}><Copy className="h-4 w-4" /> Copy</Button>
                <Button variant="outline" asChild><a href={`/c/${form.slug}`} target="_blank"><Eye className="h-4 w-4" /> Preview</a></Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Display name" value={form.display_name || ""} onChange={(value) => update("display_name", value)} />
              <Field label="Company" value={form.company_name || ""} onChange={(value) => update("company_name", value)} />
              <Field label="Job title" value={form.job_title || ""} onChange={(value) => update("job_title", value)} />
              <Field label="Department" value={form.department || ""} onChange={(value) => update("department", value)} />
            </div>
            <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Bio</div><Textarea value={form.bio || ""} onChange={(event) => update("bio", event.target.value)} placeholder="Short customer-facing intro" /></div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Primary phone" value={form.primary_phone || ""} onChange={(value) => update("primary_phone", value)} />
              <Field label="SMS phone" value={form.sms_phone || ""} onChange={(value) => update("sms_phone", value)} />
              <Field label="Primary email" value={form.primary_email || ""} onChange={(value) => update("primary_email", value)} />
              <Field label="Website" value={form.website_url || ""} onChange={(value) => update("website_url", value)} />
              <Field label="Maps URL" value={form.maps_url || ""} onChange={(value) => update("maps_url", value)} />
              <Field label="Intro video URL" value={form.intro_video_url || ""} onChange={(value) => update("intro_video_url", value)} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Profile photo URL" value={form.profile_photo_url || ""} onChange={(value) => update("profile_photo_url", value)} />
              <Field label="Logo URL" value={form.logo_url || ""} onChange={(value) => update("logo_url", value)} />
              <Field label="Background image URL" value={form.background_image_url || ""} onChange={(value) => update("background_image_url", value)} />
              <Field label="Background color" value={form.background_color} onChange={(value) => update("background_color", value)} />
              <Field label="Accent color" value={form.accent_color} onChange={(value) => update("accent_color", value)} />
              <Field label="Text color" value={form.text_color} onChange={(value) => update("text_color", value)} />
            </div>

            <Card><CardHeader className="pb-3"><CardTitle className="text-base">Custom links</CardTitle><CardDescription>Add unlimited buttons for social, booking, payments, files, maps, videos, reviews, and more.</CardDescription></CardHeader><CardContent className="space-y-3">{(form.digital_card_links || []).map((link, index) => <div key={index} className="grid gap-2 rounded-lg border bg-background/35 p-3 md:grid-cols-[1fr_1fr_160px_auto]"><Field label="Label" value={link.label} onChange={(value) => updateLink(index, { label: value })} /><Field label="URL" value={link.url} onChange={(value) => updateLink(index, { url: value })} /><div><div className="mb-1.5 text-xs font-medium text-muted-foreground">Type</div><Select value={link.link_type} onValueChange={(value) => updateLink(index, { link_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{linkTypes.map((type) => <SelectItem key={type} value={type}>{human(type)}</SelectItem>)}</SelectContent></Select></div><Button className="self-end" variant="outline" size="icon" onClick={() => removeLink(index)}><Trash2 className="h-4 w-4" /></Button></div>)}<Button variant="outline" onClick={addLink}><Plus className="h-4 w-4" /> Add link</Button></CardContent></Card>

            <Card><CardHeader className="pb-3"><CardTitle className="text-base">QR Code Designer</CardTitle><CardDescription>Simple Phase 1 QR options. Advanced designer controls come later.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-[180px_1fr]"><img className="h-[180px] w-[180px] rounded-lg border bg-white p-2" src={qrUrl(publicUrl, form)} alt="QR code preview" /><div className="grid gap-3 md:grid-cols-2"><Field label="QR foreground" value={String(form.qr_settings?.foreground || "#07130b")} onChange={(value) => update("qr_settings", { ...form.qr_settings, foreground: value })} /><Field label="QR background" value={String(form.qr_settings?.background || "#ffffff")} onChange={(value) => update("qr_settings", { ...form.qr_settings, background: value })} /><Button variant="outline" asChild><a href={qrUrl(publicUrl, form)} download={`${form.slug}-qr.png`}><Download className="h-4 w-4" /> Download PNG</a></Button></div></CardContent></Card>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save digital card"}</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>

          <LivePreview card={form} publicUrl={publicUrl} mode={previewMode} onModeChange={setPreviewMode} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreviewMini({ card }: { card: DigitalCard }) {
  return (
    <div className="rounded-lg border p-3" style={{ background: card.background_color, color: card.text_color }}>
      <div className="flex items-center gap-3">
        {card.profile_photo_url ? <img className="h-12 w-12 rounded-full object-cover" src={card.profile_photo_url} alt="" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-sm font-semibold">{(card.display_name || card.card_name).slice(0, 2).toUpperCase()}</div>}
        <div><div className="font-semibold">{card.display_name || card.card_name}</div><div className="text-xs opacity-75">{card.job_title || card.company_name || "Digital business card"}</div></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{(card.digital_card_links || []).slice(0, 3).map((link, index) => <span key={index} className="rounded-full bg-white/10 px-2 py-1 text-[11px]">{link.label}</span>)}</div>
    </div>
  );
}

function LivePreview({
  card,
  publicUrl,
  mode,
  onModeChange,
}: {
  card: DigitalCard;
  publicUrl: string;
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}) {
  const modeInfo = previewModes.find((item) => item.value === mode) || previewModes[0];
  const visibleLinks = (card.digital_card_links || []).filter((link) => link.is_visible !== false && link.label && link.url);
  const backgroundImage = card.background_image_url ? `linear-gradient(rgba(0,0,0,.42), rgba(0,0,0,.42)), url(${card.background_image_url})` : undefined;

  return (
    <aside className="xl:sticky xl:top-4 xl:self-start">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Live Preview</CardTitle>
              <CardDescription>Updates as customers type.</CardDescription>
            </div>
            <Badge variant="outline">{modeInfo.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
            {previewModes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={cn("flex h-9 items-center justify-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground", mode === value && "bg-background text-foreground shadow-sm")}
                onClick={() => onModeChange(value)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border bg-secondary/25 p-3">
            <div
              className="mx-auto min-h-[560px] overflow-hidden rounded-[1.75rem] border border-white/15 shadow-2xl transition-all"
              style={{
                width: modeInfo.width,
                background: card.background_color,
                color: card.text_color,
                backgroundImage,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="min-h-[560px] bg-black/20 p-4 backdrop-blur-[1px]">
                <div className="flex items-center justify-between gap-2">
                  {card.logo_url ? (
                    <img className="max-h-10 max-w-[120px] object-contain" src={card.logo_url} alt="" />
                  ) : (
                    <div className="text-xs font-semibold opacity-70">controlp.io card</div>
                  )}
                  <span className="rounded-full border border-white/15 px-2 py-1 text-[10px] opacity-70">{card.status === "published" ? "Public" : "Draft"}</span>
                </div>

                <div className="mt-8 text-center">
                  {card.profile_photo_url ? (
                    <img className="mx-auto h-24 w-24 rounded-full border-4 border-white/15 object-cover shadow-xl" src={card.profile_photo_url} alt="" />
                  ) : (
                    <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border-4 border-white/15 bg-white/10 text-2xl font-semibold shadow-xl">{(card.display_name || card.card_name || "CP").slice(0, 2).toUpperCase()}</div>
                  )}
                  <div className="mt-4 text-2xl font-semibold leading-tight">{card.display_name || card.card_name || "Your Name"}</div>
                  <div className="mt-1 text-xs opacity-75">{[card.job_title, card.company_name].filter(Boolean).join(" - ") || "Title - Company"}</div>
                  {card.bio ? <p className="mt-4 text-sm leading-5 opacity-85">{card.bio}</p> : <p className="mt-4 text-sm leading-5 opacity-50">Short bio and introduction will appear here.</p>}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px]">
                  {card.primary_phone && <PreviewPill label="Call" accent={card.accent_color} />}
                  {card.sms_phone && <PreviewPill label="SMS" accent={card.accent_color} />}
                  {card.primary_email && <PreviewPill label="Email" accent={card.accent_color} />}
                </div>

                <div className="mt-5 space-y-2">
                  {card.website_url && <PreviewButton label="Website" accent={card.accent_color} />}
                  {visibleLinks.map((link, index) => <PreviewButton key={`${link.label}-${index}`} label={link.label} accent={card.accent_color} />)}
                  {!card.website_url && !visibleLinks.length && <PreviewButton label="Add links to preview buttons" accent={card.accent_color} muted />}
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-white/10 p-2 text-[10px] opacity-70">
                  {publicUrl}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function PreviewPill({ label, accent }: { label: string; accent: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 px-2 py-2 font-medium" style={{ color: accent }}>{label}</div>;
}

function PreviewButton({ label, accent, muted }: { label: string; accent: string; muted?: boolean }) {
  return <div className={cn("flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold", muted && "opacity-60")}><span>{label}</span><span style={{ color: accent }}>↗</span></div>;
}

function Nav({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return <a href={href} className={cn("flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", active && "bg-accent font-medium text-accent-foreground")}>{icon}{label}</a>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <Card><CardContent className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-[22px] font-semibold leading-none">{value}</div><div className="mt-2 text-[11px] text-muted-foreground">{hint}</div></CardContent></Card>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Input value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}
