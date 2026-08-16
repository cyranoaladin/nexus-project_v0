-- Sécurisation du workflow des briefs enseignant (incident P0 de gouvernance
-- pédagogique). Additive et conversion sûre, testée sur clone avec les 28
-- briefs réels de production (tous PENDING_REVIEW, aucun editedContent non
-- nul vérifié en lecture seule avant écriture de cette migration).
--
-- 1. "CanonicalJobType" : nouvelle valeur pour le job outbox du worker de
--    génération de briefs (réutilisation de l'infrastructure canonique
--    canonical_job_outbox / lib/bilans/worker, jamais du worker NPC).
ALTER TYPE "CanonicalJobType" ADD VALUE IF NOT EXISTS 'GENERATE_TEACHER_BRIEF';

-- 2. "status" : String + CHECK ad hoc -> enum natif Postgres. La CHECK
--    constraint existante garantit déjà que les 28 lignes réelles ne
--    contiennent que les 4 valeurs autorisées : conversion USING sans perte.
CREATE TYPE "TeacherBriefStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'CORRECTION_REQUESTED', 'SUPERSEDED');

-- La CHECK constraint textuelle doit tomber AVANT le changement de type : la
-- comparaison "status" IN ('PENDING_REVIEW', ...) qu'elle porte devient
-- invalide (enum vs text) dès que la colonne change de type, et Postgres la
-- revalide pendant l'ALTER COLUMN TYPE lui-même (constaté sur clone).
ALTER TABLE "canonical_teacher_briefs" DROP CONSTRAINT "canonical_teacher_briefs_status_known";

ALTER TABLE "canonical_teacher_briefs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "canonical_teacher_briefs"
  ALTER COLUMN "status" TYPE "TeacherBriefStatus" USING "status"::"TeacherBriefStatus";
ALTER TABLE "canonical_teacher_briefs" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW'::"TeacherBriefStatus";

