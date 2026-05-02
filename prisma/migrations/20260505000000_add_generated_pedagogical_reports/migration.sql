-- Generated pedagogical reports pipeline.
-- Adds EAF validation lifecycle fields and the generic generated report job table.

ALTER TABLE "eaf_preparation_reports"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "completionRatio" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validatedBy" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GeneratedReportStatus') THEN
    CREATE TYPE "GeneratedReportStatus" AS ENUM (
      'PENDING',
      'BUILDING_CONTEXT',
      'LLM_GENERATING',
      'LLM_VALIDATED',
      'LATEX_RENDERING',
      'PDF_READY',
      'FAILED',
      'NEEDS_REVIEW'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GeneratedReportKind') THEN
    CREATE TYPE "GeneratedReportKind" AS ENUM (
      'EAF_STAGE_POST',
      'MATHS_PREMIERE_STAGE_POST'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "generated_pedagogical_reports" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "coachId" TEXT,
  "stageSlug" TEXT NOT NULL,
  "subject" "Subject" NOT NULL,
  "kind" "GeneratedReportKind" NOT NULL,
  "studentBilanId" TEXT,
  "coachReportId" TEXT,
  "status" "GeneratedReportStatus" NOT NULL DEFAULT 'PENDING',
  "inputChecksum" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "modelUsed" TEXT,
  "contextJson" JSONB,
  "llmJson" JSONB,
  "validatedJson" JSONB,
  "latexSource" TEXT,
  "pdfDocumentId" TEXT,
  "pdfUrl" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "generated_pedagogical_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "generated_pedagogical_reports_studentId_stageSlug_subject_kind_inputChecksum_key"
    UNIQUE ("studentId", "stageSlug", "subject", "kind", "inputChecksum")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_pedagogical_reports_studentId_fkey'
  ) THEN
    ALTER TABLE "generated_pedagogical_reports"
      ADD CONSTRAINT "generated_pedagogical_reports_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_pedagogical_reports_coachId_fkey'
  ) THEN
    ALTER TABLE "generated_pedagogical_reports"
      ADD CONSTRAINT "generated_pedagogical_reports_coachId_fkey"
      FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "generated_pedagogical_reports_studentId_idx"
  ON "generated_pedagogical_reports"("studentId");

CREATE INDEX IF NOT EXISTS "generated_pedagogical_reports_coachId_idx"
  ON "generated_pedagogical_reports"("coachId");

CREATE INDEX IF NOT EXISTS "generated_pedagogical_reports_status_idx"
  ON "generated_pedagogical_reports"("status");

CREATE INDEX IF NOT EXISTS "generated_pedagogical_reports_stageSlug_subject_idx"
  ON "generated_pedagogical_reports"("stageSlug", "subject");
