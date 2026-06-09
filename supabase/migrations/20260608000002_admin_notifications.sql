-- Admin notification feed: new orders, design submissions, file uploads
CREATE TABLE IF NOT EXISTS admin_notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text        NOT NULL DEFAULT 'general',
  title           text        NOT NULL,
  body            text,
  order_id        uuid        REFERENCES orders(id) ON DELETE SET NULL,
  design_draft_id uuid        REFERENCES design_drafts(id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES users(id) ON DELETE SET NULL,
  meta            jsonb       NOT NULL DEFAULT '{}',
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx ON admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_unread_idx ON admin_notifications (created_at DESC) WHERE read_at IS NULL;

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Staff can read all admin notifications
CREATE POLICY "staff_read_admin_notifications" ON admin_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin','production_manager','designer','installer','customer_support')
        AND users.deleted_at IS NULL
    )
  );

-- Staff can mark notifications read (update read_at)
CREATE POLICY "staff_update_admin_notifications" ON admin_notifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin','production_manager','designer','installer','customer_support')
        AND users.deleted_at IS NULL
    )
  );
