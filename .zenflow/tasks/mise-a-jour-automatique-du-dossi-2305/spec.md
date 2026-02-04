# Technical Specification
## Automatic Worktree-to-Main Directory Synchronization System

**Version:** 1.0  
**Date:** 2026-02-03  
**Status:** Draft  
**Related:** [requirements.md](./requirements.md)

---

## 1. Technical Context

### 1.1 Technology Stack

**Core Technologies:**
- **Language:** TypeScript 5.x (strict mode)
- **Runtime:** Node.js 20.x
- **Shell Scripts:** Bash 4.0+
- **Configuration Format:** YAML (via `js-yaml` v4.x)
- **Version Control:** Git 2.25+

**Key Dependencies:**
- **YAML Parser:** `js-yaml` - YAML parsing and serialization
- **File System Watcher:** `chokidar` - Cross-platform file watching
- **CLI Framework:** `commander` - Command-line interface builder
- **Logging:** `winston` - Structured logging framework
- **Schema Validation:** `zod` - TypeScript-first schema validation
- **Process Management:** `pm2` - Production process manager

**Existing Project Stack:**
- Next.js 15.x
- Prisma 6.x (PostgreSQL ORM)
- TypeScript with strict type checking
- ESLint + Prettier for code quality
- Jest for unit/integration testing

### 1.2 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Zenflow Sync System                      │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │Event Detector│   │ Rule Engine  │   │Workflow Engine│
   └──────────────┘   └──────────────┘   └──────────────┘
          │                   │                   │
          │                   ▼                   │
          │           ┌──────────────┐           │
          └──────────▶│ Orchestrator │◀──────────┘
                      └──────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   Git Layer  │   │  File System │   │ State Manager│
   └──────────────┘   └──────────────┘   └──────────────┘
