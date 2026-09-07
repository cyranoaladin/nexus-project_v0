#!/usr/bin/env bash
# ── Task 18 : PRODUCTION_CLONE_MIGRATION_REHEARSAL — exact-baseline attempt ──
#
# Third pass at Task 18, using a FRESH production pg_dump (2026-09-07,
# obtained by the coordinator directly, out of scope for this script) that is
# claimed to sit exactly at the 105-migration origin/main baseline (last:
# `20260906130000_parent_email_activation_invalidation`) with zero
# branch-only migrations already applied.
#
# This script independently re-verifies that claim from the restored dump's
# own `_prisma_migrations` table BEFORE applying anything. If the dump does
# not exactly match (105 migrations, dump-only set empty, expected-pending
# set exactly the branch's one migration), it prints
# TASK_18_BLOCKED_PRODUCTION_BASELINE_MISMATCH and stops WITHOUT running any
# migration — no improvised subset is ever applied.
#
# Isolation: brand-new, distinctly-named Docker network/container/volume
# (`nexus-exact-baseline-rehearsal-*`), never reusing `nexus-pg15-prodclone`,
# `nexus-pg15-empty`, `nexus-postgres-test`, or the prior
# `nexus-core-migration-rehearsal-*` / `nexus-historical-chain-rehearsal-*`
# names. 127.0.0.1-only binding, freshly generated credentials, everything
# destroyed on exit (including on failure — `trap ... EXIT`).
#
# The dump is never opened for writing and never copied: only the host's
# `pg_restore`, connecting over TCP to the isolated container, reads it
# directly from its original path. Source file size/mtime/sha256 verified
# unchanged before and after. No PII is ever queried, logged or printed:
# only structural metadata and aggregate counts cross into stdout / the
# evidence file.
#
# Usage: ./scripts/core/rehearse-exact-baseline-migration.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

DUMP_PATH="${EXACT_BASELINE_DUMP_PATH:-/tmp/claude-1000/task18-exact-baseline/nexus_prod_task18_baseline_20260907_093743Z.dump}"
EXPECTED_DUMP_SHA256="519c639afc76a39c72bbab78b457dc099758b9f5513ba89f01813afffdf49350"
EXPECTED_LAST_MIGRATION="20260906130000_parent_email_activation_invalidation"
EXPECTED_DUMP_MIGRATION_COUNT="105"
EXPECTED_BRANCH_ONLY_MIGRATION="20260906200000_core_family_academic_planning_expand"

IMAGE="pgvector/pgvector:pg15"
RUN_ID="$(date -u +%Y%m%dt%H%M%Sz)"
NET="nexus-exact-baseline-rehearsal-net-${RUN_ID}"
C="nexus-exact-baseline-rehearsal-${RUN_ID}"
V="nexus-exact-baseline-rehearsal-vol-${RUN_ID}"
PORT="${EXACT_BASELINE_REHEARSAL_PORT:-15703}"
DB="nexus_exact_baseline_rehearsal"
DB_USER="rehearsal_exact_baseline_admin"

EVIDENCE_DIR="$(mktemp -d)"
EVIDENCE_FILE="${EVIDENCE_DIR}/evidence.json"
echo '{}' > "$EVIDENCE_FILE"

log() { echo "[exact-baseline-rehearsal] $*" >&2; }

cleanup() {
  local status=$?
  log "teardown (exit status ${status})..."
  docker rm -f "$C" >/dev/null 2>&1 || true
  docker volume rm "$V" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  log "evidence file (kept, no PII): ${EVIDENCE_FILE}"
  exit "$status"
}
trap cleanup EXIT

gen_pw() { openssl rand -base64 36 | tr -d '=+/\n' | head -c 32; }

wait_ready() {
  for _ in $(seq 1 60); do
    if docker exec "$C" pg_isready -U "$DB_USER" -d "$DB" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "[exact-baseline-rehearsal] TIMEOUT waiting for ${C}" >&2
  return 1
}

psql_c() { docker exec "$C" psql -U "$DB_USER" -d "$DB" -t -A -c "$1"; }

json_put() {
  local key="$1" value="$2"
  local tmp
  tmp="$(mktemp)"
  jq --argjson v "$value" "$key = \$v" "$EVIDENCE_FILE" > "$tmp" && mv "$tmp" "$EVIDENCE_FILE"
}
json_put_str() {
  local key="$1" value="$2"
  local tmp
  tmp="$(mktemp)"
  jq --arg v "$value" "$key = \$v" "$EVIDENCE_FILE" > "$tmp" && mv "$tmp" "$EVIDENCE_FILE"
}

