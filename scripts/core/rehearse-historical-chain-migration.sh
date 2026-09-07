#!/usr/bin/env bash
# ── HISTORICAL_PRODUCTION_CHAIN_MIGRATION_REHEARSAL ──
#
# NOT Task 18 / PRODUCTION_CLONE_MIGRATION_REHEARSAL. This is a distinct,
# separately-named rehearsal authorized by the Release Owner (Task 18
# follow-up decision, 2026-09-07) to determine whether the authenticated
# production backup `prod_20260903T1850.dump` — whose OWN `_prisma_migrations`
# table ends at `20260830150000_add_lva_lvb_languages`, NOT
# `20260903190000_add_planning_studio` as previously assumed — can cleanly
# traverse the full chain of migrations actually missing, up to this
# branch's HEAD.
#
# Isolation: dedicated Docker network/container/volume, prefixed
# `nexus-historical-chain-rehearsal-` (deliberately distinct from the prior
# Task 18 attempt's `nexus-core-migration-rehearsal-*` naming, and from any
# pre-existing container). 127.0.0.1-only binding, freshly generated
# credentials, single volume, everything destroyed on exit (including on
# failure — `trap ... EXIT`).
#
# The dump is never opened for writing: only `docker cp` (a read) copies it
# into the container. Source file size/mtime/sha256 are verified unchanged
# before and after.
#
# No PII is ever queried, logged or printed: only structural metadata
# (table/index/constraint/sequence counts, migration names, aggregate row
# counts) crosses into this script's stdout or the evidence file.
#
# Usage: ./scripts/core/rehearse-historical-chain-migration.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

DUMP_PATH="${HISTORICAL_REHEARSAL_DUMP_PATH:-/home/alaeddine/nexus-convergence-backup-20260903/audit/conv-82a34dba/prod_20260903T1850.dump}"
EXPECTED_DUMP_SHA256="e452d804abd269d821dea2ace70250f34ced2bb57bef6a1552647169394ffd8f"

IMAGE="pgvector/pgvector:pg15"
RUN_ID="$(date -u +%Y%m%dt%H%M%Sz)"
NET="nexus-historical-chain-rehearsal-net-${RUN_ID}"
C="nexus-historical-chain-rehearsal-${RUN_ID}"
V="nexus-historical-chain-rehearsal-vol-${RUN_ID}"
PORT="${HISTORICAL_REHEARSAL_PORT:-15603}"
DB="nexus_historical_rehearsal"
DB_USER="rehearsal_historical_admin"

EVIDENCE_DIR="$(mktemp -d)"
EVIDENCE_FILE="${EVIDENCE_DIR}/evidence.json"
echo '{}' > "$EVIDENCE_FILE"

log() { echo "[historical-chain-rehearsal] $*" >&2; }

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
  echo "[historical-chain-rehearsal] TIMEOUT waiting for ${C}" >&2
  return 1
}

psql_c() { docker exec "$C" psql -U "$DB_USER" -d "$DB" -t -A -c "$1"; }