```

**Component Responsibilities:**

1. **Event Detector**: Monitors worktrees for changes (Git hooks, file watchers)
2. **Rule Engine**: Evaluates rules against events, determines if action needed
3. **Workflow Engine**: Executes workflow steps sequentially with error handling
4. **Orchestrator**: Coordinates components, manages queues and locks
5. **Git Layer**: Abstracts Git operations (diff, merge, commit, push)
6. **File System**: Handles file operations, respects exclusions
7. **State Manager**: Persists execution state, enables resume/rollback

### 1.3 Deployment Model

**Phase 1 (MVP):** Manual CLI execution
- Run commands manually: `zenflow sync --auto`
- Suitable for testing and validation

**Phase 2 (Semi-Automated):** Cron-based execution
- Schedule via crontab: `*/5 * * * * zenflow sync --auto`
- Lightweight, no daemon required

**Phase 3 (Fully Automated):** Systemd service
- Background daemon monitoring events
- Auto-start on system boot
- Graceful shutdown handling

---

## 2. Implementation Approach

### 2.1 Architecture Patterns

**Modular Design:**
- Each component is independently testable
- Clear interfaces between modules
- Plugin architecture for extensibility

**Event-Driven Architecture:**
- Loose coupling via event system
- Easy to add new event sources
- Centralized event processing

**Configuration-Driven Behavior:**
- Behavior defined in YAML, not code
- No code changes for new rules/workflows
- Schema validation ensures correctness

**Defensive Programming:**
- Validate all inputs
- Fail fast with clear errors
- Atomic operations with rollback
- Comprehensive logging

### 2.2 Design Principles

1. **Safety First:** Never lose data, never corrupt repository
2. **Transparency:** Log everything, make state observable
3. **Resilience:** Recover from failures, retry transient errors
4. **Performance:** Async operations, efficient Git usage
5. **Maintainability:** Clear code, good documentation, tests
6. **Extensibility:** Easy to add new rules, workflows, actions

### 2.3 Key Design Decisions

| Decision | Option Chosen | Rationale |
|----------|---------------|-----------|
| **Language** | TypeScript | Type safety, existing project standard |
| **Config Format** | YAML | Human-readable, standard for workflows |
| **Schema Validation** | Zod | Runtime validation, TypeScript integration |
| **Logging** | Winston | Structured logs, multiple transports |
| **CLI** | Commander | Feature-rich, well-maintained |
| **Process Manager** | PM2 | Simple, powerful, Node.js native |
| **Auto-push** | Enabled | Full automation, with rate limiting |
| **Concurrency** | Sequential (Phase 1) | Safer, simpler implementation |

---

## 3. Source Code Structure

### 3.1 New Directory Structure

```
/home/alaeddine/Bureau/nexus-project_v0/
├── .zenflow/
│   ├── cli/                          # CLI implementation
│   │   ├── index.ts                  # Main CLI entry point
│   │   ├── commands/                 # Command implementations
│   │   │   ├── sync.ts               # Sync commands
│   │   │   ├── rule.ts               # Rule management
│   │   │   ├── workflow.ts           # Workflow management
│   │   │   └── status.ts             # Status/info commands
│   │   └── utils/                    # CLI utilities
│   │       ├── output.ts             # Formatted output
│   │       └── validation.ts         # Input validation
│   ├── core/                         # Core engine
│   │   ├── config/                   # Configuration management
│   │   │   ├── loader.ts             # Config file loader
│   │   │   ├── schema.ts             # Config schema (Zod)
│   │   │   └── validator.ts          # Config validator
│   │   ├── events/                   # Event system
│   │   │   ├── detector.ts           # Event detection
│   │   │   ├── emitter.ts            # Event emitter
│   │   │   └── types.ts              # Event types
│   │   ├── git/                      # Git operations
│   │   │   ├── client.ts             # Git client wrapper
│   │   │   ├── diff.ts               # Diff analysis
│   │   │   ├── merge.ts              # Merge operations
│   │   │   ├── worktree.ts           # Worktree management
│   │   │   └── hooks/                # Git hooks
│   │   │       ├── post-commit.sh    # Trigger on commit
│   │   │       └── pre-push.sh       # Validation before push
│   │   ├── rules/                    # Rule engine
│   │   │   ├── engine.ts             # Rule execution engine
│   │   │   ├── loader.ts             # Rule file loader
│   │   │   ├── evaluator.ts          # Condition evaluator
│   │   │   ├── schema.ts             # Rule schema (Zod)
│   │   │   └── types.ts              # Rule types
│   │   ├── workflows/                # Workflow engine
│   │   │   ├── engine.ts             # Workflow executor
│   │   │   ├── loader.ts             # Workflow file loader
│   │   │   ├── orchestrator.ts       # Step orchestration
│   │   │   ├── schema.ts             # Workflow schema (Zod)
│   │   │   ├── state.ts              # State management
│   │   │   └── types.ts              # Workflow types
│   │   ├── sync/                     # Sync logic
│   │   │   ├── analyzer.ts           # Diff analysis
│   │   │   ├── conflicts.ts          # Conflict detection
│   │   │   ├── merger.ts             # Safe merge implementation
│   │   │   ├── validator.ts          # Pre-sync validation
│   │   │   └── rollback.ts           # Rollback mechanism
│   │   └── utils/                    # Core utilities
│   │       ├── logger.ts             # Logging setup
│   │       ├── filesystem.ts         # File operations
│   │       ├── locks.ts              # Concurrency locks
│   │       └── errors.ts             # Custom error types
│   ├── daemon/                       # Background service (Phase 3)
│   │   ├── server.ts                 # Daemon entry point
│   │   ├── scheduler.ts              # Task scheduling
│   │   └── healthcheck.ts            # Health monitoring
│   ├── rules/                        # Rule definitions (YAML)
│   │   ├── sync/
│   │   │   └── worktree-to-main.yaml
│   │   ├── validation/
│   │   │   └── pre-commit.yaml
│   │   └── notification/
│   │       └── sync-alerts.yaml
│   ├── workflows/                    # Workflow definitions (YAML)
│   │   ├── sync-worktree-to-main.yaml
│   │   ├── rollback-sync.yaml
│   │   └── validate-worktree.yaml
│   ├── state/                        # Runtime state (gitignored)
│   │   ├── locks/                    # Concurrency locks
│   │   └── executions/               # Workflow execution state
│   ├── settings.json                 # Main configuration
│   └── tasks/                        # Existing tasks
├── .zenflowignore                    # Exclusion patterns
├── scripts/
│   └── zenflow/                      # Helper scripts
│       ├── setup.sh                  # Initial setup
│       ├── install-hooks.sh          # Install Git hooks
│       └── uninstall.sh              # Cleanup
└── package.json                      # Updated dependencies
```

### 3.2 Module Descriptions

#### **CLI Module** (`.zenflow/cli/`)
Provides command-line interface for all Zenflow operations.

**Key Files:**
- `index.ts`: Main entry point, parses commands
- `commands/sync.ts`: Sync operations (`zenflow sync --auto`)
- `commands/rule.ts`: Rule management (`zenflow rule list`)
- `commands/workflow.ts`: Workflow management (`zenflow workflow run`)

#### **Core Module** (`.zenflow/core/`)
Core business logic and engines.

**Git Layer** (`core/git/`):
- Wraps Git CLI operations
- Provides type-safe interfaces
- Handles error conditions
- Example: `GitClient.diff(branch1, branch2)`

**Rule Engine** (`core/rules/`):
- Loads YAML rule definitions
- Validates against schema
- Evaluates trigger conditions
- Executes actions

**Workflow Engine** (`core/workflows/`):
- Loads YAML workflow definitions
- Orchestrates step execution
- Manages state between steps
- Handles rollback on failure

**Sync Logic** (`core/sync/`):
- Analyzes diffs between worktrees and main
- Detects conflicts
- Performs safe merges
- Validates integrity

#### **Daemon Module** (`.zenflow/daemon/`) - Phase 3
Background service for continuous monitoring.

**Features:**
- File system watching (via Chokidar)
- Event processing queue
- Health check endpoint
- Graceful shutdown

---

## 4. Data Models & Interfaces

### 4.1 TypeScript Interfaces

#### **Rule Definition** (`core/rules/types.ts`)
```typescript
interface Rule {
  name: string;                       // Unique identifier
  version: string;                    // Semantic version
  description: string;                // Human-readable description
  author: string;                     // Rule creator
  enabled: boolean;                   // Active flag
  triggers: Trigger[];                // Event conditions
  conditions: Condition[];            // Pre-execution checks
  actions: Action[];                  // Operations to perform
  guards: Guards;                     // Safety constraints
  metadata?: Record<string, unknown>; // Additional data
}

interface Trigger {
  type: 'commit' | 'file_change' | 'schedule' | 'manual';
  branches?: BranchPattern;           // Branch filter
  events?: string[];                  // Event types
  schedule?: string;                  // Cron expression
}

interface Condition {
  type: string;                       // Condition type
  [key: string]: unknown;             // Type-specific params
}

interface Action {
  type: 'run_workflow' | 'shell' | 'log' | 'notify';
  [key: string]: unknown;             // Action parameters
}

