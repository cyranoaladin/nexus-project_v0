#!/usr/bin/env bash
#
# cross-check.sh — Contrôle de cohérence croisé routes ↔ mutations
#
# Compatible avec le format v2 à 6 colonnes :
# ROUTE | METHODS | AUTH_CATEGORY | GUARD_DETAIL | ROLE_CONSTRAINTS | PRISMA_MUTATIONS
#
# Usage : bash docs/architecture/restructuration/scripts/cross-check.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ROUTES_FILE="$ROOT/docs/architecture/restructuration/extracted-routes.txt"

echo "# Contrôle de cohérence croisé — $(date +%Y-%m-%d)"
echo ""

# --- 1. Routes 410 Gone avec mutations déclarées ---
echo "## 1. Routes 410 Gone avec mutations déclarées"
echo ""
grep -v '^#' "$ROUTES_FILE" | grep -v '^$' | while IFS= read -r line; do
  route=$(echo "$line" | cut -d'|' -f1 | xargs)
  mutations=$(echo "$line" | cut -d'|' -f6 | xargs)
  [ -z "$route" ] && continue
  [ "$mutations" = "none" ] && continue

  file="$ROOT/app${route}/route.ts"
  if [ -f "$file" ] && grep -qE '\b410\b' "$file" 2>/dev/null; then
    echo "CONTRADICTION: $route déclare mutations [$mutations] mais contient un 410"
  fi
done
echo "(fin section 1)"
echo ""

# --- 2. Mutations déclarées non confirmées dans le code ---
echo "## 2. Mutations déclarées non confirmées dans le code"
echo ""
grep -v '^#' "$ROUTES_FILE" | grep -v '^$' | while IFS= read -r line; do
  route=$(echo "$line" | cut -d'|' -f1 | xargs)
  mutations=$(echo "$line" | cut -d'|' -f6 | xargs)
  [ -z "$route" ] && continue
  [ "$mutations" = "none" ] && continue

  file="$ROOT/app${route}/route.ts"
  [ ! -f "$file" ] && continue

  IFS=';' read -ra MUT_ARRAY <<< "$mutations"
  for mut in "${MUT_ARRAY[@]}"; do
    mut=$(echo "$mut" | xargs)
    [ -z "$mut" ] && continue
    if ! grep -qF "$mut" "$file" 2>/dev/null; then
      echo "MISMATCH: $route claims [$mut] but not found in file"
    fi
  done
done
echo "(fin section 2)"
echo ""

# --- 3. Mutations dans le code non capturées ---
echo "## 3. Mutations dans le code non capturées par l'extraction"
echo ""
find "$ROOT/app/api" -name 'route.ts' -print0 | sort -z | while IFS= read -r -d '' file; do
  route="${file#$ROOT/app}"
  route="${route%/route.ts}"

  file_mutations=$(grep -oE 'prisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)' "$file" 2>/dev/null | sort -u || true)
  [ -z "$file_mutations" ] && continue

  declared_line=$(grep -F "${route} " "$ROUTES_FILE" 2>/dev/null | head -1 || true)
  declared_muts=$(echo "$declared_line" | cut -d'|' -f6 | xargs 2>/dev/null || echo "none")

  while IFS= read -r mut; do
    [ -z "$mut" ] && continue
    if ! echo "$declared_muts" | grep -qF "$mut" 2>/dev/null; then
      echo "UNCAPTURED: $route has [$mut] in code but not in extraction"
    fi
  done <<< "$file_mutations"
done
echo "(fin section 3)"
echo ""

# --- 4. Auth classification counts ---
echo "## 4. Décompte par seau d'autorisation"
echo ""
centralized_count=$(grep -v '^#' "$ROUTES_FILE" | grep -v '^$' | grep -c '| CENTRALIZED |' || echo 0)
rbac_count=$(grep -v '^#' "$ROUTES_FILE" | grep -v '^$' | grep -c '| RBAC |' || echo 0)
inline_count=$(grep -v '^#' "$ROUTES_FILE" | grep -v '^$' | grep -c '| INLINE_AUTH |' || echo 0)
public_count=$(grep -v '^#' "$ROUTES_FILE" | grep -v '^$' | grep -c '| PUBLIC |' || echo 0)
total=$((centralized_count + rbac_count + inline_count + public_count))

echo "- Centralized (lib/guards): $centralized_count"
echo "- RBAC (lib/rbac enforcePolicy): $rbac_count"
echo "- Inline auth(): $inline_count"
echo "- Public: $public_count"
echo "- Total: $total (doit être 173)"
echo ""
echo "Contrôle terminé."
