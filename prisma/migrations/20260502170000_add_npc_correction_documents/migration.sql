-- Add typed pedagogical documents to NPC copy submissions.
-- Existing CopyPage rows are kept as STUDENT_COPY for backward compatibility.

CREATE TYPE "CorrectionDocumentType" AS ENUM (
    'STUDENT_COPY',
    'SUBJECT',
    'OFFICIAL_CORRECTION',
    'GRADING_RUBRIC',
    'GRADING_INSTRUCTIONS',
    'SUPPORTING_DOCUMENT'
);

ALTER TABLE "copy_pages"
    ADD COLUMN "documentType" "CorrectionDocumentType" NOT NULL DEFAULT 'STUDENT_COPY',
    ADD COLUMN "originalFilename" TEXT,
    ADD COLUMN "mimeType" TEXT,
    ADD COLUMN "sizeBytes" INTEGER,
    ADD COLUMN "uploadedById" TEXT;

CREATE INDEX "copy_pages_submissionId_documentType_idx" ON "copy_pages"("submissionId", "documentType");
CREATE INDEX "copy_pages_uploadedById_idx" ON "copy_pages"("uploadedById");