-- 3. Édition manuelle structurée : "editedContent" (TEXT, re-parsé en JSON de
--    façon défensive côté lecture -- le défaut audité) est remplacé par
--    "approvedContent" (JSONB, même schéma que "content"), posé une seule
--    fois, uniquement au moment de l'approbation. Vérifié en lecture seule
--    juste avant cette migration : 0 valeur "editedContent" non nulle sur 28
--    lignes en production (aucun brief n'a jamais été approuvé) -- DROP direct,
--    sans conversion, aucune perte de donnée réelle possible.
ALTER TABLE "canonical_teacher_briefs" DROP COLUMN "editedContent";
ALTER TABLE "canonical_teacher_briefs" ADD COLUMN "approvedContent" JSONB;

-- Un contenu approuvé structuré n'a de sens qu'associé à un statut APPROVED.
ALTER TABLE "canonical_teacher_briefs"
  ADD CONSTRAINT "canonical_teacher_briefs_approved_content_requires_approved"
  CHECK ("approvedContent" IS NULL OR "status" = 'APPROVED');

CREATE INDEX "canonical_teacher_briefs_reportArtifactId_status_idx"
  ON "canonical_teacher_briefs" ("reportArtifactId", "status");

-- 4. Garde de mutation étendue : en plus de l'immutabilité déjà en place
--    (contenu généré, provenance, usage jamais réécrits ; relecture posée une
--    seule fois), la machine de transitions de "status" est désormais
--    appliquée EN BASE, pas seulement dans le service TypeScript :
--      PENDING_REVIEW      -> APPROVED
--      PENDING_REVIEW      -> CORRECTION_REQUESTED
--      CORRECTION_REQUESTED -> SUPERSEDED
--    APPROVED et SUPERSEDED sont terminaux. "approvedContent" ne peut passer
--    que de NULL à une valeur, jamais être réécrit ensuite.
CREATE OR REPLACE FUNCTION canonical_bilans_guard_teacher_brief_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical teacher briefs are append-only and cannot be DELETE';
  END IF;

  -- Champs de génération : jamais réécrits, quelle que soit la transition.
  IF NOT (
    NEW."id" IS NOT DISTINCT FROM OLD."id"
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
  ) THEN
    RAISE EXCEPTION 'canonical teacher briefs: generation fields are immutable';
  END IF;

  -- Relecture posée une seule fois (reviewedById/reviewedAt/reviewMotif).
  IF OLD."reviewedById" IS NOT NULL AND (
    NEW."reviewedById" IS DISTINCT FROM OLD."reviewedById"
    OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt"
    OR NEW."reviewMotif" IS DISTINCT FROM OLD."reviewMotif"
  ) THEN
    RAISE EXCEPTION 'canonical teacher briefs: review trace is immutable once set';
  END IF;

  -- approvedContent posé une seule fois, jamais réécrit ni effacé.
  IF OLD."approvedContent" IS NOT NULL AND NEW."approvedContent" IS DISTINCT FROM OLD."approvedContent" THEN
    RAISE EXCEPTION 'canonical teacher briefs: approvedContent is immutable once set';
  END IF;

  -- Machine de transitions de statut.
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NOT (
      (OLD."status" = 'PENDING_REVIEW' AND NEW."status" = 'APPROVED')
      OR (OLD."status" = 'PENDING_REVIEW' AND NEW."status" = 'CORRECTION_REQUESTED')
      OR (OLD."status" = 'CORRECTION_REQUESTED' AND NEW."status" = 'SUPERSEDED')
    ) THEN
      RAISE EXCEPTION 'canonical teacher briefs: illegal status transition % -> %', OLD."status", NEW."status";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Journal canonique, append-only, des tentatives de génération (§7).
CREATE TYPE "TeacherBriefAttemptResult" AS ENUM (
  'GENERATED', 'ALREADY_PRESENT', 'DETERMINISTIC_ONLY', 'RETRYABLE_FAILURE',
  'BLOCKED_FAILURE', 'BUDGET_BLOCKED', 'STALE_INPUT', 'CANCELLED_BEFORE_START'
);

CREATE TABLE "canonical_teacher_brief_attempts" (
    "id" TEXT NOT NULL,
    "reportArtifactId" TEXT NOT NULL,
    "expectedScoreSnapshotId" TEXT NOT NULL,
    "jobId" TEXT,
    "subject" "Subject" NOT NULL,
    "gradeLevel" "GradeLevel" NOT NULL,
    "actorId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "result" "TeacherBriefAttemptResult" NOT NULL,
    "causeCode" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(10,6),
    "costUnknown" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER NOT NULL,
    "domainsRequested" INTEGER NOT NULL,
    "domainsProcessed" INTEGER NOT NULL,
    "domainOutcomes" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_teacher_brief_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "canonical_teacher_brief_attempts_duration_nonneg" CHECK ("durationMs" >= 0),
    CONSTRAINT "canonical_teacher_brief_attempts_retry_nonneg" CHECK ("retryCount" >= 0),
    CONSTRAINT "canonical_teacher_brief_attempts_domains_consistent"
      CHECK ("domainsProcessed" >= 0 AND "domainsRequested" >= 0 AND "domainsProcessed" <= "domainsRequested"),
    CONSTRAINT "canonical_teacher_brief_attempts_cost_or_unknown"
      CHECK ("estimatedCostUsd" IS NOT NULL OR "costUnknown" = true)
);

ALTER TABLE "canonical_teacher_brief_attempts"
  ADD CONSTRAINT "canonical_teacher_brief_attempts_reportArtifactId_fkey"
  FOREIGN KEY ("reportArtifactId") REFERENCES "canonical_report_artifacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "canonical_teacher_brief_attempts"
  ADD CONSTRAINT "canonical_teacher_brief_attempts_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "canonical_teacher_brief_attempts_reportArtifactId_created_idx"
  ON "canonical_teacher_brief_attempts" ("reportArtifactId", "createdAt");
CREATE INDEX "canonical_teacher_brief_attempts_result_created_idx"
  ON "canonical_teacher_brief_attempts" ("result", "createdAt");
CREATE INDEX "canonical_teacher_brief_attempts_jobId_idx"
  ON "canonical_teacher_brief_attempts" ("jobId");

-- Append-only strict : réutilise le garde générique déjà en place pour les
-- annotations de relecture (#124 / migration add_teacher_briefs).
CREATE TRIGGER "canonical_teacher_brief_attempts_append_only"
BEFORE UPDATE OR DELETE ON "canonical_teacher_brief_attempts"
FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();

-- 6. Budget mensuel atomique (§11) : une ligne par mois calendaire, mise à
--    jour par une unique instruction UPDATE conditionnelle -- jamais de
--    lecture non verrouillée suivie d'un appel. "reservedUsd" couvre les
--    générations en cours (réservation avant appel, régularisée après usage
--    réel connu) ; "spentUsd" couvre le coût réellement comptabilisé, y
--    compris les tentatives ratées mais facturées.
CREATE TABLE "canonical_teacher_brief_monthly_budgets" (
    "monthStart" DATE NOT NULL,
    "budgetUsd" DECIMAL(10,2) NOT NULL,
    "spentUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "reservedUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_teacher_brief_monthly_budgets_pkey" PRIMARY KEY ("monthStart"),
    CONSTRAINT "canonical_teacher_brief_monthly_budgets_nonneg"
      CHECK ("spentUsd" >= 0 AND "reservedUsd" >= 0 AND "budgetUsd" > 0)
);
