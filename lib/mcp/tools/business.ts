import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { executeTool } from "@/lib/admin/agent-tools";
import type { McpContext } from "../auth";
import { ToolError, defineTool, type ToolOutput } from "../audit";
import { confirmable, prepare } from "../confirm";

// Business actions shared with the in-app agent (/admin/agent), plus storage
// for site images and files. Sends to people always ask first.

function agentCtx(ctx: McpContext) {
  return { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!, actorId: ctx.user.id };
}

async function runAgentTool(ctx: McpContext, name: string, args: Record<string, unknown>): Promise<unknown> {
  const out = (await executeTool(name, args, agentCtx(ctx))) as { error?: string } | null;
  if (out && typeof out === "object" && "error" in out && out.error) throw new ToolError(String(out.error));
  return out;
}

confirmable("send_sms", async (ctx, p): Promise<ToolOutput> => ({ targetId: String(p.to), data: await runAgentTool(ctx, "send_sms", p) }));
confirmable("send_email", async (ctx, p): Promise<ToolOutput> => ({ targetId: String(p.to), data: await runAgentTool(ctx, "send_email", p) }));
confirmable("storage_delete", async (ctx, p): Promise<ToolOutput> => {
  const { data, error } = await ctx.db.storage.from(String(p.bucket)).remove(p.paths as string[]);
  if (error) throw new ToolError(error.message);
  return { table: `storage:${p.bucket}`, targetId: `${(data ?? []).length} files`, data: { deleted: (data ?? []).map((f) => f.name) } };
});

