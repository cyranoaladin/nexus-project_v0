-- Additive migration: add canonical Bilan model (F49/F51)
-- Backward-compatible: only new table + enums

-- CreateEnum BilanType (idempotent guard)
DO $$ BEGIN
  CREATE TYPE "BilanType" AS ENUM ('DIAGNOSTIC_PRE_STAGE', 'ASSESSMENT_QCM', 'STAGE_POST', 'CONTINUOUS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum BilanStatus (idempotent guard)
DO $$ BEGIN
  CREATE TYPE "BilanStatus" AS ENUM ('PENDING', 'SCORING', 'GENERATING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable bilans
CREATE TABLE "bilans" (
    "id" TEXT NOT NULL,
    "publicShareId" TEXT NOT NULL,
    "type" "BilanType" NOT NULL,
    "subject" TEXT NOT NULL,
    "legacyDiagnosticId" TEXT,
    "legacyAssessmentId" TEXT,
    "legacyStageBilanId" TEXT,
    "sourceData" JSONB,
    "studentId" TEXT,
    "studentEmail" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentPhone" TEXT,
    "stageId" TEXT,
    "coachId" TEXT,
    "globalScore" DOUBLE PRECISION,
    "confidenceIndex" DOUBLE PRECISION,
    "ssn" DOUBLE PRECISION,
    "uai" DOUBLE PRECISION,
    "domainScores" JSONB,
    "studentMarkdown" TEXT,
    "parentsMarkdown" TEXT,
    "nexusMarkdown" TEXT,
    "analysisJson" JSONB,
    "status" "BilanStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorDetails" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "sourceVersion" TEXT,
    "engineVersion" TEXT,
    "ragUsed" BOOLEAN NOT NULL DEFAULT false,
    "ragCollections" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bilans_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "bilans_publicShareId_key" ON "bilans"("publicShareId");

-- CreateUniqueIndex (legacy IDs for migration traceability)
CREATE UNIQUE INDEX "bilans_legacyDiagnosticId_key" ON "bilans"("legacyDiagnosticId") WHERE "legacyDiagnosticId" IS NOT NULL;
CREATE UNIQUE INDEX "bilans_legacyAssessmentId_key" ON "bilans"("legacyAssessmentId") WHERE "legacyAssessmentId" IS NOT NULL;
CREATE UNIQUE INDEX "bilans_legacyStageBilanId_key" ON "bilans"("legacyStageBilanId") WHERE "legacyStageBilanId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "bilans_type_status_idx" ON "bilans"("type", "status");
CREATE INDEX "bilans_studentId_idx" ON "bilans"("studentId");
CREATE INDEX "bilans_studentEmail_idx" ON "bilans"("studentEmail");
CREATE INDEX "bilans_stageId_idx" ON "bilans"("stageId");
CREATE INDEX "bilans_createdAt_idx" ON "bilans"("createdAt");

-- AddForeignKey
ALTER TABLE "bilans" ADD CONSTRAINT "bilans_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilans" ADD CONSTRAINT "bilans_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilans" ADD CONSTRAINT "bilans_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