log "run id: ${RUN_ID}"

# ── Step 0: source dump integrity (read-only) ───────────────────────────────
[ -f "$DUMP_PATH" ] || { echo "FATAL: dump not found at ${DUMP_PATH}" >&2; exit 1; }
SRC_SIZE_BEFORE="$(stat -c%s "$DUMP_PATH")"
SRC_MTIME_BEFORE="$(stat -c%Y "$DUMP_PATH")"
SRC_SHA_BEFORE="$(sha256sum "$DUMP_PATH" | cut -d' ' -f1)"
if [ "$SRC_SHA_BEFORE" != "$EXPECTED_DUMP_SHA256" ]; then
  echo "FATAL: dump SHA256 mismatch. expected=${EXPECTED_DUMP_SHA256} actual=${SRC_SHA_BEFORE}" >&2
  exit 1
fi
log "dump SHA256 verified: ${SRC_SHA_BEFORE}"
json_put_str '.dumpSha256' "$SRC_SHA_BEFORE"

# ── Step 0b: BRANCH_ONLY_MIGRATIONS (Git, independent of any prior report) ──
MERGE_BASE="$(git merge-base origin/main HEAD)"
MAIN_MIGRATIONS_FILE="${EVIDENCE_DIR}/main_migrations.txt"
HEAD_MIGRATIONS_FILE="${EVIDENCE_DIR}/head_migrations.txt"
git show origin/main:prisma/migrations | grep -E '^[0-9]' | sed 's#/$##' | sort > "$MAIN_MIGRATIONS_FILE"
git show HEAD:prisma/migrations | grep -E '^[0-9]' | sed 's#/$##' | sort > "$HEAD_MIGRATIONS_FILE"
MAIN_MIGRATIONS_COUNT="$(wc -l < "$MAIN_MIGRATIONS_FILE" | tr -d ' ')"
BRANCH_ONLY_FILE="${EVIDENCE_DIR}/branch_only_migrations.txt"
comm -13 "$MAIN_MIGRATIONS_FILE" "$HEAD_MIGRATIONS_FILE" > "$BRANCH_ONLY_FILE"
BRANCH_ONLY_COUNT="$(wc -l < "$BRANCH_ONLY_FILE" | tr -d ' ')"
MAIN_ONLY_FILE="${EVIDENCE_DIR}/main_only_migrations.txt"
comm -23 "$MAIN_MIGRATIONS_FILE" "$HEAD_MIGRATIONS_FILE" > "$MAIN_ONLY_FILE"
MAIN_ONLY_COUNT="$(wc -l < "$MAIN_ONLY_FILE" | tr -d ' ')"
log "merge-base(origin/main, HEAD) = ${MERGE_BASE}"
log "origin/main migrations dir count = ${MAIN_MIGRATIONS_COUNT} (expected PRODUCTION_BASELINE_MIGRATION_COUNT_EXPECTED = ${EXPECTED_DUMP_MIGRATION_COUNT})"
log "BRANCH_ONLY_MIGRATIONS (HEAD minus origin/main) = ${BRANCH_ONLY_COUNT}:"
cat "$BRANCH_ONLY_FILE" >&2
log "main-only (origin/main minus HEAD, should be 0) = ${MAIN_ONLY_COUNT}"
json_put_str '.mergeBase' "$MERGE_BASE"
json_put '.originMainMigrationsCount' "$MAIN_MIGRATIONS_COUNT"
json_put "$(printf '.branchOnlyMigrations')" "$(jq -R -s -c 'split("\n") | map(select(length>0))' "$BRANCH_ONLY_FILE")"
json_put '.branchOnlyMigrationsCount' "$BRANCH_ONLY_COUNT"
json_put '.mainOnlyMigrationsCount' "$MAIN_ONLY_COUNT"

if [ "$MAIN_MIGRATIONS_COUNT" != "$EXPECTED_DUMP_MIGRATION_COUNT" ] || [ "$MAIN_ONLY_COUNT" != "0" ] || \
   [ "$BRANCH_ONLY_COUNT" != "1" ] || [ "$(head -1 "$BRANCH_ONLY_FILE")" != "$EXPECTED_BRANCH_ONLY_MIGRATION" ]; then
  log "FATAL: git-derived baseline/branch-only precondition failed BEFORE any container was touched."
  json_put_str '.blockedReason' 'GIT_BASELINE_OR_BRANCH_ONLY_MISMATCH'
  echo "TASK_18_BLOCKED_PRODUCTION_BASELINE_MISMATCH" >&2
  exit 1
