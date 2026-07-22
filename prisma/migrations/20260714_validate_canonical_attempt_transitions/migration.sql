-- Explicit database lifecycle graph for canonical attempts. Report-generation
-- retries retain SCORED on the attempt; scoring retries retain SUBMITTED while
-- the outbox records retry state. INVALIDATED is terminal.

CREATE OR REPLACE FUNCTION canonical_bilans_reject_submitted_attempt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'canonical assessment attempts are immutable after submission';
    END IF;
    RETURN OLD;
  END IF;

  -- Same-state writes are idempotent worker retries. Every actual lifecycle
  -- transition must be listed here: IN_PROGRESS → SUBMITTED/INVALIDATED,
  -- SUBMITTED → SCORED/INVALIDATED, SCORED → INVALIDATED.
  IF OLD."status" <> NEW."status" AND NOT (
    (OLD."status" = 'IN_PROGRESS' AND NEW."status" IN ('SUBMITTED', 'INVALIDATED'))
    OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('SCORED', 'INVALIDATED'))
    OR (OLD."status" = 'SCORED' AND NEW."status" = 'INVALIDATED')
  ) THEN
    RAISE EXCEPTION 'illegal canonical assessment attempt lifecycle transition: % -> %', OLD."status", NEW."status";
  END IF;

  IF OLD."status" <> 'IN_PROGRESS' AND (
    NEW."subject" IS DISTINCT FROM OLD."subject"
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
