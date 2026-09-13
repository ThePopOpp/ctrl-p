import { NextResponse } from "next/server";

import { jsonError } from "@/lib/admin/server-auth";
import { sanitizeStageConfig } from "@/lib/pipeline/guidance";
import { loadStageConfig, readJson, verifyPipelineRequest } from "@/lib/pipeline/server";
import { STAGE_ORDER } from "@/lib/pipeline/stages";

export async function GET(request: Request) {
  const verified = await verifyPipelineRequest(request, "view");
  if (verified.error) return verified.error;
  return NextResponse.json({ stageConfig: await loadStageConfig(verified.context.client) });
}

/**
 * Replace the stage guidance. Stages sent as `null` are reset to the built-in
 * defaults by removing their stored row. Changes apply to every opportunity.
 */
export async function PUT(request: Request) {
  const verified = await verifyPipelineRequest(request, "manage");
  if (verified.error) return verified.error;
  const { client, actorId } = verified.context;

  const body = await readJson<{ stages?: Record<string, unknown> }>(request);
  if (!body?.stages || typeof body.stages !== "object") return jsonError("Stage settings are required.");

  const resets = STAGE_ORDER.filter((stage) => body.stages && stage in body.stages && body.stages[stage] === null);
  const stages = sanitizeStageConfig(body.stages);
  const rows = Object.entries(stages).map(([stage, config]) => ({
    stage,
    probability: config.probability,
    goal: config.goal,
    actions: config.actions,
    items: config.items,
    updated_by: actorId,
  }));

  if (rows.length) {
    const saved = await client.from("pipeline_stage_settings").upsert(rows, { onConflict: "stage" });
    if (saved.error) return jsonError(saved.error.message, 400);
  }
  if (resets.length) {
    const removed = await client.from("pipeline_stage_settings").delete().in("stage", resets);
    if (removed.error) return jsonError(removed.error.message, 400);
  }

  await client.from("activity_logs").insert({
    actor_id: actorId,
    action: "pipeline_stage_settings_updated",
    entity_type: "pipeline_settings",
    entity_id: null,
    details: { stages: rows.map((row) => row.stage), reset: resets },
  });

  return NextResponse.json({ stageConfig: await loadStageConfig(client) });
}
