import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseConfig, jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const callSid = url.searchParams.get("callSid") || "";
  if (!callSid) return jsonError("callSid is required.");

  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await adminClient
    .from("activity_logs")
    .select("id, details, created_at, actor_id")
    .eq("entity_type", "call")
    .eq("entity_id", callSid)
    .eq("action", "call_note")
    .order("created_at", { ascending: true });

  if (error) return jsonError(error.message);

  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null);
  const callSid = String(body?.callSid || "").trim();
  const note = String(body?.note || "").trim();

  if (!callSid) return jsonError("callSid is required.");
  if (!note) return jsonError("note text is required.");

  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "call_note",
    entity_type: "call",
    entity_id: callSid,
    details: { note, call_sid: callSid },
  });

  if (error) return jsonError(error.message);

  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const verified = await verifyAdminRequest(request);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const noteId = url.searchParams.get("id") || "";
  if (!noteId) return jsonError("Note id is required.");

  const config = getServerSupabaseConfig();
  if (config.error) return config.error;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient
    .from("activity_logs")
    .delete()
    .eq("id", noteId)
    .eq("action", "call_note");

  if (error) return jsonError(error.message);

  return NextResponse.json({ deleted: true });
}
