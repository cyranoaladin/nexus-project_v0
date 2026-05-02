-- CreateEnum
CREATE TYPE "GeneratedReportStatus" AS ENUM ('PENDING', 'BUILDING_CONTEXT', 'LLM_GENERATING', 'LLM_VALIDATED', 'LATEX_RENDERING', 'PDF_READY', 'FAILED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "generated_pedagogical_reports" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT,
    "subject" TEXT NOT NULL,
    "stageSlug" TEXT,
    "studentBilanId" TEXT,
    "coachReportId" TEXT,
    "kind" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "status" "GeneratedReportStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "inputChecksum" TEXT,
    "contextJson" JSONB,
    "llmJson" JSONB,
    "validatedJson" JSONB,
    "modelUsed" TEXT,
    "validatedAt" TIMESTAMP(3),
    "latexSource" TEXT,
    "generatedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,

    CONSTRAINT "generated_pedagogical_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_pedagogical_reports_studentId_status_idx" ON "generated_pedagogical_reports"("studentId", "status");

-- CreateIndex
CREATE INDEX "generated_pedagogical_reports_status_createdAt_idx" ON "generated_pedagogical_reports"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "generated_pedagogical_reports_studentId_stageSlug_subject_kin_key" ON "generated_pedagogical_reports"("studentId", "stageSlug", "subject", "kind", "inputChecksum");

-- AddForeignKey
ALTER TABLE "generated_pedagogical_reports" ADD CONSTRAINT "generated_pedagogical_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_pedagogical_reports" ADD CONSTRAINT "generated_pedagogical_reports_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

