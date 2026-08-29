#!/usr/bin/env bash
#
# Banc de tests adversariaux de la migration des inscriptions académiques.
#
# Deux familles de cas :
#
#  · Cas atteignables (D, F, G) : la migration RÉELLE est rejouée de bout en
#    bout sur des données héritées choisies.
#
#  · Cas falsifiés (A, B, C, E) : la migration est atomique, donc un ensemble
#    d'inscriptions incorrect ne peut plus survenir naturellement — la barrière
#    est une défense en profondeur. Pour la tester quand même, le banc EXTRAIT
#    le bloc de vérification du SQL livré (marqueurs GUARD_BEGIN/GUARD_END) et
#    le rejoue contre des états falsifiés. Il teste donc le texte réellement
#    déployé, pas une reformulation.
#
# Usage :
#   DATABASE_URL=postgresql://…/nexus_disposable_… PGCONTAINER=… \
#     bash scripts/curriculum/test-migration-guard.sh

set -uo pipefail

: "${DATABASE_URL:?DATABASE_URL est requis}"
: "${PGCONTAINER:?PGCONTAINER est requis (nom du conteneur postgres jetable)}"

case "$DATABASE_URL" in
  *nexus_disposable_*) ;;
  *) echo "REFUS : la base cible doit être une base jetable (nexus_disposable_*)"; exit 2 ;;
esac

DB="${DATABASE_URL##*/}"; DB="${DB%%\?*}"
MIGRATION_SQL="prisma/migrations/20260828140000_academic_enrollment_ssot/migration.sql"
WORK="$(mktemp -d)"
PASS=0
FAIL=0

psql_run()   { docker exec -i "$PGCONTAINER" psql -U nexus_user -d "$DB" -q -v ON_ERROR_STOP=1 "$@"; }
psql_quiet() { docker exec -i "$PGCONTAINER" psql -U nexus_user -d "$DB" -tAq "$@" 2>/dev/null; }

# Bloc de vérification extrait du SQL livré, réemballé dans un DO autonome.
{
  echo 'DO $guard$'
  echo 'DECLARE'
  echo '  missing_expected  INTEGER; missing_sample TEXT;'
  echo '  unexpected_actual INTEGER; unexpected_sample TEXT;'
  echo '  wrong_kind        INTEGER;'
  echo 'BEGIN'
  sed -n '/-- >>> EXPECTED_BEGIN/,/-- <<< EXPECTED_END/p' "$MIGRATION_SQL" | sed '1d;$d'
  sed -n '/-- >>> GUARD_BEGIN/,/-- <<< GUARD_END/p' "$MIGRATION_SQL" | sed '1d;$d'
  echo '  EXECUTE $d$DROP TABLE _expected_choices$d$;'
  echo 'END'
  echo '$guard$;'
} > "$WORK/guard.sql"

# Remet la base dans l'état d'AVANT migration : colonne héritée présente,
# aucune table d'inscriptions, aucun type. Tolère l'absence de ces objets, que
# le cas précédent ait abouti (table créée, colonne supprimée) ou échoué.
reset_schema() {
  psql_run <<'SQL' >/dev/null
DROP TABLE IF EXISTS "student_academic_enrollments";
DROP TYPE  IF EXISTS "AcademicEnrollmentKind";
DROP TYPE  IF EXISTS "AcademicEnrollmentSource";
TRUNCATE "students", "parent_profiles", "users" CASCADE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='students' AND column_name='specialties') THEN
    ALTER TABLE "students" ADD COLUMN "specialties" "Subject"[] NOT NULL DEFAULT ARRAY[]::"Subject"[];
  END IF;
END $$;
INSERT INTO users (id,email,"firstName","lastName",role,"createdAt","updatedAt")
VALUES ('u0','p@t.test','P','P','PARENT',now(),now());
INSERT INTO parent_profiles (id,"userId") VALUES ('p1','u0');
SQL
}

# Recrée le schéma d'inscriptions pour les cas qui falsifient des lignes avant
# de rejouer la seule barrière.
create_enrollment_schema() {
  psql_run <<'SQL' >/dev/null
CREATE TYPE "AcademicEnrollmentKind" AS ENUM ('SPECIALTY','OPTION');
CREATE TYPE "AcademicEnrollmentSource" AS ENUM ('ADMIN','ASSISTANTE','SEED','BACKFILL_LEGACY_SPECIALTIES');
CREATE TABLE "student_academic_enrollments" (
  "id" TEXT PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "courseKey" TEXT NOT NULL,
  "kind" "AcademicEnrollmentKind" NOT NULL,
  "source" "AcademicEnrollmentSource" NOT NULL,
  "curriculumVersion" TEXT NOT NULL DEFAULT 'v1',
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE("studentId","courseKey")
);
SQL
}

