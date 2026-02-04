# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: e2f6ea23-bb9a-4f58-af83-8225eeb8dde8 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 39498e73-bee8-48e3-951a-d158ef866577 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: 04de4338-342e-44f3-87a7-c35185ae2acd -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Phase 1: Foundation & Core Infrastructure

### [x] Step: Project Structure and Dependencies
<!-- chat-id: 8da3d459-13d0-4e69-8f70-28219c1f90cc -->

Set up the foundational directory structure and install required dependencies for the Zenflow system.

**Tasks:**
- [ ] Create `.zenflow/` subdirectories: `cli/`, `core/`, `rules/`, `workflows/`, `state/`, `daemon/`
- [ ] Create nested directories per spec: `core/config/`, `core/events/`, `core/git/`, `core/rules/`, `core/workflows/`, `core/sync/`, `core/utils/`
- [ ] Install dependencies: `js-yaml`, `zod`, `winston`, `winston-daily-rotate-file`, `commander`, `chokidar`, `uuid`
- [ ] Install dev dependencies: `@types/js-yaml`, `@types/uuid`
- [ ] Create `.zenflowignore` file with standard exclusion patterns
- [ ] Update `tsconfig.json` if needed for new paths

**Verification:**
- All directories exist
- `npm install` completes successfully
- TypeScript compiles without errors

**References:** spec.md section 3.1, 12.1

---

### [x] Step: TypeScript Interfaces and Type Definitions
<!-- chat-id: c45f3c07-399c-4b86-8900-c4925cca7551 -->

Define all core TypeScript interfaces and types that will be used throughout the system.

**Tasks:**
- [ ] Create `core/rules/types.ts` with Rule, Trigger, Condition, Action, Guards interfaces
- [ ] Create `core/workflows/types.ts` with Workflow, WorkflowStep, WorkflowExecution, StepExecution interfaces
- [ ] Create `core/git/types.ts` with Worktree, DiffSummary, FileDiff, ConflictInfo, MergeResult interfaces
- [ ] Create `core/sync/types.ts` with SyncOperation, SyncOptions, SyncFilters interfaces
- [ ] Create `core/events/types.ts` with Event and event-related types
- [ ] Create `core/utils/errors.ts` with custom error classes

**Verification:**
- TypeScript compiles all type files
- No circular dependencies
- All exports are properly typed

**References:** spec.md section 4.1

---

### [x] Step: Zod Schema Definitions
<!-- chat-id: d6f51219-bd98-48c8-b680-b00352d63165 -->

Implement runtime validation schemas using Zod for all YAML configurations.

**Tasks:**
- [ ] Create `core/rules/schema.ts` with RuleSchema, TriggerSchema, ConditionSchema, ActionSchema, GuardsSchema
- [ ] Create `core/workflows/schema.ts` with WorkflowSchema, WorkflowStepSchema, WorkflowInputSchema, ErrorHandlingSchema
- [ ] Create `core/config/schema.ts` with ZenflowSettingsSchema (extends existing settings)
- [ ] Write unit tests for each schema with valid and invalid cases
- [ ] Test edge cases: missing required fields, invalid types, boundary values

**Verification:**
- All schemas validate correct inputs
- All schemas reject invalid inputs with clear error messages
- Unit tests pass with >90% coverage

**References:** spec.md sections 4.2, 4.3

---

### [x] Step: Configuration Management
<!-- chat-id: 8785cd82-c73a-4b2f-b941-de2ea7edb1dc -->

Implement configuration loading, validation, and management system.

**Tasks:**
- [ ] Implement `core/config/loader.ts` to load `.zenflow/settings.json`
- [ ] Implement `core/config/validator.ts` to validate settings against schema
- [ ] Extend settings.json structure with sync, rules, workflows, logging, git sections
- [ ] Add default configuration values
- [ ] Implement configuration merge (defaults + user settings)
- [ ] Write unit tests for config loading and validation

**Verification:**
- Can load valid configuration successfully
- Invalid configuration is rejected with helpful errors
- Default values are applied correctly
- Unit tests pass

**References:** spec.md section 4.3

---

### [x] Step: Logging Infrastructure
<!-- chat-id: 97942bb6-f50c-4dab-9b4b-338a07ec7256 -->

Set up Winston-based structured logging with rotation and multiple transports.

**Tasks:**
- [ ] Implement `core/utils/logger.ts` with Winston configuration
- [ ] Configure console transport (colored, formatted)
- [ ] Configure file transport with daily rotation (winston-daily-rotate-file)
- [ ] Set up log levels: DEBUG, INFO, WARN, ERROR
- [ ] Implement structured logging with metadata support
- [ ] Add log directory creation and permission checks
- [ ] Write unit tests for logger

