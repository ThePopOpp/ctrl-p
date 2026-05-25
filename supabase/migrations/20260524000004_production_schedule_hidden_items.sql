-- ============================================================
-- controlp.io - Production Schedule hidden task controls
-- Lets staff hide individual schedule items from Scheduled Items
-- and Gantt views without deleting the production record.
-- ============================================================

ALTER TABLE production_schedule_items
  ADD COLUMN IF NOT EXISTS hidden_from_schedule boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS production_schedule_items_hidden_from_schedule_idx
  ON production_schedule_items(hidden_from_schedule);

COMMENT ON COLUMN production_schedule_items.hidden_from_schedule IS
  'Hides an individual schedule item from Scheduled Items and Gantt timeline views without deleting it.';
