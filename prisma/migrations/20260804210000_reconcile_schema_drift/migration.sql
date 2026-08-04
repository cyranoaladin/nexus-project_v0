-- S5 additive reconciliation of objects declared by the canonical Prisma schema.
-- Rollback remains application-only: both additions are backward compatible.

ALTER TYPE "InvoicePaymentMethod" ADD VALUE IF NOT EXISTS 'CLICTOPAY';

DO $$
DECLARE
  duplicate_group_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_group_count
  FROM (
    SELECT "aiJobId"
    FROM "copy_submissions"
    WHERE "aiJobId" IS NOT NULL
    GROUP BY "aiJobId"
    HAVING COUNT(*) > 1
  ) AS duplicate_groups;

  IF duplicate_group_count > 0 THEN
    RAISE EXCEPTION
      'Found % duplicate non-null copy_submissions.aiJobId group(s); resolve them before applying the unique index.',
      duplicate_group_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "copy_submissions_aiJobId_key"
  ON "copy_submissions"("aiJobId");
