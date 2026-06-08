import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const result = await verified.adminClient
    .from("contact_submissions")
    .select("id, first_name, last_name, email, phone, company, subject, message, status, created_at")
    .order("created_at", { ascending: false });

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ submissions: result.data ?? [] });
}

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) return jsonError("id and status are required.", 400);

  const VALID_STATUSES = new Set(["new", "read", "replied", "archived"]);
  if (!VALID_STATUSES.has(body.status)) return jsonError("Invalid status value.", 400);

  const result = await verified.adminClient
    .from("contact_submissions")
    .update({ status: body.status })
    .eq("id", body.id)
    .select("id, first_name, last_name, email, phone, company, subject, message, status, created_at")
    .single();

  if (result.error) return jsonError(result.error.message, 400);
  return NextResponse.json({ submission: result.data });
}
