#!/usr/bin/env bash
#
# extract-routes.sh (v2)
#
# Extraction DETERMINISTE de la surface API.
# Pour chaque app/api/**/route.ts :
#   1. Méthodes HTTP exportées
#   2. Gardes d'auth — TOUS les motifs de contrôle de rôle :
#      - requireRole/requireAnyRole/requireAuth (lib/guards)
#      - enforcePolicy (lib/rbac)
#      - auth() + session.user.role / userRole / user.role comparisons
#      - isStaff() checks
#      - canPerform* custom guards
#      - UserRole.X enum references
#   3. Modèles Prisma mutés (grep prisma.<model>.{create,update,...})
#
# Sortie : pipe-delimited sur stdout
# Format : ROUTE | METHODS | AUTH_CATEGORY | GUARD_DETAIL | ROLE_CONSTRAINTS | PRISMA_MUTATIONS
# Usage  : bash docs/architecture/restructuration/scripts/extract-routes.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"

echo "# Surface API — extraction déterministe (v2)"
echo "#"
echo "# Généré par extract-routes.sh v2"
echo "# Date : $(date +%Y-%m-%d)"
echo "#"
echo "# Format : ROUTE | METHODS | AUTH_CATEGORY | GUARD_DETAIL | ROLE_CONSTRAINTS | PRISMA_MUTATIONS"
echo ""

