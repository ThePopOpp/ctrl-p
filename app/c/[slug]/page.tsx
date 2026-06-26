import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { ExternalLink, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { getServerSupabaseConfig } from "@/lib/admin/server-auth";
import { cn } from "@/lib/utils";
import { PublicCardActions, PublicThemeToggle, PublicTrackedLinks } from "./public-card-actions";
import { PublicOpener } from "./public-opener";

type PublicCardLink = {
  id: string;
  label: string;
  url: string;
  link_type: string;
  display_order: number;
  is_visible: boolean;
  open_in_new_tab: boolean;
};

type PublicCardSection = {
  id: string;
  section_type: string;
  label: string;
  content?: Record<string, unknown> | null;
  display_order: number;
  is_visible: boolean;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  padding_top: number;
  padding_right: number;
  padding_bottom: number;
  padding_left: number;
};

type OpenerButton = {
  label?: string;
  action?: "open_card" | "call" | "sms" | "email" | "url";
  url?: string;
};
type PublicLeadField = { key: string; label: string; enabled: boolean; required: boolean };
type PublicLeadFormSettings = { enabled?: boolean; title?: string; description?: string; submit_label?: string; fields?: PublicLeadField[] };

type OpenerContent = {
  digital_product?: string;
  standard_enabled?: boolean;
  animation_enabled?: boolean;
  video_enabled?: boolean;
  title?: string;
  subtitle?: string;
  typography?: TypographySettings;
  background_color?: string;
  accent_color?: string;
  text_color?: string;
  background_image_url?: string;
  background_video_url?: string;
  duration_seconds?: number;
  open_animation?: string;
  close_animation?: string;
  video_muted?: boolean;
  video_loop?: boolean;
  video_fit?: "cover" | "contain";
  buttons?: OpenerButton[];
  button_position?: "top" | "center" | "bottom";
  button_margin_top?: number;
  button_margin_bottom?: number;
  button_padding_x?: number;
  button_padding_y?: number;
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

function uaDeviceType(ua: string) {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|iphone|android/.test(s)) return "mobile";
  return "desktop";
}

type PublicCard = {
  id: string;
  user_id: string | null;
  card_name: string;
  slug: string;
  public_url: string | null;
  display_name: string | null;
  job_title: string | null;
  company_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  logo_url: string | null;
  background_image_url: string | null;
  background_color: string;
  accent_color: string;
  text_color: string;
  theme_mode?: string | null;
  media_settings?: Record<string, unknown> | null;
  lead_form_settings?: PublicLeadFormSettings | null;
  qr_settings?: { foreground?: string; background?: string; size?: number; url?: string } | null;
  primary_phone: string | null;
  sms_phone: string | null;
  primary_email: string | null;
  website_url: string | null;
  maps_url: string | null;
  intro_video_url: string | null;
  view_count: number;
  digital_card_links: PublicCardLink[];
  digital_card_sections?: PublicCardSection[];
};

type PublicThemePalette = { background: string; accent: string; text: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeThemePalette(value: unknown, fallback: PublicThemePalette): PublicThemePalette {
  const source = isObject(value) ? value : {};
  return {
    background: typeof source.background === "string" && source.background ? source.background : fallback.background,
    accent: typeof source.accent === "string" && source.accent ? source.accent : fallback.accent,
    text: typeof source.text === "string" && source.text ? source.text : fallback.text,
  };
}

function publicThemeSettings(card: PublicCard) {
  const settings = isObject(card.media_settings?.theme_settings) ? card.media_settings.theme_settings : {};
  const darkFallback = {
    background: card.background_color || "#07130b",
    accent: card.accent_color || "#a3ff12",
    text: card.text_color || "#f7fff2",
  };
  const lightFallback = {
    background: "#f7fff2",
    accent: card.accent_color || "#4d7c0f",
    text: "#07130b",
  };
  return {
    dark: safeThemePalette(settings.dark, darkFallback),
    light: safeThemePalette(settings.light, lightFallback),
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

function typographyStyle(settings: TypographySettings): CSSProperties {
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

function imageBorderStyle(settings: ImageStyleSettings): CSSProperties {
  const width = settings.outline === "thin" ? 2 : settings.outline === "thick" ? 6 : settings.outline === "none" ? 0 : 4;
  return {
    borderWidth: width,
    borderColor: width ? settings.outline_color || "rgba(255,255,255,0.16)" : "transparent",
    borderStyle: "solid",
  };
}

function safeHref(value: string | null | undefined) {
  if (!value) return "";
  if (/^(https?:|mailto:|tel:|sms:)/i.test(value)) return value;
  return `https://${value}`;
}

function linkHref(link: PublicCardLink) {
  if (link.link_type === "phone") return `tel:${link.url.replace(/^tel:/i, "")}`;
  if (link.link_type === "sms") return `sms:${link.url.replace(/^sms:/i, "")}`;
  if (link.link_type === "email") return link.url.startsWith("mailto:") ? link.url : `mailto:${link.url}`;
  return safeHref(link.url);
}

function human(value: string | null | undefined) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function defaultSections(): PublicCardSection[] {
  return [
    section("profile_header", "Profile header", 1, 24),
    section("quick_actions", "Quick actions", 2, 20),
    section("links", "Links and socials", 3, 20),
    section("video", "Intro video", 4, 20),
    section("qr_code", "QR code", 5, 0),
  ];
}

function section(sectionType: string, label: string, order: number, marginBottom = 16): PublicCardSection {
  return {
    id: `${sectionType}-${order}`,
    section_type: sectionType,
    label,
    display_order: order,
    is_visible: true,
    margin_top: 0,
    margin_right: 0,
    margin_bottom: marginBottom,
    margin_left: 0,
    padding_top: 0,
    padding_right: 0,
    padding_bottom: 0,
    padding_left: 0,
  };
}

function normalizeSections(sections: PublicCardSection[] | undefined) {
  return (sections?.length ? sections : defaultSections())
    .filter((item) => item.is_visible !== false)
    .sort((a, b) => Number(a.display_order || 100) - Number(b.display_order || 100));
}

function defaultOpenerContent(): OpenerContent {
  return {
    digital_product: "opener",
    title: "Welcome",
    subtitle: "Tap to view my digital business card.",
    typography: { font_family: "Inter", font_size: 44, color: "#f7fff2", alignment: "center", font_weight: 700, italic: false, underline: false, letter_spacing: 0, line_height: 1.05 },
    background_color: "#07130b",
    accent_color: "#a3ff12",
    text_color: "#f7fff2",
    duration_seconds: 7,
    open_animation: "fade_up",
    close_animation: "fade_out",
    buttons: [
      { label: "View card", action: "open_card" },
      { label: "Call me", action: "call" },
    ],
  };
}

function openerSection(sections: PublicCardSection[]) {
  return sections.find((section) => section.section_type === "gallery" && (section.content?.digital_product === "opener" || section.label.toLowerCase().includes("opener")));
}

function sectionStyle(item: PublicCardSection): React.CSSProperties {
  return {
    marginTop: Number(item.margin_top || 0),
    marginRight: Number(item.margin_right || 0),
    marginBottom: Number(item.margin_bottom ?? 16),
    marginLeft: Number(item.margin_left || 0),
    paddingTop: Number(item.padding_top || 0),
    paddingRight: Number(item.padding_right || 0),
    paddingBottom: Number(item.padding_bottom || 0),
    paddingLeft: Number(item.padding_left || 0),
  };
}

export default async function PublicDigitalCardPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<Record<string, string>> }) {
  const { slug } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const config = getServerSupabaseConfig();
  if (config.error) notFound();

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await adminClient
    .from("digital_cards")
    .select("id, user_id, card_name, slug, public_url, display_name, job_title, company_name, bio, profile_photo_url, logo_url, background_image_url, background_color, accent_color, text_color, theme_mode, media_settings, lead_form_settings, qr_settings, primary_phone, sms_phone, primary_email, website_url, maps_url, intro_video_url, view_count, digital_card_links(id, label, url, link_type, display_order, is_visible, open_in_new_tab), digital_card_sections(id, section_type, label, content, display_order, is_visible, margin_top, margin_right, margin_bottom, margin_left, padding_top, padding_right, padding_bottom, padding_left)")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_public", true)
    .maybeSingle();

  if (result.error || !result.data) notFound();
  const card = result.data as PublicCard;

  const reqHeaders = await headers();
  const ua = reqHeaders.get("user-agent") || "";
  const isEmbed = resolvedSearch.embed === "1";
  const rawSource = resolvedSearch.source ?? "";
  const source = rawSource === "qr" ? "qr" : rawSource === "nfc" ? "nfc" : "organic";
  const eventType = source === "qr" ? "qr_scan" : source === "nfc" ? "nfc_tap" : "view";

  await Promise.all([
    adminClient.from("digital_cards").update({ view_count: Number(card.view_count || 0) + 1 }).eq("id", card.id),
    Promise.resolve(
      adminClient.from("digital_card_events").insert({
        digital_card_id: card.id,
        user_id: card.user_id ?? null,
        event_type: eventType,
        source,
        device_type: uaDeviceType(ua),
        referrer: reqHeaders.get("referer") || null,
        user_agent: ua || null,
        metadata: {},
      })
    ).catch(() => null),
  ]);

  const links = (card.digital_card_links || [])
    .filter((link) => link.is_visible)
    .sort((a, b) => Number(a.display_order || 100) - Number(b.display_order || 100));
  const sections = normalizeSections(card.digital_card_sections);
  const backgroundImage = card.background_image_url ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${card.background_image_url})` : undefined;
  const publicUrl = card.public_url || `https://my.controlp.io/c/${card.slug}`;
  const opener = openerSection(sections);
  const fabPosition = typeof card.media_settings?.public_fab_position === "string" ? card.media_settings.public_fab_position : "bottom_right";
  const { dark: darkTheme, light: lightTheme } = publicThemeSettings(card);
  const initialTheme = card.theme_mode === "light" ? lightTheme : darkTheme;
  const pageStyle = {
    "--public-bg": initialTheme.background,
    "--public-text": initialTheme.text,
    "--public-accent": initialTheme.accent,
    background: "var(--public-bg)",
    color: "var(--public-text)",
    backgroundImage,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as CSSProperties;
  const themedCard = { ...card, background_color: "var(--public-bg)", accent_color: "var(--public-accent)", text_color: "var(--public-text)" };

  return (
    <main id="public-card-page" className="min-h-screen px-4 py-6" style={pageStyle}>
      {!isEmbed && opener && (
        <PublicOpener
          content={{ ...defaultOpenerContent(), ...(opener.content || {}) } as OpenerContent}
          card={card}
          publicUrl={publicUrl}
        />
      )}
      {!isEmbed && <PublicCardActions cardId={card.id} slug={card.slug} publicUrl={publicUrl} position={fabPosition} accent="var(--public-accent)" background="var(--public-bg)" />}
      <section className="mx-auto max-w-md">
        <div id="card" className="rounded-[2rem] border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur">
          {sections.filter((item) => item.id !== opener?.id).map((item) => <PublicSection key={item.id} section={item} card={themedCard} links={links} publicUrl={publicUrl} themeMode={card.theme_mode || "dark"} darkTheme={darkTheme} lightTheme={lightTheme} />)}
        </div>
        <div className="mt-5 text-center text-xs opacity-60">Powered by ControlP.io</div>
      </section>
    </main>
  );
}


function IconLink({ href, label, icon, accent }: { href: string; label: string; icon: React.ReactNode; accent: string }) {
  return <a className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 text-xs font-medium" href={href} style={{ color: accent }}>{icon}<span>{label}</span></a>;
}

function PublicSection({
  section,
  card,
  links,
  publicUrl,
  themeMode,
  darkTheme,
  lightTheme,
}: {
  section: PublicCardSection;
  card: PublicCard;
  links: PublicCardLink[];
  publicUrl: string;
  themeMode: string;
  darkTheme: { background: string; text: string; accent: string };
  lightTheme: { background: string; text: string; accent: string };
}) {
  if (section.section_type === "profile_header") {
    const textSettings = typographyFrom(card.media_settings?.content_typography, card.text_color);
    const textStyle = typographyStyle(textSettings);
    const nameSize = Number(textSettings.font_size || 18);
    const imageSettings = imageStyleFrom(card.media_settings?.profile_image_style);
    const imageClasses = cn("mx-auto h-28 w-28 object-cover shadow-xl transition-transform transition-shadow duration-200", imageShapeClass(imageSettings), imageHoverClass(imageSettings));
    const fallbackImageClasses = cn("mx-auto grid h-28 w-28 place-items-center bg-white/10 text-3xl font-semibold shadow-xl transition-transform transition-shadow duration-200", imageShapeClass(imageSettings), imageHoverClass(imageSettings));
    return (
      <div style={sectionStyle(section)}>
        <div className="flex items-center justify-between gap-3">
          {card.logo_url ? <img className="max-h-12 max-w-[140px] object-contain" src={card.logo_url} alt={`${card.company_name || card.card_name} logo`} /> : <div className="text-sm font-semibold opacity-75">controlp.io card</div>}
          <PublicThemeToggle mode={themeMode} dark={darkTheme} light={lightTheme} />
        </div>

        <div className="mt-8" style={textStyle}>
          {card.profile_photo_url ? (
            <img className={imageClasses} style={imageBorderStyle(imageSettings)} src={card.profile_photo_url} alt={card.display_name || card.card_name} />
          ) : (
            <div className={fallbackImageClasses} style={imageBorderStyle(imageSettings)}>{(card.display_name || card.card_name).slice(0, 2).toUpperCase()}</div>
          )}
          <h1 className="mt-5 tracking-tight" style={{ fontSize: nameSize, fontWeight: textStyle.fontWeight, lineHeight: textStyle.lineHeight }}>{card.display_name || card.card_name}</h1>
          <p className="mt-1 opacity-80" style={{ fontSize: Math.max(12, nameSize * 0.58) }}>{[card.job_title, card.company_name].filter(Boolean).join(" - ")}</p>
          {card.bio && <p className="mt-4 opacity-85" style={{ fontSize: Math.max(13, nameSize * 0.72), lineHeight: textStyle.lineHeight }}>{card.bio}</p>}
        </div>
      </div>
    );
  }

  if (section.section_type === "quick_actions") {
    return (
      <div className="grid grid-cols-3 gap-2" style={sectionStyle(section)}>
        {card.primary_phone && <IconLink href={`tel:${card.primary_phone}`} label="Call" icon={<Phone className="h-4 w-4" />} accent={card.accent_color} />}
        {card.sms_phone && <IconLink href={`sms:${card.sms_phone}`} label="SMS" icon={<MessageSquare className="h-4 w-4" />} accent={card.accent_color} />}
        {card.primary_email && <IconLink href={`mailto:${card.primary_email}`} label="Email" icon={<Mail className="h-4 w-4" />} accent={card.accent_color} />}
        {card.maps_url && <IconLink href={safeHref(card.maps_url)} label="Map" icon={<MapPin className="h-4 w-4" />} accent={card.accent_color} />}
      </div>
    );
  }

  if (section.section_type === "links") {
    const trackedLinks = [
      ...(card.website_url ? [{ id: "website", href: safeHref(card.website_url), label: "Website" }] : []),
      ...links.map((link) => ({ id: link.id, href: linkHref(link), label: link.label })),
    ];
    return (
      <div style={sectionStyle(section)}>
        <PublicTrackedLinks cardId={card.id} links={trackedLinks} accent={card.accent_color} />
      </div>
    );
  }

  if (section.section_type === "lead_capture") {
    const settings = {
      enabled: true,
      button_label: "Send me your info",
      button_background: card.accent_color,
      button_text_color: card.background_color,
      ...(card.lead_form_settings || {}),
    };
    if (settings.enabled === false) return null;
    return (
      <div style={sectionStyle(section)}>
        <a
          className="block rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-lg"
          href={`/c/${card.slug}/lead`}
          style={{ background: settings.button_background || card.accent_color, color: settings.button_text_color || card.background_color }}
        >
          {settings.button_label || "Send me your info"}
        </a>
      </div>
    );
  }

  if (section.section_type === "video" && card.intro_video_url) {
    return (
      <div style={sectionStyle(section)}>
        <a className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium" href={safeHref(card.intro_video_url)} target="_blank" rel="noreferrer">
          Watch intro video <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    );
  }

  if (section.section_type === "qr_code") {
    const customUrl = card.qr_settings?.url?.trim();
    const qrTarget = customUrl || (publicUrl.includes("?") ? `${publicUrl}&source=qr` : `${publicUrl}?source=qr`);
    const fg = String(card.qr_settings?.foreground || "#07130b").replace("#", "");
    const bg = String(card.qr_settings?.background || "#ffffff").replace("#", "");
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&color=${fg}&bgcolor=${bg}&data=${encodeURIComponent(qrTarget)}`;
    return (
      <div className="grid place-items-center" style={sectionStyle(section)}>
        <img className="h-[132px] w-[132px] rounded-lg border bg-white p-2" src={src} alt="Digital card QR code" />
      </div>
    );
  }

  if (["nfc", "gallery", "scratch_card", "punch_card", "loyalty_card", "custom"].includes(section.section_type)) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm" style={sectionStyle(section)}>
        <div className="font-semibold">{section.label || human(section.section_type)}</div>
        <div className="mt-1 text-xs opacity-70">{human(section.section_type)} content is being prepared.</div>
      </div>
    );
  }

  return null;
}

function ButtonLink({ href, label, accent }: { href: string; label: string; accent: string }) {
  return <a className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold" href={href} target="_blank" rel="noreferrer"><span>{label}</span><ExternalLink className="h-4 w-4" style={{ color: accent }} /></a>;
}
