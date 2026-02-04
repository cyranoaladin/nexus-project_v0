#!/bin/bash
# Zenflow pre-push hook
# Validates worktree state before push to remote

set -euo pipefail

CURRENT_BRANCH=$(git branch --show-current)
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
    echo "Zenflow: Warning - zenflow CLI not found, skipping pre-push validation" >&2
    exit 0
fi

if [[ $CURRENT_BRANCH =~ -[a-f0-9]{4}$ ]]; then
    echo "Zenflow: Validating worktree before push: $CURRENT_BRANCH"
    
    if ! "$ZENFLOW_CLI" sync worktree "$CURRENT_BRANCH" --check --quiet; then
        echo "Zenflow: ❌ Validation failed - please resolve conflicts before pushing" >&2
        echo "Zenflow: Run 'zenflow sync worktree $CURRENT_BRANCH --dry-run' for details" >&2
        exit 1
    fi
    
    echo "Zenflow: ✅ Validation passed - safe to push"
fi

exit 0
