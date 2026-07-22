-- Canonical-only follow-up: allow the single audited coach-validation update
-- while keeping revision content/provenance and reviews immutable.

ALTER TYPE "CanonicalNotificationEventType" ADD VALUE IF NOT EXISTS 'BILAN_GENERATED';
ALTER TYPE "CanonicalNotificationEventType" ADD VALUE IF NOT EXISTS 'BILAN_PUBLISHED';

DROP TRIGGER "canonical_report_revisions_append_only" ON "canonical_report_revisions";

CREATE OR REPLACE FUNCTION canonical_bilans_guard_report_revision_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical report revisions are append-only and cannot be DELETE';
  END IF;

  IF OLD."status" = 'PENDING_REVIEW'
    AND NEW."status" = 'COACH_VALIDATED'
    AND NEW."reportArtifactId" IS NOT DISTINCT FROM OLD."reportArtifactId"
    AND NEW."scoreSnapshotId" IS NOT DISTINCT FROM OLD."scoreSnapshotId"
    AND NEW."reportPackId" IS NOT DISTINCT FROM OLD."reportPackId"
    AND NEW."reportPackVersion" IS NOT DISTINCT FROM OLD."reportPackVersion"
    AND NEW."corpusManifestId" IS NOT DISTINCT FROM OLD."corpusManifestId"
    AND NEW."corpusManifestVersion" IS NOT DISTINCT FROM OLD."corpusManifestVersion"
    AND NEW."promptRevision" IS NOT DISTINCT FROM OLD."promptRevision"
    AND NEW."contextChecksum" IS NOT DISTINCT FROM OLD."contextChecksum"
    AND NEW."content" IS NOT DISTINCT FROM OLD."content"
    AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
    AND EXISTS (
      SELECT 1 FROM "canonical_report_reviews"
      WHERE "reportRevisionId" = OLD."id" AND "decision" = 'APPROVED'
    )
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'canonical report revisions are append-only outside approved coach validation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_report_revisions_validation_guard"
BEFORE UPDATE OR DELETE ON "canonical_report_revisions"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_report_revision_mutation();

CREATE OR REPLACE FUNCTION canonical_bilans_guard_artifact_attempt_reassignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."assessmentAttemptId" IS DISTINCT FROM OLD."assessmentAttemptId"
    AND EXISTS (SELECT 1 FROM "canonical_report_revisions" WHERE "reportArtifactId" = OLD."id") THEN
    RAISE EXCEPTION 'cannot reassign a report artifact after its first revision';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_report_artifacts_attempt_reassignment_guard"
BEFORE UPDATE ON "canonical_report_artifacts"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_artifact_attempt_reassignment();