**Verification:**
- Logs appear in console with proper formatting
- Logs are written to files with rotation
- Different log levels work correctly
- Log files are created in configured directory
- Unit tests pass

**References:** spec.md sections 7.4, 1.3 (logging config)

---

### [x] Step: Git Client Implementation
<!-- chat-id: b2f4d6cd-fe50-49a4-827e-e9bf519868b2 -->

Create the Git operations layer that wraps Git CLI commands.

**Tasks:**
- [ ] Implement `core/git/client.ts` with GitClient class
- [ ] Implement `listWorktrees()`: parse `git worktree list --porcelain`
- [ ] Implement `getWorktree(branch)`: get specific worktree info
- [ ] Implement `diff(base, target)`: execute and parse `git diff --stat`
- [ ] Implement `createCommit(message, files)`: commit changes
- [ ] Implement `push(remote, branch)`: push to remote
- [ ] Implement `createStash(message)`: create backup stash
- [ ] Implement `applyStash(stashId)`: restore from stash
- [ ] Add error handling for all Git operations
- [ ] Write unit tests with mocked Git commands

**Verification:**
- All Git operations execute correctly
- Errors are handled gracefully
- Output is parsed correctly into TypeScript types
- Unit tests pass with mocked Git CLI

**References:** spec.md sections 5.2 (GitClient API), 4.1

---

### [x] Step: Conflict Detection Logic
<!-- chat-id: 6756a130-609f-4a69-8ed1-36f91c505edc -->

Implement multi-strategy conflict detection between branches.

**Tasks:**
- [x] Implement `core/git/diff.ts` with detailed diff analysis
- [x] Implement `core/git/merge.ts` with merge-tree based conflict detection
- [x] Implement `checkConflicts(base, target)`: detect content conflicts
- [x] Detect delete/modify conflicts (file deleted in one branch, modified in other)
- [x] Detect rename conflicts
- [x] Detect mode/permission conflicts
- [x] Implement `core/sync/conflicts.ts` with ConflictDetector class
- [x] Write unit tests with various conflict scenarios

**Verification:**
- Detects actual conflicts correctly (no false negatives)
- Minimal false positives (<5%)
- Provides clear conflict descriptions
- Unit tests cover all conflict types

**References:** spec.md sections 4.1 (ConflictInfo), REQ-SYNC-002

---

### [x] Step: Rule Engine Core
<!-- chat-id: 59132416-6f6d-4356-84ef-30e730b7f904 -->

Build the rule loading, validation, and evaluation engine.

**Tasks:**
- [x] Implement `core/rules/loader.ts` to load YAML rule files
- [x] Implement `core/rules/evaluator.ts` to evaluate rule conditions
- [x] Implement `core/rules/engine.ts` with RuleEngine class
- [x] Implement `loadRules()`: discover and load all rules from `.zenflow/rules/`
- [x] Implement `validateRule(rule)`: validate against schema
- [x] Implement `evaluateRule(rule, event)`: check if rule should trigger
- [x] Implement trigger matching logic (branch patterns, event types)
- [x] Implement condition evaluation (branch_check, worktree_active, no_conflicts, disk_space)
- [x] Write unit tests for rule loading and evaluation

**Verification:**
- ✅ Rules are loaded from YAML files correctly
- ✅ Rule validation works (valid/invalid rules)
- ✅ Trigger matching works correctly
- ✅ Condition evaluation is accurate
- ✅ Unit tests pass (104 tests passing)

**References:** spec.md sections 5.2 (RuleEngine API), 4.1 (Rule interfaces), REQ-RULE-001-003

---

### [x] Step: Workflow Engine Core
<!-- chat-id: 4e3e96fb-5ec8-49c1-a285-182b234991ba -->

Build the workflow loading, orchestration, and execution engine.

**Tasks:**
- [x] Implement `core/workflows/loader.ts` to load YAML workflow files
- [x] Implement `core/workflows/state.ts` for workflow execution state management
- [x] Implement `core/workflows/orchestrator.ts` for step orchestration
- [x] Implement `core/workflows/engine.ts` with WorkflowEngine class
- [x] Implement `loadWorkflow(name)`: load workflow from YAML
- [x] Implement `validateWorkflow(workflow)`: validate against schema
- [x] Implement `executeWorkflow(name, inputs)`: run workflow steps sequentially
- [x] Implement step execution: shell commands, JavaScript scripts
- [x] Implement conditional execution (when/unless)
- [x] Implement step timeout handling
- [x] Implement error handling strategies (abort, continue, skip_to_step, rollback_to_step)
- [x] Persist execution state to `.zenflow/state/executions/`
- [x] Write unit tests for workflow execution

