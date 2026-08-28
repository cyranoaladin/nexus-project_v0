-- SSoT des enseignements choisis — étape 2/2 : suppression de
-- `students.specialties`.
--
-- ── Barrière fail-closed ─────────────────────────────────────────────────────
-- Cette migration est DESTRUCTIVE. Elle ne doit jamais pouvoir effacer une
-- donnée qu'aucun modèle ne porte encore, y compris lors d'un
-- `prisma migrate deploy` automatique où personne n'aura lancé le script de
-- pré-vol. La vérification vit donc ICI, dans la migration elle-même.
--
-- ── Pourquoi une comparaison d'ENSEMBLES, et pas de compteurs ────────────────
-- Compter les lignes attendues et les lignes reprises ne prouve rien : une
-- ligne attendue manquante compensée par une ligne inattendue laisse les deux
-- compteurs égaux. La barrière compare donc les ENSEMBLES exacts
-- (studentId, courseKey, kind), dans les deux sens.
--
-- ── Ce qui est couvert ───────────────────────────────────────────────────────
-- Une valeur historique est couverte si :
--   (a) elle a produit une inscription — c'était un choix : spécialité ou option ;
--   (b) OU elle décrit un enseignement de tronc commun de ce niveau, que le
--       resolver reproduit par dérivation depuis le catalogue. Rien n'est perdu :
--       cette information était redondante avec le niveau et la voie.
--
-- Tout le reste bloque. En pratique : une langue vivante enregistrée comme
-- « spécialité », qui ne permet pas de trancher entre LVA et LVB.

DO $$
DECLARE
  unresolved_count    INTEGER;
  unresolved_sample   TEXT;
  missing_expected    INTEGER;
  unexpected_actual   INTEGER;
  wrong_kind          INTEGER;
  missing_sample      TEXT;
  unexpected_sample   TEXT;
BEGIN
  -- 1) Toute valeur historique doit être couverte, par reprise ou par dérivation.
  WITH legacy AS (
    SELECT s."gradeLevel"::text AS grade_level, l.subject::text AS subject
    FROM "students" s
    CROSS JOIN LATERAL unnest(s."specialties") AS l(subject)
  )
  SELECT count(*),
         string_agg(DISTINCT grade_level || '/' || subject, ', ')
    INTO unresolved_count, unresolved_sample
    FROM legacy
   WHERE NOT (
           -- Tronc commun redondant : reproduit par dérivation.
           (grade_level IN ('QUATRIEME', 'TROISIEME', 'SECONDE')
              AND subject IN ('MATHEMATIQUES', 'FRANCAIS'))
           OR (grade_level = 'PREMIERE'  AND subject = 'FRANCAIS')
           OR (grade_level = 'TERMINALE' AND subject IN ('PHILOSOPHIE', 'HISTOIRE_GEO'))
         )
     AND NOT (
           -- Choix repris à l'étape précédente.
           (grade_level IN ('PREMIERE', 'TERMINALE')
              AND subject IN ('MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT', 'SES'))
           OR (grade_level = 'TERMINALE' AND subject = 'MATHS_EXPERTES')
         );

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION_BLOCKED_UNRESOLVED_LEGACY_SPECIALTIES: % valeur(s) historique(s) sans correspondance (%). Arbitrez-les puis relancez ; aucune colonne n''a été supprimée.',
      unresolved_count, unresolved_sample;
  END IF;

  -- 2) L'ensemble repris doit être EXACTEMENT l'ensemble attendu.
  --    `expected_choices` applique la même transformation que le backfill.
  CREATE TEMPORARY TABLE _migration_guard_expected AS
  SELECT s."id" AS "studentId", mapped."courseKey", mapped."kind"::text AS "kind"
  FROM "students" s
  CROSS JOIN LATERAL unnest(s."specialties") AS legacy(subject)
  CROSS JOIN LATERAL (
      SELECT
          CASE
              WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'MATHEMATIQUES'   THEN 'eds-maths-premiere'
              WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'NSI'             THEN 'eds-nsi-premiere'
              WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-premiere'
              WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'SVT'             THEN 'eds-svt-premiere'
              WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'SES'             THEN 'eds-ses-premiere'
              WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHEMATIQUES'   THEN 'eds-maths-terminale'
              WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'NSI'             THEN 'eds-nsi-terminale'
              WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-terminale'
              WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'SVT'             THEN 'eds-svt-terminale'
              WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'SES'             THEN 'eds-ses-terminale'
              WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES'  THEN 'opt-maths-expertes-terminale'
              ELSE NULL
          END AS "courseKey",
          CASE
              WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES'
                  THEN 'OPTION'
              ELSE 'SPECIALTY'
          END AS "kind"
  ) AS mapped
  WHERE mapped."courseKey" IS NOT NULL;

  -- Seules les lignes issues de la reprise sont comparées : une inscription
  -- saisie entre-temps par un ADMIN est légitime et ne doit pas bloquer.
  CREATE TEMPORARY TABLE _migration_guard_actual AS
  SELECT "studentId", "courseKey", "kind"::text AS "kind"
  FROM "student_academic_enrollments"
  WHERE "source" = 'BACKFILL_LEGACY_SPECIALTIES';

  SELECT count(*), string_agg(DISTINCT "courseKey" || '/' || "kind", ', ')
    INTO missing_expected, missing_sample
    FROM (
      SELECT "studentId", "courseKey", "kind" FROM _migration_guard_expected
      EXCEPT
      SELECT "studentId", "courseKey", "kind" FROM _migration_guard_actual
    ) AS diff;

  SELECT count(*), string_agg(DISTINCT "courseKey" || '/' || "kind", ', ')
    INTO unexpected_actual, unexpected_sample
    FROM (
      SELECT "studentId", "courseKey", "kind" FROM _migration_guard_actual
      EXCEPT
      SELECT "studentId", "courseKey", "kind" FROM _migration_guard_expected
    ) AS diff;

  SELECT count(*)
    INTO wrong_kind
    FROM _migration_guard_expected e
    JOIN _migration_guard_actual a
      ON e."studentId" = a."studentId" AND e."courseKey" = a."courseKey"
   WHERE e."kind" <> a."kind";

  DROP TABLE _migration_guard_expected;
  DROP TABLE _migration_guard_actual;

  IF missing_expected > 0 OR unexpected_actual > 0 THEN
    RAISE EXCEPTION
      'MIGRATION_BLOCKED_BACKFILL_SET_MISMATCH: % ligne(s) attendue(s) absente(s) (%), % ligne(s) reprise(s) inattendue(s) (%), dont % divergence(s) de nature. Aucune colonne n''a été supprimée.',
      missing_expected, COALESCE(missing_sample, '-'),
      unexpected_actual, COALESCE(unexpected_sample, '-'),
      wrong_kind;
  END IF;

  -- DropColumn — exécuté DANS le bloc de vérification.
  -- Le placer à l'extérieur laisserait la suppression survivre à l'échec de la
  -- barrière dès que la migration est rejouée hors transaction (psql sans
  -- ON_ERROR_STOP, outil tiers…). Ici, la garantie « anomalie ⇒ aucun DROP »
  -- ne dépend d'aucune propriété de l'appelant.
  EXECUTE 'ALTER TABLE "students" DROP COLUMN "specialties"';
END $$;
