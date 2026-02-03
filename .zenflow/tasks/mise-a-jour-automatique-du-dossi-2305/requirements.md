# Product Requirements Document (PRD)
## Automatic Worktree-to-Main Directory Synchronization

**Version:** 1.0  
**Date:** 2026-02-03  
**Status:** Draft  
**Priority:** HIGH

---

## 1. Executive Summary

### 1.1 Purpose
Implement an automated, reliable, and traceable system for synchronizing changes from Git worktrees to the main working directory using Zenflow rules and workflows. This eliminates manual synchronization, reduces human error, and ensures the main directory remains the single source of truth.

### 1.2 Context

**Current State:**
- Main directory: `/home/alaeddine/Bureau/nexus-project_v0` (branch: `main`)
- 14 active worktrees under `/home/alaeddine/.zenflow/worktrees/`
- Worktree naming pattern: `<task-description>-<hash>`
- Manual merge process using Git commands
- Commit pattern: `chore: merge <branch-name> - <description>`
- No automation infrastructure exists

**Problem:**
- Manual synchronization is error-prone and easily forgotten
- Inconsistencies between worktrees and main directory
- No systematic tracking of what was synchronized and when
- Risk of conflicts being resolved incorrectly or silently
- Time-consuming manual process

**Opportunity:**
- Build robust automation using Zenflow framework
- Establish traceable, auditable synchronization process
- Enable safe, continuous integration from worktrees
- Create reusable patterns for future automation needs

### 1.3 Success Criteria

**Must Have:**
- ✅ Automated detection of worktree changes (commits, modifications)
- ✅ Safe, conflict-aware synchronization to main directory
- ✅ Comprehensive logging and traceability
- ✅ Zenflow rule system created and operational
- ✅ Zenflow workflow system created and operational
- ✅ Zero silent failures or data loss
- ✅ Documentation for operation and maintenance

**Should Have:**
- ✅ Rollback capability for failed synchronizations
- ✅ Notification system for conflicts or issues
- ✅ Performance optimization for large changesets
- ✅ Integration with existing CI/CD pipeline

**Nice to Have:**
- ✅ Visual dashboard for synchronization status
- ✅ Metrics and analytics on synchronization patterns
- ✅ Smart conflict resolution suggestions

---

## 2. Scope

### 2.1 In Scope

1. **Audit & Analysis**
   - Automated discovery of worktree structure
   - Branch association mapping
   - Commit pattern analysis
   - File exclusion detection

2. **Initial Synchronization**
   - One-time sync of all active worktrees to main
   - Conflict detection and reporting
   - Git history preservation
   - Validation of sync integrity

3. **Rule System (NEW)**
   - Zenflow rule definition format (YAML)
   - Rule storage structure (`rules/*.yaml`)
   - Rule execution engine
   - Rule validation and testing

4. **Workflow System (NEW)**
   - Zenflow workflow definition format (YAML)
   - Workflow orchestration engine
   - Step-by-step execution tracking
   - Workflow state management

5. **Automation**
   - Event-driven synchronization triggers
   - Automatic conflict detection
   - Safe file update mechanism
   - Atomic commit creation

6. **Safety & Guards**
   - Pre-sync validation
   - Conflict detection (no silent overwrites)
   - Detailed logging
   - Sanity checks before applying changes

7. **Documentation**
   - User guide for the synchronization system
   - Technical specification of rules and workflows
   - Troubleshooting guide
   - How to disable/enable automation

### 2.2 Out of Scope

- Migration of existing worktrees (they remain as-is)
- Bi-directional synchronization (main → worktrees)
- Real-time synchronization (acceptable delay: up to 5 minutes)
- GUI/Web interface (CLI-based is sufficient)
- Integration with external task management tools (Jira, etc.)

### 2.3 Assumptions

1. Git is the version control system (no SVN, Mercurial support needed)
2. All worktrees are in `/home/alaeddine/.zenflow/worktrees/`
3. Main directory is always `/home/alaeddine/Bureau/nexus-project_v0`
4. Users have appropriate file system permissions
5. Network connectivity to GitHub is available for pushes
6. Node.js runtime is available for script execution

### 2.4 Dependencies

- Git 2.25+ (for worktree support)
- Node.js 20.x (project standard)
- Bash 4.0+ (for shell scripts)
- `.zenflow/settings.json` configuration file
- Write access to main directory and worktrees

---

## 3. Current System Analysis

### 3.1 Existing Infrastructure

**Directory Structure:**
```
/home/alaeddine/Bureau/nexus-project_v0/           # Main directory (main branch)
├── .zenflow/
│   ├── settings.json                               # Project configuration
│   └── tasks/                                      # Task documentation
│       ├── <task-id-1>/
│       │   ├── requirements.md
│       │   ├── spec.md
│       │   └── plan.md
│       └── <task-id-2>/
│           └── ...

/home/alaeddine/.zenflow/worktrees/                 # Worktrees directory
├── configurer-les-fondations-tailwi-aae7/          # Worktree 1
├── developpement-des-composants-ui-2353/           # Worktree 2
├── mise-a-jour-automatique-du-dossi-2305/          # Current worktree
└── ... (11 more worktrees)
```

