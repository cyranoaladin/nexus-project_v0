import type { Rule, Guards } from '../../core/rules/types';
import type { Workflow, WorkflowStep, ErrorHandling, WorkflowExecution, StepExecution } from '../../core/workflows/types';
import type { SyncOperation } from '../../core/sync/types';
import type { CommitEvent, FileChangeEvent } from '../../core/events/types';

/**
 * Create a mock Rule with default values
 */
export function createMockRule(overrides: Partial<Rule> = {}): Rule {
  const defaults: Rule = {
    name: 'test-rule',
    version: '1.0.0',
    description: 'Test rule',
    author: 'test@example.com',
    enabled: true,
    triggers: [{
      type: 'commit',
      branches: { pattern: 'main' },
    }],
    conditions: [],
    actions: [{
      type: 'log',
      message: 'Test action',
    }],
    guards: {
      max_retries: 3,
      timeout: 300,
      on_error: 'abort',
    },
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock Guards object
 */
export function createMockGuards(overrides: Partial<Guards> = {}): Guards {
  return {
    max_retries: 3,
    timeout: 300,
    on_error: 'abort',
    ...overrides,
  };
}

/**
 * Create a mock WorkflowStep
 */
export function createMockWorkflowStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: 'step-1',
    name: 'Test Step',
    type: 'shell',
    command: 'echo "test"',
    ...overrides,
  };
}

/**
 * Create a mock ErrorHandling
 */
export function createMockErrorHandling(overrides: Partial<ErrorHandling> = {}): ErrorHandling {
  return {
    strategy: 'abort',
    ...overrides,
  };
}

/**
 * Create a mock Workflow
 */
export function createMockWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  const defaults: Workflow = {
    name: 'test-workflow',
    version: '1.0.0',
    description: 'Test workflow',
    author: 'test@example.com',
    inputs: [],
    outputs: [],
    steps: [createMockWorkflowStep()],
    error_handling: createMockErrorHandling(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock StepExecution
 */
export function createMockStepExecution(overrides: Partial<StepExecution> = {}): StepExecution {
  return {
    step_id: 'step-1',
    status: 'pending',
    ...overrides,
  };
}

/**
 * Create a mock WorkflowExecution
 */
export function createMockWorkflowExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  const defaults: WorkflowExecution = {
    id: 'exec-1',
    workflow_name: 'test-workflow',
    status: 'pending',
    started_at: new Date(),
    inputs: {},
    outputs: {},
    steps: [],
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock SyncOperation
 */
export function createMockSyncOperation(overrides: Partial<SyncOperation> = {}): SyncOperation {
  const defaults: SyncOperation = {
    id: 'sync-1',
    worktree_branch: 'feature/test',
    commit_hash: 'abc123',
    status: 'pending',
    started_at: new Date(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock CommitEvent
 */
export function createMockCommitEvent(overrides: Partial<CommitEvent> = {}): CommitEvent {
  const defaults: CommitEvent = {
    id: 'event-1',
    type: 'commit' as const,
    timestamp: new Date(),
    source: 'test',
    worktree: '/path/to/worktree',
    branch: 'main',
    commit_hash: 'abc123',
    commit_message: 'Test commit',
    author: 'Test User <test@example.com>',
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock FileChangeEvent
 */
export function createMockFileChangeEvent(overrides: Partial<FileChangeEvent> = {}): FileChangeEvent {
  const defaults: FileChangeEvent = {
    id: 'event-1',
    type: 'file_change' as const,
    timestamp: new Date(),
    source: 'test',
    worktree: '/path/to/worktree',
    branch: 'main',
    files_changed: ['file.ts'],
    change_type: 'modified',
  };

  return { ...defaults, ...overrides };
}

/**
 * Create typed Jest mock functions
 */
export const createTypedMocks = {
  /**
   * Mock function that returns an array
   */
  arrayReturning<T>() {
    return jest.fn<() => T[]>();
  },

  /**
   * Mock function that returns a promise of array
   */
  promiseArrayReturning<T>() {
    return jest.fn<() => Promise<T[]>>();
  },

  /**
   * Mock function that returns a single value
   */
  valueReturning<T>() {
    return jest.fn<() => T>();
  },

  /**
   * Mock function that returns a promise
   */
  promiseReturning<T>() {
    return jest.fn<() => Promise<T>>();
  },

  /**
   * Mock function that takes one argument and returns a value
   */
  withArg<A, R>() {
    return jest.fn<(arg: A) => R>();
  },

  /**
   * Mock function that takes one argument and returns a promise
   */
  withArgPromise<A, R>() {
    return jest.fn<(arg: A) => Promise<R>>();
  },
};