interface Guards {
  max_retries: number;
  timeout: number;                    // Seconds
  on_error: 'abort' | 'rollback' | 'continue';
}
```

#### **Workflow Definition** (`core/workflows/types.ts`)
```typescript
interface Workflow {
  name: string;                       // Unique identifier
  version: string;                    // Semantic version
  description: string;                // Purpose
  author: string;                     // Creator
  inputs: WorkflowInput[];            // Required parameters
  outputs: WorkflowOutput[];          // Results produced
  steps: WorkflowStep[];              // Ordered operations
  error_handling: ErrorHandling;      // Failure recovery
  notifications?: Notifications;      // Alerting config
}

interface WorkflowInput {
  name: string;                       // Parameter name
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  description?: string;
}

interface WorkflowOutput {
  name: string;                       // Output name
  type: string;                       // Data type
  description?: string;
}

interface WorkflowStep {
  id: string;                         // Unique step ID
  name: string;                       // Display name
  type: 'shell' | 'javascript' | 'workflow';
  command?: string;                   // Shell command
  script?: string;                    // JS/TS script
  workflow?: string;                  // Sub-workflow name
  inputs?: Record<string, unknown>;   // Step inputs
  outputs?: Record<string, string>;   // Output mappings
  when?: string;                      // Conditional execution
  unless?: string;                    // Skip condition
  timeout?: number;                   // Step timeout (sec)
  on_failure?: 'abort' | 'continue' | 'skip_to_step' | 'rollback_to_step';
  continue_on_error?: boolean;
}

interface ErrorHandling {
  strategy: 'abort' | 'rollback' | 'continue';
  cleanup_steps?: WorkflowStep[];     // Steps to run on error
}

interface Notifications {
  on_success?: NotificationAction[];
  on_failure?: NotificationAction[];
}

interface NotificationAction {
  type: 'log' | 'email' | 'webhook';
  level?: 'debug' | 'info' | 'warn' | 'error';
  message?: string;
  [key: string]: unknown;
}
```

#### **Workflow Execution State** (`core/workflows/state.ts`)
```typescript
interface WorkflowExecution {
  id: string;                         // UUID
  workflow_name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'rolled_back';
  started_at: Date;
  completed_at?: Date;
  current_step?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  steps: StepExecution[];
  error?: Error;
}

interface StepExecution {
  step_id: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped';
  started_at?: Date;
  completed_at?: Date;
  outputs?: Record<string, unknown>;
  error?: string;
}
```

#### **Git Operations** (`core/git/types.ts`)
```typescript
interface Worktree {
  path: string;                       // Absolute path
  branch: string;                     // Associated branch
  commit: string;                     // Current commit hash
  locked: boolean;                    // Lock status
  prunable: boolean;                  // Can be removed
}

interface DiffSummary {
  files_changed: number;
  insertions: number;
  deletions: number;
  files: FileDiff[];
}

interface FileDiff {
  path: string;                       // Relative path
  status: 'A' | 'M' | 'D' | 'R' | 'C'; // Added/Modified/Deleted/Renamed/Copied
  insertions: number;
  deletions: number;
  binary: boolean;
}

interface ConflictInfo {
  has_conflicts: boolean;
  conflicted_files: string[];
  details: ConflictDetail[];
}

interface ConflictDetail {
  file: string;
  type: 'content' | 'delete/modify' | 'rename' | 'mode';
  description: string;
}

interface MergeResult {
  success: boolean;
  commit_hash?: string;
  conflicts?: ConflictInfo;
  error?: string;
}
```

#### **Sync Operation** (`core/sync/types.ts`)
```typescript
interface SyncOperation {
  id: string;                         // UUID
  worktree_branch: string;
  commit_hash: string;
  status: 'pending' | 'running' | 'success' | 'conflict' | 'failure' | 'rolled_back';
  started_at: Date;
  completed_at?: Date;
  diff_summary?: DiffSummary;
  conflict_info?: ConflictInfo;
  merge_result?: MergeResult;
  rollback_point?: string;            // Commit/stash hash
  error?: string;
}
```

### 4.2 YAML Schemas

#### **Rule Schema** (Zod validation)
```typescript
import { z } from 'zod';

const TriggerSchema = z.object({
  type: z.enum(['commit', 'file_change', 'schedule', 'manual']),
  branches: z.object({
    pattern: z.string(),
  }).optional(),
  events: z.array(z.string()).optional(),
  schedule: z.string().optional(),
});

const ConditionSchema = z.object({
  type: z.string(),
}).passthrough(); // Allow additional properties

const ActionSchema = z.object({
  type: z.enum(['run_workflow', 'shell', 'log', 'notify']),
}).passthrough();

const GuardsSchema = z.object({
  max_retries: z.number().int().min(0).max(10),
  timeout: z.number().int().min(0),
  on_error: z.enum(['abort', 'rollback', 'continue']),
});

export const RuleSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string(),
  author: z.string(),
  enabled: z.boolean(),
  triggers: z.array(TriggerSchema).min(1),
  conditions: z.array(ConditionSchema),
  actions: z.array(ActionSchema).min(1),
  guards: GuardsSchema,
  metadata: z.record(z.unknown()).optional(),
});
```

#### **Workflow Schema** (Zod validation)
```typescript
const WorkflowInputSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  required: z.boolean(),
  default: z.unknown().optional(),
  description: z.string().optional(),
});

const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['shell', 'javascript', 'workflow']),
  command: z.string().optional(),
  script: z.string().optional(),
  workflow: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
  outputs: z.record(z.string()).optional(),
  when: z.string().optional(),
  unless: z.string().optional(),
  timeout: z.number().optional(),
  on_failure: z.enum(['abort', 'continue', 'skip_to_step', 'rollback_to_step']).optional(),
  continue_on_error: z.boolean().optional(),
});

