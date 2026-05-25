import { NextResponse } from "next/server";

import { ganttWorkflowTemplates } from "@/lib/admin/gantt-workflow-templates";
import { jsonError, verifyAdminRequest } from "@/lib/admin/server-auth";

const ALLOWED_ROLES = ["super_admin", "admin", "employee", "staff", "production_manager", "designer", "installer", "customer_support"];

type ApplyTemplateBody = {
  template_slug?: string;
  project_name?: string;
  start_date?: string;
  order_id?: string | null;
  order_item_id?: string | null;
  production_job_id?: string | null;
  product_id?: string | null;
  customer_id?: string | null;
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function nullable(value: unknown) {
  const text = clean(value);
  return text || null;
}

function itemType(type: string) {
  if (type === "payment" || type === "deposit" || type === "closeout" || type === "shipping") return "milestone";
  if (type === "quality_control") return "qc_check";
  return type;
}

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  return NextResponse.json({
    templates: ganttWorkflowTemplates.map((template) => ({
      name: template.name,
      slug: template.slug,
      category: template.category,
      description: template.description,
      product_type: template.product_type || null,
      item_count: template.items.length,
      items: template.items,
    })),
  });
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request, ALLOWED_ROLES);
  if (verified.error) return verified.error;

  const body = await request.json().catch(() => null) as ApplyTemplateBody | null;
  if (!body?.template_slug) return jsonError("Workflow template is required.");

  const template = ganttWorkflowTemplates.find((item) => item.slug === body.template_slug);
  if (!template) return jsonError("Workflow template was not found.", 404);

  const startDate = body.start_date ? new Date(`${body.start_date}T12:00:00`) : new Date();
  const scheduleGroupId = crypto.randomUUID();
  const projectName = clean(body.project_name) || template.name;
  const keyToGeneratedId = new Map<string, string>();
  const itemRows = template.items.map((item, index) => {
    const start = addDays(startDate, item.start_offset_days);
    const end = addDays(start, Math.max(0, item.duration_days));
    return {
      order_id: nullable(body.order_id),
      order_item_id: nullable(body.order_item_id),
      production_job_id: nullable(body.production_job_id),
      product_id: nullable(body.product_id),
      customer_id: nullable(body.customer_id),
      schedule_group_id: scheduleGroupId,
      project_name: projectName,
      workflow_template_slug: template.slug,
      workflow_template_name: template.name,
      hidden_from_schedule: false,
      title: item.title,
      description: item.description || `${template.name} workflow: ${item.owner_role}${item.requires_payment ? " | payment gate" : ""}${item.requires_approval ? " | approval gate" : ""}${item.requires_deposit ? " | deposit gate" : ""}`,
      item_type: itemType(item.item_type),
      phase: item.phase,
      status: item.status || "not_started",
      priority: item.priority || "normal",
      assigned_department: item.owner_role,
      start_date: dateOnly(start),
      start_offset_minutes: 0,
      end_date: dateOnly(end),
      due_date: dateOnly(end),
      estimated_duration_days: item.duration_days,
      progress_percent: 0,
      customer_visible: Boolean(item.customer_visible),
      internal_only: !item.customer_visible,
      is_blocked: Boolean(item.blocks_production),
      blocker_type: item.blocks_production ? "workflow_gate" : null,
      blocker_reason: item.blocks_production ? "Template gate blocks production until completed." : null,
      internal_notes: `Generated from workflow template "${template.name}". Template item key: ${item.key}.`,
      customer_notes: item.customer_visible ? item.title : null,
      sort_order: (index + 1) * 10,
      created_by: verified.actorId,
    };
  });

  const insertedItems = await verified.adminClient
    .from("production_schedule_items")
    .insert(itemRows)
    .select("id, title, order_id, sort_order");

  if (insertedItems.error) return jsonError(insertedItems.error.message, 400);

  (insertedItems.data || []).forEach((row, index) => {
    const templateItem = template.items[index];
    if (templateItem) keyToGeneratedId.set(templateItem.key, row.id);
  });

  const dependencyRows = template.items.flatMap((item) => {
    if (!item.depends_on) return [];
    const source = keyToGeneratedId.get(item.depends_on);
    const target = keyToGeneratedId.get(item.key);
    if (!source || !target || source === target) return [];
    return [{
      parent_item_id: source,
      dependent_item_id: target,
      dependency_type: item.dependency_type || "finish_to_start",
      lag_days: 0,
      auto_shift_schedule: true,
      notes: `Generated from "${template.name}" workflow template.`,
      delay_impact_notes: `Generated from "${template.name}" workflow template.`,
      created_by: verified.actorId,
    }];
  });

  let createdDependencies = 0;
  if (dependencyRows.length) {
    const dependencyResult = await verified.adminClient
      .from("production_schedule_dependencies")
      .insert(dependencyRows)
      .select("id");
    if (dependencyResult.error) return jsonError(dependencyResult.error.message, 400);
    createdDependencies = dependencyResult.data?.length || 0;
  }

  await verified.adminClient.from("activity_logs").insert({
    actor_id: verified.actorId,
    action: "production_schedule_template_applied",
    entity_type: "workflow_template",
    entity_id: template.slug,
    details: {
      template_slug: template.slug,
      template_name: template.name,
      project_name: projectName,
      schedule_group_id: scheduleGroupId,
      order_id: nullable(body.order_id),
      production_job_id: nullable(body.production_job_id),
      item_count: insertedItems.data?.length || 0,
      dependency_count: createdDependencies,
    },
  });

  return NextResponse.json({
    template: { name: template.name, slug: template.slug },
    project_name: projectName,
    schedule_group_id: scheduleGroupId,
    created_items: insertedItems.data ?? [],
    created_item_count: insertedItems.data?.length || 0,
    created_dependency_count: createdDependencies,
  });
}