**Active Worktrees (14 total):**
1. `configurer-les-fondations-tailwi-aae7` (branch: `configurer-les-fondations-tailwi-aae7`)
2. `consolidation-du-projet-et-synch-a6f5` (branch: `consolidation-du-projet-et-synch-a6f5`)
3. `developpement-des-composants-ui-2353` (branch: `developpement-des-composants-ui-2353`)
4. `implementation-du-systeme-de-mon-0ac8` (branch: `implementation-du-systeme-de-mon-0ac8`)
5. `interface-coach-et-flux-de-repor-7198` (branch: `interface-coach-et-flux-de-repor-7198`)
6. `mise-a-jour-automatique-du-dossi-2305` (branch: `mise-a-jour-automatique-du-dossi-2305`)
7. `optimisation-et-securisation-du-d5ee` (branch: `optimisation-et-securisation-du-d5ee`)
8. `renforcement-de-la-securite-des-99f7` (branch: `renforcement-de-la-securite-des-99f7`)
9. `set-up-project-config-e738` (branch: `set-up-project-config-e738`)
10. `stage-fevrier-8a9a` (branch: `stage-fevrier-8a9a`)
11. `suivi-de-progression-et-facturat-1c59` (branch: `suivi-de-progression-et-facturat-1c59`)
12. `systeme-de-navigation-dynamique-ce16` (branch: `systeme-de-navigation-dynamique-ce16`)
13. `workspace-etudiant-et-interface-336b` (branch: `workspace-etudiant-et-interface-336b`)

**Current Merge Pattern:**
```bash
# Example from git log
da2a7a81 chore: merge systeme-de-navigation-dynamique-ce16 - Dynamic navigation system
7aff24b6 chore: merge renforcement-de-la-securite-des-99f7 - API security and rate limiting
8bdd5e17 chore: merge implementation-du-systeme-de-mon-0ac8 - Monitoring and error logging
```

### 3.2 Identified Gaps

1. **No Zenflow Rules Infrastructure**
   - No `rules/` directory exists
   - No rule definition format
   - No rule execution engine

2. **No Zenflow Workflows Infrastructure**
   - No `workflows/` directory exists
   - No workflow definition format
   - No workflow orchestration engine

3. **Manual Synchronization Process**
   - Requires developer intervention
   - No automatic detection of worktree changes
   - Prone to human error and oversights

4. **Limited Traceability**
   - No logs of what was synchronized
   - No record of which worktree triggered sync
   - No audit trail for debugging

5. **No Conflict Management**
   - Manual conflict resolution required
   - Risk of silent overwrites
   - No validation before applying changes

6. **No Exclusion Patterns**
   - No mechanism to exclude certain files/directories
   - Risk of syncing temporary or build artifacts

---

## 4. Functional Requirements

### 4.1 Audit & Discovery (Step 1)

**REQ-AUDIT-001: Worktree Discovery**
- **Priority:** P0 (Critical)
- **Description:** System must automatically discover and catalog all active worktrees
- **Acceptance Criteria:**
  - Execute `git worktree list` and parse output
  - Extract worktree path, branch name, and commit hash
  - Store metadata in structured format (JSON)
  - Detect stale/removed worktrees
  - Identify worktree vs main directory
  - Output discovery report

**REQ-AUDIT-002: Branch Association Analysis**
- **Priority:** P0 (Critical)
- **Description:** Map each worktree to its associated branch and commit history
- **Acceptance Criteria:**
  - Identify current branch for each worktree
  - Determine base branch (origin point from main)
  - Count commits ahead/behind main
  - Detect merged vs unmerged worktrees
  - Flag orphaned branches

**REQ-AUDIT-003: Commit Pattern Analysis**
- **Priority:** P1 (High)
- **Description:** Analyze existing commit patterns to guide automation
- **Acceptance Criteria:**
  - Parse commit messages for merge patterns
  - Extract task descriptions from merge commits
  - Identify commit message conventions
  - Detect anomalies or non-standard commits
  - Generate pattern statistics

**REQ-AUDIT-004: File Exclusion Detection**
- **Priority:** P1 (High)
- **Description:** Identify files/directories that should not be synchronized
- **Acceptance Criteria:**
  - Read `.gitignore` patterns
  - Detect build artifacts (`node_modules/`, `dist/`, `.next/`, etc.)
  - Identify temporary files (`*.log`, `*.tmp`, etc.)
  - Exclude IDE-specific files (`.vscode/`, `.idea/`)
  - Respect custom exclusion lists
  - Output exclusion report

**REQ-AUDIT-005: Audit Report Generation**
- **Priority:** P1 (High)
- **Description:** Generate comprehensive audit report before any sync
- **Acceptance Criteria:**
  - Structured JSON output
  - Human-readable summary
  - Highlighted issues/warnings
  - Recommendations for action
  - Timestamp and system metadata

### 4.2 Initial Synchronization (Step 2)

**REQ-SYNC-001: Diff Analysis**
- **Priority:** P0 (Critical)
- **Description:** Compare each worktree with main directory to identify changes
- **Acceptance Criteria:**
  - Execute `git diff main..<worktree-branch>` for each worktree
  - Categorize changes: modified, added, deleted
  - Calculate diff statistics (lines changed, files affected)
  - Identify binary vs text file changes
  - Flag large diffs (> 1000 lines) for review

