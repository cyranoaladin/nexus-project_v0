#!/usr/bin/env bash
# ── Unified Gate ──
# Runs ALL test lanes in sequence. Failure in any lane stops the gate.
#
# Lane 1: Jest (unit + integration)
# Lane 2: E2E public (playwright.config.ts — no auth required)
# Lane 3: E2E auth (playwright.auth.config.ts — real auth via seed + standalone)
#
# Plancher: 6215 jest + 184 public + 9 auth = 6408 total (grows as specs are promoted)
#
# Usage: ./scripts/gate-all.sh
set -euo pipefail

PORT=${AUTH_E2E_PORT:-3002}
DB_URL="postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public"
JEST_MIN=6215
PUBLIC_MIN=184
AUTH_MIN=14

echo "╔══════════════════════════════════════════╗"
echo "║           UNIFIED GATE                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Lane 1: Jest ──
echo "━━━ Lane 1: Jest ━━━"
JEST_OUTPUT=$(npx jest --config jest.config.js --no-cache 2>&1)
JEST_PASSED=$(echo "$JEST_OUTPUT" | grep -oP 'Tests:\s+\d+ skipped,\s+\K\d+(?= passed)' || echo "$JEST_OUTPUT" | grep -oP 'Tests:\s+\K\d+(?= passed)' || echo "0")
JEST_FAILED=$(echo "$JEST_OUTPUT" | grep -oP '\d+(?= failed)' || echo "0")
echo "$JEST_OUTPUT" | tail -5
echo ""
if [ "$JEST_FAILED" != "0" ] && [ "$JEST_FAILED" != "" ]; then
  echo "✗ Jest: $JEST_FAILED failures"
  exit 1
fi
echo "✓ Jest: $JEST_PASSED passed (min $JEST_MIN)"
echo ""

# ── Build standalone (shared by both e2e lanes) ──
echo "━━━ Building standalone ━━━"
fuser -k "$PORT/tcp" 2>/dev/null || true
sleep 2
npx next build 2>&1 | tail -3
cp -r .next/static .next/standalone/.next/static
echo ""

# ── Lane 2: E2E public ──
echo "━━━ Lane 2: E2E public ━━━"
HOSTNAME=127.0.0.1 PORT="$PORT" node .next/standalone/server.js &
PUB_PID=$!
sleep 3

PUBLIC_OUTPUT=$(CI=1 BASE_URL="http://127.0.0.1:${PORT}" npx playwright test --config=playwright.config.ts --reporter=line 2>&1)
PUBLIC_EXIT=$?
PUBLIC_PASSED=$(echo "$PUBLIC_OUTPUT" | grep -oP '\d+(?= passed)' || echo "0")
echo "$PUBLIC_OUTPUT" | tail -3

kill "$PUB_PID" 2>/dev/null; wait "$PUB_PID" 2>/dev/null || true

if [ "$PUBLIC_EXIT" -ne 0 ]; then
  echo "✗ E2E public: exit $PUBLIC_EXIT"
  exit 1
fi
echo "✓ E2E public: $PUBLIC_PASSED passed (min $PUBLIC_MIN)"
echo ""

# ── Lane 3: E2E auth ──
echo "━━━ Lane 3: E2E auth (seed + real auth) ━━━"

# Seed BEFORE serve
echo "→ Seeding e2e DB..."
DATABASE_URL="$DB_URL" npx tsx scripts/seed-e2e-db.ts 2>&1 | tail -2

fuser -k "$PORT/tcp" 2>/dev/null || true
sleep 2

# Serve with full auth env
set -a
# shellcheck disable=SC1091
source .env.local 2>/dev/null || true
set +a
export DATABASE_URL="$DB_URL"
export NEXTAUTH_URL="http://127.0.0.1:${PORT}"
export HOSTNAME="127.0.0.1"
export PORT="$PORT"

node .next/standalone/server.js &
AUTH_PID=$!
sleep 3

AUTH_OUTPUT=$(CI=1 BASE_URL="http://127.0.0.1:${PORT}" npx playwright test --config=playwright.auth.config.ts --reporter=line 2>&1)
AUTH_EXIT=$?
AUTH_PASSED=$(echo "$AUTH_OUTPUT" | grep -oP '\d+(?= passed)' || echo "0")
echo "$AUTH_OUTPUT" | tail -3

kill "$AUTH_PID" 2>/dev/null; wait "$AUTH_PID" 2>/dev/null || true

if [ "$AUTH_EXIT" -ne 0 ]; then
  echo "✗ E2E auth: exit $AUTH_EXIT"
  exit 1
fi
echo "✓ E2E auth: $AUTH_PASSED passed (min $AUTH_MIN)"
echo ""

# ── Summary ──
TOTAL=$((JEST_PASSED + PUBLIC_PASSED + AUTH_PASSED))
MIN_TOTAL=$((JEST_MIN + PUBLIC_MIN + AUTH_MIN))

echo "╔══════════════════════════════════════════╗"
echo "║  GATE SUMMARY                            ║"
echo "╠══════════════════════════════════════════╣"
printf "║  Jest:        %5s passed (min %s)    ║\n" "$JEST_PASSED" "$JEST_MIN"
printf "║  E2E public:  %5s passed (min %s)      ║\n" "$PUBLIC_PASSED" "$PUBLIC_MIN"
printf "║  E2E auth:    %5s passed (min %s)        ║\n" "$AUTH_PASSED" "$AUTH_MIN"
echo "╠══════════════════════════════════════════╣"
printf "║  TOTAL:       %5s (plancher %s)     ║\n" "$TOTAL" "$MIN_TOTAL"
echo "╚══════════════════════════════════════════╝"

if [ "$TOTAL" -lt "$MIN_TOTAL" ]; then
  echo "✗ GATE FAILED: $TOTAL < $MIN_TOTAL"
  exit 1
fi

echo "✓ GATE PASSED"