json_put() {
  # json_put <jq-key-path-expr-using-$1-as-.> <value(raw jq)>
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

# ── Step 2: restore ──────────────────────────────────────────────────────────
# The archive's own header records "Dump Version: 1.15-0" / "Dumped by
# pg_dump version: 16.15" — newer than the pg15 server image's pg_restore,
# which refuses to even parse the TOC ("unsupported version (1.15)"). This is
# purely an archive-FORMAT compatibility concern, unrelated to the Postgres
# wire protocol (a newer pg_restore talking to an older server is standard
# and fully supported). So: restore using the HOST's pg_restore (16.15,
# confirmed able to parse this exact archive's TOC via `pg_restore --list`
# beforehand) connecting over TCP to the isolated container — reading the
# dump file directly from its original path, never copying it anywhere
# first (no secondary copy of the archive is created at all).
RESTORE_LOG="${EVIDENCE_DIR}/pg_restore.log"
set +e
PGPASSWORD="$PW" pg_restore --no-owner --no-acl \
  -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB" \
  "$DUMP_PATH" > "$RESTORE_LOG" 2>&1
RESTORE_STATUS=$?
set -e
log "pg_restore exit status: ${RESTORE_STATUS} (warnings, if any, are structural DDL only — see ${RESTORE_LOG})"

# Verify the source dump file was never mutated by the docker cp / restore.
SRC_SIZE_AFTER="$(stat -c%s "$DUMP_PATH")"
SRC_MTIME_AFTER="$(stat -c%Y "$DUMP_PATH")"
SRC_SHA_AFTER="$(sha256sum "$DUMP_PATH" | cut -d' ' -f1)"
if [ "$SRC_SIZE_BEFORE" != "$SRC_SIZE_AFTER" ] || [ "$SRC_MTIME_BEFORE" != "$SRC_MTIME_AFTER" ] || [ "$SRC_SHA_BEFORE" != "$SRC_SHA_AFTER" ]; then
  echo "FATAL: source dump file was modified during this run — aborting and preserving evidence." >&2
  exit 1
fi
log "source dump file unchanged after restore (size/mtime/sha256 identical)"

# Known pre-existing issue (documented in docs/audits/2026-09-06-core-migration-rehearsal.md):
# the archive's own TOC lists users_household_name_key_idx before the function
# it depends on (nexus_normalize_name_part), causing that one CREATE INDEX to
# fail during the automatic pass. Detect and, if needed, recreate it from the
# archive's own DDL (never a hand-authored substitute).
HOUSEHOLD_IDX_EXISTS="$(psql_c "SELECT count(*) FROM pg_indexes WHERE indexname = 'users_household_name_key_idx';")"
if [ "$HOUSEHOLD_IDX_EXISTS" = "0" ] && grep -q "users_household_name_key_idx" "$RESTORE_LOG"; then
  log "recreating users_household_name_key_idx (known TOC ordering issue, DDL taken from the archive's own definition)"
  docker exec "$C" psql -U "$DB_USER" -d "$DB" -c \
    'CREATE INDEX users_household_name_key_idx ON "users" USING btree (nexus_household_name_key("firstName", "lastName"));' >/dev/null
fi

# ── Step 3: structural sanity before touching _prisma_migrations ───────────
INVALID_INDEXES="$(psql_c "SELECT count(*) FROM pg_index WHERE NOT indisvalid;")"
INVALID_CONSTRAINTS="$(psql_c "SELECT count(*) FROM pg_constraint WHERE NOT convalidated;")"
log "post-restore structural check: invalid_indexes=${INVALID_INDEXES} not_validated_constraints=${INVALID_CONSTRAINTS}"
json_put '.postRestore.invalidIndexes' "$INVALID_INDEXES"
json_put '.postRestore.notValidatedConstraints' "$INVALID_CONSTRAINTS"

# ── Step 4: independent re-verification of the dump's actual migration state ─
DUMP_LAST_MIGRATION="$(psql_c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1;")"
log "dump _prisma_migrations last applied (by name, DESC): ${DUMP_LAST_MIGRATION}"
json_put_str '.dumpLastMigrationByNameDesc' "$DUMP_LAST_MIGRATION"

# Full applied set, exactly as recorded (never assumed from ordering).
DUMP_APPLIED_FILE="${EVIDENCE_DIR}/dump_applied_migrations.txt"
docker exec "$C" psql -U "$DB_USER" -d "$DB" -t -A -c \
  "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name ASC;" \
  | sed '/^$/d' > "$DUMP_APPLIED_FILE"
DUMP_APPLIED_COUNT="$(wc -l < "$DUMP_APPLIED_FILE" | tr -d ' ')"
log "dump _prisma_migrations total finished/not-rolled-back rows: ${DUMP_APPLIED_COUNT}"
json_put '.dumpAppliedMigrationsCount' "$DUMP_APPLIED_COUNT"

# Any row present but NOT finished / rolled back (would indicate a stuck migration).
UNFINISHED_ROWS="$(psql_c "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;")"
log "dump _prisma_migrations rows that are unfinished or rolled back: ${UNFINISHED_ROWS}"
json_put '.dumpUnfinishedOrRolledBackRows' "$UNFINISHED_ROWS"

# Current worktree's full migration directory set (HEAD, i.e. this branch).
HEAD_MIGRATIONS_FILE="${EVIDENCE_DIR}/head_migrations.txt"
ls "$REPO_ROOT/prisma/migrations" | grep -E '^[0-9]' | sort > "$HEAD_MIGRATIONS_FILE"
HEAD_MIGRATIONS_COUNT="$(wc -l < "$HEAD_MIGRATIONS_FILE" | tr -d ' ')"
log "current worktree (HEAD) migration directory count: ${HEAD_MIGRATIONS_COUNT}"

# Migrations present in the dump but ABSENT from HEAD's migrations dir (renames / orphans — must be empty).
DUMP_ONLY_FILE="${EVIDENCE_DIR}/dump_only_migrations.txt"
comm -23 "$DUMP_APPLIED_FILE" "$HEAD_MIGRATIONS_FILE" > "$DUMP_ONLY_FILE" || true
DUMP_ONLY_COUNT="$(wc -l < "$DUMP_ONLY_FILE" | tr -d ' ')"

