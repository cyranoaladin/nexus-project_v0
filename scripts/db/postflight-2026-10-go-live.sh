#!/usr/bin/env bash
#
# Post-vol LECTURE SEULE du lot go-live 2026-10 (PR #337), à exécuter juste après
# `prisma migrate deploy`.
#
# Usage :
#   scripts/db/postflight-2026-10-go-live.sh legacy "$DATABASE_URL" <fichier-état-phase>
#   scripts/db/postflight-2026-10-go-live.sh legacy "$DATABASE_URL" --from-empty
#
# <fichier-état-phase> est celui écrit par le préflight (3e argument). La phase
# maths_progress_track attendue en sortie est POST_APPLIED (depuis PRE_PENDING ou
# une base vierge) ou ALREADY_RECONCILED ; l'empreinte pré-déploiement est refusée,
# toute migration inconnue / manquante / divergente ou tout objet altéré échoue.
#
# Codes de sortie : 0 PASS, 1 FAIL, 2 erreur d'usage.
set -euo pipefail

MODE="${1:-}"; URL="${2:-}"; PRIOR="${3:-}"
[ "$MODE" = legacy ] && [ -n "$URL" ] && [ -n "$PRIOR" ] || {
  echo "usage: $0 legacy <database-url> <fichier-état-phase|--from-empty>" >&2; exit 2; }
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$PRIOR" = --from-empty ]; then set -- --from-empty; else
  [ -f "$PRIOR" ] || { echo "FAIL   état de préflight introuvable: $PRIOR" >&2; exit 1; }
  set -- --state-in "$PRIOR"
fi
if out="$(node "$DIR/verify-migration-checksum-exceptions.mjs" postflight --database-url "$URL" "$@" 2>&1)"; then
  echo "PASS   phase maths_progress_track: $out"; echo "== POSTFLIGHT legacy: PASS =="
else
  echo "FAIL   phase maths_progress_track:"; echo "$out" | sed 's/^/       /'; echo "== POSTFLIGHT legacy: FAIL =="; exit 1
fi
