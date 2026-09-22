-- AlterTable
ALTER TABLE "diagnostic_ai_budget_ledger" ALTER COLUMN "processingId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "diagnostic_ai_budget_ledger_pilotKey_providerRequestId_idx" ON "diagnostic_ai_budget_ledger"("pilotKey", "providerRequestId");