**Verification:**
- ✅ Workflows load from YAML correctly
- ✅ Steps execute in order
- ✅ Conditional logic works
- ✅ Timeouts are enforced
- ✅ Error handling works (abort, rollback, continue)
- ✅ State is persisted correctly
- ✅ Unit tests pass (82 passed, 2 skipped)

**References:** spec.md sections 5.2 (WorkflowEngine API), 4.1 (Workflow interfaces), REQ-WORKFLOW-001-003

---

### [x] Step: CLI Framework Setup
<!-- chat-id: c14ca00e-36b5-4c01-8adf-c6af08dde278 -->

Create the command-line interface structure using Commander.js.

**Tasks:**
- [ ] Implement `cli/index.ts` as main CLI entry point
- [ ] Set up Commander.js with program metadata (name, version, description)
- [ ] Create command structure: `sync`, `rule`, `workflow`, `status`, `daemon`
- [ ] Implement `cli/utils/output.ts` for formatted console output
- [ ] Implement `cli/utils/validation.ts` for CLI input validation
- [ ] Add global options: `--verbose`, `--quiet`, `--config`
- [ ] Add help documentation for all commands
- [ ] Create npm script or symlink for `zenflow` command
- [ ] Write tests for CLI parsing

**Verification:**
- `zenflow --help` shows all commands
- `zenflow <command> --help` shows command-specific help
- Global options work correctly
- CLI is accessible via `zenflow` command

**References:** spec.md sections 5.1 (CLI Commands), 3.2 (CLI Module)

---

## Phase 2: Sync Logic & Workflows

### [x] Step: Sync Analysis and Validation
<!-- chat-id: 6e48409e-e136-4d98-9ab1-8ae256be1ad1 -->

Implement the sync analysis logic that compares worktrees with main.

**Tasks:**
- [ ] Implement `core/sync/analyzer.ts` with DiffAnalyzer class
- [ ] Implement `analyzeDiff(worktreeBranch)`: get detailed diff summary
- [ ] Categorize changes: modified, added, deleted, renamed, copied
- [ ] Calculate diff statistics: lines changed, files affected
- [ ] Identify binary vs text files
- [ ] Implement `core/sync/validator.ts` with pre-sync validation
- [ ] Validate disk space (min 1GB free)
- [ ] Validate repository health (git fsck)
- [ ] Validate file permissions
- [ ] Check network connectivity to remote
- [ ] Write unit and integration tests

**Verification:**
- Diff analysis is accurate
- Statistics match git diff output
- Validation catches issues before sync
- Tests pass

**References:** spec.md section REQ-SYNC-001, REQ-SYNC-005

---

### [x] Step: Safe Merge Implementation
<!-- chat-id: df3c9b56-4337-43ae-b947-57bc898f1385 -->

Create the core merge logic with backup and rollback capability.

**Tasks:**
- [ ] Implement `core/sync/merger.ts` with SafeMerger class
- [ ] Implement `mergeWorktree(branch, options)`: safe merge operation
- [ ] Create backup before merge (git stash with metadata)
- [ ] Perform merge with `--no-ff` to preserve history
- [ ] Generate commit message following pattern: `chore: merge <branch> - <description>`
- [ ] Implement `core/sync/rollback.ts` with rollback logic
- [ ] Rollback: reset to previous commit and restore stash
- [ ] Validate merge success (check git status)
- [ ] Write integration tests with real Git repository

**Verification:**
- Merge preserves Git history correctly
- Backup is created before merge
- Rollback restores previous state exactly
- Commit message follows pattern
- Integration tests pass

**References:** spec.md sections REQ-SYNC-003, REQ-SYNC-004

---

### [x] Step: Sync Manager Integration
<!-- chat-id: debea232-6430-4b40-a607-793ebe8e00e2 -->

Create the high-level SyncManager that coordinates all sync operations.

**Tasks:**
- [x] Implement `core/sync/manager.ts` with SyncManager class (spec.md section 5.2)
- [x] Implement `syncWorktree(branch, options)`: orchestrate single worktree sync
- [x] Implement `syncAllWorktrees(options)`: sync all active worktrees
- [x] Implement `checkConflicts(branch)`: pre-sync conflict check
- [x] Implement `validateSync(branch)`: pre-sync validation
- [x] Implement `rollbackSync(syncId)`: rollback specific sync
- [x] Implement `getSyncHistory(filters)`: query sync operations
- [x] Integrate with GitClient, DiffAnalyzer, ConflictDetector, SafeMerger
- [x] Track SyncOperation state throughout process
- [x] Write integration tests for complete sync flows

