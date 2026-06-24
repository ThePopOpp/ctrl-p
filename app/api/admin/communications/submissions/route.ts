import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const { error, adminClient } = await verifyAdminRequest(request, ["super_admin", "admin", "employee"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  let q = adminClient
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") q = q.eq("status", status);
  if (search) q = q.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,subject.ilike.%${search}%`);

  const { data, error: dbErr } = await q;
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function PATCH(request: Request) {
  const { error, adminClient } = await verifyAdminRequest(request, ["super_admin", "admin", "employee"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { id?: string; status?: string; notes?: string };
  const { id, status, notes } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (status === "replied") patch.replied_at = new Date().toISOString();
  if (notes !== undefined) patch.notes = notes;

  const { data, error: dbErr } = await adminClient
    .from("contact_submissions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ submission: data });
}