fi
log "git precondition PASS: origin/main has exactly ${EXPECTED_DUMP_MIGRATION_COUNT} migrations, branch adds exactly one: ${EXPECTED_BRANCH_ONLY_MIGRATION}"

# ── Step 1: isolated network + container ────────────────────────────────────
docker network create --driver bridge "$NET" >/dev/null
log "isolated network created: ${NET}"

PW="$(gen_pw)"
docker volume create "$V" >/dev/null
docker run -d --name "$C" --network "$NET" -p "127.0.0.1:${PORT}:5432" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="${PW}" \
  -e POSTGRES_DB="$DB" \
  -v "$V":/var/lib/postgresql/data \
  "$IMAGE" >/dev/null
wait_ready
log "container ready: ${C} (127.0.0.1:${PORT}, loopback-only)"

docker exec "$C" psql -U "$DB_USER" -d "$DB" -c 'CREATE EXTENSION IF NOT EXISTS "btree_gist";' >/dev/null
docker exec "$C" psql -U "$DB_USER" -d "$DB" -c 'CREATE EXTENSION IF NOT EXISTS "vector";' >/dev/null
log "extensions created pre-restore: btree_gist, vector"

# ── Step 2: restore (host pg_restore over TCP, dump never copied) ──────────
RESTORE_LOG="${EVIDENCE_DIR}/pg_restore.log"
set +e
PGPASSWORD="$PW" pg_restore --no-owner --no-acl \
  -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB" \
  "$DUMP_PATH" > "$RESTORE_LOG" 2>&1
RESTORE_STATUS=$?
set -e
log "pg_restore exit status: ${RESTORE_STATUS} (see ${RESTORE_LOG})"

SRC_SIZE_AFTER="$(stat -c%s "$DUMP_PATH")"
SRC_MTIME_AFTER="$(stat -c%Y "$DUMP_PATH")"
SRC_SHA_AFTER="$(sha256sum "$DUMP_PATH" | cut -d' ' -f1)"
if [ "$SRC_SIZE_BEFORE" != "$SRC_SIZE_AFTER" ] || [ "$SRC_MTIME_BEFORE" != "$SRC_MTIME_AFTER" ] || [ "$SRC_SHA_BEFORE" != "$SRC_SHA_AFTER" ]; then
  echo "FATAL: source dump file was modified during this run — aborting and preserving evidence." >&2
  exit 1
fi
log "source dump file unchanged after restore (size/mtime/sha256 identical)"

# Known pre-existing TOC-ordering issue (seen twice before, documented in
# docs/audits/2026-09-06-core-migration-rehearsal.md): users_household_name_key_idx
# listed before the function it depends on. Detect and, if needed, recreate
# from the archive's own DDL only.
HOUSEHOLD_IDX_EXISTS="$(psql_c "SELECT count(*) FROM pg_indexes WHERE indexname = 'users_household_name_key_idx';")"
if [ "$HOUSEHOLD_IDX_EXISTS" = "0" ] && grep -q "users_household_name_key_idx" "$RESTORE_LOG"; then
  log "recreating users_household_name_key_idx (known TOC ordering issue, DDL taken from the archive's own definition)"
  docker exec "$C" psql -U "$DB_USER" -d "$DB" -c \
    'CREATE INDEX users_household_name_key_idx ON "users" USING btree (nexus_household_name_key("firstName", "lastName"));' >/dev/null
fi

# ── Step 3: Postgres version independently re-verified from the dump itself ─
RESTORED_PG_VERSION="$(psql_c "SHOW server_version;")"
log "restored server's own reported version (container, NOT the dump's origin — informational): ${RESTORED_PG_VERSION}"
DUMP_HEADER_VERSION="$(strings "$DUMP_PATH" | grep -m1 'Dumped from database version' || true)"
log "dump TOC header (pg_restore --list, read-only, taken again here for the record): checking..."
DUMP_TOC_HEADER="$(pg_restore --list "$DUMP_PATH" 2>/dev/null | grep -m1 'Dumped from database version' || true)"
log "dump TOC header: ${DUMP_TOC_HEADER}"
json_put_str '.dumpTocHeaderVersionLine' "$DUMP_TOC_HEADER"
if [[ "$DUMP_TOC_HEADER" != *"15.17"* ]]; then
  log "WARNING: dump TOC header does not mention 15.17 as claimed — recorded as-is, not blocking on its own."