add_student() { # id, level, specialties-array-literal
  psql_run <<SQL >/dev/null
INSERT INTO users (id,email,"firstName","lastName",role,"createdAt","updatedAt")
VALUES ('user-$1','$1@t.test','X','X','ELEVE',now(),now());
INSERT INTO students (id,"parentId","userId","gradeLevel","academicTrack",specialties,"createdAt","updatedAt")
VALUES ('$1','p1','user-$1','$2','EDS_GENERALE',$3,now(),now());
SQL
}

# Reconstitue l'état post-reprise sans supprimer la colonne héritée, pour
# pouvoir falsifier les lignes puis rejouer la seule barrière.
seed_backfill_rows() {
  psql_run <<'SQL' >/dev/null
INSERT INTO "student_academic_enrollments"
  ("id","studentId","courseKey","kind","source","curriculumVersion","createdAt","updatedAt")
SELECT md5(e."studentId" || '|' || e."courseKey"), e."studentId", e."courseKey",
       e."kind"::"AcademicEnrollmentKind", 'BACKFILL_LEGACY_SPECIALTIES', 'v1', now(), now()
FROM (
  SELECT s."id" AS "studentId", m."courseKey", m."kind"
  FROM students s
  CROSS JOIN LATERAL unnest(s.specialties) AS legacy(subject)
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN s."gradeLevel"='PREMIERE'  AND legacy.subject='MATHEMATIQUES'   THEN 'eds-maths-premiere'
        WHEN s."gradeLevel"='PREMIERE'  AND legacy.subject='NSI'             THEN 'eds-nsi-premiere'
        WHEN s."gradeLevel"='PREMIERE'  AND legacy.subject='PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-premiere'
        WHEN s."gradeLevel"='PREMIERE'  AND legacy.subject='SVT'             THEN 'eds-svt-premiere'
        WHEN s."gradeLevel"='PREMIERE'  AND legacy.subject='SES'             THEN 'eds-ses-premiere'
        WHEN s."gradeLevel"='TERMINALE' AND legacy.subject='MATHEMATIQUES'   THEN 'eds-maths-terminale'
        WHEN s."gradeLevel"='TERMINALE' AND legacy.subject='NSI'             THEN 'eds-nsi-terminale'
        WHEN s."gradeLevel"='TERMINALE' AND legacy.subject='PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-terminale'
        WHEN s."gradeLevel"='TERMINALE' AND legacy.subject='SVT'             THEN 'eds-svt-terminale'
        WHEN s."gradeLevel"='TERMINALE' AND legacy.subject='SES'             THEN 'eds-ses-terminale'
        WHEN s."gradeLevel"='TERMINALE' AND legacy.subject='MATHS_EXPERTES'  THEN 'opt-maths-expertes-terminale'
        ELSE NULL END AS "courseKey",
      CASE WHEN s."gradeLevel"='TERMINALE' AND legacy.subject='MATHS_EXPERTES' THEN 'OPTION' ELSE 'SPECIALTY' END AS "kind"
  ) m
  WHERE m."courseKey" IS NOT NULL
) e
ON CONFLICT ("studentId","courseKey") DO NOTHING;
SQL
}

run_guard() {
  docker cp "$WORK/guard.sql" "$PGCONTAINER:/tmp/guard.sql" >/dev/null 2>&1
  docker exec -i "$PGCONTAINER" psql -U nexus_user -d "$DB" -q -v ON_ERROR_STOP=1 -f /tmp/guard.sql >"$WORK/last.log" 2>&1
}

run_full_migration() {
  docker cp "$MIGRATION_SQL" "$PGCONTAINER:/tmp/migration.sql" >/dev/null 2>&1
  docker exec -i "$PGCONTAINER" psql -U nexus_user -d "$DB" -q -v ON_ERROR_STOP=1 -f /tmp/migration.sql >"$WORK/last.log" 2>&1
}

assert_outcome() { # label, expectation, runner
  local label="$1" expected="$2" runner="$3" outcome
  if $runner; then outcome="ALLOWED"; else outcome="BLOCKED"; fi
  if [ "$outcome" = "$expected" ]; then
    printf '  ✓ %-56s %s\n' "$label" "$outcome"; PASS=$((PASS+1))
  else
    printf '  ✗ %-56s attendu=%s obtenu=%s\n' "$label" "$expected" "$outcome"
    grep -oE 'MIGRATION_BLOCKED_[A-Z_]+' "$WORK/last.log" | head -1 | sed 's/^/      /'
    FAIL=$((FAIL+1))
  fi
}

echo "Banc adversarial — base $DB"
echo "  barrière extraite du SQL livré : $(wc -l < "$WORK/guard.sql") lignes"
echo

