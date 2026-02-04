# Zenflow API Reference

**Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** Production

---

## Table of Contents

1. [Core Interfaces](#core-interfaces)
2. [Sync Manager API](#sync-manager-api)
3. [Rule Engine API](#rule-engine-api)
4. [Workflow Engine API](#workflow-engine-api)
5. [Git Client API](#git-client-api)
6. [Configuration API](#configuration-api)
7. [Logger API](#logger-api)
8. [Error Types](#error-types)

---

## 1. Core Interfaces

### SyncOperation

Represents a synchronization operation from worktree to main branch.

```typescript
interface SyncOperation {
  id: string;                    // Unique sync operation ID (UUID)
  worktree_branch: string;       // Source worktree branch name
  commit_hash: string;           // Latest commit hash from worktree
  status: 'pending' | 'running' | 'success' | 'conflict' | 'failure' | 'rolled_back';
  started_at: Date;              // When sync operation started
  completed_at?: Date;           // When sync operation completed
  diff_summary?: DiffSummary;    // Diff statistics
  conflict_info?: ConflictInfo;  // Conflict details if any
  merge_result?: MergeResult;    // Merge operation result
  rollback_point?: string;       // Stash ID for rollback
  error?: string;                // Error message if failed
}
```

### SyncOptions

Configuration options for sync operations.

```typescript
interface SyncOptions {
  force?: boolean;                      // Force merge even with conflicts
  dryRun?: boolean;                     // Preview changes without applying
  autoPush?: boolean;                   // Automatically push to remote
  verificationCommands?: string[];      // Commands to run after merge
  conflictStrategy?: 'abort' | 'manual'; // How to handle conflicts
}
```

### DiffSummary

Summary of changes between two branches.

```typescript
interface DiffSummary {
  files_changed: number;       // Number of files modified
  insertions: number;          // Total lines added
  deletions: number;           // Total lines deleted
  files: FileDiff[];          // Per-file diff details
}

interface FileDiff {
  path: string;                          // File path relative to repo root
  status: 'A' | 'M' | 'D' | 'R' | 'C';  // Added, Modified, Deleted, Renamed, Copied
  insertions: number;                    // Lines added
  deletions: number;                     // Lines deleted
  binary: boolean;                       // Is binary file
  old_path?: string;                     // Original path for renamed files
}
```

### ConflictInfo

Information about merge conflicts.

```typescript
interface ConflictInfo {
  has_conflicts: boolean;          // Whether conflicts exist
  conflicted_files: string[];      // List of files with conflicts
  conflict_count: number;          // Number of conflicted files
  risk_level: 'low' | 'medium' | 'high';  // Conflict severity
  details?: string;                // Human-readable description
}
```

### Rule

Defines a rule for event-driven automation.

```typescript
interface Rule {
  name: string;                    // Unique rule identifier
  description: string;             // Human-readable description
  enabled: boolean;                // Whether rule is active
  priority: number;                // Execution priority (1-100)
  
  triggers: Trigger[];             // Conditions that activate rule
  conditions: Condition[];         // Guards that must pass
  actions: Action[];               // Actions to execute
  guards: Guards;                  // Safety guards
  
  metadata: {
    created_at: string;
    updated_at: string;
    author?: string;
    tags?: string[];
  };
}

interface Trigger {
  type: 'worktree_commit' | 'worktree_push' | 'manual' | 'schedule';
  branch_pattern?: string;         // Regex pattern for branch names
  event_filter?: Record<string, any>;
}

interface Condition {
  type: 'branch_check' | 'worktree_active' | 'no_conflicts' | 'disk_space';
  params?: Record<string, any>;
}

interface Action {
  type: 'log' | 'run_workflow' | 'shell' | 'notify';
  [key: string]: any;              // Action-specific parameters
}

interface Guards {
  max_file_changes: number;        // Abort if more files changed
  require_tests_pass: boolean;     // Run tests before sync
  on_error: 'abort' | 'continue' | 'notify';
}
```

### Workflow

Defines a multi-step workflow.

```typescript
interface Workflow {
  name: string;                    // Unique workflow identifier
  description: string;             // Human-readable description
  version: string;                 // Workflow version (semver)
  
  inputs: WorkflowInput[];         // Required/optional inputs
  outputs: string[];               // Output variable names
  
  steps: WorkflowStep[];           // Ordered steps
  
  error_handling: {
    strategy: 'abort' | 'rollback' | 'continue';
    cleanup_steps?: string[];      // Steps to run on rollback
    retry_count?: number;
    retry_delay?: number;
  };
  
  notifications?: {
    on_success?: Array<{ type: string; [key: string]: any }>;
    on_failure?: Array<{ type: string; [key: string]: any }>;
  };
  
  metadata: {
    created_at: string;
    updated_at: string;
    author?: string;
    tags?: string[];
  };
}

interface WorkflowInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

interface WorkflowStep {
  id: string;                      // Unique step identifier
  name: string;                    // Human-readable name
  type: 'shell' | 'script';        // Step type
  command?: string;                // Shell command to execute
  script?: string;                 // JavaScript code to execute
  timeout?: number;                // Max execution time (ms)
  retry?: number;                  // Retry count on failure
  when?: string;                   // Conditional execution (expression)
  unless?: string;                 // Skip if condition (expression)
  outputs?: Record<string, string>; // Output variable mappings
  on_failure?: {
    action: 'abort' | 'continue' | 'skip_to_step' | 'rollback_to_step';
    target_step?: string;
  };
}
```

### WorkflowExecution

Tracks execution state of a workflow.

```typescript
interface WorkflowExecution {
  id: string;                      // Unique execution ID (UUID)
  workflow_name: string;           // Name of workflow being executed
  status: 'pending' | 'running' | 'success' | 'failure' | 'rolled_back';
  
  started_at: Date;                // When execution started
  completed_at?: Date;             // When execution completed
  
  inputs: Record<string, any>;     // Input values
  outputs: Record<string, any>;    // Output values
  
  steps: StepExecution[];          // Execution state of each step
  
  error?: {
    message: string;
    step_id?: string;
    stack?: string;
  };
}

interface StepExecution {
  step_id: string;                 // Step identifier
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped';
  started_at?: Date;
  completed_at?: Date;
  outputs?: Record<string, any>;
  error?: string;
}
```

---

## 2. Sync Manager API

The `SyncManager` class coordinates all synchronization operations.

### Constructor

```typescript
class SyncManager {
  constructor(repoPath: string, config: SyncConfig)
}
```

**Parameters:**
- `repoPath`: Absolute path to Git repository
- `config`: Sync configuration options

**Example:**
```typescript
import { SyncManager } from '.zenflow/core/sync/manager';

const syncManager = new SyncManager('/path/to/repo', {
  enabled: true,
  autoPush: true,
  maxRetries: 3,
  timeout: 300000,
  conflictStrategy: 'abort',
  excludedWorktrees: ['temp-*', 'experimental-*'],
  notificationChannels: ['console', 'log'],
  verificationCommands: ['npm run lint', 'npm run typecheck'],
});
```

### syncWorktree()

Synchronize a single worktree to main branch.

```typescript
async syncWorktree(
  branch: string, 
  options?: SyncOptions
): Promise<SyncOperation>
```

**Parameters:**
- `branch`: Worktree branch name to sync
- `options`: Optional sync configuration (overrides defaults)

**Returns:** `SyncOperation` object with sync results

**Throws:**
- `ValidationError`: If validation fails (excluded branch, invalid preconditions)
- `SyncOperationError`: If sync operation fails

**Example:**
```typescript
try {
  const result = await syncManager.syncWorktree('feature/new-feature', {
    dryRun: false,
    autoPush: true,
  });
  
  console.log(`Sync ${result.status}: ${result.diff_summary?.files_changed} files changed`);
  
  if (result.status === 'conflict') {
    console.log('Conflicts detected:', result.conflict_info?.conflicted_files);
  }
} catch (error) {
  console.error('Sync failed:', error.message);
}
```

### syncAllWorktrees()

Synchronize all active worktrees to main branch.

```typescript
async syncAllWorktrees(options?: SyncOptions): Promise<SyncOperation[]>
```

**Parameters:**
- `options`: Optional sync configuration applied to all worktrees

**Returns:** Array of `SyncOperation` results (one per worktree)

**Example:**
```typescript
const results = await syncManager.syncAllWorktrees({ dryRun: true });

console.log(`Total: ${results.length} worktrees`);
console.log(`Success: ${results.filter(r => r.status === 'success').length}`);
console.log(`Conflicts: ${results.filter(r => r.status === 'conflict').length}`);
console.log(`Failures: ${results.filter(r => r.status === 'failure').length}`);
```

### analyzeDiff()

Analyze differences between worktree and main branch.

```typescript
async analyzeDiff(branch: string): Promise<DiffSummary>
```

**Parameters:**
- `branch`: Worktree branch name

**Returns:** `DiffSummary` object with change statistics

**Example:**
```typescript
const diff = await syncManager.analyzeDiff('feature/new-feature');

console.log(`${diff.files_changed} files changed`);
console.log(`+${diff.insertions} -${diff.deletions} lines`);

diff.files.forEach(file => {
  console.log(`  ${file.status} ${file.path} (+${file.insertions} -${file.deletions})`);
});
```

### checkConflicts()

Check for merge conflicts between worktree and main branch.

```typescript
async checkConflicts(branch: string): Promise<ConflictInfo>
```

**Parameters:**
- `branch`: Worktree branch name

**Returns:** `ConflictInfo` object with conflict details

**Example:**
```typescript
const conflicts = await syncManager.checkConflicts('feature/new-feature');

if (conflicts.has_conflicts) {
  console.error(`Conflicts detected (risk: ${conflicts.risk_level})`);
  conflicts.conflicted_files.forEach(file => {
    console.error(`  - ${file}`);
  });
} else {
  console.log('No conflicts detected');
}
```

### validateSync()

Validate preconditions before syncing.

```typescript
async validateSync(branch: string): Promise<ValidationResult>
```

**Parameters:**
- `branch`: Worktree branch name

**Returns:** `ValidationResult` with validation checks

**Example:**
```typescript
const validation = await syncManager.validateSync('feature/new-feature');

if (!validation.valid) {
  console.error('Validation failed:');
  validation.errors.forEach(err => console.error(`  - ${err}`));
}

validation.checks.forEach(check => {
  const status = check.passed ? '✓' : '✗';
  console.log(`${status} ${check.name}: ${check.message || ''}`);
});
```

### rollbackSync()

Rollback a previous sync operation.

```typescript
async rollbackSync(syncId: string): Promise<void>
```

**Parameters:**
- `syncId`: ID of sync operation to rollback (from `SyncOperation.id`)

**Throws:**
- `ValidationError`: If sync not found or already rolled back

**Example:**
```typescript
// Perform sync
const result = await syncManager.syncWorktree('feature/bad-change');

// Rollback if issues found
if (result.status === 'success' && result.id) {
  await syncManager.rollbackSync(result.id);
  console.log('Sync rolled back successfully');
}
```

### getSyncHistory()

Query sync operation history.

```typescript
async getSyncHistory(filters?: SyncFilters): Promise<SyncOperation[]>
```

**Parameters:**
- `filters`: Optional filters for querying history

**Returns:** Array of `SyncOperation` objects matching filters

**Example:**
```typescript
// Get last 10 sync operations
const recent = await syncManager.getSyncHistory({ limit: 10 });

// Get all failed syncs
const failures = await syncManager.getSyncHistory({ status: 'failure' });

// Get syncs for specific worktree
const branchSyncs = await syncManager.getSyncHistory({ 
  worktreeBranch: 'feature/new-feature' 
});

// Get syncs since yesterday
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const recent24h = await syncManager.getSyncHistory({ since: yesterday });
```

---

## 3. Rule Engine API

The `RuleEngine` class manages rule loading, validation, and execution.

### Constructor

```typescript
class RuleEngine {
  constructor(config: RuleEngineConfig)
}

interface RuleEngineConfig {
  rulesDirectory: string;    // Path to rules directory
  autoLoad: boolean;         // Load rules on construction
}
```

**Example:**
```typescript
import { RuleEngine } from '.zenflow/core/rules/engine';

const ruleEngine = new RuleEngine({
  rulesDirectory: '/path/to/.zenflow/rules',
  autoLoad: true,
});
```

### loadRules()

Load all rules from rules directory.

```typescript
async loadRules(): Promise<Rule[]>
```

**Returns:** Array of loaded `Rule` objects

**Example:**
```typescript
const rules = await ruleEngine.loadRules();
console.log(`Loaded ${rules.length} rules`);
```

### loadRule()

Load a specific rule by name.

```typescript
async loadRule(name: string): Promise<Rule>
```

**Parameters:**
- `name`: Rule name (without .yaml extension)

**Returns:** `Rule` object

**Throws:**
- `ValidationError`: If rule not found or invalid

**Example:**
```typescript
const rule = await ruleEngine.loadRule('worktree-to-main-sync');
console.log(`Loaded rule: ${rule.description}`);
```

### validateRule()

Validate a rule against schema.

```typescript
async validateRule(rule: Rule): Promise<ValidationResult>
```

**Parameters:**
- `rule`: Rule object to validate

**Returns:** Validation result with errors if any

**Example:**
```typescript
const validation = await ruleEngine.validateRule(rule);

if (!validation.valid) {
  console.error('Rule validation failed:');
  validation.errors.forEach(err => console.error(`  - ${err}`));
}
```

### evaluateRule()

Evaluate if a rule should trigger for an event.

```typescript
async evaluateRule(rule: Rule, event: Event): Promise<boolean>
```

**Parameters:**
- `rule`: Rule to evaluate
- `event`: Event to evaluate against

**Returns:** `true` if rule should trigger, `false` otherwise

**Example:**
```typescript
const event: Event = {
  id: 'evt-123',
  type: 'worktree_commit',
  timestamp: new Date(),
  source: 'git-hook',
  data: {
    branch: 'feature/new-feature',
    commit: 'abc123',
  },
};

const shouldTrigger = await ruleEngine.evaluateRule(rule, event);

if (shouldTrigger) {
  console.log('Rule matched event, executing actions...');
}
```

### executeRule()

Execute a rule's actions if conditions match.

```typescript
async executeRule(rule: Rule, event: Event): Promise<void>
```

**Parameters:**
- `rule`: Rule to execute
- `event`: Event that triggered the rule

**Example:**
```typescript
await ruleEngine.executeRule(rule, event);
```

### enableRule() / disableRule()

Enable or disable a rule at runtime.

```typescript
async enableRule(name: string): Promise<void>
async disableRule(name: string): Promise<void>
```

**Parameters:**
- `name`: Rule name

**Example:**
```typescript
// Temporarily disable automatic sync
await ruleEngine.disableRule('worktree-to-main-sync');

// Re-enable later
await ruleEngine.enableRule('worktree-to-main-sync');
```

### findMatchingRules()

Find all enabled rules that match an event.

```typescript
async findMatchingRules(event: Event): Promise<Rule[]>
```

**Parameters:**
- `event`: Event to match against

**Returns:** Array of matching `Rule` objects

**Example:**
```typescript
const matchingRules = await ruleEngine.findMatchingRules(event);
console.log(`${matchingRules.length} rules matched this event`);

for (const rule of matchingRules) {
  await ruleEngine.executeRule(rule, event);
}
```

### getRules() / getEnabledRules() / getDisabledRules()

Query loaded rules.

```typescript
getRules(): Rule[]
getEnabledRules(): Rule[]
getDisabledRules(): Rule[]
```

**Returns:** Array of `Rule` objects

**Example:**
```typescript
const allRules = ruleEngine.getRules();
const enabledRules = ruleEngine.getEnabledRules();
const disabledRules = ruleEngine.getDisabledRules();

console.log(`Total: ${allRules.length}, Enabled: ${enabledRules.length}, Disabled: ${disabledRules.length}`);
```

---

## 4. Workflow Engine API

The `WorkflowEngine` class manages workflow execution.

### Constructor

```typescript
class WorkflowEngine {
  constructor(config: WorkflowEngineConfig)
}

interface WorkflowEngineConfig {
  workflowsDirectory: string;  // Path to workflows directory
  stateDirectory: string;      // Path to state directory
  maxConcurrent: number;       // Max concurrent workflows
}
```

**Example:**
```typescript
import { WorkflowEngine } from '.zenflow/core/workflows/engine';

const workflowEngine = new WorkflowEngine({
  workflowsDirectory: '/path/to/.zenflow/workflows',
  stateDirectory: '/path/to/.zenflow/state/executions',
  maxConcurrent: 5,
});
```

### executeWorkflow()

Execute a workflow.

```typescript
async executeWorkflow(
  name: string, 
  inputs: Record<string, unknown>
): Promise<WorkflowExecution>
```

**Parameters:**
- `name`: Workflow name (without .yaml extension)
- `inputs`: Input values for workflow

**Returns:** `WorkflowExecution` object with execution results

**Throws:**
- `WorkflowExecutionError`: If workflow fails

**Example:**
```typescript
const execution = await workflowEngine.executeWorkflow('sync-worktree-to-main', {
  branch_name: 'feature/new-feature',
  dry_run: false,
  auto_push: true,
});

console.log(`Workflow execution ${execution.status}`);
console.log(`Started: ${execution.started_at}`);
console.log(`Completed: ${execution.completed_at}`);
console.log(`Outputs:`, execution.outputs);
```

### resumeWorkflow()

Resume a failed or paused workflow.

```typescript
async resumeWorkflow(executionId: string): Promise<WorkflowExecution>
```

**Parameters:**
- `executionId`: Execution ID to resume

**Returns:** Updated `WorkflowExecution` object

**Example:**
```typescript
// Resume from last successful step
const resumed = await workflowEngine.resumeWorkflow('exec-abc-123');
console.log(`Workflow resumed: ${resumed.status}`);
```

### rollbackWorkflow()

Rollback a workflow execution.

```typescript
async rollbackWorkflow(executionId: string): Promise<void>
```

**Parameters:**
- `executionId`: Execution ID to rollback

**Example:**
```typescript
await workflowEngine.rollbackWorkflow('exec-abc-123');
console.log('Workflow rolled back successfully');
```

### getExecutionStatus()

Get current execution status.

```typescript
async getExecutionStatus(executionId: string): Promise<WorkflowExecution>
```

**Parameters:**
- `executionId`: Execution ID

**Returns:** Current `WorkflowExecution` state

**Example:**
```typescript
const execution = await workflowEngine.getExecutionStatus('exec-abc-123');
console.log(`Status: ${execution.status}`);

execution.steps.forEach(step => {
  console.log(`  Step ${step.step_id}: ${step.status}`);
});
```

### listExecutions()

Query workflow execution history.

```typescript
listExecutions(filters?: {
  workflow?: string;
  status?: WorkflowExecution['status'];
  since?: Date;
  limit?: number;
}): WorkflowExecution[]
```

**Parameters:**
- `filters`: Optional filters

**Returns:** Array of `WorkflowExecution` objects

**Example:**
```typescript
// Get last 10 executions
const recent = workflowEngine.listExecutions({ limit: 10 });

// Get failed executions
const failures = workflowEngine.listExecutions({ status: 'failure' });

// Get executions for specific workflow
const syncExecutions = workflowEngine.listExecutions({ 
  workflow: 'sync-worktree-to-main' 
});
```

---

## 5. Git Client API

The `GitClient` class wraps Git CLI operations.

### Constructor

```typescript
class GitClient {
  constructor(repoPath: string)
}
```

**Parameters:**
- `repoPath`: Absolute path to Git repository

**Example:**
```typescript
import { GitClient } from '.zenflow/core/git/client';

const gitClient = new GitClient('/path/to/repo');
```

### listWorktrees()

List all worktrees in repository.

```typescript
async listWorktrees(): Promise<Worktree[]>
```

**Returns:** Array of `Worktree` objects

**Example:**
```typescript
const worktrees = await gitClient.listWorktrees();

worktrees.forEach(wt => {
  console.log(`Branch: ${wt.branch}`);
  console.log(`  Path: ${wt.path}`);
  console.log(`  Commit: ${wt.commit}`);
  console.log(`  Locked: ${wt.locked}`);
});
```

### getWorktree()

Get worktree for specific branch.

```typescript
async getWorktree(branch: string): Promise<Worktree | null>
```

**Parameters:**
- `branch`: Branch name (with or without `refs/heads/` prefix)

**Returns:** `Worktree` object or `null` if not found

**Example:**
```typescript
const worktree = await gitClient.getWorktree('feature/new-feature');

if (worktree) {
  console.log(`Found worktree at: ${worktree.path}`);
} else {
  console.log('Worktree not found');
}
```

### diff()

Get diff summary between two branches.

```typescript
async diff(base: string, target: string): Promise<DiffSummary>
```

**Parameters:**
- `base`: Base branch name
- `target`: Target branch name

**Returns:** `DiffSummary` object

**Example:**
```typescript
const diff = await gitClient.diff('main', 'feature/new-feature');
console.log(`${diff.files_changed} files changed`);
```

### createCommit()

Create a commit with specified files.

```typescript
async createCommit(
  message: string, 
  files: string[]
): Promise<string>
```

**Parameters:**
- `message`: Commit message
- `files`: Array of file paths to commit

**Returns:** Commit hash

**Example:**
```typescript
const commitHash = await gitClient.createCommit(
  'chore: merge feature/new-feature into main',
  ['file1.ts', 'file2.ts']
);

console.log(`Created commit: ${commitHash}`);
```

### push()

Push branch to remote.

```typescript
async push(remote: string, branch: string): Promise<void>
```

**Parameters:**
- `remote`: Remote name (e.g., 'origin')
- `branch`: Branch name to push

**Example:**
```typescript
await gitClient.push('origin', 'main');
console.log('Pushed to remote successfully');
```

### createStash() / applyStash()

Create and apply Git stashes for backup/restore.

```typescript
async createStash(message: string): Promise<string>
async applyStash(stashId: string): Promise<void>
```

**Parameters:**
- `message`: Stash description
- `stashId`: Stash identifier (from `createStash()`)

**Example:**
```typescript
// Create backup before risky operation
const stashId = await gitClient.createStash('Backup before merge');
console.log(`Created stash: ${stashId}`);

try {
  // Perform risky operation
  await performMerge();
} catch (error) {
  // Restore from backup
  await gitClient.applyStash(stashId);
  console.log('Restored from backup');
}
```

---

## 6. Configuration API

### loadConfig()

Load Zenflow configuration from `.zenflow/settings.json`.

```typescript
import { loadConfig } from '.zenflow/core/config/loader';

const config = await loadConfig('/path/to/repo');
console.log('Zenflow config:', config);
```

### Configuration Schema

```typescript
interface ZenflowConfig {
  sync: SyncConfig;
  rules: RuleEngineConfig;
  workflows: WorkflowEngineConfig;
  logging: LoggingConfig;
  git: GitConfig;
}

interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  directory: string;
  maxFiles: string;
  maxSize: string;
}

interface GitConfig {
  defaultRemote: string;
  mainBranch: string;
  pushOnSync: boolean;
}
```

---

## 7. Logger API

### getLogger()

Get configured Winston logger instance.

```typescript
import { getLogger } from '.zenflow/core/utils/logger';

const logger = getLogger();

logger.debug('Debug message', { context: 'additional data' });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', { error: error.message });
```

### Log Levels

- **debug**: Detailed diagnostic information
- **info**: General informational messages
- **warn**: Warning messages (non-critical issues)
- **error**: Error messages (critical issues)

### Structured Logging

All log methods accept a metadata object as second parameter:

```typescript
logger.info('Sync operation completed', {
  syncId: 'sync-123',
  branch: 'feature/new-feature',
  filesChanged: 15,
  duration: 3500,
});
```

---

## 8. Error Types

### SyncOperationError

Thrown when sync operation fails.

```typescript
class SyncOperationError extends Error {
  constructor(message: string, branch: string, syncId?: string)
  
  branch: string;      // Worktree branch that failed
  syncId?: string;     // Sync operation ID
}
```

### ValidationError

Thrown when validation fails.

```typescript
class ValidationError extends Error {
  constructor(message: string, errors?: string[])
  
  errors?: string[];   // List of validation errors
}
```

### WorkflowExecutionError

Thrown when workflow execution fails.

```typescript
class WorkflowExecutionError extends Error {
  constructor(message: string, workflowName: string, stepId?: string)
  
  workflowName: string;  // Workflow that failed
  stepId?: string;       // Step that failed
}
```

### GitOperationError

Thrown when Git operation fails.

```typescript
class GitOperationError extends Error {
  constructor(message: string, command: string)
  
  command: string;     // Git command that failed
}
```

### Error Handling Example

```typescript
import {
  SyncOperationError,
  ValidationError,
  WorkflowExecutionError,
  GitOperationError
} from '.zenflow/core/utils/errors';

try {
  await syncManager.syncWorktree('feature/new-feature');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof SyncOperationError) {
    console.error(`Sync failed for branch ${error.branch}:`, error.message);
  } else if (error instanceof GitOperationError) {
    console.error(`Git command failed: ${error.command}`, error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Usage Examples

### Complete Sync Example

```typescript
import { SyncManager } from '.zenflow/core/sync/manager';
import { loadConfig } from '.zenflow/core/config/loader';

// Load configuration
const config = await loadConfig(process.cwd());

// Create sync manager
const syncManager = new SyncManager(process.cwd(), config.sync);

// Validate before syncing
const validation = await syncManager.validateSync('feature/new-feature');

if (!validation.valid) {
  console.error('Validation failed:', validation.errors);
  process.exit(1);
}

// Check for conflicts
const conflicts = await syncManager.checkConflicts('feature/new-feature');

if (conflicts.has_conflicts) {
  console.error('Conflicts detected:', conflicts.conflicted_files);
  process.exit(1);
}

// Perform dry run
const dryRun = await syncManager.syncWorktree('feature/new-feature', {
  dryRun: true,
});

console.log('Dry run results:', dryRun.diff_summary);

// Confirm and execute
if (confirm('Proceed with sync?')) {
  const result = await syncManager.syncWorktree('feature/new-feature', {
    autoPush: true,
  });
  
  console.log(`Sync ${result.status}: ${result.id}`);
}
```

### Complete Rule Execution Example

```typescript
import { RuleEngine } from '.zenflow/core/rules/engine';
import { EventEmitter } from '.zenflow/core/events/emitter';

// Initialize engines
const ruleEngine = new RuleEngine({
  rulesDirectory: '/path/to/.zenflow/rules',
  autoLoad: true,
});

const eventEmitter = new EventEmitter();

// Listen for events and execute matching rules
eventEmitter.on('worktree_commit', async (event) => {
  console.log('Received event:', event.type);
  
  const matchingRules = await ruleEngine.findMatchingRules(event);
  
  for (const rule of matchingRules) {
    try {
      await ruleEngine.executeRule(rule, event);
      console.log(`Rule ${rule.name} executed successfully`);
    } catch (error) {
      console.error(`Rule ${rule.name} failed:`, error.message);
    }
  }
});

// Emit event
eventEmitter.emit({
  id: 'evt-123',
  type: 'worktree_commit',
  timestamp: new Date(),
  source: 'git-hook',
  data: {
    branch: 'feature/new-feature',
    commit: 'abc123',
  },
});
```

---

## Related Documentation

- [Architecture Documentation](./architecture.md) - System architecture and design
- [Operations Guide](./operations.md) - Deployment and monitoring
- [Contributing Guide](./contributing.md) - How to extend Zenflow
