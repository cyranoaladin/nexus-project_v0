-- Bilan enseignant enrichi par LLM. Migration STRICTEMENT ADDITIVE.
-- Le brief est un document INTERNE (jamais transmis aux familles, jamais
-- éligible aux liens signés — la contrainte anti-NEXUS de ces liens reste
-- intouchée). Le contenu généré, sa provenance (version de prompt, modèle)
-- et son usage (tokens, coût estimé) sont immuables ; seuls le statut de
-- relecture, la correction manuelle (une fois) et la trace de relecture
-- peuvent être posés. Une régénération crée une NOUVELLE ligne (version+1).

CREATE TABLE "canonical_teacher_briefs" (
    "id" TEXT NOT NULL,
    "reportArtifactId" TEXT NOT NULL,
    "scoreSnapshotId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "content" JSONB NOT NULL,
    "editedContent" TEXT,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "cachedPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL,
    "generationMs" INTEGER NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewMotif" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_teacher_briefs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canonical_teacher_briefs_status_known"
      CHECK ("status" IN ('PENDING_REVIEW', 'APPROVED', 'CORRECTION_REQUESTED', 'SUPERSEDED')),
    CONSTRAINT "canonical_teacher_briefs_version_positive" CHECK ("version" >= 1),
    CONSTRAINT "canonical_teacher_briefs_review_consistent"
      CHECK (("reviewedById" IS NULL) = ("reviewedAt" IS NULL))
);

ALTER TABLE "canonical_teacher_briefs"
  ADD CONSTRAINT "canonical_teacher_briefs_reportArtifactId_fkey"
  FOREIGN KEY ("reportArtifactId") REFERENCES "canonical_report_artifacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_teacher_briefs"
  ADD CONSTRAINT "canonical_teacher_briefs_scoreSnapshotId_fkey"
  FOREIGN KEY ("scoreSnapshotId") REFERENCES "canonical_score_snapshots"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_teacher_briefs"
  ADD CONSTRAINT "canonical_teacher_briefs_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_teacher_briefs"
  ADD CONSTRAINT "canonical_teacher_briefs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "canonical_teacher_briefs_reportArtifactId_version_key"
  ON "canonical_teacher_briefs" ("reportArtifactId", "version");
CREATE INDEX "canonical_teacher_briefs_status_createdAt_idx"
  ON "canonical_teacher_briefs" ("status", "createdAt");

-- Immutabilité : contenu généré, provenance et usage ne se réécrivent
-- jamais ; la correction manuelle ne se pose qu'une fois ; une relecture
-- posée ne s'efface pas ; DELETE interdit.
CREATE OR REPLACE FUNCTION canonical_bilans_guard_teacher_brief_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical teacher briefs are append-only and cannot be DELETE';
  END IF;

  IF NEW."id" IS NOT DISTINCT FROM OLD."id"
    AND NEW."reportArtifactId" IS NOT DISTINCT FROM OLD."reportArtifactId"
    AND NEW."scoreSnapshotId" IS NOT DISTINCT FROM OLD."scoreSnapshotId"
    AND NEW."version" IS NOT DISTINCT FROM OLD."version"
    AND NEW."content" IS NOT DISTINCT FROM OLD."content"
    AND NEW."promptVersion" IS NOT DISTINCT FROM OLD."promptVersion"
    AND NEW."model" IS NOT DISTINCT FROM OLD."model"
    AND NEW."promptTokens" IS NOT DISTINCT FROM OLD."promptTokens"
    AND NEW."cachedPromptTokens" IS NOT DISTINCT FROM OLD."cachedPromptTokens"
    AND NEW."completionTokens" IS NOT DISTINCT FROM OLD."completionTokens"
    AND NEW."estimatedCostUsd" IS NOT DISTINCT FROM OLD."estimatedCostUsd"
    AND NEW."generationMs" IS NOT DISTINCT FROM OLD."generationMs"
    AND NEW."createdById" IS NOT DISTINCT FROM OLD."createdById"
    AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
    AND (OLD."editedContent" IS NULL OR NEW."editedContent" IS NOT DISTINCT FROM OLD."editedContent")
    AND (OLD."reviewedById" IS NULL OR (
      NEW."reviewedById" IS NOT DISTINCT FROM OLD."reviewedById"
      AND NEW."reviewedAt" IS NOT DISTINCT FROM OLD."reviewedAt"
      AND NEW."reviewMotif" IS NOT DISTINCT FROM OLD."reviewMotif"
    ))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'canonical teacher briefs only accept review state, one manual correction and one review trace';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_teacher_briefs_mutation_guard"
BEFORE UPDATE OR DELETE ON "canonical_teacher_briefs"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_teacher_brief_mutation();

-- Annotations de relecture du brief — mêmes règles que les annotations de
-- revue de #124 : append-only strict.
CREATE TABLE "canonical_teacher_brief_annotations" (
    "id" TEXT NOT NULL,
    "teacherBriefId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "remark" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_teacher_brief_annotations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canonical_teacher_brief_annotations_section_bounds"
      CHECK (char_length("section") BETWEEN 1 AND 64),
    CONSTRAINT "canonical_teacher_brief_annotations_remark_bounds"
      CHECK (char_length("remark") BETWEEN 1 AND 4000)
);

ALTER TABLE "canonical_teacher_brief_annotations"
  ADD CONSTRAINT "canonical_teacher_brief_annotations_teacherBriefId_fkey"
  FOREIGN KEY ("teacherBriefId") REFERENCES "canonical_teacher_briefs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_teacher_brief_annotations"
  ADD CONSTRAINT "canonical_teacher_brief_annotations_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "canonical_teacher_brief_annotations_teacherBriefId_created_idx"
  ON "canonical_teacher_brief_annotations" ("teacherBriefId", "createdAt");

CREATE TRIGGER "canonical_teacher_brief_annotations_append_only"
BEFORE UPDATE OR DELETE ON "canonical_teacher_brief_annotations"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();
