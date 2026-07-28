#!/usr/bin/env bash
# check-branch-ascendancy.sh — structural check before resuming work on an existing branch.
#
# Detects, WITHOUT relying on commit message text, whether the current HEAD is at risk of
# being treated as "the real state of the repo" when it is not:
#   - how far HEAD has diverged from origin/main (ahead/behind count) ;
#   - whether HEAD is reachable from ANY remote-tracking branch (if not, no one else can see it,
#     and it can vanish with a single `git branch -D` or a pruned worktree) ;
#   - whether HEAD's own commit was immediately followed, in the reflog, by a branch checkout —
#     the structural signature of an automated pre-checkout snapshot, regardless of what message
#     the tool that created it happened to write.
#
# Exit codes:
#   0 — HEAD is a normal, reachable, intentional commit. Safe to treat as ground truth.
#   1 — HEAD is not reachable from any remote branch (orphan risk).
#   2 — HEAD looks like an automated pre-checkout snapshot (reflog signature).
#   3 — usage/git error.
#
# Usage: scripts/check-branch-ascendancy.sh [ref]   (defaults to HEAD)
#
# PORTABILITY LIMITATION — read before trusting "no signature" as "safe":
# Structural signal 2 (the reflog checkout-adjacency check) reads refs/heads/*
# reflogs, which are LOCAL to this checkout, expire after ~90 days by default
# (gc.reflogExpire), and DO NOT EXIST AT ALL in a fresh clone, a fresh CI runner,
# or any other machine's checkout. A clean exit here on a fresh clone proves
# NOTHING about whether the commit was originally an automated snapshot — it
# only proves this specific reflog has no such entry (or never had one to begin
# with). The only signal in this script that is NOT local and NOT time-limited
# is structural signal 1 (remote-branch visibility, via git branch --remotes
# --contains) — "invisible from any remote branch" is a fact about the object
# graph, true from any clone, forever. Treat exit 2 as strong evidence when it
# fires; do not treat its absence as strong evidence of safety.

set -euo pipefail

REF="${1:-HEAD}"
REMOTE_BASE="${GIT_ASCENDANCY_BASE:-origin/main}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "check-branch-ascendancy: not inside a git repository" >&2
  exit 3
fi

if ! git rev-parse --verify "$REF" >/dev/null 2>&1; then
  echo "check-branch-ascendancy: '$REF' does not resolve to a commit" >&2
  exit 3
fi

SHA=$(git rev-parse "$REF")
SHORT=$(git rev-parse --short "$REF")

echo "=== check-branch-ascendancy: $REF ($SHORT) vs $REMOTE_BASE ==="

if git merge-base --is-ancestor "$SHA" "$REMOTE_BASE" 2>/dev/null; then
  echo "ANCESTOR: $SHORT is already part of $REMOTE_BASE. Nothing to warn about."
  exit 0
fi

# Ahead/behind count relative to the remote base.
if git rev-parse --verify "$REMOTE_BASE" >/dev/null 2>&1; then
  read -r BEHIND AHEAD <<<"$(git rev-list --left-right --count "$REMOTE_BASE...$SHA" | tr '\t' ' ')"
  echo "DIVERGED: $AHEAD commit(s) ahead of $REMOTE_BASE, $BEHIND commit(s) behind."
else
  echo "WARNING: $REMOTE_BASE does not resolve locally — run 'git fetch' first." >&2
fi

# Structural signal 1: is this commit visible from ANY remote-tracking branch?
VISIBLE_REMOTES=$(git branch --remotes --contains "$SHA" 2>/dev/null | grep -v '/HEAD ' || true)
if [ -z "$VISIBLE_REMOTES" ]; then
  echo "ORPHAN RISK: $SHORT is not reachable from any remote-tracking branch."
  echo "  It exists only in this local checkout's refs/reflog. A deleted local branch,"
  echo "  a pruned worktree, or 'git gc' can make it unrecoverable."
  ORPHAN=1
else
  echo "Reachable from remote branch(es):"
  echo "$VISIBLE_REMOTES" | sed 's/^/  /'
  ORPHAN=0
fi

# Structural signal 2: was this commit immediately followed by a branch checkout in the
# reflog of the ref that currently (or most recently) pointed at it? This is the mechanical
# signature of an automated pre-checkout snapshot — independent of whatever message it carries.
SNAPSHOT_SIGNATURE=0
while IFS= read -r refname; do
  [ -z "$refname" ] && continue
  # Reflog entries are newest-first; look for SHA immediately followed (older entry) by a checkout.
  MATCH=$(git reflog show "$refname" --date=iso 2>/dev/null | awk -v sha="$SHORT" '
    $0 ~ sha { found=1; next }
    found { print; exit }
  ')
  if echo "$MATCH" | grep -q "checkout: moving from"; then
    SNAPSHOT_SIGNATURE=1
    echo "SNAPSHOT SIGNATURE: reflog of '$refname' shows a checkout immediately preceding this commit's entry:"
    echo "  $MATCH" | sed 's/^/  /'
  fi
done < <(git for-each-ref --format='%(refname)' refs/heads/ 2>/dev/null)

if [ "$SNAPSHOT_SIGNATURE" -eq 1 ]; then
  echo ""
  echo "==> Treat this commit's content as a DRAFT, not as ground truth. Diff it against"
  echo "    $REMOTE_BASE file-by-file before reusing anything from it."
  exit 2
fi

if [ "$ORPHAN" -eq 1 ]; then
  echo ""
  echo "==> Push this branch (or tag this commit) before doing anything else."
  exit 1
fi

echo ""
echo "==> $SHORT diverges from $REMOTE_BASE but shows no structural risk signature."
echo "    Still recommended: confirm intent with whoever authored it before treating it as current."
exit 0
