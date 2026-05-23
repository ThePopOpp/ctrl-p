import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ExternalLink, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { getServerSupabaseConfig } from "@/lib/admin/server-auth";

type PublicCardLink = {
  id: string;
  label: string;
  url: string;
  link_type: string;
  display_order: number;
  is_visible: boolean;
  open_in_new_tab: boolean;
};

type PublicCard = {
  id: string;
  card_name: string;
  slug: string;
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

export default async function PublicDigitalCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getServerSupabaseConfig();
  if (config.error) notFound();

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await adminClient
    .from("digital_cards")
    .select("id, card_name, slug, display_name, job_title, company_name, bio, profile_photo_url, logo_url, background_image_url, background_color, accent_color, text_color, primary_phone, sms_phone, primary_email, website_url, maps_url, intro_video_url, view_count, digital_card_links(id, label, url, link_type, display_order, is_visible, open_in_new_tab)")
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
  const backgroundImage = card.background_image_url ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${card.background_image_url})` : undefined;

  return (
    <main className="min-h-screen px-4 py-6" style={{ background: card.background_color, color: card.text_color, backgroundImage, backgroundSize: "cover", backgroundPosition: "center" }}>
      <section className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur">
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

          <div className="mt-6 grid grid-cols-3 gap-2">
            {card.primary_phone && <IconLink href={`tel:${card.primary_phone}`} label="Call" icon={<Phone className="h-4 w-4" />} accent={card.accent_color} />}
            {card.sms_phone && <IconLink href={`sms:${card.sms_phone}`} label="SMS" icon={<MessageSquare className="h-4 w-4" />} accent={card.accent_color} />}
            {card.primary_email && <IconLink href={`mailto:${card.primary_email}`} label="Email" icon={<Mail className="h-4 w-4" />} accent={card.accent_color} />}
            {card.maps_url && <IconLink href={safeHref(card.maps_url)} label="Map" icon={<MapPin className="h-4 w-4" />} accent={card.accent_color} />}
          </div>

          <div className="mt-5 space-y-2">
            {card.website_url && <ButtonLink href={safeHref(card.website_url)} label="Website" accent={card.accent_color} />}
            {links.map((link) => <ButtonLink key={link.id} href={linkHref(link)} label={link.label} accent={card.accent_color} />)}
          </div>

          {card.intro_video_url && (
            <a className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium" href={safeHref(card.intro_video_url)} target="_blank" rel="noreferrer">
              Watch intro video <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        <div className="mt-5 text-center text-xs opacity-60">Powered by ControlP.io</div>
      </section>
    </main>
  );
}

function IconLink({ href, label, icon, accent }: { href: string; label: string; icon: React.ReactNode; accent: string }) {
  return <a className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/10 px-2 py-3 text-xs font-medium" href={href} style={{ color: accent }}>{icon}<span>{label}</span></a>;
}

function ButtonLink({ href, label, accent }: { href: string; label: string; accent: string }) {
  return <a className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold" href={href} target="_blank" rel="noreferrer"><span>{label}</span><ExternalLink className="h-4 w-4" style={{ color: accent }} /></a>;
}
