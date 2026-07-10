#!/usr/bin/env bash
# =============================================================================
# pre-commit-hook.sh — Blocage de commits de secrets
# Nexus Réussite — Audit 2026-04-19
#
# Installation :
#   cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BLOCKED=false

# ─── Patterns de fichiers bloqués ────────────────────────────────────────────
BLOCKED_PATTERNS=(
  "\.pem$"
  "\.key$"
  "\.p12$"
  "\.pfx$"
  "\.env$"
  "\.env\."
  "credentials\.json$"
  "parent\.json$"
  "student\.json$"
  "admin\.json$"
  "coach\.json$"
  "assistante\.json$"
  "\.bak$"
  "get-users-temp\.mjs$"
)

# ─── Vérification des fichiers stagés ────────────────────────────────────────
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [[ -z "$STAGED_FILES" ]]; then
  exit 0
fi

# Filtrer les fichiers supprimés (ne vérifier que les fichiers ajoutés/modifiés)
STAGED_ADDED_MODIFIED=$(git diff --cached --name-only --diff-filter=AM 2>/dev/null || true)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  MATCHES=$(echo "$STAGED_ADDED_MODIFIED" | grep -E "$pattern" || true)
  if [[ -n "$MATCHES" ]]; then
    echo -e "${RED}[BLOCKED]${NC} Fichier(s) sensible(s) détecté(s) :"
    echo "$MATCHES" | while read -r f; do
      echo -e "  ${RED}✗${NC} $f  (pattern: $pattern)"
    done
    BLOCKED=true
  fi
done

# ─── Vérification de patterns de secrets dans le contenu ─────────────────────
SECRET_PATTERNS=(
  "NEXTAUTH_SECRET="
  "SMTP_PASSWORD="
  "RAG_API_TOKEN="
  "POSTGRES_PASSWORD="
  "DATABASE_URL=postgresql://.*:.*@"
  "-----BEGIN.*PRIVATE KEY-----"
  "NexusReussite[0-9]{4}@"
)

# ─── Allowlist par (fichier, pattern, valeur bénigne littérale) ───────────────
# Format : "file_glob|secret_pattern|benign_value_regex"
# The file is exempted from a secret_pattern ONLY if every matching line
# also matches benign_value_regex. A different value (e.g. POSTGRES_PASSWORD=realSecret)
# will still block even in an allowlisted file.
SECRET_SCAN_VALUE_ALLOWLIST=(
  # scripts/gate-all.sh: e2e container uses the default password "postgres" (never real creds).
  "scripts/gate-all.sh|POSTGRES_PASSWORD=|^postgres$"
)

# Returns 0 (exempt) only if ALL lines matching the secret pattern in the file
# also match the declared benign value or are command substitutions. Block otherwise.
is_value_allowlisted() {
  local file="$1"
  local pattern="$2"
  local content="$3"

  # Command substitution is not a literal secret: values starting with "$(" or "'$(" are safe.
  # Extract full values (including quotes) after the pattern.
  local all_values
  all_values=$(echo "$content" | grep -oE "${pattern}[^[:space:]]*" | sed "s/^${pattern}//")
  local has_literal=false
  while IFS= read -r val; do
    [[ -z "$val" ]] && continue
    # Strip surrounding quotes for inspection
    local stripped="${val#\"}"
    stripped="${stripped#\'}"
    # Command substitution: $( or backtick → not a literal secret
    if [[ "$stripped" == '$('* || "$stripped" == '`'* ]]; then
      continue
    fi
    has_literal=true
    break
  done <<< "$all_values"

  # If no literal values found, all matches are substitutions → exempt
  if [[ "$has_literal" == false ]]; then
    return 0
  fi

  # Check value-pinned allowlist for literal values
  for entry in "${SECRET_SCAN_VALUE_ALLOWLIST[@]}"; do
    [[ "$entry" == \#* ]] && continue
    local allowed_file allowed_pattern benign_suffix
    IFS='|' read -r allowed_file allowed_pattern benign_suffix <<< "$entry"
    if [[ "$file" == $allowed_file && "$pattern" == "$allowed_pattern" ]]; then
      local literal_values
      literal_values=$(echo "$content" | grep -oE "${allowed_pattern}[^[:space:]\"'\\\\]*" | sed "s/^${allowed_pattern}//")
      local non_benign
      non_benign=$(echo "$literal_values" | grep -vcE "$benign_suffix" 2>/dev/null || true)
      if [[ "${non_benign:-0}" -eq 0 ]]; then
        return 0
      fi
      return 1
    fi
  done
  return 1
}

for f in $STAGED_ADDED_MODIFIED; do
  if [[ ! -f "$f" ]]; then
    continue
  fi
  # Ne pas inspecter les fichiers binaires, les .example, ou le hook lui-même
  # Skip: example/sample files (declared safe), the hook itself, and its test harness
  # (the test constructs pattern strings from .sample fixtures — not literal secrets)
  if [[ "$f" == *".example" || "$f" == *".sample" || "$f" == *"pre-commit-hook.sh" || "$f" == *"pre-commit-hook.test.ts" ]]; then
    continue
  fi
  CONTENT=$(git show ":$f" 2>/dev/null || true)
  for pattern in "${SECRET_PATTERNS[@]}"; do
    if echo "$CONTENT" | grep -qE "$pattern" 2>/dev/null; then
      # Check value-level allowlist: exempts only if ALL matches are benign
      if is_value_allowlisted "$f" "$pattern" "$CONTENT"; then
        continue
      fi
      echo -e "${RED}[BLOCKED]${NC} Secret potentiel dans $f (pattern: $pattern)"
      BLOCKED=true
    fi
  done
done

# ─── Avertissements (non-bloquants) ──────────────────────────────────────────
WARN_PATTERNS=(
  "prod-tree.*\.txt$"
  "arborescence.*\.txt$"
  "storage/"
)

for pattern in "${WARN_PATTERNS[@]}"; do
  MATCHES=$(echo "$STAGED_FILES" | grep -E "$pattern" || true)
  if [[ -n "$MATCHES" ]]; then
    echo -e "${YELLOW}[WARN]${NC} Fichier inhabituel stagé :"
    echo "$MATCHES" | while read -r f; do
      echo -e "  ${YELLOW}⚠${NC} $f"
    done
    echo -e "  Utilisez ${YELLOW}git commit --no-verify${NC} si c'est intentionnel."
  fi
done

if $BLOCKED; then
  echo ""
  echo -e "${RED}Commit bloqué.${NC} Retirez les fichiers sensibles avec :"
  echo "  git reset HEAD <fichier>"
  echo ""
  exit 1
fi

exit 0