const ErrorHandlingSchema = z.object({
  strategy: z.enum(['abort', 'rollback', 'continue']),
  cleanup_steps: z.array(WorkflowStepSchema).optional(),
});

export const WorkflowSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  inputs: z.array(WorkflowInputSchema),
  outputs: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
  })),
  steps: z.array(WorkflowStepSchema).min(1),
  error_handling: ErrorHandlingSchema,
  notifications: z.object({
    on_success: z.array(z.record(z.unknown())).optional(),
    on_failure: z.array(z.record(z.unknown())).optional(),
  }).optional(),
});
```

### 4.3 Configuration Schema

#### **Settings Extension** (`.zenflow/settings.json`)
```typescript
interface ZenflowSettings {
  // ... existing settings
  
  sync: {
    enabled: boolean;                 // Master on/off switch
    auto_push: boolean;               // Push to remote after sync
    max_retries: number;              // Retry failed syncs
    timeout: number;                  // Sync timeout (seconds)
    conflict_strategy: 'abort' | 'manual'; // How to handle conflicts
    excluded_worktrees: string[];     // Worktrees to ignore
    notification_channels: ('console' | 'log' | 'email' | 'webhook')[];
    verification_commands: string[];  // Commands to run after sync
  };
  
  rules: {
    directory: string;                // Path to rules folder
    auto_load: boolean;               // Load rules on startup
    validation_strict: boolean;       // Strict schema validation
  };
  
  workflows: {
    directory: string;                // Path to workflows folder
    state_directory: string;          // Path to execution state
    max_concurrent: number;           // Max parallel workflows (Phase 2+)
  };
  
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    directory: string;                // Log file directory
    rotation: 'daily' | 'weekly' | 'size';
    retention_days: number;           // Keep logs for N days
    max_size_mb: number;              // Max log file size
    format: 'json' | 'text';          // Log format
  };
  
  git: {
    main_directory: string;           // Path to main repo
    worktrees_directory: string;      // Path to worktrees
    remote: string;                   // Remote name (e.g., 'origin')
    default_branch: string;           // Main branch name
  };
}
```

---

## 5. API Specifications

### 5.1 CLI Commands

#### **Sync Commands**
```bash
# Automatic sync (checks all worktrees)
zenflow sync --auto [--dry-run]

# Sync specific worktree
zenflow sync --worktree <name> [--force] [--dry-run]

# List sync history
zenflow sync list [--since <date>] [--status <status>] [--limit <n>]

# Show sync details
zenflow sync show <sync-id>

# Rollback sync
zenflow sync rollback <sync-id>
```

#### **Rule Commands**
```bash
# List all rules
zenflow rule list [--enabled|--disabled]

# Show rule details
zenflow rule show <rule-name>

# Validate rule file
zenflow rule validate <file>

# Enable/disable rule
zenflow rule enable <rule-name>
zenflow rule disable <rule-name>

# Test rule (dry-run)
zenflow rule test <rule-name> [--event <event-json>]
```

#### **Workflow Commands**
```bash
# List all workflows
zenflow workflow list

# Show workflow details
zenflow workflow show <workflow-name>

# Run workflow manually
zenflow workflow run <workflow-name> [--input key=value ...]

# Validate workflow file
zenflow workflow validate <file>

# Show execution status
zenflow workflow status <execution-id>

# View execution logs
zenflow workflow logs <execution-id>
```

#### **Status Commands**
```bash
# Overall system status
zenflow status

# Worktree status
zenflow status worktrees

# Service status (daemon)
zenflow status service
```

#### **Daemon Commands** (Phase 3)
```bash
# Start daemon
zenflow daemon start

# Stop daemon
zenflow daemon stop

# Restart daemon
zenflow daemon restart

# View daemon logs
zenflow daemon logs [--follow] [--lines <n>]
```

### 5.2 Programmatic API (TypeScript)

#### **GitClient API**
```typescript
class GitClient {
  constructor(repoPath: string);
  
  async listWorktrees(): Promise<Worktree[]>;
  async getWorktree(branch: string): Promise<Worktree | null>;
  async diff(base: string, target: string): Promise<DiffSummary>;
  async checkConflicts(base: string, target: string): Promise<ConflictInfo>;
  async merge(branch: string, message: string): Promise<MergeResult>;
  async createCommit(message: string, files?: string[]): Promise<string>;
  async push(remote: string, branch: string): Promise<void>;
  async createStash(message: string): Promise<string>;
  async applyStash(stashId: string): Promise<void>;
}
```

#### **RuleEngine API**
```typescript
class RuleEngine {
  constructor(config: RuleEngineConfig);
  
  async loadRules(): Promise<Rule[]>;
  async loadRule(name: string): Promise<Rule>;
  async validateRule(rule: Rule): Promise<ValidationResult>;
  async evaluateRule(rule: Rule, event: Event): Promise<boolean>;
  async executeRule(rule: Rule, event: Event): Promise<void>;
  async enableRule(name: string): Promise<void>;
  async disableRule(name: string): Promise<void>;
}
```

#### **WorkflowEngine API**
```typescript
class WorkflowEngine {
  constructor(config: WorkflowEngineConfig);
  
  async loadWorkflows(): Promise<Workflow[]>;
  async loadWorkflow(name: string): Promise<Workflow>;
  async validateWorkflow(workflow: Workflow): Promise<ValidationResult>;
  async executeWorkflow(name: string, inputs: Record<string, unknown>): Promise<WorkflowExecution>;
  async resumeWorkflow(executionId: string): Promise<WorkflowExecution>;
  async rollbackWorkflow(executionId: string): Promise<void>;
  async getExecutionStatus(executionId: string): Promise<WorkflowExecution>;
}
```

#### **SyncManager API**
```typescript
class SyncManager {
  constructor(config: SyncConfig);
  
