import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import twilio from "twilio";

// ─── Tool definitions (OpenAI function-calling format) ───────────────────────

export const AGENT_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_business_overview",
      description:
        "Get a real-time snapshot of the ControlP.io business: order counts by status, revenue totals, unread messages, production queue stats, and overdue items.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_orders",
      description: "List orders with optional filters by status, payment status, or search term.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Order status: pending | processing | completed | cancelled | shipped | hold" },
          payment_status: { type: "string", description: "Payment status: paid | unpaid | partially_paid | refunded | overdue" },
          search: { type: "string", description: "Search by order number, company name, or customer email" },
          limit: { type: "integer", description: "Max results (1-50, default 15)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_order_details",
      description: "Get full details for a specific order by order number.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "The order number (e.g. 1042)" },
        },
        required: ["order_number"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_customers",
      description: "Search and list customers by name, email, company, or phone.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search term" },
          limit: { type: "integer", description: "Max results (default 15)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_messages",
      description: "List recent customer messages across SMS and email channels.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["sms", "email", "all"], description: "Channel filter (default: all)" },
          unread_only: { type: "boolean", description: "Return only unread inbound messages" },
          limit: { type: "integer", description: "Max results (default 15)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_products",
      description: "List products in the ControlP.io catalog.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Filter by category name" },
          search: { type: "string", description: "Search product names or SKUs" },
          limit: { type: "integer", description: "Max results (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_production_items",
      description: "List production schedule items with optional status filter.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Status: pending | in_progress | completed | blocked | on_hold" },
          overdue_only: { type: "boolean", description: "Return only overdue items" },
          limit: { type: "integer", description: "Max results (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_sms",
      description:
        "Send an SMS to a customer phone number via Twilio. Use for order updates, proof reminders, appointment confirmations, and follow-ups.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient phone (10-digit US or E.164, e.g. +14805551234)" },
          message: { type: "string", description: "SMS message text (keep under 160 chars for a single segment)" },
          from_number: {
            type: "string",
            description: "Sender number. Defaults to +14809999906. Options: +14809999906, +14809999926",
          },
        },
        required: ["to", "message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_email",
      description:
        "Send a transactional email to a customer or contact via SMTP. Use for quotes, order summaries, proofing links, and follow-ups.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body (plain text or basic HTML)" },
          reply_to: { type: "string", description: "Optional reply-to address. Defaults to hello@controlp.io" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_content_draft",
      description:
        "Save generated content (blog post, email template, SMS campaign, social post, product description) to the drafts library.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["blog_post", "email_template", "sms_campaign", "social_post", "product_description", "other"],
            description: "Content type",
          },
          title: { type: "string", description: "Title or name for this piece of content" },
          content: { type: "string", description: "The full content text" },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags for filtering" },
        },
        required: ["type", "title", "content"],
      },
    },
  },
] as const;

// ─── Tool result type ────────────────────────────────────────────────────────

export type ToolCallRecord = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
};

// ─── Execution context ───────────────────────────────────────────────────────

