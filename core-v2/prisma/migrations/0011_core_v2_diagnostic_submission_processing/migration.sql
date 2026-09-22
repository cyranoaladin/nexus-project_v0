-- CreateEnum
CREATE TYPE "DiagnosticSubmissionProcessingStatus" AS ENUM ('QUEUED', 'EXTRACTING', 'EXTRACTED', 'NO_EXTRACTABLE_TEXT', 'EXTRACTION_FAILED');

-- CreateEnum
CREATE TYPE "DiagnosticSubmissionExtractionStatus" AS ENUM ('SUCCEEDED', 'EMPTY', 'FAILED');

-- CreateTable
CREATE TABLE "diagnostic_submission_processings" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "submissionSha256Snapshot" TEXT NOT NULL,
    "submissionVersionSnapshot" INTEGER NOT NULL,
    "subjectVersionSnapshot" TEXT NOT NULL,
    "status" "DiagnosticSubmissionProcessingStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_submission_processings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_submission_extractions" (
    "id" TEXT NOT NULL,
    "processingId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "DiagnosticSubmissionExtractionStatus" NOT NULL,
    "extractedText" TEXT,
    "characterCount" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_submission_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_submission_processings_submissionId_key" ON "diagnostic_submission_processings"("submissionId");

-- CreateIndex
CREATE INDEX "diagnostic_submission_processings_status_idx" ON "diagnostic_submission_processings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_submission_extractions_processingId_revision_key" ON "diagnostic_submission_extractions"("processingId", "revision");

-- AddForeignKey
ALTER TABLE "diagnostic_submission_processings" ADD CONSTRAINT "diagnostic_submission_processings_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "diagnostic_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_submission_extractions" ADD CONSTRAINT "diagnostic_submission_extractions_processingId_fkey" FOREIGN KEY ("processingId") REFERENCES "diagnostic_submission_processings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