  async syncWorktree(branch: string, options?: SyncOptions): Promise<SyncOperation>;
  async syncAllWorktrees(options?: SyncOptions): Promise<SyncOperation[]>;
  async analyzeDiff(branch: string): Promise<DiffSummary>;
  async checkConflicts(branch: string): Promise<ConflictInfo>;
  async validateSync(branch: string): Promise<ValidationResult>;
  async rollbackSync(syncId: string): Promise<void>;
  async getSyncHistory(filters?: SyncFilters): Promise<SyncOperation[]>;
}
```

---

## 6. Delivery Phases

### Phase 1: Foundation & Core (Week 1-2)

**Objectives:**
- Establish project structure
- Implement core engines (Rule, Workflow, Git)
- Build CLI skeleton
- Set up logging and validation

**Deliverables:**
1. **Project Structure** (Day 1-2)
   - Create directory structure
   - Set up TypeScript configuration
   - Install dependencies
   - Configure linting and formatting

2. **Schema Definitions** (Day 2-3)
   - Define Zod schemas for rules and workflows
   - Create TypeScript interfaces
   - Write schema tests

3. **Git Layer** (Day 3-5)
   - Implement `GitClient` class
   - Worktree discovery
   - Diff analysis
   - Conflict detection
   - Unit tests

4. **Rule Engine** (Day 6-8)
   - Rule loader and validator
   - Trigger evaluation logic
   - Action dispatcher
   - Unit tests

5. **Workflow Engine** (Day 9-10)
   - Workflow loader and validator
   - Step executor
   - State management
   - Error handling and rollback
   - Unit tests

6. **Logging Infrastructure** (Day 11-12)
   - Winston setup
   - Structured logging
   - Log rotation
   - Unit tests

7. **CLI Framework** (Day 13-14)
   - Commander.js setup
   - Command structure
   - Help documentation
   - Input validation

**Success Criteria:**
- ✅ All schemas validate correctly
- ✅ Git operations work reliably
- ✅ Rules can be loaded and validated
- ✅ Workflows can be loaded and validated
- ✅ Logs are structured and readable
- ✅ CLI shows help and validates inputs
- ✅ Unit tests pass with >80% coverage

---

### Phase 2: Sync Logic & Initial Automation (Week 3)

**Objectives:**
- Implement core synchronization logic
- Create initial rules and workflows
- Enable manual sync operations
- Add comprehensive validation

**Deliverables:**
1. **Sync Analyzer** (Day 15-16)
   - Diff analysis between worktree and main
   - File change categorization
   - Change impact assessment
   - Tests

2. **Conflict Detection** (Day 17-18)
   - Multi-strategy conflict detection
   - Binary file handling
   - Conflict reporting
   - Tests

3. **Safe Merger** (Day 19-20)
   - Atomic merge operations
   - Backup before merge
   - Rollback mechanism
   - Tests

4. **Pre-Sync Validation** (Day 20-21)
   - Disk space check
   - Repository health check
   - Permission validation
   - Network connectivity check
   - Tests

5. **Default Rule & Workflow** (Day 21)
   - `worktree-to-main-sync.yaml` rule
   - `sync-worktree-to-main.yaml` workflow
   - `rollback-sync.yaml` workflow

6. **CLI Sync Commands** (Day 21)
   - `zenflow sync --worktree <name>`
   - `zenflow sync --auto`
   - `zenflow sync rollback <id>`

**Success Criteria:**
- ✅ Can sync a single worktree manually
- ✅ Conflicts are detected reliably
- ✅ Rollback restores previous state
- ✅ Validation prevents unsafe operations
- ✅ Integration tests pass

---

### Phase 3: Full Automation & Event Detection (Week 4)

**Objectives:**
- Implement automatic sync triggers
- Add Git hooks
- Create daemon service
- Enable continuous monitoring

**Deliverables:**
1. **Git Hooks** (Day 22-23)
   - `post-commit` hook in worktrees
   - Hook installation script
   - Hook communication with Zenflow
   - Tests

2. **Event Detector** (Day 24-25)
   - File system watcher (Chokidar)
   - Event queue
   - Event debouncing
   - Tests

3. **Orchestrator** (Day 26-27)
   - Event-to-rule mapping
   - Concurrency control (locks)
   - Queue management
   - Tests

4. **Daemon Service** (Day 28)
   - Background service implementation
   - Health check endpoint
   - Graceful shutdown
   - PM2 configuration

5. **CLI Daemon Commands** (Day 28)
   - `zenflow daemon start/stop/restart`
   - `zenflow daemon logs`

**Success Criteria:**
- ✅ Commit in worktree triggers sync automatically
- ✅ Multiple commits are queued and processed
- ✅ Daemon survives restarts
- ✅ No race conditions or deadlocks
- ✅ End-to-end tests pass

---

### Phase 4: Safety, Testing & Documentation (Week 5)

**Objectives:**
- Comprehensive testing
- Error handling refinement
- Security hardening
- Complete documentation

**Deliverables:**
1. **Enhanced Error Handling** (Day 29)
   - Custom error types
   - Detailed error messages
   - Recovery procedures
   - Tests

2. **Security Hardening** (Day 30)
   - Input sanitization
   - Path traversal prevention
   - Secret handling (if needed)
   - Security audit

3. **Comprehensive Testing** (Day 31-32)
   - Unit test coverage >80%
   - Integration tests for all flows
   - E2E tests for complete sync cycle
   - Edge case testing
   - Performance testing

4. **Documentation** (Day 33-34)
   - User guide (how to use the system)
   - Technical specification (this doc)
   - Operational guide (how to maintain)
   - API reference
   - Inline code comments

5. **Examples & Tutorials** (Day 35)
   - Example rules
   - Example workflows
   - Common use cases
   - Troubleshooting guide

**Success Criteria:**
- ✅ Test coverage >80%
- ✅ All edge cases handled
- ✅ Documentation complete and clear
- ✅ No critical security issues
- ✅ System ready for production

---

## 7. Verification Approach

### 7.1 Testing Strategy

#### **Unit Tests**
- **Framework:** Jest
- **Coverage Target:** >80%
- **Scope:** Individual functions and classes
- **Location:** `__tests__/` next to source files

**Key Test Areas:**
- Schema validation (all valid/invalid cases)
- Git operations (mocked Git CLI)
- Rule evaluation logic
- Workflow step execution
- Conflict detection algorithms
- File system operations

#### **Integration Tests**
- **Framework:** Jest
- **Scope:** Component interactions
- **Location:** `.zenflow/tests/integration/`

**Key Test Areas:**
- Rule engine + Workflow engine
- Git client + Sync manager
- CLI + Core engines
- Config loader + Validators

#### **End-to-End Tests**
- **Framework:** Custom Bash scripts + Jest
- **Scope:** Full sync cycle
- **Location:** `.zenflow/tests/e2e/`

**Scenarios:**
1. Successful sync (no conflicts)
2. Sync with conflicts (abort)
3. Sync with validation failure (rollback)
4. Multiple concurrent sync attempts
5. Network failure during push
6. Disk full scenario

#### **Manual Testing Checklist**
- [ ] Install Zenflow from scratch
- [ ] Create test worktree
- [ ] Make changes in worktree
- [ ] Trigger manual sync
- [ ] Verify changes in main
- [ ] Create conflict scenario
- [ ] Verify conflict detection
- [ ] Test rollback
- [ ] Enable daemon mode
- [ ] Verify automatic sync
- [ ] Test all CLI commands
- [ ] Review logs for clarity

### 7.2 Validation Commands

**Before Each Release:**
```bash
# 1. Lint code
npm run lint

