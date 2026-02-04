#!/bin/bash
# Zenflow post-commit hook
# Triggers automatic sync after commit in worktree

set -euo pipefail

CURRENT_BRANCH=$(git branch --show-current)
COMMIT_HASH=$(git rev-parse HEAD)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT=$(git rev-parse --show-toplevel)

find_zenflow_cli() {
    local candidates=(
        "$GIT_ROOT/node_modules/.bin/zenflow"
        "$GIT_ROOT/../../../nexus-project_v0/node_modules/.bin/zenflow"
        "$(command -v zenflow 2>/dev/null || true)"
    )
    
    for candidate in "${candidates[@]}"; do
        if [[ -x "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done
    
    return 1
}

ZENFLOW_CLI=$(find_zenflow_cli)

if [[ -z "$ZENFLOW_CLI" ]]; then
    echo "Zenflow: Warning - zenflow CLI not found, skipping auto-sync" >&2
    exit 0
fi

if [[ $CURRENT_BRANCH =~ -[a-f0-9]{4}$ ]]; then
    echo "Zenflow: Detected commit in worktree branch: $CURRENT_BRANCH ($COMMIT_HASH)"
    
    nohup "$ZENFLOW_CLI" sync worktree "$CURRENT_BRANCH" --auto > /tmp/zenflow-sync-$CURRENT_BRANCH.log 2>&1 &
    
    echo "Zenflow: Sync triggered in background (PID: $!)"
else
    echo "Zenflow: Skipping - not a worktree branch pattern (expected: *-[hash])"
fi

exit 0
