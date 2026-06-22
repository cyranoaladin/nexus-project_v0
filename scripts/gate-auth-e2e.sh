#!/usr/bin/env bash
# ── Auth E2E Gate ──
# Seeds the e2e DB then runs auth-requiring specs against standalone with real auth.
# Order: seed → serve → test. Seed MUST happen before serve (credentials sync).
#
# Usage: ./scripts/gate-auth-e2e.sh [playwright args...]
# Example: ./scripts/gate-auth-e2e.sh e2e/auth/rbac.dashboards.contract.spec.ts
set -euo pipefail

PORT=${AUTH_E2E_PORT:-3002}
DB_URL="postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public"

echo "═══ Auth E2E Gate ═══"

# ── 1. Seed (BEFORE serve — credentials must match DB) ──
echo "→ Seeding e2e DB..."
DATABASE_URL="$DB_URL" npx tsx scripts/seed-e2e-db.ts 2>&1 | tail -3
echo ""

# ── 2. Kill any stale process on $PORT ──
fuser -k "$PORT/tcp" 2>/dev/null || true
sleep 2

# ── 3. Build standalone (if not already built) ──
if [ ! -f .next/standalone/server.js ]; then
  echo "→ Building standalone..."
  npx next build
  cp -r .next/static .next/standalone/.next/static
fi

# ── 4. Serve standalone with full auth env ──
echo "→ Starting standalone on :${PORT} with auth env..."

# Source .env.local for AUTH_SECRET and other secrets
set -a
# shellcheck disable=SC1091
source .env.local 2>/dev/null || true
set +a

export DATABASE_URL="$DB_URL"
export NEXTAUTH_URL="http://127.0.0.1:${PORT}"
export HOSTNAME="127.0.0.1"
export PORT="$PORT"

node .next/standalone/server.js &
SERVER_PID=$!

# Wait for server
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "" "http://127.0.0.1:${PORT}/" 2>/dev/null; then
    break
  fi
  sleep 1
done

CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/")
if [ "$CODE" != "200" ]; then
  echo "✗ Standalone failed to start (HTTP $CODE)"
  kill "$SERVER_PID" 2>/dev/null
  exit 1
fi
echo "→ Standalone ready (HTTP $CODE)"
echo ""

# ── 5. Run specs ──
echo "→ Running auth e2e specs..."
CI=1 BASE_URL="http://127.0.0.1:${PORT}" \
  npx playwright test --config=playwright.auth.config.ts "${@}" --reporter=line
EXIT_CODE=$?

# ── 6. Cleanup ──
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true

exit $EXIT_CODE