# ── Cas falsifiés : barrière rejouée contre un ensemble corrompu ────────────
reset_schema
add_student sA TERMINALE "ARRAY['MATHEMATIQUES']::\"Subject\"[]"
add_student sB TERMINALE "ARRAY['NSI']::\"Subject\"[]"
add_student sC TERMINALE "ARRAY[]::\"Subject\"[]"
create_enrollment_schema
seed_backfill_rows
psql_run <<'SQL' >/dev/null
DELETE FROM student_academic_enrollments WHERE "studentId"='sB';
INSERT INTO student_academic_enrollments ("id","studentId","courseKey","kind","source","curriculumVersion","createdAt","updatedAt")
VALUES ('forged-a','sC','eds-physique-chimie-terminale','SPECIALTY','BACKFILL_LEGACY_SPECIALTIES','v1',now(),now());
SQL
assert_outcome "A · cardinalité identique, ensembles différents" BLOCKED run_guard

reset_schema
add_student sA TERMINALE "ARRAY['MATHEMATIQUES']::\"Subject\"[]"
create_enrollment_schema
seed_backfill_rows
psql_run -c "UPDATE student_academic_enrollments SET \"courseKey\"='eds-svt-terminale' WHERE \"studentId\"='sA';" >/dev/null
assert_outcome "B · bon studentId, mauvais courseKey" BLOCKED run_guard

reset_schema
add_student sA TERMINALE "ARRAY['MATHEMATIQUES','MATHS_EXPERTES']::\"Subject\"[]"
create_enrollment_schema
seed_backfill_rows
psql_run -c "UPDATE student_academic_enrollments SET kind='SPECIALTY' WHERE \"courseKey\"='opt-maths-expertes-terminale';" >/dev/null
assert_outcome "C · bon courseKey, mauvais kind" BLOCKED run_guard

reset_schema
add_student sA TERMINALE "ARRAY['MATHEMATIQUES']::\"Subject\"[]"
create_enrollment_schema
seed_backfill_rows
psql_run <<'SQL' >/dev/null
INSERT INTO student_academic_enrollments ("id","studentId","courseKey","kind","source","curriculumVersion","createdAt","updatedAt")
VALUES ('forged-e','sA','eds-nsi-terminale','SPECIALTY','BACKFILL_LEGACY_SPECIALTIES','v1',now(),now());
SQL
assert_outcome "E · ligne de reprise inattendue" BLOCKED run_guard

reset_schema
add_student sA TERMINALE "ARRAY['MATHEMATIQUES','NSI','MATHS_EXPERTES']::\"Subject\"[]"
add_student sB PREMIERE  "ARRAY['MATHEMATIQUES','SES']::\"Subject\"[]"
create_enrollment_schema
seed_backfill_rows
assert_outcome "D · reprise exacte (barrière seule)" ALLOWED run_guard

# ── Cas atteignables : migration réelle, de bout en bout ────────────────────
reset_schema
add_student sA TERMINALE "ARRAY['MATHEMATIQUES','NSI','MATHS_EXPERTES']::\"Subject\"[]"
assert_outcome "D2 · migration réelle, reprise exacte" ALLOWED run_full_migration
ROWS="$(psql_quiet -c 'SELECT count(*) FROM student_academic_enrollments;')"
[ "$ROWS" = "3" ] && { printf '  ✓ %-56s %s\n' "D2 · 3 inscriptions écrites" "$ROWS"; PASS=$((PASS+1)); } \
                  || { printf '  ✗ %-56s attendu=3 obtenu=%s\n' "D2 · inscriptions écrites" "$ROWS"; FAIL=$((FAIL+1)); }

reset_schema
add_student sA TERMINALE "ARRAY['PHILOSOPHIE','HISTOIRE_GEO']::\"Subject\"[]"
assert_outcome "F · tronc commun hérité seul" ALLOWED run_full_migration
ROWS="$(psql_quiet -c 'SELECT count(*) FROM student_academic_enrollments;')"
[ "$ROWS" = "0" ] && { printf '  ✓ %-56s %s\n' "F · aucune ligne persistée" "0 row"; PASS=$((PASS+1)); } \
                  || { printf '  ✗ %-56s attendu=0 obtenu=%s\n' "F · aucune ligne persistée" "$ROWS"; FAIL=$((FAIL+1)); }

reset_schema
add_student sA TERMINALE "ARRAY['MATHEMATIQUES','ANGLAIS']::\"Subject\"[]"
assert_outcome "G · langue vivante indécidable" BLOCKED run_full_migration
COL="$(psql_quiet -c "SELECT count(*) FROM information_schema.columns WHERE table_name='students' AND column_name='specialties';")"
TBL="$(psql_quiet -c "SELECT count(*) FROM information_schema.tables WHERE table_name='student_academic_enrollments';")"
[ "$COL" = "1" ] && [ "$TBL" = "0" ] \
  && { printf '  ✓ %-56s %s\n' "G · aucun schéma partiel après échec" "colonne=1 table=0"; PASS=$((PASS+1)); } \
  || { printf '  ✗ %-56s colonne=%s table=%s\n' "G · aucun schéma partiel après échec" "$COL" "$TBL"; FAIL=$((FAIL+1)); }

echo
echo "PASS=$PASS FAIL=$FAIL"
rm -rf "$WORK"
[ "$FAIL" -eq 0 ] || exit 1
