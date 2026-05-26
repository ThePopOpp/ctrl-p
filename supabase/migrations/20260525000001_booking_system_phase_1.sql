-- ============================================================
-- controlp.io - Booking system phase 1
-- Public appointment booking, staff management, availability,
-- blocked time, notification tracking, and future calendar sync.
-- ============================================================

CREATE TABLE IF NOT EXISTS booking_appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0 AND buffer_before_minutes <= 240),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0 AND buffer_after_minutes <= 240),
  min_notice_minutes integer NOT NULL DEFAULT 120 CHECK (min_notice_minutes >= 0),
  max_days_in_advance integer NOT NULL DEFAULT 30 CHECK (max_days_in_advance > 0 AND max_days_in_advance <= 365),
  location_type text NOT NULL DEFAULT 'phone_call' CHECK (location_type IN (
    'phone_call',
    'video_meeting',
    'in_person',
    'onsite_installation',
    'vehicle_dropoff',
    'pickup',
    'delivery',
    'custom_location'
  )),
  meeting_url text,
  is_active boolean NOT NULL DEFAULT true,
  requires_payment boolean NOT NULL DEFAULT false,
  requires_deposit boolean NOT NULL DEFAULT false,
  deposit_amount numeric(10,2),
  color text NOT NULL DEFAULT '#a3ff12',
  display_order integer NOT NULL DEFAULT 100,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id uuid REFERENCES booking_appointment_types(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_staff_id uuid REFERENCES users(id) ON DELETE SET NULL,
  related_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  related_job_id uuid REFERENCES production_jobs(id) ON DELETE SET NULL,
  title text NOT NULL,
  customer_first_name text,
  customer_last_name text,
  customer_email text,
  customer_phone text,
  company_name text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Phoenix',
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN (
    'pending',
    'confirmed',
    'rescheduled',
    'canceled',
    'completed',
    'no_show',
    'follow_up_needed',
    'awaiting_payment',
    'awaiting_deposit',
    'awaiting_customer_info',
    'awaiting_approval'
  )),
  location_type text NOT NULL DEFAULT 'phone_call' CHECK (location_type IN (
    'phone_call',
    'video_meeting',
    'in_person',
    'onsite_installation',
    'vehicle_dropoff',
    'pickup',
    'delivery',
    'custom_location'
  )),
  location_name text,
  location_address text,
  meeting_url text,
  phone_number text,
  onsite_address text,
  internal_location_notes text,
  customer_notes text,
  internal_notes text,
  sms_consent boolean NOT NULL DEFAULT false,
  email_consent boolean NOT NULL DEFAULT true,
  external_calendar_provider text,
  external_calendar_id text,
  external_event_id text,
  cancellation_reason text,
  reschedule_reason text,
  completed_at timestamptz,
  canceled_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_appointments_valid_window CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS booking_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  appointment_type_id uuid REFERENCES booking_appointment_types(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Phoenix',
  is_available boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_availability_valid_window CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS booking_blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Phoenix',
  reason text,
  blocks_public_booking boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_blocked_times_valid_window CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS booking_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('google', 'microsoft', 'apple_ics', 'caldav', 'manual')),
  provider_account_email text,
  calendar_id text,
  calendar_name text,
  sync_direction text NOT NULL DEFAULT 'read_only' CHECK (sync_direction IN ('read_only', 'write_only', 'two_way')),
  blocks_availability boolean NOT NULL DEFAULT true,
  write_events boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES booking_appointments(id) ON DELETE CASCADE,
  recipient_type text NOT NULL DEFAULT 'customer' CHECK (recipient_type IN ('customer', 'staff', 'admin')),
  recipient_email text,
  recipient_phone text,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'dashboard')),
  notification_type text NOT NULL DEFAULT 'booking_confirmation',
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_question_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id uuid REFERENCES booking_appointment_types(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'textarea', 'email', 'phone', 'select', 'checkbox', 'date', 'url')),
  placeholder text,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]',
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_question_fields_unique_key UNIQUE (appointment_type_id, field_key)
);

