import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool } from "../audit";
import { confirmationStatus, runConfirmed } from "../confirm";

export function registerAccountTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "whoami", {
    domain: "account", risk: "read", title: "Who am I",
    description: "The signed-in Ctrl+P user, their role, what this connection may do, and which app is connected.",
    inputSchema: z.object({}),
  }, async () => ({
    data: {
      user_id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
      connected_app: ctx.user.clientId || null,
      access: ctx.user.admin
        ? "full: read, create, update and delete every table; deletes, bulk changes and sends ask first"
        : ctx.user.staff
          ? "staff: read, create and update; deletes, bulk changes and user changes need an admin"
          : "none: this connector is for active Ctrl+P staff and admins",
    },
  }));
}

export function registerMetaTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "tool_search", {
    domain: "meta", risk: "read", title: "Find tools",
    description: "Search the tools you can use by keyword or domain. Each result says its risk: read (changes nothing), write (changes something), high (needs confirm_action).",
    inputSchema: z.object({
      query: z.string().trim().max(100).optional(),
      domain: z.string().max(40).optional(),
      risk: z.enum(["read", "write", "high"]).optional(),
    }),
  }, async ({ query, domain, risk }) => {
    const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const hits = ctx.catalog
      .filter((t) => (!domain || t.domain === domain) && (!risk || t.risk === risk))
      .map((t) => {
        const hay = `${t.name} ${t.title} ${t.description}`.toLowerCase();
        return { t, score: words.reduce((n, w) => n + (t.name.includes(w) ? 3 : hay.includes(w) ? 1 : 0), 0) };
      })
      .filter((x) => !words.length || x.score > 0)
      .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name))
      .slice(0, 25)
      .map(({ t }) => ({ name: t.name, title: t.title, risk: t.risk, domain: t.domain, description: t.description.slice(0, 240) }));
    return { data: { tools: hits, domains: [...new Set(ctx.catalog.map((t) => t.domain))].sort() } };
  });

  defineTool(server, ctx, "confirm_action", {
    domain: "meta", risk: "high", title: "Confirm an action",
    description: "Runs a high-risk action a tool prepared (it returned needs_confirmation and a confirmation_id). Only call after showing the person what will happen and getting a clear yes. Each id works once, for 15 minutes, for the person and app that asked.",
    inputSchema: z.object({ confirmation_id: z.uuid() }),
  }, ({ confirmation_id }) => runConfirmed(ctx, confirmation_id));

  defineTool(server, ctx, "confirm_status", {
    domain: "meta", risk: "read", title: "Check a confirmation",
    description: "Whether a prepared action is still waiting (pending), was carried out (used) or expired.",
    inputSchema: z.object({ confirmation_id: z.uuid() }),
  }, async ({ confirmation_id }) => ({ targetId: confirmation_id, data: await confirmationStatus(ctx, confirmation_id) }));

  defineTool(server, ctx, "audit_log_list", {
    domain: "meta", risk: "read", title: "Recent connector activity",
    description: "The latest MCP tool calls (who, which app, which tool, ok or error). Admins see everyone's; staff see their own.",
    inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(25) }),
  }, async ({ limit }) => {
    let q = ctx.db.from("mcp_audit_log").select("created_at, user_id, client_id, tool, target_table, target_id, ok, error").order("created_at", { ascending: false }).limit(limit);
    if (!ctx.user.admin) q = q.eq("user_id", ctx.user.id);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: { calls: data ?? [] } };
  });
}
