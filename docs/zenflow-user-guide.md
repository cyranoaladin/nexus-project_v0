# Zenflow User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Installation and Setup](#installation-and-setup)
3. [Basic Usage](#basic-usage)
4. [Automatic Sync Setup](#automatic-sync-setup)
5. [CLI Command Reference](#cli-command-reference)
6. [Configuration](#configuration)
7. [Common Issues](#common-issues)

---

## Introduction

**Zenflow** is an automated worktree synchronization and workflow management system for Git repositories. It automatically synchronizes changes from Git worktrees to the main working directory, ensuring consistency across your development workflow.

### Key Features

- **Automatic Sync**: Automatically merge worktree changes to main on commit
- **Conflict Detection**: Pre-sync conflict detection prevents merge failures
- **Safe Rollback**: Built-in backup and rollback capabilities
- **Rule Engine**: Configurable rules for triggering workflows
- **Workflow Management**: Define multi-step workflows with error handling
- **CLI Interface**: Comprehensive command-line tools for management

### How It Works

1. You make changes in a Git worktree
2. When you commit, Zenflow detects the change
3. Pre-sync validation checks for conflicts
4. If safe, changes are automatically merged to main
5. Verification (lint, typecheck) runs automatically
6. Changes are pushed to remote (if configured)

---

## Installation and Setup

### Prerequisites

- Node.js 18+ and npm
- Git 2.25+ with worktree support
- Linux/macOS (Windows support coming soon)
- At least 1GB free disk space

### Initial Setup

The Zenflow system is already integrated into this repository. No additional installation is required.

#### Verify Installation

Check that Zenflow is available:

```bash
zenflow --version
```

#### Check System Status

```bash
zenflow status
```

### Configuration File

Zenflow is configured via `.zenflow/settings.json`. The default configuration includes:

- **Sync settings**: Auto-push, max retries, conflict strategy
- **Rule settings**: Auto-load, validation
- **Workflow settings**: Concurrent execution limits
- **Logging settings**: Log levels and output paths

To view or edit settings:

```bash
cat .zenflow/settings.json
```

---

## Basic Usage

### Manual Sync Operations

#### Sync a Specific Worktree

Sync changes from a specific worktree to main:

```bash
zenflow sync worktree <branch-name>
```

Example:
```bash
zenflow sync worktree feature-authentication-abc1
```

#### Sync All Worktrees

Sync all active worktrees automatically:

```bash
zenflow sync auto
```

#### Dry-Run Mode

Preview changes without applying them:

```bash
zenflow sync worktree <branch-name> --dry-run
zenflow sync auto --dry-run
```

#### Force Sync (Skip Conflict Check)

**⚠️ Use with caution!** Force sync even if conflicts exist:

```bash
zenflow sync worktree <branch-name> --force
```

### View Sync History

#### List Recent Syncs

```bash
zenflow sync list
```

#### Filter by Status

```bash
zenflow sync list --status success
zenflow sync list --status conflict
zenflow sync list --status failure
```

#### Filter by Date

```bash
zenflow sync list --since "2024-01-01"
zenflow sync list --since "7 days ago"
```

#### Limit Results

```bash
zenflow sync list --limit 10
```

### Show Sync Details

View detailed information about a specific sync operation:

```bash
zenflow sync show <sync-id>
```

Example:
```bash
zenflow sync show a3f8b2c4
```

The output includes:
- Sync ID and status
- Worktree branch
- Timestamp and duration
- Files changed, insertions, deletions
- Conflict information (if any)
- Error details (if failed)

### Rollback a Sync

If a sync caused issues, you can roll it back:

```bash
zenflow sync rollback <sync-id>
```

This will:
1. Reset to the commit before the sync
2. Restore the backup stash
3. Mark the sync as rolled back in history

---

## Automatic Sync Setup

Zenflow can automatically sync worktrees when you commit changes.

### How Automatic Sync Works

1. **Git Hook**: A `post-commit` hook in each worktree triggers Zenflow
2. **Rule Evaluation**: The sync rule checks conditions (no conflicts, disk space, etc.)
3. **Workflow Execution**: If conditions pass, the sync workflow runs
4. **Background Operation**: Sync happens asynchronously without blocking your work

### Enable Automatic Sync

#### Install Git Hooks

Install post-commit hooks in all active worktrees:

```bash
bash scripts/zenflow/install-hooks.sh
```

This creates a `post-commit` hook that triggers:
```bash
zenflow sync worktree <branch-name> &
```

#### Start the Daemon (Optional)

For advanced features like event monitoring and scheduled tasks:

```bash
zenflow daemon start
```

Check daemon status:
```bash
zenflow status service
```

View daemon logs:
```bash
zenflow daemon logs --follow
```

### Disable Automatic Sync

#### Remove Git Hooks

```bash
bash scripts/zenflow/uninstall-hooks.sh
```

Or manually delete `.git/hooks/post-commit` in each worktree.

#### Disable the Rule

Disable the sync rule without removing hooks:

```bash
zenflow rule disable worktree-to-main-sync
```

Re-enable later:
```bash
zenflow rule enable worktree-to-main-sync
```

#### Stop the Daemon

```bash
zenflow daemon stop
```

---

## CLI Command Reference

### Sync Commands

| Command | Description |
|---------|-------------|
| `zenflow sync auto [--dry-run]` | Sync all active worktrees |
| `zenflow sync worktree <name> [--force] [--dry-run]` | Sync specific worktree |
| `zenflow sync list [--since DATE] [--status STATUS] [--limit N]` | List sync history |
| `zenflow sync show <sync-id>` | Show sync details |
| `zenflow sync rollback <sync-id>` | Rollback a sync |

### Rule Commands

| Command | Description |
|---------|-------------|
| `zenflow rule list [--enabled\|--disabled]` | List all rules |
| `zenflow rule show <rule-name>` | Show rule details |
| `zenflow rule validate <file>` | Validate a rule YAML file |
| `zenflow rule enable <rule-name>` | Enable a rule |
| `zenflow rule disable <rule-name>` | Disable a rule |
| `zenflow rule test <rule-name> [--event JSON]` | Test rule with event |

### Workflow Commands

| Command | Description |
|---------|-------------|
| `zenflow workflow list` | List all workflows |
| `zenflow workflow show <workflow-name>` | Show workflow details |
| `zenflow workflow run <name> [--input key=value]` | Run a workflow manually |
| `zenflow workflow validate <file>` | Validate a workflow YAML file |
| `zenflow workflow status <execution-id>` | Show execution status |
| `zenflow workflow logs <execution-id>` | Show execution logs |

### Daemon Commands

| Command | Description |
|---------|-------------|
| `zenflow daemon start` | Start background daemon |
| `zenflow daemon stop` | Stop daemon gracefully |
| `zenflow daemon restart` | Restart daemon |
| `zenflow daemon logs [--follow] [--lines N]` | View daemon logs |

### Status Commands

| Command | Description |
|---------|-------------|
| `zenflow status` | Overall system status |
| `zenflow status worktrees` | List worktrees with sync status |
| `zenflow status service` | Daemon service status |

### Global Options

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Enable verbose output |
| `-q, --quiet` | Suppress non-essential output |
| `-c, --config <path>` | Path to config file (default: `.zenflow/settings.json`) |
| `--json` | Output in JSON format |
| `--help` | Show help for any command |
| `--version` | Show Zenflow version |

---

## Configuration

### Sync Configuration

Edit `.zenflow/settings.json`:

```json
{
  "sync": {
    "enabled": true,
    "auto_push": false,
    "max_retries": 3,
    "timeout": 300,
    "conflict_strategy": "abort",
    "excluded_worktrees": [],
    "notification_channels": ["console", "log"],
    "verification_commands": ["npm run lint", "npm run typecheck"]
  }
}
```

**Options:**
- **enabled**: Master switch for sync functionality
- **auto_push**: Automatically push to remote after sync
- **max_retries**: Number of retry attempts on failure
- **timeout**: Maximum sync duration in seconds
- **conflict_strategy**: `abort` | `force` | `manual`
- **excluded_worktrees**: Array of worktree branch patterns to exclude
- **notification_channels**: Where to send notifications (`console`, `log`, `email`)
- **verification_commands**: Commands to run after sync

### Rule Configuration

```json
{
  "rules": {
    "directory": ".zenflow/rules",
    "auto_load": true,
    "validation_strict": true
  }
}
```

### Workflow Configuration

```json
{
  "workflows": {
    "directory": ".zenflow/workflows",
    "state_directory": ".zenflow/state/executions",
    "max_concurrent": 1
  }
}
```

### Logging Configuration

```json
{
  "logging": {
    "level": "info",
    "directory": ".zenflow/logs",
    "console": true,
    "file": true,
    "rotation": {
      "max_size": "10M",
      "max_files": 7
    }
  }
}
```

---

## Common Issues

### Sync Fails with Conflicts

**Problem**: `zenflow sync worktree <name>` reports conflicts

**Solution**:
1. Check which files conflict:
   ```bash
   zenflow sync show <sync-id>
   ```
2. Manually resolve conflicts in the worktree:
   ```bash
   cd /path/to/worktree
   git merge main
   # Resolve conflicts
   git commit
   ```
3. Retry sync:
   ```bash
   zenflow sync worktree <name>
   ```

### Sync Takes Too Long

**Problem**: Sync timeout exceeded

**Solution**:
1. Increase timeout in `.zenflow/settings.json`:
   ```json
   "sync": {
     "timeout": 600
   }
   ```
2. Check network connectivity if auto-push is enabled
3. Review verification commands (lint/typecheck) performance

### Worktree Not Found

**Problem**: `Worktree not found: <name>`

**Solution**:
1. List active worktrees:
   ```bash
   git worktree list
   ```
2. Use exact branch name:
   ```bash
   zenflow sync worktree feature-auth-abc1
   ```

### Rollback Failed

**Problem**: Cannot rollback sync (no backup point)

**Reason**: Backup creation was skipped or failed

**Solution**:
1. Manually revert the merge commit:
   ```bash
   git log --oneline | head -5  # Find merge commit
   git reset --hard HEAD~1      # Reset to before merge
   ```
2. Check logs for backup failures:
   ```bash
   zenflow daemon logs --lines 100 | grep backup
   ```

### Permission Denied Errors

**Problem**: `EACCES: permission denied`

**Solution**:
1. Check log directory permissions:
   ```bash
   ls -la .zenflow/logs
   chmod 755 .zenflow/logs
   ```
2. Check state directory:
   ```bash
   chmod 755 .zenflow/state
   ```

### Hook Not Triggering

**Problem**: Commits don't trigger automatic sync

**Solution**:
1. Verify hook exists:
   ```bash
   cat /path/to/worktree/.git/hooks/post-commit
   ```
2. Check hook is executable:
   ```bash
   chmod +x /path/to/worktree/.git/hooks/post-commit
   ```
3. Test hook manually:
   ```bash
   cd /path/to/worktree
   .git/hooks/post-commit
   ```

---

## Getting Help

### Command Help

Get help for any command:

```bash
zenflow --help
zenflow sync --help
zenflow workflow run --help
```

### Check Logs

View detailed logs:

```bash
# Daemon logs
zenflow daemon logs --follow

# Workflow execution logs
zenflow workflow logs <execution-id>

# System logs
tail -f .zenflow/logs/zenflow.log
```

### Debug Mode

Enable verbose output for detailed debugging:

```bash
zenflow --verbose sync worktree <name>
```

### Validate Configuration

Test your rules and workflows:

```bash
zenflow rule validate .zenflow/rules/sync/worktree-to-main.yaml
zenflow workflow validate .zenflow/workflows/sync-worktree-to-main.yaml
```

---

## Next Steps

- **Custom Rules**: Learn to create custom automation rules
- **Custom Workflows**: Build workflows for your specific needs
- **Advanced Configuration**: Fine-tune performance and behavior
- **Monitoring**: Set up alerts and dashboards

For more information, see:
- [Examples Guide](./zenflow-examples.md)
- [Troubleshooting Guide](./zenflow-troubleshooting.md)
- [Technical Documentation](./zenflow-architecture.md) (for developers)
