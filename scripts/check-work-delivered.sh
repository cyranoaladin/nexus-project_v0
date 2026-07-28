#!/usr/bin/env bash
# check-work-delivered.sh — a lot is not done until it is in origin/main.
#
# 798f712ae (2026-07-06) was a correct, tested, intentional fix. It was never a "checkpoint".
# It was simply never merged — and nothing ever checked for that after the fact. Green tests
# in a local worktree are not delivery. This script is the check that would have caught it:
# it fails loudly if the given ref (or, by default, every commit reachable from HEAD but not
# yet part of origin/main) has sat unmerged past a configurable age.
#
# Exit codes:
#   0 — HEAD is part of origin/main. Delivered.
#   1 — HEAD is not part of origin/main (not merged, not even pushed as a PR ref).
#   2 — HEAD is on an open, pushed branch/PR but unmerged past the staleness threshold.
#   3 — usage/git error.
#
# Usage: scripts/check-work-delivered.sh [ref] [--max-age-days=N]
# Intended use: last step of "produire un rapport final factuel" (AGENTS.md §11), and as a
# CI gate on any branch older than N days that still has commits absent from origin/main.

set -euo pipefail

REF="${1:-HEAD}"
MAX_AGE_DAYS=14
for arg in "$@"; do
  case "$arg" in
    --max-age-days=*) MAX_AGE_DAYS="${arg#*=}" ;;
  esac
done
REMOTE_BASE="${GIT_ASCENDANCY_BASE:-origin/main}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "check-work-delivered: not inside a git repository" >&2
  exit 3
fi
if ! git rev-parse --verify "$REF" >/dev/null 2>&1; then
  echo "check-work-delivered: '$REF' does not resolve to a commit" >&2
  exit 3
fi

SHA=$(git rev-parse "$REF")
SHORT=$(git rev-parse --short "$REF")

echo "=== check-work-delivered: $REF ($SHORT) vs $REMOTE_BASE ==="

if git merge-base --is-ancestor "$SHA" "$REMOTE_BASE" 2>/dev/null; then
  echo "DELIVERED: $SHORT is part of $REMOTE_BASE."
  exit 0
fi

# Is it at least visible on a remote branch (i.e. pushed, reviewable, on its way)?
VISIBLE_REMOTES=$(git branch --remotes --contains "$SHA" 2>/dev/null | grep -v '/HEAD ' || true)
COMMIT_DATE=$(git show -s --format=%ct "$SHA")
NOW=$(date +%s)
AGE_DAYS=$(( (NOW - COMMIT_DATE) / 86400 ))

if [ -z "$VISIBLE_REMOTES" ]; then
  echo "NOT DELIVERED: $SHORT is not in $REMOTE_BASE and not pushed to any remote branch."
  echo "  Age: ${AGE_DAYS} day(s). This work is invisible to everyone but this checkout."
  exit 1
fi

echo "PUSHED BUT NOT MERGED: $SHORT is on:"
echo "$VISIBLE_REMOTES" | sed 's/^/  /'
echo "Age: ${AGE_DAYS} day(s) (threshold: ${MAX_AGE_DAYS} day(s))."

if [ "$AGE_DAYS" -gt "$MAX_AGE_DAYS" ]; then
  echo ""
  echo "==> STALE: unmerged for longer than ${MAX_AGE_DAYS} days. Either merge it, close it"
  echo "    explicitly with a reason, or tag it archive/<slug> and delete the branch — do not"
  echo "    let it sit silently. This exact pattern (a correct fix, pushed, never merged, never"
  echo "    revisited) is what produced the account-enumeration bug documented in"
  echo "    docs/audits/2026-07-28-bilan-gratuit-cemetery-and-account-creation-bug.md."
  exit 2
fi

echo ""
echo "==> Open and within the staleness threshold. Not a failure yet — re-run this check"
echo "    periodically until it is merged or explicitly closed."
exit 0
