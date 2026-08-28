#!/usr/bin/env bash
#
# Banc de tests adversariaux de la barrière de migration destructive.
#
# La barrière décide si `students.specialties` peut être supprimée. Une erreur
# à cet endroit détruit des données. Ces cas vérifient qu'elle compare bien des
# ENSEMBLES et pas des compteurs : plusieurs scénarios ci-dessous conservent un
# nombre de lignes correct tout en portant un contenu faux.
#
# Usage :
#   DATABASE_URL=postgresql://…/nexus_disposable_… bash scripts/curriculum/test-migration-guard.sh
#
# La base cible est TRONQUÉE à chaque cas : ne jamais viser autre chose qu'une
# base jetable.

set -uo pipefail

: "${DATABASE_URL:?DATABASE_URL est requis}"
: "${PGCONTAINER:?PGCONTAINER est requis (nom du conteneur postgres jetable)}"

case "$DATABASE_URL" in
  *nexus_disposable_*) ;;
  *) echo "REFUS : la base cible doit être une base jetable (nexus_disposable_*)"; exit 2 ;;
esac

DB="${DATABASE_URL##*/}"; DB="${DB%%\?*}"
MIGRATIONS="prisma/migrations"
CREATE_SQL="$MIGRATIONS/20260828140000_add_student_academic_enrollments/migration.sql"
DROP_SQL="$MIGRATIONS/20260828140100_drop_student_specialties/migration.sql"
WORK="$(mktemp -d)"
PASS=0
FAIL=0

# Le backfill est extrait de la migration elle-même : le banc ne peut pas
# tester une transformation différente de celle qui sera réellement appliquée.
sed -n '/^-- Reprise déterministe/,$p' "$CREATE_SQL" > "$WORK/backfill.sql"

psql_run() { docker exec -i "$PGCONTAINER" psql -U nexus_user -d "$DB" -q -v ON_ERROR_STOP=1 "$@"; }
psql_quiet() { docker exec -i "$PGCONTAINER" psql -U nexus_user -d "$DB" -tAq "$@" 2>/dev/null; }

