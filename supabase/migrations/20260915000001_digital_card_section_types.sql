-- ============================================================
-- controlp.io - Digital card section types
--
-- The builder can split the profile header into separate logo, photo, name
-- and bio layers (and creates them by default), but the section_type CHECK
-- from 20260524000007 never allowed them, so saving such a card fails.
-- This widens the CHECK; every existing row stays valid. Safe to re-run.
-- ============================================================

ALTER TABLE digital_card_sections
  DROP CONSTRAINT IF EXISTS digital_card_sections_section_type_check;

ALTER TABLE digital_card_sections
  ADD CONSTRAINT digital_card_sections_section_type_check
  CHECK (section_type IN (
    'profile_logo',
    'profile_photo',
    'profile_name',
    'profile_bio',
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

COMMENT ON CONSTRAINT digital_card_sections_section_type_check ON digital_card_sections IS
  'Allowed public digital card section/layer types, including split profile layers and lead_capture.';
