#!/usr/bin/env bash
# ── Unified Gate ──
# Runs ALL test lanes in sequence. Failure in any lane stops the gate.
#
# Lane 1: Jest (unit + integration)
# Lane 2: E2E public (playwright.config.ts — no auth required)
# Lane 3: E2E auth (playwright.auth.config.ts — real auth via seed + standalone)
#
# Usage: ./scripts/gate-all.sh
set -uo pipefail

PORT=${AUTH_E2E_PORT:-3002}
DB_URL="postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public"
JEST_MIN=6215
PUBLIC_MIN=184
AUTH_MIN=38

# Normalize colored reporter output before parsing counters.
strip_ansi() { echo "$1" | sed -r 's/\x1B\[[0-9;]*[mK]//g'; }
# Extract "N passed"/"N failed" from test output (last occurrence).
extract_passed() { strip_ansi "$1" | grep -oP '\d+(?= passed)' | tail -1; }
extract_failed() { strip_ansi "$1" | grep -oP '\d+(?= failed)' | tail -1; }
# Extract jest Tests: line specifically.
extract_jest_passed() { strip_ansi "$1" | grep "^Tests:" | grep -oP '\d+(?= passed)' || echo "0"; }
extract_jest_failed() { strip_ansi "$1" | grep "^Tests:" | grep -oP '\d+(?= failed)' || echo "0"; }

echo "╔══════════════════════════════════════════╗"
echo "║           UNIFIED GATE                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Lane 1: Jest ──
echo "━━━ Lane 1: Jest ━━━"
JEST_OUTPUT=$(npx jest --config jest.config.js --no-cache 2>&1) || true
JEST_PASSED=$(extract_jest_passed "$JEST_OUTPUT")
JEST_FAILED=$(extract_jest_failed "$JEST_OUTPUT")
JEST_PASSED=${JEST_PASSED:-0}
JEST_FAILED=${JEST_FAILED:-0}
echo "$JEST_OUTPUT" | tail -5
echo ""
if [[ "${JEST_FAILED:-0}" -gt 0 ]]; then
  echo "✗ Jest has failures"
  exit 1
fi
if [[ "${JEST_PASSED:-0}" -lt "$JEST_MIN" ]]; then
  echo "✗ Jest passed count below floor: ${JEST_PASSED:-0} < $JEST_MIN"
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
HOSTNAME=localhost PORT="$PORT" node .next/standalone/server.js > /dev/null 2>&1 &
PUB_PID=$!
sleep 3

PUBLIC_OUTPUT=$(CI=1 BASE_URL="http://localhost:${PORT}" npx playwright test --config=playwright.config.ts --reporter=line 2>&1) || true
PUBLIC_PASSED=$(extract_passed "$PUBLIC_OUTPUT")
PUBLIC_FAILED=$(extract_failed "$PUBLIC_OUTPUT")
PUBLIC_PASSED=${PUBLIC_PASSED:-0}
PUBLIC_FAILED=${PUBLIC_FAILED:-0}
echo "$PUBLIC_OUTPUT" | tail -3

kill "$PUB_PID" 2>/dev/null || true
wait "$PUB_PID" 2>/dev/null || true

if [[ "${PUBLIC_FAILED:-0}" -gt 0 ]]; then
  echo "✗ E2E public has failures"
  exit 1
fi
if [[ "${PUBLIC_PASSED:-0}" -lt "$PUBLIC_MIN" ]]; then
  echo "✗ E2E public passed count below floor: ${PUBLIC_PASSED:-0} < $PUBLIC_MIN"
  exit 1
fi
echo "✓ E2E public: $PUBLIC_PASSED passed (min $PUBLIC_MIN)"
echo ""

# ── Lane 3: E2E auth ──
echo "━━━ Lane 3: E2E auth (seed + real auth) ━━━"

echo "→ Seeding e2e DB..."
DATABASE_URL="$DB_URL" npx tsx scripts/seed-e2e-db.ts 2>&1 | tail -2

fuser -k "$PORT/tcp" 2>/dev/null || true
sleep 2

set -a
# shellcheck disable=SC1091
source .env.local 2>/dev/null || true
set +a
export DATABASE_URL="$DB_URL"
export NEXTAUTH_URL="http://localhost:${PORT}"
export HOSTNAME="localhost"
export PORT="$PORT"

node .next/standalone/server.js > /dev/null 2>&1 &
AUTH_PID=$!
sleep 3

AUTH_OUTPUT=$(CI=1 BASE_URL="http://localhost:${PORT}" npx playwright test --config=playwright.auth.config.ts --reporter=line 2>&1) || true
AUTH_PASSED=$(extract_passed "$AUTH_OUTPUT")
AUTH_FAILED=$(extract_failed "$AUTH_OUTPUT")
AUTH_PASSED=${AUTH_PASSED:-0}
AUTH_FAILED=${AUTH_FAILED:-0}
echo "$AUTH_OUTPUT" | tail -5

kill "$AUTH_PID" 2>/dev/null || true
wait "$AUTH_PID" 2>/dev/null || true

if [[ "${AUTH_FAILED:-0}" -gt 0 ]]; then
  echo "✗ E2E auth has failures"
  exit 1
fi
if [[ "${AUTH_PASSED:-0}" -lt "$AUTH_MIN" ]]; then
  echo "✗ E2E auth passed count below floor: ${AUTH_PASSED:-0} < $AUTH_MIN"
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
