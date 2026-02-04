#!/bin/bash
# Zenflow Git Hooks Uninstaller
# Removes post-commit and pre-push hooks from all worktrees

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERBOSE=false
DRY_RUN=false

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Uninstall Zenflow Git hooks from all worktrees.

OPTIONS:
    -v, --verbose       Enable verbose output
    -d, --dry-run       Show what would be done without making changes
    -h, --help          Show this help message

EXAMPLES:
    $0                  # Uninstall hooks from all worktrees
    $0 --dry-run        # Preview uninstallation

EOF
    exit 0
}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "[VERBOSE] $*"
    fi
}

error() {
    echo "[ERROR] $*" >&2
}

find_main_repo() {
    local current_dir="$PROJECT_ROOT"
    
    if git -C "$current_dir" rev-parse --is-inside-work-tree &>/dev/null; then
        local git_dir=$(git -C "$current_dir" rev-parse --git-common-dir)
        if [[ -f "$git_dir/worktrees" ]] || [[ -d "$git_dir/worktrees" ]]; then
            echo "$git_dir/.."
            return 0
        fi
        
        local worktree_git_dir=$(git -C "$current_dir" rev-parse --git-dir)
        if [[ -f "$worktree_git_dir/gitdir" ]]; then
            local main_git_dir=$(dirname "$(dirname "$(cat "$worktree_git_dir/gitdir")")")
            echo "$main_git_dir"
            return 0
        fi
        
        echo "$current_dir"
        return 0
    fi
    
    error "Not in a git repository"
    exit 1
}

is_zenflow_hook() {
    local hook_file=$1
    
    if [[ ! -f "$hook_file" ]]; then
        return 1
    fi
    
    if grep -q "Zenflow" "$hook_file" 2>/dev/null; then
        return 0
    fi
    
    return 1
}

uninstall_hook() {
    local worktree_path=$1
    local worktree_branch=$2
    local hook_name=$3
    
    local hooks_dir="$worktree_path/.git/hooks"
    if [[ ! -d "$worktree_path/.git" ]]; then
        local git_file="$worktree_path/.git"
        if [[ -f "$git_file" ]]; then
            local git_dir=$(grep "gitdir:" "$git_file" | cut -d' ' -f2)
            hooks_dir="$git_dir/hooks"
        else
            log_verbose "Git directory not found in worktree: $worktree_path"
            return 1
        fi
    fi
    
    local hook_file="$hooks_dir/$hook_name"
    
    if [[ ! -f "$hook_file" ]]; then
        log_verbose "Hook not found: $hook_file"
        return 0
    fi
    
    if ! is_zenflow_hook "$hook_file"; then
        log_verbose "Hook exists but is not a Zenflow hook: $hook_file (skipping)"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_verbose "[DRY-RUN] Would remove: $hook_file"
        return 0
    fi
    
    rm -f "$hook_file"
    log_verbose "Removed: $hook_name from $worktree_branch"
    return 0
}

main() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                error "Unknown option: $1"
                usage
                ;;
        esac
    done
    
    log "Zenflow Git Hooks Uninstaller"
    log "=========================================="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY-RUN MODE: No changes will be made"
    fi
    
    log_verbose "Project root: $PROJECT_ROOT"
    
    MAIN_REPO=$(find_main_repo)
    log_verbose "Main repository: $MAIN_REPO"
    
    if ! command -v git &> /dev/null; then
        error "Git is not installed"
        exit 1
    fi
    
    local worktrees_output=$(git -C "$MAIN_REPO" worktree list --porcelain)
    local worktrees=()
    local current_worktree=""
    local current_branch=""
    
    while IFS= read -r line; do
        if [[ $line == worktree* ]]; then
            current_worktree="${line#worktree }"
        elif [[ $line == branch* ]]; then
            current_branch="${line#branch refs/heads/}"
            if [[ -n "$current_worktree" && -n "$current_branch" ]]; then
                worktrees+=("$current_worktree|$current_branch")
                current_worktree=""
                current_branch=""
            fi
        fi
    done <<< "$worktrees_output"
    
    if [[ ${#worktrees[@]} -eq 0 ]]; then
        error "No worktrees found"
        exit 1
    fi
    
    log "Found ${#worktrees[@]} worktree(s)"
    echo ""
    
    local removed_count=0
    local skipped_count=0
    local failed_count=0
    
    for worktree_info in "${worktrees[@]}"; do
        IFS='|' read -r worktree_path worktree_branch <<< "$worktree_info"
        
        log "Processing: $worktree_branch"
        log_verbose "  Path: $worktree_path"
        
        if [[ "$worktree_branch" == "main" ]] || [[ "$worktree_branch" == "master" ]]; then
            log_verbose "  Skipped: main repository"
            skipped_count=$((skipped_count + 1))
            continue
        fi
        
        for hook_name in "post-commit" "pre-push"; do
            if uninstall_hook "$worktree_path" "$worktree_branch" "$hook_name"; then
                removed_count=$((removed_count + 1))
            else
                failed_count=$((failed_count + 1))
            fi
        done
        
        echo ""
    done
    
    log "=========================================="
    log "Uninstallation Summary:"
    log "  Hooks removed: $removed_count"
    log "  Worktrees skipped: $skipped_count"
    log "  Failures: $failed_count"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log ""
        log "DRY-RUN complete. Run without --dry-run to apply changes."
    elif [[ $failed_count -eq 0 ]]; then
        log ""
        log "✅ All hooks uninstalled successfully!"
    else
        log ""
        error "⚠️  Some hooks failed to uninstall. Check the output above."
        exit 1
    fi
}

main "$@"
