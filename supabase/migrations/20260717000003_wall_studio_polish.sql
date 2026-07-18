-- ============================================================
-- Wall Studio — polish: booking email + drop the unused ws_orders tables.
-- Orders now flow through the main orders/order_items tables.
-- ============================================================

alter table ws_bookings add column if not exists email text;

drop table if exists ws_order_items cascade;
drop table if exists ws_orders cascade;
