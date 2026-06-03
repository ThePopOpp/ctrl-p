import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseConfig, jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request, ["super_admin", "admin"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({})) as {
    message?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  const message = String(body.message || "").trim();
  const history = Array.isArray(body.history) ? body.history : [];

  if (!message) return jsonError("message is required.");

  const config = getServerSupabaseConfig();
  if ("error" in config) return config.error;

  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const [orders, blockers, pendingProofs, appointments, scheduleStats, overdueItems, todayItems, overdueOrders] = await Promise.all([
    db
      .from("orders")
      .select("order_number, status, payment_status, production_status, total, company, customer_email, customer_phone, due_at")
      .order("created_at", { ascending: false })
      .limit(25),
    db
      .from("production_schedule_items")
      .select("title, status, blocker_type, blocker_reason, phase, due_date, project_name, orders(order_number, company, customer_email)")
      .eq("is_blocked", true)
      .limit(15),
    db
      .from("proofs")
      .select("id, status, sent_at, revision_number, orders(order_number, company, customer_email)")
      .neq("status", "approved")
      .limit(15),
    db
      .from("booking_appointments")
      .select("title, start_time, status, customer_first_name, customer_last_name, customer_email, customer_phone")
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(8),
    db
      .from("production_schedule_items")
      .select("status, is_blocked")
      .limit(300),
    // Items past due and not closed
    db
      .from("production_schedule_items")
      .select("title, status, phase, due_date, project_name, orders(order_number, company, customer_email)")
      .lt("due_date", todayStr)
      .not("status", "in", '("completed","approved","on_hold","canceled")')
      .order("due_date", { ascending: true })
      .limit(20),
    // Items due today
    db
      .from("production_schedule_items")
      .select("title, status, phase, project_name, orders(order_number, company, customer_email)")
      .eq("due_date", todayStr)
      .not("status", "in", '("completed","approved")')
      .limit(20),
    // Orders with a past due date that aren't shipped/completed
    db
      .from("orders")
      .select("order_number, company, customer_email, customer_phone, status, production_status, payment_status, due_at")
      .lt("due_at", nowIso)
      .not("status", "in", '("completed","shipped","canceled","archived")')
      .order("due_at", { ascending: true })
      .limit(10),
  ]);

  const items = scheduleStats.data ?? [];
  const totalItems = items.length;
  const openItems = items.filter((i) => !["completed", "approved", "on_hold"].includes(i.status ?? "")).length;
  const blockedCount = items.filter((i) => i.is_blocked).length;

  type OrderRef = { order_number?: string | null; company?: string | null; customer_email?: string | null } | null;

  const systemPrompt = [
    "You are the Ctrl+P operations agent.",
    "Ctrl+P is a print shop and production management platform.",
    "You have read-only access to live business data summarized below.",
    "Be concise, direct, and actionable. Flag urgent issues clearly.",
    "Do not take actions (send messages, change data, delete records) — your role is analysis and recommendations only.",
    "",
    "## Drafting customer messages",
    "When asked to draft a customer update, write a professional, friendly message.",
    "Wrap the draft in <draft> and </draft> tags so the UI can highlight it for easy copying.",
    "Include the customer name or company, order reference, current status, and a clear next step or ETA if available.",
    "",
    `## Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
    "",
    `## Orders (${orders.data?.length ?? 0} most recent)`,
    ...(orders.data?.map(
      (o) => `- #${o.order_number}: status=${o.status}, payment=${o.payment_status}, production=${o.production_status}` +
        `, ${o.company || o.customer_email || "customer"}` +
        (o.due_at ? `, due ${new Date(o.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""),
    ) ?? ["No orders loaded."]),
    "",
    `## Overdue Orders (${overdueOrders.data?.length ?? 0} past their due date)`,
    overdueOrders.data?.length
      ? overdueOrders.data.map(
          (o) => `- #${o.order_number} (${o.company || o.customer_email || "customer"}): status=${o.status}, payment=${o.payment_status}` +
            (o.due_at ? `, was due ${new Date(o.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""),
        ).join("\n")
      : "No overdue orders.",
    "",
    `## Production Schedule (${totalItems} items, ${openItems} open, ${blockedCount} blocked)`,
    blockers.data?.length
      ? blockers.data.map(
          (b) => {
            const ref = (b as unknown as { orders?: OrderRef }).orders;
            const order = ref ? `order #${ref.order_number} (${ref.company || ref.customer_email || "customer"})` : null;
            return `- BLOCKED: ${b.project_name ?? b.title} (${b.phase ?? "no phase"}) — ${b.blocker_type ?? b.status}${b.blocker_reason ? `: ${b.blocker_reason}` : ""}${b.due_date ? `, due ${b.due_date}` : ""}${order ? `, ${order}` : ""}`;
          },
        ).join("\n")
      : "No production blockers.",
    "",
    `## Overdue Production Items (${overdueItems.data?.length ?? 0} past due date)`,
    overdueItems.data?.length
      ? overdueItems.data.map(
          (i) => {
            const ref = (i as unknown as { orders?: OrderRef }).orders;
            const daysLate = i.due_date ? Math.round((Date.now() - new Date(i.due_date).getTime()) / 86400000) : null;
            return `- OVERDUE ${daysLate != null ? `(${daysLate}d)` : ""}: ${i.project_name ?? i.title} (${i.phase ?? "no phase"}), status=${i.status}${ref ? `, order #${ref.order_number} (${ref.company || ref.customer_email || ""})` : ""}`;
          },
        ).join("\n")
      : "No overdue production items.",
    "",
    `## Due Today (${todayItems.data?.length ?? 0} items)`,
    todayItems.data?.length
      ? todayItems.data.map(
          (i) => {
            const ref = (i as unknown as { orders?: OrderRef }).orders;
            return `- ${i.project_name ?? i.title} (${i.phase ?? "no phase"}), status=${i.status}${ref ? `, order #${ref.order_number} (${ref.company || ref.customer_email || ""})` : ""}`;
          },
        ).join("\n")
      : "Nothing due today.",
    "",
    `## Proofs Pending Approval (${pendingProofs.data?.length ?? 0})`,
    ...(pendingProofs.data?.map(
      (p) => {
        const ref = (p as unknown as { orders?: OrderRef }).orders;
        return `- Proof ${p.id.slice(0, 8)}: v${p.revision_number ?? 1}, status=${p.status}, sent=${p.sent_at ? new Date(p.sent_at).toLocaleDateString() : "not sent yet"}${ref ? `, order #${ref.order_number} (${ref.company || ref.customer_email || ""})` : ""}`;
      },
    ) ?? ["No pending proofs."]),
    "",
    `## Upcoming Appointments (${appointments.data?.length ?? 0})`,
    ...(appointments.data?.map(
      (a) => `- ${a.title} — ${[a.customer_first_name, a.customer_last_name].filter(Boolean).join(" ") || "Customer"} at ${new Date(a.start_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}, status=${a.status}`,
    ) ?? ["No upcoming appointments."]),
  ].join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonError("ANTHROPIC_API_KEY is not configured on the server.", 500);

  const client = new Anthropic({ apiKey });

  const validHistory = history.filter(
    (h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string",
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      ...validHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ],
  });

  const text = response.content.find((c) => c.type === "text")?.text ?? "";
  return NextResponse.json({ response: text, usage: response.usage });
}
