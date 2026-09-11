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

# Core v2 (go-live): its own disposable database, baseline+operational
# migrations from empty, then the seeded staff/coach accounts mirrored with
# the same ids so the session→actor mapping resolves them. No v1 fallback:
# if CORE_V2_DATABASE_URL is unset the /api/v2 surface answers 503.
if [ -n "${CORE_V2_DATABASE_URL:-}" ]; then
  echo "[e2e-entrypoint] Waiting for Core v2 PostgreSQL..."
  core_v2_ready=false
  for i in $(seq 1 30); do
    if timeout 1 bash -c "echo > /dev/tcp/postgres-core-v2-e2e/5432" 2>/dev/null; then
      core_v2_ready=true
      break
    fi
    sleep 1
  done
  if [ "$core_v2_ready" != "true" ]; then
    echo "[e2e-entrypoint] ERROR: Core v2 PostgreSQL did not become ready."
    exit 1
  fi
  echo "[e2e-entrypoint] Running Core v2 migrations from empty..."
  prisma migrate deploy --schema=core-v2/prisma/schema.prisma
  echo "[e2e-entrypoint] Mirroring seeded staff/coach accounts into Core v2..."
  tsx scripts/core-v2/seed-e2e-staff-actors.ts
fi

echo "[e2e-entrypoint] Starting Next.js server..."
exec node server.js
