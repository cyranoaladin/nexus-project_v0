# Zenflow Operations Guide

**Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** Production

---

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Starting and Stopping](#starting-and-stopping)
5. [Monitoring](#monitoring)
6. [Log Management](#log-management)
7. [Performance Tuning](#performance-tuning)
8. [Backup and Recovery](#backup-and-recovery)
9. [Troubleshooting](#troubleshooting)
10. [Security Hardening](#security-hardening)

---

## 1. Deployment Overview

Zenflow can be deployed in three phases, each increasing the level of automation:

### Phase 1: Manual CLI (Recommended for Initial Setup)

**Description**: Run sync commands manually via CLI  
**Use Case**: Testing, validation, learning the system  
**Advantages**: Full control, easy to test, no background processes  
**Disadvantages**: Requires manual intervention

**Commands:**
```bash
# Sync single worktree
zenflow sync worktree feature/new-feature

# Sync all worktrees
zenflow sync auto

# Dry run to preview changes
zenflow sync auto --dry-run
```

### Phase 2: Cron-Based (Recommended for Semi-Automation)

**Description**: Schedule sync commands via cron  
**Use Case**: Periodic automatic sync without daemon  
**Advantages**: Simple, reliable, no daemon to manage  
**Disadvantages**: Fixed schedule, no real-time events

**Cron Configuration:**
```bash
# Edit crontab
crontab -e

# Add sync every 5 minutes
*/5 * * * * cd /path/to/repo && zenflow sync auto >> /var/log/zenflow-cron.log 2>&1

# Add sync every hour
0 * * * * cd /path/to/repo && zenflow sync auto >> /var/log/zenflow-cron.log 2>&1
```

### Phase 3: Daemon Service (Recommended for Full Automation)

**Description**: Background daemon with event-driven sync  
**Use Case**: Real-time automatic sync on every commit  
**Advantages**: Real-time, event-driven, no delays  
**Disadvantages**: Requires process management (PM2 or systemd)

**Process Management Options:**
- **PM2**: Node.js process manager (recommended)
- **systemd**: Linux system service
- **Docker**: Containerized deployment

---

## 2. Installation

### Prerequisites

```bash
# Check Node.js version (requires 20.x or higher)
node --version

# Check Git version (requires 2.25 or higher)
git --version

# Check npm version
npm --version
```

### Install Zenflow

```bash
# Navigate to repository
cd /path/to/repo

# Zenflow should already be installed as part of the project
# If not, ensure .zenflow directory exists
ls -la .zenflow/

# Build TypeScript (if needed)
cd .zenflow
npm run build

# Make CLI executable
chmod +x cli/index.ts

# Add CLI to PATH (optional)
npm link
```

### Verify Installation

```bash
# Check Zenflow CLI is accessible
zenflow --version

# Check help
zenflow --help

# Check status
zenflow status
```

---

## 3. Configuration

### Main Configuration File

Zenflow configuration is stored in `.zenflow/settings.json`:

```json
{
  "sync": {
    "enabled": true,
    "auto_push": false,
    "max_retries": 3,
    "timeout": 300,
    "conflict_strategy": "abort",
    "excluded_worktrees": ["temp-*", "experimental-*"],
    "notification_channels": ["console", "log"],
    "verification_commands": ["npm run lint", "npm run typecheck"]
  },
  "rules": {
    "directory": ".zenflow/rules",
    "auto_load": true,
    "validation_strict": true
  },
  "workflows": {
    "directory": ".zenflow/workflows",
    "state_directory": ".zenflow/state/executions",
    "max_concurrent": 1
  },
  "logging": {
    "level": "info",
    "directory": ".zenflow/logs",
    "rotation": "daily",
    "retention_days": 30,
    "max_size_mb": 100,
    "format": "text"
  },
  "git": {
    "main_directory": ".",
    "worktrees_directory": "../",
    "remote": "origin",
    "default_branch": "main"
  }
}
```

### Configuration Options

#### Sync Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable sync system |
| `auto_push` | boolean | `false` | Automatically push to remote after sync |
| `max_retries` | number | `3` | Max retry attempts on transient failures |
| `timeout` | number | `300` | Max sync duration in seconds |
| `conflict_strategy` | string | `"abort"` | How to handle conflicts: `abort` or `manual` |
| `excluded_worktrees` | string[] | `[]` | Branch patterns to exclude (glob patterns) |
| `notification_channels` | string[] | `["console", "log"]` | Where to send notifications |
| `verification_commands` | string[] | `[]` | Commands to run after sync (e.g., lint, test) |

#### Logging Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | string | `"info"` | Log level: `debug`, `info`, `warn`, `error` |
| `directory` | string | `".zenflow/logs"` | Log file directory |
| `rotation` | string | `"daily"` | Log rotation: `daily`, `hourly` |
| `retention_days` | number | `30` | Days to keep logs |
| `max_size_mb` | number | `100` | Max log file size in MB |
| `format` | string | `"text"` | Log format: `text`, `json` |

### Environment Variables

Zenflow can also be configured via environment variables:

```bash
# Set log level
export ZENFLOW_LOG_LEVEL=debug

# Disable auto-push
export ZENFLOW_AUTO_PUSH=false

# Set max concurrent workflows
export ZENFLOW_MAX_CONCURRENT=3
```

Environment variables override `settings.json` values.

---

## 4. Starting and Stopping

### Manual CLI Usage

No start/stop needed for manual CLI usage:

```bash
# Run sync manually
zenflow sync auto

# Check status
zenflow status
```

### Cron-Based Scheduling

```bash
# Enable cron job
crontab -e
# Add line: */5 * * * * cd /path/to/repo && zenflow sync auto

# Disable cron job
crontab -e
# Comment out or remove the line

# View cron logs
tail -f /var/log/zenflow-cron.log
```

### Daemon with PM2

#### Install PM2

```bash
npm install -g pm2
```

#### Start Daemon

```bash
# Start daemon
cd /path/to/repo
pm2 start .zenflow/daemon/server.ts --name zenflow-daemon -- /path/to/repo

# Start with auto-restart on system boot
pm2 startup
pm2 save
```

#### Stop Daemon

```bash
# Stop daemon
pm2 stop zenflow-daemon

# Stop and remove from PM2
pm2 delete zenflow-daemon
```

#### Restart Daemon

```bash
# Restart daemon
pm2 restart zenflow-daemon

# Reload (zero-downtime restart)
pm2 reload zenflow-daemon
```

#### Daemon Status

```bash
# Check daemon status
pm2 status

# Detailed info
pm2 info zenflow-daemon

# Real-time monitoring
pm2 monit
```

### Daemon with systemd

#### Create systemd Service

Create `/etc/systemd/system/zenflow.service`:

```ini
[Unit]
Description=Zenflow Sync Daemon
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/repo
ExecStart=/usr/bin/node /path/to/repo/.zenflow/daemon/server.ts /path/to/repo
Restart=on-failure
RestartSec=10s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

#### Start/Stop Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable zenflow

# Start service
sudo systemctl start zenflow

# Stop service
sudo systemctl stop zenflow

# Restart service
sudo systemctl restart zenflow

# Check status
sudo systemctl status zenflow
```

#### View Logs

```bash
# Follow logs
sudo journalctl -u zenflow -f

# View last 100 lines
sudo journalctl -u zenflow -n 100

# View logs since today
sudo journalctl -u zenflow --since today
```

---

## 5. Monitoring

### System Status

```bash
# Overall system status
zenflow status

# Worktree status
zenflow status worktrees

# Service status (daemon only)
zenflow status service
```

### Sync History

```bash
# View recent syncs
zenflow sync list --limit 10

# View syncs since yesterday
zenflow sync list --since "1 day ago"

# View failed syncs
zenflow sync list --status failure

# View sync details
zenflow sync show <sync-id>
```

### Workflow Executions

```bash
# List recent workflow executions
zenflow workflow list

# View execution details
zenflow workflow status <execution-id>

# View execution logs
zenflow workflow logs <execution-id>
```

### Rule Status

```bash
# List all rules
zenflow rule list

# List enabled rules
zenflow rule list --enabled

# View rule details
zenflow rule show worktree-to-main-sync
```

### Health Checks

Create a health check script for monitoring:

```bash
#!/bin/bash
# health-check.sh

# Check daemon is running (PM2)
if ! pm2 status zenflow-daemon | grep -q "online"; then
  echo "ERROR: Zenflow daemon is not running"
  exit 1
fi

# Check recent sync operations
FAILED_SYNCS=$(zenflow sync list --status failure --since "1 hour ago" --json | jq 'length')

if [ "$FAILED_SYNCS" -gt 5 ]; then
  echo "WARNING: $FAILED_SYNCS failed syncs in the last hour"
  exit 1
fi

# Check disk space
DISK_USAGE=$(df /path/to/repo | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
  echo "ERROR: Disk usage is $DISK_USAGE%"
  exit 1
fi

echo "OK: Zenflow is healthy"
exit 0
```

Schedule health checks with cron:

```bash
crontab -e
# Add: */15 * * * * /path/to/health-check.sh
```

---

## 6. Log Management

### Log Locations

- **Application Logs**: `.zenflow/logs/`
- **Daemon Logs (PM2)**: `~/.pm2/logs/`
- **Daemon Logs (systemd)**: `journalctl -u zenflow`
- **Cron Logs**: `/var/log/zenflow-cron.log` (or as configured)

### View Logs

```bash
# View latest application log
tail -f .zenflow/logs/zenflow-$(date +%Y-%m-%d).log

# View daemon logs (PM2)
pm2 logs zenflow-daemon --lines 100

# View daemon logs (systemd)
sudo journalctl -u zenflow -f

# Search logs for errors
grep -r "ERROR" .zenflow/logs/

# Search logs for specific sync
grep "sync-abc-123" .zenflow/logs/*.log
```

### Log Rotation

Logs are automatically rotated based on configuration:

- **Daily rotation**: New log file each day
- **Retention**: Old logs deleted after 30 days (configurable)
- **Max size**: Log file splits if exceeds 100MB (configurable)

**Manual Log Cleanup:**

```bash
# Remove logs older than 30 days
find .zenflow/logs -name "*.log" -mtime +30 -delete

# Compress old logs
find .zenflow/logs -name "*.log" -mtime +7 -exec gzip {} \;
```

### Log Level Configuration

Change log level in `.zenflow/settings.json`:

```json
{
  "logging": {
    "level": "debug"  // debug, info, warn, error
  }
}
```

Or via environment variable:

```bash
export ZENFLOW_LOG_LEVEL=debug
zenflow sync auto
```

**Log Levels:**

- **debug**: Detailed diagnostic information (verbose)
- **info**: General informational messages (default)
- **warn**: Warning messages, non-critical issues
- **error**: Error messages, critical issues only

---

## 7. Performance Tuning

### Optimize Sync Performance

#### 1. Reduce Verification Commands

Verification commands (lint, test) slow down sync:

```json
{
  "sync": {
    "verification_commands": []  // Disable for faster sync
  }
}
```

Run verification in CI/CD instead of during sync.

#### 2. Increase Timeout

For large repositories, increase timeout:

```json
{
  "sync": {
    "timeout": 600  // 10 minutes (default: 300)
  }
}
```

#### 3. Exclude Large Worktrees

Exclude worktrees that rarely sync:

```json
{
  "sync": {
    "excluded_worktrees": ["docs-*", "temp-*", "archive-*"]
  }
}
```

#### 4. Optimize Git Operations

Use Git's sparse checkout for large worktrees:

```bash
cd /path/to/worktree
git sparse-checkout init --cone
git sparse-checkout set src tests
```

### Monitor Performance

Track sync operation durations:

```bash
# View sync durations
zenflow sync list --json | jq '.[] | {branch: .worktree_branch, duration: (.completed_at - .started_at)}'
```

### Resource Limits

Set resource limits for daemon (systemd):

```ini
[Service]
MemoryLimit=512M
CPUQuota=50%
```

---

## 8. Backup and Recovery

### Backup Strategy

Zenflow automatically creates backups before merges using Git stash:

- **Automatic Stash**: Created before every merge operation
- **Rollback Point**: Stored in `SyncOperation.rollback_point`
- **Retention**: Stashes kept indefinitely (manual cleanup required)

### Manual Backup

```bash
# Create manual backup
cd /path/to/repo
git stash save "Manual backup before Zenflow operations - $(date)"

# List all stashes
git stash list

# Show stash contents
git stash show stash@{0}
```

### Rollback Operations

#### Rollback Single Sync

```bash
# Find sync ID
zenflow sync list --limit 10

# Rollback sync
zenflow sync rollback <sync-id>
```

#### Manual Rollback

If Zenflow rollback fails, use Git directly:

```bash
# Reset to previous commit
git reset --hard HEAD~1

# Restore from stash
git stash apply stash@{0}

# Restore specific files
git checkout HEAD~1 -- path/to/file
```

### State Backup

Backup Zenflow state directory:

```bash
# Backup state
tar -czf zenflow-state-$(date +%Y%m%d).tar.gz .zenflow/state/

# Restore state
tar -xzf zenflow-state-YYYYMMDD.tar.gz -C .
```

### Disaster Recovery

**Complete repository corruption:**

1. Stop Zenflow daemon
2. Clone fresh copy from remote
3. Re-apply worktree setup
4. Restore Zenflow state from backup
5. Resume operations

```bash
# Stop daemon
pm2 stop zenflow-daemon

# Clone fresh copy
cd /tmp
git clone <remote-url> fresh-repo
cd fresh-repo

# Restore state
tar -xzf /path/to/zenflow-state-backup.tar.gz

# Restart daemon
pm2 start zenflow-daemon
```

---

## 9. Troubleshooting

### Common Issues

#### 1. Sync Fails with "Conflicts Detected"

**Symptom**: Sync aborts with conflict error

**Solution**:
```bash
# View conflict details
zenflow sync show <sync-id>

# Resolve conflicts manually
cd /path/to/worktree
# Fix conflicts
git add .
git commit

# Retry sync
zenflow sync worktree <branch-name>
```

#### 2. Daemon Won't Start

**Symptom**: PM2 shows daemon as "errored"

**Diagnosis**:
```bash
# View error logs
pm2 logs zenflow-daemon --err

# Check if port is already in use
lsof -i :PORT

# Check file permissions
ls -la .zenflow/daemon/
```

**Solution**:
```bash
# Fix permissions
chmod +x .zenflow/daemon/server.ts

# Restart daemon
pm2 restart zenflow-daemon
```

#### 3. "Git Operation Failed" Error

**Symptom**: Git commands fail during sync

**Diagnosis**:
```bash
# Check Git status
cd /path/to/repo
git status

# Check for locks
ls -la .git/*.lock

# Check worktrees
git worktree list
```

**Solution**:
```bash
# Remove stale locks
rm -f .git/*.lock

# Repair Git repository
git fsck
git gc

# Prune stale worktrees
git worktree prune
```

#### 4. High Memory Usage

**Symptom**: Daemon consuming excessive memory

**Diagnosis**:
```bash
# Monitor memory
pm2 monit

# Check process memory
ps aux | grep zenflow
```

**Solution**:
```bash
# Restart daemon
pm2 restart zenflow-daemon

# Set memory limit (PM2)
pm2 start .zenflow/daemon/server.ts --max-memory-restart 500M

# Reduce max concurrent workflows
# Edit settings.json:
# "workflows": { "max_concurrent": 1 }
```

#### 5. Logs Not Rotating

**Symptom**: Log files growing too large

**Diagnosis**:
```bash
# Check log size
du -sh .zenflow/logs/

# Check rotation settings
cat .zenflow/settings.json | jq '.logging'
```

**Solution**:
```bash
# Manually rotate logs
mv .zenflow/logs/zenflow.log .zenflow/logs/zenflow-$(date +%Y%m%d).log

# Compress old logs
gzip .zenflow/logs/*.log

# Restart daemon to create new log
pm2 restart zenflow-daemon
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Temporary debug mode
ZENFLOW_LOG_LEVEL=debug zenflow sync auto

# Persistent debug mode
# Edit settings.json:
# "logging": { "level": "debug" }
pm2 restart zenflow-daemon
```

### Support Diagnostics

Collect diagnostic information:

```bash
#!/bin/bash
# collect-diagnostics.sh

echo "=== Zenflow Diagnostics ===" > diagnostics.txt
echo "" >> diagnostics.txt

echo "--- System Info ---" >> diagnostics.txt
uname -a >> diagnostics.txt
node --version >> diagnostics.txt
git --version >> diagnostics.txt
echo "" >> diagnostics.txt

echo "--- Zenflow Status ---" >> diagnostics.txt
zenflow status >> diagnostics.txt
echo "" >> diagnostics.txt

echo "--- Recent Syncs ---" >> diagnostics.txt
zenflow sync list --limit 10 >> diagnostics.txt
echo "" >> diagnostics.txt

echo "--- Recent Logs ---" >> diagnostics.txt
tail -n 100 .zenflow/logs/*.log >> diagnostics.txt
echo "" >> diagnostics.txt

echo "--- Configuration ---" >> diagnostics.txt
cat .zenflow/settings.json >> diagnostics.txt

echo "Diagnostics saved to diagnostics.txt"
```

---

## 10. Security Hardening

### File Permissions

Restrict access to Zenflow directories:

```bash
# Secure .zenflow directory
chmod 750 .zenflow
chmod 640 .zenflow/settings.json
chmod 640 .zenflow/state/**/*.json

# Secure logs
chmod 750 .zenflow/logs
chmod 640 .zenflow/logs/*.log
```

### Sensitive Data

Never commit secrets to Git:

```bash
# Add to .zenflowignore
echo "secrets/" >> .zenflowignore
echo "*.key" >> .zenflowignore
echo "*.pem" >> .zenflowignore
```

Verify no secrets in logs:

```bash
# Audit logs for secrets
grep -r "password\|secret\|token" .zenflow/logs/
```

### User Isolation

Run daemon as dedicated user:

```bash
# Create zenflow user
sudo useradd -r -s /bin/false zenflow

# Change ownership
sudo chown -R zenflow:zenflow /path/to/repo/.zenflow

# Update systemd service
# User=zenflow
```

### Network Security

Zenflow doesn't open network ports by default. If you add webhooks or APIs:

- Use HTTPS only
- Implement authentication
- Rate limit requests
- Validate all inputs

### Audit Logging

Enable audit logging for compliance:

```json
{
  "logging": {
    "format": "json",
    "audit": {
      "enabled": true,
      "events": ["sync", "rollback", "rule_execute"]
    }
  }
}
```

---

## Related Documentation

- [Architecture Documentation](./architecture.md) - System architecture
- [API Reference](./api-reference.md) - API documentation
- [Contributing Guide](./contributing.md) - How to extend Zenflow
