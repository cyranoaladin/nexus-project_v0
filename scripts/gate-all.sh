#!/usr/bin/env bash
# ── Unified Gate ──
# Runs ALL test lanes in sequence. Failure in any lane stops the gate.
#
# Invariant: the build and all lanes see ONLY the e2e database ($DB_URL).
# Next.js auto-loads .env.local — process.env overrides win, so we force
# DATABASE_URL="$DB_URL" at every step that touches the runtime.
# (Requalification: the A/B test proved the correlation, Codex corrected
#  the mechanism — .env.local is always loaded, the subshell did not
#  protect the build. The real invariant is "build sees ONLY the e2e DB".)
#
# Usage: ./scripts/gate-all.sh
# NOTE: gates from multiple worktrees must run IN SERIES — they share port and e2e DB.
set -uo pipefail

PORT=${AUTH_E2E_PORT:-3002}
DB_URL="postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public"
JEST_MIN=6221
PUBLIC_MIN=184
AUTH_MIN=42

# Normalize colored reporter output before parsing counters.
strip_ansi() { echo "$1" | sed -r 's/\x1B\[[0-9;]*[mK]//g'; }
# Extract "N passed"/"N failed" from the SUMMARY line (the last line containing "passed").
# Playwright flaky tests show intermediate "X failed" during execution then "X flaky" in summary.
extract_passed() { strip_ansi "$1" | grep -oP '\d+(?= passed)' | tail -1; }
extract_failed() {
  local summary
  summary=$(strip_ansi "$1" | grep "passed" | tail -1)
  echo "$summary" | grep -oP '\d+(?= failed)' || echo "0"
}
# Extract jest Tests: line specifically.
extract_jest_passed() { strip_ansi "$1" | grep "^Tests:" | grep -oP '\d+(?= passed)' || echo "0"; }
extract_jest_failed() { strip_ansi "$1" | grep "^Tests:" | grep -oP '\d+(?= failed)' || echo "0"; }
# Extract jest Test Suites: line — a suite-level crash (N failed) is ALSO a failure.
extract_jest_suites_failed() { strip_ansi "$1" | grep "^Test Suites:" | grep -oP '\d+(?= failed)' || echo "0"; }

# Wait for HTTP 200 from /api/health (decoupled from homepage rendering).
wait_for_server() {
  local base_url="$1"
  local attempts=0
  while [[ $attempts -lt 15 ]]; do
    local status
    status=$(curl --max-time 2 -s -o /dev/null -w "%{http_code}" "${base_url}/api/health" 2>/dev/null) || true
    if [[ "$status" == "200" ]]; then
      return 0
    fi
    sleep 1
    attempts=$((attempts + 1))
  done
  echo "✗ Server /api/health did not respond with 200 within 15s"
  return 1
}

echo "╔══════════════════════════════════════════╗"
echo "║           UNIFIED GATE                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ══════════════════════════════════════════════════════════
# PREFLIGHT CHECKS — fail fast on missing prerequisites
# ══════════════════════════════════════════════════════════
echo "━━━ Preflight checks ━━━"

# (0) Required tools
command -v curl &>/dev/null || { echo "✗ curl is required for healthchecks"; exit 1; }

# (a) .env.local must exist and provide NEXTAUTH_SECRET + NEXTAUTH_URL
#     DATABASE_URL is NOT required in .env.local — DB_URL is the single source of truth.
if [[ ! -f .env.local ]]; then
  echo "✗ .env.local not found. The standalone server requires it."
  echo "  Copy it from the main repo if running in a worktree:"
  echo "  cp /path/to/nexus-project_v0/.env.local ."
  exit 1
fi

# (a-bis) Safety: if .env.local contains a DATABASE_URL, it must be local.
# A remote host would mean the build or lanes could hit a non-e2e database.
ENV_LOCAL_DB=$(grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=' .env.local 2>/dev/null | head -1 | sed -E 's/^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=//' || true)
if [[ -n "$ENV_LOCAL_DB" ]]; then
  # Extract host from DATABASE_URL: after @ or ://, before : or /
  DB_HOST=$(echo "$ENV_LOCAL_DB" | sed -E 's|.*@([^:/]+).*|\1|; s|.*://([^:/]+).*|\1|')
  if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "::1" ]]; then
    echo "✓ .env.local DATABASE_URL points to $DB_HOST (safe)"
  else
    echo "✗ ABORT: .env.local DATABASE_URL points to host '$DB_HOST' — not localhost."
    echo "  This is dangerous — the build auto-loads .env.local and could hit production."
    echo "  Either remove DATABASE_URL from .env.local or point it to localhost/127.0.0.1."
    exit 1
  fi
fi

# (b) E2E DB safety: the DB_URL used for e2e MUST point to 127.0.0.1:5435/nexus_e2e
if [[ "$DB_URL" != *"127.0.0.1:5435/nexus_e2e"* ]]; then
  echo "✗ SAFETY: DB_URL for e2e lanes must point to 127.0.0.1:5435/nexus_e2e"
  echo "  Got: $DB_URL"
  exit 1
