#!/usr/bin/env bash
# ── Task 18 : répétition de migration CORE (bases isolées, jetables) ──
#
# Rejoue exactement les migrations de `prisma/migrations/` contre deux bases
# Postgres isolées et jetables :
#   1. "fresh"     — base totalement vide, toutes les migrations depuis zéro.
#   2. "synthetic" — base non vide mais entièrement synthétique (aucune
#      donnée réelle) : migrations de base appliquées via le commit parent
#      (`git merge-base origin/main HEAD`), quelques lignes fictives semées,
#      puis les migrations restantes de cette branche appliquées par-dessus.
#
# La répétition contre la sauvegarde de production réelle (données réelles,
# sujette à un contrat d'autorisation explicite et à des contraintes de
# protection des données) N'EST PAS exécutée par ce script : elle est
# narrée pas à pas dans `docs/audits/2026-09-06-core-migration-rehearsal.md`.
# Ce script ne lit, ne référence et n'a besoin d'aucune sauvegarde réelle.
#
# Isolation : conteneurs/volumes/réseau Docker dédiés et nommés pour ce
# run (jamais `nexus-postgres-test`, jamais un volume existant), liaison
# 127.0.0.1 uniquement, identifiants générés aléatoirement à chaque run,
# tout est détruit en sortie (y compris sur erreur — `trap ... EXIT`).
#
# Usage : ./scripts/core/rehearse-core-migration.sh
# Prérequis : docker, openssl, npx (dépendances du dépôt déjà installées).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

IMAGE="pgvector/pgvector:pg15"
RUN_ID="$(date -u +%Y%m%dt%H%M%Sz)"
NET="nexus-core-migration-rehearsal-net-${RUN_ID}"

FRESH_C="nexus-core-migration-rehearsal-fresh-${RUN_ID}"
FRESH_V="nexus-core-migration-rehearsal-fresh-vol-${RUN_ID}"
FRESH_PORT="${CORE_REHEARSAL_FRESH_PORT:-15511}"

SYN_C="nexus-core-migration-rehearsal-synthetic-${RUN_ID}"
SYN_V="nexus-core-migration-rehearsal-synthetic-vol-${RUN_ID}"
SYN_PORT="${CORE_REHEARSAL_SYNTHETIC_PORT:-15512}"

OLD_WORKTREE=""

log() { echo "[rehearse-core-migration] $*"; }

cleanup() {
  local status=$?
  log "teardown (exit status ${status})..."
  docker rm -f "$FRESH_C" "$SYN_C" >/dev/null 2>&1 || true
  docker volume rm "$FRESH_V" "$SYN_V" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  if [ -n "$OLD_WORKTREE" ] && [ -d "$OLD_WORKTREE" ]; then
    git -C "$REPO_ROOT" worktree remove --force "$OLD_WORKTREE" >/dev/null 2>&1 || rm -rf "$OLD_WORKTREE"
  fi
  exit "$status"
}
trap cleanup EXIT

gen_pw() { openssl rand -base64 36 | tr -d '=+/\n' | head -c 32; }

wait_ready() {
  local container=$1 user=$2 db=$3
  for _ in $(seq 1 30); do
    if docker exec "$container" pg_isready -U "$user" -d "$db" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "[rehearse-core-migration] TIMEOUT waiting for ${container}" >&2
  return 1
}

assert_idempotent() {
  local label=$1
  local out
  out="$(npx prisma migrate deploy 2>&1)"
  if ! grep -q "No pending migrations" <<<"$out"; then
    echo "[rehearse-core-migration] FAIL: ${label} is not idempotent on replay" >&2
    echo "$out" >&2
    return 1
  fi
  log "${label}: idempotency PASS (no pending migrations on replay)"
}

log "run id: ${RUN_ID}"
docker network create --driver bridge "$NET" >/dev/null
log "isolated network created: ${NET}"

# ── Lane 1 : base vide ───────────────────────────────────────────────────────
FRESH_PW="$(gen_pw)"
docker volume create "$FRESH_V" >/dev/null
docker run -d --name "$FRESH_C" --network "$NET" -p "127.0.0.1:${FRESH_PORT}:5432" \
  -e POSTGRES_USER=rehearsal_fresh_admin \
  -e POSTGRES_PASSWORD="${FRESH_PW}" \
  -e POSTGRES_DB=nexus_rehearsal_fresh \
  -v "$FRESH_V":/var/lib/postgresql/data \
  "$IMAGE" >/dev/null
wait_ready "$FRESH_C" rehearsal_fresh_admin nexus_rehearsal_fresh
log "fresh container ready: ${FRESH_C} (127.0.0.1:${FRESH_PORT}, bound loopback only)"

