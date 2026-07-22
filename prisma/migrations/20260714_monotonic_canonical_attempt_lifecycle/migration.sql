-- Canonical attempt lifecycle hardening. This only replaces a trigger function
-- on the additive canonical table; no legacy table is altered.

CREATE OR REPLACE FUNCTION canonical_bilans_reject_submitted_attempt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'canonical assessment attempts are immutable after submission';
    END IF;
    RETURN OLD;
  END IF;

  -- Once submitted, an attempt cannot return to a mutable lifecycle state.
  IF OLD."status" <> 'IN_PROGRESS' AND NEW."status" = 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'canonical assessment attempt lifecycle rollback is forbidden';
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