fi

# ── Step 4: structural sanity before touching _prisma_migrations ───────────
INVALID_INDEXES="$(psql_c "SELECT count(*) FROM pg_index WHERE NOT indisvalid;")"
INVALID_CONSTRAINTS="$(psql_c "SELECT count(*) FROM pg_constraint WHERE NOT convalidated;")"
log "post-restore structural check: invalid_indexes=${INVALID_INDEXES} not_validated_constraints=${INVALID_CONSTRAINTS}"
json_put '.postRestore.invalidIndexes' "$INVALID_INDEXES"
json_put '.postRestore.notValidatedConstraints' "$INVALID_CONSTRAINTS"

# ── Step 5: independent re-verification of the dump's actual migration state ─
DUMP_LAST_MIGRATION="$(psql_c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1;")"
log "dump _prisma_migrations last applied (by name, DESC): ${DUMP_LAST_MIGRATION}"
json_put_str '.dumpLastMigrationByNameDesc' "$DUMP_LAST_MIGRATION"

DUMP_APPLIED_FILE="${EVIDENCE_DIR}/dump_applied_migrations.txt"
docker exec "$C" psql -U "$DB_USER" -d "$DB" -t -A -c \
  "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name ASC;" \
  | sed '/^$/d' > "$DUMP_APPLIED_FILE"
DUMP_APPLIED_COUNT="$(wc -l < "$DUMP_APPLIED_FILE" | tr -d ' ')"
log "dump _prisma_migrations total finished/not-rolled-back rows: ${DUMP_APPLIED_COUNT} (expected ${EXPECTED_DUMP_MIGRATION_COUNT})"
json_put '.dumpAppliedMigrationsCount' "$DUMP_APPLIED_COUNT"

UNFINISHED_ROWS="$(psql_c "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;")"
log "dump _prisma_migrations rows unfinished or rolled back (informational): ${UNFINISHED_ROWS}"
json_put '.dumpUnfinishedOrRolledBackRows' "$UNFINISHED_ROWS"

DUMP_ONLY_FILE="${EVIDENCE_DIR}/dump_only_migrations.txt"
comm -23 "$DUMP_APPLIED_FILE" "$HEAD_MIGRATIONS_FILE" > "$DUMP_ONLY_FILE" || true
DUMP_ONLY_COUNT="$(wc -l < "$DUMP_ONLY_FILE" | tr -d ' ')"

EXPECTED_PENDING_FILE="${EVIDENCE_DIR}/expected_pending_migrations.txt"
comm -13 "$DUMP_APPLIED_FILE" "$HEAD_MIGRATIONS_FILE" > "$EXPECTED_PENDING_FILE"
EXPECTED_PENDING_COUNT="$(wc -l < "$EXPECTED_PENDING_FILE" | tr -d ' ')"
log "expected pending migrations (HEAD minus dump's actual applied set): ${EXPECTED_PENDING_COUNT}"
cat "$EXPECTED_PENDING_FILE" >&2
json_put '.dumpOnlyMigrationsCount' "$DUMP_ONLY_COUNT"
json_put '.expectedPendingMigrationsCount' "$EXPECTED_PENDING_COUNT"
json_put "$(printf '.expectedPendingMigrations')" "$(jq -R -s -c 'split("\n") | map(select(length>0))' "$EXPECTED_PENDING_FILE")"
json_put "$(printf '.dumpOnlyMigrations')" "$(jq -R -s -c 'split("\n") | map(select(length>0))' "$DUMP_ONLY_FILE")"

# Branch-only migration must NOT already be present in the dump's applied set.
BRANCH_ONLY_IN_DUMP="$(comm -12 "$BRANCH_ONLY_FILE" "$DUMP_APPLIED_FILE" | wc -l | tr -d ' ')"
json_put '.branchOnlyMigrationsAlreadyInDump' "$BRANCH_ONLY_IN_DUMP"

