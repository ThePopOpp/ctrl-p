import type { McpContext } from "./auth";
import { ToolError, type ToolOutput } from "./audit";

// High-risk actions run in two steps: the tool returns a preview and a
// confirmation id (mcp_confirmations, valid 15 minutes, once, only for the
// person and app that asked), the person says yes, then confirm_action runs it.

type Handler = (ctx: McpContext, payload: Record<string, unknown>) => Promise<ToolOutput>;
const HANDLERS = new Map<string, Handler>();

export function confirmable(action: string, run: Handler) {
  HANDLERS.set(action, run);
}

export async function prepare(
  ctx: McpContext,
  action: string,
  payload: Record<string, unknown>,
  summary: string,
  preview?: unknown,
): Promise<ToolOutput> {
  if (!HANDLERS.has(action)) throw new Error(`No confirm handler for ${action}`);
  const { data, error } = await ctx.db
    .from("mcp_confirmations")
    .insert({ user_id: ctx.user.id, client_id: ctx.user.clientId || null, tool: action, payload, summary: summary.slice(0, 2000) })
    .select("id, expires_at")
    .single();
  if (error || !data) throw new Error(`Could not store confirmation: ${error?.message}`);
  return {
    data: {
      needs_confirmation: true,
      ask: `${summary}?`,
      preview,
      confirmation_id: data.id,
      expires_at: data.expires_at,
      next: "Show the person exactly what will happen and ask. Only after a clear yes, call confirm_action with confirmation_id. If they say no, do nothing.",
    },
  };
}

// Claims a confirmation (once) and runs its action.
export async function runConfirmed(ctx: McpContext, confirmationId: string): Promise<ToolOutput> {
  let q = ctx.db
    .from("mcp_confirmations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", confirmationId)
    .eq("user_id", ctx.user.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString());
  q = ctx.user.clientId ? q.eq("client_id", ctx.user.clientId) : q.is("client_id", null);
  const { data, error } = await q.select("tool, payload").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ToolError("That confirmation has expired, was already used, or isn't yours. Ask for the action again.");
  const run = HANDLERS.get(data.tool);
  if (!run) throw new ToolError("That action can't be confirmed here.");
  return run(ctx, data.payload as Record<string, unknown>);
}

export async function confirmationStatus(ctx: McpContext, confirmationId: string) {
  const { data, error } = await ctx.db
    .from("mcp_confirmations")
    .select("tool, summary, expires_at, used_at, created_at")
    .eq("id", confirmationId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ToolError("Confirmation not found or it isn't yours.");
  const status = data.used_at ? "used" : new Date(data.expires_at) < new Date() ? "expired" : "pending";
  return { status, action: data.tool, summary: data.summary, expires_at: data.expires_at, used_at: data.used_at };
}
