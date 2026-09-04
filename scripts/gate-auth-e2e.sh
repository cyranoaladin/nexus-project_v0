#!/usr/bin/env bash
# ── Auth E2E Gate ──
# Seeds the e2e DB then runs auth-requiring specs against standalone with real auth.
# Order: seed → serve → test. Seed MUST happen before serve (credentials sync).
#
# IMPORTANT: HOSTNAME=localhost (not 127.0.0.1) to avoid origin mismatch.
# Next.js resolves 127.0.0.1 → localhost in redirect URLs, causing cookie domain
# mismatch in the browser. With HOSTNAME=localhost, redirects are relative paths
# and cookies stay on the same origin.
#
# Usage: ./scripts/gate-auth-e2e.sh [playwright args...]
set -euo pipefail

PORT=${AUTH_E2E_PORT:-3002}
DB_URL="postgresql://postgres:postgres@127.0.0.1:5435/nexus_e2e?schema=public"
export E2E_DISPOSABLE_STACK=1

# ── Alias local du Redis jetable ──
# La reinitialisation du rate limit exige un hote nomme EXACTEMENT `redis-e2e`
# (e2e/helpers/rate-limit.ts refuse toute autre cible). En CI, c'est un service
# du reseau Compose : le nom resout seul. Hors CI, aucun resolveur ne connait ce
# nom, et `client.connect()` attend indefiniment — le test expire sans message,
# avant meme sa premiere action. On fournit donc l'alias, au lieu d'assouplir la
# garde qui protege le Redis de production. Aucun effet en CI, ou le test
# `getent` reussit deja.
if ! getent hosts redis-e2e >/dev/null 2>&1; then
  NEXUS_E2E_HOSTALIASES="${TMPDIR:-/tmp}/nexus-e2e-hostaliases"
  printf 'redis-e2e localhost\n' > "$NEXUS_E2E_HOSTALIASES"
  export HOSTALIASES="$NEXUS_E2E_HOSTALIASES"
fi
HOST="localhost"

echo "═══ Auth E2E Gate ═══"

# ── 1. Seed (BEFORE serve — credentials must match DB) ──
echo "→ Seeding e2e DB..."
DATABASE_URL="$DB_URL" npx tsx scripts/seed-e2e-db.ts 2>&1 | tail -3
echo ""

# ── 2. Kill any stale process on $PORT ──
fuser -k "$PORT/tcp" 2>/dev/null || true
sleep 2

# ── 3. Build standalone (if not already built) ──
# On appelle la MEME cible que la CI (`npm run build:e2e`) plutot que de
# reassembler un build partiel a la main. Ce script enchainait auparavant
# `next build` puis la copie des assets publics : il manquait donc les etapes
# suivantes de la cible, notamment `copy-resource-artifacts`, sans quoi les
# packs d'evaluation sont absents du standalone et `POST /api/bilans/attempts`
# repond 404 alors que la CI est verte. Toute etape ajoutee a `build:e2e` est
# desormais reprise ici par construction, au lieu de creer une nouvelle
# divergence locale/CI silencieuse a chaque evolution.
if [ ! -f .next/standalone/server.js ]; then
  echo "→ Building standalone..."
  npx next build
  cp -r .next/static .next/standalone/.next/static
  # Les etapes de PRODUCTION d'artefact de `npm run build:e2e` sont reprises
  # ici une a une. Sans elles, le standalone sert une application amputee et la
  # voie diverge silencieusement de la CI :
  #   - assets publics : sinon /planning et tout contenu de public/ font 404 ;
  #   - ressources ARIA : sinon les programmes manquent au standalone.
  node scripts/copy-public-assets.js
  npx tsx scripts/aria/copy-resource-artifacts.ts
  # Les trois dernieres etapes de `build:e2e` (validate-next-traces,
  # audit-production-artifact, verify-standalone-artifact) sont des controles
  # d'artefact de release : ils refusent tout chemin sous `.worktrees` et ne
  # peuvent donc pas s'executer ici. Ils restent joues par la CI, sur une copie
  # normale du depot — c'est la leur place, et elle n'est pas affaiblie.
fi

# ── 4. Serve standalone with full auth env ──
echo "→ Starting standalone on ${HOST}:${PORT} with auth env..."

# Source .env.local for AUTH_SECRET and other secrets
set -a
# shellcheck disable=SC1091
source .env.local 2>/dev/null || true
set +a

# ── Fixture ARIA ──
# Les specs e2e/aria/* dialoguent avec un fournisseur de modele et de RAG
# factice (scripts/e2e/aria-fixture-provider.ts). En CI, c'est le service
# `aria-fixture-e2e` du compose. Hors CI, on lance le MEME script avec le meme
# contrat d'environnement : sans lui, ces specs echouent sur
# ARIA_E2E_FIXTURE_CLIENT_CONFIGURATION_INVALID et entrainent l'abandon des
# tests suivants de leurs fichiers. On reconstitue le service plutot que
# d'ecarter les specs de la voie.
FIXTURE_PID=""
ARIA_FIXTURE_URL="${ARIA_E2E_FIXTURE_BASE_URL:-http://127.0.0.1:4010}"
if [ -n "${ARIA_E2E_FIXTURE_ADMIN_TOKEN:-}" ] \
   && ! curl -sf -o /dev/null "${ARIA_FIXTURE_URL}/health" 2>/dev/null; then
  echo "→ Starting ARIA e2e fixture provider..."
  ARIA_E2E_FIXTURE_HOST=127.0.0.1 ARIA_E2E_FIXTURE_PORT=4010 \
    npx tsx scripts/e2e/aria-fixture-provider.ts > /tmp/nexus-aria-fixture.log 2>&1 &
  FIXTURE_PID=$!
  for _ in $(seq 1 20); do
    curl -sf -o /dev/null "${ARIA_FIXTURE_URL}/health" 2>/dev/null && break
    sleep 1
  done
fi

export DATABASE_URL="$DB_URL"
export NEXTAUTH_URL="http://${HOST}:${PORT}"
export HOSTNAME="$HOST"
export PORT="$PORT"

node .next/standalone/server.js &
SERVER_PID=$!

# Wait for server
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "" "http://${HOST}:${PORT}/" 2>/dev/null; then
    break
  fi
  sleep 1
done

CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${HOST}:${PORT}/")
if [ "$CODE" != "200" ]; then
  echo "✗ Standalone failed to start (HTTP $CODE)"
  kill "$SERVER_PID" 2>/dev/null
  exit 1
fi
echo "→ Standalone ready (HTTP $CODE)"
echo ""

# ── 5. Run specs ──
# La configuration est surchargeable : l'environnement monte ici (seed, build
# standalone, serveur avec auth reelle et middleware reel) est exactement celui
# dont la voie globale a besoin. La surcharger evite d'entretenir une seconde
# orchestration qui divergerait de celle-ci. Defaut inchange.
CONFIG="${E2E_GATE_CONFIG:-playwright.auth.config.ts}"
echo "→ Running e2e specs (config: ${CONFIG})..."
CI=1 BASE_URL="http://${HOST}:${PORT}" \
  npx playwright test --config="${CONFIG}" "${@}" --reporter=line
EXIT_CODE=$?

# ── 6. Cleanup ──
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true
# Arret par PID capture au demarrage : jamais par nom de processus.
if [ -n "${FIXTURE_PID:-}" ]; then
  kill "$FIXTURE_PID" 2>/dev/null || true
  wait "$FIXTURE_PID" 2>/dev/null || true
fi

exit $EXIT_CODE