**REQ-SYNC-002: Conflict Detection**
- **Priority:** P0 (Critical)
- **Description:** Detect conflicts before applying any changes
- **Acceptance Criteria:**
  - Identify files modified in both main and worktree
  - Check for overlapping line changes
  - Detect structural conflicts (moved/deleted files)
  - Report conflicts with context (file, lines, changes)
  - Abort sync if conflicts detected
  - Provide conflict resolution guidance

**REQ-SYNC-003: Safe File Update**
- **Priority:** P0 (Critical)
- **Description:** Apply changes from worktrees to main safely
- **Acceptance Criteria:**
  - Create backup before applying changes
  - Use atomic operations (all or nothing)
  - Preserve file permissions and attributes
  - Maintain Git history integrity
  - Validate changes after application
  - Rollback on failure

**REQ-SYNC-004: Commit Creation**
- **Priority:** P0 (Critical)
- **Description:** Create traceable commits in main directory
- **Acceptance Criteria:**
  - Follow existing commit pattern: `chore: merge <branch> - <description>`
  - Include worktree metadata (branch, commit hash, timestamp)
  - List affected files in commit body
  - Sign commits (if GPG configured)
  - Push to remote repository
  - Tag sync commits for easy filtering

**REQ-SYNC-005: Validation**
- **Priority:** P0 (Critical)
- **Description:** Validate synchronization integrity
- **Acceptance Criteria:**
  - Verify all intended changes were applied
  - Check no unintended changes occurred
  - Confirm Git status is clean
  - Run sanity checks (lint, typecheck if configured)
  - Generate validation report
  - Alert on validation failures

### 4.3 Zenflow Rule System (Step 3)

**REQ-RULE-001: Rule Definition Format**
- **Priority:** P0 (Critical)
- **Description:** Define YAML-based rule format for Zenflow
- **Acceptance Criteria:**
  - Rule schema with required fields:
    - `name`: Unique rule identifier
    - `description`: Human-readable explanation
    - `triggers`: Event conditions (commit, file change, schedule)
    - `conditions`: Preconditions for execution
    - `actions`: Operations to perform
    - `metadata`: Author, version, tags
  - Support for multiple rule types (sync, validation, notification)
  - YAML validation against schema
  - Example rules provided

**Example Rule Structure:**
```yaml
name: worktree-to-main-sync
version: 1.0.0
description: Automatically sync worktree changes to main directory
author: zenflow-system
enabled: true

triggers:
  - type: commit
    branches:
      - pattern: "*-[a-f0-9]{4}"  # Worktree branch pattern
    events:
      - push
      - commit

conditions:
  - type: branch_check
    not_branch: main
  - type: worktree_active
  - type: no_conflicts
    with_branch: main

actions:
  - type: run_workflow
    workflow: sync-worktree-to-main
    parameters:
      worktree_branch: ${trigger.branch}
      commit_hash: ${trigger.commit}

  - type: log
    level: info
    message: "Syncing ${trigger.branch} to main"

  - type: notify
    on_failure: true
    channels:
      - console
      - file: /var/log/zenflow/sync.log

guards:
  max_retries: 3
  timeout: 600  # 10 minutes
  on_error: rollback
```

**REQ-RULE-002: Rule Storage**
- **Priority:** P0 (Critical)
- **Description:** Establish rule storage structure
- **Acceptance Criteria:**
  - Rules stored in `.zenflow/rules/` directory
  - Subdirectories for organization: `sync/`, `validation/`, `notification/`
  - File naming: `<rule-name>.yaml`
  - Version control for rules
  - Rule discovery mechanism

**REQ-RULE-003: Rule Execution Engine**
- **Priority:** P0 (Critical)
- **Description:** Build engine to execute rules
- **Acceptance Criteria:**
  - Load and parse YAML rules
  - Validate rule syntax and schema
  - Evaluate triggers against events
  - Check conditions before execution
  - Execute actions sequentially
  - Handle errors and rollbacks
  - Log all executions
  - Support dry-run mode

**REQ-RULE-004: Rule Validation**
- **Priority:** P1 (High)
- **Description:** Validate rules before activation
- **Acceptance Criteria:**
  - Syntax validation (YAML parsing)
  - Schema validation (required fields, types)
  - Reference validation (workflows exist, actions valid)
  - Circular dependency detection
  - Performance impact assessment
  - Test mode for rule evaluation

**REQ-RULE-005: Rule Management CLI**
- **Priority:** P1 (High)
- **Description:** Provide CLI for rule management
- **Acceptance Criteria:**
  - `zenflow rule list` - List all rules
  - `zenflow rule show <name>` - Display rule details
  - `zenflow rule validate <file>` - Validate rule file
  - `zenflow rule enable <name>` - Enable rule
  - `zenflow rule disable <name>` - Disable rule
  - `zenflow rule test <name>` - Test rule execution

### 4.4 Zenflow Workflow System (Step 4)

**REQ-WORKFLOW-001: Workflow Definition Format**
- **Priority:** P0 (Critical)
- **Description:** Define YAML-based workflow format
- **Acceptance Criteria:**
  - Workflow schema with required fields:
    - `name`: Unique workflow identifier
    - `description`: Purpose of workflow
    - `steps`: Ordered list of operations
    - `inputs`: Parameters required
    - `outputs`: Results produced
    - `error_handling`: Failure recovery strategy
  - Support for conditional steps
  - Support for parallel execution
  - Step dependencies management

