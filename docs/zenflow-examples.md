# Zenflow Examples

This guide provides practical examples for common Zenflow use cases.

## Table of Contents

1. [Syncing a Single Worktree](#syncing-a-single-worktree)
2. [Batch Sync All Worktrees](#batch-sync-all-worktrees)
3. [Handling Conflicts](#handling-conflicts)
4. [Custom Rules](#custom-rules)
5. [Custom Workflows](#custom-workflows)
6. [Advanced Scenarios](#advanced-scenarios)

---

## Syncing a Single Worktree

### Scenario: Manual Sync After Development

You've been working in a worktree and want to manually sync changes to main.

#### Step 1: Preview Changes

First, check what will be synced using dry-run:

```bash
zenflow sync worktree feature-login-a3f2 --dry-run
```

**Output:**
```
🔍 Running in dry-run mode (no changes will be applied)

🔄 Syncing worktree: feature-login-a3f2...

📊 Sync Result:

  Branch:     feature-login-a3f2
  Status:     ✅ success
  Started:    Jan 15, 2024, 10:30:45 AM
  Duration:   15s
  Files:      8 changed
  Insertions: +245
  Deletions:  -12

✨ Successfully synced feature-login-a3f2!
```

#### Step 2: Execute Sync

If the dry-run looks good, execute the actual sync:

```bash
zenflow sync worktree feature-login-a3f2
```

#### Step 3: Verify

Check the sync history:

```bash
zenflow sync list --limit 1
```

**Output:**
```
┌──────────┬─────────────────────┬────────┬───────┬──────────────────────┬──────────┐
│ Sync ID  │ Branch              │ Status │ Files │ Started              │ Duration │
├──────────┼─────────────────────┼────────┼───────┼──────────────────────┼──────────┤
│ a3f8b2c4 │ feature-login-a3f2  │ ✅     │ 8     │ Jan 15, 10:31:02 AM  │ 18s      │
└──────────┴─────────────────────┴────────┴───────┴──────────────────────┴──────────┘
```

### Scenario: Quick Feature Sync

You've finished a small feature and want to sync immediately:

```bash
# One-liner: sync and show result
zenflow sync worktree feature-button-fix-b7e1 && echo "✅ Sync complete!"
```

---

## Batch Sync All Worktrees

### Scenario: End-of-Day Sync

Sync all active worktrees at the end of your workday.

#### Step 1: Check What Will Sync

```bash
zenflow sync auto --dry-run
```

**Output:**
```
📋 Starting automatic sync for all active worktrees...

📊 Sync Summary:

┌─────────────────────────┬────────┬───────┬──────────┐
│ Branch                  │ Status │ Files │ Duration │
├─────────────────────────┼────────┼───────┼──────────┤
│ feature-dashboard-c4d2  │ ✅     │ 12    │ 22s      │
│ fix-typo-e8f3           │ ✅     │ 3     │ 8s       │
│ refactor-api-f2a1       │ ⚠️     │ 0     │ -        │
└─────────────────────────┴────────┴───────┴──────────┘

Total: 3 | Success: 2 | Conflicts: 1 | Failures: 0

⚠️  1 worktree(s) have conflicts. Use 'zenflow sync show <sync-id>' for details.
```

#### Step 2: Review Conflicts

For worktrees with conflicts, check details:

```bash
zenflow sync show f2a15c8b
```

#### Step 3: Sync Without Conflicts

Run the actual sync (only non-conflicting worktrees will sync):

```bash
zenflow sync auto
```

### Scenario: Selective Sync

Sync only specific worktrees using filters:

```bash
# Sync all feature branches
for branch in $(git worktree list | grep 'feature-' | awk '{print $NF}'); do
  zenflow sync worktree $branch
done
```

Or using a custom script:

```bash
#!/bin/bash
# sync-features.sh

BRANCHES=("feature-dashboard-c4d2" "feature-login-a3f2" "feature-profile-d5e3")

for branch in "${BRANCHES[@]}"; do
  echo "Syncing $branch..."
  zenflow sync worktree $branch || echo "❌ Failed: $branch"
done
```

---

## Handling Conflicts

### Scenario: Conflict During Sync

You attempt a sync but encounter conflicts.

#### Step 1: Attempt Sync

```bash
zenflow sync worktree feature-api-changes-g8h3
```

**Output:**
```
🔄 Syncing worktree: feature-api-changes-g8h3...

📊 Sync Result:

  Branch:     feature-api-changes-g8h3
  Status:     ⚠️  conflict
  Started:    Jan 15, 2024, 11:00:12 AM
  Duration:   5s
  Conflicts:  3 files

⚠️  Conflicts detected:
  - src/api/routes.ts
  - src/api/handlers.ts
  - package.json

Use --force to sync anyway, or resolve conflicts manually

⚠️  Sync aborted due to conflicts
```

#### Step 2: Resolve Conflicts Manually

Navigate to the worktree and merge main:

```bash
cd /path/to/worktree-feature-api-changes-g8h3
git merge main
```

**Resolve conflicts** in your editor, then:

```bash
git add .
git commit -m "chore: merge main and resolve conflicts"
```

#### Step 3: Retry Sync

```bash
zenflow sync worktree feature-api-changes-g8h3
```

**Output:**
```
✨ Successfully synced feature-api-changes-g8h3!
```

### Scenario: Force Sync (Override Conflicts)

**⚠️ Use with extreme caution!**

If you're certain your worktree changes should override main:

```bash
zenflow sync worktree feature-api-changes-g8h3 --force
```

This will:
- Skip conflict detection
- Force merge (favoring worktree changes)
- Potentially overwrite main branch code

**Always** review with `--dry-run --force` first.

---

## Custom Rules

### Scenario: Only Sync on Weekdays

Create a custom rule that only triggers automatic sync Monday-Friday.

#### Step 1: Create Rule File

Create `.zenflow/rules/sync/weekday-only-sync.yaml`:

```yaml
name: weekday-only-sync
version: 1.0.0
description: Sync worktrees only on weekdays (Mon-Fri)
author: your-name
enabled: true

triggers:
  - type: commit
    branches:
      pattern: "*-[a-f0-9]{4}"
    events:
      - post-commit

conditions:
  - type: branch_check
    not_branch: main
  
  - type: worktree_active
  
  - type: no_conflicts
    with_branch: main
  
  - type: custom_script
    script: |
      #!/bin/bash
      day=$(date +%u)  # 1=Monday, 7=Sunday
      if [ $day -ge 1 ] && [ $day -le 5 ]; then
        exit 0  # Weekday - allow sync
      else
        exit 1  # Weekend - block sync
      fi

actions:
  - type: run_workflow
    workflow: sync-worktree-to-main
    inputs:
      worktree_branch: "${trigger.branch}"
      commit_hash: "${trigger.commit}"
      dry_run: false

guards:
  max_retries: 3
  timeout: 600
  on_error: rollback
```

#### Step 2: Validate Rule

```bash
zenflow rule validate .zenflow/rules/sync/weekday-only-sync.yaml
```

#### Step 3: Disable Default Rule

```bash
zenflow rule disable worktree-to-main-sync
```

#### Step 4: Enable Custom Rule

```bash
zenflow rule enable weekday-only-sync
```

### Scenario: Sync Only After Tests Pass

Create a rule that only syncs if tests pass in the worktree.

```yaml
name: test-before-sync
version: 1.0.0
description: Only sync if tests pass in worktree
author: your-name
enabled: true

triggers:
  - type: commit
    branches:
      pattern: "*"

conditions:
  - type: custom_script
    script: |
      #!/bin/bash
      cd "${WORKTREE_PATH}"
      npm test
      exit $?

actions:
  - type: run_workflow
    workflow: sync-worktree-to-main
    inputs:
      worktree_branch: "${trigger.branch}"

guards:
  max_retries: 1
  timeout: 900
  on_error: abort
```

---

## Custom Workflows

### Scenario: Sync with Slack Notification

Create a workflow that syncs and sends a Slack notification on completion.

#### Create Workflow File

`.zenflow/workflows/sync-with-notification.yaml`:

```yaml
name: sync-with-notification
version: 1.0.0
description: Sync worktree and notify team via Slack
author: your-name

inputs:
  - name: worktree_branch
    type: string
    required: true
  
  - name: slack_webhook_url
    type: string
    required: true

steps:
  - id: validate-worktree
    name: Validate Worktree
    type: shell
    command: |
      git worktree list | grep -q "${inputs.worktree_branch}"

  - id: check-conflicts
    name: Check Conflicts
    type: shell
    command: |
      git merge-tree $(git merge-base main ${inputs.worktree_branch}) \
        main ${inputs.worktree_branch} | grep -q "<<<<<" && exit 1 || exit 0

  - id: merge-changes
    name: Merge to Main
    type: shell
    command: |
      git merge --no-ff ${inputs.worktree_branch} \
        -m "chore: merge ${inputs.worktree_branch}"

  - id: notify-slack
    name: Send Slack Notification
    type: shell
    command: |
      curl -X POST ${inputs.slack_webhook_url} \
        -H 'Content-Type: application/json' \
        -d '{
          "text": "✅ Successfully synced *${inputs.worktree_branch}* to main",
          "username": "Zenflow Bot",
          "icon_emoji": ":rocket:"
        }'

error_handling:
  strategy: rollback
  cleanup_steps:
    - name: Notify Failure
      type: shell
      command: |
        curl -X POST ${inputs.slack_webhook_url} \
          -H 'Content-Type: application/json' \
          -d '{
            "text": "❌ Failed to sync *${inputs.worktree_branch}*",
            "username": "Zenflow Bot",
            "icon_emoji": ":x:"
          }'
```

#### Run the Workflow

```bash
zenflow workflow run sync-with-notification \
  --input worktree_branch=feature-dashboard-c4d2 \
  --input slack_webhook_url=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Scenario: Sync with Deployment

Automatically deploy to staging after syncing to main.

```yaml
name: sync-and-deploy
version: 1.0.0
description: Sync to main and deploy to staging
author: your-name

inputs:
  - name: worktree_branch
    type: string
    required: true

steps:
  - id: sync-to-main
    name: Sync Changes
    type: workflow
    workflow: sync-worktree-to-main
    inputs:
      worktree_branch: ${inputs.worktree_branch}

  - id: build-app
    name: Build Application
    type: shell
    command: |
      npm run build
    timeout: 300

  - id: deploy-staging
    name: Deploy to Staging
    type: shell
    command: |
      npm run deploy:staging
    timeout: 600

  - id: run-smoke-tests
    name: Run Smoke Tests
    type: shell
    command: |
      npm run test:smoke -- --env staging
    timeout: 180

notifications:
  on_success:
    - type: log
      message: "✅ Deployed ${inputs.worktree_branch} to staging"
  on_failure:
    - type: log
      message: "❌ Deployment failed for ${inputs.worktree_branch}"
```

---

## Advanced Scenarios

### Scenario: Multi-Stage Sync Pipeline

Sync multiple worktrees in a specific order with dependencies.

```bash
#!/bin/bash
# sync-pipeline.sh

set -e  # Exit on error

echo "🚀 Starting multi-stage sync pipeline..."

# Stage 1: Sync shared components
echo "📦 Stage 1: Syncing shared components..."
zenflow sync worktree shared-components-a1b2

# Stage 2: Sync backend changes (depends on shared)
echo "⚙️  Stage 2: Syncing backend..."
zenflow sync worktree backend-api-c3d4

# Stage 3: Sync frontend (depends on shared and backend)
echo "🎨 Stage 3: Syncing frontend..."
zenflow sync worktree frontend-ui-e5f6

# Stage 4: Sync integration tests (depends on all)
echo "🧪 Stage 4: Syncing tests..."
zenflow sync worktree integration-tests-g7h8

echo "✅ Pipeline complete!"

# Show summary
zenflow sync list --limit 4
```

### Scenario: Conditional Sync Based on File Patterns

Only sync if specific file types changed.

```yaml
name: conditional-file-sync
version: 1.0.0
description: Only sync if TypeScript or JavaScript files changed
author: your-name
enabled: true

triggers:
  - type: commit
    branches:
      pattern: "*"

conditions:
  - type: custom_script
    script: |
      #!/bin/bash
      # Get changed files in last commit
      changed_files=$(git diff --name-only HEAD~1 HEAD)
      
      # Check if any .ts or .js files changed
      if echo "$changed_files" | grep -qE '\.(ts|js|tsx|jsx)$'; then
        exit 0  # Found matching files - allow sync
      else
        exit 1  # No matching files - skip sync
      fi

actions:
  - type: run_workflow
    workflow: sync-worktree-to-main
```

### Scenario: Parallel Sync with Concurrency Control

Sync multiple worktrees in parallel with a concurrency limit.

```bash
#!/bin/bash
# parallel-sync.sh

MAX_PARALLEL=3

# Get all worktree branches
worktrees=$(git worktree list | grep -v "(bare)" | awk '{print $NF}')

# Create temp directory for job management
mkdir -p /tmp/zenflow-parallel

# Function to sync single worktree
sync_worktree() {
  local branch=$1
  echo "Syncing $branch..."
  zenflow sync worktree "$branch" &> "/tmp/zenflow-parallel/${branch}.log"
  echo "✅ Completed: $branch"
}

export -f sync_worktree

# Run parallel syncs with limit
echo "$worktrees" | xargs -n 1 -P $MAX_PARALLEL -I {} bash -c 'sync_worktree "$@"' _ {}

echo "All syncs complete!"
cat /tmp/zenflow-parallel/*.log
```

### Scenario: Scheduled Automatic Sync

Use cron to schedule regular syncs.

#### Add to Crontab

```bash
crontab -e
```

Add these lines:

```cron
# Sync all worktrees every hour (Mon-Fri, 9am-6pm)
0 9-18 * * 1-5 cd /path/to/repo && zenflow sync auto >> /var/log/zenflow-cron.log 2>&1

# Full sync every night at 2am
0 2 * * * cd /path/to/repo && zenflow sync auto --force >> /var/log/zenflow-cron.log 2>&1
```

### Scenario: Rollback Multiple Syncs

If a series of syncs caused issues, rollback multiple operations.

```bash
#!/bin/bash
# rollback-last-n.sh

N=${1:-5}  # Default: rollback last 5 syncs

echo "Rolling back last $N syncs..."

# Get last N sync IDs
sync_ids=$(zenflow sync list --limit $N --json | jq -r '.[].id')

for sync_id in $sync_ids; do
  echo "Rolling back $sync_id..."
  zenflow sync rollback "$sync_id"
done

echo "✅ Rollback complete!"
```

Usage:
```bash
bash rollback-last-n.sh 3  # Rollback last 3 syncs
```

### Scenario: Sync Summary Report

Generate a weekly sync report.

```bash
#!/bin/bash
# sync-report.sh

SINCE="7 days ago"
OUTPUT_FILE="zenflow-weekly-report.md"

echo "# Zenflow Weekly Sync Report" > $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "**Period:** $(date -d "$SINCE" +%Y-%m-%d) to $(date +%Y-%m-%d)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Get sync data
syncs=$(zenflow sync list --since "$SINCE" --json)

# Total counts
total=$(echo "$syncs" | jq 'length')
success=$(echo "$syncs" | jq '[.[] | select(.status == "success")] | length')
conflicts=$(echo "$syncs" | jq '[.[] | select(.status == "conflict")] | length')
failures=$(echo "$syncs" | jq '[.[] | select(.status == "failure")] | length')

echo "## Summary" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "- **Total Syncs:** $total" >> $OUTPUT_FILE
echo "- **Successful:** $success" >> $OUTPUT_FILE
echo "- **Conflicts:** $conflicts" >> $OUTPUT_FILE
echo "- **Failures:** $failures" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Most active worktrees
echo "## Most Active Worktrees" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "$syncs" | jq -r 'group_by(.worktree_branch) | map({branch: .[0].worktree_branch, count: length}) | sort_by(.count) | reverse | .[] | "- **\(.branch):** \(.count) syncs"' >> $OUTPUT_FILE

echo "" >> $OUTPUT_FILE
echo "---" >> $OUTPUT_FILE
echo "*Generated on $(date)*" >> $OUTPUT_FILE

cat $OUTPUT_FILE
```

---

## Tips and Best Practices

### 1. Always Use Dry-Run First

Before syncing important changes:
```bash
zenflow sync worktree <branch> --dry-run
```

### 2. Check History Before Rollback

Always review sync details before rolling back:
```bash
zenflow sync show <sync-id>
```

### 3. Monitor Daemon Logs

Keep an eye on background operations:
```bash
zenflow daemon logs --follow
```

### 4. Validate Custom Rules/Workflows

Always validate before enabling:
```bash
zenflow rule validate <file>
zenflow workflow validate <file>
```

### 5. Use JSON Output for Scripting

Parse output programmatically:
```bash
zenflow sync list --json | jq '.[] | select(.status == "success")'
```

### 6. Set Appropriate Timeouts

For large repositories, increase timeout:
```json
{
  "sync": {
    "timeout": 600
  }
}
```

### 7. Exclude Experimental Worktrees

Prevent auto-sync for experimental work:
```json
{
  "sync": {
    "excluded_worktrees": ["experiment-*", "poc-*"]
  }
}
```

---

## Next Steps

- Review the [User Guide](./zenflow-user-guide.md) for detailed command reference
- Check the [Troubleshooting Guide](./zenflow-troubleshooting.md) if you encounter issues
- Explore the [Technical Documentation](./zenflow-architecture.md) to understand internals