fi
echo "✓ E2E DB URL is safe (127.0.0.1:5435/nexus_e2e)"

# (c) E2E DB availability: provision pgvector container if port 5435 is not responding
# pg_isready fallback: if host binary absent, try docker exec on the container
pg_check() {
  if command -v pg_isready &>/dev/null; then
    pg_isready -h 127.0.0.1 -p 5435 -q 2>/dev/null
  else
    docker exec nexus-e2e-pg pg_isready -q 2>/dev/null
  fi
}
if ! pg_check; then
  echo "→ Port 5435 not responding — attempting to start pgvector container..."
  if command -v docker &>/dev/null; then
    docker rm -f nexus-e2e-pg 2>/dev/null || true
    envfile=$(mktemp)
    # docker postgres image requires POSTGRES_PASSWORD env var
    # Default password for disposable e2e container — never a real credential
    printf 'POSTGRES_PASSWORD=postgres\nPOSTGRES_DB=nexus_e2e\n' > "$envfile"
    docker run -d --name nexus-e2e-pg \
      --env-file "$envfile" \
      -p 127.0.0.1:5435:5432 \
      pgvector/pgvector:pg16 >/dev/null 2>&1
    rm -f "$envfile"
    # Wait for PostgreSQL to be ready (30 attempts × 1s)
    retries=0
    while [[ $retries -lt 30 ]]; do
      if pg_check; then
        break
      fi
      sleep 1
      retries=$((retries + 1))
    done
    if ! pg_check; then
      echo "✗ PostgreSQL e2e container started but not responding after 30s"
      exit 1
    fi
    echo "✓ pgvector container started on port 5435"
  else
    echo "✗ PostgreSQL e2e not available on port 5435 and docker not found"
    echo "  Start it manually: see scripts/gate-all.sh for the docker run command"
    exit 1
  fi
else
  echo "✓ PostgreSQL e2e responding on port 5435"
fi

echo ""

# ══════════════════════════════════════════════════════════
# GATE LANES
# ══════════════════════════════════════════════════════════

# ── Clean dependency baseline ──
echo "━━━ Dependency baseline ━━━"
if ! npm ci; then
  echo "✗ npm ci failed"
  exit 1
fi
echo "✓ npm ci completed"
echo ""

# Validate required vars from .env.local using node dotenv (AFTER npm ci — dotenv is a dependency)
ENV_CHECK=$(node -e "
  require('dotenv').config({ path: '.env.local' });
  const required = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) { console.error('Missing: ' + missing.join(', ')); process.exit(1); }
" 2>&1) || {
  echo "✗ .env.local missing required vars: $ENV_CHECK"
  exit 1
}
echo "✓ .env.local validated (NEXTAUTH_SECRET, NEXTAUTH_URL present)"
echo ""

# (d) Drop+create the e2e database for a deterministic starting state.
# Terminate active connections first (previous gate runs may leave sessions open).
echo "→ Resetting e2e database..."
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5435 -U postgres -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='nexus_e2e' AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true
if command -v dropdb &>/dev/null; then
  PGPASSWORD=postgres dropdb -h 127.0.0.1 -p 5435 -U postgres --if-exists nexus_e2e
  PGPASSWORD=postgres createdb -h 127.0.0.1 -p 5435 -U postgres nexus_e2e
else
  docker exec nexus-e2e-pg bash -c "PGPASSWORD=postgres psql -U postgres -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='nexus_e2e' AND pid <> pg_backend_pid();\" 2>/dev/null; PGPASSWORD=postgres dropdb -U postgres --if-exists nexus_e2e && PGPASSWORD=postgres createdb -U postgres nexus_e2e"
fi || {
  echo "✗ Failed to reset nexus_e2e database"
  exit 1
}
echo "✓ nexus_e2e database reset"
# Workaround: P1017 "Server has closed the connection" after pg_terminate_backend.
# Empirical — not diagnosed. If recurrence: retry migrate or check container health
# post-reset, instead of increasing the sleep.
sleep 1

# (e) Apply migrations on clean database (AFTER npm ci for locked Prisma version)
echo "→ Running migrations..."
MIGRATE_OUTPUT=$(DATABASE_URL="$DB_URL" npx prisma migrate deploy 2>&1) || {
  echo "✗ prisma migrate deploy failed:"
  echo "$MIGRATE_OUTPUT" | tail -10
  exit 1
}
echo "✓ Migrations applied"
echo ""

# ── Lane 1: Jest ──
echo "━━━ Lane 1: Jest ━━━"
JEST_OUTPUT=$(DATABASE_URL="$DB_URL" npx jest --config jest.config.js --no-cache 2>&1) || true
JEST_PASSED=$(extract_jest_passed "$JEST_OUTPUT")
JEST_FAILED=$(extract_jest_failed "$JEST_OUTPUT")
JEST_PASSED=${JEST_PASSED:-0}
JEST_FAILED=${JEST_FAILED:-0}
JEST_SUITES_FAILED=$(extract_jest_suites_failed "$JEST_OUTPUT")
JEST_SUITES_FAILED=${JEST_SUITES_FAILED:-0}
# Show summary + any FAIL lines for diagnostics
echo "$JEST_OUTPUT" | grep -E "^(FAIL |Test Suites:|Tests:)" | tail -15
echo ""
if [[ "${JEST_FAILED:-0}" -gt 0 || "${JEST_SUITES_FAILED:-0}" -gt 0 ]]; then
  echo "✗ Jest has failures (tests: $JEST_FAILED, suites: $JEST_SUITES_FAILED)"
  exit 1
