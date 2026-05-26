-- ============================================================
-- controlp.io - Customer profile photos
-- Adds an optional profile photo URL for dashboard sidebars,
-- customer profile pages, and future customer-facing workflows.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_photo_url text;

COMMENT ON COLUMN users.profile_photo_url IS
  'Customer profile photo used in customer dashboard sidebars and profile views.';
