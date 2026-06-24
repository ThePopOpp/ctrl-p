-- ─── Contact Submissions ──────────────────────────────────────────────────────
-- Already inserted by /api/contact — this creates the backing table

CREATE TABLE IF NOT EXISTS contact_submissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  text NOT NULL,
  last_name   text,
  email       text NOT NULL,
  phone       text,
  company     text,
  subject     text,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','read','replied','archived')),
  notes       text,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  replied_at  timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_submissions_email_idx  ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS contact_submissions_status_idx ON contact_submissions(status);
CREATE INDEX IF NOT EXISTS contact_submissions_created_idx ON contact_submissions(created_at DESC);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contact submissions"
  ON contact_submissions FOR ALL
  USING (auth.jwt() ->> 'role' IN ('super_admin','admin','employee'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('super_admin','admin','employee'));

-- ─── Email Inbox ───────────────────────────────────────────────────────────────
-- Populated by IMAP sync or webhook from email provider

CREATE TABLE IF NOT EXISTS email_inbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  text UNIQUE,
  from_email  text NOT NULL,
  from_name   text,
  to_email    text NOT NULL,
  subject     text NOT NULL,
  body_text   text,
  body_html   text,
  is_read     boolean DEFAULT false,
  thread_id   text,
  in_reply_to text,
  labels      text[] DEFAULT '{}',
  received_at timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_inbox_from_idx    ON email_inbox(from_email);
CREATE INDEX IF NOT EXISTS email_inbox_thread_idx  ON email_inbox(thread_id);
CREATE INDEX IF NOT EXISTS email_inbox_recv_idx    ON email_inbox(received_at DESC);

ALTER TABLE email_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email inbox"
  ON email_inbox FOR ALL
  USING (auth.jwt() ->> 'role' IN ('super_admin','admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('super_admin','admin'));

-- ─── Automations ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  description         text,
  trigger_type        text NOT NULL,
  trigger_conditions  jsonb DEFAULT '{}',
  action_type         text NOT NULL,
  action_data         jsonb DEFAULT '{}',
  delay_minutes       integer DEFAULT 0,
  enabled             boolean DEFAULT true,
  last_run_at         timestamptz,
  run_count           integer DEFAULT 0,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_trigger_idx ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS automations_enabled_idx ON automations(enabled);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage automations"
  ON automations FOR ALL
  USING (auth.jwt() ->> 'role' IN ('super_admin','admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('super_admin','admin'));

-- ─── Automation Logs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_data    jsonb DEFAULT '{}',
  action_result   jsonb DEFAULT '{}',
  status          text DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  error_message   text,
  executed_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_logs_automation_idx  ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS automation_logs_executed_idx    ON automation_logs(executed_at DESC);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view automation logs"
  ON automation_logs FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('super_admin','admin'));

-- ─── Seed basic automations ────────────────────────────────────────────────────

INSERT INTO automations (name, description, trigger_type, trigger_conditions, action_type, action_data, delay_minutes, enabled)
VALUES
  (
    'Welcome new contact',
    'Sends a welcome email when someone submits the contact form.',
    'contact_form_submission',
    '{}',
    'send_email',
    '{"template_name":"welcome","subject":"Thanks for reaching out — Ctrl+P","from":"Ctrl+P <hello@ctrlp.io>"}',
    0, false
  ),
  (
    'Order confirmation',
    'Sends an order confirmation email immediately after a new order is placed.',
    'new_order',
    '{}',
    'send_email',
    '{"template_name":"order_confirmation","subject":"Your order is confirmed! — Ctrl+P","from":"Ctrl+P <orders@ctrlp.io>"}',
    0, false
  ),
  (
    'Order shipped — notify customer',
    'Notifies the customer by email when their order status changes to "shipped".',
    'order_status_change',
    '{"to_status":"shipped"}',
    'send_email',
    '{"template_name":"order_shipped","subject":"Your order is on its way! — Ctrl+P","from":"Ctrl+P <orders@ctrlp.io>"}',
    0, false
  ),
  (
    'Payment received — send receipt',
    'Sends a payment receipt email when a payment is successfully captured.',
    'payment_received',
    '{}',
    'send_email',
    '{"template_name":"payment_receipt","subject":"Payment received — Ctrl+P","from":"Ctrl+P <billing@ctrlp.io>"}',
    0, false
  ),
  (
    'Quote follow-up (2 days)',
    'Sends a follow-up email 2 days after a quote is requested if no order has been placed.',
    'new_order',
    '{"order_type":"quote"}',
    'send_email',
    '{"template_name":"quote_followup","subject":"Still interested? Your quote from Ctrl+P","from":"Ctrl+P <sales@ctrlp.io>"}',
    2880, false
  ),
  (
    'SMS confirmation on new order',
    'Sends a text message to the customer''s phone when a new order is created.',
    'new_order',
    '{}',
    'send_sms',
    '{"message":"Hi {{first_name}}, your Ctrl+P order #{{order_id}} has been received! We''ll be in touch shortly."}',
    0, false
  ),
  (
    'Notify admin — new contact form',
    'Sends an internal admin notification when a contact form is submitted.',
    'contact_form_submission',
    '{}',
    'notify_admin',
    '{"channel":"email","message":"New contact form submission from {{name}} ({{email}})"}',
    0, true
  )
ON CONFLICT DO NOTHING;
