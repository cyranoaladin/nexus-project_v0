-- A82: additive Canonical passation fields. No legacy table, column or row is
-- removed or renamed. New application writes must provide seed and expiresAt.
ALTER TABLE "canonical_assessment_attempts"
  ADD COLUMN IF NOT EXISTS "seed" TEXT,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- A DEV/TEST branch may already have introduced startedAt. Convergence is
-- accepted only when the existing physical types match this migration exactly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'canonical_assessment_attempts'
      AND (
        (column_name = 'seed' AND data_type <> 'text')
        OR (column_name IN ('startedAt', 'expiresAt') AND data_type <> 'timestamp without time zone')
      )
  ) THEN
    RAISE EXCEPTION 'incompatible canonical passation column type';
  END IF;
END;
$$;

-- Defensive backfill for pre-existing Canonical attempts. Production currently
-- has none, but the migration remains safe for populated DEV/TEST databases.
UPDATE "canonical_assessment_attempts"
SET
  "seed" = 'legacy:' || "id",
  "startedAt" = "createdAt",
  "expiresAt" = "createdAt" + INTERVAL '24 hours'
WHERE "seed" IS NULL OR "startedAt" IS NULL OR "expiresAt" IS NULL;

ALTER TABLE "canonical_assessment_attempts"
  ALTER COLUMN "seed" SET NOT NULL,
  ALTER COLUMN "startedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "startedAt" SET NOT NULL,
  ALTER COLUMN "expiresAt" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- The seed fixes display order and the timestamps bound the attempt. Seal all
-- three with the submitted answers and provenance so they cannot drift later.
CREATE OR REPLACE FUNCTION canonical_bilans_reject_submitted_attempt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" NOT IN ('IN_PROGRESS', 'DRAFT') THEN
      RAISE EXCEPTION 'canonical assessment attempts are immutable after submission';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> NEW."status" AND NOT (
    (OLD."status" IN ('IN_PROGRESS', 'DRAFT') AND NEW."status" IN ('SUBMITTED', 'INVALIDATED'))
    OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('SCORED', 'SCORING_FAILED', 'INVALIDATED'))
    OR (OLD."status" = 'SCORING_FAILED' AND NEW."status" = 'SUBMITTED')
    OR (OLD."status" = 'SCORED' AND NEW."status" IN ('REPORT_PENDING_REVIEW', 'REPORT_GENERATION_FAILED', 'INVALIDATED'))
    OR (OLD."status" = 'REPORT_GENERATION_FAILED' AND NEW."status" = 'SCORED')
    OR (OLD."status" = 'REPORT_PENDING_REVIEW' AND NEW."status" IN ('COACH_VALIDATED', 'COACH_REJECTED'))
    OR (OLD."status" = 'COACH_REJECTED' AND NEW."status" = 'SCORED')
    OR (OLD."status" = 'COACH_VALIDATED' AND NEW."status" = 'PUBLISHED')
    OR (OLD."status" = 'PUBLISHED' AND NEW."status" = 'SCORED')
  ) THEN
    RAISE EXCEPTION 'illegal canonical assessment attempt lifecycle transition: % -> %', OLD."status", NEW."status";
  END IF;

  IF OLD."status" NOT IN ('IN_PROGRESS', 'DRAFT') AND (
    NEW."seed" IS DISTINCT FROM OLD."seed"
    OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
    OR NEW."subject" IS DISTINCT FROM OLD."subject"
    OR NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel"
    OR NEW."answers" IS DISTINCT FROM OLD."answers"
    OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
    OR NEW."curriculumId" IS DISTINCT FROM OLD."curriculumId"
    OR NEW."curriculumVersion" IS DISTINCT FROM OLD."curriculumVersion"
    OR NEW."assessmentPackId" IS DISTINCT FROM OLD."assessmentPackId"
    OR NEW."assessmentPackVersion" IS DISTINCT FROM OLD."assessmentPackVersion"
    OR NEW."assessmentPackChecksum" IS DISTINCT FROM OLD."assessmentPackChecksum"
    OR NEW."scoringPolicyId" IS DISTINCT FROM OLD."scoringPolicyId"
    OR NEW."scoringPolicyVersion" IS DISTINCT FROM OLD."scoringPolicyVersion"
  ) THEN
    RAISE EXCEPTION 'submitted canonical assessment provenance is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