CREATE TABLE IF NOT EXISTS booking_question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES booking_appointments(id) ON DELETE CASCADE,
  field_id uuid REFERENCES booking_question_fields(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_appointment_types_active_idx ON booking_appointment_types(is_active, display_order);
CREATE INDEX IF NOT EXISTS booking_appointments_type_idx ON booking_appointments(appointment_type_id);
CREATE INDEX IF NOT EXISTS booking_appointments_customer_idx ON booking_appointments(customer_id);
CREATE INDEX IF NOT EXISTS booking_appointments_staff_idx ON booking_appointments(assigned_staff_id);
CREATE INDEX IF NOT EXISTS booking_appointments_status_idx ON booking_appointments(status);
CREATE INDEX IF NOT EXISTS booking_appointments_time_idx ON booking_appointments(start_time, end_time);
CREATE INDEX IF NOT EXISTS booking_availability_rules_lookup_idx ON booking_availability_rules(appointment_type_id, user_id, day_of_week);
CREATE UNIQUE INDEX IF NOT EXISTS booking_availability_rules_default_unique_idx
  ON booking_availability_rules(day_of_week, start_time, end_time)
  WHERE user_id IS NULL AND appointment_type_id IS NULL;
CREATE INDEX IF NOT EXISTS booking_blocked_times_time_idx ON booking_blocked_times(start_time, end_time);
CREATE INDEX IF NOT EXISTS booking_calendar_connections_user_idx ON booking_calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS booking_notifications_appointment_idx ON booking_notifications(appointment_id);
CREATE INDEX IF NOT EXISTS booking_notifications_status_idx ON booking_notifications(status);
CREATE INDEX IF NOT EXISTS booking_question_fields_type_idx ON booking_question_fields(appointment_type_id, display_order);
CREATE INDEX IF NOT EXISTS booking_question_answers_appointment_idx ON booking_question_answers(appointment_id);

DROP TRIGGER IF EXISTS booking_appointment_types_updated_at ON booking_appointment_types;
CREATE TRIGGER booking_appointment_types_updated_at
  BEFORE UPDATE ON booking_appointment_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS booking_appointments_updated_at ON booking_appointments;
CREATE TRIGGER booking_appointments_updated_at
  BEFORE UPDATE ON booking_appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS booking_availability_rules_updated_at ON booking_availability_rules;
CREATE TRIGGER booking_availability_rules_updated_at
  BEFORE UPDATE ON booking_availability_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS booking_blocked_times_updated_at ON booking_blocked_times;
CREATE TRIGGER booking_blocked_times_updated_at
  BEFORE UPDATE ON booking_blocked_times FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS booking_calendar_connections_updated_at ON booking_calendar_connections;
CREATE TRIGGER booking_calendar_connections_updated_at
  BEFORE UPDATE ON booking_calendar_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS booking_question_fields_updated_at ON booking_question_fields;
CREATE TRIGGER booking_question_fields_updated_at
  BEFORE UPDATE ON booking_question_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS booking_question_answers_updated_at ON booking_question_answers;
CREATE TRIGGER booking_question_answers_updated_at
  BEFORE UPDATE ON booking_question_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE booking_appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_question_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_question_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_view_active_booking_appointment_types" ON booking_appointment_types;
CREATE POLICY "public_view_active_booking_appointment_types"
  ON booking_appointment_types FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "staff_manage_booking_appointment_types" ON booking_appointment_types;
CREATE POLICY "staff_manage_booking_appointment_types"
  ON booking_appointment_types FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_booking_appointments" ON booking_appointments;
CREATE POLICY "staff_manage_booking_appointments"
  ON booking_appointments FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "customers_view_own_booking_appointments" ON booking_appointments;
CREATE POLICY "customers_view_own_booking_appointments"
  ON booking_appointments FOR SELECT
  USING (customer_id = auth.uid() OR user_id = auth.uid());

DROP POLICY IF EXISTS "staff_manage_booking_availability_rules" ON booking_availability_rules;
CREATE POLICY "staff_manage_booking_availability_rules"
  ON booking_availability_rules FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_booking_blocked_times" ON booking_blocked_times;
CREATE POLICY "staff_manage_booking_blocked_times"
  ON booking_blocked_times FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_booking_calendar_connections" ON booking_calendar_connections;
CREATE POLICY "staff_manage_booking_calendar_connections"
  ON booking_calendar_connections FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_booking_notifications" ON booking_notifications;
CREATE POLICY "staff_manage_booking_notifications"
  ON booking_notifications FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "public_view_booking_question_fields" ON booking_question_fields;
CREATE POLICY "public_view_booking_question_fields"
  ON booking_question_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_appointment_types
      WHERE booking_appointment_types.id = booking_question_fields.appointment_type_id
        AND booking_appointment_types.is_active = true
    )
  );