# Migrations present in HEAD but NOT yet applied in the dump — the true expected-pending set,
# computed by SET DIFFERENCE against the dump's own table, never by name-ordering assumption.
EXPECTED_PENDING_FILE="${EVIDENCE_DIR}/expected_pending_migrations.txt"
comm -13 "$DUMP_APPLIED_FILE" "$HEAD_MIGRATIONS_FILE" > "$EXPECTED_PENDING_FILE"
EXPECTED_PENDING_COUNT="$(wc -l < "$EXPECTED_PENDING_FILE" | tr -d ' ')"
log "expected pending migrations (HEAD minus dump's actual applied set): ${EXPECTED_PENDING_COUNT}"
log "--- expected pending list ---"
cat "$EXPECTED_PENDING_FILE" >&2
log "--- end expected pending list ---"
json_put '.dumpOnlyMigrationsCount' "$DUMP_ONLY_COUNT"
json_put '.expectedPendingMigrationsCount' "$EXPECTED_PENDING_COUNT"
json_put "$(printf '.expectedPendingMigrations')" "$(jq -R -s -c 'split("\n") | map(select(length>0))' "$EXPECTED_PENDING_FILE")"
json_put "$(printf '.dumpOnlyMigrations')" "$(jq -R -s -c 'split("\n") | map(select(length>0))' "$DUMP_ONLY_FILE")"

if [ "$DUMP_ONLY_COUNT" != "0" ]; then
  log "WARNING: dump contains migrations absent from HEAD's migrations directory (renames or orphans) — see ${DUMP_ONLY_FILE}"
fi

# ── Step 5: BEFORE baseline (structural fingerprint + business counts, aggregates only) ─
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

# ── Step 6: apply exactly the expected-pending migrations via prisma migrate deploy ─
export DATABASE_URL="postgresql://${DB_USER}:${PW}@127.0.0.1:${PORT}/${DB}?schema=public"
log "applying pending migrations via 'npx prisma migrate deploy' (current worktree = branch HEAD)..."
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
  # fall through to still emit evidence file path, but propagate failure
  echo "HISTORICAL_PRODUCTION_CHAIN_MIGRATION_REHEARSAL=FAIL" >&2
  exit 1
fi
log "prisma migrate deploy: PASS"

# ── Step 7: verify exactly the expected set was applied, exactly once, nothing else ─
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
  log "FAIL: applied migration set does not exactly match the expected-pending set, or a duplicate row exists."
  log "diff (expected vs actually-newly-applied):"
  echo "$DIFF_VS_EXPECTED" >&2
  json_put_str '.unexpectedMigrationDiff' "$DIFF_VS_EXPECTED"
  echo "HISTORICAL_PRODUCTION_CHAIN_MIGRATION_REHEARSAL=FAIL" >&2
  exit 1
fi
log "applied set == expected pending set, exactly, no extras, no duplicates: PASS"

# ── Step 8: idempotency — replay must be a no-op ────────────────────────────
IDEMPOTENT_LOG="${EVIDENCE_DIR}/migrate_deploy_replay.log"
npx prisma migrate deploy > "$IDEMPOTENT_LOG" 2>&1 || true
if ! grep -q "No pending migrations" "$IDEMPOTENT_LOG"; then
  log "FAIL: replay of prisma migrate deploy was not a no-op"
  cat "$IDEMPOTENT_LOG" >&2
  json_put '.idempotencyPass' 'false'
  echo "HISTORICAL_PRODUCTION_CHAIN_MIGRATION_REHEARSAL=FAIL" >&2
  exit 1
fi
json_put '.idempotencyPass' 'true'
log "idempotency PASS (replay: no pending migrations)"

# ── Step 9: structural sanity after migration ───────────────────────────────
INVALID_INDEXES_AFTER="$(psql_c "SELECT count(*) FROM pg_index WHERE NOT indisvalid;")"
INVALID_CONSTRAINTS_AFTER="$(psql_c "SELECT count(*) FROM pg_constraint WHERE NOT convalidated;")"
log "post-migration structural check: invalid_indexes=${INVALID_INDEXES_AFTER} not_validated_constraints=${INVALID_CONSTRAINTS_AFTER}"
json_put '.after.invalidIndexes' "$INVALID_INDEXES_AFTER"
json_put '.after.notValidatedConstraints' "$INVALID_CONSTRAINTS_AFTER"

log "=== AFTER snapshot ==="
before_snapshot '.after.structural'
business_counts '.after.business'
orphan_counts '.after.orphans'

# ── Step 10: application-level backfill + business report (real applicative scripts, not ad hoc SQL) ─
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

unset DATABASE_URL

log "HISTORICAL_PRODUCTION_CHAIN_MIGRATION_REHEARSAL=PASS"
echo "EVIDENCE_DIR=${EVIDENCE_DIR}"