# 2. Type check
npm run typecheck

# 3. Run unit tests
npm run test:unit

# 4. Run integration tests
npm run test:integration

# 5. Run E2E tests
npm run test:e2e:zenflow

# 6. Build project
npm run build

# 7. Validate YAML files
zenflow rule validate .zenflow/rules/**/*.yaml
zenflow workflow validate .zenflow/workflows/**/*.yaml

# 8. Dry-run sync
zenflow sync --auto --dry-run
```

### 7.3 Success Criteria

**Must Pass:**
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ All E2E tests passing
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Schema validation for all YAML files
- ✅ Documentation complete
- ✅ Manual testing checklist complete

**Performance Benchmarks:**
- Small sync (< 10 files): < 30 seconds
- Medium sync (10-100 files): < 2 minutes
- Large sync (100+ files): < 10 minutes

**Reliability Metrics:**
- Sync success rate: >95%
- False conflict rate: <5%
- Rollback success rate: 100%

### 7.4 Monitoring & Observability

**Logging:**
- All operations logged to `.zenflow/logs/` and `/var/log/zenflow/`
- Structured JSON format for easy parsing
- Log levels: DEBUG, INFO, WARN, ERROR
- Daily rotation, 30-day retention

**Metrics to Track:**
- Total syncs performed
- Success/failure rates
- Average sync duration
- Conflict frequency
- Rollback frequency
- Queue depth (pending syncs)

**Health Checks:**
- Daemon running: `zenflow status service`
- Recent sync activity: `zenflow sync list --since today`
- Worktree status: `zenflow status worktrees`
- Log for errors: `grep ERROR /var/log/zenflow/sync.log`

---

## 8. Risk Mitigation

### 8.1 Technical Risks

| Risk | Mitigation Strategy |
|------|---------------------|
| **Data Loss** | Atomic operations, backups before every sync, comprehensive tests |
| **Repository Corruption** | Git fsck validation, abort on any Git errors, rollback capability |
| **Conflicts Not Detected** | Multiple detection strategies, conservative conflict rules |
| **Performance Issues** | Async operations, queueing, timeout limits, benchmarking |
| **Service Crashes** | Auto-restart via PM2, graceful shutdown, error recovery |

### 8.2 Operational Risks

| Risk | Mitigation Strategy |
|------|---------------------|
| **Complex Rules** | Schema validation, examples, documentation, testing tools |
| **Log Overflow** | Rotation, retention policies, size limits, compression |
| **Maintenance Burden** | Modular design, clear docs, automated testing, monitoring |
| **False Alarms** | Tunable conflict detection, dry-run mode, logs for debugging |

---

## 9. Security Considerations

### 9.1 Input Validation
- All user inputs validated via Zod schemas
- File paths sanitized to prevent traversal attacks
- Git commands parameterized, never concatenated strings
- YAML files validated before parsing

### 9.2 Access Control
- Service runs with minimal required permissions
- No root access needed
- File permissions checked before operations
- Git credentials managed via SSH keys (existing setup)

### 9.3 Secrets Management
- No secrets stored in Zenflow configuration
- GitHub credentials use existing Git config
- Logs never contain sensitive data
- Environment variables for sensitive config (if needed)

### 9.4 Audit Trail
- All operations logged with timestamp and user
- Sync history persisted with full details
- Logs protected with appropriate permissions
- Log tampering detection (checksums)

---

## 10. Future Enhancements

### Post-MVP Features

**Phase 6: Advanced Features**
- Parallel sync support (multiple worktrees simultaneously)
- Slack/Email notifications
- Web dashboard for status visualization
- Smart conflict resolution suggestions (ML-based)
- Metrics and analytics dashboard
- Custom JavaScript/TypeScript actions in workflows

**Phase 7: Ecosystem Integration**
- GitHub Actions integration
- CI/CD pipeline hooks
- Issue tracker integration (link syncs to issues)
- Code review workflow integration

**Phase 8: Scalability**
- Support for multiple projects
- Shared rule/workflow library
- Cloud-based sync coordination
- Distributed worktree management

---

## 11. Open Questions & Decisions

### 11.1 Resolved Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Auto-push to remote? | Yes, with rate limiting | Full automation, consistency |
| Parallel syncs? | No (Phase 1), Yes (Phase 2+) | Simpler, safer for MVP |
| Custom JS actions? | No (Phase 1), Yes (Phase 6+) | Scope control, security |
| Notification channels? | Console + Log (Phase 1) | Minimal viable, extensible later |
| Service deployment? | Systemd + PM2 (Phase 3) | Standard, reliable, well-supported |

### 11.2 Open Questions for User

1. **Q: Should we support syncing from main back to worktrees (bi-directional)?**
   - Complexity: High
   - Use case: Keep worktrees up-to-date with main
   - Recommendation: Not in MVP, evaluate later

2. **Q: Should we archive stale worktrees automatically?**
   - Criteria: No commits in 30+ days
   - Action: Move to archive directory or delete
   - Recommendation: Log warnings first, manual cleanup for now

3. **Q: Should we integrate with GitHub PRs (auto-create PR on conflict)?**
   - Benefit: Structured conflict resolution
   - Complexity: Medium
   - Recommendation: Phase 7 feature

---

## 12. Dependencies & Prerequisites

### 12.1 New Dependencies (package.json)

```json
{
  "dependencies": {
    "js-yaml": "^4.1.0",
    "zod": "^3.22.0",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1",
    "commander": "^11.1.0",
    "chokidar": "^3.5.3",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/uuid": "^9.0.7"
  }
}
```

### 12.2 System Requirements

- **Node.js:** 20.x (already installed)
- **Git:** 2.25+ (already installed)
- **Bash:** 4.0+ (already available)
- **Disk Space:** 1GB free minimum
- **Permissions:** Read/write access to main directory and worktrees

### 12.3 Configuration Requirements

- `.zenflow/settings.json` updated with sync configuration
- `.zenflowignore` file created
- Git hooks installed in worktrees

---

## 13. Rollout Plan

### 13.1 Rollout Strategy

**Phase 1: Development & Testing (Week 1-5)**
- Implement in current worktree
- Test with synthetic scenarios
- Validate all features

**Phase 2: Alpha Testing (Week 6)**
- Deploy to main directory
- Manual sync only (no automation)
- Test with 2-3 real worktrees
- Monitor logs closely
- Fix critical bugs

**Phase 3: Beta Testing (Week 7)**
- Enable automatic sync for selected worktrees
- Monitor for 1 week
- Gather feedback
- Tune conflict detection

**Phase 4: Production (Week 8)**
- Enable for all worktrees
- Daemon mode active
- Full monitoring
- Ongoing maintenance

### 13.2 Rollback Plan

If critical issues occur:
1. **Immediate:** `zenflow rule disable worktree-to-main-sync`
2. **Stop daemon:** `zenflow daemon stop`
3. **Revert changes:** Use Git to revert sync commits
4. **Fix issues:** Debug using logs
5. **Re-enable:** After validation

---

## 14. Appendix

### 14.1 File Templates

#### **.zenflowignore**
```gitignore
# Build outputs
node_modules/
.next/
dist/
build/
out/