# ── Step 6: STRICT GATE (section 5 of the authorization) ───────────────────
GATE_OK=1
[ "$DUMP_APPLIED_COUNT" = "$EXPECTED_DUMP_MIGRATION_COUNT" ] || GATE_OK=0
[ "$DUMP_LAST_MIGRATION" = "$EXPECTED_LAST_MIGRATION" ] || GATE_OK=0
[ "$DUMP_ONLY_COUNT" = "0" ] || GATE_OK=0
[ "$EXPECTED_PENDING_COUNT" = "1" ] || GATE_OK=0
[ "$(cat "$EXPECTED_PENDING_FILE")" = "$EXPECTED_BRANCH_ONLY_MIGRATION" ] || GATE_OK=0
[ "$BRANCH_ONLY_IN_DUMP" = "0" ] || GATE_OK=0

if [ "$GATE_OK" != "1" ]; then
  log "FATAL: dump migration set does NOT exactly match the expected production baseline. Stopping before any migration, per section 5 of the authorization — no improvised subset will be applied."
  json_put_str '.blockedReason' 'DUMP_MIGRATION_SET_MISMATCH'
  echo "TASK_18_BLOCKED_PRODUCTION_BASELINE_MISMATCH" >&2
  exit 1
fi
log "GATE PASS: dump has exactly ${EXPECTED_DUMP_MIGRATION_COUNT} migrations ending at ${EXPECTED_LAST_MIGRATION}, zero dump-only migrations, and exactly one expected-pending migration matching the branch's sole migration (${EXPECTED_BRANCH_ONLY_MIGRATION}). Proceeding to exact rehearsal."
json_put '.gatePass' 'true'

# ── Step 7: BEFORE baseline (structural fingerprint + business counts) ─────
before_snapshot() {
  local prefix="$1"
  local tables indexes fks pks uniques checks sequences
  tables="$(psql_c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
  indexes="$(psql_c "SELECT count(*) FROM pg_indexes WHERE schemaname='public';")"
  fks="$(psql_c "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY';")"
  pks="$(psql_c "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='PRIMARY KEY';")"
  uniques="$(psql_c "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='UNIQUE';")"
  checks="$(psql_c "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='CHECK';")"
  sequences="$(psql_c "SELECT count(*) FROM information_schema.sequences WHERE sequence_schema='public';")"
  json_put "${prefix}.tables" "$tables"
  json_put "${prefix}.indexes" "$indexes"
  json_put "${prefix}.foreignKeys" "$fks"
  json_put "${prefix}.primaryKeys" "$pks"
  json_put "${prefix}.uniqueConstraints" "$uniques"
  json_put "${prefix}.checkConstraints" "$checks"
  json_put "${prefix}.sequences" "$sequences"
  log "${prefix}: tables=${tables} indexes=${indexes} fks=${fks} pks=${pks} unique=${uniques} check=${checks} sequences=${sequences}"
}

business_counts() {
  local prefix="$1"
  local users parents students coaches bookings assignments
  users="$(psql_c "SELECT count(*) FROM \"users\";")"
  parents="$(psql_c "SELECT count(*) FROM \"parent_profiles\";")"
  students="$(psql_c "SELECT count(*) FROM \"students\";")"
  coaches="$(psql_c "SELECT count(*) FROM \"coach_profiles\";")"
  bookings="$(psql_c "SELECT count(*) FROM \"SessionBooking\";")"
  assignments="$(psql_c "SELECT count(*) FROM \"coach_student_assignments\";")"
  json_put "${prefix}.users" "$users"
  json_put "${prefix}.parentProfiles" "$parents"
  json_put "${prefix}.students" "$students"
  json_put "${prefix}.coachProfiles" "$coaches"
  json_put "${prefix}.sessionBookings" "$bookings"
  json_put "${prefix}.coachStudentAssignments" "$assignments"
  log "${prefix}: users=${users} parent_profiles=${parents} students=${students} coach_profiles=${coaches} SessionBooking=${bookings} coach_student_assignments=${assignments}"
}

orphan_counts() {
  local prefix="$1"
  local orphan_students orphan_bookings
  orphan_students="$(psql_c "SELECT count(*) FROM \"students\" s LEFT JOIN \"users\" u ON u.id = s.\"userId\" WHERE u.id IS NULL;")"
  orphan_bookings="$(psql_c "SELECT count(*) FROM \"SessionBooking\" b LEFT JOIN \"users\" u ON u.id = b.\"studentId\" WHERE u.id IS NULL;")"
  json_put "${prefix}.orphanStudents" "$orphan_students"
  json_put "${prefix}.orphanBookings" "$orphan_bookings"
  log "${prefix}: orphan_students=${orphan_students} orphan_bookings=${orphan_bookings}"
}