DROP POLICY IF EXISTS "staff_manage_booking_question_fields" ON booking_question_fields;
CREATE POLICY "staff_manage_booking_question_fields"
  ON booking_question_fields FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

DROP POLICY IF EXISTS "staff_manage_booking_question_answers" ON booking_question_answers;
CREATE POLICY "staff_manage_booking_question_answers"
  ON booking_question_answers FOR ALL
  USING (is_staff_or_admin())
  WITH CHECK (is_staff_or_admin());

INSERT INTO booking_appointment_types
  (name, slug, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_in_advance, location_type, color, display_order)
VALUES
  ('Print Consultation', 'print-consultation', 'Print products, quotes, materials, timelines, and production planning.', 30, 0, 15, 120, 30, 'phone_call', '#a3ff12', 10),
  ('Design Consultation', 'design-consultation', 'Graphic design, branding, artwork cleanup, cards, signage, apparel, and custom setup.', 45, 0, 15, 120, 30, 'video_meeting', '#38bdf8', 20),
  ('Vehicle Wrap Consultation', 'vehicle-wrap-consultation', 'Vehicle wraps, decals, fleet graphics, measurements, and install details.', 60, 15, 15, 240, 45, 'in_person', '#f59e0b', 30),
  ('Window Tint / Film Appointment', 'window-tint-film', 'Vehicle tint, office film, privacy film, architectural film, or installation scheduling.', 60, 15, 15, 240, 45, 'onsite_installation', '#22c55e', 40),
  ('Installation Appointment', 'installation-appointment', 'Installs, onsite work, delivery, walkthroughs, and completion sign-offs.', 90, 15, 30, 240, 60, 'onsite_installation', '#f97316', 50),
  ('Pickup Appointment', 'pickup-appointment', 'Schedule pickup of completed print or product orders.', 15, 0, 0, 60, 14, 'pickup', '#84cc16', 60),
  ('File Review / Proof Review', 'file-proof-review', 'Review artwork, proofs, production requirements, or file issues with the customer.', 30, 0, 10, 120, 21, 'video_meeting', '#c084fc', 70),
  ('Digital Business Card Setup', 'digital-business-card-setup', 'Configure NFC/QR digital business cards, profile links, QR codes, and product options.', 30, 0, 15, 120, 30, 'video_meeting', '#06b6d4', 80)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO booking_availability_rules (day_of_week, start_time, end_time, timezone, is_available)
VALUES
  (1, '09:00', '17:00', 'America/Phoenix', true),
  (2, '09:00', '17:00', 'America/Phoenix', true),
  (3, '09:00', '17:00', 'America/Phoenix', true),
  (4, '09:00', '17:00', 'America/Phoenix', true),
  (5, '09:00', '16:00', 'America/Phoenix', true)
ON CONFLICT DO NOTHING;

INSERT INTO booking_question_fields
  (appointment_type_id, label, field_key, field_type, placeholder, help_text, is_required, display_order)
SELECT id, 'Project or order number', 'project_order_number', 'text', 'Optional order number', 'Connect this booking to an existing project if you have one.', false, 10
FROM booking_appointment_types
WHERE slug IN ('print-consultation', 'file-proof-review', 'pickup-appointment')
ON CONFLICT (appointment_type_id, field_key) DO NOTHING;

INSERT INTO booking_question_fields
  (appointment_type_id, label, field_key, field_type, placeholder, help_text, is_required, display_order)
SELECT id, 'What would you like help with?', 'service_interest', 'textarea', 'Tell us what you are trying to schedule.', 'A short note helps us prepare before the appointment.', false, 20
FROM booking_appointment_types
ON CONFLICT (appointment_type_id, field_key) DO NOTHING;

COMMENT ON TABLE booking_appointment_types IS
  'Bookable Controlp.io services such as print consultations, pickup appointments, installs, proof reviews, and digital card setup.';
COMMENT ON TABLE booking_appointments IS
  'Customer and staff appointment records created by public booking and managed from the admin dashboard.';
COMMENT ON TABLE booking_availability_rules IS
  'Default and appointment-type-specific weekly availability windows.';
COMMENT ON TABLE booking_blocked_times IS
  'Manual blocked/unavailable time that prevents public booking.';
COMMENT ON TABLE booking_calendar_connections IS
  'Future-ready calendar connection metadata; OAuth tokens are intentionally not stored in phase 1.';
COMMENT ON TABLE booking_notifications IS
  'Notification queue/history for booking confirmations, reminders, cancellations, and admin alerts.';