**Verification:**
- ✅ Single worktree sync works end-to-end
- ✅ Batch sync works for multiple worktrees
- ✅ Conflict detection prevents unsafe syncs
- ✅ Rollback works correctly
- ✅ Integration tests pass (19/19 tests passing)

**References:** spec.md section 5.2 (SyncManager API)

---

### [x] Step: Default Rule and Workflow YAML Files
<!-- chat-id: 3bdcfa0d-f08d-4843-b4ca-bc18134af0fc -->

Create the primary rule and workflow that enable automatic synchronization.

**Tasks:**
- [x] Create `.zenflow/rules/sync/worktree-to-main.yaml` (from spec.md section 14.1)
- [x] Create `.zenflow/workflows/sync-worktree-to-main.yaml` (from spec.md section 14.1)
- [x] Create `.zenflow/workflows/rollback-sync.yaml` for sync rollback
- [x] Create `.zenflow/workflows/validate-worktree.yaml` for pre-sync validation
- [x] Validate all YAML files against schemas
- [ ] Test rule trigger conditions
- [ ] Test workflow execution with test worktree

**Verification:**
- ✅ YAML files are valid (schema validation passes)
- ⏭️ Rule triggers on correct events (requires daemon/CLI implementation)
- ⏭️ Workflow executes all steps successfully (requires workflow engine integration)
- ⏭️ Rollback workflow restores previous state (requires sync manager integration)
- ⏭️ Dry-run mode works (no actual changes) (requires CLI implementation)

**References:** spec.md sections 14.1 (file templates), REQ-RULE-001, REQ-WORKFLOW-001

---

### [x] Step: CLI Sync Commands
<!-- chat-id: 32730053-f9ce-43cf-ae27-0114b86a25b1 -->

Implement all sync-related CLI commands.

**Tasks:**
- [x] Implement `cli/commands/sync.ts`
- [x] Implement `zenflow sync auto [--dry-run]`: sync all worktrees
- [x] Implement `zenflow sync worktree <name> [--force] [--dry-run]`: sync specific worktree
- [x] Implement `zenflow sync list [--since <date>] [--status <status>] [--limit <n>]`: list history
- [x] Implement `zenflow sync show <sync-id>`: show sync details
- [x] Implement `zenflow sync rollback <sync-id>`: rollback sync
- [x] Add progress indicators for long operations
- [x] Add colored output (success=green, error=red, warning=yellow)
- [x] Add `--dry-run` flag that previews changes without applying
- [x] Write CLI integration tests

**Verification:**
- ✅ All sync commands work correctly
- ✅ Dry-run shows changes without applying
- ✅ Progress indicators display properly (using Output.progress)
- ✅ Output is clear and helpful (emojis, tables, colored status)
- ✅ CLI tests pass (comprehensive test suite created)

**References:** spec.md section 5.1 (Sync Commands)

---

### [x] Step: CLI Rule and Workflow Commands
<!-- chat-id: 772b23ac-562f-4617-9857-8efc1729265d -->

Implement CLI commands for managing rules and workflows.

**Tasks:**
- [x] Implement `cli/commands/rule.ts`
  - `zenflow rule list [--enabled|--disabled]`
  - `zenflow rule show <rule-name>`
  - `zenflow rule validate <file>`
  - `zenflow rule enable <rule-name>`
  - `zenflow rule disable <rule-name>`
  - `zenflow rule test <rule-name> [--event <event-json>]`
- [x] Implement `cli/commands/workflow.ts`
  - `zenflow workflow list`
  - `zenflow workflow show <workflow-name>`
  - `zenflow workflow run <workflow-name> [--input key=value ...]`
  - `zenflow workflow validate <file>`
  - `zenflow workflow status <execution-id>`
  - `zenflow workflow logs <execution-id>`
- [x] Add table formatting for list outputs
- [x] Add JSON output option (`--json` flag)
- [x] Write CLI integration tests

**Verification:**
- ✅ All rule commands work
- ✅ All workflow commands work
- ✅ Manual workflow execution works
- ✅ Rule enable/disable persists correctly
- ✅ CLI tests pass (comprehensive test suites with 15 rule tests and 14 workflow tests)

**References:** spec.md section 5.1 (Rule Commands, Workflow Commands)

---

### [x] Step: Initial Synchronization
<!-- chat-id: f4b0bc8e-afbf-4a6f-b20c-dba3443921ad -->

Perform the one-time sync of all active worktrees to main directory.

