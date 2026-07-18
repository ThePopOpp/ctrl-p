-- ============================================================
-- Wall Studio — commerce integration into the existing orders flow.
-- Wall designs and installation are ordered as normal cart lines and
-- stored as order_items with product_id = NULL and detail in options jsonb.
-- The separate ws_orders / ws_order_items tables are now unused (kept, empty).
-- ============================================================

-- Allow non-catalog order lines (wall designs / installation service).
alter table order_items alter column product_id drop not null;

-- Bookings may optionally reference a main order rather than the unused ws_orders.
alter table ws_bookings drop constraint if exists ws_bookings_order_id_fkey;
