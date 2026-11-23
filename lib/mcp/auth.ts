import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import { ADMIN_CONSOLE_ROLES } from "@/lib/rbac/roles";

export type Risk = "read" | "write" | "high";
export type ToolInfo = { name: string; title: string; description: string; risk: Risk; domain: string };

export type McpUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  clientId: string;
  // Active admin-console staff: gets the data tools.
  staff: boolean;
  // super_admin / admin: may also delete and change users.
  admin: boolean;
};

export type McpContext = {
  // Service-role client. Only reached after the token and role checks below,
  // the same model the /admin API routes use (lib/admin/server-auth.ts).
  db: SupabaseClient;
  user: McpUser;
  catalog: ToolInfo[];
  handlers: Map<string, (args: Record<string, unknown>) => Promise<CallToolResult>>;
};

const FULL_ADMIN_ROLES = new Set(["super_admin", "admin"]);
const STAFF_ROLES = new Set<string>(ADMIN_CONSOLE_ROLES);

export function serviceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function publicClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Validates `Authorization: Bearer <Supabase access token>` (issued by the
// Supabase OAuth 2.1 server to Claude/ChatGPT, or a normal session token).
// Returns null for a missing, malformed, expired or non-user token.
export async function verifyBearer(req: Request): Promise<AuthInfo | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+([A-Za-z0-9._-]+)$/i)?.[1];
  if (!token) return null;

  // getClaims verifies the JWT against the project's JWKS (ES256), locally.
  const res = await publicClient().auth.getClaims(token).catch(() => null);
  const c = res?.data?.claims;
  if (!res || res.error || !c?.sub || c.role !== "authenticated") return null;
  if (typeof c.exp === "number" && c.exp * 1000 <= Date.now()) return null;

  return {
    token,
    clientId: typeof c.client_id === "string" ? c.client_id : "",
    scopes: typeof c.scope === "string" ? c.scope.split(" ").filter(Boolean) : [],
    expiresAt: typeof c.exp === "number" ? c.exp : undefined,
    extra: { userId: c.sub, email: typeof c.email === "string" ? c.email : null },
  };
}

// Loads the caller's Ctrl+P profile and decides what they may do.
export async function contextFromAuth(auth: AuthInfo | undefined): Promise<McpContext> {
  const userId = auth?.extra?.userId;
  if (!auth || typeof userId !== "string") throw new Error("MCP request reached the server without verified auth");

  const db = serviceClient();
  const { data: profile } = await db
    .from("users")
    .select("id, email, full_name, role, status, deleted_at")
    .eq("id", userId)
    .maybeSingle();

  const role = String(profile?.role ?? "customer");
  const active = !!profile && profile.status === "active" && !profile.deleted_at;
  return {
    db,
    user: {
      id: userId,
      email: (profile?.email as string | null) ?? (auth.extra?.email as string | null) ?? null,
      name: (profile?.full_name as string | null) ?? null,
      role,
      clientId: auth.clientId,
      staff: active && STAFF_ROLES.has(role),
      admin: active && FULL_ADMIN_ROLES.has(role),
    },
    catalog: [],
    handlers: new Map(),
  };
}

// In-memory, per-process: 120 calls per user per minute.
const WINDOW_MS = 60_000;
const MAX_CALLS = 120;
const windows = new Map<string, { start: number; count: number }>();

export function rateLimited(userId: string): number | null {
  const now = Date.now();
  const w = windows.get(userId);
  if (!w || now - w.start >= WINDOW_MS) {
    windows.set(userId, { start: now, count: 1 });
    if (windows.size > 10_000) for (const [k, v] of windows) if (now - v.start >= WINDOW_MS) windows.delete(k);
    return null;
  }
  w.count += 1;
  return w.count > MAX_CALLS ? Math.ceil((w.start + WINDOW_MS - now) / 1000) : null;
}
