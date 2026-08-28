-- SSoT des enseignements choisis — étape 2/2 : suppression de
-- `students.specialties`.
--
-- ── Barrière fail-closed ─────────────────────────────────────────────────────
-- Cette migration est DESTRUCTIVE. Elle ne doit jamais pouvoir effacer une
-- donnée qu'aucun modèle ne porte encore, y compris lors d'un
-- `prisma migrate deploy` automatique où personne n'aura lancé le script de
-- pré-vol. La vérification vit donc ICI, dans la migration elle-même.
--
-- Une valeur historique est considérée comme couverte si :
--   (a) elle a produit une inscription — c'était un choix : spécialité ou option ;
--   (b) OU elle décrit un enseignement de tronc commun de ce niveau, que le
--       resolver reproduit par dérivation depuis le catalogue. Rien n'est perdu :
--       cette information était redondante avec le niveau et la voie.
--
-- Tout le reste bloque. En pratique : une langue vivante enregistrée comme
-- « spécialité », qui ne permet pas de trancher entre LVA et LVB.

DO $$
DECLARE
  unresolved_count  INTEGER;
  unresolved_sample TEXT;
  migrated_count    INTEGER;
  expected_count    INTEGER;
BEGIN
  -- 1) Toute valeur historique doit être couverte, par reprise ou par dérivation.
  WITH legacy AS (
    SELECT s."id" AS student_id, s."gradeLevel"::text AS grade_level, l.subject::text AS subject
    FROM "students" s
    CROSS JOIN LATERAL unnest(s."specialties") AS l(subject)
  ),
  classified AS (
    SELECT
      legacy.*,
      EXISTS (
        SELECT 1 FROM "student_academic_enrollments" e
        WHERE e."studentId" = legacy.student_id
          AND e."source" = 'BACKFILL_LEGACY_SPECIALTIES'
      ) AS student_has_backfill,
      (
        -- Tronc commun redondant : l'information est reproduite par dérivation.
        (legacy.grade_level IN ('QUATRIEME', 'TROISIEME', 'SECONDE')
           AND legacy.subject IN ('MATHEMATIQUES', 'FRANCAIS'))
        OR (legacy.grade_level = 'PREMIERE'  AND legacy.subject = 'FRANCAIS')
        OR (legacy.grade_level = 'TERMINALE' AND legacy.subject IN ('PHILOSOPHIE', 'HISTOIRE_GEO'))
      ) AS is_redundant_core,
      (
        -- Choix repris à l'étape précédente.
        (legacy.grade_level IN ('PREMIERE', 'TERMINALE')
           AND legacy.subject IN ('MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT', 'SES'))
        OR (legacy.grade_level = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES')
      ) AS is_migrated_choice
    FROM legacy
  )
  SELECT count(*),
         string_agg(DISTINCT grade_level || '/' || subject, ', ')
    INTO unresolved_count, unresolved_sample
    FROM classified
   WHERE NOT is_redundant_core
     AND NOT is_migrated_choice;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION_BLOCKED_UNRESOLVED_LEGACY_SPECIALTIES: % valeur(s) historique(s) sans correspondance (%). Arbitrez-les puis relancez ; aucune colonne n''a été supprimée.',
      unresolved_count, unresolved_sample;
  END IF;

  -- 2) Chaque choix repris doit avoir sa ligne : la reprise doit être complète.
  SELECT count(*) INTO expected_count
    FROM "students" s
    CROSS JOIN LATERAL unnest(s."specialties") AS l(subject)
   WHERE (s."gradeLevel" IN ('PREMIERE', 'TERMINALE')
            AND l.subject::text IN ('MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT', 'SES'))
      OR (s."gradeLevel" = 'TERMINALE' AND l.subject::text = 'MATHS_EXPERTES');

  SELECT count(*) INTO migrated_count
    FROM "student_academic_enrollments"
   WHERE "source" = 'BACKFILL_LEGACY_SPECIALTIES';

  IF migrated_count < expected_count THEN
    RAISE EXCEPTION
      'MIGRATION_BLOCKED_INCOMPLETE_BACKFILL: % choix historiques attendus, % repris. Aucune colonne n''a été supprimée.',
      expected_count, migrated_count;
  END IF;

  -- DropColumn — exécuté DANS le bloc de vérification.
  -- Le placer à l'extérieur laisserait la suppression survivre à l'échec de la
  -- barrière dès que la migration est rejouée hors transaction (psql sans
  -- ON_ERROR_STOP, outil tiers…). Ici, la garantie « anomalie ⇒ aucun DROP »
  -- ne dépend d'aucune propriété de l'appelant.
  EXECUTE 'ALTER TABLE "students" DROP COLUMN "specialties"';
END $$;
