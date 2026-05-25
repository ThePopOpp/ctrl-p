-- ============================================================
-- controlp.io - Digital card lead capture section
-- Allows lead capture to behave as a visible card section/layer
-- with a button that opens a dedicated public lead form page.
-- ============================================================

ALTER TABLE digital_card_sections
  DROP CONSTRAINT IF EXISTS digital_card_sections_section_type_check;

ALTER TABLE digital_card_sections
  ADD CONSTRAINT digital_card_sections_section_type_check
  CHECK (section_type IN (
    'profile_header',
    'quick_actions',
    'links',
    'lead_capture',
    'video',
    'qr_code',
    'nfc',
    'gallery',
    'scratch_card',
    'punch_card',
    'loyalty_card',
    'custom'
  ));

ALTER TABLE digital_cards
  ALTER COLUMN lead_form_settings SET DEFAULT '{"enabled":true,"title":"Send me your info","description":"Share your contact details and I will follow up.","button_label":"Send me your info","button_background":"#a3ff12","button_text_color":"#07130b","field_background":"#07130b","field_text_color":"#f7fff2","submit_label":"Send info","fields":[{"key":"name","label":"Name","enabled":true,"required":false},{"key":"email","label":"Email","enabled":true,"required":false},{"key":"phone","label":"Phone","enabled":true,"required":false},{"key":"company","label":"Company","enabled":false,"required":false},{"key":"message","label":"Message","enabled":true,"required":false}]}'::jsonb;

COMMENT ON CONSTRAINT digital_card_sections_section_type_check ON digital_card_sections IS
  'Allowed public digital card section/layer types, including lead_capture.';
