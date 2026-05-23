import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError, serverEnv } from "@/lib/admin/server-auth";

const LINK_TYPES = new Set(["website", "social", "phone", "email", "sms", "map", "booking", "payment", "download", "video", "review", "custom"]);
const STATUSES = new Set(["draft", "published", "unpublished"]);

type DigitalCardLinkBody = {
  id?: string;
  label?: string;
  url?: string;
  link_type?: string;
  icon?: string;
  display_order?: number | string;
  is_visible?: boolean;
  open_in_new_tab?: boolean;
};

type DigitalCardBody = {
  id?: string;
  card_name?: string;
  slug?: string;
  status?: string;
  is_public?: boolean;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  job_title?: string;
  company_name?: string;
  department?: string;
  bio?: string;
  profile_photo_url?: string;
  logo_url?: string;
  background_image_url?: string;
  background_color?: string;
  accent_color?: string;
  text_color?: string;
  button_style?: string;
  layout_style?: string;
  primary_phone?: string;
  mobile_phone?: string;
  office_phone?: string;
  sms_phone?: string;
  primary_email?: string;
  secondary_email?: string;
  website_url?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  maps_url?: string;
  intro_video_url?: string;
  qr_settings?: Record<string, unknown>;
  nfc_status?: string;
  access_status?: string;
  access_plan?: string;
  assigned_order_id?: string | null;
  assigned_product_id?: string | null;
  links?: DigitalCardLinkBody[];
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function nullable(value: unknown) {
  const text = clean(value);
  return text || null;
}

function slugify(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "card";
}

function safeUrl(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  if (/^(https?:|mailto:|tel:|sms:)/i.test(text)) return text;
  return `https://${text}`;
}

function publicBase() {
  return serverEnv("PUBLIC_APP_URL").replace(/\/$/, "") || "https://my.controlp.io";
}

async function verifyCustomerRequest(request: Request) {
  const config = getServerSupabaseConfig();
  if (config.error) return { error: config.error };

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!accessToken) return { error: jsonError("Missing customer session token.", 401) };

  const userClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const authResult = await userClient.auth.getUser(accessToken);
  const actorId = authResult.data.user?.id;
  if (authResult.error || !actorId) return { error: jsonError("Invalid customer session.", 401) };

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const profileResult = await adminClient
    .from("users")
    .select("id, email, full_name, phone, company, role, status, deleted_at")
    .eq("id", actorId)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) return { error: jsonError("Customer profile not found.", 404) };
  if (profileResult.data.deleted_at || !["active", "pending"].includes(clean(profileResult.data.status))) {
    return { error: jsonError("Your account is not active.", 403) };
  }

  return { actorId, profile: profileResult.data, adminClient };
}

