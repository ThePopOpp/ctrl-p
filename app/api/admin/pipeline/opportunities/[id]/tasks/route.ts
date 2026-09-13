import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { cleanDate, cleanText, isAssignableOwner, loadAccessibleOpportunity, readJson, recordEvent, verifyPipelineRequest } from "@/lib/pipeline/server";
import type { OpportunityTask } from "@/lib/pipeline/types";
import { isUuid } from "@/lib/pipeline/validation";

type Params = { params: Promise<{ id: string }> };

type TaskBody = { task_id?: string; title?: string; due_date?: string | null; assigned_to?: string | null; status?: string };

async function authorize(request: Request, id: string) {
  const verified = await verifyPipelineRequest(request, "edit");
  if (verified.error) return { response: verified.error };
  if (!isUuid(id)) return { response: jsonError("Opportunity not found.", 404) };
  const loaded = await loadAccessibleOpportunity(verified.context, id);
  if (loaded.response) return { response: loaded.response };
  return { context: verified.context, opportunity: loaded.opportunity };
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const body = await readJson<TaskBody>(request);
  const title = cleanText(body?.title, 300);
  if (!title) return jsonError("Name the task.");
  const due = cleanDate(body?.due_date);
  if (due === "invalid") return jsonError("Due date must be a date.");
  const assignee = body?.assigned_to ?? auth.opportunity.owner_id;
  if (assignee && (!isUuid(assignee) || !(await isAssignableOwner(client, assignee)))) return jsonError("Tasks can only be assigned to active staff.");

  const created = await client
    .from("pipeline_opportunity_tasks")
    .insert({ opportunity_id: id, title, due_date: due ?? null, assigned_to: assignee ?? null, created_by: actorId })
    .select("*")
    .single();
  if (created.error) return jsonError(created.error.message, 400);

  await recordEvent(client, { opportunity_id: id, event_type: "task_created", actor_id: actorId, summary: `Task added: ${title}`, details: { task_id: (created.data as OpportunityTask).id, due_date: due ?? null } });
  return NextResponse.json({ task: created.data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.response) return auth.response;
  const { client, actorId } = auth.context;

  const body = await readJson<TaskBody>(request);
  if (!body || !isUuid(body.task_id)) return jsonError("Task is required.");
  const existing = await client.from("pipeline_opportunity_tasks").select("*").eq("id", body.task_id).eq("opportunity_id", id).maybeSingle();
  if (!existing.data) return jsonError("Task not found.", 404);
  const task = existing.data as OpportunityTask;

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = cleanText(body.title, 300);
    if (!title) return jsonError("Name the task.");
    updates.title = title;
  }
  if (body.due_date !== undefined) {
    const due = cleanDate(body.due_date);
    if (due === "invalid") return jsonError("Due date must be a date.");
    updates.due_date = due ?? null;
  }
  if (body.assigned_to !== undefined) {
    if (body.assigned_to && (!isUuid(body.assigned_to) || !(await isAssignableOwner(client, body.assigned_to)))) return jsonError("Tasks can only be assigned to active staff.");
    updates.assigned_to = body.assigned_to || null;
  }
  if (body.status !== undefined) {
    if (body.status !== "open" && body.status !== "done") return jsonError("Unsupported task status.");
    updates.status = body.status;
    updates.completed_at = body.status === "done" ? new Date().toISOString() : null;
    updates.completed_by = body.status === "done" ? actorId : null;
  }
  if (!Object.keys(updates).length) return jsonError("No changes were provided.");

  const saved = await client.from("pipeline_opportunity_tasks").update(updates).eq("id", task.id).select("*").single();
  if (saved.error) return jsonError(saved.error.message, 400);

  if (body.status === "done" && task.status !== "done") {
    await recordEvent(client, { opportunity_id: id, event_type: "task_completed", actor_id: actorId, summary: `Task completed: ${task.title}`, details: { task_id: task.id } });
  }
  return NextResponse.json({ task: saved.data });
}
