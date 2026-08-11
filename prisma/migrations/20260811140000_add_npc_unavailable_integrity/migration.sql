ALTER TYPE "CopySubmissionStatus" ADD VALUE 'UNAVAILABLE';

ALTER TYPE "CopyPageStatus" ADD VALUE 'UNAVAILABLE';

ALTER TABLE "copy_submissions"
ADD COLUMN "unavailableReason" TEXT,
ADD COLUMN "unavailableAt" TIMESTAMP(3);

ALTER TABLE "copy_pages"
ADD COLUMN "unavailableReason" TEXT,
ADD COLUMN "unavailableAt" TIMESTAMP(3),
ADD COLUMN "sha256" TEXT;

ALTER TABLE "copy_pages"
ADD CONSTRAINT "copy_pages_sha256_format_check"
CHECK ("sha256" IS NULL OR "sha256" ~ '^[0-9a-fA-F]{64}$');
