import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig } from "@/lib/admin/server-auth";

function escapeVcf(value: string | null | undefined) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!slug) return new NextResponse("Missing card slug.", { status: 400 });

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await adminClient
    .from("digital_cards")
    .select("id, slug, display_name, first_name, last_name, job_title, company_name, primary_phone, sms_phone, primary_email, website_url, public_url")
    .eq("slug", slug)
    .eq("is_public", true)
    .eq("status", "published")
    .maybeSingle();

  if (result.error || !result.data) return new NextResponse("Card not found.", { status: 404 });
  const card = result.data;
  const fullName = card.display_name || [card.first_name, card.last_name].filter(Boolean).join(" ") || "Digital Card";
  const fileName = `${card.slug || "digital-card"}.vcf`;
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVcf(fullName)}`,
    `N:${escapeVcf(card.last_name)};${escapeVcf(card.first_name)};;;`,
    card.company_name ? `ORG:${escapeVcf(card.company_name)}` : "",
    card.job_title ? `TITLE:${escapeVcf(card.job_title)}` : "",
    card.primary_phone ? `TEL;TYPE=CELL:${escapeVcf(card.primary_phone)}` : "",
    card.sms_phone && card.sms_phone !== card.primary_phone ? `TEL;TYPE=TEXT:${escapeVcf(card.sms_phone)}` : "",
    card.primary_email ? `EMAIL:${escapeVcf(card.primary_email)}` : "",
    card.website_url ? `URL:${escapeVcf(card.website_url)}` : "",
    card.public_url ? `URL:${escapeVcf(card.public_url)}` : "",
    "END:VCARD",
  ].filter(Boolean).join("\r\n");

  return new NextResponse(vcf, {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
