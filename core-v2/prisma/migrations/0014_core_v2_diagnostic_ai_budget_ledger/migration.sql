-- CreateEnum
CREATE TYPE "DiagnosticAiBudgetEntryStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');

-- CreateTable
CREATE TABLE "diagnostic_ai_budget_ledger" (
    "id" TEXT NOT NULL,
    "pilotKey" TEXT NOT NULL,
    "processingId" TEXT NOT NULL,
    "audienceScope" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "DiagnosticAiBudgetEntryStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedCostUsd" DECIMAL(10,6) NOT NULL,
    "actualCostUsd" DECIMAL(10,6),
    "provider" TEXT,
    "model" TEXT,
    "endpointTag" TEXT,
    "providerRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_ai_budget_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostic_ai_budget_ledger_pilotKey_status_idx" ON "diagnostic_ai_budget_ledger"("pilotKey", "status");

-- CreateIndex
CREATE INDEX "diagnostic_ai_budget_ledger_processingId_audienceScope_idx" ON "diagnostic_ai_budget_ledger"("processingId", "audienceScope");

-- AddForeignKey
ALTER TABLE "diagnostic_ai_budget_ledger" ADD CONSTRAINT "diagnostic_ai_budget_ledger_processingId_fkey" FOREIGN KEY ("processingId") REFERENCES "diagnostic_submission_processings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
