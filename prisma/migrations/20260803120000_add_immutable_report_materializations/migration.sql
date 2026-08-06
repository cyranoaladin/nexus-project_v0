-- A90.3: immutable rendered materializations, additive only.
-- ReportArtifact remains the historical per-attempt aggregate.
CREATE TYPE "ReportMaterializationAudience" AS ENUM ('ELEVE', 'PARENTS', 'NEXUS');
CREATE TYPE "ReportPdfStatus" AS ENUM ('READY', 'UNAVAILABLE');

CREATE TABLE "canonical_report_materializations" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "brandVersion" TEXT NOT NULL,
  "globalChecksum" TEXT NOT NULL,
  "materializedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "canonical_report_materializations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_report_audience_artifacts" (
  "id" TEXT NOT NULL,
  "materializationId" TEXT NOT NULL,
  "audience" "ReportMaterializationAudience" NOT NULL,
  "html" TEXT NOT NULL,
  "pdf" BYTEA,
  "pdfStatus" "ReportPdfStatus" NOT NULL,
  "checksum" TEXT NOT NULL,
  CONSTRAINT "canonical_report_audience_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "canonical_report_materializations_revisionId_key"
ON "canonical_report_materializations" ("revisionId");

CREATE UNIQUE INDEX "canonical_report_audience_artifacts_materializationId_audience_key"
ON "canonical_report_audience_artifacts" ("materializationId", "audience");

ALTER TABLE "canonical_report_materializations"
ADD CONSTRAINT "canonical_report_materializations_revisionId_fkey"
FOREIGN KEY ("revisionId") REFERENCES "canonical_report_revisions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "canonical_report_audience_artifacts"
ADD CONSTRAINT "canonical_report_audience_artifacts_materializationId_fkey"
FOREIGN KEY ("materializationId") REFERENCES "canonical_report_materializations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION canonical_bilans_guard_rendered_artifact_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'canonical rendered report artifacts are insert-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_report_materializations_immutable"
BEFORE UPDATE OR DELETE ON "canonical_report_materializations"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_rendered_artifact_immutability();

CREATE TRIGGER "canonical_report_audience_artifacts_immutable"
BEFORE UPDATE OR DELETE ON "canonical_report_audience_artifacts"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_rendered_artifact_immutability();
