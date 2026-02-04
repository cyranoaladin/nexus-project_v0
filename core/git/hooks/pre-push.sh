#!/bin/bash
#  pre-push hook
# Validates worktree state before push to remote

set -euo pipefail

CURRENT_BRANCH=$(git branch --show-current)
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

_CLI=$(find__cli)

if [[ -z "$_CLI" ]]; then
    echo ": Warning -  CLI not found, skipping pre-push validation" >&2
    exit 0
fi

if [[ $CURRENT_BRANCH =~ -[a-f0-9]{4}$ ]]; then
    echo ": Validating worktree before push: $CURRENT_BRANCH"
    
    if ! "$_CLI" sync worktree "$CURRENT_BRANCH" --check --quiet; then
        echo ": ❌ Validation failed - please resolve conflicts before pushing" >&2
        echo ": Run ' sync worktree $CURRENT_BRANCH --dry-run' for details" >&2
        exit 1
    fi
    
    echo ": ✅ Validation passed - safe to push"
fi

exit 0
