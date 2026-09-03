-- ⚠️  FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
--
-- Source        : data/curriculum/v1/legacy-specialties-migration.json
-- Générateur    : scripts/curriculum/generate-academic-enrollment-migration.ts
-- Vérification  : npm run curriculum:migration:check
--
-- ── Ce que fait cette migration ──────────────────────────────────────────────
-- Elle remplace `students.specialties` par le modèle d'inscriptions.
--
-- Sont STOCKÉS les seuls CHOIX : spécialités et options. Le tronc commun et les
-- modules de voie sont dérivés du couple (niveau × voie) via le catalogue
-- versionné ; leur créer une ligne serait affirmer deux fois la même chose,
-- avec deux façons de diverger.
--
-- ── Atomicité ────────────────────────────────────────────────────────────────
-- L'intégralité de la migration tient dans UN SEUL bloc `DO`, donc dans une
-- seule instruction SQL. Toute erreur annule tout : ni type, ni table, ni index,
-- ni colonne supprimée ne subsiste. Cette garantie ne dépend pas de l'appelant
-- — elle tient même hors transaction (psql sans ON_ERROR_STOP, outil tiers).
--
-- ── Pourquoi une comparaison d'ENSEMBLES ─────────────────────────────────────
-- Compter les lignes attendues et les lignes écrites ne prouve rien : une ligne
-- manquante compensée par une ligne en trop laisse les compteurs égaux et
-- l'ensemble faux. La vérification compare donc les ensembles exacts
-- (studentId, courseKey, kind), dans les deux sens, avant toute suppression.

DO $migration$
DECLARE
  unresolved_count   INTEGER;
  unresolved_sample  TEXT;
  missing_expected   INTEGER;
  missing_sample     TEXT;
  unexpected_actual  INTEGER;
  unexpected_sample  TEXT;
  wrong_kind         INTEGER;
