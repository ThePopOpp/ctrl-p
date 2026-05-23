import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const ALLOWED_ROLES = ["super_admin", "admin", "employee", "staff", "production_manager", "designer", "installer", "customer_support"];
const DEPENDENCY_TYPES = new Set(["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"]);
type VerifiedAdminClient = NonNullable<Awaited<ReturnType<typeof verifyAdminRequest>>["adminClient"]>;

type DependencyBody = {
  id?: string;
  parent_item_id?: string;
  dependent_item_id?: string;
  source_item_id?: string;
  target_item_id?: string;
  dependency_type?: string;
  lag_days?: number | string | null;
  required_completion_date?: string | null;
  delay_impact_notes?: string | null;
  notes?: string | null;
  auto_shift_schedule?: boolean;
};

function dependencySelect() {
  return [
    "id",
    "parent_item_id",
    "dependent_item_id",
    "dependency_type",
    "lag_days",
    "required_completion_date",
    "delay_impact_notes",
    "notes",
    "auto_shift_schedule",
    "created_by",
    "created_at",
    "updated_at",
    "parent:production_schedule_items!production_schedule_dependencies_parent_item_id_fkey(id, title, status, due_date)",
    "dependent:production_schedule_items!production_schedule_dependencies_dependent_item_id_fkey(id, title, status, start_date)",
  ].join(", ");
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function buildPayload(body: DependencyBody, actorId: string, mode: "create" | "update") {
  const parentItemId = body.parent_item_id || body.source_item_id;
  const dependentItemId = body.dependent_item_id || body.target_item_id;
  const dependencyType = cleanText(body.dependency_type) || "finish_to_start";
  if (!DEPENDENCY_TYPES.has(dependencyType)) return { error: "Unsupported dependency type." };

  if (mode === "create" && (!parentItemId || !dependentItemId)) {
    return { error: "Both source and target schedule items are required." };
  }

  if (parentItemId && dependentItemId && parentItemId === dependentItemId) {
    return { error: "A schedule item cannot depend on itself." };
  }

  const notes = cleanText(body.notes) || cleanText(body.delay_impact_notes) || null;
  const payload: Record<string, unknown> = {
    dependency_type: dependencyType,
    lag_days: cleanNumber(body.lag_days),
    required_completion_date: cleanText(body.required_completion_date) || null,
    delay_impact_notes: notes,
    notes,
    auto_shift_schedule: body.auto_shift_schedule !== false,
  };

  if (parentItemId) payload.parent_item_id = parentItemId;
  if (dependentItemId) payload.dependent_item_id = dependentItemId;
  if (mode === "create") payload.created_by = actorId;

  return { payload };
}

async function createsCycle(adminClient: VerifiedAdminClient, sourceItemId: string, targetItemId: string) {
  const result = await adminClient
    .from("production_schedule_dependencies")
    .select("parent_item_id, dependent_item_id")
    .limit(1000);

  if (result.error) return { error: result.error.message };

  const graph = new Map<string, string[]>();
  for (const row of result.data ?? []) {
    const source = String(row.parent_item_id || "");
    const target = String(row.dependent_item_id || "");
    if (!source || !target) continue;
    graph.set(source, [...(graph.get(source) ?? []), target]);
  }
  graph.set(sourceItemId, [...(graph.get(sourceItemId) ?? []), targetItemId]);

  const seen = new Set<string>();
  const stack = [targetItemId];
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === sourceItemId) return { cycle: true };
    seen.add(current);
    stack.push(...(graph.get(current) ?? []));
  }

  return { cycle: false };
}

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const url = new URL(request.url);
  const itemId = url.searchParams.get("item_id");

  let query = verified.adminClient
    .from("production_schedule_dependencies")
    .select(dependencySelect())
    .order("created_at", { ascending: false })
    .limit(300);

  if (itemId) query = query.or(`parent_item_id.eq.${itemId},dependent_item_id.eq.${itemId}`);

  const result = await query;
  if (result.error) return jsonError(result.error.message, 400);

  return NextResponse.json({ dependencies: result.data ?? [] });
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as DependencyBody | null;
  if (!body) return jsonError("Dependency payload is required.");

  const built = buildPayload(body, verified.actorId, "create");
  if (built.error) return jsonError(built.error);
  if (!built.payload) return jsonError("Dependency payload could not be built.");

  const sourceItemId = String(built.payload.parent_item_id || "");
  const targetItemId = String(built.payload.dependent_item_id || "");
  const cycleCheck = await createsCycle(verified.adminClient, sourceItemId, targetItemId);
  if (cycleCheck.error) return jsonError(cycleCheck.error, 400);
  if (cycleCheck.cycle) return jsonError("This dependency would create a circular chain.");

  const result = await verified.adminClient
    .from("production_schedule_dependencies")
    .insert(built.payload)
    .select(dependencySelect())
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  const dependency = result.data as unknown as { id: string; parent_item_id?: string | null; dependent_item_id?: string | null };
  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_schedule_dependency_created",
    entity_type: "production_schedule_dependency",
    entity_id: dependency.id,
    details: { parent_item_id: dependency.parent_item_id, dependent_item_id: dependency.dependent_item_id },
  });

  return NextResponse.json({ dependency: result.data });
}

export async function PATCH(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as DependencyBody | null;
  if (!body?.id) return jsonError("Dependency id is required.");

  const built = buildPayload(body, verified.actorId, "update");
  if (built.error) return jsonError(built.error);
  if (!built.payload) return jsonError("Dependency payload could not be built.");

  const result = await verified.adminClient
    .from("production_schedule_dependencies")
    .update(built.payload)
    .eq("id", body.id)
    .select(dependencySelect())
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_schedule_dependency_updated",
    entity_type: "production_schedule_dependency",
    entity_id: body.id,
    details: built.payload,
  });

  return NextResponse.json({ dependency: result.data });
}

export async function DELETE(request: Request) {
  const verified = await verifyAdminRequest(request, ["super_admin", "admin", "employee", "staff", "production_manager"]);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return jsonError("Dependency id is required.");

  const result = await verified.adminClient
    .from("production_schedule_dependencies")
    .delete()
    .eq("id", body.id)
    .select("id, parent_item_id, dependent_item_id")
    .single();

  if (result.error) return jsonError(result.error.message, 400);

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_schedule_dependency_deleted",
    entity_type: "production_schedule_dependency",
    entity_id: body.id,
    details: result.data,
  });

  return NextResponse.json({ deleted: result.data });
}