fi
if [[ "${JEST_PASSED:-0}" -lt "$JEST_MIN" ]]; then
  echo "✗ Jest passed count below floor: ${JEST_PASSED:-0} < $JEST_MIN"
  exit 1
fi
echo "✓ Jest: $JEST_PASSED passed (min $JEST_MIN)"
echo ""

# ── Build standalone (shared by both e2e lanes) ──
# Force DATABASE_URL to the e2e DB so any prerender hits the migrated e2e base,
# never a stale DATABASE_URL from .env.local (process.env wins over .env files).
echo "━━━ Building standalone ━━━"
fuser -k "$PORT/tcp" 2>/dev/null || true
sleep 2
DATABASE_URL="$DB_URL" npx next build > /tmp/nexus-gate-build.log 2>&1 || {
  echo "✗ next build failed:"
  tail -10 /tmp/nexus-gate-build.log
  exit 1
}
tail -3 /tmp/nexus-gate-build.log
if [[ ! -f .next/standalone/server.js ]]; then
  echo "✗ standalone build missing — check next.config output: standalone"
  exit 1
fi
cp -r .next/static .next/standalone/.next/static
echo "✓ Standalone build ready"
echo ""

# ── Lane 2: E2E public ──
echo "━━━ Lane 2: E2E public ━━━"
# Extract NEXTAUTH_SECRET and NEXTAUTH_URL from .env.local (no eval — one export per variable)
export NEXTAUTH_SECRET="$(node -p "require('dotenv').config({path:'.env.local'});process.env.NEXTAUTH_SECRET||''")"
export NEXTAUTH_URL="$(node -p "require('dotenv').config({path:'.env.local'});process.env.NEXTAUTH_URL||''")"
# DB_URL is set by THIS script only — override any leaked value
export DATABASE_URL="$DB_URL"
export NEXTAUTH_URL="http://localhost:${PORT}"
export HOSTNAME="localhost"
export PORT="$PORT"
node .next/standalone/server.js > /dev/null 2>&1 &
PUB_PID=$!

if ! wait_for_server "http://localhost:${PORT}"; then
  kill "$PUB_PID" 2>/dev/null || true
  exit 1
fi

PUBLIC_OUTPUT=$(CI=1 NODE_OPTIONS="--conditions=react-server" BASE_URL="http://localhost:${PORT}" npx playwright test --config=playwright.config.ts --reporter=line 2>&1)
PW_PUBLIC_EXIT=${PIPESTATUS[0]:-$?}
PUBLIC_PASSED=$(extract_passed "$PUBLIC_OUTPUT")
PUBLIC_FAILED=$(extract_failed "$PUBLIC_OUTPUT")
PUBLIC_PASSED=${PUBLIC_PASSED:-0}
PUBLIC_FAILED=${PUBLIC_FAILED:-0}
echo "$PUBLIC_OUTPUT" | tail -3

kill "$PUB_PID" 2>/dev/null || true
wait "$PUB_PID" 2>/dev/null || true

if [[ "$PW_PUBLIC_EXIT" -ne 0 && "${PUBLIC_FAILED:-0}" -gt 0 ]]; then
  echo "✗ E2E public has failures (exit=$PW_PUBLIC_EXIT, failed=$PUBLIC_FAILED)"
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

export DATABASE_URL="$DB_URL"
export NEXTAUTH_URL="http://localhost:${PORT}"
export HOSTNAME="localhost"
export PORT="$PORT"

node .next/standalone/server.js > /dev/null 2>&1 &
AUTH_PID=$!

if ! wait_for_server "http://localhost:${PORT}"; then
  kill "$AUTH_PID" 2>/dev/null || true
  exit 1
fi

AUTH_OUTPUT=$(CI=1 NODE_OPTIONS="--conditions=react-server" BASE_URL="http://localhost:${PORT}" npx playwright test --config=playwright.auth.config.ts --reporter=line 2>&1)
PW_AUTH_EXIT=${PIPESTATUS[0]:-$?}
AUTH_PASSED=$(extract_passed "$AUTH_OUTPUT")
AUTH_FAILED=$(extract_failed "$AUTH_OUTPUT")
AUTH_PASSED=${AUTH_PASSED:-0}
AUTH_FAILED=${AUTH_FAILED:-0}
echo "$AUTH_OUTPUT" | tail -5

kill "$AUTH_PID" 2>/dev/null || true
wait "$AUTH_PID" 2>/dev/null || true

if [[ "$PW_AUTH_EXIT" -ne 0 && "${AUTH_FAILED:-0}" -gt 0 ]]; then
  echo "✗ E2E auth has failures (exit=$PW_AUTH_EXIT, failed=$AUTH_FAILED)"
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
