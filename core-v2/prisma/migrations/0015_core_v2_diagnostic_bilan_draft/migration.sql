-- CreateEnum
CREATE TYPE "DiagnosticBilanDraftStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "diagnostic_bilan_drafts" (
    "id" TEXT NOT NULL,
    "processingId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "extractionId" TEXT NOT NULL,
    "extractionRevisionSnapshot" INTEGER NOT NULL,
    "extractionTruncatedSnapshot" BOOLEAN NOT NULL,
    "deterministicResults" JSONB NOT NULL,
    "aiProposal" JSONB,
    "aiProvenance" JSONB,
    "humanReview" JSONB,
    "editVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "DiagnosticBilanDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedAudienceScope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_bilan_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostic_bilan_drafts_processingId_status_idx" ON "diagnostic_bilan_drafts"("processingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_bilan_drafts_processingId_revision_key" ON "diagnostic_bilan_drafts"("processingId", "revision");

-- AddForeignKey
ALTER TABLE "diagnostic_bilan_drafts" ADD CONSTRAINT "diagnostic_bilan_drafts_processingId_fkey" FOREIGN KEY ("processingId") REFERENCES "diagnostic_submission_processings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_bilan_drafts" ADD CONSTRAINT "diagnostic_bilan_drafts_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "diagnostic_submission_extractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_bilan_drafts" ADD CONSTRAINT "diagnostic_bilan_drafts_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_bilan_drafts" ADD CONSTRAINT "diagnostic_bilan_drafts_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
