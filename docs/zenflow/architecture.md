# Zenflow Architecture Documentation

**Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** Production

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Module Dependencies](#module-dependencies)
6. [Design Principles](#design-principles)
7. [Technology Stack](#technology-stack)

---

## 1. System Overview

Zenflow is an event-driven automation system designed to synchronize Git worktrees with the main working directory. The system monitors worktrees for changes, evaluates rules against detected events, and executes workflows to perform synchronization operations safely and automatically.

### Core Capabilities

- **Automatic Worktree Synchronization**: Detects changes in worktrees and merges them into the main branch
- **Rule-Based Event Processing**: Evaluates YAML-defined rules to determine when actions should trigger
- **Workflow Orchestration**: Executes multi-step workflows with error handling and rollback capability
- **Conflict Detection**: Identifies merge conflicts before attempting synchronization
- **State Management**: Persists execution state for resumability and audit trails

### Deployment Phases

**Phase 1 (MVP):** Manual CLI execution
- Users run commands manually: `zenflow sync auto`
- Suitable for testing and initial validation

**Phase 2 (Semi-Automated):** Cron-based execution
- Schedule via crontab: `*/5 * * * * zenflow sync auto`
- Lightweight, no daemon required

**Phase 3 (Fully Automated):** Daemon service
- Background daemon monitoring events via Git hooks
- Auto-start on system boot
- Graceful shutdown handling

---

## 2. Architecture Patterns

### 2.1 Event-Driven Architecture

Zenflow uses an event-driven architecture for loose coupling and extensibility:

```
Event Sources → Event Detector → Event Queue → Rule Engine → Workflow Engine → Actions
```

**Benefits:**
- **Loose Coupling**: Components interact via events, not direct calls
- **Extensibility**: Easy to add new event sources without modifying core logic
- **Scalability**: Events can be queued and processed asynchronously

### 2.2 Configuration-Driven Behavior

Rules and workflows are defined in YAML configuration files, not code:

```yaml
# .zenflow/rules/sync/worktree-to-main.yaml
name: worktree-to-main-sync
description: Automatically sync worktrees to main
triggers:
  - type: worktree_commit
    branch_pattern: ".*"
conditions:
  - type: no_conflicts
  - type: worktree_active
actions:
  - type: run_workflow
    workflow: sync-worktree-to-main
```

**Benefits:**
- **No Code Changes**: Add/modify rules without touching codebase
- **Schema Validation**: Runtime validation ensures correctness
- **User-Friendly**: Non-developers can create rules

### 2.3 Modular Design

Each component has a single responsibility and clear interfaces:

- **Git Layer**: All Git operations isolated in one module
- **Rule Engine**: Rule loading and evaluation
- **Workflow Engine**: Workflow execution and orchestration
- **Sync Logic**: Synchronization operations
- **State Manager**: Execution state persistence

**Benefits:**
- **Testability**: Each module can be tested independently
- **Maintainability**: Changes are localized to specific modules
- **Reusability**: Components can be used in different contexts

---

## 3. Component Architecture

### 3.1 High-Level Architecture

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

### 3.2 Component Responsibilities

#### Event Detector
**Purpose**: Detect changes in worktrees and emit events

**Responsibilities:**
- Monitor file system changes via Chokidar
- Parse Git hook callbacks (post-commit, pre-push)
- Emit typed events to the event queue
- Debounce rapid changes to prevent duplicate events

**Key Classes:**
- `EventDetector`: File system watcher
- `EventEmitter`: Event publishing system

#### Rule Engine
**Purpose**: Evaluate rules against events to determine if actions should execute

**Responsibilities:**
- Load rules from YAML files
- Validate rules against schemas
- Evaluate trigger conditions (branch patterns, event types)
- Evaluate guard conditions (conflicts, disk space, etc.)
- Enable/disable rules at runtime

**Key Classes:**
- `RuleEngine`: Rule orchestration
- `RuleLoader`: Load and parse YAML rules
- `RuleEvaluator`: Evaluate conditions and triggers

#### Workflow Engine
**Purpose**: Execute multi-step workflows with error handling

**Responsibilities:**
- Load workflows from YAML files
- Validate workflows against schemas
- Execute steps sequentially
- Handle conditional execution (when/unless)
- Manage error strategies (abort, rollback, continue)
- Persist execution state for resumability
- Send notifications on success/failure

**Key Classes:**
- `WorkflowEngine`: Workflow orchestration
- `WorkflowLoader`: Load and parse YAML workflows
- `StepOrchestrator`: Execute individual steps
- `WorkflowStateManager`: Persist execution state

#### Sync Manager
**Purpose**: Coordinate all synchronization operations

**Responsibilities:**
- Orchestrate sync flow (validate → analyze → check conflicts → merge)
- Track sync operations in state files
- Handle rollback on failure
- Execute verification commands
- Push changes to remote (optional)

**Key Classes:**
- `SyncManager`: High-level sync orchestration
- `SyncAnalyzer`: Analyze diffs between branches
- `ConflictDetector`: Detect merge conflicts
- `SafeMerger`: Perform safe merges with backup
- `SyncValidator`: Pre-sync validation
- `RollbackManager`: Rollback failed syncs

#### Git Layer
**Purpose**: Abstract all Git operations

**Responsibilities:**
- Execute Git commands via Node.js child_process
- Parse Git output into TypeScript types
- Handle Git errors gracefully
- Provide high-level operations (diff, merge, commit, push, stash)

**Key Classes:**
- `GitClient`: Main Git client interface
- `DiffAnalyzer`: Parse diff output
- `MergeHandler`: Perform merge operations

#### State Manager
**Purpose**: Persist execution state for resumability and audit

**Responsibilities:**
- Save workflow executions to JSON files
- Save sync operations to JSON files
- Query execution history with filters
- Enable workflow resume after failure

**Key Classes:**
- `WorkflowStateManager`: Workflow execution state
- Sync state is managed directly by `SyncManager`

---

## 4. Data Flow

### 4.1 Synchronization Flow

```
1. Event Detection
   ├─ Git hook triggers (post-commit)
   ├─ File system change detected
   └─ Manual CLI command
          ↓
2. Rule Evaluation
   ├─ Load enabled rules
   ├─ Match event against triggers
   ├─ Evaluate guard conditions
   └─ Select actions to execute
          ↓
3. Workflow Execution
   ├─ Load workflow definition
   ├─ Validate inputs
   ├─ Create execution state
   └─ Execute steps sequentially
          ↓
4. Sync Operation
   ├─ Validate preconditions
   ├─ Analyze diff
   ├─ Check for conflicts
   ├─ Create backup (stash)
   ├─ Perform merge
   ├─ Run verification commands
   ├─ Push to remote (optional)
   └─ Save sync operation state
```

### 4.2 Conflict Detection Flow

```
1. Get worktree branch and main branch refs
          ↓
2. Run git merge-tree --write-tree base target
          ↓
3. Parse merge-tree output
   ├─ Success: No conflicts
   └─ Failure: Conflicts detected
          ↓
4. Get detailed diff stats
          ↓
5. Categorize conflicts
   ├─ Content conflicts (same file modified)
   ├─ Delete/modify conflicts
   ├─ Rename conflicts
   └─ Mode/permission conflicts
          ↓
6. Calculate risk level (low/medium/high)
          ↓
7. Return ConflictInfo with details
```

### 4.3 Workflow Error Handling Flow

```
Step Execution
   ├─ Success → Continue to next step
   └─ Failure
       ├─ Strategy: abort
       │   ├─ Mark execution as failed
       │   ├─ Send failure notifications
       │   └─ Throw error
       │
       ├─ Strategy: rollback
       │   ├─ Execute cleanup steps in reverse
       │   ├─ Mark execution as rolled_back
       │   ├─ Send failure notifications
       │   └─ Throw error
       │
       ├─ Strategy: continue
       │   ├─ Log warning
       │   └─ Continue to next step
       │
       └─ Strategy: skip_to_step
           ├─ Log skip reason
           └─ Jump to specified step
```

---

## 5. Module Dependencies

### 5.1 Core Modules

```
.zenflow/
├── cli/                    [Depends on: core/*]
│   ├── commands/
│   │   ├── sync.ts         → Uses SyncManager, Output
│   │   ├── rule.ts         → Uses RuleEngine, Output
│   │   ├── workflow.ts     → Uses WorkflowEngine, Output
│   │   ├── status.ts       → Uses GitClient, SyncManager
│   │   └── daemon.ts       → Uses DaemonManager
│   └── utils/
│       ├── output.ts       → No dependencies (pure utility)
│       └── validation.ts   → No dependencies (pure utility)
│
├── core/
│   ├── config/             [Depends on: utils/logger, utils/errors]
│   │   ├── loader.ts       → Uses logger
│   │   ├── schema.ts       → Uses zod
│   │   └── validator.ts    → Uses schema, logger
│   │
│   ├── events/             [Depends on: utils/logger]
│   │   ├── detector.ts     → Uses chokidar, logger
│   │   ├── emitter.ts      → Uses events (Node.js)
│   │   └── types.ts        → No dependencies
│   │
│   ├── git/                [Depends on: utils/logger, utils/errors]
│   │   ├── client.ts       → Uses child_process, logger
│   │   ├── diff.ts         → Uses client, logger
│   │   ├── merge.ts        → Uses client, logger
│   │   └── types.ts        → No dependencies
│   │
│   ├── rules/              [Depends on: git, events, utils]
│   │   ├── engine.ts       → Uses loader, evaluator, logger
│   │   ├── loader.ts       → Uses js-yaml, schema, logger
│   │   ├── evaluator.ts    → Uses GitClient, logger
│   │   ├── schema.ts       → Uses zod
│   │   └── types.ts        → No dependencies
│   │
│   ├── workflows/          [Depends on: utils]
│   │   ├── engine.ts       → Uses loader, state, orchestrator
│   │   ├── loader.ts       → Uses js-yaml, schema, logger
│   │   ├── orchestrator.ts → Uses child_process, state, logger
│   │   ├── state.ts        → Uses fs, logger
│   │   ├── schema.ts       → Uses zod
│   │   └── types.ts        → No dependencies
│   │
│   ├── sync/               [Depends on: git, utils]
│   │   ├── manager.ts      → Uses analyzer, conflicts, merger, validator
│   │   ├── analyzer.ts     → Uses GitClient, logger
│   │   ├── conflicts.ts    → Uses GitClient, logger
│   │   ├── merger.ts       → Uses GitClient, logger
│   │   ├── validator.ts    → Uses GitClient, logger
│   │   ├── rollback.ts     → Uses GitClient, logger
│   │   └── types.ts        → No dependencies
│   │
│   └── utils/              [No core dependencies]
│       ├── logger.ts       → Uses winston
│       ├── errors.ts       → No dependencies
│       └── locks.ts        → Uses fs
│
└── daemon/                 [Depends on: core/*]
    ├── server.ts           → Uses manager
    ├── manager.ts          → Uses EventDetector, RuleEngine, WorkflowEngine
    └── types.ts            → No dependencies
```

### 5.2 External Dependencies

| Package | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `js-yaml` | ^4.1.0 | Parse YAML configuration files | RuleLoader, WorkflowLoader, ConfigLoader |
| `zod` | ^3.22.0 | Runtime schema validation | Rule/Workflow/Config schemas |
| `winston` | ^3.11.0 | Structured logging | Logger utility (used everywhere) |
| `winston-daily-rotate-file` | ^4.7.1 | Log file rotation | Logger configuration |
| `commander` | ^11.1.0 | CLI framework | CLI entry point |
| `chokidar` | ^3.5.3 | File system watching | EventDetector |
| `uuid` | ^9.0.1 | Generate unique IDs | SyncManager, WorkflowStateManager |

---

## 6. Design Principles

### 6.1 Safety First
**Never lose data, never corrupt repository**

- **Atomic Operations**: All Git operations are atomic (succeed completely or fail completely)
- **Backup Before Merge**: Create Git stash before every merge
- **Rollback Capability**: Every sync operation can be rolled back
- **Validation First**: Validate preconditions before executing operations
- **Conflict Detection**: Detect conflicts before attempting merge

### 6.2 Transparency
**Log everything, make state observable**

- **Structured Logging**: All operations logged with context (branch, syncId, step)
- **State Persistence**: Execution state saved to JSON files
- **Audit Trail**: Complete history of all sync operations
- **Clear Error Messages**: Errors include context and actionable information

### 6.3 Resilience
**Recover from failures, retry transient errors**

- **Error Handling**: Three strategies: abort, rollback, continue
- **Graceful Degradation**: Push failure doesn't fail entire sync
- **State Recovery**: Workflows can be resumed after failure
- **Validation Guards**: Multiple validation layers prevent bad operations

### 6.4 Performance
**Async operations, efficient Git usage**

- **Async/Await**: All I/O operations are asynchronous
- **Efficient Git Commands**: Use porcelain commands optimized for scripts
- **Minimal Git Operations**: Analyze diff once, reuse results
- **Debouncing**: Wait 5 seconds after last change before processing

### 6.5 Maintainability
**Clear code, good documentation, comprehensive tests**

- **TypeScript Strict Mode**: Full type safety
- **Single Responsibility**: Each class has one clear purpose
- **Comprehensive Tests**: >80% code coverage target
- **Documentation**: Inline comments for complex logic

### 6.6 Extensibility
**Easy to add new rules, workflows, actions**

- **Plugin Architecture**: New rule conditions/actions can be added
- **Configuration-Driven**: Add behavior without code changes
- **Clear Interfaces**: Well-defined contracts between components
- **Hook Points**: Event system allows new event sources

---

## 7. Technology Stack

### 7.1 Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **TypeScript** | 5.x | Type-safe application code |
| **Node.js** | 20.x | Runtime environment |
| **Bash** | 4.0+ | Git hooks and utility scripts |
| **Git** | 2.25+ | Version control operations |

### 7.2 Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code quality and consistency |
| **Prettier** | Code formatting |
| **Jest** | Unit and integration testing |
| **TypeScript Compiler** | Type checking and compilation |

### 7.3 Process Management

| Tool | Purpose | Phase |
|------|---------|-------|
| **Cron** | Scheduled execution | Phase 2 |
| **PM2** | Process management & daemon | Phase 3 |
| **Systemd** | System service (optional) | Phase 3 |

---

## 8. Directory Structure

```
.zenflow/
├── cli/                    # Command-line interface
│   ├── commands/          # Command implementations
│   │   ├── sync.ts        # Sync commands
│   │   ├── rule.ts        # Rule management
│   │   ├── workflow.ts    # Workflow management
│   │   ├── status.ts      # Status commands
│   │   └── daemon.ts      # Daemon control
│   ├── utils/             # CLI utilities
│   │   ├── output.ts      # Formatted output
│   │   └── validation.ts  # Input validation
│   └── index.ts           # CLI entry point
│
├── core/                   # Core engine
│   ├── config/            # Configuration management
│   ├── events/            # Event system
│   ├── git/               # Git operations
│   ├── rules/             # Rule engine
│   ├── workflows/         # Workflow engine
│   ├── sync/              # Sync logic
│   └── utils/             # Core utilities
│
├── daemon/                 # Background service
│   ├── server.ts          # Daemon entry point
│   ├── manager.ts         # Event processing
│   └── types.ts           # Daemon types
│
├── rules/                  # Rule definitions (YAML)
│   └── sync/
│       └── worktree-to-main.yaml
│
├── workflows/              # Workflow definitions (YAML)
│   ├── sync-worktree-to-main.yaml
│   ├── rollback-sync.yaml
│   └── validate-worktree.yaml
│
├── state/                  # Execution state (JSON)
│   ├── executions/        # Workflow executions
│   └── sync/              # Sync operations
│
├── logs/                   # Application logs
│
└── settings.json           # Zenflow configuration
```

---

## 9. Security Considerations

### 9.1 Input Validation
- All user inputs validated before use
- Path traversal prevention (no `../` in paths)
- Branch names sanitized before Git commands

### 9.2 Command Injection Prevention
- All Git commands use parameterized execution
- No string concatenation for shell commands
- Arguments properly escaped

### 9.3 Secrets Management
- No secrets in logs or error messages
- No secrets in state files
- Environment variables for sensitive data

### 9.4 File System Security
- Operations restricted to repository directory
- File permissions checked before operations
- `.zenflowignore` prevents sensitive file access

---

## 10. Scalability Considerations

### 10.1 Current Limitations (Phase 1)

- **Sequential Execution**: One sync operation at a time
- **In-Process Queue**: Events queued in memory (lost on restart)
- **Local State**: State stored in local JSON files

### 10.2 Future Enhancements (Phase 3+)

- **Concurrent Execution**: Multiple syncs in parallel (with proper locking)
- **Persistent Queue**: Redis or database-backed event queue
- **Distributed State**: Shared state storage for multi-instance deployment
- **Rate Limiting**: Prevent excessive remote pushes

---

## Related Documentation

- [API Reference](./api-reference.md) - Detailed API documentation
- [Operations Guide](./operations.md) - Deployment and monitoring
- [Contributing Guide](./contributing.md) - How to extend Zenflow
