#!/bin/bash

set -euo pipefail

cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo ""
    echo "⚠️  Le script a échoué (code $exit_code). Vérifie les logs ci-dessus."
  fi
}
trap cleanup EXIT

echo "❯ Vérification des statuts git"
git status -sb

echo "❯ Ajout des fichiers modifiés"
git add app/academies-hiver/page.tsx app/api/reservation/route.ts app/layout.tsx

echo "❯ Dernier commit"
git log -1 --oneline

echo "❯ Push vers origin/main"
if ! git push origin main; then
  echo "‼️ git push a échoué (vérifie la connectivité ou les identifiants)."
  exit 1
fi

echo ""
echo "✅ Push réussi."
