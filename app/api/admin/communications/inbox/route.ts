import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const { error, adminClient } = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unread = searchParams.get("unread");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  let q = adminClient
    .from("email_inbox")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit);

  if (unread === "true") q = q.eq("is_read", false);

  const { data, error: dbErr } = await q;
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function PATCH(request: Request) {
  const { error, adminClient } = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_read } = await request.json() as { id: string; is_read: boolean };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error: dbErr } = await adminClient
    .from("email_inbox")
    .update({ is_read })
    .eq("id", id)
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
