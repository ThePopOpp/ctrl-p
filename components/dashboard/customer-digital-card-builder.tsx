"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, Bell, Box, ChevronDown, ChevronRight, Copy, CreditCard, Download, Eye, EyeOff, FileCheck2, FormInput, GripVertical, Home, IdCard, Layers, Link as LinkIcon, LogOut, MessageSquare, Monitor, Moon, Palette, PlayCircle, Plus, QrCode, Save, Settings, Smartphone, Sun, Tablet, Trash2, Truck, Zap } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type DigitalCardSection = {
  id?: string;
  section_type: string;
  label: string;
  content?: Record<string, unknown>;
  display_order: number;
  is_visible: boolean;
  customer_editable?: boolean;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  padding_top: number;
  padding_right: number;
  padding_bottom: number;
  padding_left: number;
};

type DigitalCard = {
  id?: string;
  card_name: string;
  slug: string;
  status: string;
  is_public: boolean;
  public_url?: string | null;
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
  card_mode?: string | null;
  theme_mode?: string | null;
  layout_template?: string | null;
  qr_logo_url?: string | null;
  qr_corner_style?: string | null;
  qr_dot_style?: string | null;
  lead_form_settings?: LeadFormSettings | null;
  slider_pages?: SliderPage[];
  media_settings?: Record<string, unknown> | null;
  subscription_provider?: string | null;
  subscription_reference?: string | null;
  nfc_status?: string | null;
  access_status?: string | null;
  access_plan?: string | null;
  assigned_order_id?: string | null;
  assigned_product_id?: string | null;
  digital_card_links?: DigitalCardLink[];
  digital_card_sections?: DigitalCardSection[];
};

type CardData = {
  cards: DigitalCard[];
  products: { id: string; name: string; slug: string | null; category: string | null; tagline: string | null }[];
  publicBase: string;
  profile: { email: string | null; full_name: string | null; phone: string | null; company: string | null };
};

const linkTypes = ["website", "social", "phone", "email", "sms", "map", "booking", "payment", "download", "video", "review", "custom"];
const sectionTypes = ["profile_header", "quick_actions", "links", "lead_capture", "video", "qr_code", "nfc", "gallery", "scratch_card", "punch_card", "loyalty_card", "custom"];
const customerNavItems = [
  { label: "Overview", icon: Home, href: "/dashboard/customer" },
  { label: "Orders", icon: Box, href: "/dashboard/customer#orders" },
  { label: "Invoices", icon: CreditCard, href: "/dashboard/customer#invoices" },
  { label: "Artwork", icon: FileCheck2, href: "/dashboard/customer#artwork" },
  { label: "Manage Products", icon: IdCard, href: "/dashboard/customer/manage-products" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/customer/analytics" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/customer#messages" },
  { label: "Shipping", icon: Truck, href: "/dashboard/customer#shipping" },
];
const previewModes = [
  { value: "mobile", label: "Mobile", width: 340, icon: Smartphone },
  { value: "tablet", label: "Tablet", width: 620, icon: Tablet },
  { value: "desktop", label: "Desktop", width: 920, icon: Monitor },
] as const;
type PreviewMode = typeof previewModes[number]["value"];
type BuilderPanel = "card" | "sections" | "content" | "links" | "forms" | "visuals" | "opener" | "access" | "automations";
const builderPanels: { value: BuilderPanel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "card", label: "Product", icon: IdCard },
  { value: "sections", label: "Sections", icon: Layers },
  { value: "content", label: "Content", icon: FileCheck2 },
  { value: "links", label: "Links", icon: LinkIcon },
  { value: "forms", label: "Leads", icon: FormInput },
  { value: "visuals", label: "Visuals", icon: Palette },
  { value: "opener", label: "Opener", icon: PlayCircle },
  { value: "access", label: "Access", icon: Settings },
  { value: "automations", label: "Automations", icon: Zap },
];
const cardModes = ["standard", "opener_slider", "qr_only", "nfc_landing"];
const layoutTemplates = ["classic", "split_profile", "link_hub", "sales_intro", "portfolio", "appointment_first"];
const qrCornerStyles = ["square", "rounded", "extra_rounded", "dot"];
const qrDotStyles = ["square", "rounded", "dots", "classy"];
const digitalProductOptions = [
  { title: "Digital Business Card", subtitle: "Public profile, links, QR code, and NFC-ready URL", panel: "content" as BuilderPanel },
  { title: "Opener / Slider Card", subtitle: "Animated intro, video spot, buttons, then card reveal", panel: "opener" as BuilderPanel },
  { title: "NFC Tap Card", subtitle: "Tap-to-share destination and physical product prep", panel: "access" as BuilderPanel },
  { title: "QR Code Card", subtitle: "QR-first landing card with custom colors", panel: "visuals" as BuilderPanel },
  { title: "Loyalty / Punch Card", subtitle: "Future rewards and stamp card sections", panel: "sections" as BuilderPanel },
  { title: "Scratch Card", subtitle: "Future reveal interaction layer", panel: "sections" as BuilderPanel },
];
const colorPresets = [
  { label: "ControlP Dark", background: "#07130b", accent: "#a3ff12", text: "#f7fff2" },
  { label: "Clean Light", background: "#f7fff2", accent: "#4d7c0f", text: "#07130b" },
  { label: "Ink", background: "#111318", accent: "#f5f5f0", text: "#ffffff" },
  { label: "Ocean", background: "#082f49", accent: "#38bdf8", text: "#ecfeff" },
  { label: "Plum", background: "#2e1065", accent: "#c4b5fd", text: "#faf5ff" },
  { label: "Copper", background: "#3b1f12", accent: "#f59e0b", text: "#fff7ed" },
];

type OpenerButton = { label: string; action: "open_card" | "call" | "sms" | "email" | "url"; url?: string };
type OpenerContent = {
  digital_product?: string;
  title?: string;
  subtitle?: string;
  background_color?: string;
  accent_color?: string;
  text_color?: string;
  background_image_url?: string;
  background_video_url?: string;
  duration_seconds?: number;
  open_animation?: string;
  close_animation?: string;
  buttons?: OpenerButton[];
};
type LeadField = { key: string; label: string; enabled: boolean; required: boolean };
type LeadFormSettings = {
  enabled: boolean;
  title: string;
  description?: string;
  button_label?: string;
  button_background?: string;
  button_text_color?: string;
  field_background?: string;
  field_text_color?: string;
  submit_label?: string;
  fields: LeadField[];
};
type SliderPage = { title: string; subtitle?: string; media_url?: string; button_label?: string; button_url?: string };

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
    website_url: "",
    background_color: "#07130b",
    accent_color: "#a3ff12",
    text_color: "#f7fff2",
    card_mode: "standard",
    theme_mode: "dark",
    layout_template: "classic",
    qr_logo_url: "",
    qr_corner_style: "square",
    qr_dot_style: "square",
    lead_form_settings: defaultLeadFormSettings(),
    slider_pages: [],
    media_settings: {},
    qr_settings: { foreground: "#07130b", background: "#ffffff", size: 512 },
    digital_card_links: [],
    digital_card_sections: defaultSections(),
  };
}

