#!/usr/bin/env bash

# Hermetic, one-container-per-run disposable Postgres harness. Originally
# built for the NPC real-DB suites; incrément 3 (candidat-individuel
# zero-debt) generalized the path allowlist and made the Jest config
# selectable via NPC_JEST_CONFIG so __tests__/database/** (jest.config.db.js)
# can reuse this exact mechanism instead of a second framework — see
# docs/audits/candidat-individuel-zero-debt-reachability.md §2/§13. The
# NPC-only default behavior is unchanged when NPC_JEST_CONFIG is unset.

set -Eeuo pipefail

if [[ "$#" -eq 0 ]]; then
  echo 'Usage: run-npc-real-db-tests.sh <test path> [...]' >&2
  echo '  Accepts: __tests__/integration/npc-*.real.test.ts, or __tests__/database/*.test.ts' >&2
  exit 64
fi

for requested_test in "$@"; do
  case "$requested_test" in
    __tests__/integration/npc-*.real.test.ts) ;;
    __tests__/database/*.test.ts) ;;
    *)
      echo 'Only explicit NPC real-database integration test paths, or __tests__/database/*.test.ts paths, are accepted.' >&2
      exit 64
      ;;
  esac
done

JEST_CONFIG="${NPC_JEST_CONFIG:-jest.integration.config.js}"

random_suffix="$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
CONTAINER_NAME="nexus-npc-real-${random_suffix}"
DATABASE_NAME="nexus_disposable_npc_${random_suffix}_test"
DATABASE_USER='nexus_npc_test'
DATABASE_PASSWORD="npc_test_password_${random_suffix}"
ENV_FILE=''

cleanup() {
  local exit_status=$?
  docker rm -f -v "$CONTAINER_NAME" >/dev/null 2>&1 || true
  if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
    rm -f -- "$ENV_FILE"
  fi
  exit "$exit_status"
}
trap cleanup EXIT INT TERM

ENV_FILE="$(mktemp)"
chmod 600 "$ENV_FILE"
printf '%s=%s\n%s=%s\n%s=%s\n' \
  'POSTGRES_USER' "$DATABASE_USER" \
  'POSTGRES_PASSWORD' "$DATABASE_PASSWORD" \
  'POSTGRES_DB' "$DATABASE_NAME" > "$ENV_FILE"

docker run --detach \
  --name "$CONTAINER_NAME" \
  --env-file "$ENV_FILE" \
  --publish 127.0.0.1::5432 \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  --health-cmd "pg_isready -U ${DATABASE_USER} -d ${DATABASE_NAME}" \
  --health-interval 1s \
  --health-timeout 3s \
  --health-retries 30 \
  pgvector/pgvector:pg15 >/dev/null
rm -f -- "$ENV_FILE"
ENV_FILE=''

host_port="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'END { print $NF }')"
if [[ ! "$host_port" =~ ^[0-9]+$ ]]; then
  echo 'Disposable PostgreSQL port discovery failed.' >&2
  exit 1
fi

health_attempts="${NPC_REAL_DB_HEALTH_ATTEMPTS:-60}"
healthy=0
for ((attempt = 1; attempt <= health_attempts; attempt += 1)); do
  if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || true)" == 'healthy' ]]; then
    healthy=1
    break
  fi
  sleep 1
done
if [[ "$healthy" -ne 1 ]]; then
  echo 'Disposable PostgreSQL did not become healthy.' >&2
  docker logs --tail 20 "$CONTAINER_NAME" >&2 || true
  exit 1
fi

database_url="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@127.0.0.1:${host_port}/${DATABASE_NAME}?schema=public"

echo 'Applying migrations to disposable PostgreSQL 15...'
DATABASE_URL="$database_url" \
TEST_DATABASE_URL="$database_url" \
NEXUS_DISPOSABLE_POSTGRES=1 \
  npx prisma migrate deploy

echo 'Running requested NPC real-database tests...'
container_database_url="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@127.0.0.1:5432/${DATABASE_NAME}?schema=public"
docker run --rm \
  --network "container:${CONTAINER_NAME}" \
  --volume "$PWD:$PWD" \
  --workdir "$PWD" \
  --tmpfs /npc-test-runtime:rw,noexec,nosuid,mode=0700,size=128m \
  --env "DATABASE_URL=${container_database_url}" \
  --env "TEST_DATABASE_URL=${container_database_url}" \
  --env 'NEXUS_DISPOSABLE_POSTGRES=1' \
  --env 'NPC_TEST_RUNTIME_ROOT=/npc-test-runtime' \
  --env 'NPC_LLM_MODE=off' \
  --env 'DOCUMENT_ENCRYPTION_KEY=synthetic-npc-real-test-document-encryption-key-2026-08-11' \
  node:20-bookworm \
  bash -lc 'apt-get update -qq && apt-get install -y -qq --no-install-recommends poppler-utils > /dev/null && npx jest --config "$0" --runInBand "$@"' \
  "$JEST_CONFIG" "$@"
