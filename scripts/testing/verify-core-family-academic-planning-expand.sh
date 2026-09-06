#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
migration_name=20260906200000_core_family_academic_planning_expand
migration_file="$repository_root/prisma/migrations/$migration_name/migration.sql"
postgres_image=${NEXUS_CORE_TEST_POSTGRES_IMAGE:-pgvector/pgvector:pg15}
container_name="nexus-core-expand-$PPID-$$"
temporary_root=$(mktemp -d /tmp/nexus-core-expand.XXXXXX)

cleanup() {
  docker stop "$container_name" >/dev/null 2>&1 || true
  rm -r "$temporary_root" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cp -a "$repository_root/prisma" "$temporary_root/prisma"
mv "$temporary_root/prisma/migrations/$migration_name" "$temporary_root/omitted-expand-migration"

docker run --rm -d \
  --name "$container_name" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 127.0.0.1::5432 \
  "$postgres_image" >/dev/null

for attempt in $(seq 1 30); do
  if docker exec "$container_name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$container_name" pg_isready -U postgres -d postgres >/dev/null
postgres_port=$(docker inspect -f '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$container_name")

docker exec "$container_name" createdb -U postgres conflict_test
docker exec "$container_name" createdb -U postgres clean_test

apply_pre_expand() {
  local database_name=$1
  DATABASE_URL="postgresql://postgres@127.0.0.1:${postgres_port}/${database_name}" \
    npm --prefix "$repository_root" exec prisma migrate deploy -- \
      --schema "$temporary_root/prisma/schema.prisma" >/dev/null
}

seed_identity_graph() {
  local database_name=$1
  docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d "$database_name" >/dev/null <<'SQL'
INSERT INTO "users" ("id", "role", "createdAt", "updatedAt") VALUES
  ('parent-user', 'PARENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('student-user', 'ELEVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('coach-a-user', 'COACH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('coach-b-user', 'COACH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('staff-user', 'ASSISTANTE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('series-creator-user', 'ASSISTANTE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO "parent_profiles" ("id", "userId") VALUES ('parent-profile', 'parent-user');
INSERT INTO "students" ("id", "parentId", "userId", "gradeLevel", "academicTrack", "createdAt", "updatedAt")
VALUES ('student-profile', 'parent-profile', 'student-user', 'TERMINALE', 'EDS_GENERALE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO "coach_profiles" ("id", "userId", "pseudonym", "subjects", "createdAt", "updatedAt") VALUES
  ('coach-a-profile', 'coach-a-user', 'Expand coach A', '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('coach-b-profile', 'coach-b-user', 'Expand coach B', '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO "coach_student_assignments" (
  "id", "coachId", "studentId", "assignedById", "subjects", "startsAt", "createdAt", "updatedAt"
) VALUES (
  'assignment-a', 'coach-a-profile', 'student-profile', 'staff-user', ARRAY[]::"Subject"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
SQL
}

insert_booking_sql() {
  local booking_id=$1
  local coach_user_id=$2
  local scheduled_date=$3
  local start_time=$4
  local end_time=$5
  local canonical_fields=${6:-}
  local canonical_columns=''
  local canonical_values=''
  if [[ -n $canonical_fields ]]; then
    canonical_columns=', "studentProfileId", "coachProfileId"'
    canonical_values=", 'student-profile', '$canonical_fields'"
  fi
  cat <<SQL
INSERT INTO "SessionBooking" (
  "id", "studentId", "coachId", "subject", "title", "scheduledDate", "startTime", "endTime", "duration",
  "status", "type", "modality", "creditsUsed", "coachAttended", "createdAt", "updatedAt", "reminderSent"$canonical_columns
) VALUES (
  '$booking_id', 'student-user', '$coach_user_id', 'MATHEMATIQUES', 'Expand rehearsal', '$scheduled_date',
  '$start_time', '$end_time', 60, 'CONFIRMED', 'INDIVIDUAL', 'ONLINE', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false$canonical_values
);
SQL
}

apply_pre_expand conflict_test
seed_identity_graph conflict_test
{
  insert_booking_sql conflict-a coach-a-user 2030-09-10 10:00 11:00
  insert_booking_sql conflict-b coach-b-user 2030-09-10 10:30 11:30
} | docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d conflict_test >/dev/null

set +e
docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d conflict_test \
  < "$migration_file" >"$temporary_root/conflict-migration.log" 2>&1
conflict_migration_status=$?
set -e

if [[ $conflict_migration_status -eq 0 ]]; then
  printf '%s\n' 'Expected historical-overlap preflight to reject the migration.' >&2
  exit 1
fi
grep -q 'CORE_STUDENT_BOOKING_OVERLAP_PRECHECK_FAILED conflict_pairs=1 affected_students=1' \
  "$temporary_root/conflict-migration.log"

conflict_preservation=$(docker exec -i "$container_name" psql -At -U postgres -d conflict_test <<'SQL'
SELECT
  (SELECT COUNT(*) FROM "SessionBooking") = 2,
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SessionBooking' AND column_name = 'studentProfileId'
  ),
  NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'planning_series'
  ),
  NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'FamilyRequestType'
  );
SQL
)
if [[ $conflict_preservation != 't|t|t|t' ]]; then
  printf 'Unsafe preflight residue: %s\n' "$conflict_preservation" >&2
  exit 1
fi

apply_pre_expand clean_test
seed_identity_graph clean_test
insert_booking_sql legacy-booking coach-a-user 2030-09-10 09:00 10:00 \
  | docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d clean_test >/dev/null

clean_url="postgresql://postgres@127.0.0.1:${postgres_port}/clean_test"
DATABASE_URL="$clean_url" npm --prefix "$repository_root" exec prisma migrate deploy -- \
  --schema "$repository_root/prisma/schema.prisma" >/dev/null

backfill_result=$(docker exec -i "$container_name" psql -At -U postgres -d clean_test <<'SQL'
SELECT
  "studentProfileId" = 'student-profile',
  "coachProfileId" = 'coach-a-profile',
  "planningSeriesId" IS NULL,
  "assignmentId" IS NULL,
  "academicCourseKey" IS NULL
FROM "SessionBooking" WHERE "id" = 'legacy-booking';
SQL
)
if [[ $backfill_result != 't|t|t|t|t' ]]; then
  printf 'Unexpected deterministic backfill result: %s\n' "$backfill_result" >&2
  exit 1
fi

insert_booking_sql concurrent-a coach-a-user 2030-09-11 11:00 12:00 coach-a-profile \
  > "$temporary_root/concurrent-a.sql"
insert_booking_sql concurrent-b coach-b-user 2030-09-11 11:00 12:00 coach-b-profile \
  > "$temporary_root/concurrent-b.sql"

set +e
docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d clean_test \
  < "$temporary_root/concurrent-a.sql" >"$temporary_root/concurrent-a.log" 2>&1 &
first_pid=$!
docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d clean_test \
  < "$temporary_root/concurrent-b.sql" >"$temporary_root/concurrent-b.log" 2>&1 &
second_pid=$!
wait "$first_pid"
first_status=$?
wait "$second_pid"
second_status=$?
set -e

success_count=0
conflict_count=0
for result in "a:$first_status" "b:$second_status"; do
  label=${result%%:*}
  status=${result##*:}
  if [[ $status -eq 0 ]]; then
    success_count=$((success_count + 1))
  elif grep -q 'SessionBooking_student_profile_no_overlap_excl' "$temporary_root/concurrent-${label}.log"; then
    conflict_count=$((conflict_count + 1))
  fi
done

double_booking_count=$(docker exec -i "$container_name" psql -At -U postgres -d clean_test <<'SQL'
SELECT COUNT(*) FROM "SessionBooking"
WHERE "studentProfileId" = 'student-profile'
  AND "scheduledDate" = '2030-09-11'
  AND "startTime" = '11:00'
  AND "endTime" = '12:00'
  AND "status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS');
SQL
)
if [[ $success_count -ne 1 || $conflict_count -ne 1 || $double_booking_count -ne 1 ]]; then
  printf 'Unexpected concurrency outcome: SUCCESS=%s CONFLICT=%s DOUBLE_BOOKING=%s\n' \
    "$success_count" "$conflict_count" "$double_booking_count" >&2
  sed -n '1,8p' "$temporary_root/concurrent-a.log" >&2
  sed -n '1,8p' "$temporary_root/concurrent-b.log" >&2
  exit 1
fi

# Legacy callers may still write only User foreign keys during the expand phase.
insert_booking_sql legacy-write coach-a-user 2030-09-12 13:00 14:00 \
  | docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d clean_test >/dev/null
legacy_write_result=$(docker exec -i "$container_name" psql -At -U postgres -d clean_test <<'SQL'
SELECT "studentProfileId" IS NULL AND "coachProfileId" IS NULL
FROM "SessionBooking" WHERE "id" = 'legacy-write';
SQL
)
if [[ $legacy_write_result != 't' ]]; then
  printf '%s\n' 'Legacy User-FK-only booking write no longer works.' >&2
  exit 1
fi

docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d clean_test >/dev/null <<'SQL'
INSERT INTO "planning_series" (
  "id", "studentProfileId", "coachProfileId", "assignmentId", "academicCourseKey",
  "startDate", "localStartTime", "localEndTime", "recurrenceRule", "modality", "createdById", "updatedAt"
) VALUES (
  'series-a', 'student-profile', 'coach-a-profile', 'assignment-a', 'eds-maths-terminale',
  '2030-09-13', '15:00', '16:00', 'FREQ=WEEKLY', 'ONLINE', 'series-creator-user', CURRENT_TIMESTAMP
);
INSERT INTO "SessionBooking" (
  "id", "studentId", "coachId", "studentProfileId", "coachProfileId", "assignmentId", "academicCourseKey",
  "planningSeriesId", "occurrenceKey", "subject", "title", "scheduledDate", "startTime", "endTime", "duration",
  "status", "type", "modality", "creditsUsed", "coachAttended", "createdAt", "updatedAt", "reminderSent"
) VALUES (
  'series-booking', 'student-user', 'coach-a-user', 'student-profile', 'coach-a-profile', 'assignment-a', 'eds-maths-terminale',
  'series-a', 'series-a:2030-09-13T15:00', 'MATHEMATIQUES', 'Series rehearsal', '2030-09-13', '15:00', '16:00', 60,
  'CONFIRMED', 'INDIVIDUAL', 'ONLINE', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false
);
INSERT INTO "planning_override_audits" (
  "id", "sessionBookingId", "planningSeriesId", "overrideCode", "overrideReason", "actorId", "previousValues", "nextValues"
) VALUES (
  'override-audit', 'series-booking', 'series-a', 'STAFF_TIME_CHANGE', 'Family-approved schedule change',
  'staff-user', '{}'::jsonb, '{"startTime":"15:00"}'::jsonb
);
SQL

set +e
docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d clean_test \
  -c "DELETE FROM \"users\" WHERE \"id\" = 'series-creator-user'" >"$temporary_root/restrict-user.log" 2>&1
restrict_user_status=$?
set -e
if [[ $restrict_user_status -eq 0 ]] || ! grep -q 'planning_series_createdById_fkey' "$temporary_root/restrict-user.log"; then
  printf '%s\n' 'PlanningSeries.createdById did not enforce RESTRICT.' >&2
  exit 1
fi

docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d clean_test \
  -c "DELETE FROM \"planning_series\" WHERE \"id\" = 'series-a'" >/dev/null
set_null_result=$(docker exec -i "$container_name" psql -At -U postgres -d clean_test <<'SQL'
SELECT
  (SELECT "planningSeriesId" IS NULL FROM "SessionBooking" WHERE "id" = 'series-booking'),
  (SELECT "planningSeriesId" IS NULL FROM "planning_override_audits" WHERE "id" = 'override-audit');
SQL
)
if [[ $set_null_result != 't|t' ]]; then
  printf 'Planning series SET NULL failed: %s\n' "$set_null_result" >&2
  exit 1
fi

set +e
docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d clean_test \
  -c "DELETE FROM \"SessionBooking\" WHERE \"id\" = 'series-booking'" >"$temporary_root/restrict-booking.log" 2>&1
restrict_booking_status=$?
set -e
if [[ $restrict_booking_status -eq 0 ]] || ! grep -q 'planning_override_audits_sessionBookingId_fkey' "$temporary_root/restrict-booking.log"; then
  printf '%s\n' 'PlanningOverrideAudit.sessionBookingId did not enforce RESTRICT.' >&2
  exit 1
fi

printf 'PREFLIGHT_CONFLICT_SAFE=1 CONFLICT_ROWS_PRESERVED=2 SCHEMA_RESIDUE=0\n'
printf 'MIGRATION_CLEAN=1 BACKFILL_PROFILE_IDS=1 PLANNING_GUESSES=0\n'
printf 'SUCCESS=%s CONFLICT=%s DOUBLE_BOOKING=%s\n' "$success_count" "$conflict_count" "$((double_booking_count - 1))"
printf 'LEGACY_USER_FK_WRITE=1 SET_NULL=1 RESTRICT=1\n'
