#!/usr/bin/env bash
# pre-commit-hook.sh — staged credential and sensitive-file gate

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
BLOCKED=false

BLOCKED_PATTERNS=(
  '\.pem$'
  '\.key$'
  '\.p12$'
  '\.pfx$'
  '\.env$'
  '\.env\.'
  'credentials\.json$'
  'parent\.json$'
  'student\.json$'
  'admin\.json$'
  'coach\.json$'
  'assistante\.json$'
  '\.bak$'
  'get-users-temp\.mjs$'
)

is_safe_env_example_path() {
  local file="$1"
  [[ "$file" =~ (^|/)\.env(\.[^/]+)*\.example$ ]]
}

mapfile -d '' -t staged_files < <(
  git diff --cached --name-only --diff-filter=AM -z 2>/dev/null || true
)

if [[ ${#staged_files[@]} -eq 0 ]]; then
  exit 0
fi

for file in "${staged_files[@]}"; do
  for pattern in "${BLOCKED_PATTERNS[@]}"; do
    if [[ "$file" =~ $pattern ]]; then
      if [[ "$pattern" == '\.env\.' ]] && is_safe_env_example_path "$file"; then
        continue
      fi
      echo -e "${RED}[BLOCKED]${NC} Fichier sensible détecté : $file"
      BLOCKED=true
    fi
  done
done

if ! node scripts/security/check-versioned-credentials.mjs --staged; then
  BLOCKED=true
fi

for file in "${staged_files[@]}"; do
  if [[ "$file" =~ prod-tree.*\.txt$|arborescence.*\.txt$|(^|/)storage/ ]]; then
    echo -e "${YELLOW}[WARN]${NC} Fichier inhabituel stagé : $file"
  fi
done

if [[ "$BLOCKED" == true ]]; then
  echo -e "${RED}Commit bloqué.${NC} Corrigez les éléments signalés avant de réessayer."
  exit 1
fi
