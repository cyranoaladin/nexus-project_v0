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

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  MATCHES=$(echo "$STAGED_FILES" | grep -E "$pattern" || true)
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

for f in $STAGED_FILES; do
  if [[ ! -f "$f" ]]; then
    continue
  fi
  # Ne pas inspecter les fichiers binaires ou les .example
  if [[ "$f" == *".example" || "$f" == *".sample" ]]; then
    continue
  fi
  CONTENT=$(git show ":$f" 2>/dev/null || true)
  for pattern in "${SECRET_PATTERNS[@]}"; do
    if echo "$CONTENT" | grep -qE "$pattern" 2>/dev/null; then
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
