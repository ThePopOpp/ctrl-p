-- Add 'nfc_tap' to the digital_card_events event_type CHECK constraint.
-- The original migration omitted it, causing nfc_tap inserts to fail silently
-- (the public card page swallows the error with .catch(() => null)).

ALTER TABLE digital_card_events
  DROP CONSTRAINT IF EXISTS digital_card_events_event_type_check;

ALTER TABLE digital_card_events
  ADD CONSTRAINT digital_card_events_event_type_check
    CHECK (event_type IN (
      'view',
      'share',
      'like',
      'qr_scan',
      'nfc_tap',
      'link_click',
      'copy_link',
      'save_contact',
      'lead_submit'
    ));
