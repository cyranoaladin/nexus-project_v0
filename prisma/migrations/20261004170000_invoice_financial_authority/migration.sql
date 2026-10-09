-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "payerUserId" TEXT;

-- CreateTable
CREATE TABLE "invoice_financial_delegations" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "payerUserId" TEXT NOT NULL,
    "delegateUserId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_financial_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_financial_access_audits" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "delegationId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_financial_access_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_financial_delegations_requestKey_key" ON "invoice_financial_delegations"("requestKey");

-- CreateIndex
CREATE INDEX "invoice_financial_delegations_invoiceId_delegateUserId_revo_idx" ON "invoice_financial_delegations"("invoiceId", "delegateUserId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_financial_access_audits_requestKey_key" ON "invoice_financial_access_audits"("requestKey");

-- CreateIndex
CREATE INDEX "invoice_financial_access_audits_invoiceId_occurredAt_idx" ON "invoice_financial_access_audits"("invoiceId", "occurredAt");

-- CreateIndex
CREATE INDEX "invoices_payerUserId_status_idx" ON "invoices"("payerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_payerUserId_key" ON "invoices"("id", "payerUserId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_financial_delegations" ADD CONSTRAINT "invoice_financial_delegations_invoiceId_payerUserId_fkey" FOREIGN KEY ("invoiceId", "payerUserId") REFERENCES "invoices"("id", "payerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_financial_delegations" ADD CONSTRAINT "invoice_financial_delegations_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_financial_access_audits" ADD CONSTRAINT "invoice_financial_access_audits_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "invoice_financial_delegations_id_invoiceId_key" ON "invoice_financial_delegations"("id", "invoiceId");

ALTER TABLE "invoice_financial_access_audits" ADD CONSTRAINT "invoice_financial_access_audits_delegationId_invoiceId_fkey" FOREIGN KEY ("delegationId", "invoiceId") REFERENCES "invoice_financial_delegations"("id", "invoiceId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_financial_access_audits" ADD CONSTRAINT "invoice_financial_access_audits_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Narrow integrity rules, not business workflows.
ALTER TABLE "invoice_financial_delegations"
  ADD CONSTRAINT "invoice_financial_delegation_window" CHECK ("expiresAt" > "startsAt"),
  ADD CONSTRAINT "invoice_financial_delegation_distinct_users" CHECK ("delegateUserId" <> "payerUserId");

CREATE FUNCTION reject_invoice_financial_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'INVOICE_FINANCIAL_AUDIT_APPEND_ONLY' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER invoice_financial_audit_append_only
BEFORE UPDATE OR DELETE ON "invoice_financial_access_audits"
FOR EACH ROW EXECUTE FUNCTION reject_invoice_financial_audit_mutation();

ALTER TABLE "invoice_financial_access_audits"
  ADD CONSTRAINT "invoice_financial_audit_action" CHECK (action IN ('PAYER_ASSIGNED', 'DELEGATION_GRANTED', 'DELEGATION_REVOKED', 'PDF_READ', 'RECEIPT_READ'));
