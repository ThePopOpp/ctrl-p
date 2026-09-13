import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";
import { sanitizeStageConfig } from "@/lib/pipeline/guidance";
import type {
  Opportunity,
  OpportunityEventType,
  OpportunityLineItem,
  OpportunityQuote,
  PipelineAccess,
  StaffMember,
  StageConfigMap,
} from "@/lib/pipeline/types";
import { permissionsForRole } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ADMIN_CONSOLE_ROLES } from "@/lib/rbac/roles";

export type PipelineContext = {
  actorId: string;
  actorRole: string;
  client: SupabaseClient;
  access: PipelineAccess;
};

export type PipelineNeed = "view" | "edit" | "manage";

/**
 * Authenticates an admin-console user and resolves their pipeline permissions.
 * Every pipeline route calls this before touching data.
 */
export async function verifyPipelineRequest(
  request: Request,
  need: PipelineNeed,
): Promise<{ error: NextResponse; context?: undefined } | { error?: undefined; context: PipelineContext }> {
  const verified = await verifyAdminRequest(request, [...ADMIN_CONSOLE_ROLES]);
  if (verified.error) return { error: verified.error };
  const { actorId, actor, adminClient } = verified;

  const permissions = permissionsForRole(actor.role);
  const canViewAll = permissions.includes(PERMISSIONS.PIPELINE_VIEW_ALL);
  const canViewAssigned = permissions.includes(PERMISSIONS.PIPELINE_VIEW_ASSIGNED);
  const canEdit = permissions.includes(PERMISSIONS.PIPELINE_EDIT);
  const canManage = permissions.includes(PERMISSIONS.PIPELINE_MANAGE);

  if (!canViewAll && !canViewAssigned) return { error: jsonError("Your role does not have access to the Pipeline.", 403) };
  if (need === "edit" && !canEdit) return { error: jsonError("Your role can view the Pipeline but not change it.", 403) };
  if (need === "manage" && !canManage) return { error: jsonError("Only pipeline administrators can change stage settings.", 403) };

  return {
    context: {
      actorId,
      actorRole: String(actor.role),
      client: adminClient,
      access: { canViewAll, canEdit, canManage, actorId },
    },
  };
}

/** Assigned-only users see and change only opportunities they own. */
export function canAccessOpportunity(access: PipelineAccess, opportunity: Pick<Opportunity, "owner_id">) {
  return access.canViewAll || opportunity.owner_id === access.actorId;
}

export async function readJson<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}

// ── Validation helpers ──────────────────────────────────────────────────────

/** Trimmed string, null when empty, undefined when the key was not supplied. */
export function cleanText(value: unknown, max = 2000): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim().slice(0, max);
  return text || null;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD or null; returns "invalid" for anything else that was supplied. */
export function cleanDate(value: unknown): string | null | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const text = String(value).slice(0, 10);
  if (!DATE_RE.test(text) || Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) return "invalid";
  return text;
}

/** Non-negative number or null; "invalid" for anything unparseable. */
export function cleanNumber(value: unknown, { max = 1e10 }: { max?: number } = {}): number | null | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) return "invalid";
  return Math.round(number * 100) / 100;
}

// ── Loaders ─────────────────────────────────────────────────────────────────

export async function loadOpportunity(client: SupabaseClient, id: string) {
  const result = await client.from("pipeline_opportunities").select("*").eq("id", id).maybeSingle();
  return { opportunity: (result.data as Opportunity | null) ?? null, error: result.error };
}

export async function loadLineItems(client: SupabaseClient, opportunityId: string) {
  const result = await client
    .from("pipeline_opportunity_line_items")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (result.data as OpportunityLineItem[] | null) ?? [];
}

export async function loadCurrentQuote(client: SupabaseClient, opportunityId: string) {
  const result = await client
    .from("pipeline_opportunity_quotes")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("is_current", true)
    .maybeSingle();
  return (result.data as OpportunityQuote | null) ?? null;
}

export async function loadStageConfig(client: SupabaseClient): Promise<StageConfigMap> {
  const result = await client.from("pipeline_stage_settings").select("stage, probability, goal, actions, items");
  if (result.error || !result.data) return {};
  const raw: Record<string, unknown> = {};
  for (const row of result.data as { stage: string; probability: number; goal: string; actions: unknown; items: unknown }[]) {
    raw[row.stage] = { probability: row.probability, goal: row.goal, actions: row.actions, items: row.items };
  }
  return sanitizeStageConfig(raw);
}

export async function loadStaff(client: SupabaseClient): Promise<StaffMember[]> {
  const result = await client
    .from("users")
    .select("id, full_name, email, role")
    .in("role", [...ADMIN_CONSOLE_ROLES])
    .eq("status", "active")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });
  return (result.data as StaffMember[] | null) ?? [];
}

/** An owner must be an active admin-console user. */
export async function isAssignableOwner(client: SupabaseClient, userId: string) {
  const result = await client
    .from("users")
    .select("id")
    .eq("id", userId)
    .in("role", [...ADMIN_CONSOLE_ROLES])
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(result.data);
}

// ── History ─────────────────────────────────────────────────────────────────

export type EventInsert = {
  opportunity_id: string;
  event_type: OpportunityEventType;
  actor_id: string;
  from_stage?: string | null;
  to_stage?: string | null;
  from_owner_id?: string | null;
  to_owner_id?: string | null;
  log_kind?: string | null;
  summary?: string | null;
  body?: string | null;
  details?: Record<string, unknown>;
  is_manual_log?: boolean;
  occurred_at?: string;
};

export async function recordEvent(client: SupabaseClient, event: EventInsert) {
  const result = await client.from("pipeline_opportunity_events").insert({ details: {}, ...event });
  return result.error;
}

export async function logActivity(client: SupabaseClient, actorId: string, action: string, opportunityId: string, details: Record<string, unknown>) {
  await client.from("activity_logs").insert({
    actor_id: actorId,
    action,
    entity_type: "pipeline_opportunity",
    entity_id: opportunityId,
    details,
  });
}

export function notFound() {
  return jsonError("Opportunity not found.", 404);
}

/** Load an opportunity and enforce record access in one step. */
export async function loadAccessibleOpportunity(context: PipelineContext, id: string) {
  const { opportunity, error } = await loadOpportunity(context.client, id);
  if (error) return { response: jsonError(error.message, 400) };
  if (!opportunity || !canAccessOpportunity(context.access, opportunity)) return { response: notFound() };
  return { opportunity };
}
