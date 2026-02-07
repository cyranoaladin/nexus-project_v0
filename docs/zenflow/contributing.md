# Zenflow Contributing Guide

**Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** Production

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Adding New Rules](#adding-new-rules)
4. [Adding New Workflows](#adding-new-workflows)
5. [Adding New Workflow Actions](#adding-new-workflow-actions)
6. [Adding New Rule Conditions](#adding-new-rule-conditions)
7. [Testing Requirements](#testing-requirements)
8. [Code Style Guidelines](#code-style-guidelines)
9. [Pull Request Process](#pull-request-process)
10. [Common Patterns](#common-patterns)

---

## 1. Getting Started

### Prerequisites

- **Node.js**: 20.x or higher
- **TypeScript**: 5.x
- **Git**: 2.25 or higher
- **Code Editor**: VS Code recommended

### Understanding the Codebase

Zenflow is organized into modules:

```
.zenflow/
├── cli/           # Command-line interface
├── core/          # Core engine logic
│   ├── config/    # Configuration management
│   ├── events/    # Event system
│   ├── git/       # Git operations
│   ├── rules/     # Rule engine
│   ├── workflows/ # Workflow engine
│   ├── sync/      # Sync logic
│   └── utils/     # Utilities
├── daemon/        # Background service
├── rules/         # Rule definitions (YAML)
├── workflows/     # Workflow definitions (YAML)
└── state/         # Execution state (JSON)
```

### Key Concepts

- **Rules**: Define when and how to respond to events
- **Workflows**: Multi-step procedures to execute
- **Events**: Triggers from Git hooks or file system
- **Sync Operations**: Merge worktrees into main branch

---

## 2. Development Setup

### Clone and Install

```bash
# Navigate to repository
cd /path/to/repo

# Install dependencies
cd .zenflow
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### Watch Mode for Development

```bash
# Watch TypeScript files and rebuild on change
cd .zenflow
npm run build -- --watch
```

---

## 3. Adding New Rules

Rules are defined in YAML files in `.zenflow/rules/`.

### Rule Structure

```yaml
name: my-custom-rule
description: Description of what this rule does
enabled: true
priority: 50  # 1-100, higher = more important

triggers:
  - type: worktree_commit
    branch_pattern: "feature/.*"  # Regex pattern

conditions:
  - type: no_conflicts
  - type: branch_check
    params:
      allowed_branches: ["feature/*", "bugfix/*"]

actions:
  - type: run_workflow
    workflow: my-workflow
  - type: log
    message: "Rule executed for branch {branch}"

guards:
  max_file_changes: 100
  require_tests_pass: false
  on_error: abort  # abort | continue | notify

metadata:
  created_at: "2026-02-04"
  author: "Your Name"
  tags: ["sync", "automation"]
```

### Step-by-Step: Create a New Rule

**Example**: Create a rule that syncs only TypeScript files

1. **Create YAML file**:

```bash
touch .zenflow/rules/sync/typescript-only-sync.yaml
```

2. **Define rule**:

```yaml
name: typescript-only-sync
description: Sync worktrees that only modify TypeScript files
enabled: true
priority: 60

triggers:
  - type: worktree_commit
    branch_pattern: ".*"

conditions:
  - type: no_conflicts
  - type: file_pattern_check
    params:
      allowed_patterns: ["*.ts", "*.tsx"]
      disallowed_patterns: ["*.js", "*.jsx"]

actions:
  - type: run_workflow
    workflow: sync-worktree-to-main
    inputs:
      branch_name: "{event.data.branch}"
      dry_run: false

guards:
  max_file_changes: 50
  on_error: abort
```

3. **Validate rule**:

```bash
zenflow rule validate .zenflow/rules/sync/typescript-only-sync.yaml
```

4. **Test rule**:

```bash
# Create test event
cat > test-event.json << 'EOF'
{
  "id": "test-001",
  "type": "worktree_commit",
  "timestamp": "2026-02-04T12:00:00Z",
  "source": "test",
  "data": {
    "branch": "feature/test",
    "commit": "abc123"
  }
}
EOF

# Test rule against event
zenflow rule test typescript-only-sync --event test-event.json
```

5. **Enable rule**:

```bash
zenflow rule enable typescript-only-sync
```

### Supported Trigger Types

| Type | Description | Parameters |
|------|-------------|------------|
| `worktree_commit` | Commit in worktree | `branch_pattern` (regex) |
| `worktree_push` | Push to worktree remote | `branch_pattern` (regex) |
| `manual` | Manual CLI trigger | None |
| `schedule` | Cron schedule | `cron` (cron expression) |

### Supported Condition Types

| Type | Description | Parameters |
|------|-------------|------------|
| `no_conflicts` | No merge conflicts exist | None |
| `worktree_active` | Worktree is active | None |
| `branch_check` | Branch matches patterns | `allowed_branches`, `disallowed_branches` |
| `disk_space` | Sufficient disk space | `min_space_gb` (default: 1) |
| `file_count` | File count in range | `min`, `max` |

### Supported Action Types

| Type | Description | Parameters |
|------|-------------|------------|
| `run_workflow` | Execute workflow | `workflow` (name), `inputs` (object) |
| `log` | Log message | `message` (string with variables) |
| `shell` | Run shell command | `command` (string) |
| `notify` | Send notification | `message`, `channels` |

---

## 4. Adding New Workflows

Workflows are defined in YAML files in `.zenflow/workflows/`.

### Workflow Structure

```yaml
name: my-workflow
description: Description of workflow
version: "1.0.0"

inputs:
  - name: branch_name
    type: string
    description: Branch to process
    required: true
  - name: dry_run
    type: boolean
    description: Preview changes without applying
    required: false
    default: false

outputs:
  - sync_id
  - files_changed

steps:
  - id: validate
    name: Validate preconditions
    type: shell
    command: |
      echo "Validating branch: $branch_name"
      zenflow sync validate "$branch_name"
    timeout: 60000  # 1 minute
    
  - id: analyze
    name: Analyze changes
    type: shell
    command: |
      zenflow sync analyze "$branch_name" --json
    outputs:
      files_changed: "$.diff_summary.files_changed"
    
  - id: sync
    name: Perform sync
    type: shell
    command: |
      if [ "$dry_run" = "true" ]; then
        zenflow sync worktree "$branch_name" --dry-run
      else
        zenflow sync worktree "$branch_name"
      fi
    retry: 2
    when: "outputs.files_changed > 0"
    on_failure:
      action: rollback_to_step
      target_step: validate

error_handling:
  strategy: rollback  # abort | rollback | continue
  cleanup_steps:
    - id: rollback
      name: Rollback changes
      type: shell
      command: |
        zenflow sync rollback "$sync_id"

notifications:
  on_success:
    - type: log
      level: info
      message: "Workflow completed successfully"
  on_failure:
    - type: log
      level: error
      message: "Workflow failed: {error.message}"

metadata:
  created_at: "2026-02-04"
  author: "Your Name"
  tags: ["sync", "automation"]
```

### Step-by-Step: Create a New Workflow

**Example**: Create a workflow that validates code before sync

1. **Create YAML file**:

```bash
touch .zenflow/workflows/validate-and-sync.yaml
```

2. **Define workflow**:

```yaml
name: validate-and-sync
description: Validate code quality before syncing worktree
version: "1.0.0"

inputs:
  - name: branch_name
    type: string
    required: true
  - name: skip_tests
    type: boolean
    default: false

steps:
  - id: lint
    name: Run linter
    type: shell
    command: npm run lint
    timeout: 120000  # 2 minutes
    
  - id: typecheck
    name: Run type checker
    type: shell
    command: npm run typecheck
    timeout: 120000
    
  - id: test
    name: Run tests
    type: shell
    command: npm test
    timeout: 300000  # 5 minutes
    unless: "inputs.skip_tests === true"
    
  - id: sync
    name: Sync worktree
    type: shell
    command: |
      zenflow sync worktree "$branch_name" --auto-push
    retry: 2

error_handling:
  strategy: abort
```

3. **Validate workflow**:

```bash
zenflow workflow validate .zenflow/workflows/validate-and-sync.yaml
```

4. **Test workflow**:

```bash
# Run workflow with test branch
zenflow workflow run validate-and-sync \
  --input branch_name=feature/test \
  --input skip_tests=true
```

5. **View execution**:

```bash
# Get execution ID from previous command output
zenflow workflow status <execution-id>
zenflow workflow logs <execution-id>
```

### Step Types

#### Shell Command

```yaml
- id: step-name
  name: Step Name
  type: shell
  command: |
    echo "Multi-line"
    echo "shell command"
  timeout: 60000
```

#### JavaScript Script

```yaml
- id: step-name
  name: Step Name
  type: script
  script: |
    const result = inputs.value * 2;
    return { doubled: result };
  timeout: 5000
```

### Conditional Execution

```yaml
# Execute only if condition is true
when: "inputs.dry_run === false"

# Skip if condition is true
unless: "inputs.skip_tests === true"

# Complex conditions
when: "outputs.files_changed > 10 && inputs.force === true"
```

### Error Handling Strategies

| Strategy | Behavior |
|----------|----------|
| `abort` | Stop workflow immediately on error |
| `rollback` | Execute cleanup steps and rollback |
| `continue` | Log error and continue to next step |

### Step-Level Error Handling

```yaml
- id: risky-step
  name: Risky Operation
  type: shell
  command: some-command
  on_failure:
    action: skip_to_step
    target_step: cleanup
```

Actions: `abort`, `continue`, `skip_to_step`, `rollback_to_step`

---

## 5. Adding New Workflow Actions

To add a new workflow action type, modify the StepOrchestrator.

### Example: Add HTTP Request Action

1. **Define action schema** in `.zenflow/core/workflows/schema.ts`:

```typescript
const HttpActionSchema = z.object({
  type: z.literal('http'),
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
});
```

2. **Implement action handler** in `.zenflow/core/workflows/orchestrator.ts`:

```typescript
private async executeHttpAction(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { url, method, headers, body } = step;
  
  this.logger.info('Executing HTTP request', { url, method });
  
  const response = await fetch(url, {
    method,
    headers: headers || {},
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const data = await response.json();
  
  return {
    status: response.status,
    data,
  };
}
```

3. **Add to step executor** in `.zenflow/core/workflows/orchestrator.ts`:

```typescript
async executeStep(
  execution: WorkflowExecution,
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // ... existing code ...
  
  if (step.type === 'http') {
    return await this.executeHttpAction(step, context);
  }
  
  // ... existing code ...
}
```

4. **Write tests** in `.zenflow/core/workflows/orchestrator.test.ts`:

```typescript
describe('HTTP Action', () => {
  it('should execute HTTP GET request', async () => {
    const step: WorkflowStep = {
      id: 'http-step',
      name: 'Fetch data',
      type: 'http',
      url: 'https://api.example.com/data',
      method: 'GET',
    };
    
    const result = await orchestrator.executeStep(execution, step, {});
    
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  });
});
```

5. **Update documentation**:

Add to workflow documentation:

```yaml
steps:
  - id: fetch-data
    name: Fetch external data
    type: http
    url: https://api.example.com/data
    method: GET
    headers:
      Authorization: "Bearer {env.API_TOKEN}"
    outputs:
      data: "$.data"
```

---

## 6. Adding New Rule Conditions

To add a new rule condition, modify the RuleEvaluator.

### Example: Add File Pattern Check Condition

1. **Define condition schema** in `.zenflow/core/rules/schema.ts`:

```typescript
const FilePatternConditionSchema = z.object({
  type: z.literal('file_pattern_check'),
  params: z.object({
    allowed_patterns: z.array(z.string()).optional(),
    disallowed_patterns: z.array(z.string()).optional(),
  }),
});
```

2. **Implement condition evaluator** in `.zenflow/core/rules/evaluator.ts`:

```typescript
private async evaluateFilePatternCondition(
  condition: Condition,
  event: Event
): Promise<boolean> {
  const { allowed_patterns, disallowed_patterns } = condition.params || {};
  const branch = event.data?.branch;
  
  if (!branch) return false;
  
  // Get changed files from diff
  const diff = await this.gitClient.diff('main', branch);
  const changedFiles = diff.files.map(f => f.path);
  
  // Check allowed patterns
  if (allowed_patterns) {
    const matchesAllowed = changedFiles.every(file =>
      allowed_patterns.some(pattern => minimatch(file, pattern))
    );
    if (!matchesAllowed) return false;
  }
  
  // Check disallowed patterns
  if (disallowed_patterns) {
    const matchesDisallowed = changedFiles.some(file =>
      disallowed_patterns.some(pattern => minimatch(file, pattern))
    );
    if (matchesDisallowed) return false;
  }
  
  return true;
}
```

3. **Add to condition evaluator** in `.zenflow/core/rules/evaluator.ts`:

```typescript
async evaluateCondition(
  condition: Condition,
  event: Event
): Promise<boolean> {
  switch (condition.type) {
    // ... existing cases ...
    
    case 'file_pattern_check':
      return await this.evaluateFilePatternCondition(condition, event);
    
    // ... existing cases ...
  }
}
```

4. **Write tests** in `.zenflow/core/rules/evaluator.test.ts`:

```typescript
describe('File Pattern Condition', () => {
  it('should pass when all files match allowed patterns', async () => {
    const condition: Condition = {
      type: 'file_pattern_check',
      params: {
        allowed_patterns: ['*.ts', '*.tsx'],
      },
    };
    
    const event: Event = {
      id: 'evt-1',
      type: 'worktree_commit',
      timestamp: new Date(),
      source: 'test',
      data: { branch: 'feature/test' },
    };
    
    const result = await evaluator.evaluateCondition(condition, event);
    expect(result).toBe(true);
  });
});
```

---

## 7. Testing Requirements

### Test Coverage Requirements

- **Unit Tests**: >80% coverage for all modules
- **Integration Tests**: All component interactions tested
- **End-to-End Tests**: Critical workflows tested

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Writing Unit Tests

Use Jest for unit testing:

```typescript
import { SyncManager } from '../sync/manager';
import { GitClient } from '../git/client';

jest.mock('../git/client');

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockGitClient: jest.Mocked<GitClient>;
  
  beforeEach(() => {
    mockGitClient = new GitClient('/test') as jest.Mocked<GitClient>;
    syncManager = new SyncManager('/test', defaultConfig);
  });
  
  describe('syncWorktree', () => {
    it('should sync worktree successfully', async () => {
      mockGitClient.diff.mockResolvedValue({
        files_changed: 5,
        insertions: 100,
        deletions: 50,
        files: [],
      });
      
      const result = await syncManager.syncWorktree('feature/test');
      
      expect(result.status).toBe('success');
      expect(result.diff_summary?.files_changed).toBe(5);
    });
    
    it('should abort on conflicts', async () => {
      mockGitClient.diff.mockResolvedValue({ /* ... */ });
      mockConflictDetector.detectConflicts.mockResolvedValue({
        conflictInfo: {
          has_conflicts: true,
          conflicted_files: ['file.ts'],
          conflict_count: 1,
          risk_level: 'medium',
        },
        riskLevel: 'medium',
      });
      
      const result = await syncManager.syncWorktree('feature/test');
      
      expect(result.status).toBe('conflict');
    });
  });
});
```

### Writing Integration Tests

```typescript
describe('Sync Integration', () => {
  let testRepoPath: string;
  
  beforeAll(async () => {
    testRepoPath = await setupTestRepository();
  });
  
  afterAll(async () => {
    await cleanupTestRepository(testRepoPath);
  });
  
  it('should sync worktree end-to-end', async () => {
    // Create test worktree
    await createTestWorktree(testRepoPath, 'feature/test');
    
    // Make changes in worktree
    await makeTestChanges(testRepoPath, 'feature/test');
    
    // Sync worktree
    const syncManager = new SyncManager(testRepoPath, defaultConfig);
    const result = await syncManager.syncWorktree('feature/test');
    
    // Verify sync succeeded
    expect(result.status).toBe('success');
    
    // Verify changes in main
    const mainFiles = await readDirectory(path.join(testRepoPath, 'main'));
    expect(mainFiles).toContain('test-file.ts');
  });
});
```

---

## 8. Code Style Guidelines

### TypeScript Style

- **Use strict mode**: Enable `strict: true` in `tsconfig.json`
- **Prefer explicit types**: Avoid `any` unless absolutely necessary
- **Use interfaces for objects**: Define clear contracts
- **Use enums for constants**: Better type safety

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `SyncManager`, `GitClient` |
| Interfaces | PascalCase with `I` prefix optional | `SyncOperation`, `ISyncConfig` |
| Functions | camelCase | `syncWorktree`, `analyzeDiff` |
| Variables | camelCase | `syncId`, `branchName` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Files | kebab-case | `sync-manager.ts`, `git-client.ts` |

### Code Organization

```typescript
// 1. Imports (external, then internal)
import { promises as fs } from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger';

// 2. Constants
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 300000;

// 3. Interfaces/Types
interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
}

// 4. Class definition
export class SyncManager {
  // 4.1 Private properties
  private logger = getLogger();
  private config: SyncConfig;
  
  // 4.2 Constructor
  constructor(repoPath: string, config: SyncConfig) {
    this.config = config;
  }
  
  // 4.3 Public methods
  async syncWorktree(branch: string): Promise<SyncOperation> {
    // Implementation
  }
  
  // 4.4 Private methods
  private async validateBranch(branch: string): Promise<void> {
    // Implementation
  }
}
```

### Error Handling

```typescript
// Use custom error classes
throw new SyncOperationError('Sync failed', branch, syncId);

// Always log errors
this.logger.error('Operation failed', { error: error.message, context });

// Provide helpful error messages
throw new ValidationError(
  `Branch "${branch}" is excluded from sync`,
  ['Check excludedWorktrees in settings.json']
);
```

### Async/Await

```typescript
// Prefer async/await over promises
async function syncWorktree(branch: string): Promise<SyncOperation> {
  const diff = await this.analyzer.analyzeDiff(branch);
  const conflicts = await this.conflictDetector.checkConflicts(branch);
  
  if (conflicts.has_conflicts) {
    throw new ConflictError('Conflicts detected');
  }
  
  return await this.merger.merge(branch);
}

// Use Promise.all for parallel operations
const [diff, conflicts, validation] = await Promise.all([
  this.analyzer.analyzeDiff(branch),
  this.conflictDetector.checkConflicts(branch),
  this.validator.validateSync(branch),
]);
```

---

## 9. Pull Request Process

### Before Submitting

1. **Run tests**: Ensure all tests pass
2. **Check coverage**: Maintain >80% coverage
3. **Run linter**: Fix all linting errors
4. **Run type checker**: Fix all type errors
5. **Update documentation**: Document new features

```bash
# Pre-submission checklist
npm run lint
npm run typecheck
npm run test
npm run test:coverage
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Motivation
Why is this change needed?

## Changes
- Added feature X
- Fixed bug Y
- Updated documentation Z

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] Documentation updated

## Checklist
- [ ] Tests pass locally
- [ ] Linter passes
- [ ] Type checker passes
- [ ] Coverage >80%
- [ ] Documentation updated
- [ ] CHANGELOG updated
```

### Review Process

1. Submit PR
2. Automated checks run (CI/CD)
3. Code review by maintainer
4. Address feedback
5. Approval and merge

---

## 10. Common Patterns

### Logging Pattern

```typescript
import { getLogger } from '../utils/logger';

class MyClass {
  private logger = getLogger();
  
  async doSomething(param: string): Promise<void> {
    this.logger.info('Starting operation', { param });
    
    try {
      // Do work
      this.logger.debug('Work completed', { result });
    } catch (error) {
      this.logger.error('Operation failed', { 
        param, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
}
```

### Error Handling Pattern

```typescript
try {
  const result = await riskyOperation();
} catch (error) {
  if (error instanceof CustomError) {
    // Handle specific error
  } else if (error instanceof Error) {
    // Handle general error
  } else {
    // Handle unknown error
    throw new UnexpectedError(String(error));
  }
}
```

### Configuration Pattern

```typescript
interface MyConfig {
  enabled: boolean;
  timeout: number;
}

class MyClass {
  private config: MyConfig;
  
  constructor(config: Partial<MyConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      timeout: config.timeout ?? 60000,
    };
  }
}
```

### Validation Pattern

```typescript
import { z } from 'zod';

const MySchema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive(),
});

function validateInput(input: unknown): MyData {
  const result = MySchema.safeParse(input);
  
  if (!result.success) {
    throw new ValidationError(
      'Invalid input',
      result.error.errors.map(e => `${e.path}: ${e.message}`)
    );
  }
  
  return result.data;
}
```

---

## Related Documentation

- [Architecture Documentation](./architecture.md) - System architecture
- [API Reference](./api-reference.md) - API documentation
- [Operations Guide](./operations.md) - Deployment and operations
