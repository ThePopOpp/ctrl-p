-- ============================================================
-- controlp.io - Invoice and payment detail fields
-- Expands payments so pending invoice records can carry billing
-- details before a dedicated invoices table/PDFX workflow exists.
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_terms text,
  ADD COLUMN IF NOT EXISTS billing_contact jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subtotal numeric(10,2),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_link_url text,
  ADD COLUMN IF NOT EXISTS document_status text NOT NULL DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_invoice_number
  ON payments(invoice_number)
  WHERE invoice_number IS NOT NULL;

COMMENT ON COLUMN payments.invoice_number IS
  'Human-facing invoice number for pending invoice records.';
COMMENT ON COLUMN payments.billing_contact IS
  'Invoice recipient details such as name, email, company, phone, and address.';
COMMENT ON COLUMN payments.line_items IS
  'Invoice line items used for PDFs, receipts, and payment link generation.';
COMMENT ON COLUMN payments.document_status IS
  'PDF/document lifecycle status such as not_generated, generated, sent, downloaded.';
COMMENT ON COLUMN payments.delivery_status IS
  'Invoice delivery status such as draft, sent, viewed, paid, void.';
