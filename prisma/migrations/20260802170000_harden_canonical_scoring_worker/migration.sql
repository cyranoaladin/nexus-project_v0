-- A86.2: one deterministic scoring result and one initial report revision per
-- canonical attempt. Additive only; legacy tables and rows are untouched.
CREATE UNIQUE INDEX "canonical_score_snapshots_assessmentAttemptId_key"
ON "canonical_score_snapshots" ("assessmentAttemptId");

CREATE UNIQUE INDEX "canonical_report_artifacts_assessmentAttemptId_key"
ON "canonical_report_artifacts" ("assessmentAttemptId");

CREATE UNIQUE INDEX "canonical_report_revisions_scoreSnapshotId_key"
ON "canonical_report_revisions" ("scoreSnapshotId");

-- Preserve immutable revisions while permitting the second explicit coach
-- outcome: a traced rejection. Validation with failures remains impossible.
CREATE OR REPLACE FUNCTION canonical_bilans_guard_report_revision_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical report revisions are append-only and cannot be DELETE';
  END IF;

  IF OLD."status" = 'PENDING_REVIEW'
    AND NEW."status" IN ('COACH_VALIDATED', 'REJECTED')
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
      WHERE "reportRevisionId" = OLD."id"
        AND "decision" = CASE
          WHEN NEW."status" = 'COACH_VALIDATED' THEN 'APPROVED'::"ReportReviewDecision"
          ELSE 'REJECTED'::"ReportReviewDecision"
        END
    )
    AND (NEW."status" <> 'COACH_VALIDATED' OR cardinality(NEW."validationFailures") = 0)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'canonical report revisions are append-only outside traced coach review';
END;
$$ LANGUAGE plpgsql;
