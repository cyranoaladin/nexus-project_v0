-- Workflow assistante complet : annotations de revue, état « Correction
-- demandée », liens de consultation signés, journal d'accès, transmissions
-- WhatsApp confirmées. Migration STRICTEMENT ADDITIVE : aucune table legacy
-- modifiée, aucun invariant append-only affaibli — le garde des révisions est
-- ÉTENDU (nouvelles transitions tracées), jamais relâché.

-- 1. Nouvel état de révision : « Correction demandée », distinct du rejet
--    (qui ferme) et de l'attente de diffusion.
ALTER TYPE "ReportRevisionStatus" ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED';

-- 2. Annotations de revue — métadonnées de revue pures : elles ne touchent
--    ni le snapshot de score, ni les banques, ni le contenu de la révision.
CREATE TABLE "canonical_report_review_annotations" (
    "id" TEXT NOT NULL,
    "reportReviewId" TEXT NOT NULL,
    "audience" "ReportMaterializationAudience" NOT NULL,
    "section" TEXT NOT NULL,
    "remark" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_report_review_annotations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canonical_report_review_annotations_section_bounds"
      CHECK (char_length("section") BETWEEN 1 AND 64),
    CONSTRAINT "canonical_report_review_annotations_remark_bounds"
      CHECK (char_length("remark") BETWEEN 1 AND 4000)
);

ALTER TABLE "canonical_report_review_annotations"
  ADD CONSTRAINT "canonical_report_review_annotations_reportReviewId_fkey"
  FOREIGN KEY ("reportReviewId") REFERENCES "canonical_report_reviews"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "canonical_report_review_annotations_reportReviewId_createdA_idx"
  ON "canonical_report_review_annotations" ("reportReviewId", "createdAt");

-- Jamais écrasées : append-only strict, comme les reviews qu'elles annotent.
CREATE TRIGGER "canonical_report_review_annotations_append_only"
BEFORE UPDATE OR DELETE ON "canonical_report_review_annotations"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();

-- 3. Liens de consultation signés — un lien par bilan diffusé, par audience
--    publique et par destinataire. Le jeton n'est JAMAIS stocké : seule son
--    empreinte SHA-256 l'est. Le bilan NEXUS (document interne) est interdit
--    au niveau de la base elle-même.
CREATE TABLE "canonical_report_share_links" (
    "id" TEXT NOT NULL,
    "reportArtifactId" TEXT NOT NULL,
    "audience" "ReportMaterializationAudience" NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_report_share_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canonical_report_share_links_never_nexus"
      CHECK ("audience"::text IN ('ELEVE', 'PARENTS')),
    CONSTRAINT "canonical_report_share_links_tokenHash_bounds"
      CHECK (char_length("tokenHash") = 64)
);

ALTER TABLE "canonical_report_share_links"
  ADD CONSTRAINT "canonical_report_share_links_reportArtifactId_fkey"
  FOREIGN KEY ("reportArtifactId") REFERENCES "canonical_report_artifacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_share_links"
  ADD CONSTRAINT "canonical_report_share_links_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_share_links"
  ADD CONSTRAINT "canonical_report_share_links_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "canonical_report_share_links_tokenHash_key"
  ON "canonical_report_share_links" ("tokenHash");
CREATE INDEX "canonical_report_share_links_reportArtifactId_createdAt_idx"
  ON "canonical_report_share_links" ("reportArtifactId", "createdAt");

-- Un lien est immuable, à une exception près : sa révocation, une seule
-- fois, sans réécriture d'aucun autre champ. Une révocation ne s'annule pas.
CREATE OR REPLACE FUNCTION canonical_bilans_guard_share_link_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical report share links are append-only and cannot be DELETE';
  END IF;

  IF OLD."revokedAt" IS NULL
    AND NEW."revokedAt" IS NOT NULL
    AND NEW."id" IS NOT DISTINCT FROM OLD."id"
    AND NEW."reportArtifactId" IS NOT DISTINCT FROM OLD."reportArtifactId"
    AND NEW."audience" IS NOT DISTINCT FROM OLD."audience"
    AND NEW."recipientUserId" IS NOT DISTINCT FROM OLD."recipientUserId"
    AND NEW."tokenHash" IS NOT DISTINCT FROM OLD."tokenHash"
    AND NEW."expiresAt" IS NOT DISTINCT FROM OLD."expiresAt"
    AND NEW."createdById" IS NOT DISTINCT FROM OLD."createdById"
    AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'canonical report share links only accept a single revocation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_report_share_links_revocation_guard"
BEFORE UPDATE OR DELETE ON "canonical_report_share_links"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_guard_share_link_mutation();

