import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/server-auth";

export type HistoryEvent = {
  id: string;
  type: "submission" | "email_sent" | "email_received" | "sms" | "call" | "message";
  timestamp: string;
  title: string;
  description: string;
  contact_email: string | null;
  contact_name: string | null;
  status: string | null;
  meta: Record<string, unknown>;
};

export async function GET(request: Request) {
  const { error, adminClient } = await verifyAdminRequest(request, ["super_admin", "admin", "employee"]);
  if (error || !adminClient) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const email  = searchParams.get("email");
  const type   = searchParams.get("type");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  const events: HistoryEvent[] = [];

  // ── Contact form submissions ───────────────────────────────────────────────
  if (!type || type === "submission") {
    let q = adminClient
      .from("contact_submissions")
      .select("id,first_name,last_name,email,subject,message,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (email) q = q.ilike("email", `%${email}%`);
    const { data } = await q;
    (data ?? []).forEach((r) => {
      events.push({
        id: `sub-${r.id}`,
        type: "submission",
        timestamp: r.created_at,
        title: r.subject ?? "Contact form submission",
        description: (r.message as string).slice(0, 120),
        contact_email: r.email,
        contact_name: [r.first_name, r.last_name].filter(Boolean).join(" "),
        status: r.status,
        meta: { submission_id: r.id },
      });
    });
  }

  // ── Inbox received emails ──────────────────────────────────────────────────
  if (!type || type === "email_received") {
    let q = adminClient
      .from("email_inbox")
      .select("id,from_email,from_name,subject,received_at,is_read")
      .order("received_at", { ascending: false })
      .limit(limit);
    if (email) q = q.ilike("from_email", `%${email}%`);
    const { data } = await q;
    (data ?? []).forEach((r) => {
      events.push({
        id: `inbox-${r.id}`,
        type: "email_received",
        timestamp: r.received_at,
        title: r.subject,
        description: `From: ${r.from_name ?? r.from_email}`,
        contact_email: r.from_email,
        contact_name: r.from_name ?? null,
        status: r.is_read ? "read" : "unread",
        meta: { inbox_id: r.id },
      });
    });
  }

  // ── Sent emails (email templates published) ───────────────────────────────
  if (!type || type === "email_sent") {
    const { data } = await adminClient
      .from("content_items")
      .select("id,title,subject,published_at,updated_at")
      .eq("content_type", "email_template")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    (data ?? []).forEach((r) => {
      events.push({
        id: `sent-${r.id}`,
        type: "email_sent",
        timestamp: r.published_at ?? r.updated_at,
        title: r.subject ?? r.title,
        description: `Email template: ${r.title}`,
        contact_email: null,
        contact_name: null,
        status: "sent",
        meta: { template_id: r.id },
      });
    });
  }

  // ── SMS messages ──────────────────────────────────────────────────────────
  if (!type || type === "sms") {
    let q = adminClient
      .from("sms_messages")
      .select("id,to_number,from_number,body,direction,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    const { data } = await q;
    (data ?? []).forEach((r: Record<string, unknown>) => {
      events.push({
        id: `sms-${r.id}`,
        type: "sms",
        timestamp: r.created_at as string,
        title: `SMS ${r.direction === "outbound" ? "to" : "from"} ${(r.direction === "outbound" ? r.to_number : r.from_number) as string}`,
        description: (r.body as string | null)?.slice(0, 100) ?? "",
        contact_email: null,
        contact_name: null,
        status: r.status as string | null,
        meta: { direction: r.direction, sms_id: r.id },
      });
    });
  }

  // ── Inbound messages (contact page → messages table) ──────────────────────
  if (!type || type === "message") {
    let q = adminClient
      .from("messages")
      .select("id,subject,body,channel,direction,read_at,created_at")
      .eq("channel", "contact_form")
      .order("created_at", { ascending: false })
      .limit(limit);
    const { data } = await q;
    (data ?? []).forEach((r: Record<string, unknown>) => {
      const body = String(r.body ?? "");
      const emailMatch = body.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      events.push({
        id: `msg-${r.id}`,
        type: "message",
        timestamp: r.created_at as string,
        title: (r.subject as string | null) ?? "Contact form message",
        description: body.split("\n").slice(1, 3).join(" ").slice(0, 120),
        contact_email: emailMatch ? emailMatch[0] : null,
        contact_name: body.split("\n")[0]?.replace("From: ", "") ?? null,
        status: r.read_at ? "read" : "unread",
        meta: { message_id: r.id },
      });
    });
  }

  // Sort by timestamp descending and return
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ events: events.slice(0, limit) });
}
