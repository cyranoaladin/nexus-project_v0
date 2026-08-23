-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('ESTIMATION', 'BILAN_A_FAIRE', 'BILAN_TERMINE', 'DEVIS_ENVOYE', 'DEVIS_CONSULTE', 'A_RAPPELER', 'ACCEPTE', 'REFUSE', 'INSCRIT', 'EXPIRE');

-- CreateEnum
CREATE TYPE "QuoteStrategy" AS ENUM ('RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE');

-- CreateEnum
CREATE TYPE "QuoteSource" AS ENUM ('PUBLIC_SIMULATOR', 'STAFF_WORKSPACE');

-- CreateEnum
CREATE TYPE "QuoteLineModality" AS ENUM ('PILOTAGE', 'GROUPE', 'DUO', 'INDIVIDUEL', 'PACK');

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "publicTokenHash" TEXT NOT NULL,
    "publicTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'ESTIMATION',
    "source" "QuoteSource" NOT NULL,
    "contactLeadId" TEXT,
    "studentId" TEXT,
    "diagnosticId" TEXT,
    "diagnosticChecksum" TEXT,
    "examSession" INTEGER NOT NULL,
    "pricingVersion" TEXT NOT NULL,
    "examPolicyVersion" TEXT NOT NULL,
    "budget" INTEGER NOT NULL,
    "strategy" "QuoteStrategy" NOT NULL,
    "matchedOfferId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "monthlyTotal" INTEGER NOT NULL,
    "grandTotal" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "previousRevisionId" TEXT,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "consultedAt" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "modality" "QuoteLineModality" NOT NULL,
    "hoursPerMonth" INTEGER,
    "unitPrice" INTEGER NOT NULL,
    "months" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "offerId" TEXT,
    "priority" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_audit_logs" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotes_publicTokenHash_key" ON "quotes"("publicTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_idempotencyKey_key" ON "quotes"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_previousRevisionId_key" ON "quotes"("previousRevisionId");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "quotes_contactLeadId_idx" ON "quotes"("contactLeadId");

-- CreateIndex
CREATE INDEX "quotes_studentId_idx" ON "quotes"("studentId");

-- CreateIndex
CREATE INDEX "quotes_createdAt_idx" ON "quotes"("createdAt");

-- CreateIndex
CREATE INDEX "quote_lines_quoteId_idx" ON "quote_lines"("quoteId");

-- CreateIndex
CREATE INDEX "quote_audit_logs_quoteId_idx" ON "quote_audit_logs"("quoteId");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contactLeadId_fkey" FOREIGN KEY ("contactLeadId") REFERENCES "contact_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_previousRevisionId_fkey" FOREIGN KEY ("previousRevisionId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_audit_logs" ADD CONSTRAINT "quote_audit_logs_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