# Logs
*.log
logs/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/
.nyc_output/

# Temporary
*.tmp
*.temp
.cache/

# Zenflow state (transient)
.zenflow/state/
```

#### **Example Rule: worktree-to-main-sync.yaml**
```yaml
name: worktree-to-main-sync
version: 1.0.0
description: Automatically sync worktree changes to main directory on commit
author: zenflow-system
enabled: true

triggers:
  - type: commit
    branches:
      pattern: "*-[a-f0-9]{4}"  # Worktree branch pattern
    events:
      - post-commit

conditions:
  - type: branch_check
    not_branch: main
  
  - type: worktree_active
  
  - type: no_conflicts
    with_branch: main
  
  - type: disk_space
    min_gb: 1

actions:
  - type: log
    level: info
    message: "Triggering sync for ${trigger.branch}"
  
  - type: run_workflow
    workflow: sync-worktree-to-main
    inputs:
      worktree_branch: "${trigger.branch}"
      commit_hash: "${trigger.commit}"
      dry_run: false
  
  - type: notify
    on_success: true
    on_failure: true
    channels:
      - console
      - log

guards:
  max_retries: 3
  timeout: 600  # 10 minutes
  on_error: rollback
```

#### **Example Workflow: sync-worktree-to-main.yaml**
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
    description: "success, conflict, or failure"
  
  - name: files_changed
    type: number
    description: Number of files modified
  
  - name: commit_id
    type: string
    description: Commit hash of sync in main

steps:
  - id: validate-worktree
    name: Validate Worktree Exists
    type: shell
    command: |
      git worktree list | grep -q "${inputs.worktree_branch}" || exit 1
    on_failure: abort
  
  - id: check-conflicts
    name: Check for Merge Conflicts
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      git merge-tree $(git merge-base main ${inputs.worktree_branch}) main ${inputs.worktree_branch} | grep -q "<<<<<" && exit 1 || exit 0
    on_failure: skip_to_step:report-conflicts
  
  - id: analyze-diff
    name: Analyze Differences
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      git diff --stat main...${inputs.worktree_branch} > /tmp/zenflow-diff-stats.txt
      git diff --name-status main...${inputs.worktree_branch} > /tmp/zenflow-diff-files.txt
      echo "Files changed: $(wc -l < /tmp/zenflow-diff-files.txt)"
    outputs:
      files_changed: /tmp/zenflow-diff-files.txt
  
  - id: backup-main
    name: Create Backup
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      timestamp=$(date +%Y%m%d-%H%M%S)
      git stash push --include-untracked -m "zenflow-backup-${timestamp}-${inputs.worktree_branch}"
      echo "Backup created: zenflow-backup-${timestamp}-${inputs.worktree_branch}"
    unless: ${inputs.dry_run}
  
  - id: merge-changes
    name: Merge Worktree to Main
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      git merge --no-ff ${inputs.worktree_branch} -m "chore: merge ${inputs.worktree_branch} - Auto-sync from Zenflow

      Triggered by commit: ${inputs.commit_hash}
      Workflow: sync-worktree-to-main
      Timestamp: $(date -Iseconds)"
    unless: ${inputs.dry_run}
    timeout: 300
    on_failure: rollback_to_step:backup-main
  
  - id: run-lint
    name: Run Linting
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      npm run lint
    timeout: 120
    continue_on_error: true
    unless: ${inputs.dry_run}
  
  - id: run-typecheck
    name: Run Type Checking
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      npm run typecheck
    timeout: 180
    on_failure: rollback_to_step:backup-main
    unless: ${inputs.dry_run}
  
  - id: push-to-remote
    name: Push to GitHub
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      git push origin main
    timeout: 60
    on_failure: continue
    unless: ${inputs.dry_run}
  
  - id: cleanup-backup
    name: Remove Backup
    type: shell
    command: |
      cd /home/alaeddine/Bureau/nexus-project_v0
      git stash drop
    continue_on_error: true
    unless: ${inputs.dry_run}
  
  - id: log-success
    name: Log Successful Sync
    type: shell
    command: |
      echo "Sync completed successfully"
      echo "Worktree: ${inputs.worktree_branch}"
      echo "Commit: ${inputs.commit_hash}"
      echo "Files changed: $(wc -l < /tmp/zenflow-diff-files.txt)"
  
  - id: report-conflicts
    name: Report Merge Conflicts
    type: shell
    when: step:check-conflicts == failure
    command: |
      echo "ERROR: Merge conflicts detected between main and ${inputs.worktree_branch}"
      echo "Conflicted files:"
      cd /home/alaeddine/Bureau/nexus-project_v0
      git diff --name-only --diff-filter=U main...${inputs.worktree_branch}
      exit 1

error_handling:
  strategy: rollback
  cleanup_steps:
    - name: Restore from Backup
      type: shell
      when: step:backup-main == success
      command: |
        cd /home/alaeddine/Bureau/nexus-project_v0
        git reset --hard HEAD~1
        git stash pop
    
    - name: Log Failure
      type: shell
      command: |
        echo "Sync failed for ${inputs.worktree_branch}" >> /var/log/zenflow/failures.log
        echo "Error: ${error.message}" >> /var/log/zenflow/failures.log

notifications:
  on_success:
    - type: log
      level: info
      message: "Successfully synced ${inputs.worktree_branch} to main (${outputs.files_changed} files)"
  
  on_failure:
    - type: log
      level: error
      message: "Failed to sync ${inputs.worktree_branch}: ${error.message}"
```