reset_fixture() {
  psql_run <<'SQL' >/dev/null
TRUNCATE "student_academic_enrollments", "students", "parent_profiles", "users" CASCADE;
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

add_student() { # id, level, specialties-array-literal
  psql_run <<SQL >/dev/null
INSERT INTO users (id,email,"firstName","lastName",role,"createdAt","updatedAt")
VALUES ('user-$1','$1@t.test','X','X','ELEVE',now(),now());
INSERT INTO students (id,"parentId","userId","gradeLevel","academicTrack",specialties,"createdAt","updatedAt")
VALUES ('$1','p1','user-$1','$2','EDS_GENERALE',$3,now(),now());
SQL
}

run_backfill() { psql_run -f - < "$WORK/backfill.sql" >/dev/null; }

# Rejoue la barrière et renvoie 0 si le DROP a été autorisé, 1 s'il a été bloqué.
attempt_drop() {
  docker cp "$DROP_SQL" "$PGCONTAINER:/tmp/guard.sql" >/dev/null 2>&1
  docker exec -i "$PGCONTAINER" psql -U nexus_user -d "$DB" -q -v ON_ERROR_STOP=1 -f /tmp/guard.sql >"$WORK/last.log" 2>&1
}

assert_case() { # label, expectation(BLOCKED|ALLOWED)
  local label="$1" expected="$2" outcome
  if attempt_drop; then outcome="ALLOWED"; else outcome="BLOCKED"; fi
  if [ "$outcome" = "$expected" ]; then
    printf '  ✓ %-58s %s\n' "$label" "$outcome"
    PASS=$((PASS+1))
  else
    printf '  ✗ %-58s attendu=%s obtenu=%s\n' "$label" "$expected" "$outcome"
    grep -oE 'MIGRATION_BLOCKED_[A-Z_]+[^\\]*' "$WORK/last.log" | head -1 | sed 's/^/      /'
    FAIL=$((FAIL+1))
  fi
}

echo "Banc adversarial de la barrière de migration — base $DB"
echo

# ── CAS A : même cardinalité, ensembles différents ──────────────────────────
reset_fixture
add_student sA TERMINALE "ARRAY['MATHEMATIQUES']::\"Subject\"[]"
add_student sB TERMINALE "ARRAY['NSI']::\"Subject\"[]"
add_student sC TERMINALE "ARRAY[]::\"Subject\"[]"
run_backfill
psql_run <<'SQL' >/dev/null
DELETE FROM student_academic_enrollments WHERE "studentId"='sB';
INSERT INTO student_academic_enrollments ("id","studentId","courseKey","kind","source","curriculumVersion","createdAt","updatedAt")
VALUES ('forged-a','sC','eds-physique-chimie-terminale','SPECIALTY','BACKFILL_LEGACY_SPECIALTIES','v1',now(),now());
SQL
assert_case "A · cardinalité identique, ensembles différents" BLOCKED

# ── CAS B : bon élève, mauvais cours ────────────────────────────────────────
reset_fixture
add_student sA TERMINALE "ARRAY['MATHEMATIQUES']::\"Subject\"[]"
run_backfill
psql_run -c "UPDATE student_academic_enrollments SET \"courseKey\"='eds-svt-terminale' WHERE \"studentId\"='sA';" >/dev/null
assert_case "B · bon studentId, mauvais courseKey" BLOCKED

# ── CAS C : bon cours, mauvaise nature ──────────────────────────────────────
reset_fixture
add_student sA TERMINALE "ARRAY['MATHEMATIQUES','MATHS_EXPERTES']::\"Subject\"[]"
run_backfill
psql_run -c "UPDATE student_academic_enrollments SET kind='SPECIALTY' WHERE \"courseKey\"='opt-maths-expertes-terminale';" >/dev/null
assert_case "C · bon courseKey, mauvais kind" BLOCKED

# ── CAS D : reprise exacte ──────────────────────────────────────────────────
reset_fixture
add_student sA TERMINALE "ARRAY['MATHEMATIQUES','NSI','MATHS_EXPERTES']::\"Subject\"[]"
add_student sB PREMIERE  "ARRAY['MATHEMATIQUES','SES']::\"Subject\"[]"
run_backfill
assert_case "D · reprise exacte" ALLOWED

# ── CAS E : ligne de reprise en trop ────────────────────────────────────────
reset_fixture
add_student sA TERMINALE "ARRAY['MATHEMATIQUES']::\"Subject\"[]"
run_backfill
psql_run <<'SQL' >/dev/null
INSERT INTO student_academic_enrollments ("id","studentId","courseKey","kind","source","curriculumVersion","createdAt","updatedAt")
VALUES ('forged-e','sA','eds-nsi-terminale','SPECIALTY','BACKFILL_LEGACY_SPECIALTIES','v1',now(),now());
SQL
assert_case "E · ligne de reprise inattendue" BLOCKED

# ── CAS F : tronc commun hérité uniquement ──────────────────────────────────
reset_fixture
add_student sA TERMINALE "ARRAY['PHILOSOPHIE','HISTOIRE_GEO']::\"Subject\"[]"
run_backfill
ROWS="$(psql_quiet -c 'SELECT count(*) FROM student_academic_enrollments;')"
if [ "$ROWS" = "0" ]; then
  printf '  ✓ %-58s %s\n' "F · tronc commun hérité : aucune ligne persistée" "0 row"
  PASS=$((PASS+1))
else
  printf '  ✗ %-58s attendu=0 obtenu=%s\n' "F · tronc commun hérité : aucune ligne persistée" "$ROWS"
  FAIL=$((FAIL+1))
fi
assert_case "F · tronc commun hérité seul" ALLOWED

# ── CAS G : valeur indécidable ──────────────────────────────────────────────
reset_fixture
add_student sA TERMINALE "ARRAY['MATHEMATIQUES','ANGLAIS']::\"Subject\"[]"
run_backfill
assert_case "G · langue vivante indécidable" BLOCKED

echo
echo "PASS=$PASS FAIL=$FAIL"
rm -rf "$WORK"
[ "$FAIL" -eq 0 ] || exit 1
