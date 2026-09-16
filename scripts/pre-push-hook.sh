#!/usr/bin/env bash
# pre-push-hook.sh — seconde barrière avant que du contenu de diagnostic confidentiel
# devienne public. Un dépôt public est public dès le push : la CI, qui s'exécute après,
# arrive trop tard pour empêcher l'exposition elle-même — elle ne sert qu'à la détecter.
# Ce hook juge l'arbre exact de chaque ref poussée (via --ref <sha>), pas seulement le
# répertoire de travail courant, pour attraper aussi un commit créé sans ce hook
# (autre poste, --no-verify, outil tiers).
#
# Installé en .git/hooks/pre-push (copie de ce fichier). Reçoit sur stdin une ligne par
# ref : "<local ref> <local sha1> <remote ref> <remote sha1>".

set -euo pipefail

RED='\033[0;31m'
NC='\033[0m'
BLOCKED=false
ZERO_SHA='0000000000000000000000000000000000000000'

while read -r local_ref local_sha1 remote_ref remote_sha1; do
  if [[ "$local_sha1" == "$ZERO_SHA" ]]; then
    continue # suppression de ref côté distant : rien à vérifier
  fi
  if ! node scripts/security/check-assessment-confidentiality.mjs --ref "$local_sha1"; then
    echo -e "${RED}[BLOCKED]${NC} $local_ref ($local_sha1) porte du contenu de diagnostic confidentiel."
    BLOCKED=true
  fi
done

if [[ "$BLOCKED" == true ]]; then
  echo -e "${RED}Push bloqué.${NC} Ce contenu doit vivre dans nexus-diagnostics-private, jamais ici."
  exit 1
fi
