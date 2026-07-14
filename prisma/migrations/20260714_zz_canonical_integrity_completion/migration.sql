-- Completion hardening for canonical bilans only; legacy tables are untouched.

ALTER TYPE "CanonicalAssessmentAttemptStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "CanonicalAssessmentAttemptStatus" ADD VALUE IF NOT EXISTS 'SCORING_FAILED';
ALTER TYPE "CanonicalAssessmentAttemptStatus" ADD VALUE IF NOT EXISTS 'REPORT_PENDING_REVIEW';
ALTER TYPE "CanonicalAssessmentAttemptStatus" ADD VALUE IF NOT EXISTS 'REPORT_GENERATION_FAILED';
ALTER TYPE "CanonicalAssessmentAttemptStatus" ADD VALUE IF NOT EXISTS 'COACH_VALIDATED';
ALTER TYPE "CanonicalAssessmentAttemptStatus" ADD VALUE IF NOT EXISTS 'COACH_REJECTED';
ALTER TYPE "CanonicalAssessmentAttemptStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "ReportRevisionStatus" ADD VALUE IF NOT EXISTS 'COACH_VALIDATED';

CREATE UNIQUE INDEX "canonical_assessment_attempts_id_studentId_key"
ON "canonical_assessment_attempts" ("id", "studentId");

ALTER TABLE "canonical_report_artifacts"
  DROP CONSTRAINT "canonical_report_artifacts_assessmentAttemptId_fkey";
ALTER TABLE "canonical_report_artifacts"
  ADD CONSTRAINT "canonical_report_artifacts_attempt_student_fkey"
  FOREIGN KEY ("assessmentAttemptId", "studentId")
  REFERENCES "canonical_assessment_attempts"("id", "studentId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION canonical_bilans_reject_submitted_attempt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" NOT IN ('IN_PROGRESS', 'DRAFT') THEN
      RAISE EXCEPTION 'canonical assessment attempts are immutable after submission';
    END IF;
    RETURN OLD;
  END IF;

  -- Canonical lifecycle (Task 1). IN_PROGRESS is a persisted legacy alias of
  -- DRAFT; report retries retain SCORED, scoring retries use SCORING_FAILED.
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
    NEW."subject" IS DISTINCT FROM OLD."subject" OR NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel"
    OR NEW."answers" IS DISTINCT FROM OLD."answers" OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
    OR NEW."curriculumId" IS DISTINCT FROM OLD."curriculumId" OR NEW."curriculumVersion" IS DISTINCT FROM OLD."curriculumVersion"
    OR NEW."assessmentPackId" IS DISTINCT FROM OLD."assessmentPackId" OR NEW."assessmentPackVersion" IS DISTINCT FROM OLD."assessmentPackVersion"
    OR NEW."assessmentPackChecksum" IS DISTINCT FROM OLD."assessmentPackChecksum"
    OR NEW."scoringPolicyId" IS DISTINCT FROM OLD."scoringPolicyId" OR NEW."scoringPolicyVersion" IS DISTINCT FROM OLD."scoringPolicyVersion"
  ) THEN
    RAISE EXCEPTION 'submitted canonical assessment provenance is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION canonical_bilans_require_revision_attempt_match()
RETURNS TRIGGER AS $$
DECLARE artifact_attempt TEXT; score_attempt TEXT;
BEGIN
  SELECT "assessmentAttemptId" INTO artifact_attempt FROM "canonical_report_artifacts" WHERE "id" = NEW."reportArtifactId";
  SELECT "assessmentAttemptId" INTO score_attempt FROM "canonical_score_snapshots" WHERE "id" = NEW."scoreSnapshotId";
  IF artifact_attempt IS NULL OR score_attempt IS NULL OR artifact_attempt <> score_attempt THEN
    RAISE EXCEPTION 'canonical report revision attempt chain is inconsistent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "canonical_report_revisions_attempt_chain_guard"
BEFORE INSERT OR UPDATE ON "canonical_report_revisions"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_require_revision_attempt_match();

CREATE OR REPLACE FUNCTION canonical_bilans_guard_report_publication()
RETURNS TRIGGER AS $$
DECLARE revision_status "ReportRevisionStatus";
BEGIN
  IF NEW."status" = 'PUBLISHED' OR NEW."currentPublishedRevisionId" IS NOT NULL OR NEW."publishedAt" IS NOT NULL THEN
    IF NEW."status" <> 'PUBLISHED' OR NEW."currentPublishedRevisionId" IS NULL OR NEW."publishedAt" IS NULL THEN
      RAISE EXCEPTION 'published report artifacts require revision pointer and publishedAt';
    END IF;
    SELECT "status" INTO revision_status FROM "canonical_report_revisions" WHERE "id" = NEW."currentPublishedRevisionId";
    IF revision_status <> 'COACH_VALIDATED' THEN
      RAISE EXCEPTION 'publication requires a coach-validated report revision';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "canonical_report_reviews"
      WHERE "reportRevisionId" = NEW."currentPublishedRevisionId" AND "decision" = 'APPROVED'
    ) THEN
      RAISE EXCEPTION 'publication requires an immutable approved report review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "canonical_report_artifacts_publication_guard"
BEFORE INSERT OR UPDATE ON "canonical_report_artifacts"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_report_publication();

CREATE TRIGGER "canonical_report_reviews_append_only"
BEFORE UPDATE OR DELETE ON "canonical_report_reviews"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();