-- 4. Journal de consultation — date seule, aucune donnée identifiante
--    superflue (ni IP, ni user-agent).
CREATE TABLE "canonical_share_link_accesses" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_share_link_accesses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "canonical_share_link_accesses"
  ADD CONSTRAINT "canonical_share_link_accesses_shareLinkId_fkey"
  FOREIGN KEY ("shareLinkId") REFERENCES "canonical_report_share_links"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "canonical_share_link_accesses_shareLinkId_accessedAt_idx"
  ON "canonical_share_link_accesses" ("shareLinkId", "accessedAt");

CREATE TRIGGER "canonical_share_link_accesses_append_only"
BEFORE UPDATE OR DELETE ON "canonical_share_link_accesses"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();

-- 5. Transmissions confirmées — « transmis au parent le [date] par
--    WhatsApp ». Trace irréversible, posée par l'assistante après envoi.
CREATE TABLE "canonical_report_transmissions" (
    "id" TEXT NOT NULL,
    "reportArtifactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_report_transmissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canonical_report_transmissions_channel_known"
      CHECK ("channel" IN ('WHATSAPP'))
);

ALTER TABLE "canonical_report_transmissions"
  ADD CONSTRAINT "canonical_report_transmissions_reportArtifactId_fkey"
  FOREIGN KEY ("reportArtifactId") REFERENCES "canonical_report_artifacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_transmissions"
  ADD CONSTRAINT "canonical_report_transmissions_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_report_transmissions"
  ADD CONSTRAINT "canonical_report_transmissions_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "canonical_report_transmissions_reportArtifactId_confirmedAt_idx"
  ON "canonical_report_transmissions" ("reportArtifactId", "confirmedAt");

CREATE TRIGGER "canonical_report_transmissions_append_only"
BEFORE UPDATE OR DELETE ON "canonical_report_transmissions"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();

-- 6. Extension du garde de mutation des révisions. Les branches existantes
--    (validation approuvée, rejet tracé) sont reprises À L'IDENTIQUE depuis
--    20260802170000 ; s'y AJOUTENT deux transitions tracées :
--      PENDING_REVIEW → CORRECTION_REQUESTED  (revue CHANGES_REQUESTED exigée)
--      CORRECTION_REQUESTED → PENDING_REVIEW  (reprise de revue après correction)
--    Dans tous les cas, contenu et provenance restent immuables.
CREATE OR REPLACE FUNCTION canonical_bilans_guard_report_revision_mutation()
RETURNS TRIGGER AS $$
DECLARE
  immutable_columns_unchanged BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical report revisions are append-only and cannot be DELETE';
  END IF;

  immutable_columns_unchanged :=
    NEW."validationFailures" IS NOT DISTINCT FROM OLD."validationFailures"
    AND NEW."reportArtifactId" IS NOT DISTINCT FROM OLD."reportArtifactId"
    AND NEW."scoreSnapshotId" IS NOT DISTINCT FROM OLD."scoreSnapshotId"
    AND NEW."reportPackId" IS NOT DISTINCT FROM OLD."reportPackId"
    AND NEW."reportPackVersion" IS NOT DISTINCT FROM OLD."reportPackVersion"
    AND NEW."corpusManifestId" IS NOT DISTINCT FROM OLD."corpusManifestId"
    AND NEW."corpusManifestVersion" IS NOT DISTINCT FROM OLD."corpusManifestVersion"
    AND NEW."promptRevision" IS NOT DISTINCT FROM OLD."promptRevision"
    AND NEW."contextChecksum" IS NOT DISTINCT FROM OLD."contextChecksum"
    AND NEW."content" IS NOT DISTINCT FROM OLD."content"
    AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt";

  IF OLD."status" = 'PENDING_REVIEW'
    AND NEW."status" IN ('COACH_VALIDATED', 'REJECTED')
    AND immutable_columns_unchanged
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

  IF OLD."status" = 'PENDING_REVIEW'
    AND NEW."status"::text = 'CORRECTION_REQUESTED'
    AND immutable_columns_unchanged
    AND EXISTS (
      SELECT 1 FROM "canonical_report_reviews"
      WHERE "reportRevisionId" = OLD."id"
        AND "decision" = 'CHANGES_REQUESTED'::"ReportReviewDecision"
    )
  THEN
    RETURN NEW;
  END IF;

  IF OLD."status"::text = 'CORRECTION_REQUESTED'
    AND NEW."status" = 'PENDING_REVIEW'
    AND immutable_columns_unchanged
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'canonical report revisions are append-only outside traced coach review';
END;
$$ LANGUAGE plpgsql;
