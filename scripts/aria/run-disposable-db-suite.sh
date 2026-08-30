#!/usr/bin/env bash

set -Eeuo pipefail

CONTAINER_NAME=''
ENV_FILE=''

cleanup() {
  local original_status=$?
  local cleanup_status=0
  trap - EXIT INT TERM

  if [[ -n "$CONTAINER_NAME" ]]; then
    if [[ ! "$CONTAINER_NAME" =~ ^nexus-aria-real-[a-f0-9]+$ ]]; then
      echo 'Refusing to remove an unexpected container name.' >&2
      cleanup_status=70
    elif ! docker rm -f -v "$CONTAINER_NAME" >/dev/null 2>&1; then
      echo 'Disposable ARIA PostgreSQL teardown failed.' >&2
      cleanup_status=1
    fi
  fi

  if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
    if ! rm -f -- "$ENV_FILE"; then
      echo 'Disposable ARIA environment-file teardown failed.' >&2
      cleanup_status=1
    fi
  fi

  if [[ "$original_status" -ne 0 ]]; then
    exit "$original_status"
  fi
  exit "$cleanup_status"
}
trap cleanup EXIT INT TERM

validate_disposable_database_url() {
  local value="${1:-}"
  local port=''

  if [[ -z "$value" || "$value" =~ [Pp][Rr][Oo][Dd] || "$value" =~ [Ss][Tt][Aa][Gg] ]]; then
    return 64
  fi
  if [[ ! "$value" =~ ^postgresql://[^/@:]+:[^/@]+@127\.0\.0\.1:([0-9]+)/nexus_disposable_aria_[a-f0-9]+_test\?schema=public$ ]]; then
    return 64
  fi
  port="${BASH_REMATCH[1]}"
  if ((port < 1024 || port > 65535 || port == 5432)); then
    return 64
  fi
}

if [[ "${1:-}" == '--validate-url-only' ]]; then
  if ! validate_disposable_database_url "${ARIA_DISPOSABLE_DATABASE_URL:-}"; then
    echo 'ARIA_DATABASE_NOT_DISPOSABLE' >&2
    exit 64
  fi
  exit 0
fi

lane="${1:-}"
case "$lane" in
  db) jest_config='jest.aria.db.config.js' ;;
  concurrency) jest_config='jest.aria.concurrency.config.js' ;;
  *)
    echo 'Usage: run-disposable-db-suite.sh <db|concurrency> [Jest arguments...]' >&2
    exit 64
    ;;
esac
shift

random_suffix="$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
CONTAINER_NAME="nexus-aria-real-${random_suffix}"
database_name="nexus_disposable_aria_${random_suffix}_test"
database_user='nexus_aria_test'
database_password="${random_suffix}${random_suffix}"

ENV_FILE="$(mktemp)"
chmod 600 "$ENV_FILE"
printf '%s=%s\n%s=%s\n%s=%s\n' \
  'POSTGRES_USER' "$database_user" \
  'POSTGRES_PASSWORD' "$database_password" \
  'POSTGRES_DB' "$database_name" > "$ENV_FILE"

docker run --detach \
  --name "$CONTAINER_NAME" \
  --env-file "$ENV_FILE" \
  --publish 127.0.0.1::5432 \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  --health-cmd "pg_isready -U ${database_user} -d ${database_name}" \
  --health-interval 1s \
  --health-timeout 3s \
  --health-retries 30 \
  pgvector/pgvector:pg15 >/dev/null
rm -f -- "$ENV_FILE"
ENV_FILE=''

host_port="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'END { print $NF }')"
database_url="postgresql://${database_user}:${database_password}@127.0.0.1:${host_port}/${database_name}?schema=public"
if ! validate_disposable_database_url "$database_url"; then
  echo 'Generated ARIA database URL failed its disposable-target guard.' >&2
  exit 64
fi

health_attempts="${ARIA_REAL_DB_HEALTH_ATTEMPTS:-60}"
healthy=0
for ((attempt = 1; attempt <= health_attempts; attempt += 1)); do
  if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null)" == 'healthy' ]]; then
    healthy=1
    break
  fi
  sleep 1
done
if [[ "$healthy" -ne 1 ]]; then
  echo 'Disposable ARIA PostgreSQL did not become healthy.' >&2
  if ! docker logs --tail 20 "$CONTAINER_NAME" >&2; then
    echo 'Disposable ARIA PostgreSQL logs were unavailable.' >&2
  fi
  exit 1
fi

echo 'Applying migrations to disposable ARIA PostgreSQL...'
DATABASE_URL="$database_url" \
TEST_DATABASE_URL="$database_url" \
NEXUS_DISPOSABLE_POSTGRES=1 \
  npx prisma migrate deploy

echo "Running ARIA ${lane} tests against disposable PostgreSQL..."
DATABASE_URL="$database_url" \
TEST_DATABASE_URL="$database_url" \
NEXUS_DISPOSABLE_POSTGRES=1 \
  npx jest --config "$jest_config" --runInBand "$@"
