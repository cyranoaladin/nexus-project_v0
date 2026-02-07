# Zenflow Troubleshooting Guide

This guide helps you diagnose and resolve common issues with Zenflow.

## Table of Contents

1. [How to Check Logs](#how-to-check-logs)
2. [Common Error Messages](#common-error-messages)
3. [How to Rollback](#how-to-rollback)
4. [How to Disable Automation](#how-to-disable-automation)
5. [Performance Issues](#performance-issues)
6. [Configuration Problems](#configuration-problems)
7. [Git and Worktree Issues](#git-and-worktree-issues)
8. [Advanced Debugging](#advanced-debugging)

---

## How to Check Logs

Logs are essential for diagnosing issues in Zenflow.

### Daemon Logs

View real-time daemon logs:

```bash
zenflow daemon logs --follow
```

View last 100 lines:

```bash
zenflow daemon logs --lines 100
```

**Log Location:** `.zenflow/logs/daemon.log`

### Workflow Execution Logs

View logs for a specific workflow execution:

```bash
# Get execution ID from workflow run
zenflow workflow run sync-worktree-to-main --input worktree_branch=feature-abc

# View logs
zenflow workflow logs <execution-id>
```

### System Logs

Direct file access:

```bash
# Main Zenflow log
tail -f .zenflow/logs/zenflow.log

# Sync operation logs
tail -f .zenflow/logs/sync.log

# Error logs
tail -f .zenflow/logs/error.log
```

### Log Levels

Logs are organized by severity:

- **DEBUG**: Detailed diagnostic information
- **INFO**: General informational messages
- **WARN**: Warning messages (non-critical issues)
- **ERROR**: Error messages (critical issues)

Filter logs by level:

```bash
grep "ERROR" .zenflow/logs/zenflow.log
grep "WARN" .zenflow/logs/zenflow.log
```

### Enable Verbose Logging

For detailed output:

```bash
zenflow --verbose sync worktree feature-abc
```

Or set in configuration (`.zenflow/settings.json`):

```json
{
  "logging": {
    "level": "debug"
  }
}
```

---

## Common Error Messages

### 1. "Worktree not found"

**Error:**
```
Error: Worktree not found: feature-login-abc
```

**Cause:** The specified worktree doesn't exist or the branch name is incorrect.

**Solution:**

1. List active worktrees:
   ```bash
   git worktree list
   ```

2. Use the exact branch name shown:
   ```bash
   zenflow sync worktree feature-login-abc1
   ```

3. Verify worktree path exists:
   ```bash
   ls /path/to/worktree
   ```

### 2. "Merge conflicts detected"

**Error:**
```
Error: Merge conflicts detected
Conflicted files:
  - src/api/routes.ts
  - package.json
```

**Cause:** Changes in worktree conflict with main branch.

**Solution:**

**Option A: Manually Resolve**
```bash
cd /path/to/worktree
git merge main
# Resolve conflicts in editor
git add .
git commit -m "chore: resolve merge conflicts"
zenflow sync worktree <branch>
```

**Option B: Use Force (Dangerous)**
```bash
zenflow sync worktree <branch> --force
```
⚠️ This will favor worktree changes and may overwrite main.

**Option C: Abandon Worktree Changes**
```bash
cd /path/to/worktree
git reset --hard origin/main
```

### 3. "Sync timeout exceeded"

**Error:**
```
Error: Sync operation timed out after 300 seconds
```

**Cause:** Sync took longer than configured timeout.

**Solution:**

1. Increase timeout in `.zenflow/settings.json`:
   ```json
   {
     "sync": {
       "timeout": 600
     }
   }
   ```

2. Check if network is slow (if auto-push enabled):
   ```bash
   ping github.com
   ```

3. Optimize verification commands:
   ```json
   {
     "sync": {
       "verification_commands": []
     }
   }
   ```

### 4. "Insufficient disk space"

**Error:**
```
Error: Insufficient disk space (required: 1GB, available: 500MB)
```

**Cause:** Not enough free disk space for safe operations.

**Solution:**

1. Free up disk space:
   ```bash
   # Remove old backups
   git stash list | grep zenflow-backup
   git stash drop stash@{0}

   # Clean Git cache
   git gc --aggressive --prune=now

   # Remove node_modules
   rm -rf node_modules
   npm install
   ```

2. Lower disk space requirement in `.zenflow/settings.json`:
   ```json
   {
     "sync": {
       "min_disk_space_gb": 0.5
     }
   }
   ```

### 5. "Permission denied"

**Error:**
```
Error: EACCES: permission denied, open '.zenflow/logs/zenflow.log'
```

**Cause:** Insufficient file permissions.

**Solution:**

```bash
# Fix log directory permissions
chmod 755 .zenflow/logs
chmod 644 .zenflow/logs/*.log

# Fix state directory
chmod 755 .zenflow/state
chmod 755 .zenflow/state/executions

# Fix settings file
chmod 644 .zenflow/settings.json
```

If running as different user:
```bash
sudo chown -R $USER:$USER .zenflow
```

### 6. "No rollback point available"

**Error:**
```
Error: No rollback point available for sync operation
```

**Cause:** Backup wasn't created before sync (dry-run mode or backup failed).

**Solution:**

1. Manually revert the merge:
   ```bash
   git log --oneline | head -5
   git reset --hard <commit-before-merge>
   ```

2. Check if stash exists:
   ```bash
   git stash list | grep zenflow-backup
   git stash pop stash@{0}  # If found
   ```

3. Restore from Git reflog:
   ```bash
   git reflog
   git reset --hard HEAD@{1}
   ```

### 7. "Rule validation failed"

**Error:**
```
Error: Rule validation failed:
  - Invalid trigger type: commit_hook
  - Missing required field: actions
```

**Cause:** Rule YAML file has syntax or schema errors.

**Solution:**

1. Validate the rule file:
   ```bash
   zenflow rule validate .zenflow/rules/my-rule.yaml
   ```

2. Check YAML syntax:
   ```bash
   # Install yamllint
   npm install -g yaml-lint
   
   # Validate
   yamllint .zenflow/rules/my-rule.yaml
   ```

3. Review rule schema in documentation or existing rules:
   ```bash
   cat .zenflow/rules/sync/worktree-to-main.yaml
   ```

### 8. "Workflow execution failed"

**Error:**
```
Error: Workflow execution failed at step: merge-changes
Exit code: 1
```

**Cause:** A workflow step encountered an error.

**Solution:**

1. View detailed execution logs:
   ```bash
   zenflow workflow logs <execution-id>
   ```

2. Check specific step output:
   ```bash
   cat .zenflow/state/executions/<execution-id>.json | jq '.steps[] | select(.step_id == "merge-changes")'
   ```

3. Run step manually to debug:
   ```bash
   # Copy command from workflow YAML
   git merge --no-ff feature-branch -m "test merge"
   ```

### 9. "Git hook not executable"

**Error:**
```
Error: .git/hooks/post-commit: Permission denied
```

**Cause:** Git hook file doesn't have execute permissions.

**Solution:**

```bash
# Make hook executable
chmod +x /path/to/worktree/.git/hooks/post-commit

# Verify
ls -la /path/to/worktree/.git/hooks/post-commit
```

Reinstall hooks:
```bash
bash scripts/zenflow/install-hooks.sh
```

### 10. "Invalid configuration"

**Error:**
```
Error: Invalid configuration: sync.timeout must be a number
```

**Cause:** Configuration file has invalid values.

**Solution:**

1. Validate JSON syntax:
   ```bash
   cat .zenflow/settings.json | jq '.'
   ```

2. Fix the error:
   ```json
   {
     "sync": {
       "timeout": 300
     }
   }
   ```

3. Reset to defaults if corrupted:
   ```bash
   cp .zenflow/settings.json .zenflow/settings.json.backup
   # Restore from git or recreate
   ```

---

## How to Rollback

### Rollback a Single Sync

```bash
# Find the sync ID
zenflow sync list --limit 10

# View details
zenflow sync show <sync-id>

# Rollback
zenflow sync rollback <sync-id>
```

### Rollback Multiple Syncs

```bash
#!/bin/bash
# rollback-multiple.sh

# Get last 3 sync IDs
sync_ids=$(zenflow sync list --limit 3 --json | jq -r '.[].id')

for sync_id in $sync_ids; do
  echo "Rolling back $sync_id..."
  zenflow sync rollback "$sync_id"
done
```

### Manual Rollback (No Backup)

If no backup exists, manually revert:

```bash
# View recent commits
git log --oneline -10

# Find the merge commit (looks like "chore: merge feature-...")
git log --grep="chore: merge"

# Reset to before that commit
git reset --hard <commit-hash-before-merge>

# Force push if already pushed
git push --force origin main
```

### Rollback with Git Reflog

If you've lost the commit hash:

```bash
# View reflog
git reflog

# Find the state before merge
# Look for entries like "HEAD@{1}: merge feature-..."

# Reset to previous state
git reset --hard HEAD@{2}
```

---

## How to Disable Automation

### Temporary Disable (Keep Configuration)

#### Disable the Sync Rule

```bash
zenflow rule disable worktree-to-main-sync
```

Verify:
```bash
zenflow rule list --disabled
```

Re-enable later:
```bash
zenflow rule enable worktree-to-main-sync
```

#### Stop the Daemon

```bash
zenflow daemon stop
```

Check status:
```bash
zenflow status service
```

### Permanent Disable

#### Remove Git Hooks

```bash
# In each worktree
rm /path/to/worktree/.git/hooks/post-commit
```

Or use uninstall script (if available):
```bash
bash scripts/zenflow/uninstall-hooks.sh
```

#### Disable in Configuration

Edit `.zenflow/settings.json`:

```json
{
  "sync": {
    "enabled": false
  }
}
```

### Disable for Specific Worktrees

Exclude certain worktrees from auto-sync:

```json
{
  "sync": {
    "excluded_worktrees": [
      "experiment-*",
      "wip-*",
      "temp-*"
    ]
  }
}
```

### Emergency Stop

If Zenflow is causing issues:

```bash
# Stop daemon immediately
pkill -f zenflow-daemon

# Disable all rules
for rule in $(zenflow rule list --json | jq -r '.[].name'); do
  zenflow rule disable "$rule"
done

# Remove all hooks
find . -name "post-commit" -path "*/.git/hooks/*" -delete
```

---

## Performance Issues

### Slow Sync Operations

**Symptom:** Sync takes >5 minutes

**Diagnosis:**

1. Check what's slow:
   ```bash
   time zenflow sync worktree <branch> --dry-run
   ```

2. Profile workflow steps:
   ```bash
   zenflow workflow logs <execution-id> | grep "Duration:"
   ```

**Solutions:**

1. **Disable verification commands:**
   ```json
   {
     "sync": {
       "verification_commands": []
     }
   }
   ```

2. **Increase timeout:**
   ```json
   {
     "sync": {
       "timeout": 900
     }
   }
   ```

3. **Optimize Git operations:**
   ```bash
   git config core.preloadindex true
   git config core.fscache true
   git config gc.auto 256
   ```

4. **Exclude large files from diff:**
   Add to `.gitattributes`:
   ```
   *.log binary
   *.bin binary
   node_modules/** binary
   ```

### High CPU Usage

**Symptom:** Zenflow daemon using >50% CPU

**Diagnosis:**

```bash
top -p $(pgrep -f zenflow-daemon)
```

**Solutions:**

1. **Reduce event polling frequency:**
   ```json
   {
     "daemon": {
       "poll_interval_ms": 5000
     }
   }
   ```

2. **Limit concurrent workflows:**
   ```json
   {
     "workflows": {
       "max_concurrent": 1
     }
   }
   ```

3. **Restart daemon:**
   ```bash
   zenflow daemon restart
   ```

### High Memory Usage

**Symptom:** Zenflow using >500MB RAM

**Diagnosis:**

```bash
ps aux | grep zenflow
```

**Solutions:**

1. **Clear workflow execution history:**
   ```bash
   rm -rf .zenflow/state/executions/*.json
   ```

2. **Reduce log retention:**
   ```json
   {
     "logging": {
       "rotation": {
         "max_files": 3
       }
     }
   }
   ```

3. **Restart daemon periodically:**
   ```cron
   0 0 * * * zenflow daemon restart
   ```

---

## Configuration Problems

### Settings Not Applied

**Symptom:** Changes to `.zenflow/settings.json` don't take effect

**Solution:**

1. Restart daemon to reload config:
   ```bash
   zenflow daemon restart
   ```

2. Verify JSON syntax:
   ```bash
   cat .zenflow/settings.json | jq '.'
   ```

3. Check file permissions:
   ```bash
   ls -la .zenflow/settings.json
   chmod 644 .zenflow/settings.json
   ```

### Reset to Default Configuration

```bash
# Backup current config
cp .zenflow/settings.json .zenflow/settings.json.backup

# Restore from Git
git checkout .zenflow/settings.json

# Or create minimal config
cat > .zenflow/settings.json << 'EOF'
{
  "sync": {
    "enabled": true,
    "timeout": 300
  }
}
EOF
```

---

## Git and Worktree Issues

### Worktree in Detached HEAD State

**Symptom:** Zenflow can't sync worktree in detached HEAD

**Solution:**

```bash
cd /path/to/worktree
git checkout <branch-name>
zenflow sync worktree <branch-name>
```

### Worktree Branch Deleted

**Symptom:** Worktree exists but branch was deleted

**Solution:**

```bash
# Remove stale worktree
git worktree remove /path/to/worktree

# Or prune all stale worktrees
git worktree prune
```

### Corrupted Worktree

**Symptom:** Git operations fail in worktree

**Solution:**

```bash
# Check repository health
cd /path/to/worktree
git fsck

# Repair if issues found
git gc --aggressive

# If still broken, recreate worktree
cd /main/repo
git worktree remove /path/to/worktree
git worktree add /path/to/worktree <branch>
```

---

## Advanced Debugging

### Enable Debug Mode

Set environment variable:

```bash
export ZENFLOW_DEBUG=1
zenflow sync worktree feature-abc
```

Or in code, edit `.zenflow/cli/index.ts`:

```typescript
const DEBUG = process.env.ZENFLOW_DEBUG === '1';
if (DEBUG) {
  console.log('Debug: ...', data);
}
```

### Trace Workflow Execution

Add debug steps to workflow:

```yaml
steps:
  - id: debug-env
    name: Debug Environment
    type: shell
    command: |
      echo "=== DEBUG INFO ==="
      echo "PWD: $(pwd)"
      echo "Branch: $(git branch --show-current)"
      echo "Inputs: ${JSON.stringify(inputs)}"
      echo "=================="
```

### Inspect State Files

View sync operation state:

```bash
# List all sync operations
ls -la .zenflow/state/sync/

# View specific sync
cat .zenflow/state/sync/<sync-id>.json | jq '.'
```

View workflow execution state:

```bash
# List all executions
ls -la .zenflow/state/executions/

# View specific execution
cat .zenflow/state/executions/<execution-id>.json | jq '.'
```

### Network Debugging

If auto-push fails:

```bash
# Test GitHub connectivity
ssh -T git@github.com

# Test HTTPS
curl -I https://github.com

# Check Git remote
git remote -v

# Test push manually
git push origin main --dry-run
```

### Profile Performance

Use `time` to measure operations:

```bash
time zenflow sync worktree feature-abc

# Profile each step
time git diff main...feature-abc
time git merge-tree ...
time npm run lint
```

### Check for Resource Locks

If operations hang:

```bash
# Check for lock files
find .zenflow -name "*.lock"

# Remove stale locks
rm .zenflow/state/*.lock

# Check Git locks
find .git -name "*.lock"
```

---

## Getting More Help

### Report a Bug

If you've found a bug:

1. **Gather information:**
   ```bash
   zenflow --version
   git --version
   node --version
   uname -a
   ```

2. **Collect logs:**
   ```bash
   tail -100 .zenflow/logs/zenflow.log > zenflow-debug.log
   ```

3. **Create minimal reproduction:**
   - What command did you run?
   - What was the expected behavior?
   - What actually happened?
   - Can you reproduce it?

4. **Submit issue** with all information above

### Community Support

- **Documentation:** [User Guide](./zenflow-user-guide.md)
- **Examples:** [Examples Guide](./zenflow-examples.md)
- **Architecture:** [Technical Docs](./zenflow-architecture.md)

---

## Quick Reference: Troubleshooting Commands

```bash
# Check system status
zenflow status

# View recent syncs
zenflow sync list --limit 10

# Show sync details
zenflow sync show <sync-id>

# Rollback sync
zenflow sync rollback <sync-id>

# View daemon logs
zenflow daemon logs --follow

# Validate configuration
cat .zenflow/settings.json | jq '.'

# Test rule
zenflow rule test <rule-name>

# View workflow logs
zenflow workflow logs <execution-id>

# Enable verbose output
zenflow --verbose <command>

# Check worktrees
git worktree list

# View Git reflog
git reflog

# Check disk space
df -h .

# Check permissions
ls -la .zenflow/
```
