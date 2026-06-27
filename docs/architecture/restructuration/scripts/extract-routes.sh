#!/usr/bin/env bash
#
# extract-routes.sh
#
# Extraction DETERMINISTE de la surface API.
# Pour chaque app/api/**/route.ts :
#   1. Méthodes HTTP exportées (grep des export)
#   2. Gardes d'auth (grep requireRole/requireAnyRole/requireAuth/auth()/enforcePolicy + comparaisons role)
#   3. Modèles Prisma mutés (grep prisma.<model>.create/update/delete/upsert/createMany/updateMany/deleteMany)
#
# Sortie : TSV sur stdout (route \t methods \t guards \t mutations)
# Usage  : bash docs/architecture/restructuration/scripts/extract-routes.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"

echo "# Surface API — extraction déterministe"
echo "#"
echo "# Généré par extract-routes.sh"
echo "# Date : $(date +%Y-%m-%d)"
echo "#"
echo "# Format : ROUTE | METHODS | GUARDS | PRISMA_MUTATIONS"
echo ""

find "$ROOT/app/api" -name 'route.ts' | sort | while read -r file; do
  # Compute route path from file path
  route="${file#$ROOT/app}"
  route="${route%/route.ts}"
  # Normalize: /api/foo/[bar]/route.ts -> /api/foo/[bar]
  route="${route}"

  # 1. HTTP methods exported
  methods=$(grep -oE 'export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' "$file" 2>/dev/null \
    | grep -oE '(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' \
    | sort -u \
    | tr '\n' ',' \
    | sed 's/,$//' || echo "NONE")

  # Also check for export { X } from or export { GET, POST } patterns
  if [ -z "$methods" ] || [ "$methods" = "NONE" ]; then
    methods=$(grep -oE 'export\s*\{[^}]*\}' "$file" 2>/dev/null \
      | grep -oE '(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)' \
      | sort -u \
      | tr '\n' ',' \
      | sed 's/,$//' || echo "NONE")
  fi

  [ -z "$methods" ] && methods="NONE"

  # 2. Guards — extract actual guard expressions
  guards=""

  # requireRole / requireAnyRole / requireAuth from lib/guards
  g1=$(grep -oE 'require(Role|AnyRole|Auth)\([^)]*\)' "$file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # enforcePolicy from lib/rbac
  g2=$(grep -oE 'enforcePolicy\([^)]*\)' "$file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  # auth() direct calls
  g3=$(grep -cE '\bauth\(\)' "$file" 2>/dev/null || echo "0")

  # Inline role comparisons (session.user.role === 'ADMIN' etc)
  g4=$(grep -oE "role\s*[!=]==?\s*['\"]?\w+['\"]?" "$file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)
  # Also: UserRole.XXX comparisons
  g4b=$(grep -oE "UserRole\.\w+" "$file" 2>/dev/null | sort -u | tr '\n' '; ' | sed 's/; $//' || true)

  if [ -n "$g1" ]; then
    guards="CENTRALIZED: $g1"
  elif [ -n "$g2" ]; then
    guards="RBAC: $g2"
  elif [ "$g3" -gt 0 ]; then
    role_info=""
    [ -n "$g4" ] && role_info=" + roles: $g4"
    [ -n "$g4b" ] && role_info="$role_info; $g4b"
    guards="INLINE_AUTH: auth()$role_info"
  else
    guards="PUBLIC"
  fi

  # 3. Prisma mutations
  mutations=$(grep -oE 'prisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)' "$file" 2>/dev/null \
    | sort -u \
    | tr '\n' '; ' \
    | sed 's/; $//' || true)

  [ -z "$mutations" ] && mutations="none"

  echo "$route | $methods | $guards | $mutations"
done
