#!/usr/bin/env bash
# Démarrage local du démonstrateur salon UTICA 2026 (P2 §16).
#
# N'utilise QUE l'artefact de production réel (.next/standalone/server.js) —
# jamais `next dev`, jamais une deuxième méthode de build. Active
# explicitement UTICA_DEMO_ENABLED ; toutes les autres variables ci-dessous
# sont exigées par le démarrage de l'application elle-même (hook
# instrumentation.ts), pas par le démonstrateur — elles pointent vers des
# valeurs strictement locales/jetables, jamais vers la production, et
# aucune n'est nécessaire pour que les pages /demo/utica-2026 s'affichent
# (aucun appel OpenAI, RAG, ni écriture DB réel n'a lieu sur ces routes).
#
# Fail fast : ce script ne masque aucune erreur.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

if [ ! -f ".next/standalone/server.js" ]; then
  echo "ERREUR : .next/standalone/server.js introuvable." >&2
  echo "Construire l'artefact d'abord :" >&2
  echo "  npm run build" >&2
  echo "  npm run demo:utica" >&2
  exit 1
fi

DEMO_STORAGE_ROOT="${REPO_ROOT}/.demo-local-storage"
mkdir -p "${DEMO_STORAGE_ROOT}/npc" "${DEMO_STORAGE_ROOT}/documents"
chmod 755 "${DEMO_STORAGE_ROOT}/npc" "${DEMO_STORAGE_ROOT}/documents"

PORT="${PORT:-3000}"
HOST="127.0.0.1"

echo "Démonstrateur UTICA 2026 — démarrage local"
echo "  Artefact : .next/standalone/server.js"
echo "  URL      : http://${HOST}:${PORT}/demo/utica-2026"
echo ""

export UTICA_DEMO_ENABLED=true
export HOSTNAME="${HOST}"
export PORT="${PORT}"

# Requis par instrumentation.ts au démarrage — valeurs locales/jetables
# uniquement, jamais la production. Voir docs/demo/utica-2026-runbook.md.
export NPC_STORAGE_ROOT="${DEMO_STORAGE_ROOT}/npc"
export DOCUMENT_STORAGE_ROOT="${DEMO_STORAGE_ROOT}/documents"
export DATABASE_URL="${DATABASE_URL:-postgresql://127.0.0.1:5432/nexus_demo_local_disposable}"
export NEXTAUTH_URL="http://${HOST}:${PORT}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-utica-demo-local-only-secret-0123456789ab}"
export RATE_LIMIT_BACKEND="redis"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export RATE_LIMIT_KEY_SECRET="${RATE_LIMIT_KEY_SECRET:-utica-demo-local-only-ratelimit-secret-0123456789}"
export RATE_LIMIT_KEY_NAMESPACE="utica-demo-local"
export RATE_LIMIT_TRUST_PROXY_HOPS=1
# L'artefact standalone est compilé en mode production (NODE_ENV figé au
# build) : le worker de mails doit être explicitement activé au démarrage,
# même s'il ne sert à rien pour les routes /demo/utica-2026 elles-mêmes.
export EMAIL_OUTBOX_WORKER_ENABLED=true
export EMAIL_OUTBOX_ENCRYPTION_KEY="${EMAIL_OUTBOX_ENCRYPTION_KEY:-utica-demo-local-only-outbox-key-0123456789ab}"
export SMTP_HOST="${SMTP_HOST:-localhost}"
export SMTP_FROM="${SMTP_FROM:-demo@localhost}"

exec node .next/standalone/server.js