**Example Workflow Structure:**
```yaml
name: sync-worktree-to-main
version: 1.0.0
description: Synchronize a worktree branch to main directory
author: zenflow-system

inputs:
  - name: worktree_branch
    type: string
    required: true
    description: Branch name of the worktree to sync

  - name: commit_hash
    type: string
    required: true
    description: Commit hash that triggered the sync

  - name: dry_run
    type: boolean
    default: false
    description: Preview changes without applying

outputs:
  - name: sync_status
    type: string
    values: [success, conflict, failure]

  - name: files_changed
    type: array
    description: List of files modified

  - name: commit_id
    type: string
    description: Commit hash of sync in main

steps:
  - id: validate-worktree
    name: Validate Worktree Exists
    type: shell
    command: |
      git worktree list | grep -q "${inputs.worktree_branch}"
    on_failure: abort

  - id: check-conflicts
    name: Check for Conflicts
    type: shell
    command: |
      git diff --check main...${inputs.worktree_branch}
    on_failure: skip_to_step:report-conflicts

  - id: analyze-diff
    name: Analyze Differences
    type: shell
    command: |
      git diff --stat main...${inputs.worktree_branch} > /tmp/diff-stats.txt
      git diff --name-status main...${inputs.worktree_branch} > /tmp/diff-files.txt
    outputs:
      - diff_stats: /tmp/diff-stats.txt
      - diff_files: /tmp/diff-files.txt

  - id: backup-main
    name: Backup Main Directory
    type: shell
    command: |
      timestamp=$(date +%Y%m%d-%H%M%S)
      git stash push -m "pre-sync-backup-${timestamp}"
    unless: ${inputs.dry_run}

  - id: merge-changes
    name: Merge Worktree Changes
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      git merge --no-ff ${inputs.worktree_branch} -m "chore: merge ${inputs.worktree_branch} - Auto-sync from worktree"
    unless: ${inputs.dry_run}
    on_failure: rollback_to_step:backup-main

  - id: run-verification
    name: Run Verification Checks
    type: shell
    command: |
      npm run lint && npm run typecheck
    timeout: 300
    continue_on_error: true
    unless: ${inputs.dry_run}

  - id: create-sync-log
    name: Create Synchronization Log
    type: shell
    command: |
      cat > /var/log/zenflow/sync-${inputs.worktree_branch}.log <<EOF
      Sync Date: $(date -Iseconds)
      Worktree: ${inputs.worktree_branch}
      Commit: ${inputs.commit_hash}
      Files Changed: $(wc -l < /tmp/diff-files.txt)
      Status: success
      EOF

  - id: report-conflicts
    name: Report Conflicts
    type: shell
    when: step:check-conflicts == failure
    command: |
      echo "Conflicts detected between main and ${inputs.worktree_branch}"
      git diff main...${inputs.worktree_branch} --name-only --diff-filter=U
      exit 1

error_handling:
  strategy: rollback
  cleanup_steps:
    - name: Restore from backup
      command: git stash pop
      when: step:backup-main == success
    - name: Log failure
      command: |
        echo "Sync failed for ${inputs.worktree_branch}" >> /var/log/zenflow/failures.log

notifications:
  on_success:
    - type: log
      message: "Successfully synced ${inputs.worktree_branch} to main"
  on_failure:
    - type: log
      level: error
      message: "Failed to sync ${inputs.worktree_branch}: ${error.message}"
```

**REQ-WORKFLOW-002: Workflow Storage**
- **Priority:** P0 (Critical)
- **Description:** Establish workflow storage structure
- **Acceptance Criteria:**
  - Workflows stored in `.zenflow/workflows/` directory
  - File naming: `<workflow-name>.yaml`
  - Version control for workflows
  - Workflow discovery mechanism

**REQ-WORKFLOW-003: Workflow Orchestration Engine**
- **Priority:** P0 (Critical)
- **Description:** Build engine to execute workflows
- **Acceptance Criteria:**
  - Load and parse YAML workflows
  - Validate workflow syntax
  - Execute steps in order
  - Handle step dependencies
  - Support conditional execution
  - Support parallel steps (future)
  - Manage state between steps
  - Implement error handling and rollbacks
  - Capture outputs
  - Log execution trace

**REQ-WORKFLOW-004: Workflow State Management**
- **Priority:** P1 (High)
- **Description:** Track workflow execution state
- **Acceptance Criteria:**
  - Record workflow start/end times
  - Track current step
  - Store step outputs
  - Persist state to disk (survive restarts)
  - Support workflow resume after failure
  - Clean up old state files

**REQ-WORKFLOW-005: Workflow Management CLI**
- **Priority:** P1 (High)
- **Description:** Provide CLI for workflow management
- **Acceptance Criteria:**
  - `zenflow workflow list` - List all workflows
  - `zenflow workflow show <name>` - Display workflow details
  - `zenflow workflow run <name>` - Execute workflow
  - `zenflow workflow validate <file>` - Validate workflow file
  - `zenflow workflow status <id>` - Check execution status
  - `zenflow workflow logs <id>` - View execution logs

### 4.5 Automation (Step 5)

**REQ-AUTO-001: Event Detection**
- **Priority:** P0 (Critical)
- **Description:** Detect worktree events that trigger synchronization
- **Acceptance Criteria:**
  - Monitor worktree commits (via Git hooks)
  - Detect file modifications (via file system watchers)
  - Support scheduled synchronization (cron-like)
  - Debounce rapid events (batch commits within 1 minute)
  - Queue events for processing

