#!/usr/bin/env bash
# check-bundle-weight.sh — Gate guard: fails if any marketing page exceeds
# its per-route baseline + tolerance.
#
# Usage: ./scripts/check-bundle-weight.sh [build-log-file]
# If no file is given, reads from .next/build-output.log.

set -euo pipefail

TOLERANCE_KB="${BUNDLE_TOLERANCE_KB:-5}"  # Allowed growth per route (kB)

# Per-route baselines (First Load JS in kB) — update after intentional changes.
# Measured on fix/lot1-bundle-regression after pricing-client refactor.
declare -A BASELINES=(
  ["/"]="148"
  ["/equipe"]="118"
  ["/famille"]="129"
  ["/accompagnement-scolaire"]="141"
  ["/notre-centre"]="140"
  ["/offres"]="145"
  ["/stages"]="180"
  ["/contact"]="190"
  ["/mentions-legales"]="129"
  ["/plateforme-aria"]="226"
  ["/recommandation"]="136"
  ["/bilan-gratuit/assessment"]="420"
)

BUILD_LOG="${1:-}"

if [ -z "$BUILD_LOG" ]; then
  BUILD_LOG=".next/build-output.log"
  if [ ! -f "$BUILD_LOG" ]; then
    echo "⚠  No build log found. Run 'next build 2>&1 | tee .next/build-output.log' first."
    exit 1
  fi
fi

if [ ! -f "$BUILD_LOG" ]; then
  echo "✗ Build log not found: $BUILD_LOG"
  exit 1
fi

FAILURES=0
echo "Bundle weight check (tolerance: +${TOLERANCE_KB} kB over baseline)"
echo "─────────────────────────────────────────────────────────────"

for route in "${!BASELINES[@]}"; do
  baseline="${BASELINES[$route]}"
  budget=$((baseline + TOLERANCE_KB))

  # Match the route in build output — handles both ┌ and ├ prefixes
  line=$(grep -E "○ ${route} " "$BUILD_LOG" | head -1 || true)
  if [ -z "$line" ]; then
    echo "✗  ${route}: not found in build output (protected route vanished from build)"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  # Extract the last "NNN kB" which is First Load JS
  first_load=$(echo "$line" | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]/ && $(i+1)=="kB") last=$i} END{print last}')

  if [ -z "$first_load" ]; then
    echo "⚠  ${route}: could not parse First Load JS (skipped)"
    continue
  fi

  first_load_int=$(awk -v v="$first_load" 'BEGIN { printf "%d", (v == int(v) ? v : int(v) + 1) }')

  if [ "$first_load_int" -gt "$budget" ]; then
    echo "✗  ${route}: ${first_load} kB > ${budget} kB (baseline ${baseline} + ${TOLERANCE_KB})"
    FAILURES=$((FAILURES + 1))
  else
    echo "✓  ${route}: ${first_load} kB (baseline ${baseline})"
  fi
done

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "✗ ${FAILURES} route(s) over budget."
  echo "  If growth is intentional, update BASELINES in scripts/check-bundle-weight.sh"
  exit 1
else
  echo "✓ All routes within baseline + ${TOLERANCE_KB} kB."
fi