function defaultLeadFormSettings(): LeadFormSettings {
  return {
    enabled: true,
    title: "Send me your info",
    description: "Share your contact details and I will follow up.",
    button_label: "Send me your info",
    button_background: "#a3ff12",
    button_text_color: "#07130b",
    field_background: "#07130b",
    field_text_color: "#f7fff2",
    submit_label: "Send info",
    fields: [
      { key: "name", label: "Name", enabled: true, required: false },
      { key: "email", label: "Email", enabled: true, required: false },
      { key: "phone", label: "Phone", enabled: true, required: false },
      { key: "company", label: "Company", enabled: false, required: false },
      { key: "message", label: "Message", enabled: true, required: false },
    ],
  };
}

function defaultSections(): DigitalCardSection[] {
  return [
    newSection("profile_header", "Profile header", 1, { margin_bottom: 24 }),
    newSection("quick_actions", "Quick actions", 2, { margin_bottom: 20 }),
    newSection("links", "Links and socials", 3, { margin_bottom: 20 }),
    newSection("lead_capture", "Lead capture button", 4, { is_visible: false, margin_bottom: 20 }),
    newSection("video", "Intro video", 5, { is_visible: false, margin_bottom: 20 }),
    newSection("qr_code", "QR code", 6, { margin_bottom: 0 }),
    newSection("nfc", "NFC tap to share", 7, { is_visible: false, margin_bottom: 0 }),
  ];
}

function newSection(sectionType = "custom", label?: string, order = 100, patch: Partial<DigitalCardSection> = {}): DigitalCardSection {
  return {
    section_type: sectionType,
    label: label || human(sectionType),
    content: {},
    display_order: order,
    is_visible: true,
    customer_editable: true,
    margin_top: 0,
    margin_right: 0,
    margin_bottom: 16,
    margin_left: 0,
    padding_top: 0,
    padding_right: 0,
    padding_bottom: 0,
    padding_left: 0,
    ...patch,
  };
}