**REQ-AUTO-002: Trigger Evaluation**
- **Priority:** P0 (Critical)
- **Description:** Evaluate if event should trigger sync
- **Acceptance Criteria:**
  - Check rule conditions
  - Verify worktree is active
  - Confirm no conflicts exist
  - Validate user permissions
  - Respect rate limits (max 1 sync per worktree per 5 minutes)

**REQ-AUTO-003: Automatic Execution**
- **Priority:** P0 (Critical)
- **Description:** Execute synchronization without manual intervention
- **Acceptance Criteria:**
  - Invoke workflow automatically
  - Pass event context to workflow
  - Handle concurrent sync attempts (lock mechanism)
  - Retry on transient failures (max 3 attempts)
  - Timeout long-running syncs (10 minutes)

**REQ-AUTO-004: Daemon/Service Mode**
- **Priority:** P1 (High)
- **Description:** Run Zenflow as background service
- **Acceptance Criteria:**
  - Start/stop service commands
  - Survive system restarts (systemd integration)
  - Graceful shutdown on signals
  - Health check endpoint
  - Resource limits (CPU, memory)

### 4.6 Safety & Guards (Step 6)

**REQ-GUARD-001: Pre-Sync Validation**
- **Priority:** P0 (Critical)
- **Description:** Validate conditions before starting sync
- **Acceptance Criteria:**
  - Check disk space (min 1GB free)
  - Verify Git repository is clean
  - Confirm network connectivity (for remote push)
  - Validate user permissions
  - Check for ongoing sync operations
  - Abort if validation fails

**REQ-GUARD-002: Conflict Detection**
- **Priority:** P0 (Critical)
- **Description:** Never apply conflicting changes silently
- **Acceptance Criteria:**
  - Detect merge conflicts before applying
  - Identify overlapping modifications
  - Report conflicts with file paths and line numbers
  - Halt sync and notify user
  - Provide conflict resolution guidance
  - Support manual intervention

**REQ-GUARD-003: Detailed Logging**
- **Priority:** P0 (Critical)
- **Description:** Log all sync operations comprehensively
- **Acceptance Criteria:**
  - Structured log format (JSON)
  - Minimum log fields:
    - Timestamp (ISO 8601)
    - Worktree branch
    - Commit hash
    - Action performed
    - Result (success/failure)
    - Error message (if failed)
    - User who triggered
    - Files affected
  - Log levels: DEBUG, INFO, WARN, ERROR
  - Log rotation (daily, max 30 days retention)
  - Searchable logs

**REQ-GUARD-004: Traceability**
- **Priority:** P0 (Critical)
- **Description:** Ensure every change is traceable to its source
- **Acceptance Criteria:**
  - Commit messages include worktree branch
  - Commit body lists affected files
  - Git notes with sync metadata
  - Log entry for every sync
  - Correlation ID for related operations

**REQ-GUARD-005: Rollback Capability**
- **Priority:** P1 (High)
- **Description:** Ability to undo failed or incorrect syncs
- **Acceptance Criteria:**
  - Automatic backup before sync
  - `zenflow sync rollback <sync-id>` command
  - Restore to pre-sync state
  - Preserve rollback history
  - Alert on rollback execution

**REQ-GUARD-006: Exclusion Enforcement**
- **Priority:** P1 (High)
- **Description:** Never sync excluded files/directories
- **Acceptance Criteria:**
  - Respect `.gitignore` patterns
  - Support custom exclusion list (`.zenflowignore`)
  - Exclude by default:
    - `node_modules/`
    - `.next/`, `dist/`, `build/`
    - `*.log`, `*.tmp`
    - `.env`, `.env.local`
    - IDE files (`.vscode/`, `.idea/`)
  - Log excluded files (DEBUG level)

### 4.7 Documentation (Step 7)

**REQ-DOC-001: User Guide**
- **Priority:** P1 (High)
- **Description:** Comprehensive guide for using the sync system
- **Contents:**
  - Overview of the system
  - How automation works
  - Manual sync commands
  - Conflict resolution procedures
  - Troubleshooting common issues
  - FAQ

**REQ-DOC-002: Technical Specification**
- **Priority:** P1 (High)
- **Description:** Detailed technical documentation
- **Contents:**
  - Architecture overview
  - Rule system specification
  - Workflow system specification
  - API reference
  - Configuration options
  - Extension points

**REQ-DOC-003: Operational Guide**
- **Priority:** P1 (High)
- **Description:** Guide for operating the sync system
- **Contents:**
  - How to enable/disable automation
  - How to add new rules
  - How to create custom workflows
  - Monitoring and alerting setup
  - Backup and recovery procedures
  - Performance tuning

**REQ-DOC-004: Inline Documentation**
- **Priority:** P2 (Medium)
- **Description:** Code-level documentation
- **Contents:**
  - Function/class docstrings
  - Inline comments for complex logic
  - Type annotations
  - Example usage

---

## 5. Non-Functional Requirements

### 5.1 Performance

**REQ-PERF-001: Sync Speed**
- Small changesets (< 10 files): Complete within 30 seconds
- Medium changesets (10-100 files): Complete within 2 minutes
- Large changesets (100+ files): Complete within 10 minutes

