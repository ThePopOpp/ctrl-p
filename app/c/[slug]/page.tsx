import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ExternalLink, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { getServerSupabaseConfig } from "@/lib/admin/server-auth";
import { PublicCardActions, PublicLeadCapture } from "./public-card-actions";

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

type PublicCard = {
  id: string;
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

export default async function PublicDigitalCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getServerSupabaseConfig();
  if (config.error) notFound();

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await adminClient
    .from("digital_cards")
    .select("id, card_name, slug, public_url, display_name, job_title, company_name, bio, profile_photo_url, logo_url, background_image_url, background_color, accent_color, text_color, primary_phone, sms_phone, primary_email, website_url, maps_url, intro_video_url, view_count, digital_card_links(id, label, url, link_type, display_order, is_visible, open_in_new_tab), digital_card_sections(id, section_type, label, content, display_order, is_visible, margin_top, margin_right, margin_bottom, margin_left, padding_top, padding_right, padding_bottom, padding_left)")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_public", true)
    .maybeSingle();

  if (result.error || !result.data) notFound();
  const card = result.data as PublicCard;

  await adminClient
    .from("digital_cards")
    .update({ view_count: Number(card.view_count || 0) + 1 })
    .eq("id", card.id);

  const links = (card.digital_card_links || [])
    .filter((link) => link.is_visible)
    .sort((a, b) => Number(a.display_order || 100) - Number(b.display_order || 100));
  const sections = normalizeSections(card.digital_card_sections);
  const backgroundImage = card.background_image_url ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${card.background_image_url})` : undefined;
  const publicUrl = card.public_url || `https://my.controlp.io/c/${card.slug}`;
  const opener = openerSection(sections);

  return (
    <main className="min-h-screen px-4 py-6" style={{ background: card.background_color, color: card.text_color, backgroundImage, backgroundSize: "cover", backgroundPosition: "center" }}>
      {opener && <PublicOpener section={opener} card={card} publicUrl={publicUrl} />}
      <section className="mx-auto max-w-md">
        <div id="card" className="rounded-[2rem] border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur">
          <PublicCardActions cardId={card.id} slug={card.slug} publicUrl={publicUrl} />
          {sections.filter((item) => item.id !== opener?.id).map((item) => <PublicSection key={item.id} section={item} card={card} links={links} publicUrl={publicUrl} />)}
          <PublicLeadCapture cardId={card.id} slug={card.slug} publicUrl={publicUrl} accent={card.accent_color} />
        </div>
        <div className="mt-5 text-center text-xs opacity-60">Powered by ControlP.io</div>
      </section>
    </main>
  );
}

function openerButtonHref(button: OpenerButton, card: PublicCard) {
  if (button.action === "call") return `tel:${button.url || card.primary_phone || ""}`;
  if (button.action === "sms") return `sms:${button.url || card.sms_phone || card.primary_phone || ""}`;
  if (button.action === "email") return `mailto:${button.url || card.primary_email || ""}`;
  if (button.action === "url") return safeHref(button.url);
  return "#card";
}

function PublicOpener({ section, card, publicUrl }: { section: PublicCardSection; card: PublicCard; publicUrl: string }) {
  const content = { ...defaultOpenerContent(), ...(section.content || {}) } as OpenerContent;
  const duration = Math.max(1, Math.min(30, Number(content.duration_seconds || 7)));
  const backgroundImage = content.background_image_url ? `linear-gradient(rgba(0,0,0,.38), rgba(0,0,0,.38)), url(${content.background_image_url})` : undefined;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-5"
      style={{
        background: content.background_color || card.background_color,
        color: content.text_color || card.text_color,
        backgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
        animation: `public-opener-hide 450ms ease ${duration}s forwards`,
      }}
    >
      {content.background_video_url && (
        <video className="absolute inset-0 h-full w-full object-cover opacity-45" src={content.background_video_url} autoPlay muted playsInline loop />
      )}
      <style>{`
        @keyframes public-opener-hide {
          to { opacity: 0; visibility: hidden; pointer-events: none; }
        }
        @keyframes public-opener-enter {
          from { opacity: 0; transform: translateY(18px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="relative z-10 mx-auto max-w-lg text-center" style={{ animation: "public-opener-enter 650ms ease both" }}>
        <div className="text-xs uppercase tracking-[0.35em] opacity-70">Digital card</div>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight">{content.title || card.display_name || card.card_name}</h1>
        <p className="mx-auto mt-4 max-w-md text-lg opacity-80">{content.subtitle || `Connect with ${card.display_name || card.card_name}`}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(content.buttons || []).slice(0, 2).map((button, index) => (
            <a key={index} href={openerButtonHref(button, card)} className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur" style={{ color: content.accent_color || card.accent_color }}>
              {button.label || (index === 0 ? "View card" : "Contact")}
            </a>
          ))}
        </div>
        <div className="mt-5 text-xs opacity-60">{publicUrl}</div>
      </div>
    </div>
  );
}

function IconLink({ href, label, icon, accent }: { href: string; label: string; icon: React.ReactNode; accent: string }) {
  return <a className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 text-xs font-medium" href={href} style={{ color: accent }}>{icon}<span>{label}</span></a>;
}

function PublicSection({ section, card, links, publicUrl }: { section: PublicCardSection; card: PublicCard; links: PublicCardLink[]; publicUrl: string }) {
  if (section.section_type === "profile_header") {
    return (
      <div style={sectionStyle(section)}>
        <div className="flex items-center justify-between gap-3">
          {card.logo_url ? <img className="max-h-12 max-w-[140px] object-contain" src={card.logo_url} alt={`${card.company_name || card.card_name} logo`} /> : <div className="text-sm font-semibold opacity-75">controlp.io card</div>}
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs opacity-75">Digital Card</span>
        </div>

        <div className="mt-8 text-center">
          {card.profile_photo_url ? (
            <img className="mx-auto h-28 w-28 rounded-full border-4 border-white/15 object-cover shadow-xl" src={card.profile_photo_url} alt={card.display_name || card.card_name} />
          ) : (
            <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-white/15 bg-white/10 text-3xl font-semibold shadow-xl">{(card.display_name || card.card_name).slice(0, 2).toUpperCase()}</div>
          )}
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">{card.display_name || card.card_name}</h1>
          <p className="mt-1 text-sm opacity-80">{[card.job_title, card.company_name].filter(Boolean).join(" - ")}</p>
          {card.bio && <p className="mt-4 text-sm leading-6 opacity-85">{card.bio}</p>}
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
    return (
      <div className="space-y-2" style={sectionStyle(section)}>
        {card.website_url && <ButtonLink href={safeHref(card.website_url)} label="Website" accent={card.accent_color} />}
        {links.map((link) => <ButtonLink key={link.id} href={linkHref(link)} label={link.label} accent={card.accent_color} />)}
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
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(publicUrl)}`;
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
