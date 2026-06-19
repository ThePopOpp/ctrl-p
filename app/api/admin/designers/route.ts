import { NextResponse } from "next/server";

import { verifyAdminRequest, jsonError } from "@/lib/admin/server-auth";

const ADMIN_ROLES = ["super_admin", "admin"];

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request, [...ADMIN_ROLES, "staff"]);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("all") === "true";
  const withBookings = url.searchParams.get("bookings") === "true";

  let query = auth.adminClient
    .from("designer_profiles")
    .select(
      withBookings
        ? "*, designer_bookings(id, status, start_time, end_time, total_price, customer_first_name, customer_last_name, customer_email)"
        : "*"
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ designers: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request, ADMIN_ROLES);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { name, title, bio, avatar_url, hourly_rate, specialties, is_active, weekly_schedule, sort_order } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return jsonError("name is required", 400);
  }

  const hourlyRate = Number(hourly_rate ?? 100);
  if (isNaN(hourlyRate) || hourlyRate < 0) {
    return jsonError("hourly_rate must be a non-negative number", 400);
  }

  const { data, error } = await auth.adminClient
    .from("designer_profiles")
    .insert({
      name: String(name).trim(),
      title: title ? String(title).trim() : "Graphic Designer",
      bio: bio ? String(bio).trim() : null,
      avatar_url: avatar_url ? String(avatar_url).trim() : null,
      hourly_rate: hourlyRate,
      specialties: Array.isArray(specialties) ? specialties.map(String) : [],
      is_active: is_active !== false,
      weekly_schedule: weekly_schedule ?? undefined,
      sort_order: Number(sort_order ?? 100),
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ designer: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request, ADMIN_ROLES);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { id, ...updates } = body;
  if (!id) return jsonError("id is required", 400);

  // Sanitize allowed fields
  const allowed: Record<string, unknown> = {};
  if (updates.name !== undefined) allowed.name = String(updates.name).trim();
  if (updates.title !== undefined) allowed.title = String(updates.title).trim();
  if (updates.bio !== undefined) allowed.bio = updates.bio ? String(updates.bio).trim() : null;
  if (updates.avatar_url !== undefined) allowed.avatar_url = updates.avatar_url ? String(updates.avatar_url).trim() : null;
  if (updates.hourly_rate !== undefined) allowed.hourly_rate = Number(updates.hourly_rate);
  if (updates.specialties !== undefined) allowed.specialties = Array.isArray(updates.specialties) ? updates.specialties.map(String) : [];
  if (updates.is_active !== undefined) allowed.is_active = Boolean(updates.is_active);
  if (updates.weekly_schedule !== undefined) allowed.weekly_schedule = updates.weekly_schedule;
  if (updates.sort_order !== undefined) allowed.sort_order = Number(updates.sort_order);

  const { data, error } = await auth.adminClient
    .from("designer_profiles")
    .update(allowed)
    .eq("id", String(id))
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ designer: data });
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminRequest(request, ADMIN_ROLES);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonError("id query param required", 400);

  // Soft-delete: set inactive instead of hard delete
  const { error } = await auth.adminClient
    .from("designer_profiles")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