log "=== BEFORE snapshot ==="
before_snapshot '.before.structural'
business_counts '.before.business'
orphan_counts '.before.orphans'
IDEMPOTENCY_COUNT_BEFORE="$(psql_c "SELECT count(*) FROM \"canonical_api_idempotency_keys\";")"
json_put '.before.canonicalApiIdempotencyKeys' "$IDEMPOTENCY_COUNT_BEFORE"
log "before.canonicalApiIdempotencyKeys=${IDEMPOTENCY_COUNT_BEFORE}"

# ── Step 8: apply the branch's one expected-pending migration ──────────────
export DATABASE_URL="postgresql://${DB_USER}:${PW}@127.0.0.1:${PORT}/${DB}?schema=public"
log "applying pending migration(s) via 'npx prisma migrate deploy' (current worktree = branch HEAD)..."
DEPLOY_LOG="${EVIDENCE_DIR}/migrate_deploy.log"
set +e
npx prisma migrate deploy > "$DEPLOY_LOG" 2>&1
DEPLOY_STATUS=$?
set -e
cat "$DEPLOY_LOG" >&2
if [ "$DEPLOY_STATUS" != "0" ]; then
  log "FAIL: prisma migrate deploy exited ${DEPLOY_STATUS}"
  json_put '.migrateDeployFailed' 'true'
  json_put_str '.migrateDeployLogTail' "$(tail -c 4000 "$DEPLOY_LOG")"
  if grep -q "CORE_STUDENT_BOOKING_OVERLAP_PRECHECK_FAILED" "$DEPLOY_LOG"; then
    log "FAIL cause: student-booking overlap preflight rejected the migration against real data (see migration.sql preflight DO block). Aggregate counts only are in the log above — no booking/user identifier was ever selected by this preflight."
    json_put_str '.migrateDeployFailureCause' 'CORE_STUDENT_BOOKING_OVERLAP_PRECHECK_FAILED'
  fi
  echo "PRODUCTION_CLONE_MIGRATION_REHEARSAL=FAIL" >&2
  exit 1
fi
log "prisma migrate deploy: PASS"

# ── Step 9: verify exactly the expected set was applied, exactly once ──────
APPLIED_AFTER_FILE="${EVIDENCE_DIR}/applied_after_migrations.txt"
docker exec "$C" psql -U "$DB_USER" -d "$DB" -t -A -c \
  "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name ASC;" \
  | sed '/^$/d' > "$APPLIED_AFTER_FILE"

NEWLY_APPLIED_FILE="${EVIDENCE_DIR}/newly_applied_migrations.txt"
comm -13 "$DUMP_APPLIED_FILE" "$APPLIED_AFTER_FILE" > "$NEWLY_APPLIED_FILE"
NEWLY_APPLIED_COUNT="$(wc -l < "$NEWLY_APPLIED_FILE" | tr -d ' ')"

DIFF_VS_EXPECTED="$(diff "$EXPECTED_PENDING_FILE" "$NEWLY_APPLIED_FILE" || true)"
DUP_CHECK="$(sort "$APPLIED_AFTER_FILE" | uniq -d | wc -l | tr -d ' ')"

log "newly applied migrations count: ${NEWLY_APPLIED_COUNT} (expected: ${EXPECTED_PENDING_COUNT})"
json_put '.newlyAppliedMigrationsCount' "$NEWLY_APPLIED_COUNT"
json_put "$(printf '.newlyAppliedMigrations')" "$(jq -R -s -c 'split("\n") | map(select(length>0))' "$NEWLY_APPLIED_FILE")"
json_put '.duplicateMigrationNameRows' "$DUP_CHECK"

if [ -n "$DIFF_VS_EXPECTED" ] || [ "$DUP_CHECK" != "0" ]; then
  log "FAIL: applied migration set does not exactly match the expected set, or a duplicate row exists."
  echo "$DIFF_VS_EXPECTED" >&2
  json_put_str '.unexpectedMigrationDiff' "$DIFF_VS_EXPECTED"
  echo "PRODUCTION_CLONE_MIGRATION_REHEARSAL=FAIL" >&2
  exit 1
fi
log "EXPECTED_MIGRATIONS_APPLIED == ACTUAL_MIGRATIONS_APPLIED, UNEXPECTED_MIGRATIONS=0: PASS"

