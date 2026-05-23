-- ============================================================
-- controlp.io - Production Schedule sub-day timing and reorder
-- Adds minute offsets so timeline items can start inside a day.
-- ============================================================

ALTER TABLE production_schedule_items
  ADD COLUMN IF NOT EXISTS start_offset_minutes integer NOT NULL DEFAULT 0
    CHECK (start_offset_minutes >= 0 AND start_offset_minutes < 1440);

CREATE INDEX IF NOT EXISTS production_schedule_items_sort_order_idx
  ON production_schedule_items(sort_order);

COMMENT ON COLUMN production_schedule_items.start_offset_minutes IS
  'Minutes after midnight for sub-day Gantt placement. Example: 600 means 10:00 AM on start_date.';