export DATABASE_URL="postgresql://rehearsal_fresh_admin:${FRESH_PW}@127.0.0.1:${FRESH_PORT}/nexus_rehearsal_fresh?schema=public"
log "fresh: applying all migrations from empty..."
npx prisma migrate deploy
assert_idempotent "fresh"
FRESH_TABLES="$(docker exec "$FRESH_C" psql -U rehearsal_fresh_admin -d nexus_rehearsal_fresh -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
FRESH_MIGRATIONS="$(docker exec "$FRESH_C" psql -U rehearsal_fresh_admin -d nexus_rehearsal_fresh -t -A -c "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
log "fresh: PASS — tables=${FRESH_TABLES} migrations_applied=${FRESH_MIGRATIONS}"
unset DATABASE_URL

# ── Lane 2 : base existante mais entièrement synthétique ────────────────────
BASE_COMMIT="$(git merge-base origin/main HEAD 2>/dev/null || git merge-base main HEAD)"
LATEST_MIGRATION="$(ls prisma/migrations | grep -E '^[0-9]' | sort | tail -1)"
log "synthetic: baseline commit ${BASE_COMMIT}, migration under test: ${LATEST_MIGRATION}"

OLD_WORKTREE="$(mktemp -d)/old-app-checkout"
git worktree add --detach --quiet "$OLD_WORKTREE" "$BASE_COMMIT"
cp -al "$REPO_ROOT/node_modules" "$OLD_WORKTREE/node_modules"
(cd "$OLD_WORKTREE" && npx prisma generate >/dev/null)
# Rehearsal fixtures live in the CURRENT worktree (git-tracked) but must run
# against the OLD checkout's own Prisma client/lib code — copy them in.
# (`scripts/core/` may not exist yet at the prior baseline commit.)
mkdir -p "$OLD_WORKTREE/scripts/core"
cp "$REPO_ROOT/scripts/core/rehearsal-seed-synthetic.ts" "$OLD_WORKTREE/scripts/core/rehearsal-seed-synthetic.ts"
cp "$REPO_ROOT/scripts/core/rehearsal-rollback-compat-check.ts" "$OLD_WORKTREE/scripts/core/rehearsal-rollback-compat-check.ts"

SYN_PW="$(gen_pw)"
docker volume create "$SYN_V" >/dev/null
docker run -d --name "$SYN_C" --network "$NET" -p "127.0.0.1:${SYN_PORT}:5432" \
  -e POSTGRES_USER=rehearsal_synthetic_admin \
  -e POSTGRES_PASSWORD="${SYN_PW}" \
  -e POSTGRES_DB=nexus_rehearsal_synthetic \
  -v "$SYN_V":/var/lib/postgresql/data \
  "$IMAGE" >/dev/null
wait_ready "$SYN_C" rehearsal_synthetic_admin nexus_rehearsal_synthetic
log "synthetic container ready: ${SYN_C} (127.0.0.1:${SYN_PORT}, bound loopback only)"

export DATABASE_URL="postgresql://rehearsal_synthetic_admin:${SYN_PW}@127.0.0.1:${SYN_PORT}/nexus_rehearsal_synthetic?schema=public"

log "synthetic: applying baseline migrations via prior commit ${BASE_COMMIT}..."
(cd "$OLD_WORKTREE" && npx prisma migrate deploy >/dev/null)

log "synthetic: seeding a minimal, entirely synthetic, pre-migration fixture..."
(cd "$OLD_WORKTREE" && npx tsx scripts/core/rehearsal-seed-synthetic.ts)

log "synthetic: applying this branch's remaining migration(s)..."
npx prisma migrate deploy
assert_idempotent "synthetic"

log "synthetic: rollback/backward-compatibility check (prior app build vs expanded schema)..."
(cd "$OLD_WORKTREE" && npx tsx scripts/core/rehearsal-rollback-compat-check.ts)

log "synthetic: business-test scripts (report + backfill)..."
npx tsx scripts/core/report-core-migration-state.ts
npx tsx scripts/core/backfill-assignment-course-keys.ts
npx tsx scripts/core/backfill-assignment-course-keys.ts --apply
npx tsx scripts/core/report-core-migration-state.ts
log "synthetic: backfill idempotency re-run (expect changed=0)..."
npx tsx scripts/core/backfill-assignment-course-keys.ts --apply

unset DATABASE_URL

log "ALL LANES PASS: fresh-DB and synthetic-DB migration rehearsals complete."
log "Real production-clone rehearsal is a separate, manually-narrated procedure — see docs/audits/2026-09-06-core-migration-rehearsal.md"
