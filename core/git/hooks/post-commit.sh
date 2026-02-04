#!/bin/bash
#  post-commit hook
# Triggers automatic sync after commit in worktree

set -euo pipefail

CURRENT_BRANCH=$(git branch --show-current)
COMMIT_HASH=$(git rev-parse HEAD)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT=$(git rev-parse --show-toplevel)

find__cli() {
    local candidates=(
        "$GIT_ROOT/node_modules/.bin/"
        "$GIT_ROOT/../../../nexus-project_v0/node_modules/.bin/"
        "$(command -v  2>/dev/null || true)"
    )
    
    for candidate in "${candidates[@]}"; do
        if [[ -x "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done
    
    return 1
}

_CLI=$(find__cli) || true

if [[ -z "$_CLI" ]]; then
    echo ": Warning -  CLI not found, skipping auto-sync" >&2
    exit 0
fi

if [[ $CURRENT_BRANCH =~ -[a-f0-9]{4}$ ]]; then
    echo ": Detected commit in worktree branch: $CURRENT_BRANCH ($COMMIT_HASH)"
    
    nohup "$_CLI" sync worktree "$CURRENT_BRANCH" --auto > /tmp/-sync-$CURRENT_BRANCH.log 2>&1 &
    
    echo ": Sync triggered in background (PID: $!)"
else
    echo ": Skipping - not a worktree branch pattern (expected: *-[hash])"
fi

exit 0