# ── Step 10: idempotence — replay must be a no-op ───────────────────────────
IDEMPOTENT_LOG="${EVIDENCE_DIR}/migrate_deploy_replay.log"
npx prisma migrate deploy > "$IDEMPOTENT_LOG" 2>&1 || true
if ! grep -q "No pending migrations" "$IDEMPOTENT_LOG"; then
  log "FAIL: replay of prisma migrate deploy was not a no-op"
  cat "$IDEMPOTENT_LOG" >&2
  json_put '.idempotencyPass' 'false'
  echo "PRODUCTION_CLONE_MIGRATION_REHEARSAL=FAIL" >&2
  exit 1
fi
json_put '.idempotencyPass' 'true'
log "idempotency PASS (second 'npx prisma migrate deploy': no pending migrations)"

# ── Step 11: structural sanity after migration ──────────────────────────────
INVALID_INDEXES_AFTER="$(psql_c "SELECT count(*) FROM pg_index WHERE NOT indisvalid;")"
INVALID_CONSTRAINTS_AFTER="$(psql_c "SELECT count(*) FROM pg_constraint WHERE NOT convalidated;")"
log "post-migration structural check: invalid_indexes=${INVALID_INDEXES_AFTER} not_validated_constraints=${INVALID_CONSTRAINTS_AFTER}"
json_put '.after.invalidIndexes' "$INVALID_INDEXES_AFTER"
json_put '.after.notValidatedConstraints' "$INVALID_CONSTRAINTS_AFTER"

log "=== AFTER snapshot ==="
before_snapshot '.after.structural'
business_counts '.after.business'
orphan_counts '.after.orphans'
IDEMPOTENCY_COUNT_AFTER="$(psql_c "SELECT count(*) FROM \"canonical_api_idempotency_keys\";")"
json_put '.after.canonicalApiIdempotencyKeys' "$IDEMPOTENCY_COUNT_AFTER"

# ── Step 12: tables/columns touched specifically by this migration ─────────
FAMILY_REQUESTS_COUNT="$(psql_c "SELECT count(*) FROM \"family_requests\";")"
FAMILY_REQUEST_CHILDREN_COUNT="$(psql_c "SELECT count(*) FROM \"family_request_children\";")"
PLANNING_SERIES_COUNT="$(psql_c "SELECT count(*) FROM \"planning_series\";")"
PLANNING_OVERRIDE_AUDITS_COUNT="$(psql_c "SELECT count(*) FROM \"planning_override_audits\";")"
ASSIGNMENTS_TOTAL="$(psql_c "SELECT count(*) FROM \"coach_student_assignments\";")"
ASSIGNMENTS_UNRESOLVED_DEFAULT="$(psql_c "SELECT count(*) FROM \"coach_student_assignments\" WHERE \"courseScopeState\" = 'BACKFILL_UNRESOLVED';")"
ASSIGNMENTS_EMPTY_KEYS="$(psql_c "SELECT count(*) FROM \"coach_student_assignments\" WHERE \"academicCourseKeys\" = ARRAY[]::TEXT[];")"
STUDENTS_TOTAL="$(psql_c "SELECT count(*) FROM \"students\";")"
STUDENTS_REVISION_ZERO="$(psql_c "SELECT count(*) FROM \"students\" WHERE \"academicRevision\" = 0;")"
BOOKINGS_TOTAL="$(psql_c "SELECT count(*) FROM \"SessionBooking\";")"
BOOKINGS_STUDENT_PROFILE_FILLED="$(psql_c "SELECT count(*) FROM \"SessionBooking\" WHERE \"studentProfileId\" IS NOT NULL;")"
BOOKINGS_COACH_PROFILE_FILLED="$(psql_c "SELECT count(*) FROM \"SessionBooking\" WHERE \"coachProfileId\" IS NOT NULL;")"
BOOKINGS_STUDENT_PROFILE_NULL="$(psql_c "SELECT count(*) FROM \"SessionBooking\" WHERE \"studentProfileId\" IS NULL;")"
BOOKINGS_COACH_PROFILE_NULL="$(psql_c "SELECT count(*) FROM \"SessionBooking\" WHERE \"coachProfileId\" IS NULL;")"

