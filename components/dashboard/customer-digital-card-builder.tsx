"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, Bell, Box, Camera, Check, ChevronDown, ChevronRight, Code2, Copy, CreditCard, Download, Eye, EyeOff, FileCheck2, FormInput, GripVertical, Home, IdCard, Layers, Link as LinkIcon, LogOut, MessageSquare, Mic, Monitor, Moon, Music, Palette, Play, PlayCircle, Plus, QrCode, Save, Settings, Smartphone, Square, Sun, Tablet, Trash2, Truck, Upload, UserCircle, Volume2, VolumeX, X, Zap } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  text_align?: "left" | "center" | "right";
  section_background?: string;
  section_color?: string;
  section_width?: number;
  section_min_height?: number;
  section_font_size?: number;
  section_font_weight?: number;
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
  qr_settings: { foreground?: string; background?: string; size?: number; url?: string };
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

type CanvasInteractive = {
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onUpdate: (index: number, patch: Partial<DigitalCardSection>) => void;
  onReorder: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  onToggleVisible: (index: number) => void;
};

type CardData = {
  cards: DigitalCard[];
  products: { id: string; name: string; slug: string | null; category: string | null; tagline: string | null }[];
  publicBase: string;
  profile: { email: string | null; full_name: string | null; phone: string | null; company: string | null; profile_photo_url?: string | null };
};