export type ToolContext = {
  supabaseUrl: string;
  serviceRoleKey: string;
  actorId: string;
  conversationId?: string;
};

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const db = createClient(ctx.supabaseUrl, ctx.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  switch (name) {
    case "get_business_overview": return getBusinessOverview(db);
    case "list_orders": return listOrders(db, args);
    case "get_order_details": return getOrderDetails(db, args);
    case "list_customers": return listCustomers(db, args);
    case "list_messages": return listMessages(db, args);
    case "list_products": return listProducts(db, args);
    case "list_production_items": return listProductionItems(db, args);
    case "send_sms": return sendSms(db, args, ctx);
    case "send_email": return sendEmail(args);
    case "save_content_draft": return saveContentDraft(db, args, ctx);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ─── Tool implementations ────────────────────────────────────────────────────

async function getBusinessOverview(db: SupabaseClient) {
  const now = new Date().toISOString();
  const todayStr = now.slice(0, 10);
  const monthStart = todayStr.slice(0, 7) + "-01";

  const [orders, messages, productionItems, revenue] = await Promise.all([
    db.from("orders").select("status, payment_status, due_at, total").limit(500),
    db.from("messages").select("read_at, direction, channel").limit(500),
    db.from("production_schedule_items").select("status, is_blocked, due_date").limit(500),
    db.from("orders").select("total").eq("payment_status", "paid").gte("created_at", monthStart).limit(500),
  ]);

  const o = orders.data ?? [];
  const m = messages.data ?? [];
  const p = productionItems.data ?? [];
  const r = revenue.data ?? [];

  const monthRevenue = r.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

  return {
    orders: {
      total: o.length,
      by_status: groupCount(o, "status"),
      unpaid: o.filter((x) => ["unpaid", "pending", "partially_paid"].includes(x.payment_status ?? "")).length,
      overdue: o.filter((x) => x.due_at && x.due_at < now && !["completed", "shipped", "cancelled", "archived"].includes(x.status ?? "")).length,
    },
    messages: {
      total: m.length,
      unread_inbound: m.filter((x) => !x.read_at && x.direction === "inbound").length,
      by_channel: groupCount(m, "channel"),
    },
    production: {
      total: p.length,
      open: p.filter((x) => !["completed", "approved", "on_hold"].includes(x.status ?? "")).length,
      blocked: p.filter((x) => x.is_blocked).length,
      overdue: p.filter((x) => x.due_date && x.due_date < todayStr && !["completed", "approved"].includes(x.status ?? "")).length,
    },
    revenue: {
      month_to_date: monthRevenue,
      month_to_date_formatted: `$${monthRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
  };
}

async function listOrders(db: SupabaseClient, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 15, 50);
  let q = db
    .from("orders")
    .select("order_number, status, payment_status, production_status, total, company, customer_email, customer_phone, due_at, created_at, notes")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.status) q = q.eq("status", String(args.status));
  if (args.payment_status) q = q.eq("payment_status", String(args.payment_status));
  if (args.search) {
    const s = String(args.search);
    q = q.or(`order_number.ilike.%${s}%,company.ilike.%${s}%,customer_email.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { orders: data ?? [], count: data?.length ?? 0 };
}

async function getOrderDetails(db: SupabaseClient, args: Record<string, unknown>) {
  const { data, error } = await db
    .from("orders")
    .select("*")
    .ilike("order_number", `%${String(args.order_number)}%`)
    .limit(1)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: `Order #${args.order_number} not found.` };
  return { order: data };
}

async function listCustomers(db: SupabaseClient, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 15, 50);
  let q = db
    .from("users")
    .select("id, first_name, last_name, email, phone, company, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.search) {
    const s = String(args.search);
    q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,company.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { customers: data ?? [], count: data?.length ?? 0 };
}

async function listMessages(db: SupabaseClient, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 15, 50);
  let q = db
    .from("messages")
    .select("id, channel, direction, from_number, to_number, body, read_at, created_at, sender_name")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.channel && args.channel !== "all") q = q.eq("channel", String(args.channel));
  if (args.unread_only) q = q.is("read_at", null).eq("direction", "inbound");

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { messages: data ?? [], count: data?.length ?? 0 };
}

async function listProducts(db: SupabaseClient, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50);
  let q = db
    .from("products")
    .select("sku, name, category, status, base_price, sale_price, stock_status, customizer_enabled")
    .order("name", { ascending: true })
    .limit(limit);

  if (args.category) q = q.ilike("category", `%${String(args.category)}%`);
  if (args.search) {
    const s = String(args.search);
    q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,category.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { products: data ?? [], count: data?.length ?? 0 };
}

async function listProductionItems(db: SupabaseClient, args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50);
  const todayStr = new Date().toISOString().slice(0, 10);

  let q = db
    .from("production_schedule_items")
    .select("id, title, status, phase, is_blocked, blocker_type, blocker_reason, due_date, project_name")
    .order("due_date", { ascending: true })
    .limit(limit);

  if (args.status) q = q.eq("status", String(args.status));
  if (args.overdue_only) {
    q = q.lt("due_date", todayStr).not("status", "in", '("completed","approved","on_hold","canceled")');
  }

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { items: data ?? [], count: data?.length ?? 0 };
}

async function sendSms(db: SupabaseClient, args: Record<string, unknown>, ctx: ToolContext) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return { error: "Twilio credentials not configured." };

  const to = normalizePhone(String(args.to || ""));
  const message = String(args.message || "").trim();
  const from = String(args.from_number || process.env.TWILIO_PHONE_NUMBER || "+14809999906");

  if (!to) return { error: "Invalid phone number." };
  if (!message) return { error: "Message is required." };

  try {
    const client = twilio(accountSid, authToken);
    const msg = await client.messages.create({ to, from, body: message });

    await db.from("activity_logs").insert({
      actor_id: ctx.actorId,
      action: "agent_sms_sent",
      entity_type: "message",
      details: { to, from, body: message, sid: msg.sid },
    });

    return { success: true, sid: msg.sid, to, from, segments: Math.ceil(message.length / 160) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send SMS." };
  }
}

async function sendEmail(args: Record<string, unknown>) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  if (!smtpHost || !smtpUser || !smtpPass) return { error: "SMTP credentials not configured." };

  const to = String(args.to || "").trim();
  const subject = String(args.subject || "").trim();
  const body = String(args.body || "").trim();
  const replyTo = String(args.reply_to || process.env.SMTP_FROM || "hello@controlp.io");

  if (!to || !subject || !body) return { error: "to, subject, and body are all required." };

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const isHtml = body.trim().startsWith("<");
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `ControlP.io <${smtpUser}>`,
      to,
      subject,
      replyTo,
      ...(isHtml ? { html: body } : { text: body }),
    });
    return { success: true, messageId: info.messageId, to, subject };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send email." };
  }
}

async function saveContentDraft(db: SupabaseClient, args: Record<string, unknown>, ctx: ToolContext) {
  const { data, error } = await db
    .from("agent_content_drafts")
    .insert({
      user_id: ctx.actorId,
      conversation_id: ctx.conversationId ?? null,
      type: String(args.type || "other"),
      title: String(args.title || "Untitled"),
      content: String(args.content || ""),
      tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
      status: "draft",
    })
    .select("id, title, type")
    .single();

  if (error) return { error: error.message };
  return { success: true, draft_id: data.id, title: data.title, type: data.type };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupCount(arr: Record<string, unknown>[], key: string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    const val = String(item[key] ?? "unknown");
    acc[val] = (acc[val] ?? 0) + 1;
    return acc;
  }, {});
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return "";
}
