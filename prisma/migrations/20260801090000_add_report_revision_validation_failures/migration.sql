-- Additive publication safety: deterministic validator failures are immutable
-- provenance and prevent coach validation or artifact publication.
ALTER TABLE "canonical_report_revisions"
  ADD COLUMN "validationFailures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "canonical_report_revisions"
  ADD CONSTRAINT "canonical_report_revisions_failures_block_validation"
  CHECK (
    "status" NOT IN ('COACH_VALIDATED', 'APPROVED')
    OR cardinality("validationFailures") = 0
  );

CREATE OR REPLACE FUNCTION canonical_bilans_guard_report_revision_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical report revisions are append-only and cannot be DELETE';
  END IF;

  IF OLD."status" = 'PENDING_REVIEW'
    AND NEW."status" = 'COACH_VALIDATED'
    AND cardinality(NEW."validationFailures") = 0
    AND NEW."validationFailures" IS NOT DISTINCT FROM OLD."validationFailures"
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

CREATE OR REPLACE FUNCTION canonical_bilans_guard_artifact_validation_failures()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'PUBLISHED' AND (
    NEW."currentPublishedRevisionId" IS NULL
    OR EXISTS (
      SELECT 1 FROM "canonical_report_revisions"
      WHERE "id" = NEW."currentPublishedRevisionId"
        AND cardinality("validationFailures") > 0
    )
  ) THEN
    RAISE EXCEPTION 'cannot publish an artifact with validation failures';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_report_artifacts_validation_failures_guard"
BEFORE INSERT OR UPDATE ON "canonical_report_artifacts"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_artifact_validation_failures();
