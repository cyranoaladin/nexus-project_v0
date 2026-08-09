-- Provenance d'un attempt canonique : passation en ligne, ou saisie papier par
-- un membre du staff qui recopie une copie déjà passée.
--
-- Les deux produisent un bilan légitime, mais ce ne sont pas les mêmes faits :
-- l'une est faite par l'élève depuis sa session, l'autre est une transcription.
-- Les confondre reviendrait à maquiller l'origine d'une donnée.
--
-- Migration strictement additive. Aucune colonne, ligne ou contrainte
-- existante n'est supprimée ni renommée. `canonical_assessment_attempts` est
-- protégée par des triggers : ajouter une colonne est du DDL, autorisé ; c'est
-- la VALEUR qui ne doit jamais être posée par un UPDATE ultérieur. Le trigger
-- redéfini plus bas fait de cette règle une garantie du schéma, et pas
-- seulement une discipline applicative.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CanonicalAttemptProvenance') THEN
    CREATE TYPE "CanonicalAttemptProvenance" AS ENUM ('EN_LIGNE', 'SAISIE_PAPIER');
  END IF;
END;
$$;

-- DEFAULT 'EN_LIGNE' qualifie les lignes antérieures à cette migration : elles
-- ne peuvent avoir été produites que par une passation en ligne, la saisie
-- papier n'existant pas encore. Les écritures applicatives, elles, posent la
-- provenance explicitement.
ALTER TABLE "canonical_assessment_attempts"
  ADD COLUMN IF NOT EXISTS "provenance" "CanonicalAttemptProvenance" NOT NULL DEFAULT 'EN_LIGNE',
  ADD COLUMN IF NOT EXISTS "enteredById" TEXT,
  ADD COLUMN IF NOT EXISTS "enteredAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'canonical_assessment_attempts'
      AND (
        (column_name = 'enteredById' AND data_type <> 'text')
        OR (column_name = 'enteredAt' AND data_type <> 'timestamp without time zone')
      )
  ) THEN
    RAISE EXCEPTION 'incompatible canonical provenance column type';
  END IF;
END;
$$;

-- Le saisisseur est référencé par son identifiant opaque : l'audit reste
-- pseudonyme (aucun nom, aucune adresse ne rejoint la ligne d'attempt ni le
-- rapport rendu), tout en restant résoluble par une requête autorisée.
-- Restrict, comme pour le relecteur d'une révision : un compte impliqué dans
-- un audit ne peut pas être effacé en laissant l'audit orphelin.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'canonical_assessment_attempts_enteredById_fkey'
  ) THEN
    ALTER TABLE "canonical_assessment_attempts"
      ADD CONSTRAINT "canonical_assessment_attempts_enteredById_fkey"
      FOREIGN KEY ("enteredById") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

-- Une saisie papier sans saisisseur ni date n'est pas une saisie papier
-- traçable, et une passation en ligne n'a pas de saisisseur. La provenance ne
-- peut donc pas être revendiquée sans son audit, ni l'audit sans sa
-- provenance.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'canonical_assessment_attempts_provenance_audit_check'
  ) THEN
    ALTER TABLE "canonical_assessment_attempts"
      ADD CONSTRAINT "canonical_assessment_attempts_provenance_audit_check"
      CHECK (
        ("provenance" = 'EN_LIGNE' AND "enteredById" IS NULL AND "enteredAt" IS NULL)
        OR ("provenance" = 'SAISIE_PAPIER' AND "enteredById" IS NOT NULL AND "enteredAt" IS NOT NULL)
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS "canonical_assessment_attempts_provenance_createdAt_idx"
  ON "canonical_assessment_attempts" ("provenance", "createdAt");

-- Redéfinition du trigger d'immutabilité.
--
-- Le corps existant est repris à l'identique ; deux choses seulement changent :
--
-- 1. provenance, enteredById et enteredAt rejoignent le bloc de provenance
--    scellée après soumission ;
-- 2. ces trois colonnes sont en outre immuables DÈS LA CRÉATION, y compris en
--    DRAFT — contrairement aux réponses, qu'un brouillon peut légitimement
--    modifier. L'origine d'une donnée n'est pas un état de travail : elle est
--    posée par l'INSERT, et aucun UPDATE ne peut plus la réécrire. C'est ce qui
--    rend une saisie papier identifiable comme telle, pour toujours.
CREATE OR REPLACE FUNCTION canonical_bilans_reject_submitted_attempt_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" NOT IN ('IN_PROGRESS', 'DRAFT') THEN
      RAISE EXCEPTION 'canonical assessment attempts are immutable after submission';
    END IF;
    RETURN OLD;
  END IF;

  IF (
    NEW."provenance" IS DISTINCT FROM OLD."provenance"
    OR NEW."enteredById" IS DISTINCT FROM OLD."enteredById"
    OR NEW."enteredAt" IS DISTINCT FROM OLD."enteredAt"
  ) THEN
    RAISE EXCEPTION 'canonical assessment attempt provenance is set at creation and can never be updated';
  END IF;

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
    NEW."seed" IS DISTINCT FROM OLD."seed"
    OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
    OR NEW."subject" IS DISTINCT FROM OLD."subject"
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