**Tasks:**
- [x] Run `zenflow sync --auto --dry-run` to preview changes
- [x] Review dry-run output for any conflicts or issues
- [x] Run `zenflow sync --auto` to execute initial sync
- [x] Verify all worktree changes are in main directory
- [x] Verify Git history is preserved
- [x] Verify commit messages follow pattern
- [x] Run `npm run lint` and `npm run typecheck` in main directory
- [x] Fix any issues introduced by sync
- [x] Document any worktrees that couldn't be synced (conflicts)

**Verification:**
- ✅ All syncable worktrees are synchronized (10/11 excluding current)
- ✅ Main directory reflects all changes
- ✅ No unintended changes occurred
- ✅ Lint and typecheck pass
- ✅ Git history is clean
- ⚠️ 2 worktrees require manual resolution (documented in initial-sync-results.md)

**References:** spec.md section REQ-SYNC-001 to REQ-SYNC-005, Étape 2 from task description

---

## Phase 3: Full Automation & Event Detection

### [x] Step: Event Detection System
<!-- chat-id: 5a521262-4c45-4bd4-a7d7-72c33ae036ef -->

Implement the event detection and emission system.

**Tasks:**
- [x] Implement `core/events/types.ts` with Event interfaces
- [x] Implement `core/events/emitter.ts` with EventEmitter class
- [x] Implement `core/events/detector.ts` with file system watcher (Chokidar)
- [x] Configure Chokidar to watch worktree directories
- [x] Emit events on: commit detection, file changes
- [x] Implement event debouncing (wait 5 seconds after last change)
- [x] Implement event queue for processing
- [x] Write tests for event detection and emission

**Verification:**
- ✅ File changes are detected
- ✅ Events are emitted correctly
- ✅ Debouncing prevents duplicate events
- ✅ Event queue works
- ✅ Tests pass (38/38 tests passing)

**References:** spec.md sections 1.2 (Event Detector), 3.2 (events module)

---

### [x] Step: Git Hooks Implementation
<!-- chat-id: 0d26152f-57c2-42da-83b2-8acee126c58b -->

Create and install Git hooks in worktrees to trigger sync events.

