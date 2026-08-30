#!/bin/bash
# =============================================================================
# E2E Entrypoint — migrate → seed → start Next.js
# =============================================================================
# Used by Dockerfile.e2e to prepare the DB and start the app
# =============================================================================

set -euo pipefail

export NEXUS_DISPOSABLE_POSTGRES=1
export E2E_DISPOSABLE_STACK=1

echo "[e2e-entrypoint] Waiting for PostgreSQL to be ready..."
# Wait for postgres to be ready (max 30s)
postgres_ready=false
for i in $(seq 1 30); do
  if pg_isready -h postgres-e2e -U postgres -d nexus_e2e > /dev/null 2>&1 || \
     wget -qO- "http://postgres-e2e:5432" > /dev/null 2>&1; then
    echo "[e2e-entrypoint] PostgreSQL is ready."
    postgres_ready=true
    break
  fi
  # Fallback: try a simple TCP check
  if timeout 1 bash -c "echo > /dev/tcp/postgres-e2e/5432" 2>/dev/null; then
    echo "[e2e-entrypoint] PostgreSQL is ready (TCP)."
    postgres_ready=true
    break
  fi
  echo "[e2e-entrypoint] Waiting for PostgreSQL... ($i/30)"
  sleep 1
done

if [ "$postgres_ready" != "true" ]; then
  echo "[e2e-entrypoint] ERROR: PostgreSQL did not become ready."
  exit 1
fi

echo "[e2e-entrypoint] Running Prisma migrations..."
prisma migrate deploy

echo "[e2e-entrypoint] Running E2E-specific seed (credentials + fixtures)..."
mkdir -p /app/e2e-shared
export E2E_CREDENTIALS_PATH=/app/e2e-shared/.credentials.json
tsx scripts/seed-e2e-db.ts

echo "[e2e-entrypoint] Verifying E2E identities and credentials manifest..."
tsx scripts/verify-e2e-seed.ts

echo "[e2e-entrypoint] Starting Next.js server..."
exec node server.js