// Blocks obvious internal targets for upload-from-URL.
function safeSourceUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ToolError("source_url isn't a valid URL.");
  }
  if (u.protocol !== "https:") throw new ToolError("source_url must be https.");
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.includes(":")) {
    throw new ToolError("source_url must be a public address.");
  }
  return u;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function registerBusinessTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "business_overview", {
    domain: "business", risk: "read", title: "Business overview",
    description: "Snapshot of Ctrl+P: orders by status, revenue, production, open messages and more (same as the dashboard agent).",
    inputSchema: z.object({}),
  }, async () => ({ data: await runAgentTool(ctx, "get_business_overview", {}) }));

  defineTool(server, ctx, "send_sms", {
    domain: "comms", risk: "high", title: "Send a text message",
    description: "Text one person from the Ctrl+P Twilio number. Nothing is sent yet: returns a preview and a confirmation_id; call confirm_action after the person says yes.",
    inputSchema: z.object({
      to: z.string().min(7).max(20).describe("Phone number, e.g. +14805550142"),
      message: z.string().min(1).max(1600),
      from_number: z.string().max(20).optional(),
    }),
  }, async (args) => prepare(ctx, "send_sms", args, `Text ${args.to}: "${args.message.slice(0, 160)}"`, args));

  defineTool(server, ctx, "send_email", {
    domain: "comms", risk: "high", title: "Send an email",
    description: "Email one person from Ctrl+P (plain text, or HTML if body starts with <). Nothing is sent yet: returns a preview and a confirmation_id; call confirm_action after the person says yes.",
    inputSchema: z.object({
      to: z.email(),
      subject: z.string().min(1).max(300),
      body: z.string().min(1).max(100_000),
      reply_to: z.email().optional(),
    }),
  }, async (args) => prepare(ctx, "send_email", args, `Email ${args.to} with subject "${args.subject}"`, { ...args, body: args.body.slice(0, 2000) }));

  // ---- Storage (site images, artwork, files) ----
  defineTool(server, ctx, "storage_buckets", {
    domain: "storage", risk: "read", title: "List storage buckets",
    description: "Supabase Storage buckets (e.g. artwork) and whether they're public.",
    inputSchema: z.object({}),
  }, async () => {
    const { data, error } = await ctx.db.storage.listBuckets();
    if (error) throw new ToolError(error.message);
    return { data: { buckets: (data ?? []).map((b) => ({ name: b.name, public: b.public, created_at: b.created_at })) } };
  });

  defineTool(server, ctx, "storage_list", {
    domain: "storage", risk: "read", title: "List files",
    description: "Files and folders in a bucket under a prefix (folder).",
    inputSchema: z.object({
      bucket: z.string().max(100), prefix: z.string().max(500).default(""),
      search: z.string().max(100).optional(), limit: z.number().int().min(1).max(200).default(50), offset: z.number().int().min(0).default(0),
    }),
  }, async ({ bucket, prefix, search, limit, offset }) => {
    const { data, error } = await ctx.db.storage.from(bucket).list(prefix, { limit, offset, search, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new ToolError(error.message);
    return { table: `storage:${bucket}`, data: { bucket, prefix, files: (data ?? []).map((f) => ({ name: f.name, path: prefix ? `${prefix.replace(/\/$/, "")}/${f.name}` : f.name, folder: !f.id, size: f.metadata?.size, type: f.metadata?.mimetype, updated_at: f.updated_at })) } };
  });

  defineTool(server, ctx, "storage_upload", {
    domain: "storage", risk: "write", title: "Upload a file",
    description: "Put a file in a bucket from a public https URL (source_url) or base64 content. Returns its public URL (public buckets) or a 7-day signed URL, to use in products, content and cards.",
    inputSchema: z.object({
      bucket: z.string().max(100), path: z.string().min(1).max(500).describe("e.g. blog/2026/hero.jpg"),
      source_url: z.string().max(2000).optional(), base64: z.string().max(35_000_000).optional(),
      content_type: z.string().max(100).optional(), upsert: z.boolean().default(false),
    }),
  }, async ({ bucket, path, source_url, base64, content_type, upsert }) => {
    if (!!source_url === !!base64) throw new ToolError("Pass either source_url or base64.");
    let bytes: Uint8Array;
    let type = content_type;
    if (source_url) {
      const res = await fetch(safeSourceUrl(source_url), { redirect: "error" });
      if (!res.ok) throw new ToolError(`Couldn't download source_url (${res.status}).`);
      const len = Number(res.headers.get("content-length") || 0);
      if (len > MAX_UPLOAD_BYTES) throw new ToolError("That file is over 25 MB.");
      bytes = new Uint8Array(await res.arrayBuffer());
      type ??= res.headers.get("content-type") ?? undefined;
    } else {
      bytes = Uint8Array.from(Buffer.from(base64!, "base64"));
    }
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new ToolError("That file is over 25 MB.");
    const store = ctx.db.storage.from(bucket);
    const { error } = await store.upload(path, bytes, { contentType: type, upsert });
    if (error) throw new ToolError(error.message);
    const { data: buckets } = await ctx.db.storage.listBuckets();
    const isPublic = buckets?.find((b) => b.name === bucket)?.public;
    const url = isPublic ? store.getPublicUrl(path).data.publicUrl : (await store.createSignedUrl(path, 7 * 24 * 3600)).data?.signedUrl;
    return { table: `storage:${bucket}`, targetId: path, data: { bucket, path, bytes: bytes.byteLength, content_type: type, url, public: !!isPublic } };
  });

  defineTool(server, ctx, "storage_delete", {
    domain: "storage", risk: "high", title: "Delete files",
    description: "Delete files from a bucket. Returns a preview and a confirmation_id; call confirm_action after the person says yes. Admins only.",
    inputSchema: z.object({ bucket: z.string().max(100), paths: z.array(z.string().min(1).max(500)).min(1).max(100) }),
  }, async ({ bucket, paths }) => {
    if (!ctx.user.admin) throw new ToolError("Only admins can delete files.");
    return prepare(ctx, "storage_delete", { bucket, paths }, `Delete ${paths.length} file${paths.length === 1 ? "" : "s"} from ${bucket}`, { bucket, paths });
  });
}
