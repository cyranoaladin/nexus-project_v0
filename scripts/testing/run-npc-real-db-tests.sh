#!/usr/bin/env bash

set -Eeuo pipefail

readonly NODE_IMAGE='node:22.23.1-bookworm@sha256:5647be709086c696ff32edaaf1c70cd26d1da6ab2b39c32f3c7b4c4a31957e37'
readonly POSTGRES_IMAGE='pgvector/pgvector:pg15@sha256:a947c45cdc5906a1bc951f20a8709e321256343ee0f251e4ae00b5e7def4e6da'
readonly EXPECTED_NODE_VERSION='v22.23.1'

if [[ "$#" -eq 1 && "$1" == '--all' ]]; then
  mapfile -t requested_tests < <(
    find __tests__/integration -type f -name 'npc-*.real.test.ts' -print | LC_ALL=C sort
  )
  if [[ "${#requested_tests[@]}" -eq 0 ]]; then
    echo 'No NPC real-database integration tests were discovered.' >&2
    exit 1
  fi
elif [[ "$#" -eq 0 ]]; then
  echo 'Usage: run-npc-real-db-tests.sh --all | <NPC real test path> [...]' >&2
  exit 64
else
  requested_tests=("$@")
fi

integration_root="$(realpath __tests__/integration)"
for requested_test in "${requested_tests[@]}"; do
  requested_basename="${requested_test##*/}"
  if [[ ! -f "$requested_test" ]] || \
    [[ ! "$requested_basename" =~ ^npc-.*\.real\.test\.ts$ ]] || \
    [[ "$(realpath "$requested_test")" != "$integration_root/"* ]]; then
    echo 'Only existing NPC real-database integration test paths are accepted.' >&2
    exit 64
  fi
done

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
  "$POSTGRES_IMAGE" >/dev/null
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

postgres_version_num="$(docker exec "$CONTAINER_NAME" psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -Atqc 'SHOW server_version_num')"
if [[ ! "$postgres_version_num" =~ ^15[0-9]{4}$ ]]; then
  echo 'Disposable PostgreSQL runtime is not major version 15.' >&2
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
  --env "EXPECTED_NODE_VERSION=${EXPECTED_NODE_VERSION}" \
  "$NODE_IMAGE" \
  sh -ceu 'test "$(node --version)" = "$EXPECTED_NODE_VERSION"; exec npx jest --config jest.integration.config.js --runInBand "$@"' \
  sh "${requested_tests[@]}"

if [[ -n "${NPC_RUNTIME_EVIDENCE_PATH:-}" ]]; then
  evidence_directory="$(dirname "$NPC_RUNTIME_EVIDENCE_PATH")"
  if [[ ! -d "$evidence_directory" ]]; then
    install -d -m 0700 "$evidence_directory"
  fi
  printf 'NPC_TESTS=%s\nNODE_VERSION=%s\nNODE_IMAGE=%s\nPOSTGRES_MAJOR=15\nPOSTGRES_IMAGE=%s\n' \
    "${#requested_tests[@]}" "$EXPECTED_NODE_VERSION" "$NODE_IMAGE" "$POSTGRES_IMAGE" \
    > "$NPC_RUNTIME_EVIDENCE_PATH"
fi
