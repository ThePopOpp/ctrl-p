import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const { error, adminClient } = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: dbErr } = await adminClient
    .from("automations")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ automations: data ?? [] });
}

export async function POST(request: Request) {
  const { error, adminClient, actorId } = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const { name, description, trigger_type, trigger_conditions, action_type, action_data, delay_minutes } = body;

  if (!name || !trigger_type || !action_type) {
    return NextResponse.json({ error: "name, trigger_type, and action_type are required" }, { status: 400 });
  }

  const { data, error: dbErr } = await adminClient
    .from("automations")
    .insert({
      name, description: description ?? null,
      trigger_type, trigger_conditions: trigger_conditions ?? {},
      action_type, action_data: action_data ?? {},
      delay_minutes: delay_minutes ?? 0,
      enabled: true,
      created_by: actorId ?? null,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ automation: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { error, adminClient } = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = ["name","description","trigger_type","trigger_conditions","action_type","action_data","delay_minutes","enabled"];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) { if (rest[k] !== undefined) patch[k] = rest[k]; }

  const { data, error: dbErr } = await adminClient
    .from("automations")
    .update(patch)
    .eq("id", id as string)
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ automation: data });
}

export async function DELETE(request: Request) {
  const { error, adminClient } = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error: dbErr } = await adminClient.from("automations").delete().eq("id", id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