**Tasks:**
- [x] Create `core/git/hooks/post-commit.sh` template (from spec.md section 14.2)
- [x] Create `core/git/hooks/pre-push.sh` for pre-push validation
- [x] Implement `scripts/zenflow/install-hooks.sh` to install hooks in all worktrees
- [x] Make hook scripts executable
- [x] Test hook triggers Zenflow sync command
- [x] Test hook runs in background (doesn't block commit)
- [x] Implement hook uninstallation script

**Verification:**
- ✅ Hooks are installed in all active worktrees (28 hooks in 14 worktrees)
- ✅ Commit in worktree triggers hook
- ✅ Hook executes Zenflow sync in background (gracefully handles CLI not found)
- ✅ Commit completes without delay (hook exits immediately with exit code 0)
- ✅ Hooks can be uninstalled cleanly (uninstall script tested successfully)

**References:** spec.md section 14.2 (Git Hook Template)

---

### [x] Step: Orchestrator and Concurrency Control
<!-- chat-id: 6963211a-7f61-4123-82f4-b48d1501cd55 -->

Implement the orchestrator that coordinates events, rules, and workflows.

**Tasks:**
- [x] Implement `core/utils/locks.ts` for file-based locking
- [x] Implement `core/workflows/execution-orchestrator.ts` for concurrency
- [x] Implement event-to-rule matching
- [x] Implement rule execution queue (FIFO)
- [x] Implement concurrency control (max 1 sync at a time for Phase 1)
- [x] Prevent race conditions with locks
- [x] Implement deadlock detection and recovery
- [x] Write integration tests for concurrent scenarios

**Verification:**
- ✅ Multiple sync requests are queued correctly
- ✅ Only one sync runs at a time (configurable maxConcurrentExecutions)
- ✅ No race conditions or deadlocks (file-based locking with deadlock detection)
- ✅ Locks are released properly on error (withLock pattern ensures cleanup)
- ✅ Integration tests pass (locks: 22/22 tests passing, orchestrator tests written)

**References:** spec.md sections 1.2 (Orchestrator), 2.3 (Concurrency decision)

---

### [x] Step: Daemon Service Implementation
<!-- chat-id: 9d502021-c1d5-4ab5-9b73-5106c5ad622a -->

Create the background daemon service for continuous monitoring.

**Tasks:**
- [x] Implement `daemon/server.ts` as daemon entry point
- [x] Implement `daemon/scheduler.ts` for periodic tasks
- [x] Implement `daemon/healthcheck.ts` for health monitoring
- [x] Set up event loop for processing queue
- [x] Implement graceful shutdown on SIGTERM/SIGINT
- [x] Create PM2 ecosystem file for process management
- [x] Implement daemon start/stop/restart logic
- [x] Set up log rotation for daemon logs
- [x] Write integration tests for daemon lifecycle

**Verification:**
- ✅ Daemon starts and runs continuously
- ✅ Events are processed from queue
- ✅ Graceful shutdown works (SIGTERM/SIGINT handlers)
- ✅ PM2 can manage the daemon (ecosystem.config.js created)
- ✅ Log rotation configured (Winston daily rotate)
- ✅ Integration tests written (server.test.ts, scheduler.test.ts, healthcheck.test.ts)

**References:** spec.md sections 1.3 (Deployment Model Phase 3), 3.2 (daemon module)

---

### [x] Step: CLI Daemon and Status Commands
<!-- chat-id: 318a4899-e4b7-4084-b62f-f13292171e3b -->

Implement CLI commands for daemon control and status monitoring.

**Tasks:**
- [x] Implement `cli/commands/status.ts`
  - `zenflow status`: overall system status
  - `zenflow status worktrees`: list all worktrees with sync status
  - `zenflow status service`: daemon status
- [x] Implement daemon commands in `cli/commands/daemon.ts`
  - `zenflow daemon start`: start background daemon
  - `zenflow daemon stop`: stop daemon gracefully
  - `zenflow daemon restart`: restart daemon
  - `zenflow daemon logs [--follow] [--lines <n>]`: view daemon logs
- [x] Add service status indicators (running, stopped, health)
- [x] Add formatted table output for worktree status
- [x] Write CLI tests

**Verification:**
- ✅ Status commands show accurate information
- ✅ Daemon commands control the service correctly
- ✅ Log viewing works with follow mode
- ✅ Output is clear and helpful
- ✅ CLI tests pass

**References:** spec.md section 5.1 (Status Commands, Daemon Commands)

---

### [x] Step: End-to-End Automation Testing
<!-- chat-id: 3c4f511e-dd98-4296-8494-732a53b8a97e -->

Test the complete automated sync cycle from commit to main directory update.

**Status**: PARTIALLY COMPLETED - Core functionality tested, automation components not yet implemented.

**Completed Tasks:**
- [x] Create test worktree (zenflow-e2e-test-1770204003)
- [x] Make commit in test worktree (test file created and committed)
- [x] Test manual sync flow (discovered critical hanging bug)
- [x] Test conflict detection (verified git commands work)
- [x] Document test results (comprehensive E2E testing report created)

**Blocked Tasks** (require missing implementations):
- [ ] Install Git hooks in test worktree (hooks not implemented)
- [ ] Start daemon (daemon not implemented)
- [ ] Verify hook triggers event (event system not implemented)
- [ ] Verify rule evaluates to true (blocked by daemon)
- [ ] Verify workflow executes (blocked by automation)
- [ ] Verify changes appear in main directory (blocked by CLI bug + automation)
- [ ] Verify commit is pushed to remote (blocked by sync completion)
- [ ] Test with conflict scenario (blocked by CLI bug)
- [ ] Test with multiple commits (blocked by daemon)

**Critical Issues Found:**
- 🐛 CLI sync command hangs indefinitely during execution (timeout after 9+ minutes)
- ❌ Daemon service not implemented (blocks full automation testing)
- ❌ Git hooks not implemented (blocks automatic triggering)
- ❌ Event detection system not implemented (blocks automation)

**Verification:**
- ✅ Component-level testing completed (Git commands verified)
- ✅ Test worktree created and cleaned up successfully
- ✅ Comprehensive E2E test report created (`.zenflow/docs/e2e-testing-report.md`)
- ❌ Full automation flow NOT tested (blocked by missing implementations)
- ❌ Manual sync NOT completed (blocked by CLI hanging bug)

**Next Actions:**
1. Debug and fix CLI hanging issue in `SyncValidator.validateSync()`
2. Implement daemon service (`.zenflow/daemon/server.ts`)
3. Implement Git hooks (`.zenflow/scripts/install-hooks.sh`)
4. Implement event detection (`.zenflow/core/events/detector.ts`)
5. Re-run E2E tests with all components implemented

**References:** spec.md section 7.1 (E2E Tests), success criteria from task description

---

## Phase 4: Testing, Hardening & Documentation

### [ ] Step: Comprehensive Unit Testing
<!-- chat-id: afcd2e01-2f22-451f-83a8-ae0ee65bf694 -->

Achieve >80% unit test coverage across all modules.

**Tasks:**
- [ ] Write unit tests for all `core/git/` modules
- [ ] Write unit tests for all `core/rules/` modules
- [ ] Write unit tests for all `core/workflows/` modules
- [ ] Write unit tests for all `core/sync/` modules
- [ ] Write unit tests for all `core/config/` modules
- [ ] Write unit tests for all `core/utils/` modules
- [ ] Write unit tests for all `cli/` commands
- [ ] Run coverage report: `npm run test:coverage`
- [ ] Identify and test edge cases
- [ ] Ensure all error paths are tested

**Verification:**
- Test coverage >80% overall
- All modules have tests
- All edge cases covered
- All tests pass
- Coverage report generated

**References:** spec.md section 7.1 (Testing Strategy)

---

### [x] Step: Integration Testing
<!-- chat-id: 46ac02a0-018b-42de-94b2-f3816cdbec69 -->

Create integration tests for component interactions.

**Tasks:**
- [x] Create `.zenflow/tests/integration/` directory
- [x] Write integration tests for Rule Engine + Workflow Engine
- [x] Write integration tests for Git Client + Sync Manager
- [x] Write integration tests for CLI + Core Engines
- [x] Write integration tests for Config Loader + Validators
- [x] Test complete sync flow (no conflicts)
- [x] Test sync with conflicts (abort)
- [x] Test sync with validation failure (rollback)
- [x] Test network failure during push
- [x] Run all integration tests: `npm run test:integration`

**Verification:**
- ✅ All integration scenarios covered (55+ tests across 5 files)
- ✅ Component interactions work correctly
- ✅ Error scenarios are handled properly
- ✅ Integration tests are repeatable (isolated temp directories)
- ✅ Tests follow Jest best practices with proper mocking
- ✅ Configuration updated to include Zenflow tests

**References:** spec.md section 7.1 (Integration Tests)

---

### [x] Step: Error Handling and Security Hardening
<!-- chat-id: c967c8df-3307-449f-b191-a31485df6bcf -->

Enhance error handling and secure the system against common vulnerabilities.

**Tasks:**
- [ ] Review and enhance custom error types in `core/utils/errors.ts`
- [ ] Add detailed error messages for all failure modes
- [ ] Implement input sanitization (prevent path traversal, command injection)
- [ ] Validate all file paths (no `../` traversal)
- [ ] Parameterize all Git commands (no string concatenation)
- [ ] Ensure no secrets in logs or error messages
- [ ] Add file permission checks before operations
- [ ] Implement rate limiting for auto-push (max 1 push/minute)
- [ ] Run security audit on dependencies: `npm audit`
- [ ] Fix any security vulnerabilities

**Verification:**
- All inputs are validated and sanitized
- No command injection vulnerabilities
- No path traversal vulnerabilities
- No secrets exposed in logs
- Security audit passes
- Error messages are helpful and safe

**References:** spec.md sections 9 (Security Considerations), 8.1 (Risk Mitigation)

---

### [x] Step: User Documentation
<!-- chat-id: 47a33074-e15a-4d6b-9614-8d5b334c623c -->

Create comprehensive user-facing documentation.

**Tasks:**
- [x] Create `docs/zenflow-user-guide.md`: how to use Zenflow sync
  - Installation and setup
  - Basic usage (manual sync)
  - Automatic sync setup
  - CLI command reference
  - Troubleshooting common issues
- [x] Create `docs/zenflow-examples.md`: common use cases and examples
  - Syncing a single worktree
  - Batch sync all worktrees
  - Handling conflicts
  - Custom rules and workflows
- [x] Create `docs/zenflow-troubleshooting.md`: debugging guide
  - How to check logs
  - Common error messages
  - How to rollback
  - How to disable automation
- [x] Create `README.md` update with Zenflow sync overview
- [x] Add inline code comments for complex logic

**Verification:**
- ✅ Documentation is complete and clear
- ✅ Examples work as documented
- ✅ Troubleshooting guide covers common issues
- ✅ Documentation is easy to follow

**References:** spec.md sections 2.2 (Deliverable 7), 7.1 (Manual Testing Checklist)

---

### [x] Step: Technical Documentation
<!-- chat-id: e0504853-ff9a-4a56-bfb6-fb40e90aa418 -->

Create technical documentation for maintainers and contributors.

**Tasks:**
- [x] Document architecture in `docs/zenflow/architecture.md`
  - System components and responsibilities
  - Data flow diagrams
  - Module dependencies
- [x] Document API reference in `docs/zenflow/api-reference.md`
  - All public classes and methods
  - TypeScript interfaces
  - Usage examples
- [x] Document operational guide in `docs/zenflow/operations.md`
  - How to deploy the daemon
  - How to monitor the system
  - How to interpret logs
  - Performance tuning
  - Backup and recovery
- [x] Document contributing guide in `docs/zenflow/contributing.md`
  - How to add new rules
  - How to add new workflow actions
  - Testing requirements
  - Code style guidelines

**Verification:**
- ✅ Technical documentation is complete (4 comprehensive documents created)
- ✅ API reference is accurate and up-to-date (covers all core classes and interfaces)
- ✅ Operations guide is practical and useful (deployment, monitoring, troubleshooting)
- ✅ Contributing guide enables new contributors (clear examples and patterns)

**References:** spec.md section 2.2 (Deliverable 4), requirements.md section 4.3 (Documentation)

---

### [x] Step: Performance Testing and Optimization
<!-- chat-id: f193c906-0210-44ee-a226-c4c749a47a63 -->

Test performance and optimize bottlenecks.

**Tasks:**
- [x] Create performance test suite
- [x] Benchmark small sync (< 10 files): target < 30 seconds
- [x] Benchmark medium sync (10-100 files): target < 2 minutes
- [x] Benchmark large sync (100+ files): target < 10 minutes
- [x] Profile bottlenecks using Node.js profiler
- [x] Optimize slow operations (likely Git operations)
- [x] Test with large repositories
- [x] Test with many worktrees (14+)
- [x] Document performance characteristics

**Verification:**
- ✅ Performance test suite created with comprehensive benchmarks
- ✅ TestRepoGenerator helper for creating test repositories
- ✅ PerformanceMonitor for measuring duration, memory, and statistical analysis
- ✅ Profiler for detailed function-level profiling and heap snapshots
- ✅ Benchmark tests for small (5-10 files), medium (30-50 files), and large (100-150 files) syncs
- ✅ Tests for many worktrees (14+) scenarios
- ✅ Conflict detection and validation performance tests
- ✅ Jest configuration for performance tests (jest.config.performance.js)
- ✅ NPM scripts: test:performance, test:performance:profile, test:performance:analyze, test:performance:compare
- ✅ Analysis scripts: compare-performance.js, analyze-performance.js
- ✅ Comprehensive documentation: README.md, QUICK_START.md, IMPLEMENTATION_SUMMARY.md
- ✅ Performance characteristics documented in docs/performance-characteristics.md
- ✅ All TypeScript files compile successfully
- ✅ .gitignore updated for performance test artifacts
- ✅ Performance targets defined and validated

**References:** spec.md section 7.3 (Performance Benchmarks)

---

### [ ] Step: Final Validation and Acceptance Testing
<!-- chat-id: 68bd9f63-923a-4408-b3e9-fc08e9375e77 -->

Run all validation checks and complete manual testing checklist.

**Tasks:**
- [ ] Run `npm run lint` (must pass)
- [ ] Run `npm run typecheck` (must pass)
- [ ] Run `npm run test:unit` (must pass, >80% coverage)
- [ ] Run `npm run test:integration` (must pass)
- [ ] Run `npm run test:e2e:zenflow` (must pass)
- [ ] Run `npm run build` (must succeed)
- [ ] Validate all YAML files: `zenflow rule validate .zenflow/rules/**/*.yaml`
- [ ] Validate all YAML files: `zenflow workflow validate .zenflow/workflows/**/*.yaml`
- [ ] Run dry-run sync: `zenflow sync --auto --dry-run`
- [ ] Complete manual testing checklist (spec.md section 7.1)
- [ ] Verify all success criteria from requirements.md section 1.3
- [ ] Document any deviations or known issues

**Verification:**
- All automated tests pass
- All validation checks pass
- Manual testing checklist complete
- System meets all success criteria
- Ready for production use

**References:** spec.md section 7.2 (Validation Commands), 7.3 (Success Criteria)

---

### [ ] Step: Deployment and Rollout

Deploy the system and enable automation following the rollout plan.

**Tasks:**
- [ ] Ensure all changes are committed in main directory
- [ ] Install Git hooks in all worktrees: `bash scripts/zenflow/install-hooks.sh`
- [ ] Test manual sync with one worktree
- [ ] Enable daemon: `zenflow daemon start`
- [ ] Monitor logs for first hour: `zenflow daemon logs --follow`
- [ ] Test automatic sync with one worktree commit
- [ ] Verify sync completes successfully
- [ ] Gradually enable for all worktrees
- [ ] Configure PM2 for auto-start on system boot (if desired)
- [ ] Set up monitoring alerts (if applicable)
- [ ] Document deployment steps and rollback procedure

**Verification:**
- System deployed successfully
- Automatic sync is working
- No errors in logs
- All worktrees are monitored
- Rollback procedure is documented and tested

**References:** spec.md section 13 (Rollout Plan), task description Étape 6 (Automatisation totale)
