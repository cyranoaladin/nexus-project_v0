-- Hardening follow-up for the additive canonical bilans foundation.
-- No legacy table is altered or removed.

-- ReportArtifact can only point at one of its own revisions. The composite
-- reference closes the gap left by a single-column revision foreign key.
CREATE UNIQUE INDEX "canonical_report_revisions_id_reportArtifactId_key"
ON "canonical_report_revisions" ("id", "reportArtifactId");
CREATE UNIQUE INDEX "canonical_report_artifacts_currentPublishedRevisionId_id_key"
ON "canonical_report_artifacts" ("currentPublishedRevisionId", "id");

ALTER TABLE "canonical_report_artifacts"
  DROP CONSTRAINT "canonical_report_artifacts_currentPublishedRevisionId_fkey";

ALTER TABLE "canonical_report_artifacts"
  ADD CONSTRAINT "canonical_report_artifacts_current_revision_same_artifact_fkey"
  FOREIGN KEY ("currentPublishedRevisionId", "id")
  REFERENCES "canonical_report_revisions"("id", "reportArtifactId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Submitted attempts retain their pedagogical input and provenance. Lifecycle
-- state and updatedAt remain mutable so a submitted attempt may be scored.
CREATE OR REPLACE FUNCTION canonical_bilans_reject_submitted_attempt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'canonical assessment attempts are immutable after submission';
    END IF;
    RETURN OLD;
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

CREATE TRIGGER "canonical_assessment_attempts_submitted_immutable"
BEFORE UPDATE OR DELETE ON "canonical_assessment_attempts"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_submitted_attempt_mutation();

-- Score snapshots, evidence and report revisions are append-only audit records.
CREATE OR REPLACE FUNCTION canonical_bilans_reject_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and cannot be %', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_score_snapshots_append_only"
BEFORE UPDATE OR DELETE ON "canonical_score_snapshots"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();

CREATE TRIGGER "canonical_evidence_items_append_only"
BEFORE UPDATE OR DELETE ON "canonical_evidence_items"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();

CREATE TRIGGER "canonical_report_revisions_append_only"
BEFORE UPDATE OR DELETE ON "canonical_report_revisions"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();
