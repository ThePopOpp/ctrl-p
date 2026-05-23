-- ============================================================
-- controlp.io - Production Schedule dependency edge behavior
-- Extends real dependency records with node-editor metadata.
-- ============================================================

ALTER TABLE production_schedule_dependencies
  ADD COLUMN IF NOT EXISTS lag_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE production_schedule_dependencies
  ALTER COLUMN auto_shift_schedule SET DEFAULT true;

UPDATE production_schedule_dependencies
SET notes = COALESCE(notes, delay_impact_notes)
WHERE notes IS NULL
  AND delay_impact_notes IS NOT NULL;

ALTER TABLE production_schedule_dependencies
  DROP CONSTRAINT IF EXISTS production_schedule_dependencies_unique;

ALTER TABLE production_schedule_dependencies
  ADD CONSTRAINT production_schedule_dependencies_unique_edge_type
  UNIQUE (parent_item_id, dependent_item_id, dependency_type);

COMMENT ON COLUMN production_schedule_dependencies.parent_item_id IS
  'Source schedule item for the dependency edge.';
COMMENT ON COLUMN production_schedule_dependencies.dependent_item_id IS
  'Target schedule item for the dependency edge.';
COMMENT ON COLUMN production_schedule_dependencies.lag_days IS
  'Optional lag between the source edge and target edge, measured in days.';
COMMENT ON COLUMN production_schedule_dependencies.auto_shift_schedule IS
  'When true, future scheduling logic may shift dependent target items when the source item moves.';