find "$ROOT/app/api" -name 'route.ts' | sort | while read -r file; do
  route="${file#$ROOT/app}"
  route="${route%/route.ts}"

  # 1. HTTP methods exported
  methods=$(grep -oE 'export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' "$file" 2>/dev/null \
    | grep -oE '(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' \
    | sort -u | tr '\n' ',' | sed 's/,$//' || true)

  if [ -z "$methods" ]; then
    methods=$(grep -oE 'export\s*\{[^}]*\}' "$file" 2>/dev/null \
      | grep -oE '(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' \
      | sort -u | tr '\n' ',' | sed 's/,$//' || true)
  fi
  [ -z "$methods" ] && methods="NONE"

  # 2. Guards — multi-pattern extraction

  # 2.pre: Handle re-exports (export { POST } from '../regenerate/route')
  # If the file re-exports, follow ONE level to check the target for guards
  reexport_target=""
  reexport_from=$(grep -oE "from\s+['\"][^'\"]+['\"]" "$file" 2>/dev/null | grep -v 'next\|@/' | head -1 | sed "s/from\s*['\"]//;s/['\"]$//" || true)
  if [ -n "$reexport_from" ] && grep -qE "export\s*\{" "$file" 2>/dev/null; then
    # Resolve relative path
    filedir=$(dirname "$file")
    candidate="$filedir/$reexport_from"
    # Try with .ts extension and /route.ts
    for suffix in ".ts" "/route.ts" ""; do
      if [ -f "${candidate}${suffix}" ]; then
        reexport_target="${candidate}${suffix}"
        break
      fi
    done
  fi

  # Effective file for guard analysis (follow re-export if found)
  guard_file="$file"
  if [ -n "$reexport_target" ]; then
    guard_file="$reexport_target"
  fi

  # 2a. Centralized guards from lib/guards
  # Single-line match first
  guard_centralized=$(grep -oE "require(Role|AnyRole|Auth)\([^)]*\)" "$guard_file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)
  # Also detect multi-line calls (await requireAnyRole(\n  [...]\n))
  if [ -z "$guard_centralized" ]; then
    guard_centralized=$(grep -oE "(await\s+)?require(Role|AnyRole|Auth)\s*\(" "$guard_file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)
  fi

  # 2b. RBAC enforcePolicy
  guard_rbac=$(grep -oE "enforcePolicy\([^)]*\)" "$guard_file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # 2c. auth() calls (check both files)
  has_auth=$(grep -cE '\bauth\(\)' "$guard_file" 2>/dev/null || true)
  has_auth=$(echo "$has_auth" | tr -d '[:space:]')
  has_auth=${has_auth:-0}
  if [ "$has_auth" = "0" ] && [ "$guard_file" != "$file" ]; then
    has_auth=$(grep -cE '\bauth\(\)' "$file" 2>/dev/null || true)
    has_auth=$(echo "$has_auth" | tr -d '[:space:]')
    has_auth=${has_auth:-0}
  fi

  # 2d. Role constraints — ALL patterns (search in guard_file AND original file)
  role_constraints=""

  # Pattern: session.user.role !== 'X' / === 'X' / !== "X" / === "X"
  rc1=$(grep -oE "session\.user\.role\s*[!=]==?\s*['\"][A-Z_]+['\"]" "$guard_file" "$file" 2>/dev/null | sed 's/^.*://' | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # Pattern: userRole !== 'X' / === 'X' / !== "X"
  rc2=$(grep -oE "userRole\s*[!=]==?\s*['\"][A-Z_]+['\"]" "$guard_file" "$file" 2>/dev/null | sed 's/^.*://' | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # Pattern: user.role !== 'X' / === 'X' (excludes session.user.role already captured)
  rc3=$(grep -oE "\buser\.role\s*[!=]==?\s*['\"][A-Z_]+['\"]" "$guard_file" "$file" 2>/dev/null | grep -v 'session\.user\.role' | sed 's/^.*://' | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # Pattern: UserRole.X enum references (from guards args or inline)
  rc4=$(grep -oE "UserRole\.\w+" "$guard_file" "$file" 2>/dev/null | sed 's/^.*://' | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # Pattern: isStaff() calls
  rc5=$(grep -oE "isStaff\([^)]*\)" "$guard_file" "$file" 2>/dev/null | sed 's/^.*://' | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # Pattern: .includes('ADMIN') etc — role membership tests
  rc6=$(grep -oE "\.(includes|some)\s*\(\s*['\"]?(ADMIN|ASSISTANTE|COACH|PARENT|ELEVE)['\"]?" "$guard_file" "$file" 2>/dev/null | sed 's/^.*://' | sort -u | tr '\n' '; ' | sed 's/; $//' || true)
  rc6b=$(grep -oE "\[(['\"]?(ADMIN|ASSISTANTE|COACH|PARENT|ELEVE)['\"]?,?\s*)+\]\.includes" "$guard_file" "$file" 2>/dev/null | sed 's/^.*://' | sort -u | tr '\n' '; ' | sed 's/; $//' || true)
  if [ -n "$rc6b" ]; then
    if [ -n "$rc6" ]; then rc6="$rc6; $rc6b"; else rc6="$rc6b"; fi
  fi

  # Pattern: canPerform* custom guards
  rc7=$(grep -oE "canPerform\w+\([^)]*\)" "$guard_file" "$file" 2>/dev/null | sed 's/^.*://' | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # Pattern: bare role comparisons (role === 'X')
  rc8=$(grep -oE "\brole\s*[!=]==?\s*['\"][A-Z_]+['\"]" "$file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # Pattern: string literal role names in arrays ['ADMIN', 'ASSISTANTE']
  rc9=$(grep -oE "'(ADMIN|ASSISTANTE|COACH|PARENT|ELEVE)'" "$file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # Aggregate role constraints (deduplicate via sort -u)
  all_rc=""
  for rc in "$rc1" "$rc2" "$rc3" "$rc4" "$rc5" "$rc6" "$rc7" "$rc8"; do
    if [ -n "$rc" ]; then
      if [ -n "$all_rc" ]; then
        all_rc="$all_rc; $rc"
      else
        all_rc="$rc"
      fi
    fi
  done

  # Classify
  if [ -n "$guard_centralized" ]; then
    category="CENTRALIZED"
    guard_detail="$guard_centralized"
  elif [ -n "$guard_rbac" ]; then
    category="RBAC"
    guard_detail="$guard_rbac"
  elif [ "$has_auth" != "0" ] && [ -n "$has_auth" ]; then
    category="INLINE_AUTH"
    guard_detail="auth()"
  else
    category="PUBLIC"
    guard_detail="none"
  fi

  [ -z "$all_rc" ] && all_rc="none"

  # 3. Prisma mutations
  mutations=$(grep -oE 'prisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)' "$file" 2>/dev/null \
    | sort -u | tr '\n' '; ' | sed 's/; $//' || true)
  [ -z "$mutations" ] && mutations="none"

  echo "$route | $methods | $category | $guard_detail | $all_rc | $mutations"
done