async function uniqueSlug(adminClient: { from: (table: string) => any }, requested: string, existingId?: string) {
  const base = slugify(requested);
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const result = await adminClient.from("digital_cards").select("id").eq("slug", candidate).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    const row = result.data as { id?: string } | null;
    if (!row || row.id === existingId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function cardSelect() {
  return "*, digital_card_links(id, label, url, link_type, icon, display_order, is_visible, open_in_new_tab, click_count, created_at, updated_at)";
}

function buildLinks(links: DigitalCardLinkBody[] | undefined, cardId: string) {
  return (links || [])
    .map((link, index) => {
      const label = clean(link.label);
      const url = safeUrl(link.url);
      const linkType = LINK_TYPES.has(clean(link.link_type)) ? clean(link.link_type) : "custom";
      if (!label || !url) return null;
      return {
        digital_card_id: cardId,
        label,
        url,
        link_type: linkType,
        icon: nullable(link.icon),
        display_order: Number(link.display_order || index + 1),
        is_visible: link.is_visible !== false,
        open_in_new_tab: link.open_in_new_tab !== false,
      };
    })
    .filter((link): link is {
      digital_card_id: string;
      label: string;
      url: string;
      link_type: string;
      icon: string | null;
      display_order: number;
      is_visible: boolean;
      open_in_new_tab: boolean;
    } => Boolean(link));
}

export async function GET(request: Request) {
  const verified = await verifyCustomerRequest(request);
  if (verified.error) return verified.error;

  const [cardsResult, ordersResult, productsResult] = await Promise.all([
    verified.adminClient
      .from("digital_cards")
      .select(cardSelect())
      .eq("user_id", verified.actorId)
      .order("updated_at", { ascending: false }),
    verified.adminClient
      .from("orders")
      .select("id, order_number, status, payment_status, total, created_at")
      .eq("user_id", verified.actorId)
      .order("created_at", { ascending: false })
      .limit(20),
    verified.adminClient
      .from("products")
      .select("id, name, slug, category, tagline, sale_price, base_price")
      .or("product_type.ilike.%nfc%,name.ilike.%qr%,name.ilike.%business card%,name.ilike.%sticker%")
      .limit(8),
  ]);

  const failed = [cardsResult, ordersResult, productsResult].find((result) => result.error);
  if (failed?.error) return jsonError(failed.error.message, 400);

  return NextResponse.json({
    profile: verified.profile,
    cards: cardsResult.data ?? [],
    orders: ordersResult.data ?? [],
    products: productsResult.data ?? [],
    publicBase: publicBase(),
  });
}

export async function POST(request: Request) {
  const verified = await verifyCustomerRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as DigitalCardBody | null;
  if (!body) return jsonError("Digital card payload is required.");

  const cardName = clean(body.card_name || body.display_name || "My digital card");
  const status = STATUSES.has(clean(body.status)) ? clean(body.status) : "draft";
  const slug = await uniqueSlug(verified.adminClient, clean(body.slug || cardName), body.id);
  const isPublic = Boolean(body.is_public || status === "published");
  const publicUrl = `${publicBase()}/c/${slug}`;
  const now = new Date().toISOString();

  const payload = {
    user_id: verified.actorId,
    customer_id: verified.actorId,
    card_name: cardName,
    slug,
    status,
    is_public: isPublic,
    public_url: publicUrl,
    first_name: nullable(body.first_name),
    last_name: nullable(body.last_name),
    display_name: nullable(body.display_name) || cardName,
    job_title: nullable(body.job_title),
    company_name: nullable(body.company_name || verified.profile.company),
    department: nullable(body.department),
    bio: nullable(body.bio),
    profile_photo_url: safeUrl(body.profile_photo_url),
    logo_url: safeUrl(body.logo_url),
    background_image_url: safeUrl(body.background_image_url),
    background_color: clean(body.background_color) || "#07130b",
    accent_color: clean(body.accent_color) || "#a3ff12",
    text_color: clean(body.text_color) || "#f7fff2",
    button_style: clean(body.button_style) || "rounded",
    layout_style: clean(body.layout_style) || "stacked",
    primary_phone: nullable(body.primary_phone || verified.profile.phone),
    mobile_phone: nullable(body.mobile_phone),
    office_phone: nullable(body.office_phone),
    sms_phone: nullable(body.sms_phone || body.primary_phone || verified.profile.phone),
    primary_email: nullable(body.primary_email || verified.profile.email),
    secondary_email: nullable(body.secondary_email),
    website_url: safeUrl(body.website_url),
    address_line_1: nullable(body.address_line_1),
    address_line_2: nullable(body.address_line_2),
    city: nullable(body.city),
    state: nullable(body.state),
    postal_code: nullable(body.postal_code),
    country: clean(body.country) || "US",
    maps_url: safeUrl(body.maps_url),
    intro_video_url: safeUrl(body.intro_video_url),
    qr_settings: body.qr_settings || { foreground: "#07130b", background: "#ffffff", size: 512 },
    nfc_status: clean(body.nfc_status) || "not_ordered",
    access_status: clean(body.access_status) || "trial",
    access_plan: nullable(body.access_plan),
    assigned_order_id: nullable(body.assigned_order_id),
    assigned_product_id: nullable(body.assigned_product_id),
    published_at: isPublic && status === "published" ? now : null,
  };

  const result = body.id
    ? await verified.adminClient
        .from("digital_cards")
        .update(payload)
        .eq("id", body.id)
        .eq("user_id", verified.actorId)
        .select("id")
        .single()
    : await verified.adminClient
        .from("digital_cards")
        .insert(payload)
        .select("id")
        .single();

  if (result.error) return jsonError(result.error.message, 400);

  const cardId = result.data.id;
  const deleteResult = await verified.adminClient.from("digital_card_links").delete().eq("digital_card_id", cardId);
  if (deleteResult.error) return jsonError(deleteResult.error.message, 400);

  const linkRows = buildLinks(body.links, cardId);
  if (linkRows.length) {
    const linksResult = await verified.adminClient.from("digital_card_links").insert(linkRows);
    if (linksResult.error) return jsonError(linksResult.error.message, 400);
  }

  const cardResult = await verified.adminClient
    .from("digital_cards")
    .select(cardSelect())
    .eq("id", cardId)
    .single();

  if (cardResult.error) return jsonError(cardResult.error.message, 400);
  return NextResponse.json({ card: cardResult.data });
}

export async function DELETE(request: Request) {
  const verified = await verifyCustomerRequest(request);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonError("Digital card id is required.");

  const result = await verified.adminClient
    .from("digital_cards")
    .delete()
    .eq("id", id)
    .eq("user_id", verified.actorId);

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ ok: true });
}