### 14.2 Git Hook Template

#### **post-commit hook** (install in each worktree)
```bash
#!/bin/bash
# Zenflow post-commit hook
# Triggers automatic sync after commit in worktree

ZENFLOW_CLI="/home/alaeddine/Bureau/nexus-project_v0/node_modules/.bin/zenflow"
CURRENT_BRANCH=$(git branch --show-current)
COMMIT_HASH=$(git rev-parse HEAD)

# Only trigger for worktree branches (pattern: *-[hash])
if [[ $CURRENT_BRANCH =~ -[a-f0-9]{4}$ ]]; then
  echo "Zenflow: Detected commit in worktree branch: $CURRENT_BRANCH"
  
  # Trigger sync (runs in background, doesn't block commit)
  nohup $ZENFLOW_CLI sync --worktree "$CURRENT_BRANCH" --commit "$COMMIT_HASH" > /dev/null 2>&1 &
  
  echo "Zenflow: Sync triggered in background"
fi
```

---

## 15. Conclusion

This technical specification defines a comprehensive, production-ready system for automatic worktree synchronization. The implementation follows industry best practices:

- **Type Safety:** TypeScript with strict mode and Zod validation
- **Modularity:** Clear separation of concerns, testable components
- **Safety:** Atomic operations, backups, rollback capability
- **Observability:** Comprehensive logging, state tracking
- **Extensibility:** Plugin architecture, configuration-driven behavior
- **Reliability:** Error handling, retries, health checks

The phased delivery approach ensures incremental value delivery with continuous validation. Each phase builds on the previous one, reducing risk and enabling early feedback.

Upon completion, the system will eliminate manual synchronization, reduce errors, and provide a robust foundation for future automation needs in the Nexus Reussite project.

---

**Next Steps:**
1. Review this specification with stakeholders
2. Obtain approvals and resolve open questions
3. Create detailed implementation plan (plan.md)
4. Begin Phase 1 implementation
