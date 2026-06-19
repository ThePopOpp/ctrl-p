-- ============================================================
-- Designer profiles & session bookings
-- ============================================================

CREATE TABLE IF NOT EXISTS designer_profiles (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid          REFERENCES users(id) ON DELETE SET NULL,
  name           text          NOT NULL,
  title          text          NOT NULL DEFAULT 'Graphic Designer',
  bio            text,
  avatar_url     text,
  hourly_rate    numeric(10,2) NOT NULL DEFAULT 100.00 CHECK (hourly_rate >= 0),
  specialties    text[]        NOT NULL DEFAULT '{}',
  is_active      boolean       NOT NULL DEFAULT true,
  -- weekly_schedule keys: mon tue wed thu fri sat sun
  -- each value: { "enabled": bool, "start": "HH:MM", "end": "HH:MM" }
  weekly_schedule jsonb NOT NULL DEFAULT '{
    "mon": {"enabled": true,  "start": "09:00", "end": "17:00"},
    "tue": {"enabled": true,  "start": "09:00", "end": "17:00"},
    "wed": {"enabled": true,  "start": "09:00", "end": "17:00"},
    "thu": {"enabled": true,  "start": "09:00", "end": "17:00"},
    "fri": {"enabled": true,  "start": "09:00", "end": "16:00"},
    "sat": {"enabled": false, "start": "09:00", "end": "13:00"},
    "sun": {"enabled": false, "start": "09:00", "end": "13:00"}
  }'::jsonb,
  sort_order     integer       NOT NULL DEFAULT 100,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

-- Designer session bookings (pricing-aware; separate from general booking_appointments)
CREATE TABLE IF NOT EXISTS designer_bookings (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id            uuid          NOT NULL REFERENCES designer_profiles(id) ON DELETE RESTRICT,
  order_id               uuid          REFERENCES orders(id) ON DELETE SET NULL,
  -- Snapshot of who booked (not requiring a user account)
  customer_first_name    text          NOT NULL,
  customer_last_name     text          NOT NULL,
  customer_email         text          NOT NULL,
  customer_phone         text,
  company_name           text,
  project_description    text,
  -- Timing
  start_time             timestamptz   NOT NULL,
  end_time               timestamptz   NOT NULL,
  duration_hours         numeric(4,2)  NOT NULL CHECK (duration_hours > 0 AND duration_hours <= 8),
  timezone               text          NOT NULL DEFAULT 'America/Phoenix',
  -- Pricing snapshot (locked at booking time)
  hourly_rate_snapshot   numeric(10,2) NOT NULL,
  total_price            numeric(10,2) NOT NULL,
  -- Status
  status                 text          NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'confirmed', 'in_progress', 'completed', 'canceled', 'rescheduled', 'no_show'
  )),
  -- Internal
  internal_notes         text,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT designer_bookings_valid_window CHECK (end_time > start_time)
);

-- ── Triggers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_designer_profiles_updated_at
  BEFORE UPDATE ON designer_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_designer_bookings_updated_at
  BEFORE UPDATE ON designer_bookings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_designer_profiles_active  ON designer_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_designer_profiles_sort    ON designer_profiles(sort_order);
CREATE INDEX IF NOT EXISTS idx_designer_bookings_designer ON designer_bookings(designer_id);
CREATE INDEX IF NOT EXISTS idx_designer_bookings_start   ON designer_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_designer_bookings_status  ON designer_bookings(status);

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE designer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_bookings  ENABLE ROW LEVEL SECURITY;

-- Public: read active profiles
CREATE POLICY "dp_public_read"
  ON designer_profiles FOR SELECT
  USING (is_active = true);

-- Admins: full access to profiles
CREATE POLICY "dp_admin_all"
  ON designer_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('super_admin', 'admin', 'staff')
    )
  );

-- Anyone can create a booking (validated in API layer)
CREATE POLICY "db_public_insert"
  ON designer_bookings FOR INSERT
  WITH CHECK (true);

-- Admins: full access to bookings
CREATE POLICY "db_admin_all"
  ON designer_bookings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('super_admin', 'admin', 'staff')
    )
  );

-- ── Seed ─────────────────────────────────────────────────────────────────────

INSERT INTO designer_profiles (name, title, bio, hourly_rate, specialties, is_active, sort_order)
VALUES (
  'Studio Team',
  'Design Studio',
  'Our experienced in-house team creates print-ready artwork for banners, signs, vehicle wraps, business cards, apparel, and more. Expect clear communication and fast turnaround.',
  100.00,
  ARRAY['Banners', 'Signs', 'Vehicle Wraps', 'Business Cards', 'Logos & Branding'],
  true,
  10
)
ON CONFLICT DO NOTHING;
