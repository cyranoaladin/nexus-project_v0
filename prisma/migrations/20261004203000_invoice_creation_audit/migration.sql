-- Expand the append-only financial audit vocabulary, preserving every old action.
ALTER TABLE "invoice_financial_access_audits"
  DROP CONSTRAINT "invoice_financial_audit_action",
  ADD CONSTRAINT "invoice_financial_audit_action" CHECK (action IN (
    'PAYER_ASSIGNED', 'DELEGATION_GRANTED', 'DELEGATION_REVOKED',
    'PDF_READ', 'RECEIPT_READ', 'INVOICE_EMAIL_QUEUED',
    'INVOICE_SENT', 'INVOICE_PAID', 'INVOICE_CANCELLED', 'INVOICE_CREATED'
  ));
