-- Régénération des bilans — évolution ADDITIVE.
--
-- Décision responsable (13/08/2026) : quand une règle évolue, l'assistante
-- régénère elle-même le rendu depuis l'évidence. Le snapshot de score reste
-- intact ; l'historique intégral des révisions est conservé (aucune ligne
-- existante modifiée ni supprimée) ; chaque régénération est tracée
-- (append-only) : qui, quand, motif, versions de règle avant/après.

-- 1. Une génération de rendu par snapshot ET par version de règle :
--    l'unicité stricte (un seul rendu à vie) devient [snapshot, génération].
ALTER TABLE "canonical_report_revisions"
  ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "canonical_report_revisions_scoreSnapshotId_key";

CREATE UNIQUE INDEX "canonical_report_revisions_scoreSnapshotId_generation_key"
  ON "canonical_report_revisions"("scoreSnapshotId", "generation");

-- 2. Trace append-only des régénérations.
CREATE TABLE "canonical_report_regenerations" (
  "id" TEXT NOT NULL,
  "fromRevisionId" TEXT NOT NULL,
  "toRevisionId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "motif" TEXT NOT NULL,
  "engineVersionBefore" TEXT NOT NULL,
  "engineVersionAfter" TEXT NOT NULL,
  "briefRegenerated" BOOLEAN NOT NULL DEFAULT false,
  "briefPromptVersion" TEXT,
  "briefModel" TEXT,
  "profileDiff" JSONB NOT NULL,
  "wasPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_report_regenerations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "canonical_report_regenerations_toRevisionId_idx"
  ON "canonical_report_regenerations"("toRevisionId");
CREATE INDEX "canonical_report_regenerations_createdAt_idx"
  ON "canonical_report_regenerations"("createdAt");

ALTER TABLE "canonical_report_regenerations"
  ADD CONSTRAINT "canonical_report_regenerations_fromRevisionId_fkey"
  FOREIGN KEY ("fromRevisionId") REFERENCES "canonical_report_revisions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_regenerations"
  ADD CONSTRAINT "canonical_report_regenerations_toRevisionId_fkey"
  FOREIGN KEY ("toRevisionId") REFERENCES "canonical_report_revisions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_regenerations"
  ADD CONSTRAINT "canonical_report_regenerations_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un motif vide n'est pas un motif.
ALTER TABLE "canonical_report_regenerations"
  ADD CONSTRAINT "canonical_report_regenerations_motif_meaningful"
  CHECK (length(btrim("motif")) >= 5);

-- Append-only : la trace ne se réécrit jamais.
CREATE OR REPLACE FUNCTION canonical_bilans_guard_regeneration_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'canonical report regenerations are append-only and cannot be %', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER canonical_report_regenerations_append_only
  BEFORE UPDATE OR DELETE ON "canonical_report_regenerations"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_regeneration_mutation();