**REQ-PERF-002: Event Detection Latency**
- Detect commit events within 5 seconds
- Process events within 30 seconds of detection

**REQ-PERF-003: Resource Usage**
- CPU: < 5% average, < 50% peak
- Memory: < 200MB average, < 500MB peak
- Disk I/O: Non-blocking, async operations

### 5.2 Reliability

**REQ-REL-001: Availability**
- Sync service uptime: 99.9% (excluding planned maintenance)
- Automatic restart on crash
- Graceful degradation on partial failures

**REQ-REL-002: Data Integrity**
- Zero data loss during sync
- Atomic operations (all-or-nothing)
- Checksum validation of transferred files

**REQ-REL-003: Error Handling**
- All errors logged with context
- Automatic retry on transient failures (max 3 attempts)
- Rollback on critical failures
- User notification on persistent failures

### 5.3 Security

**REQ-SEC-001: Access Control**
- Only authorized users can trigger manual syncs
- Service runs with minimal required permissions
- Secrets (GitHub tokens) stored securely

**REQ-SEC-002: Audit Trail**
- All sync operations logged
- Log tampering detection (checksums)
- Retention period: 90 days minimum

**REQ-SEC-003: Input Validation**
- Validate all user inputs
- Sanitize file paths to prevent traversal attacks
- Validate Git commands before execution

### 5.4 Maintainability

**REQ-MAINT-001: Code Quality**
- TypeScript/Bash code follows project conventions
- Linting rules enforced
- Test coverage: > 80%

**REQ-MAINT-002: Modularity**
- Clear separation of concerns
- Reusable components
- Plugin architecture for extensibility

**REQ-MAINT-003: Observability**
- Comprehensive logging
- Metrics export (Prometheus-compatible)
- Health check endpoints

### 5.5 Usability

**REQ-USE-001: CLI Usability**
- Intuitive command structure
- Helpful error messages
- `--help` for all commands
- Colorized output for readability

**REQ-USE-002: Configuration**
- Sensible defaults (zero-config startup)
- Environment variable overrides
- Configuration validation on startup

---

## 6. User Stories

### 6.1 Developer Stories

**US-DEV-001: As a developer, I want changes in my worktree to automatically sync to main so that I don't have to manually merge.**
- **Acceptance Criteria:**
  - Commit to worktree branch
  - Sync happens automatically within 5 minutes
  - Changes appear in main directory
  - Receive notification on completion

**US-DEV-002: As a developer, I want to be notified if my sync has conflicts so that I can resolve them.**
- **Acceptance Criteria:**
  - Conflict detected before applying changes
  - Notification includes affected files
  - Guidance on how to resolve
  - Sync does not proceed until resolved

**US-DEV-003: As a developer, I want to manually trigger a sync when I need immediate synchronization.**
- **Acceptance Criteria:**
  - Run `zenflow sync --worktree <name>`
  - Sync executes immediately
  - Output shows progress and result

### 6.2 Admin Stories

**US-ADMIN-001: As an admin, I want to disable auto-sync temporarily for maintenance.**
- **Acceptance Criteria:**
  - Run `zenflow rule disable worktree-to-main-sync`
  - Auto-sync stops
  - Manual syncs still work
  - Re-enable with `zenflow rule enable worktree-to-main-sync`

**US-ADMIN-002: As an admin, I want to see all sync operations for auditing.**
- **Acceptance Criteria:**
  - Run `zenflow sync list --since <date>`
  - See all syncs with timestamps, worktrees, results
  - Filter by status (success/failure)
  - Export to JSON/CSV

**US-ADMIN-003: As an admin, I want to rollback a failed sync.**
- **Acceptance Criteria:**
  - Run `zenflow sync rollback <sync-id>`
  - Main directory restored to pre-sync state
  - Rollback logged

### 6.3 System Stories

**US-SYS-001: As the system, I want to handle multiple concurrent worktree commits without conflicts.**
- **Acceptance Criteria:**
  - Queue concurrent sync requests
  - Process one at a time (lock mechanism)
  - No race conditions
  - All syncs eventually complete

---

## 7. Edge Cases & Error Scenarios

### 7.1 Edge Cases

**EDGE-001: Worktree Deleted During Sync**
- **Handling:** Detect worktree removal, abort sync gracefully, log event

**EDGE-002: Network Failure During Remote Push**
- **Handling:** Retry up to 3 times with exponential backoff, queue for later if persistent

**EDGE-003: Disk Full During Sync**
- **Handling:** Detect low disk space before sync, abort if < 1GB free, alert admin

**EDGE-004: Simultaneous Commits to Multiple Worktrees**
- **Handling:** Queue syncs, process sequentially, maintain order by timestamp

**EDGE-005: Very Large Diff (> 10,000 files)**
- **Handling:** Warn user, request confirmation, increase timeout, chunk if possible

**EDGE-006: Binary File Conflicts**
- **Handling:** Detect binary conflicts, auto-fail sync, require manual resolution

### 7.2 Error Scenarios

**ERROR-001: Git Command Failure**
- **Examples:** `git merge` fails, `git diff` errors
- **Handling:** Log full error, rollback changes, notify user, provide recovery steps

**ERROR-002: Permission Denied**
- **Examples:** Cannot write to main directory, cannot execute Git
- **Handling:** Detect upfront, fail fast, alert admin, suggest permission fixes