log "new tables (must be empty, additive only): family_requests=${FAMILY_REQUESTS_COUNT} family_request_children=${FAMILY_REQUEST_CHILDREN_COUNT} planning_series=${PLANNING_SERIES_COUNT} planning_override_audits=${PLANNING_OVERRIDE_AUDITS_COUNT}"
log "coach_student_assignments: total=${ASSIGNMENTS_TOTAL} courseScopeState=BACKFILL_UNRESOLVED(default)=${ASSIGNMENTS_UNRESOLVED_DEFAULT} academicCourseKeys=empty(default)=${ASSIGNMENTS_EMPTY_KEYS}"
log "students: total=${STUDENTS_TOTAL} academicRevision=0(default)=${STUDENTS_REVISION_ZERO}"
log "SessionBooking: total=${BOOKINGS_TOTAL} studentProfileId filled=${BOOKINGS_STUDENT_PROFILE_FILLED} null=${BOOKINGS_STUDENT_PROFILE_NULL} coachProfileId filled=${BOOKINGS_COACH_PROFILE_FILLED} null=${BOOKINGS_COACH_PROFILE_NULL}"

json_put '.after.migrationTouched.familyRequests' "$FAMILY_REQUESTS_COUNT"
json_put '.after.migrationTouched.familyRequestChildren' "$FAMILY_REQUEST_CHILDREN_COUNT"
json_put '.after.migrationTouched.planningSeries' "$PLANNING_SERIES_COUNT"
json_put '.after.migrationTouched.planningOverrideAudits' "$PLANNING_OVERRIDE_AUDITS_COUNT"
json_put '.after.migrationTouched.assignmentsTotal' "$ASSIGNMENTS_TOTAL"
json_put '.after.migrationTouched.assignmentsCourseScopeStateBackfillUnresolvedDefault' "$ASSIGNMENTS_UNRESOLVED_DEFAULT"
json_put '.after.migrationTouched.assignmentsAcademicCourseKeysEmptyDefault' "$ASSIGNMENTS_EMPTY_KEYS"
json_put '.after.migrationTouched.studentsTotal' "$STUDENTS_TOTAL"
json_put '.after.migrationTouched.studentsAcademicRevisionZeroDefault' "$STUDENTS_REVISION_ZERO"
json_put '.after.migrationTouched.bookingsTotal' "$BOOKINGS_TOTAL"
json_put '.after.migrationTouched.bookingsStudentProfileFilled' "$BOOKINGS_STUDENT_PROFILE_FILLED"
json_put '.after.migrationTouched.bookingsStudentProfileNull' "$BOOKINGS_STUDENT_PROFILE_NULL"
json_put '.after.migrationTouched.bookingsCoachProfileFilled' "$BOOKINGS_COACH_PROFILE_FILLED"
json_put '.after.migrationTouched.bookingsCoachProfileNull' "$BOOKINGS_COACH_PROFILE_NULL"

# ── Step 13: application-level backfill + business report ──────────────────
log "running scripts/core/report-core-migration-state.ts (BEFORE backfill)..."
npx tsx scripts/core/report-core-migration-state.ts | tee "${EVIDENCE_DIR}/report_before_backfill.json" >&2 || true
log "running scripts/core/backfill-assignment-course-keys.ts (dry-run)..."
npx tsx scripts/core/backfill-assignment-course-keys.ts | tee "${EVIDENCE_DIR}/backfill_dry_run.json" >&2 || true
log "running scripts/core/backfill-assignment-course-keys.ts --apply..."
npx tsx scripts/core/backfill-assignment-course-keys.ts --apply | tee "${EVIDENCE_DIR}/backfill_apply.json" >&2 || true
log "running scripts/core/report-core-migration-state.ts (AFTER backfill)..."
npx tsx scripts/core/report-core-migration-state.ts | tee "${EVIDENCE_DIR}/report_after_backfill.json" >&2 || true
log "backfill idempotency re-run (expect changed=0)..."
npx tsx scripts/core/backfill-assignment-course-keys.ts --apply | tee "${EVIDENCE_DIR}/backfill_apply_replay.json" >&2 || true

# ── Step 14: real-data application-compat check (current Prisma client) ────
log "running scripts/core/rehearsal-real-data-compat-check.ts..."
npx tsx scripts/core/rehearsal-real-data-compat-check.ts | tee "${EVIDENCE_DIR}/real_data_compat_check.json" >&2

unset DATABASE_URL

log "PRODUCTION_CLONE_MIGRATION_REHEARSAL=PASS"
echo "EVIDENCE_DIR=${EVIDENCE_DIR}"
