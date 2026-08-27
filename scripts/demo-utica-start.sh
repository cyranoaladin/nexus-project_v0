#!/usr/bin/env bash
# Démarrage local du démonstrateur salon UTICA 2026 (P2 §16, hotfix
# sécurité P1 review PR #174).
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
# La garde d'environnement (scripts/demo-utica-env-guard.sh) s'exécute EN
# PREMIER, avant même la vérification de l'artefact de build : la posture
# de sécurité ne doit jamais dépendre de l'état du build.
#
# Fail fast : ce script ne masque aucune erreur.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

# shellcheck source=demo-utica-env-guard.sh
source "${REPO_ROOT}/scripts/demo-utica-env-guard.sh"

if ! demo_utica_refuse_inherited_env; then
  exit 1
fi

if [ ! -f ".next/standalone/server.js" ]; then
  echo "ERREUR : .next/standalone/server.js introuvable." >&2
  echo "Construire l'artefact d'abord :" >&2
  echo "  npm run build" >&2
  echo "  npm run demo:utica" >&2
  exit 1
fi

# Doit vivre HORS du répertoire de release (lib/npc/storage-root.ts refuse
# au démarrage tout NPC_STORAGE_ROOT imbriqué sous le cwd du processus —
# "NPC storage root and active release must not overlap" — exactement le
# risque documenté au README §16 : une racine de stockage sous
# process.cwd() a failli partir en prod le 06/08/2026). ${REPO_ROOT} sert
# uniquement à dériver un nom stable, jamais comme emplacement réel.
DEMO_STORAGE_ROOT="${TMPDIR:-/tmp}/nexus-utica-demo-local-storage-$(basename "${REPO_ROOT}")"
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

demo_utica_export_local_env "${HOST}" "${PORT}" "${DEMO_STORAGE_ROOT}"

exec node .next/standalone/server.js
