import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig } from "@/lib/admin/server-auth";
import { PublicLeadCapture } from "../public-card-actions";

type LeadCard = {
  id: string;
  slug: string;
  public_url: string | null;
  card_name: string;
  display_name: string | null;
  company_name: string | null;
  logo_url: string | null;
  background_color: string;
  accent_color: string;
  text_color: string;
  lead_form_settings?: {
    enabled?: boolean;
    title?: string;
    description?: string;
    button_label?: string;
    button_background?: string;
    button_text_color?: string;
    field_background?: string;
    field_text_color?: string;
    submit_label?: string;
    fields?: { key: string; label: string; enabled: boolean; required: boolean }[];
  } | null;
};

export default async function PublicDigitalCardLeadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getServerSupabaseConfig();
  if (config.error) notFound();

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await adminClient
    .from("digital_cards")
    .select("id, slug, public_url, card_name, display_name, company_name, logo_url, background_color, accent_color, text_color, lead_form_settings")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_public", true)
    .maybeSingle();

  if (result.error || !result.data) notFound();
  const card = result.data as LeadCard;
  const publicUrl = card.public_url || `https://my.controlp.io/c/${card.slug}`;
  const settings = {
    button_background: card.accent_color,
    button_text_color: card.background_color,
    field_background: "rgba(0,0,0,.2)",
    field_text_color: card.text_color,
    ...(card.lead_form_settings || {}),
  };

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: card.background_color, color: card.text_color }}>
      <section className="mx-auto max-w-md">
        <a href={`/c/${card.slug}`} className="mb-4 inline-flex text-sm opacity-75 hover:opacity-100">Back to card</a>
        <div className="rounded-[2rem] border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur">
          <div className="mb-5 text-center">
            {card.logo_url ? <img className="mx-auto max-h-12 max-w-[160px] object-contain" src={card.logo_url} alt="" /> : null}
            <h1 className="mt-4 text-2xl font-semibold">{card.display_name || card.card_name}</h1>
            {card.company_name && <div className="mt-1 text-sm opacity-75">{card.company_name}</div>}
          </div>
          <PublicLeadCapture cardId={card.id} slug={card.slug} publicUrl={publicUrl} accent={settings.button_background || card.accent_color} settings={settings} />
        </div>
      </section>
    </main>
  );
}
