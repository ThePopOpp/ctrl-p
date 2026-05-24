-- ============================================================
-- controlp.io - Production Schedule project grouping
-- Groups generated workflow items into expandable projects and
-- lets the dashboard decide which projects are visible on Gantt.
-- ============================================================

ALTER TABLE production_schedule_items
  ADD COLUMN IF NOT EXISTS schedule_group_id uuid,
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS workflow_template_slug text,
  ADD COLUMN IF NOT EXISTS workflow_template_name text;

CREATE INDEX IF NOT EXISTS production_schedule_items_schedule_group_id_idx
  ON production_schedule_items(schedule_group_id);
CREATE INDEX IF NOT EXISTS production_schedule_items_project_name_idx
  ON production_schedule_items(project_name);
CREATE INDEX IF NOT EXISTS production_schedule_items_workflow_template_slug_idx
  ON production_schedule_items(workflow_template_slug);

COMMENT ON COLUMN production_schedule_items.schedule_group_id IS
  'Groups generated or manually related schedule items into one project accordion/timeline selection.';
COMMENT ON COLUMN production_schedule_items.project_name IS
  'Customer-facing/internal project label shown in Scheduled Items.';
COMMENT ON COLUMN production_schedule_items.workflow_template_slug IS
  'Workflow template slug used to generate this schedule item, when applicable.';
COMMENT ON COLUMN production_schedule_items.workflow_template_name IS
  'Workflow template name used to generate this schedule item, when applicable.';
