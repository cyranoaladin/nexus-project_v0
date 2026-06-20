#!/bin/bash
# =============================================================================
# E2E Entrypoint — migrate → seed → start Next.js
# =============================================================================
# Used by Dockerfile.e2e to prepare the DB and start the app
# =============================================================================

set -e

echo "[e2e-entrypoint] Waiting for PostgreSQL to be ready..."
# Wait for postgres to be ready (max 30s)
for i in $(seq 1 30); do
  if pg_isready -h postgres-e2e -U postgres -d nexus_e2e > /dev/null 2>&1 || \
     wget -qO- "http://postgres-e2e:5432" > /dev/null 2>&1; then
    echo "[e2e-entrypoint] PostgreSQL is ready."
    break
  fi
  # Fallback: try a simple TCP check
  if timeout 1 bash -c "echo > /dev/tcp/postgres-e2e/5432" 2>/dev/null; then
    echo "[e2e-entrypoint] PostgreSQL is ready (TCP)."
    break
  fi
  echo "[e2e-entrypoint] Waiting for PostgreSQL... ($i/30)"
  sleep 1
done

echo "[e2e-entrypoint] Running Prisma migrations..."
prisma migrate deploy

echo "[e2e-entrypoint] Running database seed..."
prisma db seed || echo "[e2e-entrypoint] Seed failed or already seeded, continuing..."

echo "[e2e-entrypoint] Running E2E-specific seed (credentials + fixtures)..."
mkdir -p /app/e2e
DATABASE_URL="${DATABASE_URL}" npx tsx scripts/seed-e2e-db.ts || echo "[e2e-entrypoint] E2E seed skipped (may already exist)."

# Share credentials with playwright container via shared volume
if [ -f /app/e2e/.credentials.json ]; then
  cp /app/e2e/.credentials.json /app/e2e-shared/.credentials.json 2>/dev/null || true
  echo "[e2e-entrypoint] Credentials shared to e2e-shared volume."
fi

echo "[e2e-entrypoint] Starting Next.js server..."
exec node server.js