**ERROR-003: Corrupted Git Repository**
- **Examples:** `.git` directory damaged, refs missing
- **Handling:** Detect via `git fsck`, abort all operations, alert admin for manual repair

**ERROR-004: Rule/Workflow Syntax Error**
- **Examples:** Invalid YAML, missing required fields
- **Handling:** Validate on load, reject invalid rules, log error, notify admin

**ERROR-005: Infinite Loop in Workflow**
- **Examples:** Circular dependencies, endless retries
- **Handling:** Detect cycles before execution, enforce timeout, kill runaway workflows

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
- Design rule and workflow schemas
- Implement YAML parser and validator
- Create basic rule execution engine
- Set up logging infrastructure
- Build CLI skeleton

### Phase 2: Core Sync Logic (Week 2)
- Implement worktree discovery
- Build diff analysis
- Create conflict detection
- Develop safe merge mechanism
- Add rollback capability

### Phase 3: Automation (Week 3)
- Set up event detection (Git hooks)
- Implement trigger evaluation
- Build workflow orchestration engine
- Add queueing and concurrency control
- Create daemon/service mode

### Phase 4: Safety & Testing (Week 4)
- Comprehensive pre-sync validation
- Extensive logging
- Error handling and recovery
- Unit and integration tests
- End-to-end testing

### Phase 5: Documentation & Polish (Week 5)
- Write user guide
- Create technical specification
- Build operational guide
- Add examples and tutorials
- Final testing and bug fixes

---

## 9. Success Metrics

### 9.1 Quantitative Metrics

- **Sync Success Rate:** > 95%
- **Average Sync Time:** < 2 minutes
- **False Conflict Rate:** < 5% (conflicts flagged but don't exist)
- **Missed Syncs:** 0 (all commits eventually synced)
- **Rollback Rate:** < 2% (syncs requiring rollback)
- **Service Uptime:** > 99%

### 9.2 Qualitative Metrics

- **User Satisfaction:** Developers report sync is "invisible" and "just works"
- **Confidence:** Developers trust sync won't lose or corrupt data
- **Maintainability:** New rules/workflows added without code changes
- **Debuggability:** Issues resolved quickly using logs

---

## 10. Risks & Mitigations

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data loss during sync | Critical | Low | Atomic operations, backups, extensive testing |
| Git conflicts not detected | High | Medium | Multiple conflict detection strategies, validation |
| Performance degradation | Medium | Medium | Async operations, queueing, resource limits |
| Service crashes | Medium | Low | Auto-restart, graceful shutdown, error handling |
| Disk space exhaustion | Medium | Low | Pre-sync space check, log rotation, alerting |

### 10.2 Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users bypass automation | Medium | High | Education, make automation reliable, monitor manually |
| Rules become too complex | Medium | Medium | Schema validation, documentation, examples |
| Log overflow | Low | Medium | Rotation, retention policy, compression |
| Maintenance burden | Medium | Low | Modular design, good documentation, monitoring |

### 10.3 Acceptance Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Developers don't trust automation | High | Medium | Transparency (logs), opt-out mechanism, gradual rollout |
| Too many false conflicts | Medium | Medium | Tune detection algorithm, allow overrides |
| Sync too slow | Medium | Low | Performance testing, optimization, async processing |

---

## 11. Open Questions & Decisions Required

### 11.1 Open Questions

1. **Q: Should sync push to remote (GitHub) automatically or only update local main?**
   - **Options:**
     - A) Auto-push after successful local sync
     - B) Queue for push, execute periodically
     - C) Only local sync, manual push
   - **Recommendation:** A (auto-push) for full automation, with rate limiting

2. **Q: How to handle worktrees that are far behind main (e.g., 100+ commits)?**
   - **Options:**
     - A) Force rebase before sync
     - B) Attempt merge, flag if complex
     - C) Require manual intervention
   - **Recommendation:** B, with threshold for auto-abort (e.g., > 50 commits behind)

3. **Q: Should we support parallel syncs from multiple worktrees?**
   - **Options:**
     - A) Sequential only (safer)
     - B) Parallel with conflict detection
   - **Recommendation:** A for Phase 1, B for Phase 2+

4. **Q: What to do with stale worktrees (no commits in > 30 days)?**
   - **Options:**
     - A) Archive automatically
     - B) Exclude from auto-sync, notify user
     - C) Ignore age, treat all equally
   - **Recommendation:** B, with configurable threshold

5. **Q: Should rules support custom JavaScript/TypeScript actions?**
   - **Options:**
     - A) Shell commands only (safer, simpler)
     - B) Support custom scripts (more flexible, riskier)
   - **Recommendation:** A for Phase 1, B for future extension

### 11.2 Decisions Required from Stakeholders

1. **Decision: Remote push behavior** (see Q1 above)
   - **Deadline:** Before Phase 2 implementation
   - **Decision Maker:** Tech Lead / DevOps

2. **Decision: Notification channels**
   - **Options:** Console only, Email, Slack, Webhook
   - **Deadline:** Before Phase 3 implementation
   - **Decision Maker:** Team Lead

3. **Decision: Service deployment model**
   - **Options:** Systemd service, Docker container, Manual execution
   - **Deadline:** Before Phase 3 implementation
   - **Decision Maker:** DevOps / Infrastructure

---