BEGIN
  -- ── 1) Aucune valeur historique ne doit rester sans correspondance ────────
  WITH legacy AS (
    SELECT s."gradeLevel"::text AS grade_level, l.subject::text AS subject
    FROM "students" s
    CROSS JOIN LATERAL unnest(s."specialties") AS l(subject)
  )
  SELECT count(*), string_agg(DISTINCT grade_level || '/' || subject, ', ')
    INTO unresolved_count, unresolved_sample
    FROM legacy
   WHERE NOT (
     (grade_level = 'PREMIERE' AND subject = 'FRANCAIS')
     OR
     (grade_level = 'QUATRIEME' AND subject = 'FRANCAIS')
     OR
     (grade_level = 'QUATRIEME' AND subject = 'MATHEMATIQUES')
     OR
     (grade_level = 'SECONDE' AND subject = 'FRANCAIS')
     OR
     (grade_level = 'SECONDE' AND subject = 'MATHEMATIQUES')
     OR
     (grade_level = 'TERMINALE' AND subject = 'HISTOIRE_GEO')
     OR
     (grade_level = 'TERMINALE' AND subject = 'PHILOSOPHIE')
     OR
     (grade_level = 'TROISIEME' AND subject = 'FRANCAIS')
     OR
     (grade_level = 'TROISIEME' AND subject = 'MATHEMATIQUES')
         )
     AND NOT (
     (grade_level = 'PREMIERE' AND subject = 'MATHEMATIQUES')
     OR
     (grade_level = 'PREMIERE' AND subject = 'NSI')
     OR
     (grade_level = 'PREMIERE' AND subject = 'PHYSIQUE_CHIMIE')
     OR
     (grade_level = 'PREMIERE' AND subject = 'SES')
     OR
     (grade_level = 'PREMIERE' AND subject = 'SVT')
     OR
     (grade_level = 'TERMINALE' AND subject = 'MATHEMATIQUES')
     OR
     (grade_level = 'TERMINALE' AND subject = 'MATHS_EXPERTES')
     OR
     (grade_level = 'TERMINALE' AND subject = 'NSI')
     OR
     (grade_level = 'TERMINALE' AND subject = 'PHYSIQUE_CHIMIE')
     OR
     (grade_level = 'TERMINALE' AND subject = 'SES')
     OR
     (grade_level = 'TERMINALE' AND subject = 'SVT')
         );

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION_BLOCKED_UNRESOLVED_LEGACY_SPECIALTIES: % valeur(s) historique(s) sans correspondance (%). Arbitrez-les puis relancez ; rien n''a été modifié.',
      unresolved_count, unresolved_sample;
  END IF;

  -- ── 2) Schéma ────────────────────────────────────────────────────────────
  EXECUTE $ddl$CREATE TYPE "AcademicEnrollmentKind" AS ENUM ('SPECIALTY', 'OPTION')$ddl$;
  EXECUTE $ddl$CREATE TYPE "AcademicEnrollmentSource" AS ENUM ('ADMIN', 'ASSISTANTE', 'SEED', 'BACKFILL_LEGACY_SPECIALTIES')$ddl$;

  EXECUTE $ddl$
    CREATE TABLE "student_academic_enrollments" (
        "id" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "courseKey" TEXT NOT NULL,
        "kind" "AcademicEnrollmentKind" NOT NULL,
        "source" "AcademicEnrollmentSource" NOT NULL,
        "curriculumVersion" TEXT NOT NULL DEFAULT 'v1',
        "verifiedAt" TIMESTAMP(3),
        "verifiedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "student_academic_enrollments_pkey" PRIMARY KEY ("id")
    )
  $ddl$;

  EXECUTE $ddl$CREATE UNIQUE INDEX "student_academic_enrollments_studentId_courseKey_key" ON "student_academic_enrollments"("studentId", "courseKey")$ddl$;
  EXECUTE $ddl$CREATE INDEX "student_academic_enrollments_studentId_kind_idx" ON "student_academic_enrollments"("studentId", "kind")$ddl$;
  EXECUTE $ddl$ALTER TABLE "student_academic_enrollments" ADD CONSTRAINT "student_academic_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE$ddl$;
  EXECUTE $ddl$ALTER TABLE "student_academic_enrollments" ADD CONSTRAINT "student_academic_enrollments_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE$ddl$;

  -- ── 3) Ensemble attendu, dérivé de la source canonique ────────────────────
  -- >>> EXPECTED_BEGIN
  EXECUTE $expected$
    CREATE TEMPORARY TABLE _expected_choices AS
    SELECT s."id" AS "studentId", mapped."courseKey", mapped."kind"
    FROM "students" s
    CROSS JOIN LATERAL unnest(s."specialties") AS legacy(subject)
    CROSS JOIN LATERAL (
        SELECT
        CASE
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'MATHEMATIQUES' THEN 'eds-maths-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'NSI' THEN 'eds-nsi-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'SES' THEN 'eds-ses-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'SVT' THEN 'eds-svt-premiere'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHEMATIQUES' THEN 'eds-maths-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES' THEN 'opt-maths-expertes-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'NSI' THEN 'eds-nsi-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'SES' THEN 'eds-ses-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'SVT' THEN 'eds-svt-terminale'
            ELSE NULL
        END AS "courseKey",
        CASE
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES' THEN 'OPTION'
            ELSE 'SPECIALTY'
        END AS "kind"
    ) AS mapped
    WHERE mapped."courseKey" IS NOT NULL
  $expected$;
  -- <<< EXPECTED_END

  -- ── 4) Reprise déterministe : l'identité dérive de (élève, cours) ─────────
  EXECUTE $insert$
    INSERT INTO "student_academic_enrollments" (
        "id", "studentId", "courseKey", "kind", "source", "curriculumVersion", "createdAt", "updatedAt"
    )
    SELECT
        md5(e."studentId" || '|' || e."courseKey"),
        e."studentId",
        e."courseKey",
        e."kind"::"AcademicEnrollmentKind",
        'BACKFILL_LEGACY_SPECIALTIES'::"AcademicEnrollmentSource",
        'v1',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM _expected_choices e
    ON CONFLICT ("studentId", "courseKey") DO NOTHING
  $insert$;

  -- ── 5) L'ensemble écrit doit être EXACTEMENT l'ensemble attendu ───────────
  -- >>> GUARD_BEGIN
  -- Ce bloc est extrait tel quel par scripts/curriculum/test-migration-guard.sh
  -- et rejoué contre des états falsifiés : le banc adversarial teste donc le
  -- texte réellement livré, pas une reformulation.
  EXECUTE $verify$
    SELECT
      (SELECT count(*) FROM (
         SELECT "studentId","courseKey","kind" FROM _expected_choices
         EXCEPT
         SELECT "studentId","courseKey","kind"::text FROM "student_academic_enrollments"
          WHERE "source" = 'BACKFILL_LEGACY_SPECIALTIES') d),
      (SELECT string_agg(DISTINCT "courseKey" || '/' || "kind", ', ') FROM (
         SELECT "studentId","courseKey","kind" FROM _expected_choices
         EXCEPT
         SELECT "studentId","courseKey","kind"::text FROM "student_academic_enrollments"
          WHERE "source" = 'BACKFILL_LEGACY_SPECIALTIES') d),
      (SELECT count(*) FROM (
         SELECT "studentId","courseKey","kind"::text FROM "student_academic_enrollments"
          WHERE "source" = 'BACKFILL_LEGACY_SPECIALTIES'
         EXCEPT
         SELECT "studentId","courseKey","kind" FROM _expected_choices) d),
      (SELECT string_agg(DISTINCT "courseKey" || '/' || "kind", ', ') FROM (
         SELECT "studentId","courseKey","kind"::text FROM "student_academic_enrollments"
          WHERE "source" = 'BACKFILL_LEGACY_SPECIALTIES'
         EXCEPT
         SELECT "studentId","courseKey","kind" FROM _expected_choices) d),
      (SELECT count(*) FROM _expected_choices e
         JOIN "student_academic_enrollments" a
           ON e."studentId" = a."studentId" AND e."courseKey" = a."courseKey"
        WHERE a."source" = 'BACKFILL_LEGACY_SPECIALTIES' AND e."kind" <> a."kind"::text)
  $verify$
  INTO missing_expected, missing_sample, unexpected_actual, unexpected_sample, wrong_kind;

  IF missing_expected > 0 OR unexpected_actual > 0 THEN
    RAISE EXCEPTION
      'MIGRATION_BLOCKED_BACKFILL_SET_MISMATCH: % ligne(s) attendue(s) absente(s) (%), % ligne(s) écrite(s) inattendue(s) (%), dont % divergence(s) de nature. Rien n''a été modifié.',
      missing_expected, COALESCE(missing_sample, '-'),
      unexpected_actual, COALESCE(unexpected_sample, '-'),
      wrong_kind;
  END IF;
  -- <<< GUARD_END

  EXECUTE $ddl$DROP TABLE _expected_choices$ddl$;

  -- ── 6) Phase EXPAND : la colonne héritée est CONSERVÉE ───────────────────
  --
  -- `students.specialties` n'est PAS supprimée par cette migration.
  --
  -- Motif : la colonne existe en production depuis 20260425094000 et y porte
  -- des données réelles. Le modèle canonique est désormais
  -- `StudentAcademicEnrollment`, alimenté par le backfill ci-dessus, et plus
  -- aucun code canonique ne lit ni n'écrit la colonne. La conserver rend le
  -- rollback vers une release antérieure possible sans perte de données.
  --
  -- Phase EXPAND assumée du motif expand/migrate/contract :
  --   SPECIALTIES_CONTRACT_STATUS=DEFERRED_SAFELY
  --   DATA_LOSS_RISK=0
  --
  -- La suppression fera l'objet d'un lot CONTRACT dédié, qui devra prouver
  -- LEGACY_SPECIALTIES_READERS=0 et LEGACY_SPECIALTIES_WRITERS=0 sur la
  -- lignée réellement déployée, puis sauvegarder la colonne.
  --
  -- Garde : __tests__/architecture/legacy-specialties-contract.test.ts échoue
  -- si un DROP de cette colonne réapparaît dans prisma/migrations.
END
$migration$;
