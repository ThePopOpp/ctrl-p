import { NextResponse } from "next/server";

import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const ALLOWED_ROLES = ["super_admin", "admin", "employee", "staff", "production_manager", "designer", "installer", "customer_support"];
const DEPENDENCY_TYPES = new Set(["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"]);

type DependencyBody = {
  id?: string;
  parent_item_id?: string;
  dependent_item_id?: string;
  dependency_type?: string;
  required_completion_date?: string | null;
  delay_impact_notes?: string | null;
  auto_shift_schedule?: boolean;
};

function dependencySelect() {
  return [
    "id",
    "parent_item_id",
    "dependent_item_id",
    "dependency_type",
    "required_completion_date",
    "delay_impact_notes",
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

function buildPayload(body: DependencyBody, actorId: string, mode: "create" | "update") {
  const dependencyType = cleanText(body.dependency_type) || "finish_to_start";
  if (!DEPENDENCY_TYPES.has(dependencyType)) return { error: "Unsupported dependency type." };

  if (mode === "create" && (!body.parent_item_id || !body.dependent_item_id)) {
    return { error: "Both parent and dependent schedule items are required." };
  }

  if (body.parent_item_id && body.dependent_item_id && body.parent_item_id === body.dependent_item_id) {
    return { error: "A schedule item cannot depend on itself." };
  }

  const payload: Record<string, unknown> = {
    dependency_type: dependencyType,
    required_completion_date: cleanText(body.required_completion_date) || null,
    delay_impact_notes: cleanText(body.delay_impact_notes) || null,
    auto_shift_schedule: Boolean(body.auto_shift_schedule),
  };

  if (body.parent_item_id) payload.parent_item_id = body.parent_item_id;
  if (body.dependent_item_id) payload.dependent_item_id = body.dependent_item_id;
  if (mode === "create") payload.created_by = actorId;

  return { payload };
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