const linkTypes = ["website", "social", "phone", "email", "sms", "map", "booking", "payment", "download", "video", "review", "custom"];
const sectionTypes = ["profile_logo", "profile_photo", "profile_name", "profile_bio", "profile_header", "quick_actions", "links", "lead_capture", "video", "qr_code", "nfc", "gallery", "scratch_card", "punch_card", "loyalty_card", "custom"];
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
  { value: "mobile", label: "Mobile", width: 340, icon: Smartphone },
  { value: "tablet", label: "Tablet", width: 620, icon: Tablet },
  { value: "desktop", label: "Desktop", width: 920, icon: Monitor },
] as const;
type PreviewMode = typeof previewModes[number]["value"];
type BuilderPanel = "sections" | "layers" | "content" | "links" | "color_modes" | "splash" | "qr_code" | "nfc" | "media" | "forms" | "slideshow" | "steps" | "automate" | "settings" | "wizard" | "embed";
const builderPanels: { value: BuilderPanel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "sections", label: "Sections", icon: Layers },
  { value: "layers", label: "Layers", icon: Layers },
  { value: "content", label: "Content", icon: FileCheck2 },
  { value: "links", label: "Links", icon: LinkIcon },
  { value: "color_modes", label: "Color Modes", icon: Palette },
  { value: "splash", label: "Splash Page", icon: PlayCircle },
  { value: "qr_code", label: "QR Code", icon: QrCode },
  { value: "nfc", label: "NFC", icon: Smartphone },
  { value: "media", label: "Media", icon: Camera },
  { value: "forms", label: "Forms", icon: FormInput },
  { value: "slideshow", label: "Slideshow", icon: Monitor },
  { value: "steps", label: "Steps", icon: GripVertical },
  { value: "automate", label: "Automate", icon: Zap },
  { value: "settings", label: "Settings", icon: Settings },
  { value: "wizard", label: "Setup Wizard", icon: UserCircle },
  { value: "embed", label: "Embed", icon: Code2 },
];
const cardModes = ["standard", "opener_slider", "qr_only", "nfc_landing"];
const layoutTemplates = ["classic", "split_profile", "link_hub", "sales_intro", "portfolio", "appointment_first"];
const publicFabPositions = ["bottom_right", "bottom_left", "bottom_center", "top_right"];
const qrCornerStyles = ["square", "rounded", "extra_rounded", "dot"];
const qrDotStyles = ["square", "rounded", "dots", "classy"];
const digitalProductOptions = [
  { title: "Digital Business Card", subtitle: "Public profile, links, QR code, and NFC-ready URL", panel: "content" as BuilderPanel },
  { title: "Splash / Slider Card", subtitle: "Animated intro, video spot, buttons, then card reveal", panel: "splash" as BuilderPanel },
  { title: "NFC Tap Card", subtitle: "Tap-to-share destination and physical product prep", panel: "nfc" as BuilderPanel },
  { title: "QR Code Card", subtitle: "QR-first landing card with custom colors", panel: "qr_code" as BuilderPanel },
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
  // Independent feature flags — each tab has its own on/off
  standard_enabled?: boolean;   // show text overlay (title/subtitle/buttons)
  animation_enabled?: boolean;  // apply custom open/close CSS animations
  video_enabled?: boolean;      // show background video layer
  enabled?: boolean;            // master splash on/off
  title?: string;
  subtitle?: string;
  typography?: TypographySettings;
  background_color?: string;
  accent_color?: string;
  text_color?: string;
  background_image_url?: string;
  background_video_url?: string;
  duration_seconds?: number;
  transition_effect?: string;
  open_animation?: string;
  close_animation?: string;
  video_loop?: boolean;
  video_muted?: boolean;
  video_fit?: "cover" | "contain";
  video_play_seconds?: number;
  video_volume?: number;
  splash_audio_url?: string;
  splash_audio_enabled?: boolean;
  splash_audio_volume?: number;
  buttons?: OpenerButton[];
  button_position?: "top" | "center" | "bottom";
  button_margin_top?: number;
  button_margin_bottom?: number;
  button_padding_x?: number;
  button_padding_y?: number;
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
type CardThemeMode = "dark" | "light";
type CardThemePalette = { background: string; accent: string; text: string };
type CardThemeSettings = {
  sync_accent?: boolean;
  dark: CardThemePalette;
  light: CardThemePalette;
};
type TypographySettings = {
  font_family?: string;
  font_size?: number;
  color?: string;
  alignment?: "left" | "center" | "right" | "justify";
  font_weight?: number;
  italic?: boolean;
  underline?: boolean;
  letter_spacing?: number;
  line_height?: number;
};
type ImageStyleSettings = {
  shape?: "circle" | "rounded" | "square";
  outline?: "none" | "thin" | "medium" | "thick";
  outline_color?: string;
  hover_effect?: "none" | "lift" | "zoom" | "glow" | "tilt";
};
const googleFontOptions = ["Inter", "DM Sans", "Roboto", "Open Sans", "Montserrat", "Poppins", "Lato", "Merriweather", "Playfair Display", "Oswald", "Raleway", "Nunito", "Source Sans 3"];
const textAlignments = ["left", "center", "right", "justify"];
const fontWeights = ["200", "300", "400", "500", "600", "700", "800", "900"];
const imageShapes = ["circle", "rounded", "square"];
const imageOutlines = ["none", "thin", "medium", "thick"];
const imageHoverEffects = ["none", "lift", "zoom", "glow", "tilt"];

function human(value: string | null | undefined) {
  return String(value || "none").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeThemePalette(value: unknown, fallback: CardThemePalette): CardThemePalette {
  const source = isObject(value) ? value : {};
  const hexOrFallback = (v: unknown, fb: string) =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fb;
  return {
    background: hexOrFallback(source.background, fallback.background),
    accent: hexOrFallback(source.accent, fallback.accent),
    text: hexOrFallback(source.text, fallback.text),
  };
}

function themeSettings(card: DigitalCard): CardThemeSettings {
  const fallbackDark = {
    background: card.background_color || "#07130b",
    accent: card.accent_color || "#a3ff12",
    text: card.text_color || "#f7fff2",
  };
  const fallbackLight = {
    background: "#ffffff",
    accent: card.accent_color || "#4d7c0f",
    text: "#07130b",
  };
  const settings = isObject(card.media_settings?.theme_settings) ? card.media_settings.theme_settings : {};
  return {
    sync_accent: typeof settings.sync_accent === "boolean" ? settings.sync_accent : false,
    dark: safeThemePalette(settings.dark, fallbackDark),
    light: safeThemePalette(settings.light, fallbackLight),
  };
}

function applyTheme(card: DigitalCard, mode: CardThemeMode): DigitalCard {
  const palette = themeSettings(card)[mode];
  return {
    ...card,
    background_color: palette.background,
    accent_color: palette.accent,
    text_color: palette.text,
  };
}

function typographyFrom(value: unknown, fallbackColor = ""): TypographySettings {
  const source = isObject(value) ? value : {};
  const alignment = ["left", "center", "right", "justify"].includes(String(source.alignment)) ? String(source.alignment) as TypographySettings["alignment"] : "center";
  return {
    font_family: typeof source.font_family === "string" && source.font_family ? source.font_family : "Inter",
    font_size: Number(source.font_size || 18),
    color: typeof source.color === "string" && source.color ? source.color : fallbackColor,
    alignment,
    font_weight: Number(source.font_weight || 600),
    italic: Boolean(source.italic),
    underline: Boolean(source.underline),
    letter_spacing: Number(source.letter_spacing || 0),
    line_height: Number(source.line_height || 1.35),
  };
}

function typographyStyle(settings: TypographySettings): React.CSSProperties {
  return {
    fontFamily: `${settings.font_family || "Inter"}, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    color: settings.color || undefined,
    textAlign: settings.alignment || "center",
    fontWeight: Number(settings.font_weight || 600),
    fontStyle: settings.italic ? "italic" : "normal",
    textDecorationLine: settings.underline ? "underline" : "none",
    letterSpacing: `${Number(settings.letter_spacing || 0)}px`,
    lineHeight: Number(settings.line_height || 1.35),
  };
}

function imageStyleFrom(value: unknown): ImageStyleSettings {
  const source = isObject(value) ? value : {};
  const shape = ["circle", "rounded", "square"].includes(String(source.shape)) ? String(source.shape) as ImageStyleSettings["shape"] : "circle";
  const outline = ["none", "thin", "medium", "thick"].includes(String(source.outline)) ? String(source.outline) as ImageStyleSettings["outline"] : "medium";
  const hoverEffect = ["none", "lift", "zoom", "glow", "tilt"].includes(String(source.hover_effect)) ? String(source.hover_effect) as ImageStyleSettings["hover_effect"] : "none";
  return {
    shape,
    outline,
    outline_color: typeof source.outline_color === "string" && source.outline_color ? source.outline_color : "rgba(255,255,255,0.16)",
    hover_effect: hoverEffect,
  };
}

function imageShapeClass(settings: ImageStyleSettings) {
  if (settings.shape === "square") return "rounded-none";
  if (settings.shape === "rounded") return "rounded-2xl";
  return "rounded-full";
}

function imageHoverClass(settings: ImageStyleSettings) {
  if (settings.hover_effect === "lift") return "hover:-translate-y-1";
  if (settings.hover_effect === "zoom") return "hover:scale-105";
  if (settings.hover_effect === "glow") return "hover:shadow-[0_0_28px_rgba(163,255,18,0.45)]";
  if (settings.hover_effect === "tilt") return "hover:rotate-2";
  return "";
}

function imageBorderStyle(settings: ImageStyleSettings): React.CSSProperties {
  const width = settings.outline === "thin" ? 2 : settings.outline === "thick" ? 6 : settings.outline === "none" ? 0 : 4;
  return {
    borderWidth: width,
    borderColor: width ? settings.outline_color || "rgba(255,255,255,0.16)" : "transparent",
    borderStyle: "solid",
  };
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
    newSection("profile_logo",  "Logo",             1,  { margin_bottom: 8 }),
    newSection("profile_photo", "Profile photo",    2,  { margin_top: 28, margin_bottom: 16 }),
    newSection("profile_name",  "Name & title",     3,  { margin_bottom: 8 }),
    newSection("profile_bio",   "Bio",              4,  { margin_bottom: 24 }),
    newSection("quick_actions", "Quick actions",    5,  { margin_bottom: 20 }),
    newSection("links",         "Links and socials",6,  { margin_bottom: 20 }),
    newSection("lead_capture",  "Lead capture button", 7, { is_visible: false, margin_bottom: 20 }),
    newSection("video",         "Intro video",      8,  { is_visible: false, margin_bottom: 20 }),
    newSection("qr_code",       "QR code",          9,  { margin_bottom: 0 }),
    newSection("nfc",           "NFC tap to share", 10, { is_visible: false, margin_bottom: 0 }),
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

function sectionKey(section: DigitalCardSection, index: number) {
  return section.id || `${section.section_type}-${index}`;
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
  const target = card.qr_settings?.url?.trim() || cardUrl;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=${foreground}&bgcolor=${background}&data=${encodeURIComponent(target)}`;
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
    enabled: true,
    standard_enabled: true,
    animation_enabled: false,
    video_enabled: false,
    title: "Welcome",
    subtitle: "Tap to view my digital business card.",
    typography: { font_family: "Inter", font_size: 44, color: "#f7fff2", alignment: "center", font_weight: 700, italic: false, underline: false, letter_spacing: 0, line_height: 1.05 },
    background_color: "#07130b",
    accent_color: "#a3ff12",
    text_color: "#f7fff2",
    background_image_url: "",
    background_video_url: "",
    duration_seconds: 7,
    transition_effect: "fade",
    open_animation: "fade_up",
    close_animation: "fade_out",
    video_loop: true,
    video_muted: true,
    video_fit: "cover",
    video_play_seconds: 0,
    video_volume: 1,
    splash_audio_url: "",
    splash_audio_enabled: false,
    splash_audio_volume: 0.8,
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
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [previewThemeMode, setPreviewThemeMode] = useState<CardThemeMode>("dark");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activePanel, setActivePanel] = useState<BuilderPanel>("sections");
  const [previewZoom, setPreviewZoom] = useState(100);
  const [uploadingMedia, setUploadingMedia] = useState<string | null>(null);
  const [expandedSectionKeys, setExpandedSectionKeys] = useState<string[]>(["profile_header-0"]);
  const [expandedSpacingKeys, setExpandedSpacingKeys] = useState<string[]>([]);
  const [dragSectionIndex, setDragSectionIndex] = useState<number | null>(null);
  const isPro = true; // TODO: wire to subscription tier when billing is ready
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  async function uploadMedia(file: File, mediaType: string, onUploaded: (url: string) => void) {
    try {
      setUploadingMedia(mediaType);
      const token = await customerToken();
      const body = new FormData();
      body.append("file", file);
      body.append("media_type", mediaType);
      const response = await fetch("/api/dashboard/customer/digital-cards/media", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not upload media.");
      onUploaded(String(payload.publicUrl || ""));
      setMessage("Media uploaded. Save the card to keep this change.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload media.");
    } finally {
      setUploadingMedia(null);
    }
  }

  function contentTypography() {
    return typographyFrom(form.media_settings?.content_typography, form.text_color || cardThemeSettings.dark.text);
  }

  function updateContentTypography(patch: Partial<TypographySettings>) {
    const next = { ...contentTypography(), ...patch };
    update("media_settings", { ...(form.media_settings || {}), content_typography: next });
  }

  function profileImageStyle() {
    return imageStyleFrom(form.media_settings?.profile_image_style);
  }

  function updateProfileImageStyle(patch: Partial<ImageStyleSettings>) {
    const next = { ...profileImageStyle(), ...patch };
    update("media_settings", { ...(form.media_settings || {}), profile_image_style: next });
  }

  function updateThemePalette(mode: CardThemeMode, patch: Partial<CardThemePalette>) {
    setForm((current) => {
      const currentSettings = themeSettings(current);
      const nextSettings: CardThemeSettings = {
        ...currentSettings,
        [mode]: { ...currentSettings[mode], ...patch },
      };
      if (currentSettings.sync_accent && patch.accent && mode === "dark") {
        nextSettings.dark = { ...nextSettings.dark, accent: patch.accent };
        nextSettings.light = { ...nextSettings.light, accent: patch.accent };
      }
      return {
        ...current,
        background_color: nextSettings.dark.background,
        accent_color: nextSettings.dark.accent,
        text_color: nextSettings.dark.text,
        media_settings: { ...(current.media_settings || {}), theme_settings: nextSettings },
      };
    });
  }

  function updateThemeSync(sync: boolean) {
    setForm((current) => {
      const currentSettings = themeSettings(current);
      const nextSettings: CardThemeSettings = {
        ...currentSettings,
        sync_accent: sync,
        light: sync ? { ...currentSettings.light, accent: currentSettings.dark.accent } : currentSettings.light,
      };
      return {
        ...current,
        background_color: nextSettings.dark.background,
        accent_color: nextSettings.dark.accent,
        text_color: nextSettings.dark.text,
        media_settings: { ...(current.media_settings || {}), theme_settings: nextSettings },
      };
    });
  }

  function applyThemePreset(preset: CardThemePalette) {
    setForm((current) => {
      const currentSettings = themeSettings(current);
      const nextSettings: CardThemeSettings = {
        ...currentSettings,
        [previewThemeMode]: preset,
      };
      if (currentSettings.sync_accent) {
        nextSettings.dark = { ...nextSettings.dark, accent: preset.accent };
        nextSettings.light = { ...nextSettings.light, accent: preset.accent };
      }
      return {
        ...current,
        background_color: nextSettings.dark.background,
        accent_color: nextSettings.dark.accent,
        text_color: nextSettings.dark.text,
        media_settings: { ...(current.media_settings || {}), theme_settings: nextSettings },
      };
    });
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

  function duplicateSection(index: number) {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      if (index < 0 || index >= sections.length) return current;
      const copy = { ...sections[index], id: undefined, display_order: sections.length + 1 };
      return { ...current, digital_card_sections: normalizeSections([...sections, copy]) };
    });
  }

  function toggleSectionVisible(index: number) {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      if (index < 0 || index >= sections.length) return current;
      sections[index] = { ...sections[index], is_visible: !sections[index].is_visible };
      return { ...current, digital_card_sections: sections };
    });
  }

  function splitProfileHeader() {
    setForm((current) => {
      const sections = normalizeSections(current.digital_card_sections);
      const idx = sections.findIndex((s) => s.section_type === "profile_header");
      if (idx === -1) return current;
      const h = sections[idx];
      const split: DigitalCardSection[] = [
        { ...newSection("profile_logo",  "Logo",          h.display_order,       { margin_bottom: 8 }),  is_visible: h.is_visible },
        { ...newSection("profile_photo", "Profile photo", h.display_order + 0.1, { margin_top: 28, margin_bottom: 16 }), is_visible: h.is_visible },
        { ...newSection("profile_name",  "Name & title",  h.display_order + 0.2, { margin_bottom: 8 }),  is_visible: h.is_visible },
        { ...newSection("profile_bio",   "Bio",           h.display_order + 0.3, { margin_bottom: h.margin_bottom }), is_visible: h.is_visible },
      ];
      return { ...current, digital_card_sections: normalizeSections([...sections.slice(0, idx), ...split, ...sections.slice(idx + 1)]) };
    });
    setSelectedSectionIndex(null);
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

  const cardThemeSettings = themeSettings(form);

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
          <div className="text-xs text-muted-foreground">Customer <span className="mx-2">/</span> My Products <span className="mx-2">/</span><span className="font-medium text-foreground">Digital Card Builder</span></div>
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
            <Button variant="ghost" className="mb-2 h-8 px-0 text-muted-foreground" onClick={() => router.push("/dashboard/customer/manage-products")}><ArrowLeft className="h-4 w-4" /> Back to My Products</Button>
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
                if (panel === "splash") ensureOpenerSection();
                if (panel === "forms") ensureLeadCaptureSection();
              }}
            />
            <section className="max-h-[calc(100vh-9rem)] overflow-x-hidden overflow-y-auto border-r bg-background/45 p-4">
              {activePanel === "settings" && (
                <div className="space-y-4">
                  <ProductChooser onSelect={(panel) => {
                    setActivePanel(panel);
                    if (panel === "splash") ensureOpenerSection();
                  }} />
                  <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Card settings</CardTitle><CardDescription>Name, status, public URL, accessibility, and publish controls.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Card name" value={form.card_name} onChange={(value) => update("card_name", value)} />
                    <Field label="Slug" value={form.slug} onChange={(value) => update("slug", slugify(value))} />
                    <SelectField label="Status" value={form.status} values={["draft", "published", "unpublished"]} onChange={(value) => { update("status", value); update("is_public", value === "published"); }} />
                    <SelectField label="Card page mode" value={form.card_mode || "standard"} values={cardModes} onChange={(value) => update("card_mode", value)} />
                    <SelectField label="Layout template" value={form.layout_template || "classic"} values={layoutTemplates} onChange={(value) => update("layout_template", value)} />
                    <SelectField
                      label="Public action FAB"
                      value={String(form.media_settings?.public_fab_position || "bottom_right")}
                      values={publicFabPositions}
                      onChange={(value) => update("media_settings", { ...(form.media_settings || {}), public_fab_position: value })}
                    />
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
                      <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Sections</CardTitle>
                      <CardDescription>Enable the public card sections your customer wants to show. Use Layers to reorder and tune spacing.</CardDescription>
                    </div>
                    <Select value="custom" onValueChange={addSection}>
                      <SelectTrigger className="w-[190px]"><SelectValue placeholder="Add section" /></SelectTrigger>
                      <SelectContent>{sectionTypes.map((type) => <SelectItem key={type} value={type}>{human(type)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {normalizeSections(form.digital_card_sections).map((section, index) => (
                    <div key={sectionKey(section, index)} className="rounded-lg border bg-background/35 p-3">
                      <div className="flex items-center gap-3">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => updateSection(index, { is_visible: !section.is_visible })}>
                          <div className="truncate font-medium">{section.label || human(section.section_type)}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{human(section.section_type)} / Layer {index + 1}</div>
                        </button>
                        <Badge variant={section.is_visible ? "default" : "secondary"}>{section.is_visible ? "Active" : "Inactive"}</Badge>
                        <Button variant={section.is_visible ? "outline" : "default"} size="sm" onClick={() => updateSection(index, { is_visible: !section.is_visible })}>
                          {section.is_visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {section.is_visible ? "Hide" : "Show"}
                        </Button>
                      </div>
                      {section.section_type === "profile_header" && (
                        <div className="mt-2 rounded-md bg-secondary/60 p-2 text-[11px] text-muted-foreground">
                          Logo, photo, name, and bio are grouped. <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={splitProfileHeader}>Separate into individual sections →</button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>}

              {activePanel === "layers" && <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Layers</CardTitle>
                      <CardDescription>Drag, reorder, expand, and tune padding or margin for every public card layer.</CardDescription>
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
                <CardHeader className="pb-3"><CardTitle className="text-base">Content text style</CardTitle><CardDescription>Control profile text alignment, Google-style font stack, size, weight, spacing, color, bold, italic, and underline.</CardDescription></CardHeader>
                <CardContent>
                  <TypographyControls value={contentTypography()} onChange={updateContentTypography} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Profile image style</CardTitle><CardDescription>Shape the profile image and add outline or hover effects for the public card.</CardDescription></CardHeader>
                <CardContent>
                  <ImageStyleControls value={profileImageStyle()} onChange={updateProfileImageStyle} />
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
                </CardContent>
              </Card></div>}

              {activePanel === "links" && <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Links, buttons, and chips</CardTitle>
                  <CardDescription>Create separate links, larger action buttons, and lightweight chips for social, booking, payments, files, maps, videos, reviews, and more.</CardDescription>
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

              {activePanel === "media" && <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><Camera className="h-4 w-4" /> Media</CardTitle>
                  <CardDescription>Upload or capture card photos, logos, backgrounds, and video media without needing URL fields.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 overflow-hidden">
                  <div className="min-w-0">
                    <p className="mb-2 text-xs text-muted-foreground">Your headshot or professional photo shown at the top of your card.</p>
                    <MediaUploadField label="Profile photo" mediaType="profile-photo" accept="image/*" value={form.profile_photo_url || ""} uploading={uploadingMedia} onUpload={uploadMedia} onUploaded={(url) => update("profile_photo_url", url)}
                      position={(form.media_settings?.profile_image_style as { position?: "left" | "center" | "right" } | undefined)?.position || "center"}
                      onPositionChange={(pos) => update("media_settings", { ...(form.media_settings || {}), profile_image_style: { ...((form.media_settings?.profile_image_style as object) || {}), position: pos } })} />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 text-xs text-muted-foreground">Your company or brand logo shown in the top-left corner of the card.</p>
                    <MediaUploadField label="Logo" mediaType="logo" accept="image/*" value={form.logo_url || ""} uploading={uploadingMedia} onUpload={uploadMedia} onUploaded={(url) => update("logo_url", url)}
                      position={(form.media_settings?.logo_position as "left" | "center" | "right" | undefined) || "left"}
                      onPositionChange={(pos) => update("media_settings", { ...(form.media_settings || {}), logo_position: pos })} />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 text-xs text-muted-foreground">A full-card background image. A dark overlay is applied automatically so text stays readable.</p>
                    <MediaUploadField label="Background image" mediaType="background-image" accept="image/*" value={form.background_image_url || ""} uploading={uploadingMedia} onUpload={uploadMedia} onUploaded={(url) => update("background_image_url", url)} />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 text-xs text-muted-foreground">A looping video that plays behind the splash/opener screen (muted autoplay). MP4 recommended.</p>
                    <MediaUploadField label="Background video" mediaType="background-video" accept="video/*" value={String((form.media_settings?.background_video_url as string) || "")} uploading={uploadingMedia} onUpload={uploadMedia} onUploaded={(url) => update("media_settings", { ...(form.media_settings || {}), background_video_url: url })} />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 text-xs text-muted-foreground">A short intro reel or pitch video. Shown as a tappable link in the Intro Video section of the card.</p>
                    <MediaUploadField label="Intro video" mediaType="intro-video" accept="video/*" value={form.intro_video_url || ""} uploading={uploadingMedia} onUpload={uploadMedia} onUploaded={(url) => update("intro_video_url", url)} />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 text-xs text-muted-foreground">A small image (logo or icon) overlaid in the center of your QR code. Configure colors in the QR Code panel.</p>
                    <MediaUploadField label="QR logo center" mediaType="qr-logo" accept="image/*" value={form.qr_logo_url || ""} uploading={uploadingMedia} onUpload={uploadMedia} onUploaded={(url) => update("qr_logo_url", url)} />
                  </div>
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

              {activePanel === "color_modes" && <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Color Modes</CardTitle><CardDescription>Set reusable dark and light palettes for the public card and preview each mode before saving.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Quick presets — applying to{" "}
                        <span className={`inline-flex items-center gap-1 font-semibold ${previewThemeMode === "dark" ? "text-foreground" : "text-amber-500"}`}>
                          {previewThemeMode === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                          {previewThemeMode} mode
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setPreviewThemeMode(previewThemeMode === "dark" ? "light" : "dark")}
                      >
                        Switch to {previewThemeMode === "dark" ? "light" : "dark"}
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className="flex items-center gap-3 rounded-lg border bg-background/35 p-2 text-left text-xs transition-colors hover:border-primary/60"
                          onClick={() => applyThemePreset(preset)}
                        >
                          <span className="flex -space-x-1">
                            {[preset.background, preset.accent, preset.text].map((color) => <span key={color} className="h-5 w-5 rounded-full border" style={{ backgroundColor: color }} />)}
                          </span>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <SelectField label="Light / dark mode" value={form.theme_mode || "dark"} values={["light", "dark", "both"]} onChange={(value) => update("theme_mode", value)} />
                    <SelectField label="Preview color mode" value={previewThemeMode} values={["dark", "light"]} onChange={(value) => setPreviewThemeMode(value as CardThemeMode)} />
                    <SelectField label="Sync accent color" value={cardThemeSettings.sync_accent ? "yes" : "no"} values={["yes", "no"]} onChange={(value) => updateThemeSync(value === "yes")} />
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className="rounded-lg border bg-background/35 p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Moon className="h-4 w-4" /> Dark mode colors</div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <ColorField label="Background" value={cardThemeSettings.dark.background} onChange={(value) => updateThemePalette("dark", { background: value })} />
                        <ColorField label="Accent" value={cardThemeSettings.dark.accent} onChange={(value) => updateThemePalette("dark", { accent: value })} />
                        <ColorField label="Text" value={cardThemeSettings.dark.text} onChange={(value) => updateThemePalette("dark", { text: value })} />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background/35 p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sun className="h-4 w-4" /> Light mode colors</div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <ColorField label="Background" value={cardThemeSettings.light.background} onChange={(value) => updateThemePalette("light", { background: value })} />
                        <ColorField label="Accent" value={cardThemeSettings.light.accent} onChange={(value) => updateThemePalette("light", { accent: value })} />
                        <ColorField label="Text" value={cardThemeSettings.light.text} onChange={(value) => updateThemePalette("light", { text: value })} />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-dashed bg-background/30 p-3 text-xs text-muted-foreground">
                    Use Media for photos, logos, and videos. Use QR Code for QR colors, logo center, and export controls.
                  </div>
                </CardContent>
              </Card>}

              {activePanel === "qr_code" && <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><QrCode className="h-4 w-4" /> QR Code</CardTitle><CardDescription>Customize QR colors, center logo, corner style, dot style, and exports.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <img className="h-[180px] w-[180px] rounded-lg border bg-white p-2" src={qrUrl(publicUrl, form)} alt="QR code preview" />
                  </div>
                  <div className="grid gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">QR code URL</label>
                      <Input
                        value={form.qr_settings?.url || ""}
                        placeholder={publicUrl}
                        onChange={(e) => update("qr_settings", { ...form.qr_settings, url: e.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground">Defaults to your card&apos;s public URL. Enter any URL to point this QR code elsewhere.</p>
                    </div>
                    <MediaUploadField label="QR logo center" mediaType="qr-logo" accept="image/*" value={form.qr_logo_url || ""} uploading={uploadingMedia} onUpload={uploadMedia} onUploaded={(url) => update("qr_logo_url", url)} />
                    <ColorField label="QR foreground" value={String(form.qr_settings?.foreground || "#07130b")} onChange={(value) => update("qr_settings", { ...form.qr_settings, foreground: value })} />
                    <ColorField label="QR background" value={String(form.qr_settings?.background || "#ffffff")} onChange={(value) => update("qr_settings", { ...form.qr_settings, background: value })} />
                    <SelectField label="QR corner style" value={form.qr_corner_style || "square"} values={qrCornerStyles} onChange={(value) => update("qr_corner_style", value)} />
                    <SelectField label="QR dot style" value={form.qr_dot_style || "square"} values={qrDotStyles} onChange={(value) => update("qr_dot_style", value)} />
                    <Button variant="outline" asChild><a href={qrUrl(publicUrl, form)} download={`${form.slug}-qr.png`}><Download className="h-4 w-4" /> Download QR PNG</a></Button>
                    <Button variant="outline" asChild><a href={`${qrUrl(publicUrl, form)}&format=svg`} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /> Open QR SVG</a></Button>
                  </div>
                </CardContent>
              </Card>}

              {activePanel === "splash" && <OpenerPanel content={getOpenerContent()} primaryPhone={form.primary_phone || ""} onChange={updateOpenerContent} uploadMedia={uploadMedia} uploadingMedia={uploadingMedia} />}

              {activePanel === "slideshow" && <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Slideshow</CardTitle><CardDescription>Add intro, services, gallery, testimonials, and contact slides for slider-based card experiences.</CardDescription></CardHeader>
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

              {activePanel === "nfc" && <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">NFC &amp; QR Tracking</CardTitle><CardDescription>Program your NFC tag and QR code with tracked URLs so every tap and scan shows up in analytics.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">NFC tap URL</div>
                      <div className="flex items-center gap-2 rounded-lg border bg-background/35 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{publicUrl}?source=nfc</span>
                        <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-xs" onClick={() => copy(`${publicUrl}?source=nfc`)}>Copy</Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Program this into any NFC tag writer app (NFC Tools, Tasker, etc.). Every tap fires an <strong>nfc_tap</strong> event in analytics.</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">QR scan URL</div>
                      <div className="flex items-center gap-2 rounded-lg border bg-background/35 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{publicUrl}?source=qr</span>
                        <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-xs" onClick={() => copy(`${publicUrl}?source=qr`)}>Copy</Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Use when printing a custom QR code outside the card. The built-in QR section already uses this automatically.</p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-primary/5 p-4 space-y-2">
                    <div className="text-sm font-semibold">How to program an NFC tag</div>
                    <ol className="space-y-1.5 text-xs text-muted-foreground list-none">
                      {[
                        ["Download NFC Tools", "Free app on iOS and Android — search “NFC Tools” by wakdev."],
                        ["Tap Write → Add a record → URL/URI", "Paste the NFC tap URL above as the URL value."],
                        ["Write to tag", "Hold your phone over the NFC chip in your card or product for 1–2 seconds."],
                        ["Test it", "Tap any NFC-enabled phone to your card — it should open your digital card instantly."],
                      ].map(([step, desc], i) => (
                        <li key={step} className="flex gap-2">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{i + 1}</span>
                          <span><strong className="text-foreground">{step}</strong> — {desc}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <SelectField label="NFC status" value={form.nfc_status || "not_ordered"} values={["not_ordered", "ordered", "assigned", "programmed", "shipped"]} onChange={(value) => update("nfc_status", value)} />
                    <SelectField label="Access status" value={form.access_status || "trial"} values={["trial", "active", "past_due", "paused", "expired", "none"]} onChange={(value) => update("access_status", value)} />
                    <SelectField label="Subscription provider" value={form.subscription_provider || "none"} values={["none", "square", "stripe", "manual"]} onChange={(value) => update("subscription_provider", value === "none" ? "" : value)} />
                    <Field label="Access plan" value={form.access_plan || ""} onChange={(value) => update("access_plan", value)} />
                    <Field label="Subscription reference" value={form.subscription_reference || ""} onChange={(value) => update("subscription_reference", value)} />
                  </div>
                </CardContent>
              </Card>}

              {activePanel === "steps" && <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><GripVertical className="h-4 w-4" /> Steps</CardTitle>
                  <CardDescription>Plan how many pages the digital product uses and how visitors move between them.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <SelectField label="Step count" value={String(form.media_settings?.step_count || "1")} values={["1", "2", "3", "4", "5"]} onChange={(value) => update("media_settings", { ...(form.media_settings || {}), step_count: value })} />
                    <SelectField label="Slider control" value={String(form.media_settings?.slider_control || "pagination_dots")} values={["pagination_dots", "arrows", "arrows_and_dots", "swipe_only"]} onChange={(value) => update("media_settings", { ...(form.media_settings || {}), slider_control: value })} />
                    <SelectField label="Start page" value={String(form.media_settings?.start_page || "splash")} values={["splash", "profile", "links", "qr_code"]} onChange={(value) => update("media_settings", { ...(form.media_settings || {}), start_page: value })} />
                  </div>
                  <div className="rounded-lg border border-dashed bg-background/30 p-3 text-xs text-muted-foreground">Detailed drag ordering between pages will connect to Slideshow and Sections in the next pass.</div>
                </CardContent>
              </Card>}

              {activePanel === "automate" && form.id && <AutomatePanel cardId={form.id} />}

              {activePanel === "wizard" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><UserCircle className="h-4 w-4" /> Setup Wizard</CardTitle>
                    <CardDescription>Follow these steps to build, customize, and launch your digital business card. Expand any step to see what&apos;s inside and jump directly to that panel.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-2 pb-2">
                    <Accordion type="single" collapsible className="w-full">

                      <AccordionItem value="step-1">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
                            <span className="font-semibold text-sm">Add your content</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">This is the foundation of your card — your name, title, company, and how people contact you.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Display name & title</strong><span>What visitors see as your headline, e.g. &ldquo;Jeremy Waters – Co-Founder&rdquo;</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Company & department</strong><span>Shown under your name on the profile header</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Bio</strong><span>A short paragraph describing who you are and what you do</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Primary phone & SMS</strong><span>Powers the Call and Text quick-action chips on the card</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Email & website</strong><span>Powers the Email chip and adds a Website button to the links section</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Maps URL</strong><span>Adds a Map chip so visitors can get directions with one tap</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => setActivePanel("content")}>Open Content panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-2">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
                            <span className="font-semibold text-sm">Upload your media</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">Upload photos and videos directly from your device — no external URLs needed.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Profile photo</strong><span>Your headshot or professional photo shown prominently on the card</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Logo</strong><span>Company or brand mark shown in the top-left corner of the card</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Background image</strong><span>Full-card backdrop with automatic dark overlay so text stays readable</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Background video</strong><span>Looping muted video for the splash/opener screen — MP4 recommended</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Intro video</strong><span>A short pitch or reel shown as a tappable link on the card</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">QR logo center</strong><span>Small icon or logo overlaid in the center of your QR code</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => setActivePanel("media")}>Open Media panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-3">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</span>
                            <span className="font-semibold text-sm">Add links & social profiles</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">Build a list of tappable links that appear on your card — social handles, extra phones, booking pages, and more.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Social profiles</strong><span>Instagram, LinkedIn, TikTok, X/Twitter, Facebook, YouTube, and more</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Phone & SMS</strong><span>Additional numbers beyond your primary, e.g. office or after-hours</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Email</strong><span>Additional email addresses beyond your primary</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Booking & payments</strong><span>Calendly, Square, Venmo, Cash App, PayPal, and similar service links</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Downloads</strong><span>PDFs, menus, brochures, or portfolios hosted anywhere</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Custom</strong><span>Any URL with a custom label for anything that doesn&apos;t fit a preset type</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => setActivePanel("links")}>Open Links panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-4">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">4</span>
                            <span className="font-semibold text-sm">Customize colors & appearance</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">Set your brand colors, typography, and profile image style. Visitors can switch between dark and light mode on the card.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Background color</strong><span>The main card background (default: deep green #07130b)</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Accent color</strong><span>Button highlights, link colors, and QR foreground (default: lime #a3ff12)</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Text color</strong><span>Primary text color on the card</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Light mode palette</strong><span>Separate set of colors for when a visitor switches to light mode</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Typography</strong><span>Font, size, weight, alignment, and line spacing for your name and bio</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Profile image style</strong><span>Circle, rounded square, or square; border thickness and hover effects</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => setActivePanel("color_modes")}>Open Color Modes panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-5">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">5</span>
                            <span className="font-semibold text-sm">Manage sections & layers</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">Control which content blocks appear on your card, their order, and spacing. Every section can be shown, hidden, or reordered.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Profile header</strong><span>Your photo, name, title, company, and bio</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Quick actions</strong><span>Call, SMS, Email, and Map icon chips shown at the top of the card</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Links & socials</strong><span>The full list of links you configured in the Links panel</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Lead capture button</strong><span>Tap-to-open contact form (configure it in the Forms panel)</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Intro video</strong><span>Tappable link to watch your short pitch video</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">QR code</strong><span>Your scannable QR code displayed directly on the card</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Margin & padding</strong><span>Fine-tune spacing above and below each section independently</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => setActivePanel("layers")}>Open Layers panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-6">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">6</span>
                            <span className="font-semibold text-sm">Set up lead capture</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">Add a &ldquo;Send me your info&rdquo; button to your card that opens a contact form — perfect for events and networking.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Button label</strong><span>Customize what the button says, e.g. &ldquo;Connect with me&rdquo; or &ldquo;Let&apos;s talk&rdquo;</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Form title & description</strong><span>Shown at the top of the form page your visitors fill out</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Collect name, email, phone, company, message</strong><span>Toggle each field on or off to match what you need</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Required fields</strong><span>Mark specific fields required before the form can be submitted</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Submit button label</strong><span>Customize the text on the form&apos;s submit button</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => { setActivePanel("forms"); ensureLeadCaptureSection(); }}>Open Forms panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-7">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">7</span>
                            <span className="font-semibold text-sm">Add a splash / opener screen</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">An animated intro that plays before your card is revealed — great for making a strong first impression.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Title & subtitle</strong><span>Headline and tagline on the opener, e.g. &ldquo;Welcome&rdquo; / &ldquo;Tap to view my card&rdquo;</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Background color & video</strong><span>Full-screen branded intro with an optional looping background video</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Buttons</strong><span>Up to 2 action buttons — View Card, Call me, or a custom URL</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Auto-dismiss duration</strong><span>How long the opener stays before automatically sliding away (1–30 seconds)</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Typography & animations</strong><span>Font size, weight, and enter/exit animation style</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => { setActivePanel("splash"); ensureOpenerSection(); }}>Open Splash Page panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-8">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">8</span>
                            <span className="font-semibold text-sm">Configure your QR code</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">Customize the QR code that links to your card. Change colors, add a logo center, and download for print or signage.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">QR code URL</strong><span>Defaults to your card URL — override to point to any website, menu, or landing page</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Foreground & background color</strong><span>Match your brand colors — keep high contrast for reliable scanning</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Center logo</strong><span>Embed a small icon or logo inside the QR code</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Corner & dot style</strong><span>Square or rounded styling options</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Download PNG or SVG</strong><span>Export for business cards, flyers, signage, or print orders</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => setActivePanel("qr_code")}>Open QR Code panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-9">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">9</span>
                            <span className="font-semibold text-sm">Program your NFC tag</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">If your order includes an NFC-enabled product, program the chip to open your card with a single tap — no scanning needed.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">NFC tap URL</strong><span>Copy and program into any NFC tag writer app — NFC Tools is free on iOS & Android</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">QR scan URL</strong><span>The tracked URL to use if you print your own external QR code</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Analytics</strong><span>Every NFC tap and QR scan is logged so you can see how people find your card</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Step-by-step instructions</strong><span>The NFC panel includes a full walkthrough for writing the tag with a free app</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => setActivePanel("nfc")}>Open NFC panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-10" className="border-b-0">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">10</span>
                            <span className="font-semibold text-sm">Publish and test your card</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-4 pt-1 pb-2">
                            <p className="text-xs text-muted-foreground">Set your card live, copy the public URL, and verify everything looks right on a real mobile device before sharing.</p>
                            <ul className="space-y-3 text-xs text-muted-foreground">
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Set status to Published</strong><span>Use the Status dropdown at the top of the Sections panel to go live</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Make card public</strong><span>Toggle &ldquo;Public&rdquo; on so anyone with the URL or QR code can view it</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Copy your public URL</strong><span>Share it via text, email, or social — it works like a mobile-optimized website</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Scan your QR code</strong><span>Open the QR Code panel and test scanning it with your phone camera</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Test on mobile</strong><span>Open your card URL on a phone to confirm layout, chips, and links all work</span></li>
                              <li className="flex flex-col gap-0.5"><strong className="text-foreground text-[13px]">Save before sharing</strong><span>Always click &ldquo;Save card&rdquo; after changes so updates go live immediately</span></li>
                            </ul>
                            <Button size="sm" variant="outline" onClick={() => setActivePanel("sections")}>Open Sections panel</Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                    </Accordion>
                  </CardContent>
                </Card>
              )}

              {activePanel === "embed" && (
                isPro
                  ? <EmbedPanel publicUrl={publicUrl} isPublished={form.status === "published"} />
                  : <LockedEmbedPanel onUnlock={() => setUpgradeOpen(true)} />
              )}
            </section>

            <LivePreview card={form} publicUrl={publicUrl} mode={previewMode} onModeChange={setPreviewMode} themeMode={previewThemeMode} onThemeModeChange={setPreviewThemeMode} zoom={previewZoom} onZoomChange={setPreviewZoom} canvas={{ selectedIndex: selectedSectionIndex, onSelect: setSelectedSectionIndex, onUpdate: updateSection, onReorder: (from, to) => { reorderSection(from, to); setSelectedSectionIndex(null); }, onRemove: (idx) => { removeSection(idx); setSelectedSectionIndex(null); }, onDuplicate: (idx) => { duplicateSection(idx); setSelectedSectionIndex(null); }, onToggleVisible: toggleSectionVisible }} />
          </div>
        )}
      </main>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
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

// ─── Automate Panel ──────────────────────────────────────────────────────────

type AutomatePreset = {
  name: string;
  description: string;
  trigger_type: string;
  action_type: string;
  delay_minutes: number;
};

type CardAutomation = {
  id: string;
  preset_key: string;
  name: string;
  enabled: boolean;
  last_run_at: string | null;
  run_count: number;
};

type CardLead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  status: string;
  source: string | null;
  tags: string[];
  utm_source: string | null;
  notes: string | null;
  created_at: string;
};

type AutomationLog = {
  id: string;
  automation_id: string;
  status: string;
  error_message: string | null;
  executed_at: string;
  automations: { name: string } | null;
};

const PRESET_DESCRIPTIONS: Record<string, { icon: string; label: string; detail: string; badge: string }> = {
  lead_email:           { icon: "✉️", label: "Email me on new lead", detail: "Instant email to you whenever someone submits the lead form.", badge: "Lead" },
  lead_sms:             { icon: "💬", label: "SMS me on new lead", detail: "Text alert to your phone number when a lead comes in.", badge: "Lead" },
  lead_followup:        { icon: "⏰", label: "24h lead follow-up email", detail: "Auto-send a follow-up email to the lead 24 hours later.", badge: "Lead" },
  nfc_alert:            { icon: "📲", label: "Alert me on NFC tap", detail: "Email you each time someone taps your NFC card.", badge: "NFC" },
  qr_alert:             { icon: "🔲", label: "Alert me on QR scan", detail: "Email you each time someone scans your QR code.", badge: "QR" },
  payment_thankyou:     { icon: "💳", label: "Payment received thank-you", detail: "Send an automatic thank-you to the customer after Square payment.", badge: "Square" },
  auto_tag_source:      { icon: "🏷️", label: "Auto-tag lead by source", detail: "Tag each lead with their traffic source automatically.", badge: "CRM" },
  subscription_welcome: { icon: "⭐", label: "Subscription welcome email", detail: "Welcome email when a Square subscription activates.", badge: "Square" },
};

const LEAD_STATUSES = ["new", "contacted", "qualified", "archived"];

function AutomatePanel({ cardId }: { cardId: string }) {
  const [tab, setTab] = useState<"automations" | "leads" | "logs">("automations");
  const [automations, setAutomations] = useState<CardAutomation[]>([]);
  const [presets, setPresets] = useState<Record<string, AutomatePreset>>({});
  const [leads, setLeads] = useState<CardLead[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [leadNotes, setLeadNotes] = useState<Record<string, string>>({});

  const apiBase = "/api/dashboard/customer/digital-cards/automations";

  async function fetchData() {
    try {
      const token = await customerToken();
      const res = await fetch(`${apiBase}?card_id=${cardId}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setAutomations(data.automations ?? []);
      setPresets(data.presets ?? {});
      setLeads(data.leads ?? []);
      setLogs(data.logs ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, [cardId]);

  async function togglePreset(presetKey: string, currentlyEnabled: boolean) {
    setToggling(presetKey);
    try {
      const token = await customerToken();
      const existing = automations.find((a) => a.preset_key === presetKey);

      if (existing && currentlyEnabled) {
        await fetch(apiBase, {
          method: "PATCH",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ id: existing.id, card_id: cardId, enabled: false }),
        });
        setAutomations((prev) => prev.map((a) => a.id === existing.id ? { ...a, enabled: false } : a));
      } else if (existing && !currentlyEnabled) {
        await fetch(apiBase, {
          method: "PATCH",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ id: existing.id, card_id: cardId, enabled: true }),
        });
        setAutomations((prev) => prev.map((a) => a.id === existing.id ? { ...a, enabled: true } : a));
      } else {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ card_id: cardId, preset_key: presetKey }),
        });
        const data = await res.json();
        if (data.ok) {
          const preset = presets[presetKey];
          setAutomations((prev) => [...prev, { id: data.id, preset_key: presetKey, name: preset?.name ?? presetKey, enabled: true, last_run_at: null, run_count: 0 }]);
        }
      }
    } finally {
      setToggling(null);
    }
  }

  async function patchLead(leadId: string, patch: { status?: string; notes?: string; tags?: string[] }) {
    const token = await customerToken();
    await fetch(apiBase, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ card_id: cardId, lead_id: leadId, lead_patch: patch }),
    });
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, ...patch } : l));
  }

  if (loading) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading automations…</CardContent></Card>;
  }

  const presetKeys = Object.keys(PRESET_DESCRIPTIONS);
  const statusColor: Record<string, string> = { new: "bg-primary/20 text-primary", contacted: "bg-blue-500/20 text-blue-400", qualified: "bg-emerald-500/20 text-emerald-400", archived: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border bg-background/40 p-1">
        {(["automations", "leads", "logs"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t}{t === "leads" && leads.length > 0 && <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px]">{leads.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Automations tab ── */}
      {tab === "automations" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Toggle automations on to activate them for this card. Changes save instantly.</p>
          {presetKeys.map((key) => {
            const meta = PRESET_DESCRIPTIONS[key];
            const record = automations.find((a) => a.preset_key === key);
            const isOn = record?.enabled ?? false;
            const isToggling = toggling === key;
            return (
              <div key={key} className={cn("rounded-lg border p-3 transition-colors", isOn ? "border-primary/40 bg-primary/5" : "bg-background/35")}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{meta.label}</span>
                      <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{meta.badge}</span>
                      {record?.last_run_at && (
                        <span className="text-[10px] text-muted-foreground">Last ran {new Date(record.last_run_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.detail}</p>
                  </div>
                  <button type="button" disabled={isToggling} onClick={() => togglePreset(key, isOn)}
                    className={cn("relative h-6 w-10 shrink-0 rounded-full border-2 transition-all",
                      isOn ? "border-primary bg-primary" : "border-input bg-input/30",
                      isToggling && "opacity-50")}>
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all", isOn ? "left-4" : "left-0.5")} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Leads / CRM tab ── */}
      {tab === "leads" && (
        <div className="space-y-3">
          {leads.length === 0 && (
            <div className="rounded-lg border border-dashed bg-background/30 py-10 text-center text-sm text-muted-foreground">No leads yet. Share your card to start collecting them.</div>
          )}
          {leads.map((lead) => {
            const isOpen = expandedLead === lead.id;
            return (
              <div key={lead.id} className="overflow-hidden rounded-lg border bg-background/35">
                <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setExpandedLead(isOpen ? null : lead.id)}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {(lead.name || lead.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{lead.name || lead.email || "Anonymous"}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusColor[lead.status] ?? statusColor.new)}>{lead.status}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {lead.email && <span className="truncate">{lead.email}</span>}
                      {lead.source && <span className="rounded border px-1">{lead.source}</span>}
                      <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="border-t p-3 space-y-3">
                    {lead.message && <p className="rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">{lead.message}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-accent"><span>📞</span>{lead.phone}</a>}
                      {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-accent"><span>✉️</span>Email</a>}
                    </div>
                    {/* Tags */}
                    <div>
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {lead.tags?.map((tag) => (
                          <span key={tag} className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {tag}
                            <button type="button" onClick={() => patchLead(lead.id, { tags: lead.tags.filter((t) => t !== tag) })} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                          </span>
                        ))}
                        <form onSubmit={async (e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem("tag") as HTMLInputElement).value.trim(); if (v) { await patchLead(lead.id, { tags: [...(lead.tags ?? []), v] }); (e.currentTarget.elements.namedItem("tag") as HTMLInputElement).value = ""; } }}>
                          <input name="tag" placeholder="+ tag" className="h-5 w-16 rounded-full border bg-transparent px-2 text-[10px] outline-none focus:border-primary" />
                        </form>
                      </div>
                    </div>
                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                      <div className="flex gap-1">
                        {LEAD_STATUSES.map((s) => (
                          <button key={s} type="button" onClick={() => patchLead(lead.id, { status: s })}
                            className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize transition-colors", lead.status === s ? statusColor[s] : "border text-muted-foreground hover:bg-accent")}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Notes */}
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</div>
                      <textarea
                        rows={2}
                        defaultValue={lead.notes ?? ""}
                        onChange={(e) => setLeadNotes((p) => ({ ...p, [lead.id]: e.target.value }))}
                        onBlur={() => { if (leadNotes[lead.id] !== undefined) patchLead(lead.id, { notes: leadNotes[lead.id] }); }}
                        placeholder="Internal notes…"
                        className="w-full resize-none rounded-md border bg-background/50 px-2 py-1.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Logs tab ── */}
      {tab === "logs" && (
        <div className="space-y-2">
          {logs.length === 0 && (
            <div className="rounded-lg border border-dashed bg-background/30 py-10 text-center text-sm text-muted-foreground">No automation runs yet.</div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 rounded-lg border bg-background/35 p-3">
              <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", log.status === "success" ? "bg-primary" : "bg-destructive")} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold">{log.automations?.name ?? "Automation"}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(log.executed_at).toLocaleString()}</div>
                {log.error_message && <div className="mt-1 text-[10px] text-destructive">{log.error_message}</div>}
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", log.status === "success" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>{log.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Splash Audio Modal ──────────────────────────────────────────────────────

function SplashAudioModal({ open, onClose, currentUrl, onSave, uploadMedia, uploadingMedia }: {
  open: boolean; onClose: () => void; currentUrl: string; onSave: (url: string) => void;
  uploadMedia?: (file: File, mediaType: string, onUploaded: (url: string) => void) => void;
  uploadingMedia?: string | null;
}) {
  const [audioTab, setAudioTab] = useState<"upload" | "record">("upload");
  const [pasteUrl, setPasteUrl] = useState(currentUrl);
  const [recordState, setRecordState] = useState<"idle" | "recording" | "stopped">("idle");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) { stopAudio(); streamRef.current?.getTracks().forEach((t) => t.stop()); if (timerRef.current) clearInterval(timerRef.current); }
  }, [open]);

  function stopAudio() { audioRef.current?.pause(); setIsPlaying(false); }

  function togglePlay(url: string) {
    if (!audioRef.current) audioRef.current = new Audio();
    if (isPlaying) { stopAudio(); return; }
    audioRef.current.src = url;
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        setRecordedUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: "audio/webm" })));
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setRecordState("recording");
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch { alert("Microphone access denied. Please allow microphone access in your browser settings."); }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordState("stopped");
  }

  function fmtSec(s: number) { return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`; }

  const activeUrl = audioTab === "upload" ? pasteUrl : (recordedUrl || "");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { stopAudio(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Music className="h-4 w-4" /> Splash Audio</DialogTitle>
          <DialogDescription>Add background music or narration to your splash screen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["upload", "record"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { stopAudio(); setAudioTab(t); }}
                className={cn("rounded-md py-1.5 text-xs font-medium transition-colors", audioTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >{t === "upload" ? "Upload / URL" : "Record audio"}</button>
            ))}
          </div>

          {audioTab === "upload" && <div className="space-y-3">
            {uploadMedia && (
              <div className="rounded-lg border bg-background/35 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Upload audio file</span>
                  {pasteUrl && <Badge variant="outline">Added</Badge>}
                </div>
                <Button variant="outline" size="sm" asChild disabled={uploadingMedia === "splash-audio"} className="gap-2">
                  <label htmlFor="splash-audio-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4" />{uploadingMedia === "splash-audio" ? "Uploading…" : "Choose audio file"}
                  </label>
                </Button>
                <input id="splash-audio-upload" type="file" accept="audio/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f && uploadMedia) uploadMedia(f, "splash-audio", (url) => setPasteUrl(url)); }} />
                <p className="mt-1.5 text-[11px] text-muted-foreground">MP3, AAC, WAV, OGG supported</p>
              </div>
            )}
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Or paste audio URL</div>
              <Input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="https://…/audio.mp3" className="h-9" />
            </div>
            {pasteUrl && (
              <Button variant="outline" size="sm" className="gap-2" type="button" onClick={() => togglePlay(pasteUrl)}>
                {isPlaying ? <><Square className="h-3.5 w-3.5" /> Stop</> : <><Play className="h-3.5 w-3.5" /> Listen</>}
              </Button>
            )}
          </div>}

          {audioTab === "record" && <div className="rounded-lg border bg-background/35 p-5 text-center space-y-3">
            {recordState === "idle" && <>
              <Mic className="mx-auto h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-xs text-muted-foreground">Click below to start capturing from your microphone.</p>
              <Button onClick={startRecording} className="gap-2 mx-auto"><Mic className="h-4 w-4" /> Start recording</Button>
            </>}
            {recordState === "recording" && <>
              <div className="flex items-center justify-center gap-3">
                <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-3xl font-bold text-red-500">{fmtSec(recSeconds)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Recording in progress…</p>
              <Button variant="destructive" onClick={stopRecording} className="gap-2 mx-auto"><Square className="h-4 w-4" /> Stop</Button>
            </>}
            {recordState === "stopped" && recordedUrl && <>
              <Check className="mx-auto h-8 w-8 text-green-500" />
              <p className="text-xs text-muted-foreground">Recorded — {fmtSec(recSeconds)}</p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" type="button" onClick={() => togglePlay(recordedUrl)}>
                  {isPlaying ? <><Square className="h-3.5 w-3.5" /> Stop</> : <><Play className="h-3.5 w-3.5" /> Listen</>}
                </Button>
                <Button variant="outline" size="sm" className="gap-2" type="button"
                  onClick={() => { stopAudio(); setRecordState("idle"); setRecordedUrl(null); setRecSeconds(0); }}>
                  <Mic className="h-3.5 w-3.5" /> Re-record
                </Button>
              </div>
            </>}
          </div>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { stopAudio(); onClose(); }}>Cancel</Button>
          <Button onClick={() => { if (activeUrl) { onSave(activeUrl); onClose(); } }} disabled={!activeUrl}>Save audio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared splash helpers ────────────────────────────────────────────────────

function SplashPillToggle({ checked, onToggle, labelOn, labelOff }: { checked: boolean; onToggle: (v: boolean) => void; labelOn: string; labelOff: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onToggle(!checked)}
      className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-muted")}
    ><span className={cn("h-2 w-2 rounded-full", checked ? "bg-primary-foreground" : "bg-muted-foreground")} />{checked ? labelOn : labelOff}</button>
  );
}

const SPLASH_TRANSITIONS = ["fade", "slide_up", "slide_down", "slide_left", "slide_right", "wipe_left", "wipe_right", "zoom_in", "zoom_out", "flip", "none"];
const OPEN_ANIMATIONS    = ["fade_up", "fade_in", "zoom_in", "slide_up", "slide_down", "slide_left", "slide_right", "flip_in", "bounce_in"];
const CLOSE_ANIMATIONS   = ["fade_out", "zoom_out", "slide_up", "slide_down", "slide_left", "slide_right", "flip_out", "dissolve"];

function OpenerPanel({ content, primaryPhone, onChange, uploadMedia, uploadingMedia }: {
  content: OpenerContent;
  primaryPhone: string;
  onChange: (patch: Partial<OpenerContent>) => void;
  uploadMedia?: (file: File, mediaType: string, onUploaded: (url: string) => void) => void;
  uploadingMedia?: string | null;
}) {
  const [splashTab, setSplashTab] = useState<"standard" | "animation" | "video" | "slideshow">("standard");
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const buttons = (content.buttons || []).slice(0, 2);
  const splashTypography = typographyFrom(content.typography, content.text_color || "#f7fff2");
  const isEnabled = content.enabled !== false;
  const totalSec = Number(content.duration_seconds ?? 7);
  const durMin = Math.floor(totalSec / 60);
  const durSec = totalSec % 60;
  const vidTotal = Number(content.video_play_seconds ?? 0);
  const vidMin = Math.floor(vidTotal / 60);
  const vidSec = vidTotal % 60;

  function updateButton(index: number, patch: Partial<OpenerButton>) {
    const next = [...buttons];
    next[index] = { ...(next[index] || { label: "Button", action: "open_card" as const }), ...patch };
    onChange({ buttons: next.slice(0, 2) });
  }

  function toggleAudioPreview(url: string) {
    if (!audioPreviewRef.current) audioPreviewRef.current = new Audio();
    if (audioPlaying) { audioPreviewRef.current.pause(); setAudioPlaying(false); return; }
    audioPreviewRef.current.src = url;
    audioPreviewRef.current.onended = () => setAudioPlaying(false);
    audioPreviewRef.current.play().catch(() => {});
    setAudioPlaying(true);
  }

  // Shared audio section — appears at the bottom of every tab
  const audioSection = (
    <div className="rounded-lg border bg-background/35 p-3">
      <div className="mb-1 flex items-center gap-2">
        <Music className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-semibold">Splash audio</span>
        {content.splash_audio_url && <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-[10px] text-green-700">Added</Badge>}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Background music or narration that plays during the splash.</p>
      {content.splash_audio_url && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 rounded border bg-muted px-2 py-1">
            <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">{content.splash_audio_url}</span>
            <button type="button" className="shrink-0 rounded p-0.5 hover:bg-red-500/10 hover:text-red-500"
              onClick={() => { onChange({ splash_audio_url: "", splash_audio_enabled: false }); audioPreviewRef.current?.pause(); setAudioPlaying(false); }}>
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" type="button" onClick={() => toggleAudioPreview(content.splash_audio_url!)}>
              {audioPlaying ? <><Square className="h-3 w-3" /> Stop</> : <><Play className="h-3 w-3" /> Listen</>}
            </Button>
            <SplashPillToggle checked={content.splash_audio_enabled !== false} onToggle={(v) => onChange({ splash_audio_enabled: v })} labelOn="On" labelOff="Off" />
            <div className="flex items-center gap-1.5">
              {(content.splash_audio_volume ?? 0.8) < 0.05
                ? <VolumeX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <Volume2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <input type="range" min={0} max={1} step={0.05} value={content.splash_audio_volume ?? 0.8}
                onChange={(e) => onChange({ splash_audio_volume: parseFloat(e.target.value) })}
                className="h-1.5 w-20 cursor-pointer accent-primary" />
              <span className="w-7 text-[10px] text-muted-foreground">{Math.round((content.splash_audio_volume ?? 0.8) * 100)}%</span>
            </div>
          </div>
        </div>
      )}
      <Button size="sm" variant="outline" className="h-8 gap-2 text-xs" type="button" onClick={() => setAudioModalOpen(true)}>
        <Mic className="h-3.5 w-3.5" /> {content.splash_audio_url ? "Change audio" : "Add audio"}
      </Button>
    </div>
  );

  return (
    <>
      <SplashAudioModal
        open={audioModalOpen}
        onClose={() => setAudioModalOpen(false)}
        currentUrl={content.splash_audio_url || ""}
        onSave={(url) => onChange({ splash_audio_url: url, splash_audio_enabled: true })}
        uploadMedia={uploadMedia}
        uploadingMedia={uploadingMedia}
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><PlayCircle className="h-4 w-4" /> Splash page customizer</CardTitle>
          <CardDescription>Create a short intro before the visitor opens the business card.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Global controls — always visible */}
          <div className="grid gap-4 rounded-lg border bg-background/35 p-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Show splash before card</div>
              <SplashPillToggle checked={isEnabled} onToggle={(v) => onChange({ enabled: v })} labelOn="Enabled" labelOff="Disabled" />
            </div>
            <SelectField label="Transition to card" value={content.transition_effect || "fade"} values={SPLASH_TRANSITIONS} onChange={(v) => onChange({ transition_effect: v })} />
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Auto-dismiss timer</div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="mb-0.5 text-[10px] text-muted-foreground">Min</div>
                  <Input type="number" min={0} max={10} className="h-8 text-center text-sm" value={durMin}
                    onChange={(e) => onChange({ duration_seconds: Math.max(0, parseInt(e.target.value) || 0) * 60 + durSec })} />
                </div>
                <span className="mt-4 select-none text-sm font-bold text-muted-foreground">:</span>
                <div className="flex-1">
                  <div className="mb-0.5 text-[10px] text-muted-foreground">Sec</div>
                  <Input type="number" min={0} max={59} className="h-8 text-center text-sm" value={String(durSec).padStart(2, "0")}
                    onChange={(e) => onChange({ duration_seconds: durMin * 60 + Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) })} />
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {(["standard", "animation", "video", "slideshow"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setSplashTab(tab)}
                className={cn("rounded-md py-1.5 text-xs font-medium capitalize transition-colors",
                  splashTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >{tab}</button>
            ))}
          </div>

          {/* ── Standard tab ── */}
          {splashTab === "standard" && <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-background/35 px-3 py-2">
              <div>
                <div className="text-sm font-semibold">Text overlay</div>
                <div className="text-[11px] text-muted-foreground">Show title, subtitle, and buttons on the splash</div>
              </div>
              <SplashPillToggle checked={content.standard_enabled !== false} onToggle={(v) => onChange({ standard_enabled: v })} labelOn="On" labelOff="Off" />
            </div>
            <div className={cn("space-y-4", content.standard_enabled === false && "pointer-events-none opacity-40")}>
            <div className="grid gap-3">
              <Field label="Splash title" value={content.title || ""} onChange={(v) => onChange({ title: v })} />
              <Field label="Subtitle" value={content.subtitle || ""} onChange={(v) => onChange({ subtitle: v })} />
            </div>
            <div className="rounded-lg border bg-background/35 p-3">
              <div className="mb-3 text-sm font-semibold">Splash typography</div>
              <TypographyControls value={splashTypography} onChange={(patch) => onChange({ typography: { ...splashTypography, ...patch } })} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ColorField label="Background" value={content.background_color || "#07130b"} onChange={(v) => onChange({ background_color: v })} />
              <ColorField label="Accent" value={content.accent_color || "#a3ff12"} onChange={(v) => onChange({ accent_color: v })} />
              <ColorField label="Text" value={content.text_color || "#f7fff2"} onChange={(v) => onChange({ text_color: v })} />
            </div>
            <Field label="Background image URL" value={content.background_image_url || ""} onChange={(v) => onChange({ background_image_url: v })} />
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground">Buttons (max 2)</div>
              {[0, 1].map((index) => {
                const button = buttons[index] || { label: index === 0 ? "View card" : "Call me", action: index === 0 ? "open_card" as const : "call" as const };
                return (
                  <div key={index} className="grid gap-2 rounded-lg border bg-background/35 p-3 md:grid-cols-[1fr_160px_1fr]">
                    <Field label={`Button ${index + 1}`} value={button.label || ""} onChange={(v) => updateButton(index, { label: v })} />
                    <SelectField label="Action" value={button.action || "open_card"} values={["open_card", "call", "sms", "email", "url"]} onChange={(v) => updateButton(index, { action: v as OpenerButton["action"] })} />
                    <Field label="URL override" value={button.url || (button.action === "call" ? primaryPhone : "")} onChange={(v) => updateButton(index, { url: v })} />
                  </div>
                );
              })}

              {/* Button position + spacing */}
              <div className="rounded-lg border bg-background/35 p-3 space-y-3">
                <div className="text-xs font-semibold">Button position</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["top", "center", "bottom"] as const).map((pos) => (
                    <button key={pos} type="button"
                      onClick={() => onChange({ button_position: pos })}
                      className={cn("rounded-lg border py-2 text-xs font-medium capitalize transition-colors",
                        (content.button_position || "center") === pos
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background hover:border-primary/50")}
                    >
                      {pos === "top" ? "↑ Top" : pos === "center" ? "⊙ Center" : "↓ Bottom"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1.5 text-[10px] text-muted-foreground font-medium">Margin top (px)</div>
                    <Input type="number" min={0} max={200} className="h-8 text-sm"
                      value={content.button_margin_top ?? 32}
                      onChange={(e) => onChange({ button_margin_top: Math.max(0, parseInt(e.target.value) || 0) })} />
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] text-muted-foreground font-medium">Margin bottom (px)</div>
                    <Input type="number" min={0} max={200} className="h-8 text-sm"
                      value={content.button_margin_bottom ?? 0}
                      onChange={(e) => onChange({ button_margin_bottom: Math.max(0, parseInt(e.target.value) || 0) })} />
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] text-muted-foreground font-medium">Padding horizontal (px)</div>
                    <Input type="number" min={0} max={80} className="h-8 text-sm"
                      value={content.button_padding_x ?? 20}
                      onChange={(e) => onChange({ button_padding_x: Math.max(0, parseInt(e.target.value) || 0) })} />
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] text-muted-foreground font-medium">Padding vertical (px)</div>
                    <Input type="number" min={0} max={80} className="h-8 text-sm"
                      value={content.button_padding_y ?? 12}
                      onChange={(e) => onChange({ button_padding_y: Math.max(0, parseInt(e.target.value) || 0) })} />
                  </div>
                </div>
              </div>
            </div>
            </div> {/* end opacity wrapper */}
            {audioSection}
          </div>}

          {/* ── Animation tab ── */}
          {splashTab === "animation" && <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-background/35 px-3 py-2">
              <div>
                <div className="text-sm font-semibold">Animations</div>
                <div className="text-[11px] text-muted-foreground">Apply custom open and close animations to the splash</div>
              </div>
              <SplashPillToggle checked={content.animation_enabled === true} onToggle={(v) => onChange({ animation_enabled: v })} labelOn="On" labelOff="Off" />
            </div>
            <div className={cn("space-y-4", content.animation_enabled !== true && "pointer-events-none opacity-40")}>
            <div className="rounded-lg border bg-background/35 p-3">
              <div className="mb-1 text-sm font-semibold">Open animation</div>
              <p className="mb-3 text-xs text-muted-foreground">How the splash appears when first loaded.</p>
              <div className="grid grid-cols-3 gap-2">
                {OPEN_ANIMATIONS.map((anim) => (
                  <button key={anim} type="button" onClick={() => onChange({ open_animation: anim })}
                    className={cn("rounded-lg border px-2 py-2 text-[11px] font-medium capitalize transition-colors",
                      (content.open_animation || "fade_up") === anim ? "border-primary bg-primary/10 text-primary" : "border-input bg-background hover:border-primary/50")}
                  >{human(anim)}</button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-background/35 p-3">
              <div className="mb-1 text-sm font-semibold">Close / dismiss animation</div>
              <p className="mb-3 text-xs text-muted-foreground">How the splash exits when dismissed.</p>
              <div className="grid grid-cols-3 gap-2">
                {CLOSE_ANIMATIONS.map((anim) => (
                  <button key={anim} type="button" onClick={() => onChange({ close_animation: anim })}
                    className={cn("rounded-lg border px-2 py-2 text-[11px] font-medium capitalize transition-colors",
                      (content.close_animation || "fade_out") === anim ? "border-primary bg-primary/10 text-primary" : "border-input bg-background hover:border-primary/50")}
                  >{human(anim)}</button>
                ))}
              </div>
            </div>
            {uploadMedia && (
              <MediaUploadField
                label="Background image"
                mediaType="splash-bg-image"
                accept="image/*"
                value={content.background_image_url || ""}
                uploading={uploadingMedia ?? null}
                onUpload={uploadMedia}
                onUploaded={(url) => onChange({ background_image_url: url })}
              />
            )}
            {uploadMedia && (
              <MediaUploadField
                label="Background video"
                mediaType="splash-bg-video"
                accept="video/*"
                value={content.background_video_url?.startsWith("/animations/") ? "" : (content.background_video_url || "")}
                uploading={uploadingMedia ?? null}
                onUpload={uploadMedia}
                onUploaded={(url) => onChange({ background_video_url: url })}
              />
            )}
            </div> {/* end opacity wrapper */}
            {audioSection}
          </div>}

          {/* ── Video tab ── */}
          {splashTab === "video" && <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-background/35 px-3 py-2">
              <div>
                <div className="text-sm font-semibold">Video background</div>
                <div className="text-[11px] text-muted-foreground">Play a video behind the splash screen</div>
              </div>
              <SplashPillToggle checked={content.video_enabled === true} onToggle={(v) => onChange({ video_enabled: v })} labelOn="On" labelOff="Off" />
            </div>
            <div className={cn("space-y-4", content.video_enabled !== true && "pointer-events-none opacity-40")}>
            <p className="text-xs text-muted-foreground">A full-screen video shown on the splash before the card reveals. MP4 recommended.</p>

            {/* Preset animations */}
            <div className="rounded-lg border bg-background/35 p-3">
              <div className="mb-1 text-sm font-semibold">Preset animations</div>
              <p className="mb-3 text-xs text-muted-foreground">Select a built-in branded animation or upload your own below.</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: "Dark mode", url: "/animations/jw-card-animation-dark.mp4" },
                  { label: "Light mode", url: "/animations/jw-card-animation-light.mp4" },
                ] as const).map(({ label, url }) => (
                  <button key={url} type="button"
                    onClick={() => onChange({ background_video_url: url })}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border-2 transition-colors",
                      content.background_video_url === url
                        ? "border-primary bg-primary/10"
                        : "border-input bg-background hover:border-primary/50"
                    )}
                  >
                    <video className="h-20 w-full object-cover opacity-80 group-hover:opacity-100" src={url} muted playsInline preload="metadata" />
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 py-1 text-center text-[11px] font-semibold",
                      content.background_video_url === url ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground"
                    )}>{label}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 space-y-1 rounded-md border bg-muted/40 px-2 py-1.5">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Direct URLs (for external use)</p>
                {[
                  { label: "Dark", url: "/animations/jw-card-animation-dark.mp4" },
                  { label: "Light", url: "/animations/jw-card-animation-light.mp4" },
                ].map(({ label, url }) => (
                  <div key={url} className="flex items-center gap-1.5">
                    <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{label}</span>
                    <code className="flex-1 truncate rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{url}</code>
                    <button type="button" className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => navigator.clipboard?.writeText(url)}>Copy</button>
                  </div>
                ))}
              </div>
            </div>

            {uploadMedia && (
              <MediaUploadField
                label="Custom splash video"
                mediaType="splash-video"
                accept="video/*"
                value={content.background_video_url?.startsWith("/animations/") ? "" : (content.background_video_url || "")}
                uploading={uploadingMedia ?? null}
                onUpload={uploadMedia}
                onUploaded={(url) => onChange({ background_video_url: url })}
              />
            )}

            {/* Video play timer */}
            <div className="rounded-lg border bg-background/35 p-3">
              <div className="mb-1 text-sm font-semibold">Video play timer</div>
              <p className="mb-3 text-xs text-muted-foreground">How long the video plays before transitioning to the card. Set 0:00 to rely on the auto-dismiss timer above.</p>
              <div className="flex items-center gap-2">
                <div className="w-20">
                  <div className="mb-0.5 text-[10px] text-muted-foreground">Min</div>
                  <Input type="number" min={0} max={10} className="h-8 text-center text-sm" value={vidMin}
                    onChange={(e) => onChange({ video_play_seconds: Math.max(0, parseInt(e.target.value) || 0) * 60 + vidSec })} />
                </div>
                <span className="mt-4 select-none text-sm font-bold text-muted-foreground">:</span>
                <div className="w-20">
                  <div className="mb-0.5 text-[10px] text-muted-foreground">Sec</div>
                  <Input type="number" min={0} max={59} className="h-8 text-center text-sm" value={String(vidSec).padStart(2, "0")}
                    onChange={(e) => onChange({ video_play_seconds: vidMin * 60 + Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) })} />
                </div>
                <span className="mt-3 text-[11px] text-muted-foreground italic">0:00 = auto</span>
              </div>
            </div>

            {/* Video playback controls */}
            <div className="grid gap-4 rounded-lg border bg-background/35 p-3 sm:grid-cols-3">
              <SelectField label="Video fit" value={content.video_fit || "cover"} values={["cover", "contain"]} onChange={(v) => onChange({ video_fit: v as "cover" | "contain" })} />
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Loop video</div>
                <SplashPillToggle checked={content.video_loop !== false} onToggle={(v) => onChange({ video_loop: v })} labelOn="Loop on" labelOff="No loop" />
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Video audio</div>
                <SplashPillToggle checked={content.video_muted !== false} onToggle={(v) => onChange({ video_muted: v })} labelOn="Muted" labelOff="Sound on" />
              </div>
            </div>

            {/* Video volume — only shown when not muted */}
            {content.video_muted === false && (
              <div className="flex items-center gap-3 rounded-lg border bg-background/35 p-3">
                {(content.video_volume ?? 1) < 0.05
                  ? <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="flex-1">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Video volume</div>
                  <input type="range" min={0} max={1} step={0.05} value={content.video_volume ?? 1}
                    onChange={(e) => onChange({ video_volume: parseFloat(e.target.value) })}
                    className="h-1.5 w-full cursor-pointer accent-primary" />
                </div>
                <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{Math.round((content.video_volume ?? 1) * 100)}%</span>
              </div>
            )}
            </div> {/* end opacity wrapper */}
            {audioSection}
          </div>}

          {/* ── Slideshow tab ── */}
          {splashTab === "slideshow" && <div className="space-y-4">
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <Layers className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-40" />
              <div className="text-sm font-semibold">Multi-slide splash cards</div>
              <p className="mt-1.5 text-xs text-muted-foreground">Build multi-page slides with individual titles, media, and call-to-action buttons using the <strong>Slideshow</strong> panel in the left sidebar. Each slide inherits the transition effect set above.</p>
            </div>
            {audioSection}
          </div>}

        </CardContent>
      </Card>
    </>
  );
}

function LivePreview({ card, publicUrl, mode, onModeChange, themeMode, onThemeModeChange, zoom, onZoomChange, canvas }: { card: DigitalCard; publicUrl: string; mode: PreviewMode; onModeChange: (mode: PreviewMode) => void; themeMode: CardThemeMode; onThemeModeChange: (mode: CardThemeMode) => void; zoom: number; onZoomChange: (zoom: number) => void; canvas?: CanvasInteractive }) {
  const modeInfo = previewModes.find((item) => item.value === mode) || previewModes[0];
  const previewCard = applyTheme(card, themeMode);
  const backgroundImage = previewCard.background_image_url ? `linear-gradient(rgba(0,0,0,.42), rgba(0,0,0,.42)), url(${previewCard.background_image_url})` : undefined;
  const allSections = normalizeSections(previewCard.digital_card_sections);
  const selectedSection = canvas && canvas.selectedIndex != null ? (allSections[canvas.selectedIndex] ?? null) : null;

  return (
    <aside className="min-w-0 bg-background/30 p-4 2xl:sticky 2xl:top-16 2xl:self-start">
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div><CardTitle className="text-base">Live responsive preview</CardTitle><CardDescription>Switch between mobile, tablet, and desktop while editing.</CardDescription></div>
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
                {(["dark", "light"] as CardThemeMode[]).map((value) => (
                  <button key={value} type="button" className={cn("grid h-7 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground", themeMode === value && "bg-background text-foreground shadow-sm")} onClick={() => onThemeModeChange(value)} aria-label={`Preview ${value} mode`}>
                    {value === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
              <Badge variant="outline">{modeInfo.label}</Badge>
            </div>
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
          <div className="flex items-start gap-2">
            {/* Canvas + phone frame */}
            <div className="relative min-w-0 flex-1 overflow-auto rounded-xl border bg-secondary/25 p-4">
              <div className="mx-auto origin-top overflow-hidden rounded-[1.75rem] border border-white/15 shadow-2xl transition-all" style={{ width: modeInfo.width, maxWidth: "100%", minHeight: mode === "mobile" ? 640 : 720, background: previewCard.background_color, color: previewCard.text_color, backgroundImage, backgroundSize: "cover", backgroundPosition: "center", transform: `scale(${zoom / 100})` }}>
                <div className="min-h-[640px] bg-black/20 p-5 backdrop-blur-[1px] md:p-8">
                  {canvas ? <CanvasCardSections card={previewCard} publicUrl={publicUrl} mode={mode} canvas={canvas} /> : <CardSections card={previewCard} publicUrl={publicUrl} mode={mode} />}
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
            {/* Section FAB — side panel, appears when section is selected */}
            <div className={cn("shrink-0 overflow-hidden rounded-xl transition-[width] duration-200", selectedSection ? "w-64" : "w-0")}>
              {selectedSection && (
                <SectionFAB key={canvas!.selectedIndex} section={selectedSection} index={canvas!.selectedIndex!} canvas={canvas!} card={previewCard} />
              )}
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
    textAlign: section.text_align || undefined,
    background: section.section_background || undefined,
    color: section.section_color || undefined,
    width: section.section_width ? `${section.section_width}%` : undefined,
    minHeight: section.section_min_height || undefined,
    fontSize: section.section_font_size || undefined,
    fontWeight: section.section_font_weight || undefined,
  };
}

function PreviewSection({ section, card, publicUrl, visibleLinks }: { section: DigitalCardSection; card: DigitalCard; publicUrl: string; visibleLinks: DigitalCardLink[] }) {
  if (section.section_type === "profile_header") {
    const textStyle = typographyStyle(typographyFrom(card.media_settings?.content_typography, card.text_color));
    const nameSize = Number(typographyFrom(card.media_settings?.content_typography, card.text_color).font_size || 18);
    const imageStyle = imageStyleFrom(card.media_settings?.profile_image_style);
    const imageClasses = cn("mx-auto h-24 w-24 object-cover shadow-xl transition-transform transition-shadow duration-200", imageShapeClass(imageStyle), imageHoverClass(imageStyle));
    const fallbackImageClasses = cn("mx-auto grid h-24 w-24 place-items-center bg-white/10 text-2xl font-semibold shadow-xl transition-transform transition-shadow duration-200", imageShapeClass(imageStyle), imageHoverClass(imageStyle));
    return (
      <div>
        <div className="flex items-center justify-between gap-2">
          {card.logo_url ? <img className="max-h-10 max-w-[140px] object-contain" src={card.logo_url} alt="" /> : <div className="text-xs font-semibold opacity-70">controlp.io card</div>}
        </div>
        <div className="mt-8" style={textStyle}>
          {card.profile_photo_url ? <img className={imageClasses} style={imageBorderStyle(imageStyle)} src={card.profile_photo_url} alt="" /> : <div className={fallbackImageClasses} style={imageBorderStyle(imageStyle)}>{(card.display_name || card.card_name || "CP").slice(0, 2).toUpperCase()}</div>}
          <div className="mt-4 leading-tight" style={{ fontSize: nameSize, fontWeight: textStyle.fontWeight }}>{card.display_name || card.card_name || "Your Name"}</div>
          <div className="mt-1 opacity-75" style={{ fontSize: Math.max(11, nameSize * 0.58) }}>{[card.job_title, card.company_name].filter(Boolean).join(" - ") || "Title - Company"}</div>
          {card.bio ? <p className="mt-4 opacity-85" style={{ fontSize: Math.max(12, nameSize * 0.72), lineHeight: textStyle.lineHeight }}>{card.bio}</p> : <p className="mt-4 opacity-50" style={{ fontSize: Math.max(12, nameSize * 0.72), lineHeight: textStyle.lineHeight }}>Short bio and introduction will appear here.</p>}
        </div>
      </div>
    );
  }
  if (section.section_type === "profile_logo") {
    const logoPos = (card.media_settings?.logo_position as string | undefined) || "left";
    const logoJustify = logoPos === "center" ? "justify-center" : logoPos === "right" ? "justify-end" : "justify-start";
    return (
      <div className={cn("flex items-center", logoJustify)}>
        {card.logo_url ? <img className="max-h-10 max-w-[140px] object-contain" src={card.logo_url} alt="" /> : <div className="text-xs font-semibold opacity-70">controlp.io card</div>}
      </div>
    );
  }
  if (section.section_type === "profile_photo") {
    const imageStyle = imageStyleFrom(card.media_settings?.profile_image_style);
    const pos = (imageStyle as { position?: string }).position || "center";
    const imgJustify = pos === "left" ? "justify-start" : pos === "right" ? "justify-end" : "justify-center";
    const imageClasses = cn("h-24 w-24 object-cover shadow-xl transition-transform transition-shadow duration-200", imageShapeClass(imageStyle), imageHoverClass(imageStyle));
    const fallbackClasses = cn("grid h-24 w-24 place-items-center bg-white/10 text-2xl font-semibold shadow-xl", imageShapeClass(imageStyle));
    return (
      <div className={cn("flex", imgJustify)}>
        {card.profile_photo_url ? <img className={imageClasses} style={imageBorderStyle(imageStyle)} src={card.profile_photo_url} alt="" /> : <div className={fallbackClasses} style={imageBorderStyle(imageStyle)}>{(card.display_name || card.card_name || "CP").slice(0, 2).toUpperCase()}</div>}
      </div>
    );
  }
  if (section.section_type === "profile_name") {
    const textStyle = typographyStyle(typographyFrom(card.media_settings?.content_typography, card.text_color));
    const nameSize = Number(typographyFrom(card.media_settings?.content_typography, card.text_color).font_size || 18);
    return (
      <div style={textStyle}>
        <div className="leading-tight" style={{ fontSize: nameSize, fontWeight: textStyle.fontWeight }}>{card.display_name || card.card_name || "Your Name"}</div>
        <div className="mt-1 opacity-75" style={{ fontSize: Math.max(11, nameSize * 0.58) }}>{[card.job_title, card.company_name].filter(Boolean).join(" - ") || "Title - Company"}</div>
      </div>
    );
  }
  if (section.section_type === "profile_bio") {
    const textStyle = typographyStyle(typographyFrom(card.media_settings?.content_typography, card.text_color));
    const nameSize = Number(typographyFrom(card.media_settings?.content_typography, card.text_color).font_size || 18);
    return (
      <div style={textStyle}>
        {card.bio ? <p style={{ fontSize: Math.max(12, nameSize * 0.72), lineHeight: textStyle.lineHeight }}>{card.bio}</p> : <p className="opacity-50" style={{ fontSize: Math.max(12, nameSize * 0.72), lineHeight: textStyle.lineHeight }}>Short bio and introduction will appear here.</p>}
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
    const qrTarget = card.qr_settings?.url?.trim() || publicUrl;
    return (
      <div className="grid gap-3 md:grid-cols-[120px_1fr] md:items-center">
        <img className="h-[120px] w-[120px] rounded-lg border bg-white p-2" src={qrUrl(publicUrl, card)} alt="QR code preview" />
        <div className="rounded-xl border border-white/10 bg-white/10 p-3 text-[10px] opacity-70">{qrTarget}</div>
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

function SortableSection({ section, index, canvas, card, publicUrl, visibleLinks }: { section: DigitalCardSection; index: number; canvas: CanvasInteractive; card: DigitalCard; publicUrl: string; visibleLinks: DigitalCardLink[] }) {
  const id = sectionKey(section, index);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const isSelected = canvas.selectedIndex === index;
  return (
    <div
      ref={setNodeRef}
      style={{ ...sectionStyle(section), transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn("group relative cursor-pointer rounded-lg transition-all duration-150", isSelected && "ring-2 ring-primary ring-offset-1", isDragging && "z-10 shadow-xl")}
      onClick={(e) => { e.stopPropagation(); canvas.onSelect(isSelected ? null : index); }}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn("absolute right-0 top-0 z-10 cursor-grab rounded-bl-lg bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-80 active:cursor-grabbing", isSelected && "opacity-80")}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5 text-white" />
      </div>
      <PreviewSection section={section} card={card} publicUrl={publicUrl} visibleLinks={visibleLinks} />
    </div>
  );
}

function CanvasCardSections({ card, publicUrl, mode, canvas }: { card: DigitalCard; publicUrl: string; mode: PreviewMode; canvas: CanvasInteractive }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );
  const allSections = normalizeSections(card.digital_card_sections);
  const items = allSections
    .map((section, idx) => ({ section, idx }))
    .filter(({ section }) => {
      const isOpener = section.section_type === "gallery" && (section.content?.digital_product === "opener" || section.label.toLowerCase().includes("opener"));
      return section.is_visible && !isOpener;
    });
  const visibleLinks = (card.digital_card_links || []).filter((link) => link.is_visible !== false && link.label && link.url);
  const ids = items.map(({ section, idx }) => sectionKey(section, idx));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromItem = items[ids.indexOf(String(active.id))];
    const toItem = items[ids.indexOf(String(over.id))];
    if (fromItem !== undefined && toItem !== undefined) canvas.onReorder(fromItem.idx, toItem.idx);
  }

  return (
    <div className={cn(mode !== "mobile" && "grid gap-x-8 md:grid-cols-[1fr_1.1fr]")} onClick={() => canvas.onSelect(null)}>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map(({ section, idx }) => (
            <SortableSection key={sectionKey(section, idx)} section={section} index={idx} canvas={canvas} card={card} publicUrl={publicUrl} visibleLinks={visibleLinks} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

type FabTab = "align" | "spacing" | "colors" | "size" | "font" | "links" | "actions";

function SectionFAB({ section, index, canvas }: { section: DigitalCardSection; index: number; canvas: CanvasInteractive; card: DigitalCard }) {
  const [activeTab, setActiveTab] = useState<FabTab>("align");
  const fabTabs: { key: FabTab; label: string }[] = [
    { key: "align", label: "Align" },
    { key: "spacing", label: "Spacing" },
    { key: "colors", label: "Colors" },
    { key: "size", label: "Size" },
    { key: "font", label: "Font" },
    { key: "links", label: "Links" },
    { key: "actions", label: "Actions" },
  ];
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">Section</div>
          <div className="truncate text-xs font-semibold">{section.label}</div>
        </div>
        <button type="button" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => canvas.onSelect(null)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Tab grid — 4 + 3 layout */}
      <div className="shrink-0 grid grid-cols-4 border-b">
        {fabTabs.slice(0, 4).map((tab) => (
          <button key={tab.key} type="button"
            className={cn("border-r py-1.5 text-[10px] font-medium transition-colors last:border-r-0",
              activeTab === tab.key ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
            onClick={() => setActiveTab(tab.key)}
          >{tab.label}</button>
        ))}
      </div>
      <div className="shrink-0 grid grid-cols-3 border-b">
        {fabTabs.slice(4).map((tab) => (
          <button key={tab.key} type="button"
            className={cn("border-r py-1.5 text-[10px] font-medium transition-colors last:border-r-0",
              activeTab === tab.key ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
            onClick={() => setActiveTab(tab.key)}
          >{tab.label}</button>
        ))}
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "align" && (
          <div className="space-y-3">
            <div className="text-[10px] text-muted-foreground">Text alignment</div>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((val) => (
                <button key={val} type="button"
                  className={cn("flex-1 rounded border py-2 text-[11px] font-medium capitalize transition-colors",
                    (section.text_align || "left") === val ? "border-primary bg-primary/10 text-primary" : "border-input bg-transparent text-muted-foreground hover:text-foreground")}
                  onClick={() => canvas.onUpdate(index, { text_align: val })}
                >{val}</button>
              ))}
            </div>
          </div>
        )}
        {activeTab === "spacing" && (
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">Margin (px)</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["margin_top", "margin_right", "margin_bottom", "margin_left"] as const).map((field) => (
                  <div key={field}>
                    <div className="mb-0.5 text-[9px] text-muted-foreground capitalize">{field.replace("margin_", "")}</div>
                    <input type="number" min={0} max={200} value={section[field]}
                      className="w-full rounded border border-input bg-transparent px-2 py-1 text-center text-[11px]"
                      onChange={(e) => canvas.onUpdate(index, { [field]: Number(e.target.value) } as Partial<DigitalCardSection>)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">Padding (px)</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["padding_top", "padding_right", "padding_bottom", "padding_left"] as const).map((field) => (
                  <div key={field}>
                    <div className="mb-0.5 text-[9px] text-muted-foreground capitalize">{field.replace("padding_", "")}</div>
                    <input type="number" min={0} max={200} value={section[field]}
                      className="w-full rounded border border-input bg-transparent px-2 py-1 text-center text-[11px]"
                      onChange={(e) => canvas.onUpdate(index, { [field]: Number(e.target.value) } as Partial<DigitalCardSection>)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === "colors" && (
          <div className="space-y-2">
            <ColorField label="Section background" value={section.section_background || ""} onChange={(val) => canvas.onUpdate(index, { section_background: val || undefined })} />
            <ColorField label="Section text color" value={section.section_color || ""} onChange={(val) => canvas.onUpdate(index, { section_color: val || undefined })} />
          </div>
        )}
        {activeTab === "size" && (
          <div className="space-y-2">
            <div>
              <div className="mb-1 text-[10px] text-muted-foreground">Width (%)</div>
              <input type="number" min={10} max={100} value={section.section_width ?? 100}
                className="w-full rounded border border-input bg-transparent px-2 py-1.5 text-[11px]"
                onChange={(e) => canvas.onUpdate(index, { section_width: Number(e.target.value) })}
              />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-muted-foreground">Min height (px)</div>
              <input type="number" min={0} max={600} value={section.section_min_height ?? 0}
                className="w-full rounded border border-input bg-transparent px-2 py-1.5 text-[11px]"
                onChange={(e) => canvas.onUpdate(index, { section_min_height: Number(e.target.value) || undefined })}
              />
            </div>
          </div>
        )}
        {activeTab === "font" && (
          <div className="space-y-2">
            <div>
              <div className="mb-1 text-[10px] text-muted-foreground">Font size (px)</div>
              <input type="number" min={8} max={72} value={section.section_font_size ?? ""}
                placeholder="Inherited"
                className="w-full rounded border border-input bg-transparent px-2 py-1.5 text-[11px]"
                onChange={(e) => canvas.onUpdate(index, { section_font_size: Number(e.target.value) || undefined })}
              />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-muted-foreground">Font weight</div>
              <Select value={String(section.section_font_weight ?? "")} onValueChange={(val) => canvas.onUpdate(index, { section_font_weight: Number(val) || undefined })}>
                <SelectTrigger className="text-[11px]"><SelectValue placeholder="Inherited" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Inherited</SelectItem>
                  {["300", "400", "500", "600", "700", "800", "900"].map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {activeTab === "links" && (
          <div className="py-4 text-center">
            <div className="text-xs font-medium">Card links</div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Open the <strong>Links</strong> tab in the left sidebar to add, edit, or reorder links for this card.</p>
          </div>
        )}
        {activeTab === "actions" && (
          <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" className="w-full justify-start text-[11px]" onClick={() => canvas.onDuplicate(index)}>
              <Copy className="mr-2 h-3.5 w-3.5" />Duplicate section
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-full justify-start text-[11px]" onClick={() => canvas.onToggleVisible(index)}>
              {section.is_visible ? <><EyeOff className="mr-2 h-3.5 w-3.5" />Hide section</> : <><Eye className="mr-2 h-3.5 w-3.5" />Show section</>}
            </Button>
            <Button type="button" variant="destructive" size="sm" className="w-full justify-start text-[11px]" onClick={() => canvas.onRemove(index)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />Delete section
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewPill({ label, accent }: { label: string; accent: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 px-2 py-2 font-medium" style={{ color: accent }}>{label}</div>;
}

function PreviewButton({ label, accent, icon, muted }: { label: string; accent: string; icon?: string; muted?: boolean }) {
  return <div className={cn("flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold", muted && "opacity-60")}><span className="flex items-center gap-2"><LinkIcon className="h-3.5 w-3.5" />{label}</span><span style={{ color: accent }}>{icon ? human(icon) : "Open"}</span></div>;
}

function TypographyControls({ value, onChange }: { value: TypographySettings; onChange: (patch: Partial<TypographySettings>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="Font" value={value.font_family || "Inter"} values={googleFontOptions} onChange={(font) => onChange({ font_family: font })} />
        <SelectField label="Alignment" value={value.alignment || "center"} values={textAlignments} onChange={(alignment) => onChange({ alignment: alignment as TypographySettings["alignment"] })} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <NumberField label="Size" value={Number(value.font_size || 18)} onChange={(fontSize) => onChange({ font_size: fontSize })} />
        <SelectField label="Weight" value={String(value.font_weight || 600)} values={fontWeights} onChange={(weight) => onChange({ font_weight: Number(weight) })} />
        <NumberField label="Letter spacing" value={Number(value.letter_spacing || 0)} onChange={(spacing) => onChange({ letter_spacing: spacing })} />
        <NumberField label="Line height" value={Number(value.line_height || 1.35)} onChange={(height) => onChange({ line_height: height || 1 })} />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <ColorField label="Text color" value={value.color || "#f7fff2"} onChange={(color) => onChange({ color })} />
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant={Number(value.font_weight || 600) >= 700 ? "default" : "outline"} onClick={() => onChange({ font_weight: Number(value.font_weight || 600) >= 700 ? 400 : 700 })}>B</Button>
          <Button type="button" variant={value.italic ? "default" : "outline"} className="italic" onClick={() => onChange({ italic: !value.italic })}>I</Button>
          <Button type="button" variant={value.underline ? "default" : "outline"} className="underline" onClick={() => onChange({ underline: !value.underline })}>U</Button>
        </div>
      </div>
    </div>
  );
}

function ImageStyleControls({ value, onChange }: { value: ImageStyleSettings; onChange: (patch: Partial<ImageStyleSettings>) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SelectField label="Image shape" value={value.shape || "circle"} values={imageShapes} onChange={(shape) => onChange({ shape: shape as ImageStyleSettings["shape"] })} />
      <SelectField label="Outline" value={value.outline || "medium"} values={imageOutlines} onChange={(outline) => onChange({ outline: outline as ImageStyleSettings["outline"] })} />
      <ColorField label="Outline color" value={value.outline_color || "#ffffff"} onChange={(outlineColor) => onChange({ outline_color: outlineColor })} />
      <SelectField label="Hover effect" value={value.hover_effect || "none"} values={imageHoverEffects} onChange={(hoverEffect) => onChange({ hover_effect: hoverEffect as ImageStyleSettings["hover_effect"] })} />
    </div>
  );
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{human(item)}</SelectItem>)}</SelectContent></Select></div>;
}

function MediaUploadField({ label, mediaType, accept, value, uploading, onUpload, onUploaded, position, onPositionChange }: { label: string; mediaType: string; accept: string; value: string; uploading: string | null; onUpload: (file: File, mediaType: string, onUploaded: (url: string) => void) => void; onUploaded: (url: string) => void; position?: "left" | "center" | "right"; onPositionChange?: (pos: "left" | "center" | "right") => void }) {
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const isVideo = accept.includes("video");
  const isUploading = uploading === mediaType;
  const fieldId = `media-${mediaType}`;
  const frontId = `${fieldId}-front`;
  const rearId = `${fieldId}-rear`;
  const handleFile = (file?: File) => { if (file) onUpload(file, mediaType, onUploaded); };
  // video/* is unreliable on Windows — explicit MIME types + extensions ensure the picker shows MP4/MOV/etc.
  const inputAccept = isVideo
    ? "video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,.mp4,.mov,.webm,.avi,.mkv,.m4v"
    : accept;
  const handleUrlSave = () => {
    if (urlDraft.trim()) onUploaded(urlDraft.trim());
    setUrlDraft("");
    setUrlModalOpen(false);
  };
  const mediaBtnCls = cn(
    "flex h-7 w-full select-none items-center justify-center gap-1 rounded-md border border-input bg-transparent px-2 text-xs font-medium transition-colors",
    "hover:bg-accent hover:text-accent-foreground",
    isUploading ? "pointer-events-none opacity-50" : "cursor-pointer"
  );

  return (
    <>
      <Dialog open={urlModalOpen} onOpenChange={setUrlModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add media URL</DialogTitle>
            <DialogDescription>Paste a direct link to your {isVideo ? "video" : "image"}.</DialogDescription>
          </DialogHeader>
          <Input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://..."
            onKeyDown={(e) => e.key === "Enter" && handleUrlSave()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUrlModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUrlSave} disabled={!urlDraft.trim()}>Save URL</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="w-full min-w-0 overflow-hidden rounded-lg border bg-background/35 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{label}</div>
            <div className="text-[11px] text-muted-foreground">{isVideo ? "Upload or record video" : "Upload or take a photo"}</div>
          </div>
          {value ? (
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant="outline" className="text-[10px]">Added</Badge>
              <button type="button" onClick={() => onUploaded("")} className="text-muted-foreground transition-colors hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : <Badge variant="secondary" className="shrink-0 text-[10px]">Empty</Badge>}
        </div>
        {value && (
          <div className="mb-3 w-full overflow-hidden rounded-lg border bg-black/5">
            {isVideo
              ? <video className="h-28 w-full object-cover" src={value} controls muted />
              : <img className="h-28 w-full object-contain" src={value} alt={`${label} preview`} />}
          </div>
        )}
        <div className="grid w-full grid-cols-2 gap-1.5">
          <label htmlFor={fieldId} className={mediaBtnCls}>
            <Upload className="h-3 w-3 shrink-0" />{isUploading ? "Uploading…" : "Upload"}
          </label>
          <button type="button" disabled={isUploading} className={mediaBtnCls} onClick={() => { setUrlDraft(""); setUrlModalOpen(true); }}>
            <LinkIcon className="h-3 w-3 shrink-0" />URL
          </button>
        </div>
        <div className="mt-1.5 grid w-full grid-cols-2 gap-1.5">
          <label htmlFor={frontId} className={mediaBtnCls}>
            <Camera className="h-3 w-3 shrink-0" />Front cam
          </label>
          <label htmlFor={rearId} className={mediaBtnCls}>
            <Camera className="h-3 w-3 shrink-0" />Rear cam
          </label>
        </div>
        <input id={fieldId} type="file" accept={inputAccept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <input id={frontId} type="file" accept={inputAccept} capture="user" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <input id={rearId} type="file" accept={inputAccept} capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        {value && <div className="mt-2 w-full min-w-0 truncate rounded-md bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{value}</div>}
        {onPositionChange && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Position</span>
            {(["left", "center", "right"] as const).map((pos) => (
              <button key={pos} type="button"
                onClick={() => onPositionChange(pos)}
                className={cn("flex-1 rounded border py-0.5 text-[10px] font-medium capitalize transition-colors",
                  position === pos ? "border-primary bg-primary/10 text-primary" : "border-input bg-transparent text-muted-foreground hover:text-foreground")}
              >{pos}</button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div><Input value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value || "") ? value.toLowerCase() : "#000000";
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

// ─── Embed panel ──────────────────────────────────────────────────────────────

type EmbedPreset = "mobile" | "compact" | "large";
const embedPresets: Record<EmbedPreset, { width: number; height: number; label: string }> = {
  mobile:  { width: 390, height: 700, label: "Mobile (390 × 700)" },
  compact: { width: 360, height: 640, label: "Compact (360 × 640)" },
  large:   { width: 430, height: 800, label: "Large (430 × 800)" },
};

function EmbedPanel({ publicUrl, isPublished }: { publicUrl: string; isPublished: boolean }) {
  const [preset, setPreset] = useState<EmbedPreset>("mobile");
  const [copied, setCopied] = useState(false);
  const embedUrl = `${publicUrl}?embed=1`;
  const { width, height } = embedPresets[preset];
  const snippet = `<iframe\n  src="${embedUrl}"\n  width="${width}"\n  height="${height}"\n  frameborder="0"\n  style="border-radius:16px;overflow:hidden;border:none;"\n  title="Digital Business Card"\n  loading="lazy"\n></iframe>`;

  async function copy() {
    await navigator.clipboard.writeText(snippet).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Code2 className="h-4 w-4" /> Embed on your website</CardTitle>
          <CardDescription>Copy this snippet and paste it into any page on your website. Your digital card will render exactly as it appears on ControlP.io.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Size preset</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(embedPresets) as EmbedPreset[]).map((p) => (
                <Button key={p} variant={preset === p ? "default" : "outline"} size="sm" onClick={() => setPreset(p)}>
                  {embedPresets[p].label}
                </Button>
              ))}
            </div>
          </div>

          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border bg-background/50 p-3 font-mono text-xs leading-relaxed">{snippet}</pre>
            <Button size="sm" className="absolute right-2 top-2" onClick={copy}>
              {copied ? <><Check className="mr-1.5 h-3.5 w-3.5" />Copied!</> : <><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</>}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Adjust <code className="rounded bg-secondary px-1 py-0.5">width</code> and <code className="rounded bg-secondary px-1 py-0.5">height</code> attributes to fit your layout. The card is fully responsive inside the iframe.
          </p>

          {!isPublished && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
              Your card is not published yet. Visitors will see a &ldquo;card not found&rdquo; page until you set the status to <strong>Published</strong>.
            </div>
          )}
        </CardContent>
      </Card>

      {isPublished && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Live preview</CardTitle>
            <CardDescription>How your card looks when embedded on an external site.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden rounded-b-xl border-t bg-muted/30" style={{ height: Math.min(height, 520) }}>
              <iframe
                src={embedUrl}
                width="100%"
                height={Math.min(height, 520)}
                style={{ border: "none", display: "block" }}
                title="Embed preview"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LockedEmbedPanel({ onUnlock }: { onUnlock: () => void }) {
  const mockSnippet = `<iframe\n  src="https://my.controlp.io/c/your-card?embed=1"\n  width="390"\n  height="700"\n  frameborder="0"\n  style="border-radius:16px;overflow:hidden;border:none;"\n  title="Digital Business Card"\n  loading="lazy"\n></iframe>`;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Code2 className="h-4 w-4" /> Embed on your website</CardTitle>
        <CardDescription>Add your digital business card directly to any page on your website.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <pre className="pointer-events-none select-none overflow-x-auto rounded-lg border bg-background/50 p-3 font-mono text-xs leading-relaxed blur-[3px]">{mockSnippet}</pre>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/80 backdrop-blur-[2px]">
            <div className="text-center">
              <div className="mb-1 font-semibold">Pro feature</div>
              <p className="mb-4 text-xs text-muted-foreground">Upgrade to embed your card on any website</p>
              <Button size="sm" onClick={onUnlock} className="bg-[#a3ff12] text-[#07130b] hover:bg-[#8fe000]">
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const proFeatures = [
    "Embed your card on any website",
    "Advanced analytics and lead tracking",
    "Custom domain for your card URL",
    "Priority support and early access to new features",
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upgrade Your Account</h2>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Website embed is a Pro feature. Upgrade to unlock embed codes, advanced analytics, custom domains, and more.
        </p>
        <div className="mb-5 space-y-2 rounded-xl border border-[#a3ff12]/30 bg-[#a3ff12]/5 p-4">
          {proFeatures.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 shrink-0 text-[#72b000] dark:text-[#a3ff12]" />
              <span>{f}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Button className="w-full bg-[#a3ff12] text-[#07130b] hover:bg-[#8fe000]" asChild>
            <a href="/pricing">Get Started</a>
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>Maybe Later</Button>
        </div>
      </div>
    </div>
  );
}
