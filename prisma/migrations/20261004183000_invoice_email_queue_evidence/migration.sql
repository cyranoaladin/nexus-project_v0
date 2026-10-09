-- Expand the allowed append-only financial audit actions. Existing rows remain valid.
-- Token, encrypted outbox intent and this evidence are committed in one invoice-row-locked transaction.
ALTER TABLE "invoice_financial_access_audits"
  DROP CONSTRAINT "invoice_financial_audit_action",
  ADD CONSTRAINT "invoice_financial_audit_action" CHECK (action IN (
    'PAYER_ASSIGNED', 'DELEGATION_GRANTED', 'DELEGATION_REVOKED', 'PDF_READ', 'RECEIPT_READ', 'INVOICE_EMAIL_QUEUED'
  ));
