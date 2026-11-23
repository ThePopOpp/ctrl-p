import type { CallToolResult, McpServer, ToolAnnotations } from "@modelcontextprotocol/server";
import type { z } from "zod";
import type { McpContext, Risk } from "./auth";

const MAX_RESULT_CHARS = 25_000;

// A failure the caller should see as-is ("Order not found").
export class ToolError extends Error {}

export type ToolOutput = { data: unknown; table?: string | null; targetId?: string | null };

// Appends to mcp_audit_log. Never throws: a failed audit write must not fail the tool.
export async function audit(
  ctx: McpContext,
  entry: { tool: string; ok: boolean; table?: string | null; targetId?: string | null; error?: string },
) {
  try {
    const { error } = await ctx.db.from("mcp_audit_log").insert({
      user_id: ctx.user.id,
      client_id: ctx.user.clientId || null,
      tool: entry.tool,
      target_table: entry.table ?? null,
      target_id: entry.targetId ? String(entry.targetId).slice(0, 200) : null,
      ok: entry.ok,
      error: entry.error?.slice(0, 500) ?? null,
    });
    if (error) console.error(`[mcp:audit] ${entry.tool}`, error.message);
  } catch (e) {
    console.error(`[mcp:audit] ${entry.tool}`, e);
  }
}

function text(value: unknown, isError = false): CallToolResult {
  let body = typeof value === "string" ? value : JSON.stringify(value);
  if (body.length > MAX_RESULT_CHARS) body = `${body.slice(0, MAX_RESULT_CHARS)}… [truncated; narrow the request with columns, filters or a smaller limit]`;
  return { content: [{ type: "text", text: body }], ...(isError ? { isError: true } : {}) };
}

const HINTS: Record<Risk, ToolAnnotations> = {
  read: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  write: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  high: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
};

// Registers a tool whose every call is audited and whose errors come back as
// plain sentences. `risk` sets the MCP annotations.
export function defineTool<S extends z.ZodObject>(
  server: McpServer,
  ctx: McpContext,
  name: string,
  config: { title: string; description: string; inputSchema: S; risk: Risk; domain: string },
  run: (args: z.infer<S>) => Promise<ToolOutput>,
) {
  ctx.catalog.push({ name, title: config.title, description: config.description, risk: config.risk, domain: config.domain });
  const inputSchema: z.ZodObject = config.inputSchema;
  const invoke = async (args: Record<string, unknown>) => {
    try {
      const out = await run(args as z.infer<S>);
      await audit(ctx, { tool: name, ok: true, table: out.table, targetId: out.targetId });
      return text(out.data);
    } catch (e) {
      const message = e instanceof ToolError ? e.message : "Something went wrong. Try again.";
      if (!(e instanceof ToolError)) console.error(`[mcp] ${name}`, e);
      await audit(ctx, { tool: name, ok: false, error: e instanceof Error ? e.message : String(e) });
      return text(message, true);
    }
  };
  ctx.handlers.set(name, invoke);
  server.registerTool(
    name,
    { title: config.title, description: config.description, annotations: HINTS[config.risk], inputSchema },
    (args) => invoke(args as Record<string, unknown>),
  );
}
