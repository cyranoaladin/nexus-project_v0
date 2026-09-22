-- AlterTable
ALTER TABLE "diagnostic_submission_extractions" ADD COLUMN     "totalCharacterCount" INTEGER,
ADD COLUMN     "truncated" BOOLEAN NOT NULL DEFAULT false;