## 12. Dependencies & Prerequisites

### 12.1 Technical Dependencies

- **Git 2.25+:** Worktree support
- **Node.js 20.x:** Runtime for scripts
- **Bash 4.0+:** Shell script execution
- **YAML Parser:** `js-yaml` or similar
- **File System Watcher:** `chokidar` or `fs.watch`
- **Process Manager:** `systemd` or `pm2`

### 12.2 Access Requirements

- **Read/Write:** Main directory and all worktrees
- **Execute:** Git commands
- **Network:** Push to GitHub remote
- **Log Directory:** `/var/log/zenflow/` (or configurable)

### 12.3 Knowledge Prerequisites

- Understanding of Git worktrees
- YAML syntax
- Bash scripting
- Node.js/TypeScript
- Linux process management

---

## 13. Glossary

- **Worktree:** A Git feature allowing multiple working directories for the same repository
- **Main Directory:** The primary working directory (`/home/alaeddine/Bureau/nexus-project_v0`)
- **Zenflow:** Task and workflow automation system for this project
- **Rule:** Event-driven automation definition
- **Workflow:** Ordered sequence of steps to accomplish a task
- **Sync:** Process of applying worktree changes to main directory
- **Diff:** Difference between two Git states (commits, branches)
- **Conflict:** Overlapping changes that cannot be automatically merged
- **Rollback:** Reverting a sync to previous state
- **Atomic Operation:** All-or-nothing operation (complete success or complete failure)

---

## 14. Appendix

### 14.1 Example Scenarios

#### Scenario A: Successful Auto-Sync
1. Developer commits to worktree `feature-login-page-abcd`
2. Git post-commit hook triggers Zenflow event
3. Rule `worktree-to-main-sync` evaluates conditions (passes)
4. Workflow `sync-worktree-to-main` executes:
   - Validate worktree exists ✓
   - Check conflicts ✓ (none)
   - Analyze diff ✓ (3 files changed)
   - Backup main ✓
   - Merge changes ✓
   - Run verification ✓ (lint passes)
   - Create log ✓
5. Commit created in main: `chore: merge feature-login-page-abcd - Auto-sync`
6. Push to GitHub ✓
7. Developer notified: "Sync successful: 3 files updated"

#### Scenario B: Conflict Detected
1. Developer commits to worktree `feature-payment-xyz`
2. Sync triggered, workflow runs
3. Conflict detected: `app/payment/page.tsx` modified in both main and worktree
4. Workflow aborts at conflict check step
5. Log entry created: "Sync failed: conflicts detected"
6. Developer notified: "Conflict in app/payment/page.tsx, manual merge required"
7. Developer resolves conflict manually
8. Developer runs `zenflow sync --worktree feature-payment-xyz --force`
9. Sync succeeds

#### Scenario C: Validation Failure
1. Sync triggered, workflow runs
2. Merge succeeds
3. Verification step fails: TypeScript errors
4. Workflow triggers rollback
5. Main directory restored to pre-sync state
6. Log entry: "Sync failed: typecheck errors, rolled back"
7. Developer notified with error details

### 14.2 Directory Structure After Implementation

```
/home/alaeddine/Bureau/nexus-project_v0/
├── .zenflow/
│   ├── settings.json
│   ├── rules/
│   │   ├── sync/
│   │   │   └── worktree-to-main-sync.yaml
│   │   ├── validation/
│   │   │   └── pre-commit-checks.yaml
│   │   └── notification/
│   │       └── sync-alerts.yaml
│   ├── workflows/
│   │   ├── sync-worktree-to-main.yaml
│   │   ├── rollback-sync.yaml
│   │   └── validate-worktree.yaml
│   ├── state/
│   │   └── workflow-executions/
│   │       ├── sync-20260203-120000.json
│   │       └── sync-20260203-123000.json
│   └── tasks/
│       └── ... (existing tasks)
├── .zenflowignore
├── ... (rest of project files)

/var/log/zenflow/
├── sync.log
├── rules.log
├── workflows.log
└── failures.log
```

### 14.3 Configuration Examples

**.zenflowignore:**
```gitignore
# Build outputs
node_modules/
.next/
dist/
build/

# Logs
*.log

# Environment files
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Temporary
*.tmp
*.swp
```

**settings.json additions:**
```json
{
  "sync": {
    "enabled": true,
    "auto_push": true,
    "max_retries": 3,
    "timeout": 600,
    "conflict_strategy": "abort",
    "excluded_worktrees": [],
    "notification_channels": ["console", "log"]
  },
  "rules": {
    "directory": ".zenflow/rules",
    "auto_load": true
  },
  "workflows": {
    "directory": ".zenflow/workflows",
    "state_directory": ".zenflow/state/workflow-executions"
  },
  "logging": {
    "level": "info",
    "directory": "/var/log/zenflow",
    "rotation": "daily",
    "retention_days": 30
  }
}
```

---

## 15. Sign-off

This PRD represents the comprehensive requirements for the automatic worktree-to-main synchronization system. It addresses all aspects of the task description including audit, synchronization, rule/workflow systems, automation, safety, and documentation.

**Next Steps:**
1. Review and approve this PRD
2. Address open questions and decisions
3. Proceed to Technical Specification phase

**Prepared By:** Zenflow System  
**Date:** 2026-02-03  
**Version:** 1.0 (Draft)