function normalizeSections(sections: DigitalCardSection[] | undefined) {
  const list = sections?.length ? sections : defaultSections();
  return [...list]
    .map((section, index) => ({
      ...newSection(section.section_type, section.label, index + 1),
      ...section,
      display_order: Number(section.display_order || index + 1),
      margin_top: Number(section.margin_top || 0),
      margin_right: Number(section.margin_right || 0),
      margin_bottom: Number(section.margin_bottom ?? 16),
      margin_left: Number(section.margin_left || 0),
      padding_top: Number(section.padding_top || 0),
      padding_right: Number(section.padding_right || 0),
      padding_bottom: Number(section.padding_bottom || 0),
      padding_left: Number(section.padding_left || 0),
    }))
    .sort((a, b) => Number(a.display_order || 100) - Number(b.display_order || 100))
    .map((section, index) => ({ ...section, display_order: index + 1 }));
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

function newLink(type: string): DigitalCardLink {
  const presets: Record<string, { label: string; url: string }> = {
    phone: { label: "Phone", url: "tel:" },
    sms: { label: "Text me", url: "sms:" },
    email: { label: "Email", url: "mailto:" },
    website: { label: "Website", url: "https://" },
    social: { label: "Social profile", url: "https://" },
    booking: { label: "Book appointment", url: "https://" },
    payment: { label: "Pay online", url: "https://" },
  };
  const preset = presets[type] || { label: "New link", url: "https://" };
  return { ...preset, link_type: type, display_order: 100, is_visible: true, open_in_new_tab: true };
}

function defaultOpenerContent(): OpenerContent {
  return {
    digital_product: "opener",
    title: "Welcome",
    subtitle: "Tap to view my digital business card.",
    background_color: "#07130b",
    accent_color: "#a3ff12",
    text_color: "#f7fff2",
    background_image_url: "",
    background_video_url: "",
    duration_seconds: 7,
    open_animation: "fade_up",
    close_animation: "fade_out",
    buttons: [
      { label: "View card", action: "open_card" },
      { label: "Call me", action: "call" },
    ],
  };
}

export function CustomerDigitalCardBuilder({ cardId }: { cardId?: string }) {
  const router = useRouter();
  const [data, setData] = useState<CardData | null>(null);
  const [form, setForm] = useState<DigitalCard>(() => emptyCard());
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activePanel, setActivePanel] = useState<BuilderPanel>("card");
  const [previewZoom, setPreviewZoom] = useState(100);
  const [expandedSectionKeys, setExpandedSectionKeys] = useState<string[]>(["profile_header-0"]);
  const [expandedSpacingKeys, setExpandedSpacingKeys] = useState<string[]>([]);
  const [dragSectionIndex, setDragSectionIndex] = useState<number | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("controlp_customer_theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  async function load() {
    try {
      const token = await customerToken();
      const response = await fetch("/api/dashboard/customer/digital-cards", { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load digital card builder.");
      const nextData = payload as CardData;
      setData(nextData);
      if (cardId) {
        const card = nextData.cards.find((item) => item.id === cardId);
        if (!card) {
          setState("missing");
          return;
        }
        setForm({ ...emptyCard(nextData.profile), ...card, digital_card_links: card.digital_card_links || [], digital_card_sections: normalizeSections(card.digital_card_sections) });
      } else {
        setForm(emptyCard(nextData.profile));
      }
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load digital card builder.");
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, [cardId]);

  const publicUrl = useMemo(() => `${data?.publicBase || "https://my.controlp.io"}/c/${form.slug || "card"}`, [data?.publicBase, form.slug]);

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

  function addLink(type = "custom") {
    setForm((current) => ({
      ...current,
      digital_card_links: [...(current.digital_card_links || []), { ...newLink(type), display_order: (current.digital_card_links || []).length + 1 }],
    }));
  }

  function removeLink(index: number) {
    setForm((current) => ({ ...current, digital_card_links: (current.digital_card_links || []).filter((_, itemIndex) => itemIndex !== index) }));
  }

  function updateSection(index: number, patch: Partial<DigitalCardSection>) {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      sections[index] = { ...sections[index], ...patch };
      return { ...current, digital_card_sections: normalizeSections(sections) };
    });
  }

  function addSection(sectionType = "custom") {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      return { ...current, digital_card_sections: normalizeSections([...sections, newSection(sectionType, undefined, sections.length + 1)]) };
    });
  }

  function removeSection(index: number) {
    setForm((current) => ({ ...current, digital_card_sections: normalizeSections(current.digital_card_sections).filter((_, itemIndex) => itemIndex !== index) }));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      const target = index + direction;
      if (target < 0 || target >= sections.length) return current;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, digital_card_sections: sections.map((section, itemIndex) => ({ ...section, display_order: itemIndex + 1 })) };
    });
  }

  function reorderSection(sourceIndex: number, targetIndex: number) {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= sections.length || targetIndex >= sections.length) return current;
      const [moved] = sections.splice(sourceIndex, 1);
      sections.splice(targetIndex, 0, moved);
      return { ...current, digital_card_sections: sections.map((section, itemIndex) => ({ ...section, display_order: itemIndex + 1 })) };
    });
  }

  function sectionKey(section: DigitalCardSection, index: number) {
    return section.id || `${section.section_type}-${index}`;
  }

  function togglePanel(key: string, setter: (value: React.SetStateAction<string[]>) => void) {
    setter((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function findOpenerSection(sections = normalizeSections(form.digital_card_sections)) {
    return sections.findIndex((section) => section.section_type === "gallery" && (section.content?.digital_product === "opener" || section.label.toLowerCase().includes("opener")));
  }

  function ensureOpenerSection() {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      if (findOpenerSection(sections) >= 0) return current;
      return {
        ...current,
        digital_card_sections: normalizeSections([
          newSection("gallery", "Opener / slider", 1, {
            margin_bottom: 20,
            content: defaultOpenerContent(),
          }),
          ...sections.map((section, index) => ({ ...section, display_order: index + 2 })),
        ]),
      };
    });
  }

  function getOpenerContent(): OpenerContent {
    const sections = normalizeSections(form.digital_card_sections);
    const section = sections[findOpenerSection(sections)];
    return { ...defaultOpenerContent(), ...(section?.content || {}) } as OpenerContent;
  }

  function updateOpenerContent(patch: Partial<OpenerContent>) {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      let index = findOpenerSection(sections);
      if (index < 0) {
        sections.unshift(newSection("gallery", "Opener / slider", 1, { margin_bottom: 20, content: defaultOpenerContent() }));
        index = 0;
      }
      const content = { ...defaultOpenerContent(), ...(sections[index].content || {}), ...patch };
      sections[index] = { ...sections[index], content, is_visible: true, label: sections[index].label || "Opener / slider" };
      return { ...current, digital_card_sections: normalizeSections(sections) };
    });
  }

  function leadSettings() {
    return { ...defaultLeadFormSettings(), ...(form.lead_form_settings || {}), fields: (form.lead_form_settings?.fields?.length ? form.lead_form_settings.fields : defaultLeadFormSettings().fields) };
  }

  function updateLeadSettings(patch: Partial<LeadFormSettings>) {
    update("lead_form_settings", { ...leadSettings(), ...patch });
  }

  function findLeadCaptureSection(sections = normalizeSections(form.digital_card_sections)) {
    return sections.findIndex((section) => section.section_type === "lead_capture");
  }

  function ensureLeadCaptureSection(visible = leadSettings().enabled !== false) {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      const index = findLeadCaptureSection(sections);
      if (index >= 0) {
        sections[index] = {
          ...sections[index],
          label: sections[index].label || "Lead capture button",
          is_visible: visible,
        };
        return { ...current, digital_card_sections: normalizeSections(sections) };
      }
      return {
        ...current,
        digital_card_sections: normalizeSections([
          ...sections,
          newSection("lead_capture", "Lead capture button", sections.length + 1, { is_visible: visible, margin_bottom: 20 }),
        ]),
      };
    });
  }

  function updateLeadSettingsAndSection(patch: Partial<LeadFormSettings>) {
    updateLeadSettings(patch);
    if (typeof patch.enabled === "boolean") ensureLeadCaptureSection(patch.enabled);
  }

  function updateLeadField(index: number, patch: Partial<LeadField>) {
    const settings = leadSettings();
    const fields = [...settings.fields];
    fields[index] = { ...fields[index], ...patch };
    updateLeadSettings({ fields });
  }

  function addSliderPage() {
    update("slider_pages", [...(form.slider_pages || []), { title: "New slide", subtitle: "", media_url: "", button_label: "", button_url: "" }]);
    update("card_mode", "opener_slider");
  }

  function updateSliderPage(index: number, patch: Partial<SliderPage>) {
    const pages = [...(form.slider_pages || [])];
    pages[index] = { ...pages[index], ...patch };
    update("slider_pages", pages);
  }

  function removeSliderPage(index: number) {
    update("slider_pages", (form.slider_pages || []).filter((_, itemIndex) => itemIndex !== index));
  }

  async function save(nextForm = form) {
    setSaving(true);
    setMessage("");
    try {
      const token = await customerToken();
      const response = await fetch("/api/dashboard/customer/digital-cards", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...nextForm, links: nextForm.digital_card_links || [], sections: normalizeSections(nextForm.digital_card_sections) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save digital card.");
      setMessage("Digital card saved.");
      if (!cardId && payload.card?.id) router.replace(`/dashboard/customer/manage-products/digital-cards/${payload.card.id}`);
      setForm({ ...emptyCard(data?.profile), ...payload.card, digital_card_links: payload.card?.digital_card_links || [], digital_card_sections: normalizeSections(payload.card?.digital_card_sections) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save digital card.");
    } finally {
      setSaving(false);
    }
  }

  async function publishAndSave() {
    const nextForm = { ...form, status: "published", is_public: true };
    setForm(nextForm);
    await save(nextForm);
  }

  async function copy(value: string) {
    if (form.status !== "published" || !form.is_public) {
      setMessage("Publish and save this card before sharing the public URL.");
      return;
    }
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard.");
  }

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

  return (
    <div className={cn(theme === "dark" && "dark", "min-h-screen bg-background text-foreground")}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] border-r bg-card/95 px-3 py-3 lg:block">
        <a className="mb-5 flex items-center gap-3 px-2" href="/dashboard/customer">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[11px] font-black text-primary-foreground">cp</div>
          <div><div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">controlp.io</div><div className="text-sm font-semibold">Customer</div></div>
        </a>
        <nav className="space-y-1">
          {customerNavItems.map(({ label, icon: Icon, href }) => (
            <Nav key={label} href={href} icon={<Icon className="h-4 w-4" />} label={label} active={label === "Manage Products"} />
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur lg:pl-[238px]">
        <div className="flex h-12 items-center gap-3 px-5">
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span> Manage Products <span className="mx-2">/</span><span className="font-medium text-foreground">Digital Card Builder</span></div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Notifications"><Bell className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Toggle theme" onClick={toggleTheme}>{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button>
            <Button variant="outline" className="h-8 text-xs" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 lg:pl-[258px] lg:pr-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Button variant="ghost" className="mb-2 h-8 px-0 text-muted-foreground" onClick={() => router.push("/dashboard/customer/manage-products")}><ArrowLeft className="h-4 w-4" /> Back to products</Button>
            <h1 className="text-[25px] font-semibold tracking-tight">Digital Business Card Builder</h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">Build a QR and NFC-ready public profile with repeatable phones, emails, websites, social profiles, and action links.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => copy(publicUrl)}><Copy className="h-4 w-4" /> Copy URL</Button>
            {form.status === "published" && form.is_public ? (
              <Button variant="outline" asChild><a href={`/c/${form.slug}`} target="_blank"><Eye className="h-4 w-4" /> Public page</a></Button>
            ) : (
              <Button variant="outline" disabled><Eye className="h-4 w-4" /> Publish first</Button>
            )}
            <Button variant="outline" onClick={publishAndSave} disabled={saving || state !== "ready"}><QrCode className="h-4 w-4" /> Publish & save</Button>
            <Button onClick={() => save()} disabled={saving || state !== "ready"}><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save card"}</Button>
          </div>
        </div>

        {message && <div className="mb-4 rounded-lg border bg-background/50 p-3 text-sm text-muted-foreground">{message}</div>}
        {state === "loading" && <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading builder...</CardContent></Card>}
        {state === "error" && <Card className="border-red-500/30"><CardContent className="p-5 text-sm text-red-200">{message || "Could not load this builder."}</CardContent></Card>}
        {state === "missing" && <Card><CardContent className="p-5 text-sm text-muted-foreground">This digital card could not be found for your account.</CardContent></Card>}

        {state === "ready" && (
          <div className="grid overflow-hidden rounded-xl border bg-card/60 xl:grid-cols-[86px_minmax(360px,520px)_minmax(0,1fr)]">
            <BuilderToolRail
              active={activePanel}
              onChange={(panel) => {
                setActivePanel(panel);
                if (panel === "opener") ensureOpenerSection();
                if (panel === "forms") ensureLeadCaptureSection();
              }}
            />
            <section className="max-h-[calc(100vh-9rem)] overflow-y-auto border-r bg-background/45 p-4">
              {activePanel === "card" && (
                <div className="space-y-4">
                  <ProductChooser onSelect={(panel) => {
                    setActivePanel(panel);
                    if (panel === "opener") ensureOpenerSection();
                  }} />
                  <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Card details</CardTitle><CardDescription>Name, status, public URL, and publish controls.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Card name" value={form.card_name} onChange={(value) => update("card_name", value)} />
                    <Field label="Slug" value={form.slug} onChange={(value) => update("slug", slugify(value))} />
                    <SelectField label="Status" value={form.status} values={["draft", "published", "unpublished"]} onChange={(value) => { update("status", value); update("is_public", value === "published"); }} />
                    <SelectField label="Card page mode" value={form.card_mode || "standard"} values={cardModes} onChange={(value) => update("card_mode", value)} />
                    <SelectField label="Light / dark mode" value={form.theme_mode || "dark"} values={["light", "dark", "both"]} onChange={(value) => update("theme_mode", value)} />
                    <SelectField label="Layout template" value={form.layout_template || "classic"} values={layoutTemplates} onChange={(value) => update("layout_template", value)} />
                  </div>
                  <div className="rounded-lg border bg-background/35 p-3">
                    <div className="text-xs font-medium text-muted-foreground">Public URL</div>
                    <code className="mt-2 block rounded-md bg-secondary px-2 py-2 text-xs">{publicUrl}</code>
                    {form.status !== "published" || !form.is_public ? <div className="mt-2 text-xs text-muted-foreground">This URL goes live after you choose Published or click Publish & save.</div> : null}
                  </div>
                </CardContent>
                  </Card>
                </div>
              )}

              {activePanel === "sections" && <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Sections / layers</CardTitle>
                      <CardDescription>Control which sections are active, visible, and ordered on the public card.</CardDescription>
                    </div>
                    <Select value="custom" onValueChange={addSection}>
                      <SelectTrigger className="w-[190px]"><SelectValue placeholder="Add section" /></SelectTrigger>
                      <SelectContent>{sectionTypes.map((type) => <SelectItem key={type} value={type}>{human(type)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {normalizeSections(form.digital_card_sections).map((section, index) => {
                    const key = sectionKey(section, index);
                    const expanded = expandedSectionKeys.includes(key);
                    const spacingExpanded = expandedSpacingKeys.includes(key);
                    const sectionCount = normalizeSections(form.digital_card_sections).length;
                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={() => setDragSectionIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (dragSectionIndex !== null) reorderSection(dragSectionIndex, index);
                          setDragSectionIndex(null);
                        }}
                        onDragEnd={() => setDragSectionIndex(null)}
                        className={cn("overflow-hidden rounded-lg border bg-background/35 transition-colors", !section.is_visible && "opacity-60", dragSectionIndex === index && "border-primary/60 bg-primary/5")}
                      >
                        <div className="flex flex-wrap items-center gap-2 p-3">
                          <button type="button" className="flex h-9 items-center gap-2 text-left" onClick={() => togglePanel(key, setExpandedSectionKeys)}>
                            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                          </button>
                          <button type="button" className="min-w-[220px] flex-1 text-left" onClick={() => togglePanel(key, setExpandedSectionKeys)}>
                            <div className="font-medium">{section.label || human(section.section_type)}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{human(section.section_type)} / Layer {index + 1}{!section.is_visible ? " / Hidden" : ""}</div>
                          </button>
                          <Button variant="outline" size="icon" onClick={() => moveSection(index, -1)} disabled={index === 0} aria-label="Move section up"><ArrowUp className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => moveSection(index, 1)} disabled={index === sectionCount - 1} aria-label="Move section down"><ArrowDown className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => updateSection(index, { is_visible: !section.is_visible })} aria-label="Toggle section visibility">{section.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
                          <Button variant="outline" size="icon" onClick={() => removeSection(index)} aria-label="Remove section"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        {expanded && (
                          <div className="space-y-3 border-t p-3">
                            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                              <Field label="Layer name" value={section.label} onChange={(value) => updateSection(index, { label: value })} />
                              <SelectField label="Section type" value={section.section_type} values={sectionTypes} onChange={(value) => updateSection(index, { section_type: value })} />
                            </div>
                            <div className="rounded-lg border bg-background/30">
                              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium" onClick={() => togglePanel(key, setExpandedSpacingKeys)}>
                                <span>Spacing: margin and padding</span>
                                {spacingExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </button>
                              {spacingExpanded && (
                                <div className="grid gap-3 border-t p-3 xl:grid-cols-2">
                                  <SpacingGroup title="Margin" section={section} prefix="margin" onChange={(patch) => updateSection(index, patch)} />
                                  <SpacingGroup title="Padding" section={section} prefix="padding" onChange={(patch) => updateSection(index, patch)} />
                                </div>
                              )}
                            </div>
                            {["gallery", "scratch_card", "punch_card", "loyalty_card", "nfc"].includes(section.section_type) && (
                              <div className="rounded-md border border-dashed bg-background/30 p-3 text-xs text-muted-foreground">
                                {human(section.section_type)} is staged as a flexible layer now. Its advanced editor will plug into this section record next.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>}

              {activePanel === "content" && <div className="space-y-4"><Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Identity</CardTitle><CardDescription>The primary profile content shown at the top of the card.</CardDescription></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <Field label="Display name" value={form.display_name || ""} onChange={(value) => update("display_name", value)} />
                  <Field label="Company" value={form.company_name || ""} onChange={(value) => update("company_name", value)} />
                  <Field label="Job title" value={form.job_title || ""} onChange={(value) => update("job_title", value)} />
                  <Field label="Department" value={form.department || ""} onChange={(value) => update("department", value)} />
                  <div className="md:col-span-2"><div className="mb-1.5 text-xs font-medium text-muted-foreground">Bio</div><Textarea value={form.bio || ""} onChange={(event) => update("bio", event.target.value)} placeholder="Short customer-facing intro" /></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Primary contact fields</CardTitle><CardDescription>These are pinned quick actions. Add more numbers, emails, websites, and socials below.</CardDescription></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <Field label="Primary phone" value={form.primary_phone || ""} onChange={(value) => update("primary_phone", value)} />
                  <Field label="SMS phone" value={form.sms_phone || ""} onChange={(value) => update("sms_phone", value)} />
                  <Field label="Primary email" value={form.primary_email || ""} onChange={(value) => update("primary_email", value)} />
                  <Field label="Website" value={form.website_url || ""} onChange={(value) => update("website_url", value)} />
                  <Field label="Maps URL" value={form.maps_url || ""} onChange={(value) => update("maps_url", value)} />
                  <Field label="Intro video URL" value={form.intro_video_url || ""} onChange={(value) => update("intro_video_url", value)} />
                </CardContent>
              </Card></div>}

              {activePanel === "links" && <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Repeatable links and contact methods</CardTitle>
                  <CardDescription>Add unlimited phone numbers, emails, websites, social media profiles, payment links, files, bookings, and custom buttons.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {["phone", "sms", "email", "website", "social", "booking", "payment", "custom"].map((type) => (
                      <Button key={type} variant="outline" size="sm" onClick={() => addLink(type)}><Plus className="h-4 w-4" /> {human(type)}</Button>
                    ))}
                  </div>
                  {(form.digital_card_links || []).map((link, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border bg-background/35 p-3 lg:grid-cols-[1fr_1.5fr_170px_auto]">
                      <Field label="Label" value={link.label} onChange={(value) => updateLink(index, { label: value })} />
                      <Field label="URL / phone / email" value={link.url} onChange={(value) => updateLink(index, { url: value })} />
                      <SelectField label="Type" value={link.link_type} values={linkTypes} onChange={(value) => updateLink(index, { link_type: value })} />
                      <Button className="self-end" variant="outline" size="icon" onClick={() => removeLink(index)} aria-label="Remove link"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {!form.digital_card_links?.length && <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No repeatable links yet. Add a phone, email, website, social profile, or custom action.</div>}
                </CardContent>
              </Card>}

              {activePanel === "forms" && <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><FormInput className="h-4 w-4" /> Lead Generation Form Builder</CardTitle>
                  <CardDescription>Customize the button shown on the digital card and the dedicated lead form visitors open from it.</CardDescription>
                </CardHeader>
                <CardContent>
                  <LeadCaptureSectionEditor
                    settings={leadSettings()}
                    onChange={updateLeadSettingsAndSection}
                    onFieldChange={updateLeadField}
                  />
                </CardContent>
              </Card>}

              {activePanel === "visuals" && <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Visuals and QR</CardTitle><CardDescription>Pick brand colors, add media URLs, and style the QR code.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="flex items-center gap-3 rounded-lg border bg-background/35 p-2 text-left text-xs transition-colors hover:border-primary/60"
                        onClick={() => {
                          update("background_color", preset.background);
                          update("accent_color", preset.accent);
                          update("text_color", preset.text);
                        }}
                      >
                        <span className="flex -space-x-1">
                          {[preset.background, preset.accent, preset.text].map((color) => <span key={color} className="h-5 w-5 rounded-full border" style={{ backgroundColor: color }} />)}
                        </span>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Profile photo URL" value={form.profile_photo_url || ""} onChange={(value) => update("profile_photo_url", value)} />
                    <Field label="Logo URL" value={form.logo_url || ""} onChange={(value) => update("logo_url", value)} />
                    <Field label="Background image URL" value={form.background_image_url || ""} onChange={(value) => update("background_image_url", value)} />
                    <Field label="Background video URL" value={String((form.media_settings?.background_video_url as string) || "")} onChange={(value) => update("media_settings", { ...(form.media_settings || {}), background_video_url: value })} />
                    <Field label="QR logo center URL" value={form.qr_logo_url || ""} onChange={(value) => update("qr_logo_url", value)} />
                    <ColorField label="Background color" value={form.background_color} onChange={(value) => update("background_color", value)} />
                    <ColorField label="Accent color" value={form.accent_color} onChange={(value) => update("accent_color", value)} />
                    <ColorField label="Text color" value={form.text_color} onChange={(value) => update("text_color", value)} />
                    <ColorField label="QR foreground" value={String(form.qr_settings?.foreground || "#07130b")} onChange={(value) => update("qr_settings", { ...form.qr_settings, foreground: value })} />
                    <ColorField label="QR background" value={String(form.qr_settings?.background || "#ffffff")} onChange={(value) => update("qr_settings", { ...form.qr_settings, background: value })} />
                    <SelectField label="QR corner style" value={form.qr_corner_style || "square"} values={qrCornerStyles} onChange={(value) => update("qr_corner_style", value)} />
                    <SelectField label="QR dot style" value={form.qr_dot_style || "square"} values={qrDotStyles} onChange={(value) => update("qr_dot_style", value)} />
                    <Button className="self-end" variant="outline" asChild><a href={qrUrl(publicUrl, form)} download={`${form.slug}-qr.png`}><Download className="h-4 w-4" /> Download QR PNG</a></Button>
                    <Button className="self-end" variant="outline" asChild><a href={`${qrUrl(publicUrl, form)}&format=svg`} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /> Open QR SVG</a></Button>
                  </div>
                  <div className="rounded-lg border border-dashed bg-background/30 p-3 text-xs text-muted-foreground">
                    Background gradients, video backgrounds, and full QR designer controls are queued for the next data-model slice. Image URLs and color presets work now.
                  </div>
                </CardContent>
              </Card>}

              {activePanel === "opener" && <OpenerPanel content={getOpenerContent()} primaryPhone={form.primary_phone || ""} onChange={updateOpenerContent} />}

              {activePanel === "opener" && <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Multi-page slider cards</CardTitle><CardDescription>Add intro, services, gallery, testimonials, and contact slides for opener/slider card mode.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {(form.slider_pages || []).map((page, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border bg-background/35 p-3 md:grid-cols-2">
                      <Field label="Slide title" value={page.title} onChange={(value) => updateSliderPage(index, { title: value })} />
                      <Field label="Media URL" value={page.media_url || ""} onChange={(value) => updateSliderPage(index, { media_url: value })} />
                      <Field label="Subtitle" value={page.subtitle || ""} onChange={(value) => updateSliderPage(index, { subtitle: value })} />
                      <Field label="Button label" value={page.button_label || ""} onChange={(value) => updateSliderPage(index, { button_label: value })} />
                      <Field label="Button URL" value={page.button_url || ""} onChange={(value) => updateSliderPage(index, { button_url: value })} />
                      <Button className="self-end" variant="outline" onClick={() => removeSliderPage(index)}><Trash2 className="h-4 w-4" /> Remove slide</Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addSliderPage}><Plus className="h-4 w-4" /> Add slide</Button>
                </CardContent>
              </Card>}

              {activePanel === "access" && <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Product and access prep</CardTitle><CardDescription>Future-ready hooks for monthly access, NFC products, bundles, and linked customer orders.</CardDescription></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <SelectField label="Access status" value={form.access_status || "trial"} values={["trial", "active", "past_due", "paused", "expired", "none"]} onChange={(value) => update("access_status", value)} />
                  <Field label="Access plan" value={form.access_plan || ""} onChange={(value) => update("access_plan", value)} />
                  <SelectField label="Subscription provider" value={form.subscription_provider || "none"} values={["none", "square", "stripe", "manual"]} onChange={(value) => update("subscription_provider", value === "none" ? "" : value)} />
                  <Field label="Subscription reference" value={form.subscription_reference || ""} onChange={(value) => update("subscription_reference", value)} />
                  <SelectField label="NFC status" value={form.nfc_status || "not_ordered"} values={["not_ordered", "ordered", "assigned", "programmed", "shipped"]} onChange={(value) => update("nfc_status", value)} />
                  <div className="md:col-span-3 rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">
                    Products ready for future bundles: {(data?.products || []).map((product) => product.name).join(", ") || "NFC cards, QR stickers, ID badges, and other managed products."}
                  </div>
                </CardContent>
              </Card>}

              {activePanel === "automations" && <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4" /> Automations</CardTitle>
                  <CardDescription>Coming soon: notifications, lead routing, Square subscription triggers, follow-up messages, and product upsell automations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {["Lead notification emails and SMS alerts", "Square payment or subscription status triggers", "NFC activation and QR product fulfillment handoffs", "Follow-up reminders for new leads", "Customer tags, source tracking, and CRM-style workflows"].map((item) => (
                    <div key={item} className="rounded-lg border bg-background/35 p-3 text-sm text-muted-foreground">{item}</div>
                  ))}
                </CardContent>
              </Card>}
            </section>

            <LivePreview card={form} publicUrl={publicUrl} mode={previewMode} onModeChange={setPreviewMode} zoom={previewZoom} onZoomChange={setPreviewZoom} />
          </div>
        )}
      </main>
    </div>
  );
}

function BuilderToolRail({ active, onChange }: { active: BuilderPanel; onChange: (panel: BuilderPanel) => void }) {
  return (
    <nav className="flex flex-row gap-1 overflow-x-auto border-b bg-card p-2 xl:flex-col xl:overflow-visible xl:border-b-0 xl:border-r">
      {builderPanels.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className={cn("flex min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground", active === value && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
          onClick={() => onChange(value)}
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function ProductChooser({ onSelect }: { onSelect: (panel: BuilderPanel) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Choose a Digital Product</CardTitle>
        <CardDescription>Select what you would like to customize.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {digitalProductOptions.map((product) => (
          <button
            key={product.title}
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background/35 p-3 text-left transition-colors hover:border-primary/70 hover:bg-primary/5"
            onClick={() => onSelect(product.panel)}
          >
            <span>
              <span className="block font-semibold">{product.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{product.subtitle}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function LeadCaptureSectionEditor({ settings, onChange, onFieldChange }: { settings: LeadFormSettings; onChange: (patch: Partial<LeadFormSettings>) => void; onFieldChange: (index: number, patch: Partial<LeadField>) => void }) {
  return (
    <div className="space-y-3 rounded-lg border bg-background/30 p-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold"><FormInput className="h-4 w-4" /> Lead capture button and form</div>
        <div className="mt-1 text-xs text-muted-foreground">This section shows a button on the card. The button opens a dedicated lead form page.</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="Lead form" value={settings.enabled ? "enabled" : "disabled"} values={["enabled", "disabled"]} onChange={(value) => onChange({ enabled: value === "enabled" })} />
        <Field label="Card button title" value={settings.button_label || "Send me your info"} onChange={(value) => onChange({ button_label: value })} />
        <Field label="Form title" value={settings.title} onChange={(value) => onChange({ title: value })} />
        <Field label="Submit button" value={settings.submit_label || "Send info"} onChange={(value) => onChange({ submit_label: value })} />
        <div className="md:col-span-2"><Field label="Form description" value={settings.description || ""} onChange={(value) => onChange({ description: value })} /></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ColorField label="Button background" value={settings.button_background || "#a3ff12"} onChange={(value) => onChange({ button_background: value })} />
        <ColorField label="Button text" value={settings.button_text_color || "#07130b"} onChange={(value) => onChange({ button_text_color: value })} />
        <ColorField label="Form field background" value={settings.field_background || "#07130b"} onChange={(value) => onChange({ field_background: value })} />
        <ColorField label="Form field text" value={settings.field_text_color || "#f7fff2"} onChange={(value) => onChange({ field_text_color: value })} />
      </div>
      <div className="space-y-2">
        {settings.fields.map((field, index) => (
          <div key={field.key} className="grid gap-2 rounded-lg border bg-background/35 p-3 md:grid-cols-[1fr_120px_120px]">
            <Field label="Field label" value={field.label} onChange={(value) => onFieldChange(index, { label: value })} />
            <SelectField label="Shown" value={field.enabled ? "yes" : "no"} values={["yes", "no"]} onChange={(value) => onFieldChange(index, { enabled: value === "yes" })} />
            <SelectField label="Required" value={field.required ? "yes" : "no"} values={["no", "yes"]} onChange={(value) => onFieldChange(index, { required: value === "yes" })} />
          </div>
        ))}
      </div>
      <div className="rounded-md border border-dashed bg-background/30 p-3 text-xs text-muted-foreground">
        Automations for notifications, lead routing, and follow-up messages are staged under the new Automations tab.
      </div>
    </div>
  );
}

function OpenerPanel({ content, primaryPhone, onChange }: { content: OpenerContent; primaryPhone: string; onChange: (patch: Partial<OpenerContent>) => void }) {
  const buttons = (content.buttons || []).slice(0, 2);

  function updateButton(index: number, patch: Partial<OpenerButton>) {
    const next = [...buttons];
    next[index] = { ...(next[index] || { label: "Button", action: "open_card" as const }), ...patch };
    onChange({ buttons: next.slice(0, 2) });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><PlayCircle className="h-4 w-4" /> Opener customizer</CardTitle>
        <CardDescription>Create a short intro slide before the visitor opens the business card.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <Field label="Opener title" value={content.title || ""} onChange={(value) => onChange({ title: value })} />
          <Field label="Subtitle" value={content.subtitle || ""} onChange={(value) => onChange({ subtitle: value })} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ColorField label="Background" value={content.background_color || "#07130b"} onChange={(value) => onChange({ background_color: value })} />
          <ColorField label="Accent" value={content.accent_color || "#a3ff12"} onChange={(value) => onChange({ accent_color: value })} />
          <ColorField label="Text" value={content.text_color || "#f7fff2"} onChange={(value) => onChange({ text_color: value })} />
        </div>
        <div className="grid gap-3">
          <Field label="Background image URL" value={content.background_image_url || ""} onChange={(value) => onChange({ background_image_url: value })} />
          <Field label="Background video URL" value={content.background_video_url || ""} onChange={(value) => onChange({ background_video_url: value })} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <NumberField label="Duration seconds" value={Number(content.duration_seconds || 7)} onChange={(value) => onChange({ duration_seconds: Math.max(1, Math.min(30, value)) })} />
          <SelectField label="Open animation" value={content.open_animation || "fade_up"} values={["fade_up", "fade_in", "zoom_in", "slide_left", "flip_in"]} onChange={(value) => onChange({ open_animation: value })} />
          <SelectField label="Close animation" value={content.close_animation || "fade_out"} values={["fade_out", "zoom_out", "slide_up", "slide_left", "flip_out"]} onChange={(value) => onChange({ close_animation: value })} />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Opener buttons, max 2</div>
          {[0, 1].map((index) => {
            const button = buttons[index] || { label: index === 0 ? "View card" : "Call me", action: index === 0 ? "open_card" : "call" };
            return (
              <div key={index} className="grid gap-2 rounded-lg border bg-background/35 p-3 md:grid-cols-[1fr_160px_1fr]">
                <Field label={`Button ${index + 1}`} value={button.label || ""} onChange={(value) => updateButton(index, { label: value })} />
                <SelectField label="Action" value={button.action || "open_card"} values={["open_card", "call", "sms", "email", "url"]} onChange={(value) => updateButton(index, { action: value as OpenerButton["action"] })} />
                <Field label="URL override" value={button.url || (button.action === "call" ? primaryPhone : "")} onChange={(value) => updateButton(index, { url: value })} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function LivePreview({ card, publicUrl, mode, onModeChange, zoom, onZoomChange }: { card: DigitalCard; publicUrl: string; mode: PreviewMode; onModeChange: (mode: PreviewMode) => void; zoom: number; onZoomChange: (zoom: number) => void }) {
  const modeInfo = previewModes.find((item) => item.value === mode) || previewModes[0];
  const backgroundImage = card.background_image_url ? `linear-gradient(rgba(0,0,0,.42), rgba(0,0,0,.42)), url(${card.background_image_url})` : undefined;

  return (
    <aside className="min-w-0 bg-background/30 p-4 2xl:sticky 2xl:top-16 2xl:self-start">
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div><CardTitle className="text-base">Live responsive preview</CardTitle><CardDescription>Switch between mobile, tablet, and desktop while editing.</CardDescription></div>
            <Badge variant="outline">{modeInfo.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
            {previewModes.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" className={cn("flex h-9 items-center justify-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground", mode === value && "bg-background text-foreground shadow-sm")} onClick={() => onModeChange(value)}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <div className="relative overflow-auto rounded-xl border bg-secondary/25 p-4">
            <div className="mx-auto origin-top overflow-hidden rounded-[1.75rem] border border-white/15 shadow-2xl transition-all" style={{ width: modeInfo.width, maxWidth: "100%", minHeight: mode === "mobile" ? 640 : 720, background: card.background_color, color: card.text_color, backgroundImage, backgroundSize: "cover", backgroundPosition: "center", transform: `scale(${zoom / 100})` }}>
              <div className="min-h-[640px] bg-black/20 p-5 backdrop-blur-[1px] md:p-8">
                <CardSections card={card} publicUrl={publicUrl} mode={mode} />
              </div>
            </div>
            <div className="absolute right-5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-2xl">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-lg font-semibold hover:bg-accent"
                aria-label="Zoom in"
                onClick={() => onZoomChange(Math.min(130, zoom + 5))}
              >
                +
              </button>
              <input
                aria-label="Preview zoom"
                type="range"
                min={55}
                max={130}
                value={zoom}
                onChange={(event) => onZoomChange(Number(event.target.value))}
                className="h-32 w-4 accent-foreground"
                style={{ writingMode: "vertical-lr", direction: "rtl" }}
              />
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-lg font-semibold hover:bg-accent"
                aria-label="Zoom out"
                onClick={() => onZoomChange(Math.max(55, zoom - 5))}
              >
                -
              </button>
              <div className="text-xs font-semibold">{zoom}%</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function CardSections({ card, publicUrl, mode }: { card: DigitalCard; publicUrl: string; mode: PreviewMode }) {
  const sections = normalizeSections(card.digital_card_sections).filter((section) => {
    const isOpenerLayer = section.section_type === "gallery" && (section.content?.digital_product === "opener" || section.label.toLowerCase().includes("opener"));
    return section.is_visible && !isOpenerLayer;
  });
  const visibleLinks = (card.digital_card_links || []).filter((link) => link.is_visible !== false && link.label && link.url);
  return (
    <div className={cn(mode !== "mobile" && "grid gap-x-8 md:grid-cols-[1fr_1.1fr]")}>
      {sections.map((section) => (
        <div key={`${section.section_type}-${section.display_order}`} style={sectionStyle(section)}>
          <PreviewSection section={section} card={card} publicUrl={publicUrl} visibleLinks={visibleLinks} />
        </div>
      ))}
    </div>
  );
}

function sectionStyle(section: DigitalCardSection): React.CSSProperties {
  return {
    marginTop: section.margin_top,
    marginRight: section.margin_right,
    marginBottom: section.margin_bottom,
    marginLeft: section.margin_left,
    paddingTop: section.padding_top,
    paddingRight: section.padding_right,
    paddingBottom: section.padding_bottom,
    paddingLeft: section.padding_left,
  };
}

function PreviewSection({ section, card, publicUrl, visibleLinks }: { section: DigitalCardSection; card: DigitalCard; publicUrl: string; visibleLinks: DigitalCardLink[] }) {
  if (section.section_type === "profile_header") {
    return (
      <div>
        <div className="flex items-center justify-between gap-2">
          {card.logo_url ? <img className="max-h-10 max-w-[140px] object-contain" src={card.logo_url} alt="" /> : <div className="text-xs font-semibold opacity-70">controlp.io card</div>}
          <span className="rounded-full border border-white/15 px-2 py-1 text-[10px] opacity-70">{card.status === "published" ? "Public" : "Draft"}</span>
        </div>
        <div className="mt-8 text-center">
          {card.profile_photo_url ? <img className="mx-auto h-24 w-24 rounded-full border-4 border-white/15 object-cover shadow-xl" src={card.profile_photo_url} alt="" /> : <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border-4 border-white/15 bg-white/10 text-2xl font-semibold shadow-xl">{(card.display_name || card.card_name || "CP").slice(0, 2).toUpperCase()}</div>}
          <div className="mt-4 text-2xl font-semibold leading-tight">{card.display_name || card.card_name || "Your Name"}</div>
          <div className="mt-1 text-xs opacity-75">{[card.job_title, card.company_name].filter(Boolean).join(" - ") || "Title - Company"}</div>
          {card.bio ? <p className="mt-4 text-sm leading-5 opacity-85">{card.bio}</p> : <p className="mt-4 text-sm leading-5 opacity-50">Short bio and introduction will appear here.</p>}
        </div>
      </div>
    );
  }

  if (section.section_type === "quick_actions") {
    return (
      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        {card.primary_phone && <PreviewPill label="Call" accent={card.accent_color} />}
        {card.sms_phone && <PreviewPill label="SMS" accent={card.accent_color} />}
        {card.primary_email && <PreviewPill label="Email" accent={card.accent_color} />}
        {card.maps_url && <PreviewPill label="Map" accent={card.accent_color} />}
      </div>
    );
  }

  if (section.section_type === "links") {
    return (
      <div className="space-y-2">
        {card.website_url && <PreviewButton label="Website" accent={card.accent_color} />}
        {visibleLinks.map((link, index) => <PreviewButton key={`${link.label}-${index}`} label={link.label} accent={card.accent_color} icon={link.link_type} />)}
        {!card.website_url && !visibleLinks.length && <PreviewButton label="Add links to preview buttons" accent={card.accent_color} muted />}
      </div>
    );
  }

  if (section.section_type === "lead_capture") {
    const settings = { ...defaultLeadFormSettings(), ...(card.lead_form_settings || {}) };
    if (!settings.enabled) return <PlaceholderSection label={section.label} text="Lead capture is disabled." />;
    return (
      <div
        className="rounded-2xl px-4 py-3 text-center text-sm font-semibold"
        style={{ background: settings.button_background || card.accent_color, color: settings.button_text_color || card.background_color }}
      >
        {settings.button_label || "Send me your info"}
      </div>
    );
  }

  if (section.section_type === "video") {
    if (!card.intro_video_url) return <PlaceholderSection label={section.label} text="Add an intro video URL to show this section." />;
    return <PreviewButton label="Watch intro video" accent={card.accent_color} icon="video" />;
  }

  if (section.section_type === "qr_code") {
    return (
      <div className="grid gap-3 md:grid-cols-[120px_1fr] md:items-center">
        <img className="h-[120px] w-[120px] rounded-lg border bg-white p-2" src={qrUrl(publicUrl, card)} alt="QR code preview" />
        <div className="rounded-xl border border-white/10 bg-white/10 p-3 text-[10px] opacity-70">{publicUrl}</div>
      </div>
    );
  }

  if (section.section_type === "nfc") return <PlaceholderSection label={section.label} text="NFC tap-to-share destination will use this public URL once access is active." />;
  if (section.section_type === "gallery" && (section.content?.digital_product === "opener" || section.label.toLowerCase().includes("opener"))) {
    return null;
  }
  if (section.section_type === "gallery") return <PlaceholderSection label={section.label} text="Slider/gallery cards will live in this layer." />;
  if (section.section_type === "scratch_card") return <PlaceholderSection label={section.label} text="Scratch-to-reveal interactions will live in this layer." />;
  if (section.section_type === "punch_card") return <PlaceholderSection label={section.label} text="Digital stamp card progress will live in this layer." />;
  if (section.section_type === "loyalty_card") return <PlaceholderSection label={section.label} text="Rewards and loyalty actions will live in this layer." />;
  return <PlaceholderSection label={section.label} text="Custom content section." />;
}

function PlaceholderSection({ label, text }: { label: string; text: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm"><div className="font-semibold">{label}</div><div className="mt-1 text-xs opacity-70">{text}</div></div>;
}

function PreviewPill({ label, accent }: { label: string; accent: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 px-2 py-2 font-medium" style={{ color: accent }}>{label}</div>;
}

function PreviewButton({ label, accent, icon, muted }: { label: string; accent: string; icon?: string; muted?: boolean }) {
  return <div className={cn("flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold", muted && "opacity-60")}><span className="flex items-center gap-2"><LinkIcon className="h-3.5 w-3.5" />{label}</span><span style={{ color: accent }}>{icon ? human(icon) : "Open"}</span></div>;
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}</SelectContent></Select></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Input value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#000000";
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex gap-2">
        <Input type="color" value={safeValue} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 shrink-0 p-1" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="#07130b" />
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div><div className="mb-1.5 text-[11px] font-medium text-muted-foreground">{label}</div><Input type="number" min={0} max={240} value={value} onChange={(event) => onChange(Math.max(0, Math.min(240, Number(event.target.value || 0))))} className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" /></div>;
}

function SpacingGroup({ title, section, prefix, onChange }: { title: string; section: DigitalCardSection; prefix: "margin" | "padding"; onChange: (patch: Partial<DigitalCardSection>) => void }) {
  const keys = ["top", "right", "bottom", "left"] as const;
  return (
    <div className="rounded-md border bg-background/30 p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{title}</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {keys.map((side) => {
          const key = `${prefix}_${side}` as keyof DigitalCardSection;
          return <NumberField key={side} label={human(side)} value={Number(section[key] || 0)} onChange={(value) => onChange({ [key]: value } as Partial<DigitalCardSection>)} />;
        })}
      </div>
    </div>
  );
}

function Nav({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return <a href={href} className={cn("flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground", active && "bg-accent font-medium text-accent-foreground")}>{icon}{label}</a>;
}
